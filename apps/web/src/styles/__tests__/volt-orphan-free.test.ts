/**
 * volt-orphan-free.test.ts — garde structurelle Phase 16 (RESKIN, threat T-16-03).
 *
 * Le design system v3 (Phase 15) a figé le thème dark GREEN unique : la branche
 * de thème de la landing (`data-theme="volt"`, son toggle `nxl-theme-toggle` et la
 * clé localStorage `nexa-landing-theme`) est un ORPHELIN qui ne doit plus survivre
 * une fois la landing reskinée sur le DS global (wave 2).
 *
 * Ce scan filesystem (node:fs / node:path uniquement, aucune dépendance) parcourt
 * tout apps/web/src (.tsx + .css + .ts) et ÉCHOUE si l'une de ces chaînes apparaît.
 *
 * ÉTAT ATTENDU EN WAVE 1 : la landing (`NexaLanding.tsx`, `nexa-landing.css`,
 * `NexaLandingEffects.tsx`) porte ENCORE ces orphelins → le scan est RED tant que
 * wave 2 n'a pas migré la landing. Ce RED est la garde : il mesure le travail réel
 * de wave 2 (suppression de la branche volt). Le bloc SANITY reste GREEN quel que
 * soit l'état de l'arbre (il prouve que le détecteur n'est pas trivial).
 *
 * Source : 16-PLAN.md task 1 (volt scan) ; threat T-16-03 ; PROJECT.md (DS dark unique).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

// __dirname = apps/web/src/styles/__tests__ → racine src = ../../
const SRC_ROOT = path.resolve(__dirname, '../../')

// Extensions scannées : composants, styles et logique.
const SCANNED_EXT = ['.tsx', '.css', '.ts']

// Orphelins de la branche de thème landing — interdits sous apps/web/src (T-16-03).
const VOLT_ORPHANS: { token: string; re: RegExp }[] = [
  { token: 'data-theme="volt"', re: /data-theme=["']volt["']/ },
  { token: 'nxl-theme-toggle', re: /nxl-theme-toggle/ },
  { token: 'nexa-landing-theme', re: /nexa-landing-theme/ },
]

/** Liste récursive des fichiers scannés (.tsx/.css/.ts), hors fichiers de test. */
function listScannedFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...listScannedFiles(full))
    } else if (SCANNED_EXT.some((ext) => entry.endsWith(ext))) {
      // On ne se scanne pas soi-même (les chaînes plantées du SANITY).
      if (full.includes(`${path.sep}__tests__${path.sep}`)) continue
      out.push(full)
    }
  }
  return out
}

describe('Phase 16 / T-16-03 : zéro orphelin de thème volt sous apps/web/src', () => {
  it('aucun data-theme="volt" / nxl-theme-toggle / nexa-landing-theme ne survit', () => {
    const offenders: string[] = []
    for (const file of listScannedFiles(SRC_ROOT)) {
      const src = readFileSync(file, 'utf-8')
      for (const { token, re } of VOLT_ORPHANS) {
        if (re.test(src)) {
          offenders.push(`${path.relative(SRC_ROOT, file)} → ${token}`)
        }
      }
    }
    expect(
      offenders,
      `Orphelin de thème volt résiduel (la landing doit migrer sur le DS dark unique en wave 2) :\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })

  it('SANITY — chaque regex détecte une chaîne plantée (détecteur non trivial)', () => {
    const fixture = [
      '<div class="nxl" data-theme="volt">',
      '<div class="nxl-theme-toggle">',
      "localStorage.setItem('nexa-landing-theme', t)",
    ].join('\n')
    for (const { token, re } of VOLT_ORPHANS) {
      expect(re.test(fixture), `le détecteur doit matcher ${token}`).toBe(true)
    }
  })
})
