---
phase: 20-dashboard-superadmin-cockpit-4-axes
plan: 06
subsystem: admin-pages-anon
tags: [rsc, anon-client, rls, keyset, filtres-serveur, lecture-seule, rls-unchanged]

# Dependency graph
requires:
  - phase: 20-02
    provides: "0021 LIVE : policies SELECT superadmin sur profiles/telegram_posts/candles/trade_setups/analyses"
  - phase: 20-03
    provides: "fetchAdminUsers (keyset + filtres serveur + sanitizeCursor) + AdminUsersParamsSchema/parseAdminUsersParams"
  - phase: 20-04
    provides: "MemberRowActions/QueueRowActions/PayoutRowAction câblés sur RPC gated ; allowlist DEFERRED-0022 (file/affiliation actions)"
  - phase: 20-05
    provides: "(admin)/page.tsx cockpit home anon-client (retrait service_role) — débloque le scan rls-unchanged étendu"
provides:
  - "8 pages détail (admin) en anon-client + RLS (zéro createAdminServiceClient sur les pages)"
  - "membres/page.tsx : table users keyset + filtres serveur (statut abo / source / recherche) + « Charger la page suivante »"
  - "file/page.tsx : file paiements keyset (created_at desc, id desc) + curseur sanitizé"
  - "scan rls-unchanged étendu VERT : seuls les Server Actions légitimement allowlistés restent service_role"
