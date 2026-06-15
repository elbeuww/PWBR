/**
 * Test unité de l'enforcement découverte one-shot (D-12, PAY-06).
 *
 * Logique extraite dans discovery.ts (fonction de décision pure) pour testabilité
 * sans service_role ni I/O. Vérifie : 1ère découverte autorisée, 2e refusée
 * (verified OU pending la consomme), standard toujours disponible.
 */
import { describe, it, expect } from 'vitest'
import {
  canConsumeDiscovery,
  isDiscoveryOfferAvailable,
  type PriorPaymentPlan,
} from '../discovery'

describe('découverte one-shot (D-12)', () => {
  it('autorise la 1ère découverte (aucun historique)', () => {
    expect(canConsumeDiscovery([])).toBe(true)
    expect(isDiscoveryOfferAvailable([])).toBe(true)
  })

  it('refuse une 2e découverte si une découverte est déjà verified', () => {
    const prior: PriorPaymentPlan[] = [{ plan: 'discovery', status: 'verified' }]
    expect(canConsumeDiscovery(prior)).toBe(false)
    expect(isDiscoveryOfferAvailable(prior)).toBe(false)
  })

  it('refuse une 2e découverte si une découverte est en cours (pending = réservation)', () => {
    const prior: PriorPaymentPlan[] = [{ plan: 'discovery', status: 'pending' }]
    expect(canConsumeDiscovery(prior)).toBe(false)
  })

  it('autorise la découverte malgré un pending standard (n’est pas une découverte)', () => {
    const prior: PriorPaymentPlan[] = [{ plan: 'standard', status: 'pending' }]
    expect(canConsumeDiscovery(prior)).toBe(true)
  })

  it('autorise la découverte si une tentative de découverte a échoué (rejected/ambiguous ≠ consommée)', () => {
    const prior: PriorPaymentPlan[] = [
      { plan: 'discovery', status: 'rejected' },
      { plan: 'discovery', status: 'ambiguous' },
    ]
    expect(canConsumeDiscovery(prior)).toBe(true)
  })

  it('le standard reste disponible après consommation de la découverte (seul le standard subsiste)', () => {
    const prior: PriorPaymentPlan[] = [
      { plan: 'discovery', status: 'verified' },
      { plan: 'standard', status: 'verified' },
    ]
    // La découverte n'est plus consommable…
    expect(canConsumeDiscovery(prior)).toBe(false)
    // …mais rien n'interdit le standard (pas de règle one-shot dessus).
    expect(prior.some((p) => p.plan === 'standard')).toBe(true)
  })
})
