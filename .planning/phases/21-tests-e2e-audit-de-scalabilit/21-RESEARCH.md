# Phase 21 : Tests E2E + audit de scalabilité — Research

**Researched:** 2026-06-26
**Domain:** Playwright E2E (multi-rôles, CI GitHub Actions) + audit DB Postgres/Supabase (EXPLAIN ANALYZE, advisors, pg_stat_statements)
**Confidence:** HIGH (infra codebase vérifiée par lecture directe ; méthodo audit/Playwright recoupée docs officielles)

## Summary

Cette phase ne crée pas de produit : elle **prouve** que le milestone v3.0 assemblé tient. Trois livrables : (1) couverture Playwright des dashboards neufs (Phase 19 `(dash)` + Phase 20 `(admin)`, jamais testés car l'UAT manuel a été sauté) + smoke de non-régression sur l'existant ; (2) preuve d'isolation RLS/gating en E2E (non-abonné → 0 ligne, non-superadmin → 404 discret, cross-user) ; (3) un **rapport d'audit DB chiffré** sur le seed ~10k (`EXPLAIN ANALYZE` + `get_advisors` + `pg_stat_statements`).

**Deux découvertes structurantes (corrigent des hypothèses du CONTEXT) :**

1. **Il n'existe AUCUN workflow CI dans le repo** (`.github/` est absent — vérifié par glob + find). Le CONTEXT (D-09, code_context L.122) suppose « CI existante lint+typecheck+vitest sur GitHub Actions » : c'est **faux à date**. Les scripts npm (`lint`, `typecheck`, `test`, `test:e2e`) existent à la racine, mais aucun `.yml` ne les exécute. **D-09 implique donc de CRÉER `.github/workflows/ci.yml` complet** (lint + typecheck + vitest + e2e), pas seulement d'ajouter un job. `[VERIFIED: codebase glob/find]`

2. **Les tests tournent contre le projet Supabase cloud PARTAGÉ** (`csotpitrjxryjkadyiml.supabase.co`, lu dans `.env.test`), pas un stack local. Conséquences directes : les comptes fixtures E2E (D-04) **polluent la même base** que le seed ~10k d'audit (D-05) ; il faut une stratégie d'isolation (préfixe/domaine `.invalid`, teardown `auth.admin.deleteUser`) et accepter que l'audit `EXPLAIN` mesure une **compute Supabase non dédiée** (variance → médiane sur N runs). `[VERIFIED: .env.test]`

**Primary recommendation :** Refactorer la suite Playwright vers le pattern **setup-project + storageState par rôle** (5 rôles D-04), convertir les 11 items de `20-UAT.md` ~1:1 en specs cockpit, créer un **seed fixtures dédié distinct du seed 10k**, créer le workflow CI GitHub Actions de zéro (avec `webServer` Playwright activé), et produire l'audit via les outils MCP Supabase (`mcp__supabase__execute_sql` pour `EXPLAIN (ANALYZE, BUFFERS)`, `mcp__supabase__get_advisors`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Couverture flux UX (E2E-01) | E2E / Playwright (navigateur réel) | Frontend Server (Next 15 RSC) | Les flux se prouvent au niveau HTTP/DOM rendu, pas en unit |
| Isolation gating 404 (E2E-02) | Frontend Server (gate `requireRole`/`notFound()`) | E2E (assertion `status()===404`) | La garde vit dans le layout `(admin)` ; l'E2E vérifie le code HTTP |
| Isolation données 0-ligne (E2E-02) | Database (RLS + `is_superadmin()`) | E2E (DOM : table vide) + Vitest (contrat anon-client) | La barrière réelle est RLS DB ; E2E prouve l'effet visible |
| Audit plans de requête (SCALE-06) | Database (planner Postgres) | MCP Supabase (`execute_sql`) | EXPLAIN s'exécute côté DB ; le MCP est le canal d'exécution |
| Détection régressions perf/sécu | Database advisors (`get_advisors`) | — | Lint serveur Supabase (splinter), pas du code app |
| Gate anti-régression durable | CI (GitHub Actions) | — | Bloque la PR si E2E rouge (D-09) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | `1.60.0` (déjà installé, racine) | E2E navigateur, fixtures, storageState, projects | Verrouillé CLAUDE.md. Déjà 5 specs en place `[VERIFIED: package.json]` |
| `vitest` | `4.1.8` (déjà installé) | Contrats RLS deux-rôles (admin-rls, seed-rls) — restent la preuve « barrière données » | Verrouillé. E2E-02 s'appuie dessus, ne le remplace pas `[VERIFIED: CLAUDE.md]` |
| `@supabase/supabase-js` | `2.108.0` | Provisioning fixtures (`auth.admin.createUser`/`deleteUser`), exécution audit côté script | Verrouillé `[VERIFIED: CLAUDE.md]` |
| MCP `supabase` | tool-server | `execute_sql` (EXPLAIN), `get_advisors`, `list_tables`, `get_logs` | Déjà connecté (env MCP). Canal d'audit SCALE-06 `[VERIFIED: env MCP instructions]` |
| GitHub Actions | `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4` | Pipeline CI bloquant (D-09) | À CRÉER — n'existe pas `[VERIFIED: .github absent]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` | (déjà via seed/tests) | Charger `.env.test` / `.env.local` en CI via secrets | Setup global Playwright + Vitest |
| `tsx` | `4.22.4` | Exécuter le script de seed fixtures + le script d'audit en TS direct | Provisioning D-04 / orchestration audit |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Setup-project + storageState | Re-`signUp` par test (pattern actuel des specs) | Le pattern actuel (`uniqueEmail` + signUp à chaque test) est lent et crée des comptes jetables à chaque run. Pour 5 rôles stables (D-04), storageState authentifie 1×/rôle et réutilise → 40-60 % de runtime en moins `[CITED: playwright.dev/docs/auth]` |
| Supabase cloud partagé | `supabase start` local (Docker) en CI | Local = isolation totale + reset par run, MAIS exige Docker en CI + appliquer toutes les migrations + re-seeder. Le repo est câblé sur le cloud (`.env.test`). **Décision recommandée : rester cloud** pour P1 (cohérent infra existante), isoler par préfixe comptes. Documenter comme dette si flakiness CI `[ASSUMED]` |
| `pg_stat_statements` via MCP | `EXPLAIN ANALYZE` seul | pg_stat_statements donne le top requêtes réelles agrégées (mean_exec_time, calls) ; complémentaire à EXPLAIN ciblé. Exige l'extension activée (à vérifier) `[CITED: supabase docs]` |

**Installation :** rien de nouveau à `npm install` côté libs (Playwright/Vitest déjà là). Le seul « install » est `npx playwright install --with-deps chromium` en CI.

## Package Legitimacy Audit

> Aucun nouveau package externe installé dans cette phase (Playwright 1.60.0 + Vitest 4.1.8 déjà présents et verrouillés CLAUDE.md). Les seuls ajouts sont des **GitHub Actions officielles** (`actions/checkout`, `actions/setup-node`, `pnpm/action-setup`) — non distribuées via npm/PyPI, donc hors périmètre slopcheck.

| Package/Action | Source | Disposition |
|----------------|--------|-------------|
| `@playwright/test@1.60.0` | npm (déjà installé) | Approved — verrouillé CLAUDE.md `[VERIFIED: package.json]` |
| `actions/checkout@v4` | github.com/actions/checkout (officiel) | Approved |
| `actions/setup-node@v4` | github.com/actions/setup-node (officiel) | Approved |
| `pnpm/action-setup@v4` | github.com/pnpm/action-setup (officiel pnpm) | Approved |

**Packages removed (SLOP):** none. **Flagged (SUS):** none. slopcheck non requis (pas d'install npm net-new).

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────┐
                          │  CI GitHub Actions (.github/workflows/   │
                          │  ci.yml — À CRÉER, D-09)                 │
                          │  jobs: lint → typecheck → vitest → e2e   │
                          │  e2e bloque la PR si rouge               │
                          └───────────────┬─────────────────────────┘
                                          │ secrets: SUPABASE_URL, ANON, SERVICE_ROLE
                                          ▼
   ┌──────────────────┐   global setup   ┌──────────────────────────┐
   │ seed fixtures     │  (D-04)          │ Playwright setup-project │
   │ déterministe      │─── crée 5 ───────│ login 1×/rôle →          │
   │ (DISTINCT du 10k) │   comptes        │ storageState/<role>.json │
   └──────────────────┘                  └────────────┬─────────────┘
                                                       │ dependencies
                    ┌──────────────────────────────────┼───────────────────────┐
                    ▼                                   ▼                       ▼
          ┌──────────────────┐            ┌──────────────────────┐   ┌──────────────────┐
          │ specs (dash)      │            │ specs (admin) cockpit │   │ smoke existant   │
          │ Phase 19          │            │ Phase 20 ← 20-UAT.md  │   │ (auth, i18n…)    │
          │ E2E-01            │            │ E2E-01 + E2E-02 (404) │   │ non-régression   │
          └────────┬─────────┘            └───────────┬──────────┘   └──────────────────┘
                   │ navigateur réel → http://localhost:3000 (webServer Playwright)
                   ▼
          ┌─────────────────────── Next.js 15 (apps/web) ──────────────────────┐
          │ layout (member)→requireActiveSub   layout (admin)→requireRole→404   │
          │ pages en anon-client (jamais service_role)                          │
          └───────────────────────────────┬────────────────────────────────────┘
                                           ▼
          ┌──────────── Supabase cloud PARTAGÉ (csotpitrjxryjkadyiml) ──────────┐
          │ RLS wrappée (select is_superadmin()/auth.uid())  +  index keyset    │
          │ matview mv_mrr gated  +  RPC KPI gated                              │
          └───────────────────────────────┬────────────────────────────────────┘
                                           ▲ audit hors-bande (SCALE-06)
          ┌────────────────────────────────┴───────────────────────────────────┐
          │ MCP Supabase: execute_sql(EXPLAIN ANALYZE,BUFFERS) + get_advisors    │
          │ + pg_stat_statements   →  rapport chiffré versionné 21-AUDIT.md      │
          │ contexte: seed ~10k (D-05, volume réaliste)                          │
          └──────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
apps/web/
├── e2e/
│   ├── auth.setup.ts            # NOUVEAU — setup-project: login 5 rôles → storageState
│   ├── fixtures/roles.ts        # NOUVEAU — emails/rôles fixtures déterministes (D-04)
│   ├── dash/                    # NOUVEAU — specs Phase 19 (E2E-01)
│   │   └── *.spec.ts
│   ├── admin/                   # NOUVEAU — specs Phase 20 (E2E-01 + E2E-02), ← 20-UAT.md
│   │   └── *.spec.ts
│   ├── auth.spec.ts             # EXISTANT — garder en smoke (D-02)
│   ├── gating.spec.ts           # EXISTANT — base E2E-02 (déjà 404 patterns)
│   └── academie|i18n|affiliation-attribution.spec.ts  # EXISTANT — smoke
├── tests/                       # EXISTANT — gardes Vitest/contrats (ne pas casser)
playwright/.auth/                # NOUVEAU — storageState (GITIGNORE — cookies de session)
.github/workflows/ci.yml         # NOUVEAU — pipeline complet (D-09)
.planning/phases/21-*/21-AUDIT.md # NOUVEAU — rapport chiffré SCALE-06 (D-10)
apps/jobs/scripts/seed-fixtures.ts # NOUVEAU — seed comptes E2E (distinct du seed 10k, D-05)
```

### Pattern 1 : Setup-project + storageState par rôle (D-04)
**What :** un « projet » Playwright `setup` (testMatch `*.setup.ts`) qui se connecte une fois par rôle et sauvegarde l'état dans `playwright/.auth/<role>.json`. Les projets de test déclarent `dependencies: ['setup']` et `use.storageState`.
**When to use :** 5 rôles stables D-04 (anon/free/abonné/affilié/superadmin). `anon` = pas de storageState (état vierge).
```typescript
// Source: https://playwright.dev/docs/auth (project dependencies pattern)
// playwright.config.ts
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  { name: 'anon',       use: { ...devices['Desktop Chrome'] },                 // pas de storageState
    testMatch: ['e2e/**/anon-*.spec.ts'] },
  { name: 'abonne',     use: { storageState: 'playwright/.auth/abonne.json' },
    dependencies: ['setup'], testMatch: ['e2e/dash/**/*.spec.ts'] },
  { name: 'superadmin', use: { storageState: 'playwright/.auth/superadmin.json' },
    dependencies: ['setup'], testMatch: ['e2e/admin/**/*.spec.ts'] },
]
```
> **Anti-IDOR / sécurité :** `playwright/.auth/` DOIT être `.gitignore` — ces JSON contiennent des cookies de session impersonnables `[CITED: playwright.dev/docs/auth]`.

### Pattern 2 : Activer `webServer` pour CI
**What :** la config actuelle a `webServer` **commenté** (lignes 43-47). Sans lui, la CI n'a pas d'app à tester.
```typescript
// Source: playwright.dev/docs/test-webserver — décommenter + adapter
webServer: {
  command: 'pnpm --filter web build && pnpm --filter web start', // start, pas dev, en CI
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env['CI'],
  timeout: 120_000,
}
```
> En CI préférer `build && start` (proche prod, RSC compilés) plutôt que `dev`. `[CITED: playwright.dev]`

### Pattern 3 : Audit EXPLAIN via MCP Supabase
**What :** exécuter `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` sur chaque requête clé (D-07) via `mcp__supabase__execute_sql`, sur la base peuplée du seed 10k (D-05).
```sql
-- Source: supabase.com/docs/guides/database (EXPLAIN methodology)
-- Lire le plan : chercher "Index Scan"/"Index Only Scan" (OK) vs "Seq Scan" (échec D-06.1)
-- Pour RLS wrappée : l'appel is_superadmin()/auth.uid() doit apparaître en "InitPlan 1"
--   (évalué 1× — never "SubPlan" ré-exécuté par ligne) — preuve du (select …) Phase 17.
explain (analyze, buffers)
  select * from public.trade_setups
  order by created_at desc, id desc        -- aligné trade_setups_keyset_idx (created_at desc, id desc)
  limit 25;
```
**How to read for RLS (point clé de la question 1) :** une policy `using ((select public.is_superadmin()))` produit un nœud **`InitPlan`** en tête de plan, évalué **une seule fois** ; le filtre par ligne devient une comparaison sur le booléen mis en cache. Si on voyait `is_superadmin()` réévaluée par ligne, ce serait un `SubPlan`/`Filter` coûteux par tuple → régression. La preuve « non réévaluée par ligne » = présence de l'InitPlan + temps constant indépendant du nombre de lignes. `[CITED: supabase.com/docs/guides/database/database-advisors]`

### Pattern 4 : Conversion 20-UAT.md → specs Playwright
**What :** les 11 tests observables de `20-UAT.md` (gating, cockpit 4 axes, table membres keyset+filtres, file keyset, actions grant/suspend/payout, conformité, santé/signaux) se mappent ~1:1. Chaque item observable = un `test()` avec `storageState: superadmin.json`. L'isolation (E2E-02) = les variantes `anon`/`abonne` qui attendent `status()===404`.

### Anti-Patterns to Avoid
- **Réécrire les specs existantes :** D-02 = smoke léger sur auth/i18n/academie/affiliation/gating. Ne pas dupliquer ; ne pas régresser.
- **Utiliser le seed 10k comme support d'assertions E2E :** D-05 interdit — les données 10k (faker) sont volumineuses et non garanties stables item-par-item. E2E assert sur les 5 comptes fixtures déterministes uniquement.
- **`OFFSET` dans une requête auditée :** les listes sont keyset (CLAUDE.md, 0017) ; auditer la forme keyset réelle, pas un OFFSET inventé.
- **`EXPLAIN` sans `ANALYZE` pour le verdict temps :** sans ANALYZE pas de temps réel ni de comptage de lignes ; mais ANALYZE **exécute** la requête (attention aux RPC d'écriture → lire seulement, ou rollback).
- **Mesurer un seul run à froid :** la compute Supabase partagée varie ; cache froid fausse la 1ʳᵉ mesure.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Login répété par test | Helper `signUp()` à chaque test (pattern actuel) | setup-project + storageState | Built-in Playwright, -40/60 % runtime, comptes stables `[CITED: playwright.dev]` |
| Détection problèmes perf/sécu DB | Parser manuel de `pg_catalog` | `mcp__supabase__get_advisors` (splinter) | Lints maintenus Supabase : `auth_rls_initplan`, `unindexed_foreign_keys`, `unused_index`, `multiple_permissive_policies`… `[CITED: supabase docs]` |
| Top requêtes lentes | Logging maison | `pg_stat_statements` (si activé) | Agrège mean_exec_time/calls réels `[CITED: supabase docs]` |
| Suggestion d'index manquant | Heuristique maison | extension `index_advisor` Supabase | Recommande l'index optimal pour une requête `[CITED: supabase.com/docs/.../index_advisor]` |
| Attente d'éléments async | `waitForTimeout` | Web-first assertions (`expect(locator).toBeVisible`) | Auto-retry, anti-flaky `[CITED: playwright.dev]` |

**Key insight :** tout l'audit DB s'appuie sur l'outillage Supabase natif (advisors + EXPLAIN + pg_stat_statements + index_advisor). Coder un profiler maison serait moins fiable et hors scope.

## Common Pitfalls

### Pitfall 1 : Croire que la CI existe déjà
**What goes wrong :** D-09 dit « ajouter à côté de lint/typecheck/vitest » → on cherche un workflow inexistant.
**Why :** le CONTEXT (code_context L.122) affirme une CI GitHub Actions ; le repo n'a pas de `.github/`.
**How to avoid :** créer `.github/workflows/ci.yml` complet. Les commandes existent (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`).
**Warning signs :** `find . -name "*.yml"` ne retourne que `pnpm-lock.yaml` / `pnpm-workspace.yaml`. `[VERIFIED: find]`

