---
phase: 20-dashboard-superadmin-cockpit-4-axes
plan: 03
subsystem: data-access
tags: [supabase, anon-client, keyset, rpc, kpi, rls, gate, anti-injection]

# Dependency graph
requires:
  - phase: 20-02
    provides: "0021 LIVE : RPC KPI gated (get_acquisition_funnel/get_churn/get_plan_mix), profiles.suspended, has_active_subscription() étendu, types alignés"
  - phase: 20-01
    provides: "AdminUsersParamsSchema/parseAdminUsersParams (filtres serveur whitelistés)"
  - phase: 19-03
    provides: "keyset cursor.ts + sanitizeCursor (calque verbatim watchlist/queries.ts)"
  - phase: 17
    provides: "get_mrr gated + profiles_keyset_idx + formatAtomic"
provides:
  - "lib/admin/queries.ts : fetchAdminUsers keyset + filtres serveur (source/q/status) + sanitizeCursor anti-injection, anon-client only"
  - "lib/admin/kpis.ts : wrappers typés getMrr/getAcquisitionFunnel/getChurn/getPlanMix via .rpc(get_*) + formatMrr honnête (D-13)"
  - "lib/auth/gate.ts : branche suspension (suspended → signOut + redirect /login?suspended=1) dans authedClient"
