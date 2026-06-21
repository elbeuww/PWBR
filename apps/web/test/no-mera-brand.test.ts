/**
 * no-mera-brand.test.ts — garde Wave-0 de BRAND-01 (rebranding MERA → NEXA).
 *
 * Behavior gardé : la marque historique `MERA` (mot entier, ancré `\bMERA\b` pour
 * ne PAS attraper des substrings légitimes comme « numérateur ») et le slogan
 * « Make Everybody Rich Again » ne doivent apparaître NULLE PART dans le code/les
 * messages LIVRÉS — `apps/web/src/**` (.ts/.tsx/.json/.css) et `messages/{fr,en,ar}.json`.
 * Le test FAIL en listant `chemin:ligne` de chaque occurrence.
 *
 * Hors périmètre : `.planning/**` (docs de pilotage non livrées au build) n'est PAS
 * scanné — la marque MERA y reste légitimement (historique de décision).
 *
 * ÉTAT WAVE-0 (attendu) : à ce jour `apps/web/src/messages/fr.json:210` contient
 * encore `"codePlaceholder": "Ex : MERA2026"`. Le `it` de SCAN RÉEL est donc **RED**
 * jusqu'à ce que le plan 11-05 (rebranding i18n) renomme cette chaîne. C'est le
 * contrat Nyquist : le garde existe AVANT le code qu'il protège ; il vire au GREEN
 * dès le rebranding. Le `it` de CONTRÔLE non trivial (regex valide indépendamment)
 * est vert dès maintenant et reste la preuve que le détecteur n'est pas trivial.
 *
 * Note placement : le glob Vitest (vitest.config.ts) inclut apps/web/test/**.
 * Mirror du style text-scan de apps/web/test/no-perf-claims.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

// `\bMERA` = ancré sur frontière de mot À GAUCHE (le token COMMENCE par MERA),
// insensible à la casse. Attrape « MERA » seul ET « MERA2026 » (le code promo du
// mock, où `A2` n'a PAS de frontière `\b` à droite → `\bMERA\b` raterait). N'attrape
// PAS un substring interne (« camera », « numérateur » ne commencent pas par MERA
// sur une frontière de mot). OU le slogan complet écarté (D-2026-06-20).
const BRAND_FORBIDDEN = /\bMERA|Make Everybody Rich Again/i

const SRC_ROOT = path.resolve(__dirname, '../src')
const SCANNED_EXT = new Set(['.ts', '.tsx', '.json', '.css'])
const EXCLUDED_DIRS = new Set(['node_modules', '__tests__', '.next', 'dist'])

// Parcours récursif de apps/web/src, filtré par extension, dossiers exclus.
function walk(dir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return [] // dossier absent → tolérant
  }
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry)) return []
      return walk(full)
    }
    if (SCANNED_EXT.has(path.extname(entry))) return [full]
    return []
  })
}

// Liste les offenders (chemin:ligne) d'un fichier pour la regex de marque.
function scanFile(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8')
  const offenders: string[] = []
  content.split('\n').forEach((line, idx) => {
    if (BRAND_FORBIDDEN.test(line)) {
      offenders.push(`${path.relative(SRC_ROOT, filePath)}:${idx + 1} → ${line.trim()}`)
    }
  })
  return offenders
}

describe('BRAND-01 : aucune marque MERA / slogan dans le code livré', () => {
  it('le détecteur attrape bien les chaînes de contrôle (non trivial)', () => {
    // Contrôle indépendant des fichiers réels : prouve la non-trivialité.
    expect(BRAND_FORBIDDEN.test('Ex : MERA2026')).toBe(true)
    expect(BRAND_FORBIDDEN.test('Make Everybody Rich Again')).toBe(true)
    expect(BRAND_FORBIDDEN.test('mera2026')).toBe(true) // insensible casse
    // Négatif : ne flague pas un substring légitime.
    expect(BRAND_FORBIDDEN.test('numérateur')).toBe(false)
    expect(BRAND_FORBIDDEN.test('camera')).toBe(false)
  })

  it("ne contient aucune marque MERA dans apps/web/src + messages (RED jusqu'à 11-05)", () => {
    // Scan récursif de apps/web/src (couvre messages/{fr,en,ar}.json sous src/messages).
    const offenders = walk(SRC_ROOT).flatMap(scanFile)
    expect(
      offenders,
      `Marque MERA/slogan détectée (rebranding NEXA requis, 11-05) :\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