### Pitfall 2 : Pollution du Supabase cloud partagé
**What goes wrong :** fixtures E2E + seed 10k + comptes jetables des specs existantes coexistent dans la MÊME base.
**Why :** `.env.test` pointe sur le projet cloud unique ; pas de DB par run.
**How to avoid :** comptes fixtures avec préfixe distinct (`e2e-fixture-<role>@…invalid`), teardown `auth.admin.deleteUser` en `afterAll`/global teardown, seed fixtures **idempotent** (purge ciblée par préfixe, calqué sur `seed.ts` purge `source='demo'`).
**Warning signs :** échec « User already registered », tables qui gonflent run après run.

### Pitfall 3 : Confirm-email et domaines réservés
**What goes wrong :** signup E2E échoue silencieusement (email de confirmation requis) ou domaine rejeté.
**Why :** Supabase rejette `example.com` ; et si « Confirm email » est ON, signUp n'ouvre pas de session.
**How to avoid :** « Confirm email » OFF (déjà requis D-02) ; emails `@gmail.com` pour comptes interactifs ou `.invalid` pour comptes service. Documenté dans les specs existantes. `[VERIFIED: auth.spec.ts header]`

### Pitfall 4 : EXPLAIN ANALYZE sur RPC d'écriture
**What goes wrong :** auditer `grant_subscription_time`/`suspend_account` avec ANALYZE **exécute** l'écriture + journalise `admin_audit_log`.
**Why :** ANALYZE lance réellement la requête.
**How to avoid :** D-07 cible les **lectures** (paginations keyset + RPC KPI lecture get_mrr/funnel/churn/plan_mix + policies RLS). Pour les RPC d'écriture, soit s'en tenir à get_advisors, soit `begin; explain analyze …; rollback;`.
**Warning signs :** lignes parasites dans `admin_audit_log` / `subscriptions` après audit.

