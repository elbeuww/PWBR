/**
 * legal-artifact.test.ts — présence de l'artefact gate LEGAL-02 (Plan 02-02, Task 1).
 *
 * Behavior testé : docs/legal/LEGAL-REVIEW.md est versionné et contient les jalons
 * de checklist non-négociables (référence LEGAL-02, statut crypto Algérie, Sign-off).
 * C'est la trace humaine qui débloque LEGAL_REVIEW_DONE=true avant le 1ᵉʳ encaissement
 * (D-16, threat T-02-06). Le chemin est résolu depuis la racine du repo.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Remontée robuste depuis apps/web/src/lib/__tests__/ jusqu'à la racine du repo.
const HERE = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..', '..')
const ARTIFACT = join(REPO_ROOT, 'docs', 'legal', 'LEGAL-REVIEW.md')

describe('legal-artifact: docs/legal/LEGAL-REVIEW.md (LEGAL-02)', () => {
  it('existe et est versionné', () => {
    expect(existsSync(ARTIFACT), `${ARTIFACT} doit exister`).toBe(true)
  })

  it('contient les jalons de checklist obligatoires', () => {
    const content = readFileSync(ARTIFACT, 'utf8')
    expect(content).toContain('LEGAL-02')
    expect(content).toContain('Sign-off')
    expect(content).toContain('crypto Algérie')
  })
})
