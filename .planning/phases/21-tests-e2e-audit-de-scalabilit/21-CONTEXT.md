# Phase 21: Tests E2E + audit de scalabilité - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Cette phase **prouve que l'assemblage complet du milestone v3.0 tient** : les flux
utilisateurs principaux sont couverts par des tests Playwright, l'isolation RLS/gating
est démontrée (non-abonné → 0 ligne, non-superadmin → 404, cross-user), et un audit DB
chiffré (`EXPLAIN ANALYZE` + `get_advisors` + `pg_stat_statements`) valide les requêtes
clés sur le seed ~10k.

C'est la **dernière phase de construction** du milestone v3.0 (E2E-01, E2E-02, SCALE-06).

**HORS scope (explicite, REQUIREMENTS.md L.81) :** test de charge réel (k6/artillery).
La scalabilité de ce milestone = **conception (Phase 17) + audit DB (cette phase)**, pas
de load-test runtime.

**HORS scope (décision utilisateur 2026-06-26) :** la dette `0022` (RPC gated paiements +
affiliation) et les autres dettes ouvertes sont **soldées APRÈS** cette phase, pas pendant.
Voir `<deferred>`.
</domain>

<decisions>
## Implementation Decisions

### Couverture E2E (E2E-01)
- **D-01 :** Effort **profond sur les nouveaux dashboards** — Phase 19 (dashboard utilisateur,
  groupe `(dash)`) et Phase 20 (cockpit superadmin 4 axes, `(admin)`). Ce sont les surfaces
  neuves et **non testées** (l'UAT manuel de la Phase 20 a été sauté). L'effort va où est le risque.
- **D-02 :** **Smoke léger** sur l'existant déjà couvert par des specs (auth, academie, i18n,
  affiliation-attribution, gating) — vérifier la non-régression, pas réécrire. Ne PAS dupliquer
  les specs existantes.
- **D-03 :** Flux principaux à couvrir (du requirement E2E-01) : auth, navigation membre,
  dashboard utilisateur, abonnement, gating admin.

### Données de test E2E
- **D-04 :** **Comptes fixtures dédiés déterministes**, seedés à part, un par rôle/état :
  `anon`, `free` (non-abonné), `abonné` (subscription active), `affilié`, `superadmin`.
  Déterministes, reproductibles, CI-friendly — peu flaky.
- **D-05 :** Le **seed ~10k (Phase 18) sert UNIQUEMENT à l'audit SCALE-06** (volume réaliste
  pour les `EXPLAIN ANALYZE`), PAS comme support des assertions E2E (qui exigent des données stables).

### Barre de l'audit DB (SCALE-06)
- **D-06 :** Critère de réussite triple sur les requêtes clés : (1) **Index Scan** (pas de
  Seq Scan sur une requête chaude), (2) **0 nouvel advisor** perf/sécu (`get_advisors`),
  (3) **temps de requête borné**. Échec si Seq Scan sur requête chaude OU nouvel advisor.
- **D-07 :** Requêtes clés à auditer : paginations **keyset** (membres, file paiements,
  signaux suivis / historique user), **RPC KPI** gated (`get_mrr` / `get_acquisition_funnel`
  / `get_churn` / `get_plan_mix`), et les **policies RLS wrappées** `(select …)` (Phase 17).
- **D-08 :** L'audit ne couvre PAS les 6 RPC de la future migration `0022` (créées après cette
  phase). Au moment du solde de la dette, un `get_advisors` + `EXPLAIN` **ciblé** sera lancé
  sur ces RPC — pas un ré-audit complet.

### Exécution & gate de complétude
- **D-09 :** E2E ajoutés au **pipeline CI GitHub Actions** existant (à côté de lint / typecheck /
  vitest), **bloquant la PR**. Garde-fou anti-régression durable.
- **D-10 :** Audit SCALE-06 **documenté** (rapport chiffré versionné dans la phase).
- **D-11 :** Définition de « done » pour la phase : **tous les flux E2E verts** ET **audit DB
  sans régression** (D-06 respecté).

### Claude's Discretion
- Structure fine des specs Playwright (page objects, helpers, fixtures de login) = au planner/exécuteur.
- Choix précis des seuils de temps de requête (D-06.3) = à fixer pendant la recherche/audit selon
  les baselines observées sur le seed ~10k.
- Mécanique de provisioning/teardown des comptes fixtures (D-04) = implémentation.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope & exigences de la phase
- `.planning/REQUIREMENTS.md` §E2E (L.63-64) + §SCALE (L.53) — E2E-01, E2E-02, SCALE-06 et le
  HORS-scope load-test (L.81).
- `.planning/ROADMAP.md` (phase 21) — énoncé de phase + arête « dashboards (19-20) AVANT E2E + audit ».

### Infra E2E existante (à ÉTENDRE, ne pas recréer)
- `playwright.config.ts` — config Playwright racine déjà en place.
- `apps/web/e2e/auth.spec.ts` — flux auth déjà couvert (smoke / non-régression).
- `apps/web/e2e/gating.spec.ts` — gating déjà couvert (base pour E2E-02 isolation).
- `apps/web/e2e/academie.spec.ts`, `apps/web/e2e/i18n.spec.ts`,
  `apps/web/e2e/affiliation-attribution.spec.ts` — existant à garder en smoke.
- `apps/web/tests/signals-rls.spec.ts`, `apps/web/tests/no-flash.spec.ts`,
  `apps/web/tests/no-cdn-fonts.spec.ts` — gardes existantes.

