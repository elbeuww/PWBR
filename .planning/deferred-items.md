# Deferred Items

Dette technique / durcissements consignés mais NON implémentés. À reprendre dans une phase ultérieure.

## Phase 7 — durcissement différé (LOW)

Issus de la revue sécurité Phase 7 (affiliation / attribution). Les 5 MEDIUM (M-01..M-05)
ont été corrigés dans `fix(07-sec): harden affiliation back-office + attribution`. Les 4 LOW
ci-dessous sont jugés acceptables en v1 mais tracés.

- **L-01 — cookie `aff_ref` supprimé même si l'attribution échoue.**
  Fichier : `apps/web/src/app/[locale]/(auth)/actions.ts`.
  Comportement « last-touch figé » acceptable, mais perte d'attribution possible sur une
  race (échec d'écriture du referral alors que le cookie est déjà consommé).
  Reco : ne supprimer le cookie qu'après confirmation de la persistance de l'attribution,
  ou réessayer l'attribution avant invalidation.

- **L-02 — pas de `UNIQUE(tx_hash)` sur `payouts`.**
  Fichier : `supabase/migrations/0016_affiliation.sql`.
  Un même `tx_hash` est réutilisable sur 2 commissions distinctes (l'anti double-payout du
  RPC ne protège que PAR commission, pas globalement par hash).
  Reco : migration `0017` → `create unique index payouts_tx_hash_idx on payouts (tx_hash)`.

- **L-03 — pas d'invalidation de session sur rétrogradation de rôle.**
  Fichier : `apps/web/src/lib/auth/gate.ts`.
  `requireRole` lit `profiles.role` en live (bon), mais une session ouverte avant une
  rétrogradation reste valide jusqu'à expiration. Acceptable v1.
  Reco : invalider/forcer un refresh de session sur changement de rôle si nécessaire.

- **L-04 — `submitApplication` non rate-limité + pas de `UNIQUE(applicant_email)`.**
  Fichier : `apps/web/src/app/[locale]/affiliation/actions.ts`.
  Spam de candidatures possible (insertions répétées par le même email / en masse).
  Reco : `UNIQUE(applicant_email)` sur `affiliate_applications` OU rate-limit applicatif.
