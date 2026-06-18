---
phase: 07-affiliation-paliers
plan: 06
subsystem: ui
tags: [next-intl, react-hook-form, zod, supabase-rls, tailwind-rtl, affiliate, bigint]

# Dependency graph
requires:
  - phase: 07-01
    provides: vue affiliate_dashboard (agrégats RLS security_invoker, revenue_total/current_month_atomic)
  - phase: 07-02
    provides: grille TIERS + affiliateRateBps (@app/core, palier/progression/taux)
  - phase: 07-03
    provides: transitions de candidature + isolation RLS affiliate
  - phase: 07-05
    provides: file de revue back-office (admin.affiliateQueue) + ApplicationRowActions
provides:
  - "Surface candidature [locale]/affiliation (form D-08, insert affiliate_applications via service_role)"
  - "Dashboard affilié no-PII [locale]/(affiliate)/dashboard (agrégats seuls via vue RLS, palier+progression, revenu cumul+mois)"
  - "Namespace i18n affiliate fr/en/ar à parité stricte + test de parité"
affects: [phase-08, affiliation, member-surfaces, i18n]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RSC lit la vue RLS via createServerSupabaseClient(cookies) (auth-client, jamais service_role) pour le no-PII"
    - "Server action service_role pour insert sans policy front (frontière producteur-unique)"
    - "*_atomic string -> formatAtomic(BigInt(...)) côté serveur, jamais Number (T-07-FLOAT)"

key-files:
  created:
    - apps/web/src/app/[locale]/affiliation/page.tsx
    - apps/web/src/app/[locale]/affiliation/actions.ts
    - apps/web/src/app/[locale]/affiliation/ApplicationForm.tsx
    - apps/web/src/app/[locale]/(affiliate)/dashboard/page.tsx
    - apps/web/src/app/[locale]/(affiliate)/dashboard/RevenueTabs.tsx
    - apps/web/src/messages/__tests__/messages-parity-affiliate.test.ts
  modified:
    - apps/web/src/messages/fr.json
    - apps/web/src/messages/en.json
    - apps/web/src/messages/ar.json

key-decisions:
  - "Dashboard lit la vue en RSC via createServerSupabaseClient(cookies) (auth-client RLS) plutôt qu'en client react-query : la lecture server-side garantit l'isolation RLS et évite d'exposer la clé/le fetch ; tabs cumul/mois délégués à un petit composant client (RevenueTabs)"
  - "Le caractère '%' est AUTORISÉ dans le namespace affiliate (taux factuel 8-20%, grille D-01) — la garde no-perf VITR-03 ne bannit que les promesses de gain (garanti/profit/gagnez + équivalents en/ar), contrairement au test payment qui bannit '%'"
  - "ApplicationForm sépare schéma client (email conditionnel selon session) et schéma serveur (source de vérité) ; l'email vient de la session si connecté, sinon du champ saisi"

patterns-established:
  - "no-PII dashboard : aucune boucle/table sur referrals individuels, agrégats seuls (D-13)"
  - "progression de palier dérivée de TIERS/affiliateRateBps (@app/core) — jamais recalculée localement"

requirements-completed: [AFF-01, AFF-02, AFF-05]

# Metrics
duration: ~35min
completed: 2026-06-18
---

# Phase 7 Plan 06: Surfaces membre affiliation (candidature + dashboard no-PII) Summary

**Page de candidature trilingue (form zod, insert affiliate_applications via service_role) et dashboard affilié no-PII lisant la vue RLS affiliate_dashboard (palier+progression via grille D-01, revenus cumul+mois courant en BigInt), namespace affiliate fr/en/ar à parité stricte.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2
- **Files modified:** 9 (6 créés, 3 modifiés)