### Pitfall 5 : Advisor « auth_rls_initplan » faux positif après fix
**What goes wrong :** l'advisor peut continuer d'alerter alors que la policy est wrappée.
**Why :** bug connu splinter #63 (cache/edge cases).
**How to avoid :** la barre D-06.2 = **0 NOUVEL advisor** (comparer à une baseline, pas à zéro absolu). Capturer une baseline `get_advisors` avant, comparer le delta. `[CITED: github.com/supabase/splinter/issues/63]`

### Pitfall 6 : Playwright flaky en CI (browsers/timeouts)
**What goes wrong :** navigateurs absents, timeouts trop courts contre Supabase cloud distant.
**How to avoid :** `npx playwright install --with-deps chromium` ; garder `trace: 'on-first-retry'` + `retries: process.env.CI ? 2 : 0` ; upload `playwright-report` en artefact ; timeouts réseau réalistes (la config a 30s test / 5s expect — OK, mais cloud distant peut exiger plus sur certaines nav).

## Runtime State Inventory

> Phase de tests + audit (pas un rename), mais elle CRÉE de l'état runtime persistant. Inventaire des effets de bord.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Comptes fixtures D-04 (5 rôles) écrits dans `auth.users`+`profiles` du cloud partagé ; le superadmin fixture exige `profiles.role='superadmin'` via service_role (cf. admin-rls.test.ts L.99) | Seed fixtures idempotent + teardown ; superadmin promu via service_role |
| Stored data | Seed ~10k (Phase 18, `source='demo'`) doit être présent AU MOMENT de l'audit | `pnpm --filter jobs seed` avant l'audit ; purge ciblée après si souhaité |
| Live service config | Setting Supabase « Confirm email » doit être OFF (D-02) | Vérifier dashboard Auth avant run |
| Live service config | `pg_stat_statements` : extension à activer côté projet Supabase pour la question 1 | Vérifier `select * from pg_extension where extname='pg_stat_statements'` ; activer sinon (fallback : EXPLAIN seul) |
| Secrets/env vars | CI a besoin de `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` en GitHub Secrets | Ajouter les 3 secrets au repo GitHub ; ne jamais committer service_role |
| Build artifacts | `playwright/.auth/*.json` (storageState, cookies session) | `.gitignore` obligatoire (sécurité) |
| Build artifacts | `playwright-report/`, `test-results/`, `apps/web/.next/` | `.gitignore` + artefacts CI |

