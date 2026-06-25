/**
 * Configuration ISOLÉE du seed démo (Phase 18 — SEED-01/02/03).
 *
 * Données PURES uniquement : aucune écriture DB, aucun appel réseau, aucun calcul
 * d'agrégat métier ici. Les agrégats (MRR, commissions, win-rate, isolation) vivent
 * en DB (migrations 0009-0017) — toute tentation de les recalculer en TS dans le seed
 * est un anti-pattern (double source de vérité + risque VITR-03).
 *
 * Déterminisme (D-06) : `FAKER_SEED` figé → même seed = même dataset = N stable au
 * re-run. La purge cible exclusivement `WHERE source = 'demo'` (jamais 'live').
 *
 * Montants : USDT à 6 décimales en `bigint` ATOMIQUE (×10^6), JAMAIS de float
 * (T-18-04). `amount_atomic` est sérialisé en string côté types Supabase.
 */

/** Version du jeu de seed — bump pour invalider/identifier un dataset démo. */
export const SEED_VERSION = '18.1.0' as const;

/**
 * Graine faker figée (D-06, déterminisme). `faker.seed(FAKER_SEED)` en tête du seed
 * garantit un dataset reproductible. Ne pas modifier sans bumper SEED_VERSION.
 */
export const FAKER_SEED = 42 as const;

/**
 * Label de provenance écrit par CE seed (colonne `source`, migration 0018).
 * Le futur branchement réel écrira 'live' ; le backtest écrira 'backtest'.
 */
export const SEED_SOURCE = 'demo' as const;

/**
 * Domaine email des comptes démo. `.invalid` (RFC 2606) = jamais routable, aucun
 * risque d'email réel. Pattern d'identification pour la purge auth.admin (D-06).
 */
export const DEMO_EMAIL_DOMAIN = 'demo.nexa.invalid' as const;

/**
 * Construit un email démo déterministe pour l'index i.
 * @example demoEmail(0) // "seed-0@demo.nexa.invalid"
 */
export function demoEmail(i: number): string {
  return `seed-${i}@${DEMO_EMAIL_DOMAIN}`;
}

/**
 * Pricing verrouillé D-04 : 9 $/mois standard + 3 $/15j découverte (USDT TRC-20).
 * 6 décimales → atomique ×10^6, en `bigint` (zéro float, T-18-04). Base du MRR
 * superadmin (ADASH-02) et de l'assiette de commission affiliation.
 */
export const PRICE_ATOMIC = {
  standard: 9_000_000n,
  discovery: 3_000_000n,
} as const;

/**
 * Échelle paramétrable via env `SEED_SCALE` (mode N réduit pour dev/CI).
 * 1 = volumes cibles pleins (~10k users) ; 0.1 = ~1k ; etc. Les volumes ci-dessous
 * sont multipliés par ce facteur dans le seed. Borné > 0.
 */
export const SEED_SCALE: number = (() => {
  const raw = process.env.SEED_SCALE;
  if (!raw) return 1;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
})();

/**
 * Applique l'échelle SEED_SCALE à un volume cible et arrondit à l'entier.
 */
export function scaled(target: number): number {
  return Math.max(0, Math.round(target * SEED_SCALE));
}

/**
 * Ratios de distribution démo (D-03, RESEARCH §Ratios). Produit des dashboards
 * remplis ET un churn visible. Les % de segments d'abonnement somment à 1
 * (37 + 18 + 5 + 40). `affiliateShare` et `superadminCount` sont des sur-couches
 * indépendantes appliquées à la population.
 */
export const DEMO_RATIOS = {
  /** Abonnés actifs payants — subscriptions.status='active', current_period_end futur. */
  activeSubscribers: 0.37,
  /** Abonnés expirés — status='expired', current_period_end passé (churn visible). */
  expiredSubscribers: 0.18,
  /** Abonnés annulés — status='canceled'. */
  canceledSubscribers: 0.05,
  /** Jamais payé (leads/inscrits) — aucun abonnement actif (funnel ADASH-01). */
  neverPaid: 0.4,
  /** Fraction de la population devenant affiliée — role='affiliate' + ligne affiliates. */
  affiliateShare: 0.03,
  /** Nombre de comptes superadmin (teste is_superadmin() + dashboard admin). */
  superadminCount: 2,
  /** Mix des plans chez les abonnés : part 'standard' (le reste = 'discovery'). */
  standardPlanShare: 0.75,
} as const;

/**
 * Volumes cibles par table (~10k users cohérent, RESEARCH §Volumes), à l'échelle 1.
 * Appliquer `scaled(...)` pour le mode N réduit. Dimensionnés pour révéler les pièges
 * perf à l'audit Phase 21 (Pitfall #5 : sous-dimensionner masque les goulots).
 */
export const DEMO_VOLUMES = {
  profiles: 10_000,
  subscriptions: 6_000,
  payments: 7_000,
  analyses: 2_500,
  tradeSetups: 4_000,
  predictionOutcomes: 2_500,
  affiliates: 300,
  referrals: 3_000,
  commissions: 1_500,
  payouts: 400,
} as const;

/**
 * Fenêtre temporelle des cohortes de paiement/churn (RESEARCH §Fenêtre temporelle).
 * Ancrée sur `now`. Les souscriptions s'étalent sur `monthsBack` mois ; une fraction
 * des actifs expire en J-3/J-1 pour tester l'ExpiryBanner (Phase 19).
 */
export const DEMO_TIMELINE = {
  /** Nombre de mois d'historique d'acquisition (cohortes mensuelles). */
  monthsBack: 12,
  /** Fenêtre (jours) avant expiration où placer une fraction d'actifs (test J-3/J-1). */
  expiryWarningDays: 3,
} as const;
