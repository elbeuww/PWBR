/**
 * Décision pure de l'offre découverte one-shot (D-12, PAY-06).
 *
 * Extrait de actions.ts pour TESTABILITÉ (pas de service_role, pas d'I/O) : la
 * règle métier « la découverte 3$/7j est utilisable une seule fois » est testée en
 * unité (discovery.test.ts) indépendamment de la couche réseau/DB.
 *
 * Une découverte est consommée dès qu'un paiement `plan='discovery'` est verified
 * OU pending (réservation en cours), ou qu'un abonnement découverte existe. Après
 * consommation, seul le standard reste proposable.
 */

export interface PriorPaymentPlan {
  plan: 'discovery' | 'standard'
  status: 'verified' | 'pending' | 'rejected' | 'ambiguous'
}

/**
 * @param prior - Plans déjà observés pour l'user (paiements + abonnements).
 * @returns true si l'user peut ENCORE consommer l'offre découverte.
 */
export function canConsumeDiscovery(prior: readonly PriorPaymentPlan[]): boolean {
  return !prior.some(
    (p) => p.plan === 'discovery' && (p.status === 'verified' || p.status === 'pending'),
  )
}

/**
 * @param prior - Plans déjà observés pour l'user.
 * @returns true si la carte découverte doit rester visible/activable dans l'UI.
 *          (Symétrique de canConsumeDiscovery — exposé pour la lisibilité du composant.)
 */
export function isDiscoveryOfferAvailable(prior: readonly PriorPaymentPlan[]): boolean {
  return canConsumeDiscovery(prior)
}