affects: [21-audit-scalabilite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lecture cockpit detail = anon-client createClient() @supabase/ssr + RLS is_superadmin() (0021) ; jamais service_role bundlé page"
    - "Pagination keyset RSC : « Charger la page suivante » via nextCursor (encodeCursor) dans l'URL ; GET form de filtres réinitialise le curseur"
    - "Curseur opaque sanitizé (ISO+UUID) AVANT interpolation .or() (PostgREST ne paramètre pas .or()) — calque membres dans file/page"

key-files:
  created:
    - .planning/phases/20-dashboard-superadmin-cockpit-4-axes/20-06-SUMMARY.md
  modified:
    - apps/web/src/app/(admin)/membres/page.tsx
    - apps/web/src/app/(admin)/file/page.tsx
    - apps/web/src/app/(admin)/sante/page.tsx
    - apps/web/src/app/(admin)/signaux/page.tsx
    - apps/web/src/app/(admin)/signaux/[id]/page.tsx
    - apps/web/src/app/(admin)/affiliation/page.tsx
    - apps/web/src/app/(admin)/affiliation/affilies/page.tsx
    - apps/web/src/app/(admin)/affiliation/payouts/page.tsx
    - apps/web/src/messages/fr.json
    - apps/web/src/styles/__tests__/rls-unchanged.test.ts

key-decisions:
  - "membres : colonne « dernier paiement » retirée (fetchAdminUsers ne renvoie pas de montant) → remplacée par « source » (alignée sur le filtre serveur). Aucune donnée fabriquée, aucune requête paiements non bornée ajoutée."
  - "Allowlist D-13 : (account)/abonnement/actions.ts (Server Action paiement, chemin d'entrée de l'argent) ajouté au scan — service_role local obligatoire, non convertible, pré-existant (Phase 4)."
  - "file/page : keyset desc (created_at, id) → l'ordre d'affichage passe du plus ancien au plus récent (acceptable, calque membres)."

requirements-completed: []

# Metrics
duration: ~25min
completed: 2026-06-26
---

# Phase 20 Plan 06: Bascule anon-client des 8 pages détail (admin) — extinction rls-unchanged Summary

**Les 8 pages détail du cockpit superadmin lisent désormais via le client anon + RLS `is_superadmin()` (0021), zéro `createAdminServiceClient` sur les pages : table membres câblée sur `fetchAdminUsers` (keyset + filtres serveur, DOM borné), file paiements paginée par keyset, santé/signaux/affiliation en simple swap anon (signaux lecture seule). Le scan `rls-unchanged` étendu passe au VERT — seuls les Server Actions légitimement allowlistés (paiement money-path + DEFERRED-0022) restent service_role.**

## Performance
- **Duration:** ~25 min
- **Completed:** 2026-06-26
- **Tasks:** 3 (table membres / 7 pages restantes / confirmation scan)
- **Files:** 1 créé, 10 modifiés

## Accomplishments
- **Task 1 — `membres/page.tsx`** : retrait de `createAdminServiceClient`, requête déléguée à `fetchAdminUsers(parseAdminUsersParams(searchParams))` (anon + RLS 0021). Filtre JS en mémoire SUPPRIMÉ ; filtres poussés côté requête (statut abo active/expired/none, source demo/backtest/live, recherche email). Barre de filtres GET réécrivant l'URL (réinitialise le curseur). Pagination keyset « Charger la page suivante » via `nextCursor`/`serializeAdminUsersParams`, jamais de numéros de page. `<MemberRowActions suspended={…}>` par ligne. États vides/erreur FR verrouillés, densité `py-2`.
- **Task 2 — 7 pages restantes** : toutes basculées sur `await createClient()` anon (import `admin-service` retiré).
  - `file/page.tsx` : pagination keyset ajoutée (`order(created_at desc, id desc).limit(PAGE_SIZE+1)` + curseur sanitizé ISO+UUID avant `.or()` + « Charger la page suivante »). `profiles!inner(email)` débloqué par 0021.
  - `sante/page.tsx` : swap anon ; `v_data_freshness`/candles débloqués par la policy 0021 (sinon santé faussement rouge — Pitfall 2 évité).
  - `signaux/page.tsx` + `[id]/page.tsx` : swap anon (`trade_setups`/`telegram_posts` via 0021) ; LECTURE SEULE conservée (aucune Server Action d'édition/création).
  - `affiliation/{page,affilies,payouts}` : swap anon (tables gated superadmin 0016/0017). `listPendingApplications` accepte le client anon (`ServiceClient = SupabaseClient<Database>`).
- **Task 3 — `rls-unchanged`** : scan étendu (admin + non-admin) confirmé VERT après allowlist du Server Action de paiement. Suite web complète verte.
- **i18n `fr.json`** : ajouts `members.colSource`/`filterSource*`/`source{Demo,Backtest,Live}`/`statusNone`/`filterStatus{All,None}`/`errorHeading`/`errorBody` + namespace `pagination.loadMore` (« Charger la page suivante »).

## Task Commits
1. **Task 1: table membres anon-client keyset + filtres serveur** — `ef59f13` (feat)
2. **Task 2: bascule anon des 7 pages détail (file keyset + sante/signaux/affiliation)** — `5046801` (feat)
3. **Task 3: allowlist payment Server Action — rls-unchanged GREEN** — `be6356a` (test)

## Threat Mitigations (threat_model du plan)
- **T-20-03 (Elevation, service_role résiduel sur une page)** : retiré des 8 pages détail. Reste service_role UNIQUEMENT dans des Server Actions légitimement allowlistés (paiement money-path D-13 + DEFERRED-0022) — prouvé par le scan VERT.
- **T-20-13 (Tampering, injection `.or()` keyset)** : `sanitizeCursor` dans `fetchAdminUsers` (membres) ET garde ISO+UUID inline dans `file/page` avant interpolation.
- **T-20-18 (Tampering, édition signal côté admin)** : `signaux` + `[id]` restent strictement lecture seule (aucune Server Action d'écriture ; `persist.ts` préservé).
- **T-20-02 (Tampering, filtres URL injectés)** : `parseAdminUsersParams` safeParse champ-par-champ (whitelist `z.enum`).
- **T-20-01 (Info Disclosure, lecture cross-tenant)** : RLS superadmin 0021/0016/0017 = seule frontière ; un non-superadmin lit 0 ligne.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Allowlist du Server Action de paiement (account/abonnement/actions.ts)**
- **Found during:** Task 3 (scan rls-unchanged toujours rouge après bascule des 8 pages)
- **Issue:** le scan flaguait `app/[locale]/(account)/abonnement/actions.ts → service_role / SERVICE_ROLE_KEY`. C'est le CHEMIN D'ENTRÉE DE L'ARGENT (Phase 4) : il crée un client service_role LOCALEMENT (jamais le barrel) pour `reserveOffset`/`activateForPayment`/armement anti-replay du tx_hash. Les tables `payments`/`subscriptions` n'ont AUCUNE policy d'écriture anon → non convertible. Pré-existant (dernier commit Phase 4, untouched par ce plan), exposé par l'extension du scan aux `actions.ts` en 20-01. Catégorie identique aux 2 Server Actions déjà allowlistés (affiliation/auth, D-13).
- **Fix:** ajout à l'`ALLOWLIST` du scan avec commentaire justificatif D-13 (distinct du bloc DEFERRED-0022). Aucune conversion (casserait l'encaissement), aucune suppression.
- **Files modified:** apps/web/src/styles/__tests__/rls-unchanged.test.ts
- **Commit:** be6356a

**2. [Rule 1 - Honnêteté] Colonne « dernier paiement » retirée de la table membres**
- **Found during:** Task 1
- **Issue:** `fetchAdminUsers` (contrat 20-03) renvoie `subscriptions[]` mais AUCUN montant de paiement. Conserver la colonne « dernier paiement » aurait exigé soit une donnée fabriquée, soit une requête `payments` séparée non bornée (cassant la garantie keyset / DOM borné).
- **Fix:** colonne remplacée par « source » (alignée sur le nouveau filtre serveur `source`). Montants honnêtes : aucun chiffre fabriqué. Les montants de paiement restent visibles sur la page `file` (leur contexte légitime).
- **Files modified:** apps/web/src/app/(admin)/membres/page.tsx, apps/web/src/messages/fr.json

**3. [Rule 3 - Blocking] Commandes de vérification adaptées au monorepo**
- **Issue:** le plan référence `pnpm --filter web test/typecheck` ; ces scripts n'existent pas (test/typecheck sont des scripts racine).
- **Fix:** `pnpm vitest run <path>` + `pnpm typecheck` (racine). Comportement identique.

## Requirements Status (HONEST)
Aucune requirement re-marquée : **ADASH-01..07 sont déjà toutes `Complete`** dans REQUIREMENTS.md (marquées par les plans antérieurs 20-03/20-05). Ce plan complète la bascule anon des PAGES, mais 2 Server Actions admin (`file/actions.ts`, `affiliation/actions.ts`) restent sciemment service_role (Option B, dette 0022). La conformité PLEINE de ADASH-05/07 (zéro service_role y compris actions) reste subordonnée à la migration 0022 — documenté en `.planning/todos/pending/0022-rpc-gated-paiements-affiliation.md`.

## Verification Results
- `pnpm typecheck` (`tsc -b --noEmit`) → exit 0.
- `pnpm vitest run apps/web/src/styles/__tests__/rls-unchanged.test.ts` → 3/3 VERT (scan admin + non-admin éteint).
- `pnpm vitest run apps/web` → 260/260 (43 fichiers) VERT — inclut no-perf-claims / no-perf-seed-claims (honnêteté) + parités i18n, aucune régression.
- grep : aucune des 8 pages `(admin)` détail n'importe `createAdminServiceClient`.

## Known Stubs
None. Les 8 pages lisent des sources réelles via RLS superadmin live (0021/0016/0017). La non-conversion des 2 Server Actions file/affiliation est une dette EXPLICITE (Option B, 0022), pas un stub silencieux.

## Threat Flags
None — aucune nouvelle surface réseau/auth/schéma introduite ; bascule lecture anon sur des tables déjà gated RLS.

## Next Phase Readiness
- Dernier maillon de la bascule cockpit : toutes les PAGES (admin) sont anon-client. Le scan `rls-unchanged` est désormais une garde permanente verte.
- Dette 0022 (RPC gated paiements + affiliation) à planifier pour clore la conformité pleine ADASH-05/07 et retirer l'allowlist DEFERRED-0022.

## Self-Check: PASSED
- FOUND: .planning/phases/20-dashboard-superadmin-cockpit-4-axes/20-06-SUMMARY.md
- FOUND commit: ef59f13 (Task 1)
- FOUND commit: 5046801 (Task 2)
- FOUND commit: be6356a (Task 3)

---
*Phase: 20-dashboard-superadmin-cockpit-4-axes*
*Completed: 2026-06-26*
