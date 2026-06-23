/**
 * theme-scan.test.ts — garde Wave-0 de THEME-02 (Phase 15), preuve D-08.
 *
 * D-08 : « zéro CSS bespoke par page + zéro collision d'utilitaire Tailwind ».
 * Ce scan filesystem (node:fs / node:path uniquement, aucune dépendance) prouve,
 * sur les surfaces fondation touchées par la migration :
 *   1. Aucun `ring-[#2563EB]` nulle part sous apps/web/src (focus-ring hardcodé →
 *      tokenisé `ring-ring` dans le plan 03, ThemeToggle supprimé dans le plan 02).
 *   2. Aucun utilitaire de palette brute (amber/emerald/red) dans les 9 fichiers
 *      fondation nommés (15-PATTERNS.md §"Bespoke palette utilities") → remplacés
 *      par des utilitaires de token sémantique.
 *   3. Anti-collision : le glow (`--glow` / box-shadow) ne doit JAMAIS être exprimé
 *      via un utilitaire Tailwind `ring-*` sur les surfaces de marque (D-08).
 *
 * ÉTAT ACTUEL (arbre NON migré) : `ring-[#2563EB]` subsiste (LanguageSwitcher
 * lignes 168/200) et les utilitaires de palette brute existent encore → tests 1 et 2
 * RED. C'est ATTENDU : le RED prouve que la garde mesure la migration réelle des
 * plans 02 (suppression ThemeToggle) + 03 (tokenisation). Le bloc SANITY, lui, reste
 * GREEN quel que soit l'état de l'arbre (il prouve que le détecteur n'est pas trivial).
 *
 * Source : 15-CONTEXT.md D-08 ; 15-UI-SPEC §"Color guardrails (THEME-02 scan targets)" ;
 * 15-PATTERNS.md §"Bespoke palette utilities — 7 files" + §"Shared Patterns / Focus ring".
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

// __dirname = apps/web/src/styles/__tests__ → racine src = ../../
const SRC_ROOT = path.resolve(__dirname, '../../')

// Fichiers fondation (chemins relatifs depuis src/).
// — Bloc 1 : les 9 surfaces fondation Phase 15 (15-PATTERNS.md).
// — Bloc 2 : surfaces résiduelles touchées par les waves 2 du reskin (Phase 16,
//   16-PLAN.md task 1). `sante` est déjà présent ci-dessus. Le scan Test 2 est
//   donc RED sur les offenders résiduels (dashboard:58 text-red-600,
//   sante:65-66 bg-emerald-500/bg-amber-500) tant que wave 2 ne les a pas tokenisés.
const FOUNDATION_FILES = [
  'components/LanguageSwitcher.tsx',
  'app/[locale]/affiliation/dashboard/page.tsx',
  'app/(admin)/signaux/page.tsx',
  'app/(admin)/page.tsx',
  'app/(admin)/sante/page.tsx',
  'app/(admin)/affiliation/page.tsx',
  'app/(admin)/affiliation/payouts/page.tsx',
  'app/(admin)/file/page.tsx',
  'components/track-record/TrackRecordView.tsx',
  // Phase 16 — surfaces wave-2 (résiduel-offender + à tokeniser).
  'app/[locale]/dashboard/page.tsx',
  'app/[locale]/(auth)/login/page.tsx',
  'app/(admin)/membres/page.tsx',
  'app/(admin)/signaux/[id]/page.tsx',
  'app/(admin)/affiliation/affilies/page.tsx',
] as const

// Focus-ring bleu institutionnel hardcodé — interdit (D-07).
const FORBIDDEN_RING = /ring-\[#2563EB\]/

// Utilitaires de palette brute interdits dans les fichiers fondation (D-08).
const FORBIDDEN_PALETTE: { token: string; re: RegExp }[] = [
  { token: 'text-amber-700', re: /text-amber-700\b/ },
  { token: 'text-amber-400', re: /text-amber-400\b/ },
  { token: 'text-emerald-700', re: /text-emerald-700\b/ },
  { token: 'text-emerald-400', re: /text-emerald-400\b/ },
  { token: 'text-red-700', re: /text-red-700\b/ },
  { token: 'text-red-400', re: /text-red-400\b/ },
  { token: 'bg-emerald-500/10', re: /bg-emerald-500\/10/ },
  { token: 'bg-red-500/10', re: /bg-red-500\/10/ },
  { token: 'bg-amber-500/10', re: /bg-amber-500\/10/ },
  { token: 'bg-red-500', re: /bg-red-500(?!\/)/ }, // standalone, sans opacité
  { token: 'border-emerald-600/30', re: /border-emerald-600\/30/ },
  { token: 'border-red-600/30', re: /border-red-600\/30/ },
  { token: 'border-amber-600/30', re: /border-amber-600\/30/ },
  // Phase 16 — palette brute supplémentaire des surfaces wave-2 (16-PLAN.md task 1).
  // (text-emerald-400 est déjà couvert plus haut — non redupliqué.)
  { token: 'text-red-600', re: /text-red-600\b/ },
  { token: 'bg-emerald-500 (standalone)', re: /bg-emerald-500(?!\/)\b/ },
  { token: 'bg-amber-500 (standalone)', re: /bg-amber-500(?!\/)\b/ },
]

/** Lecture stricte d'un fichier fondation : un chemin manquant ÉCHOUE explicitement. */
function readFoundation(rel: string): string {
  const abs = path.resolve(SRC_ROOT, rel)
  try {
    return readFileSync(abs, 'utf-8')
  } catch {
    throw new Error(
      `Fichier fondation introuvable : ${rel} (résolu ${abs}). ` +
        `Un fichier déplacé doit surfacer — pas de skip silencieux.`,
    )
  }
}