**Nothing found in category OS-registered state :** None — pas de tâche planifiée/registry impliquée par cette phase.

## Code Examples

### Seed fixtures déterministe (D-04) — calqué sur seed.ts (purge idempotente)
```typescript
// Source: pattern dérivé de apps/jobs/scripts/seed.ts (purge source='demo' → ici préfixe fixture)
// apps/jobs/scripts/seed-fixtures.ts
const ROLES = ['free', 'abonne', 'affilie', 'superadmin'] as const
const admin = createClient(URL, SERVICE_ROLE, { auth: { persistSession: false } })
for (const role of ROLES) {
  const email = `e2e-fixture-${role}@nexa-e2e.invalid`
  // idempotent : delete-if-exists puis recreate (calque purge→seed de seed.ts)
  await admin.auth.admin.createUser({ email, password: FIXED_PW, email_confirm: true })
  if (role === 'superadmin') await admin.from('profiles').update({ role: 'superadmin' }).eq(...)
  if (role === 'abonne')     /* insérer subscription active déterministe */
}
```

### Setup-project login (D-04)
```typescript
// Source: https://playwright.dev/docs/auth
// apps/web/e2e/auth.setup.ts
import { test as setup } from '@playwright/test'
for (const role of ['abonne', 'affilie', 'superadmin'] as const) {
  setup(`auth ${role}`, async ({ page }) => {
    await page.goto('/fr/login')
    await page.locator('input[name="email"]').fill(`e2e-fixture-${role}@nexa-e2e.invalid`)
    await page.locator('input[name="password"]').fill(process.env.E2E_FIXTURE_PW!)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('/fr/dashboard')
    await page.context().storageState({ path: `playwright/.auth/${role}.json` })
  })
}
```