### Seed & RLS (pour l'audit SCALE-06)
- `apps/jobs/scripts/seed.ts` — seed ~10k déterministe/idempotent (Phase 18).
- `packages/supabase/src/repositories/__tests__/seed-rls.test.ts` — RLS re-testée client anon à l'échelle.
- `apps/web/test/admin-rls.test.ts` — contrat RLS deux-rôles (superadmin vs authenticated) — base E2E-02.
- `apps/web/src/styles/__tests__/rls-unchanged.test.ts` — scan service_role (garde permanente verte).

### Surfaces à couvrir (dashboards neufs)
- Phase 19 SUMMARYs : `.planning/phases/19-dashboard-utilisateur/19-*-SUMMARY.md` (groupe `(dash)`).
- Phase 20 SUMMARYs : `.planning/phases/20-dashboard-superadmin-cockpit-4-axes/20-*-SUMMARY.md` (cockpit `(admin)`).
- `.planning/phases/20-dashboard-superadmin-cockpit-4-axes/20-UAT.md` — checklist UAT (tests observables non joués) — source directe des scénarios E2E dashboards.

### Migration de référence (pour la barre advisor)
- `supabase/migrations/0017_*.sql` — RLS wrappées `(select …)` + index keyset + matview (cible de l'audit).
- `supabase/migrations/0021_*.sql` (admin cockpit) — policies superadmin + RPC KPI gated (cible de l'audit).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Suite Playwright complète** (`playwright.config.ts` + 5 specs `apps/web/e2e/`) : la phase
  étend cette suite, elle ne la crée pas. Réutiliser la config, les conventions de spec, les helpers.
- **`20-UAT.md`** : 11 tests observables déjà rédigés pour le cockpit superadmin (gating, cockpit 4 axes,
  table membres keyset + filtres, file keyset, actions grant/suspend/payout, conformité, santé/signaux) —
  convertibles quasi 1:1 en scénarios Playwright pour E2E-01/02 sur la Phase 20.
- **`admin-rls.test.ts` / `seed-rls.test.ts`** : contrats RLS deux-rôles déjà écrits (Vitest) — modèle
  pour les assertions d'isolation E2E-02 (non-superadmin → 404, non-abonné → 0 ligne, cross-user).

### Established Patterns
- Pagination **keyset** (jamais OFFSET) sur membres / file / signaux suivis — cibles directes de l'audit `EXPLAIN`.
- Gating **`is_superadmin()`** côté DB + anon-client sur les pages — l'isolation E2E-02 valide cette frontière.
- Seed **déterministe idempotent** (faker seedé) — permet des comptes fixtures reproductibles (D-04).
- CI existante : **lint + typecheck + Vitest sur PR** (GitHub Actions) — point d'ancrage pour brancher les E2E (D-09).

### Integration Points
- Nouveau job E2E dans le workflow GitHub Actions (à côté de lint/typecheck/vitest).
- Comptes fixtures : provisioning via un seed dédié (distinct du seed ~10k) ou un setup global Playwright.
- Rapport d'audit SCALE-06 : nouveau document versionné dans `.planning/phases/21-*/`.
</code_context>

<specifics>
## Specific Ideas

- Convertir directement les 11 items de `20-UAT.md` en scénarios E2E pour le cockpit superadmin —
  l'UAT manuel a été sauté, donc l'E2E devient la preuve de la Phase 20.
- L'audit SCALE-06 produit un **rapport chiffré** (plans EXPLAIN + sortie advisors + top requêtes
  `pg_stat_statements`), pas juste un « c'est vert ».
</specifics>

<deferred>
## Deferred Ideas

- **Solde des dettes (post-Phase 21, décision utilisateur 2026-06-26)** — à traiter juste après cette
  phase, dans l'ordre choisi « audit d'abord, dette ensuite » :
  - `0022` : migration RPC `SECURITY DEFINER` gated paiements + affiliation + bascule anon de
    `file/actions.ts` & `affiliation/actions.ts` (+ retrait allowlist `DEFERRED-0022`).
  - L-02 : `UNIQUE(tx_hash)` sur `payouts` · L-04 : `UNIQUE(applicant_email)` + rate-limit candidatures.
  - L-01 : cookie `aff_ref` (race attribution) · L-03 : invalidation session sur rétrogradation de rôle.
  - Tech debt Phase 16 : WR-04 (`font-heading` non déclaré), WR-01 (`data-rain` innerHTML),
    `bg-[--token]` sans `var()` (~6 fichiers).
  - Corrections doc : SCALE-04 checkbox `[x]`, `17-VERIFICATION.md` (trou de format).
- **Gates non-code (restent ouverts, hors de notre portée)** : LEGAL-02 (sign-off juriste, bloque
  l'encaissement réel pas le code) · UAT humains navigateur Phases 16 / 17 / 20.

### Reviewed Todos (not folded)
- `0022-rpc-gated-paiements-affiliation.md` (match score 0.6) — **examiné, NON intégré** à la Phase 21.
  Raison : décision utilisateur explicite de solder la dette APRÈS l'audit (ordre « Phase 21 d'abord »).
  L'audit SCALE-06 fera un check advisor/EXPLAIN ciblé sur les RPC 0022 au moment du solde (D-08).

</deferred>

---

*Phase: 21-tests-e2e-audit-de-scalabilit*
*Context gathered: 2026-06-26*
