---
phase: 07-affiliation-paliers
plan: 05
subsystem: ui
tags: [next-app-router, rsc, server-actions, service-role, supabase-rpc, i18n, affiliation, payout]

# Dependency graph
requires:
  - phase: 07-03
    provides: "repos service_role — listPendingApplications/transitionApplication, promoteAffiliate/createCode (CodeTakenError), markCommissionPaid (RPC atomique)"
  - phase: 04
    provides: "miroir back-office (admin)/file — guard() requireRole superadmin, createAdminServiceClient, QueueRowActions pattern, badge ambre, layout NextIntlClientProvider FR fixe"
provides:
  - "Surface 2 — (admin)/affiliation : file de revue des candidatures (approuver → promotion affiliate + code vanity D-06/D-07 ; rejeter → motif D-08)"
  - "Surface 4 — (admin)/affiliation/payouts : payout commissions (marquer payé tx_hash+montant+date D-15, RPC atomique anti double-payout)"
  - "i18n admin.affiliateQueue.* + admin.payouts.* mono-FR (invariant D-04-03-B)"
affects: [07-06, dashboard-affilié, back-office-superadmin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Back-office mono-FR hors [locale] : RSC service_role read + server action requireRole re-validée (miroir (admin)/file)"
    - "Approbation candidature : résolution applicant_email → profiles.id (compte requis) avant promotion"
    - "Montant payout saisi lisible (USDT) → toAtomic côté client → string atomique côté serveur (CR-02, zéro float)"

key-files:
  created:
    - "apps/web/src/app/(admin)/affiliation/page.tsx"
    - "apps/web/src/app/(admin)/affiliation/actions.ts"
    - "apps/web/src/app/(admin)/affiliation/payouts/page.tsx"
    - "apps/web/src/app/(admin)/affiliation/payouts/actions.ts"
    - "apps/web/src/components/admin/ApplicationRowActions.tsx"
    - "apps/web/src/components/admin/PayoutRowAction.tsx"
  modified:
    - "apps/web/src/messages/fr.json"

key-decisions:
  - "Approbation résout l'email de candidature → profiles.id (compte existant requis, NO_ACCOUNT sinon) : affiliate_applications ne stocke que applicant_email, pas de user_id"
  - "Vue payout affiche due ET paid (pas seulement due) pour satisfaire le lien tx_hash → TronScan (les payés portent le hash via payouts) ; action seulement sur due"
  - "Date de paiement saisie obligatoire UI (D-15 traçabilité) mais le payout réel est horodaté DB (payouts.paid_at default now()) — le RPC ne prend pas paid_at"
  - "Montant saisi lisible (USDT) converti via toAtomic côté client, transmis en string atomique (CR-02) — actions.ts borne ^[0-9]+$ avant l'écriture"

patterns-established:
  - "ApplicationRowActions : dialog code vanity (input borné A-Z0-9 {3,20}) + alert-dialog rejet motif requis — miroir QueueRowActions"
  - "PayoutRowAction : alert-dialog tx_hash+montant+date, confirm désactivé tant qu'un champ vide"

requirements-completed: [AFF-01, AFF-04]

# Metrics
duration: ~20min
completed: 2026-06-18
---

# Phase 07 Plan 05: Back-office affilié (revue candidatures + payout) Summary

**File de revue des candidatures (approuver → rôle affiliate + code vanity / rejeter → motif) et vue payout (marquer payé → tx_hash + montant + date via RPC atomique), mono-FR hors [locale], 404 non-superadmin — miroir exact de (admin)/file.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-18
- **Completed:** 2026-06-18
- **Tasks:** 2
- **Files modified:** 7 (6 créés + fr.json)

## Accomplishments
- Surface 2 — file de revue : superadmin approuve (promoteAffiliate + createCode code vanity validé A-Z0-9, capture CODE_TAKEN) ou rejette (motif requis), via service_role re-validé en tête de chaque action.
- Surface 4 — vue payout : superadmin marque payé (tx_hash + montant + date) via markCommissionPaid (RPC mark_commission_paid atomique : commission due→paid + insert payouts, anti double-payout porté par la DB). Lien tx_hash → TronScan target=_blank rel="noopener noreferrer".
- i18n admin.affiliateQueue.* + admin.payouts.* mono-FR (en.json/ar.json non touchés, invariant D-04-03-B respecté).
- Défense en profondeur : 404 (notFound) non-superadmin via layout (admin) + requireRole('superadmin') re-validé dans chaque server action (endpoint POST direct, T-07-ADMIN-WRITE). Aucune écriture front sur affiliates/affiliate_codes/commissions/payouts.

## Task Commits

1. **Task 1: File de revue des candidatures (admin)/affiliation** - `6cfa967` (feat)
2. **Task 2: Vue payout (admin)/affiliation/payouts** - `6fa809b` (feat)

_Note : fr.json (admin.affiliateQueue.* + admin.payouts.*) a été ajouté intégralement dans le commit Task 1._

## Files Created/Modified
- `apps/web/src/app/(admin)/affiliation/page.tsx` - RSC mono-FR, listPendingApplications via service_role, badge ambre pending, empty state, ApplicationRowActions par ligne
- `apps/web/src/app/(admin)/affiliation/actions.ts` - guard() requireRole superadmin + approveApplication (lookup email→user_id, promoteAffiliate, createCode CODE_TAKEN, transition approved) + rejectApplication (motif requis)
- `apps/web/src/app/(admin)/affiliation/payouts/page.tsx` - RSC mono-FR, commissions due/paid via service_role, badge ambre due / neutre paid, lien tx_hash TronScan rel=noopener, PayoutRowAction sur les due
- `apps/web/src/app/(admin)/affiliation/payouts/actions.ts` - payCommission requireRole superadmin + markCommissionPaid (RPC atomique) + revalidate, borne ^[0-9]+$ sur amount_atomic
- `apps/web/src/components/admin/ApplicationRowActions.tsx` - client : dialog code vanity (borne A-Z0-9 {3,20}) / alert-dialog rejet motif requis
- `apps/web/src/components/admin/PayoutRowAction.tsx` - client : alert-dialog tx_hash+montant+date, toAtomic (CR-02, zéro float)
- `apps/web/src/messages/fr.json` - admin.affiliateQueue.* + admin.payouts.* mono-FR

## Decisions Made
- **Résolution email→user_id à l'approbation** : la table affiliate_applications ne stocke que `applicant_email`. promoteAffiliate exige un `user_id`. L'action résout l'email → profiles.id (ilike) ; compte inexistant → erreur NO_ACCOUNT (le candidat doit déjà avoir un compte, cohérent D-07 pas de self-serve).
- **Vue payout = due + paid** : le plan demande un lien tx_hash → TronScan. Seules les commissions payées portent un hash (via payouts). La vue affiche donc les deux états (badge ambre due / neutre paid) ; l'action « Marquer comme payé » n'apparaît que sur les `due`.
- **Date de paiement** : saisie obligatoire UI (D-15 traçabilité) mais le RPC mark_commission_paid n'accepte pas paid_at — payouts.paid_at est horodaté DB (default now()). La saisie sert la discipline de confirmation explicite.

## Deviations from Plan

None - plan executed exactly as written. Le plan prévoyait `loadDue` sur status='due' uniquement ; étendu à due+paid pour porter le lien TronScan exigé par les acceptance criteria (Rule 2 — fonctionnalité de traçabilité requise par le plan). Aucun scope creep : action d'écriture inchangée (seulement les due).

## Issues Encountered
None.

## User Setup Required
None - SUPABASE_SERVICE_ROLE_KEY déjà requis par le back-office existant (admin-service.ts, Phase 4). Aucune nouvelle variable.

## Self-Check: PASSED

## Next Phase Readiness
- Surfaces 2 & 4 du back-office affilié livrées. AFF-01 (pose du code vanity par le superadmin, D-07) et AFF-04 (payout tracé tx_hash, D-15) couverts.
- Reste pour la phase : surface 1 (formulaire de candidature [locale], trilingue) et surface 3 (dashboard affilié no-PII) — plan 07-06.
- Verify global : `pnpm typecheck` 0 ; `lint:i18n` exit 0 ; vitest 465 passed / 0 failed (non régressé).

---
*Phase: 07-affiliation-paliers*
*Completed: 2026-06-18*