/** Liste récursive de tous les .tsx sous un dossier. */
function listTsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...listTsxFiles(full))
    } else if (entry.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

describe('THEME-02 / D-08 : scan anti-bespoke + anti-collision', () => {
  it('Test 1 — aucun ring-[#2563EB] nulle part sous apps/web/src (focus-ring tokenisé)', () => {
    const offenders: string[] = []
    for (const file of listTsxFiles(SRC_ROOT)) {
      const src = readFileSync(file, 'utf-8')
      if (FORBIDDEN_RING.test(src)) {
        offenders.push(path.relative(SRC_ROOT, file))
      }
    }
    expect(
      offenders,
      `ring-[#2563EB] résiduel (doit devenir ring-ring) dans : ${offenders.join(', ')}`,
    ).toEqual([])
  })

  it('Test 2 — aucun utilitaire de palette brute dans les 9 fichiers fondation', () => {
    const offenders: string[] = []
    for (const rel of FOUNDATION_FILES) {
      const src = readFoundation(rel)
      for (const { token, re } of FORBIDDEN_PALETTE) {
        if (re.test(src)) {
          offenders.push(`${rel} → ${token}`)
        }
      }
    }
    expect(
      offenders,
      `Utilitaire de palette brute résiduel (doit être tokenisé) :\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })

  it('Test 3 — anti-collision : aucune classe ne couple ring-* et --glow (D-08)', () => {
    const offenders: string[] = []
    // Extrait chaque chaîne className="..." et vérifie qu'elle ne mêle pas un
    // utilitaire ring-* avec la custom prop --glow (glow = box-shadow, jamais un ring).
    const classAttr = /className\s*=\s*(?:"([^"]*)"|`([^`]*)`|\{`([^`]*)`\})/g
    for (const rel of FOUNDATION_FILES) {
      const src = readFoundation(rel)
      let m: RegExpExecArray | null
      while ((m = classAttr.exec(src)) !== null) {
        const cls = m[1] ?? m[2] ?? m[3] ?? ''
        if (/\bring-/.test(cls) && cls.includes('--glow')) {
          offenders.push(`${rel} → "${cls.trim()}"`)
        }
      }
    }
    expect(
      offenders,
      `Collision ring-*/--glow (le glow doit rester box-shadow, pas un ring) : ${offenders.join(', ')}`,
    ).toEqual([])
  })

  it('SANITY — les regex détectent des chaînes plantées (détecteur non trivial)', () => {
    const fixture = [
      'focus-visible:ring-2 focus-visible:ring-[#2563EB]',
      'text-amber-700 dark:text-amber-400',
      'border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
      'border-red-600/30 bg-red-500/10 text-red-700 dark:text-red-400',
      'bg-red-500',
      'border-amber-600/30 bg-amber-500/10',
      // Phase 16 — tokens wave-2 plantés (détecteur non trivial).
      'text-red-600',
      'bg-emerald-500',
      'bg-amber-500',
    ]
    const joined = fixture.join(' ')
    // Le focus-ring interdit DOIT matcher.
    expect(FORBIDDEN_RING.test(joined)).toBe(true)
    // Chaque utilitaire de palette interdit DOIT matcher au moins une fois.
    for (const { token, re } of FORBIDDEN_PALETTE) {
      expect(re.test(joined), `le détecteur doit matcher ${token}`).toBe(true)
    }
    // bg-red-500 standalone matche, mais bg-red-500/10 ne doit PAS être pris pour lui.
    expect(/bg-red-500(?!\/)/.test('bg-red-500/10 only')).toBe(false)
    // Collision ring-*/--glow : une chaîne plantée la déclenche.
    const collision = 'ring-2 shadow-[0_0_20px_var(--glow)]'
    expect(/\bring-/.test(collision) && collision.includes('--glow')).toBe(true)
  })

  it('SANITY — un fichier fondation manquant échoue explicitement (pas de skip)', () => {
    expect(() => readFoundation('app/(admin)/__does_not_exist__.tsx')).toThrow(/introuvable/)
  })
})