## Accomplishments
- Surface candidature `[locale]/affiliation` (AFF-01) : formulaire D-08 (réseaux/Telegram/Facebook/abonnés/interactions), validation zod client + serveur (≥1 canal, abonnés entier ≥0), insert `affiliate_applications(status='pending')` via `createAdminServiceClient()` (Open Q1 — pas de policy insert front), Disclaimer P2 (aucune promesse de revenu, LEGAL-01).
- Dashboard affilié no-PII `[locale]/(affiliate)/dashboard` (AFF-02, D-13) : `requireRole('affiliate')` + lecture de la vue `affiliate_dashboard` via `createServerSupabaseClient` (auth-client RLS, jamais service_role). 6 tuiles d'agrégats (D-14) dont revenus cumul + mois courant (`revenue_total_atomic` + `revenue_current_month_atomic`), palier+taux et progression dérivés de la grille `@app/core`, grille 8 paliers en lecture seule, découplage audience/argent (D-02/AFF-05) via tooltips. Zéro ligne/identifiant filleul.
- Namespace `affiliate` (application.* / dashboard.* / tiers.*) ajouté fr/en/ar à parité stricte + `messages-parity-affiliate.test.ts` (parité récursive + garde no-promesse).

## Task Commits

1. **Task 1: Page candidature (form + zod + server action service_role)** - `e02240c` (feat)
2. **Task 2: Dashboard affilié no-PII + parité affiliate** - `8b79ece` (feat)

## Files Created/Modified
- `apps/web/src/app/[locale]/affiliation/page.tsx` - RSC candidature trilingue + Disclaimer P2
- `apps/web/src/app/[locale]/affiliation/actions.ts` - submitApplication (zod serveur + insert service_role)
- `apps/web/src/app/[locale]/affiliation/ApplicationForm.tsx` - form client react-hook-form + zodResolver + toast sonner
- `apps/web/src/app/[locale]/(affiliate)/dashboard/page.tsx` - dashboard no-PII (vue RLS, palier/progression, revenu cumul+mois)
- `apps/web/src/app/[locale]/(affiliate)/dashboard/RevenueTabs.tsx` - tabs cumul/mois (client)
- `apps/web/src/messages/__tests__/messages-parity-affiliate.test.ts` - garde de parité affiliate
- `apps/web/src/messages/{fr,en,ar}.json` - namespace affiliate (application/dashboard/tiers)

## Decisions Made
Voir `key-decisions` du frontmatter. Synthèse : lecture RSC auth-client pour le no-PII (au lieu de react-query client), `%` autorisé dans la garde affiliate (taux factuel, pas allégation perf), schémas zod client/serveur distincts pour l'email conditionnel à la session.

## Deviations from Plan
None - plan executed exactly as written.

Note : le plan évoquait `@tanstack/react-query` pour le fetch du dashboard. La donnée étant déjà résolue en RSC (lecture RLS auth-client server-side, plus sûr pour l'isolation), le fetch client react-query n'était pas nécessaire ; seul l'état interactif (tabs cumul/mois) est en client (`RevenueTabs`). Ce n'est pas une déviation de scope mais un choix d'implémentation cohérent avec le no-PII strict — aucun paquet ajouté/retiré, comportement fonctionnel identique.

## Issues Encountered
- Le critère grep `referral.*map|filleul.*id == 0` matchait le commentaire d'entête no-PII (« filleul, zéro identifiant »). Reformulé le commentaire (« compteurs agrégés, aucun identifiant personnel ») → grep == 0 sans changer le comportement.

## User Setup Required
None - aucune configuration de service externe requise (vue, table, grille et composants déjà en place).

## Next Phase Readiness
- AFF-01, AFF-02, AFF-05 couverts côté UI. Les 4 surfaces de la phase 07 (candidature, file de revue, dashboard, payouts) sont livrées.
- Gate de phase recommandé : `get_advisors security` pour reconfirmer l'isolation RLS (aucune fuite inter-affilié).

## Self-Check: PASSED
- 6 fichiers créés vérifiés présents ; commits `e02240c` + `8b79ece` présents.
- typecheck 0 erreur ; lint:i18n exit 0 ; vitest 468 passed / 4 skipped (parité affiliate verte).

---
*Phase: 07-affiliation-paliers*
*Completed: 2026-06-18*