### Isolation E2E-02 (404 + 0 ligne)
```typescript
// Source: dérivé de apps/web/e2e/gating.spec.ts (patterns 404 déjà éprouvés)
// non-superadmin (storageState abonne) sur cockpit → 404 discret
test('abonné sur /admin/cockpit → 404', async ({ page }) => {
  const res = await page.goto('/admin/cockpit')
  expect(res?.status()).toBe(404)        // jamais 403 (T-01-08)
})
// non-abonné → 0 ligne de signaux visible (effet RLS rendu au DOM)
test('free sur signaux → table vide / redirigé tarifs', async ({ page }) => {
  await page.goto('/fr/signaux')
  await expect(page).toHaveURL(/\/fr\/tarifs/)  // requireActiveSub (cf. gating.spec.ts L.66-77)
})
```

### CI GitHub Actions (D-09) — À CRÉER
```yaml
# Source: pattern standard pnpm + playwright (.github/workflows/ci.yml)
name: CI
on: { pull_request: {}, push: { branches: [master] } }
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4         # lit packageManager pnpm@9.15.9
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test                      # vitest (contrats RLS)
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e                  # bloquant (D-09)
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with: { name: playwright-report, path: playwright-report/ }
```

## Méthodologie des seuils de temps (question 2 — research flag D-06.3)

