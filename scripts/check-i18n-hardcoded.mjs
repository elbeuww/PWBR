#!/usr/bin/env node
//
// check-i18n-hardcoded.mjs — garde-fou CI anti-chaine-dure (I18N-03, threat T-01-10).
//
// Echoue (exit 1) si du texte utilisateur LITTERAL apparait dans le JSX des pages
// et composants, hors du systeme de messages next-intl (messages/*.json). Cela
// empeche la fuite de texte non traduit / non revu et fait du « zero chaine en
// dur » une barriere de regression durable.
//
// Perimetre scanne :
//   - apps/web/src/app    (recursif, .tsx)
//   - apps/web/src/components (recursif, .tsx)
//
// Ce qui est signale :
//   1. Texte visible entre balises JSX : > Texte litteral <
//      (>= 2 lettres, au moins un mot, hors expressions {...}).
//   2. Attributs VISIBLES utilisateur : placeholder, aria-label, title, alt
//      dont la valeur est une chaine litterale alphabetique (pas {t(...)}).
//
// Ce qui est ignore (faux positifs maitrises) :
//   - Lignes portant un commentaire « // i18n-ignore » (autonymes de marque, etc.).
//   - Expressions JSX {...} (incluant {t('...')}, {format...}, variables).
//   - Nombres / ponctuation seuls, identifiants techniques.
//   - Autonymes de langue connus (Francais, English, arabe) — jamais traduits.
//   - Commentaires de bloc, imports, noms de classes (className non visible).
//
// Sortie : liste « fichier:ligne extrait » puis exit 1 si >= 1 violation, sinon 0.
//
// Source : 01-RESEARCH.md §Validation I18N-03 ; 01-04-PLAN.md Task 3.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const SCAN_DIRS = [
  join(ROOT, 'apps', 'web', 'src', 'app'),
  join(ROOT, 'apps', 'web', 'src', 'components'),
]

// Autonymes de langue : jamais traduits (coherent avec messages.language.*).
const ALLOWED_AUTONYMS = new Set(['Français', 'English', 'العربية'])

const IGNORE_MARKER = 'i18n-ignore'
const VISIBLE_ATTRS = ['placeholder', 'aria-label', 'title', 'alt']

// Recupere tous les .tsx d'un dossier (recursif), tolere les dossiers absents.
function collectTsx(dir, acc = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      collectTsx(full, acc)
    } else if (entry.endsWith('.tsx')) {
      acc.push(full)
    }
  }
  return acc
}

// Vrai si la chaine contient >= 2 lettres (latin OU arabe) => texte humain probable.
function looksLikeHumanText(s) {
  const letters = (s.match(/[A-Za-zÀ-ÖØ-öø-ÿ؀-ۿ]/g) ?? []).length
  return letters >= 2
}

function clean(s) {
  return s.replace(/\s+/g, ' ').trim()
}

// Retire toutes les expressions JSX {...}, y compris imbriquees, jusqu'a stabilite.
function stripBraces(s) {
  let prev
  let cur = s
  do {
    prev = cur
    cur = cur.replace(/\{[^{}]*\}/g, ' ')
  } while (cur !== prev)
  // Reste des accolades non equilibrees (expression multi-lignes) : neutralise tout
  // ce qui suit une accolade ouvrante ou precede une fermante orpheline.
  cur = cur.replace(/\{[^<]*/g, ' ').replace(/[^>]*\}/g, ' ')
  return cur
}

// Analyse une ligne, renvoie la liste des extraits en violation.
function scanLine(rawLine) {
  if (rawLine.includes(IGNORE_MARKER)) return []

  const violations = []
  const line = stripBraces(rawLine)

  // (1) Texte visible entre balises : > texte <
  // On evite les faux positifs du code TS/JS (arrow =>, generiques, comparaisons)
  // en n'analysant QUE les segments fermes par un vrai '<' suivant, et en rejetant
  // tout segment contenant de la ponctuation de code.
  const between = line.split('>')
  for (let i = 1; i < between.length; i++) {
    const rest = between[i]
    if (!rest.includes('<')) continue // pas un vrai segment de texte JSX ferme
    // Ne pas confondre la fleche '=>' avec une fermeture de balise.
    if (between[i - 1].endsWith('=')) continue
    const segment = rest.split('<')[0]
    if (!segment) continue
    const text = clean(segment)
    if (!text) continue
    if (ALLOWED_AUTONYMS.has(text)) continue
    // Rejette tout segment contenant de la ponctuation de code (=> code, pas du texte).
    if (/[{}()=;`]/.test(text)) continue
    // Ignore segments purement numeriques / ponctuation / symboles.
    if (/^[\d\s.,:;!?%$€[\]\-_/\\|@#*+"'~&]+$/.test(text)) continue
    if (looksLikeHumanText(text)) {
      violations.push(text)
    }
  }

  // (2) Attributs visibles : placeholder/aria-label/title/alt = "..." litteral.
  for (const attr of VISIBLE_ATTRS) {
    const re = new RegExp(attr + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'g')
    let m
    while ((m = re.exec(rawLine)) !== null) {
      const value = clean(m[2] ?? m[3] ?? '')
      if (!value) continue
      if (ALLOWED_AUTONYMS.has(value)) continue
      if (looksLikeHumanText(value)) {
        violations.push(attr + '="' + value + '"')
      }
    }
  }

  return violations
}

function main() {
  const files = SCAN_DIRS.flatMap((d) => collectTsx(d))
  const findings = []

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    let inBlockComment = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      if (inBlockComment) {
        if (trimmed.includes('*' + '/')) inBlockComment = false
        continue
      }
      if (trimmed.startsWith('/*')) {
        if (!trimmed.includes('*' + '/')) inBlockComment = true
        continue
      }
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue
      // Imports/exports sans JSX : aucun texte visible.
      if (
        (trimmed.startsWith('import ') || trimmed.startsWith('export ')) &&
        !/<[A-Za-z]/.test(line)
      ) {
        continue
      }

      for (const v of scanLine(line)) {
        findings.push({
          file: relative(ROOT, file).split(sep).join('/'),
          line: i + 1,
          text: v,
        })
      }
    }
  }

  if (findings.length > 0) {
    console.error('I18N-03 FAIL : ' + findings.length + ' chaine(s) en dur dans le JSX :\n')
    for (const f of findings) {
      console.error('  ' + f.file + ':' + f.line + '  ' + f.text)
    }
    console.error(
      '\nExternalisez vers apps/web/src/messages/*.json (t(...)), ou ajoutez\n' +
        '« // ' +
        IGNORE_MARKER +
        ' » en bout de ligne pour un autonyme de marque legitime.',
    )
    process.exit(1)
  }

  console.log('I18N-03 OK : aucune chaine en dur dans le JSX (app + components).')
  process.exit(0)
}

main()