affects: [20-04, 20-05, 20-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lecture cockpit anon-client only : createClient() @supabase/ssr, jamais admin-service (service_role)"
    - "Curseur keyset anti-injection : sanitizeCursor (ISO+UUID) AVANT interpolation .or() (PostgREST ne paramètre pas .or())"
    - "KPI via wrappers .rpc(get_*) gated : 0 ligne non-superadmin (jamais throw), jamais .from('mv_mrr')"
    - "Suspension = barrière RLS unique (has_active_subscription étendu) + couche UX signOut au gate"

key-files:
  created:
    - apps/web/src/lib/admin/queries.ts
    - apps/web/src/lib/admin/kpis.ts
    - apps/web/src/lib/admin/__tests__/queries.sanitize.test.ts
    - apps/web/src/lib/admin/__tests__/kpis.test.ts
  modified:
    - apps/web/src/lib/auth/gate.ts

key-decisions:
  - "D-20-03-A : filtre status='none' (sans abonnement) via filtre top-level .is('subscriptions', null) sur l'embed nullable ; active/expired via subscriptions!inner (filtre les lignes racine). Cast de forme borné car la relation n'est pas dans l'union colonne générée."
  - "D-20-03-B : getMrr retourne le mois le plus récent (reduce max sur month ISO) — get_mrr ne garantit pas l'ordre."

patterns-established:
  - "Interface-first : 3 modules lib livrés AVANT les pages 20-05/20-06 qui les consomment (pas de scavenger hunt)"
  - "Assertion source testée (readFileSync) : kpis.ts ne contient ni .from('mv_mrr') ni 'admin-service'"

requirements-completed: [ADASH-01, ADASH-02, ADASH-04, ADASH-07]

# Metrics
duration: ~15min
completed: 2026-06-26
---

# Phase 20 Plan 03: Couche d'accès données du cockpit superadmin (anon-client) Summary

**Trois modules lib sur anon-client : `queries.ts` (table utilisateurs keyset + filtres serveur + curseur anti-injection), `kpis.ts` (wrappers typés des RPC KPI gated, MRR honnête via formatAtomic), et la branche suspension de `gate.ts` — aucune lecture service_role, aucune lecture matview directe.**

## Performance
- **Duration:** ~15 min
- **Completed:** 2026-06-26
- **Tasks:** 3 (queries / kpis / gate)
- **Files:** 4 créés, 1 modifié

## Accomplishments
- **Task 1 — `lib/admin/queries.ts`** : `fetchAdminUsers(params)` keyset `(created_at desc, id desc)` + sentinelle `PAGE_SIZE+1` → `{ rows, nextCursor }`. Filtres serveur uniquement (jamais en mémoire JS) : `source` → `.eq`, `q` → `.ilike` paramétré, `status` traduit sur la jointure `subscriptions` (`!inner` pour active/expired, `.is(null)` pour none). `sanitizeCursor` (regex ISO+UUID) copié verbatim depuis `watchlist/queries.ts`, posé AVANT le `.or()`. `createClient` anon de `../supabase/server` — zéro `admin-service`.
- **Task 2 — `lib/admin/kpis.ts`** : `getMrr/getAcquisitionFunnel/getChurn/getPlanMix` délèguent à `supabase.rpc('get_*')` typés sur `database.types.ts` (alias `AcquisitionFunnelRow/ChurnRow/PlanMixRow/MvMrrRow`). `formatMrr` → montant `formatAtomic(BigInt(revenue_atomic))` + libellé verrouillé « cash encaissé / mois » (D-13). Dégradation gracieuse 0 ligne → `[]`/`null`. Aucun `.from('mv_mrr')`.
- **Task 3 — `lib/auth/gate.ts`** : dans `authedClient()` (donc partagé par `requireUser`/`requireActiveSub`/`requireRole`), lecture `profiles.suspended` après `getUser()` ; `suspended === true` → `supabase.auth.signOut()` + `redirect('/login?suspended=1')`. Signatures publiques inchangées. Couche UX complémentaire à la barrière RLS réelle (`has_active_subscription()` étendu, 0021).

## Task Commits
1. **Task 1: queries.ts keyset + sanitizeCursor** - `02286a7` (feat)
2. **Task 2: kpis.ts wrappers RPC gated** - `ca12a22` (feat)
3. **Task 3: gate.ts branche suspension** - `8eb1682` (feat)

## Files Created/Modified
- `apps/web/src/lib/admin/queries.ts` - fetchAdminUsers keyset + filtres serveur + sanitizeCursor (anon-client)
- `apps/web/src/lib/admin/kpis.ts` - wrappers typés RPC KPI gated + formatMrr honnête
- `apps/web/src/lib/admin/__tests__/queries.sanitize.test.ts` - 9 tests anti-injection curseur (T-20-13)
- `apps/web/src/lib/admin/__tests__/kpis.test.ts` - 11 tests : noms/params RPC, MRR, dégradation, assertion source no-mv_mrr
- `apps/web/src/lib/auth/gate.ts` - branche suspension (signOut + redirect)

## Threat Mitigations (threat_model du plan)
- **T-20-13 (Tampering, injection `.or()`)** : `sanitizeCursor` (ISO+UUID) avant interpolation ; 9 tests dont 2 payloads d'injection (virgule/parenthèse dans createdAt/id) → null.
- **T-20-14 (Info Disclosure, lecture `mv_mrr` directe)** : wrappers `.rpc(get_*)` uniquement ; assertion source testée « pas de `.from('mv_mrr')` ».
- **T-20-12 (Info Disclosure, KPI hors gate)** : RPC gated DB (0 ligne non-superadmin) ; wrappers ne contournent pas la garde.
- **T-20-11 (Elevation, suspendu continue)** : double barrière — RLS `has_active_subscription` étendu (0021) + signOut au gate.

## Decisions Made
- **D-20-03-A (filtre status)** : `none` via filtre top-level `.is('subscriptions', null)` sur embed nullable ; `active`/`expired` via `subscriptions!inner` (filtre les lignes racine, colonne indexée `subscriptions_active_idx`). Cast de forme borné `{ is(column: string, value: null) }` car le nom de relation n'est pas dans l'union colonne générée — aucun `any`.
- **D-20-03-B (MRR dernier mois)** : `getMrr` calcule le max sur `month` (ISO date, comparaison lexicale stable) car `get_mrr` ne garantit pas d'ordre.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Commandes de vérification adaptées au monorepo**
- **Found during:** Task 1 (premier `verify`)
- **Issue:** le plan référence `pnpm --filter web test` / `pnpm --filter web typecheck` ; ces scripts n'existent pas dans `apps/web/package.json` (test + typecheck sont des scripts racine : `vitest run`, `tsc -b --noEmit`).
- **Fix:** vérification via `pnpm vitest run <path>` (ciblage par chemin) et `pnpm typecheck` (racine). Comportement identique, aucun impact contrat.
- **Files modified:** aucun (commande seulement)

## Verification Results
- `pnpm vitest run apps/web/src/lib/admin/__tests__/queries.sanitize.test.ts` → 9/9 vert
- `pnpm vitest run apps/web/src/lib/admin/__tests__/kpis.test.ts` → 11/11 vert
- `pnpm vitest run apps/web/src/lib/admin` → 62/62 vert (aucune régression searchParams/freshness/jobs/signals)
- `pnpm typecheck` (`tsc -b --noEmit`) → exit 0 avec les types régénérés 20-02
- `grep suspended apps/web/src/lib/auth/gate.ts` → OK
- Assertions source : `queries.ts` importe `createClient` de `../supabase/server` (pas d'`admin-service`) ; `kpis.ts` sans `.from('mv_mrr')` (testé)

## Known Stubs
None — les 3 modules sont câblés sur des sources réelles (RPC live 0021, RLS superadmin). Pas de placeholder ni de données mockées dans le code de prod.

## Next Phase Readiness
- Contrats data prêts pour les pages : 20-04 (actions/mutations admin via RPC écriture gated) et 20-05/20-06 (table utilisateurs + KPI) consomment `fetchAdminUsers` / `getMrr`/`getAcquisitionFunnel`/`getChurn`/`getPlanMix`.
- Branche suspension active globalement au gate ; aucune page n'a à dupliquer la logique.

## Self-Check: PASSED
- FOUND: apps/web/src/lib/admin/queries.ts
- FOUND: apps/web/src/lib/admin/kpis.ts
- FOUND: apps/web/src/lib/admin/__tests__/queries.sanitize.test.ts
- FOUND: apps/web/src/lib/admin/__tests__/kpis.test.ts
- FOUND commit: 02286a7 (Task 1)
- FOUND commit: ca12a22 (Task 2)
- FOUND commit: 8eb1682 (Task 3)

---
*Phase: 20-dashboard-superadmin-cockpit-4-axes*
*Completed: 2026-06-26*