La barre D-06.3 (« temps de requête borné ») n'a pas de baseline pré-existante (compute Supabase non profilée). Démarche défendable recommandée :

1. **Établir les baselines sur le seed 10k** : pour chaque requête D-07, lancer `EXPLAIN (ANALYZE, BUFFERS)` **N=5 fois**, jeter le 1ᵉʳ run (cache froid / JIT), prendre la **médiane** des 4 suivants (`Execution Time` du plan).
2. **Critère relatif, pas absolu** : sur compute partagée, fixer un seuil **par requête** = `médiane × 3` comme garde-fou de régression future, plutôt qu'une constante en ms transversale (fragile). Documenter chaque médiane observée dans `21-AUDIT.md`.
3. **Critère structurel prioritaire (le vrai verdict)** : D-06.1 (Index Scan, jamais Seq Scan sur requête chaude) + D-06.2 (0 nouvel advisor) sont **plus fiables** que le temps absolu. Le temps sert de garde secondaire / signal de tendance.
4. **Indépendance au volume** : pour les RLS wrappées, vérifier que le temps ne croît pas linéairement avec le nombre de lignes du seed (preuve InitPlan 1× vs réévaluation par ligne).
5. **Cibler `Buffers`** : `shared hit` élevé vs `read` indique cache chaud ; comparer à volume comparable.

`[ASSUMED]` — l'exact seuil ms reste à fixer après mesure réelle ; à confirmer dans le rapport d'audit.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `globalSetup` fn pour auth | **setup-project + `dependencies`** | Playwright ≥1.31 | Login parallélisable, par-rôle, traçable `[CITED: playwright.dev/docs/auth]` |
| auth.uid() nu dans RLS | `(select auth.uid())` (InitPlan) | Supabase reco perf | Gain >100× (déjà appliqué 0017) `[CITED: supabase docs]` |
| `postgres_changes` realtime | Broadcast | SCALE-05 (déjà fait) | Hors audit perf requêtes |

