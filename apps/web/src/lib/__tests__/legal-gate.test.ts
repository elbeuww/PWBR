/**
 * legal-gate.test.ts — garde-fou du gate LEGAL-02 (Plan 02-02, Task 1).
 *
 * Behavior testé : isLegalReviewDone() a un DÉFAUT SÛR (false). Seule la valeur
 * exacte 'true' valide la revue ; toute autre valeur ou l'absence de la var =
 * non validé. P4 (1ᵉʳ encaissement) lit ce flag ; un défaut permissif serait une
 * élévation de privilège (threat T-02-05). server-only est neutralisé par l'alias
 * Vitest (__mocks__/server-only.ts), donc l'import direct est sûr ici.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { isLegalReviewDone } from '../legal-gate'

describe('legal-gate: isLegalReviewDone() défaut sûr (LEGAL-02)', () => {
  const ORIGINAL = process.env.LEGAL_REVIEW_DONE

  beforeEach(() => {
    delete process.env.LEGAL_REVIEW_DONE
  })

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.LEGAL_REVIEW_DONE
    } else {
      process.env.LEGAL_REVIEW_DONE = ORIGINAL
    }
  })

  it('retourne false quand la variable est absente (défaut)', () => {
    expect(isLegalReviewDone()).toBe(false)
  })

  it("retourne false pour toute valeur ≠ 'true'", () => {
    for (const value of ['false', '0', '1', 'TRUE', 'True', 'yes', '', ' true ']) {
      process.env.LEGAL_REVIEW_DONE = value
      expect(isLegalReviewDone(), `valeur="${value}" doit rester non validée`).toBe(false)
    }
  })

  it("retourne true UNIQUEMENT quand la valeur est exactement 'true'", () => {
    process.env.LEGAL_REVIEW_DONE = 'true'
    expect(isLegalReviewDone()).toBe(true)
  })
})
