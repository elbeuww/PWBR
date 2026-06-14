import 'server-only'

/**
 * lib/legal-gate.ts — gate LEGAL-02 (D-16), lecture côté serveur uniquement.
 *
 * P2 POSE ce flag (défaut false) ; P4 le CONSOMME avant d'autoriser le 1ᵉʳ
 * encaissement en production (D-16.2, RESEARCH §Gate LEGAL-02). Ce module n'est
 * appelé NULLE PART en P2 (aucun paiement en P2) — il est livré prêt pour P4.
 *
 * Sécurité (threat T-02-05, élévation de privilège) :
 * - import server-side-only en tête : la valeur ne fuit jamais vers le client.
 * - Défaut SÛR : comparaison STRICTE à 'true'. Absence de la var, 'false', '1',
 *   'TRUE' ou toute autre valeur ⇒ non validé. Passer LEGAL_REVIEW_DONE=true en
 *   prod est un acte de déploiement conscient, après sign-off juriste tracé dans
 *   docs/legal/LEGAL-REVIEW.md.
 *
 * Source : 02-RESEARCH.md §Gate LEGAL-02 (verdict env var, pas de DB en P2).
 */
export function isLegalReviewDone(): boolean {
  return process.env.LEGAL_REVIEW_DONE === 'true'
}