**Deprecated/outdated :** `@supabase/auth-helpers` (déjà banni CLAUDE.md → `@supabase/ssr`). `waitForTimeout` → web-first assertions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Rester sur le Supabase cloud partagé plutôt que stack local en CI | Alternatives / Pitfall 2 | Flakiness CI si pollution concurrente ; alternative = `supabase start` local |
| A2 | Seuil temps = `médiane×3` relatif par requête | Méthodologie seuils | Si l'utilisateur veut un SLA ms absolu, à redéfinir |
| A3 | `pg_stat_statements` activable sur le projet (sinon EXPLAIN seul) | Runtime State Inventory | Si non activable, la question 1 retombe sur EXPLAIN + advisors uniquement |
| A4 | Le routeur expose une route cockpit type `/admin/cockpit` | Code Examples E2E-02 | Vérifier les vrais chemins dans les SUMMARY Phase 20 avant d'écrire les specs |
| A5 | « Confirm email » OFF persiste sur le projet cloud | Pitfall 3 | Si réactivé, tous les signups E2E cassent |

## Open Questions

1. **Local vs cloud en CI ?**
   - What we know : repo câblé cloud (`.env.test`), specs existantes créent des comptes sur le cloud.
   - What's unclear : la pollution concurrente PR-parallèles est-elle acceptable ?
   - Recommandation : cloud + préfixe d'isolation pour P1 ; noter dette « migrer vers `supabase start` local si flaky ».

2. **Routes exactes des dashboards 19/20 ?**
   - What we know : groupes `(dash)` et `(admin)`, cockpit 4 axes, `20-UAT.md` liste 11 scénarios.
   - What's unclear : chemins URL littéraux (ex. `/admin/cockpit` vs `/admin`).
   - Recommandation : le planner lit `19-*-SUMMARY.md` + `20-*-SUMMARY.md` + `20-UAT.md` pour figer les URLs avant d'écrire les specs.

3. **pg_stat_statements activé ?**
   - Recommandation : 1er pas de l'audit = `select 1 from pg_extension where extname='pg_stat_statements'` via MCP ; sinon fallback EXPLAIN.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@playwright/test` | E2E-01/02 | ✓ | 1.60.0 | — |
| Chromium browser | run Playwright | ✗ (à installer) | — | `playwright install --with-deps chromium` |
| `vitest` | contrats RLS | ✓ | 4.1.8 | — |
| MCP `supabase` (execute_sql, get_advisors) | SCALE-06 | ✓ | server | CLI `supabase db advisors` / dashboard |
| Supabase cloud projet | E2E + audit | ✓ | csotpitrjxryjkadyiml | — |
| Seed 10k présent | audit SCALE-06 | ? (à reseeder) | — | `pnpm --filter jobs seed` |
| `pg_stat_statements` | question 1 audit | ? (à vérifier) | — | EXPLAIN + advisors seuls |
| GitHub Actions runner | D-09 CI | ✗ (workflow absent) | — | créer `.github/workflows/ci.yml` |

**Missing dependencies with no fallback :** workflow CI (doit être créé). **Missing with fallback :** Chromium (install step) ; pg_stat_statements (EXPLAIN seul) ; seed 10k (reseed).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.60.0 (E2E) + Vitest 4.1.8 (contrats RLS) |
| Config file | `playwright.config.ts` (racine) — à étendre (projects+webServer) |
| Quick run command | `pnpm test:e2e --project=anon` (sous-ensemble) |
| Full suite command | `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| E2E-01 | Flux dashboard utilisateur (Phase 19) | e2e | `pnpm test:e2e --project=abonne` | ❌ Wave 0 (`e2e/dash/*.spec.ts`) |
| E2E-01 | Cockpit superadmin 4 axes (Phase 20, ←20-UAT) | e2e | `pnpm test:e2e --project=superadmin` | ❌ Wave 0 (`e2e/admin/*.spec.ts`) |
| E2E-01 | Smoke non-régression auth/i18n/academie | e2e | `pnpm test:e2e` | ✅ (specs existantes) |
| E2E-02 | non-superadmin → 404 discret | e2e | `pnpm test:e2e --project=abonne` | ⚠️ partiel (gating.spec.ts) → étendre cockpit |
| E2E-02 | non-abonné → 0 ligne / redirection tarifs | e2e | `pnpm test:e2e` | ⚠️ partiel (gating.spec.ts L.66) |
| E2E-02 | cross-user isolation (barrière données) | integration | `pnpm test` (admin-rls/seed-rls) | ✅ Vitest (reste la preuve données) |
| SCALE-06 | EXPLAIN keyset = Index Scan | manual-audit | MCP `execute_sql` EXPLAIN | ❌ Wave 0 (`21-AUDIT.md`) |
| SCALE-06 | 0 nouvel advisor perf/sécu | manual-audit | MCP `get_advisors` | ❌ Wave 0 (baseline+delta) |
| SCALE-06 | top requêtes | manual-audit | pg_stat_statements (si dispo) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit :** `pnpm test:e2e --project=<role concerné>` (sous-ensemble rapide).
- **Per wave merge :** `pnpm test && pnpm test:e2e` (suite complète locale).
- **Phase gate :** suite CI verte (lint+typecheck+vitest+e2e) ET `21-AUDIT.md` produit avec verdict D-06 respecté (D-11).

### Wave 0 Gaps
- [ ] `apps/web/e2e/auth.setup.ts` — setup-project login 5 rôles (D-04)
- [ ] `apps/web/e2e/fixtures/roles.ts` — emails/rôles déterministes
- [ ] `apps/jobs/scripts/seed-fixtures.ts` — seed comptes E2E idempotent (distinct du 10k)
- [ ] `apps/web/e2e/dash/*.spec.ts` — couverture Phase 19 (E2E-01)
- [ ] `apps/web/e2e/admin/*.spec.ts` — couverture Phase 20 (E2E-01+E2E-02, ←20-UAT)
- [ ] `playwright.config.ts` — ajout `projects` par rôle + `dependencies` + `webServer` + `retries` CI
- [ ] `.github/workflows/ci.yml` — pipeline complet (D-09)
- [ ] `.planning/phases/21-*/21-AUDIT.md` — rapport SCALE-06 (D-10)
- [ ] `.gitignore` — `playwright/.auth/`, `playwright-report/`, `test-results/`

## Security Domain

> `security_enforcement` non désactivé → section incluse. Phase de tests/audit : la sécurité EST le sujet (isolation).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Fixtures multi-rôles ; Confirm-email OFF maîtrisé ; pas de mdp en clair commité |
| V3 Session Management | yes | storageState `.gitignore` (cookies impersonnables) ; teardown sessions |
| V4 Access Control | yes (cœur E2E-02) | Gate `requireRole`/`is_superadmin()` → 404 discret ; jamais 403 (T-01-08) ; jamais service_role côté pages |
| V5 Input Validation | partiel | open-redirect `returnTo` déjà couvert (gating.spec.ts T-01-07) — garder en smoke |
| V6 Cryptography | no | — |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Énumération existence back-office | Information Disclosure | 404 systématique (jamais 403/redirect) — E2E-02 le prouve |
| IDOR cross-user (lecture journal/watchlist d'autrui) | Tampering/Info Disclosure | RLS `user_id=(select auth.uid())` ; prouvé Vitest seed-rls + E2E 0-ligne |
| Élévation via RPC d'écriture | Elevation of Privilege | RPC `security definer` gated `is_superadmin()` → `forbidden` (admin-rls.test) |
| Secret service_role exposé en CI | Info Disclosure | GitHub Secrets uniquement ; jamais loggé ; jamais côté web |
| storageState committé | Spoofing (session theft) | `.gitignore playwright/.auth/` |

## Sources

### Primary (HIGH confidence)
- Codebase (lecture directe) : `playwright.config.ts`, `apps/web/e2e/{auth,gating}.spec.ts`, `apps/web/test/admin-rls.test.ts`, `apps/jobs/scripts/seed.ts`, `supabase/migrations/0017_scalable_foundation.sql`, `0021_admin_cockpit.sql`, `.env.test`, `package.json` (racine+web) — stack, conventions, cibles d'audit, absence CI
- `.planning/phases/21-*/21-CONTEXT.md`, `.planning/REQUIREMENTS.md` — décisions D-01..D-11, scope
- playwright.dev/docs/auth — setup-project + storageState multi-rôles
- supabase.com/docs/guides/database/database-advisors — `auth_rls_initplan`, lints perf/sécu, get_advisors

### Secondary (MEDIUM confidence)
- supabase.com/docs/.../index_advisor ; rls-performance-and-best-practices — InitPlan, index FK
- github.com/supabase/splinter/issues/63 — faux positif advisor post-fix

### Tertiary (LOW confidence)
- Seuil ms d'audit (à mesurer) ; routes URL exactes des dashboards (à confirmer via SUMMARY)

## Metadata

**Confidence breakdown :**
- Standard stack : HIGH — versions lues dans package.json/CLAUDE.md
- Architecture/infra : HIGH — lecture directe config + migrations + absence CI vérifiée
- Méthodo audit : HIGH (structure) / MEDIUM (seuils ms, à mesurer)
- Pitfalls : HIGH — découlent de l'état réel du repo (cloud partagé, CI absente)

**Research date :** 2026-06-26
**Valid until :** 2026-07-26 (stable ; revérifier si Supabase change l'API advisors ou Playwright sort une majeure)
