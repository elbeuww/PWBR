# Phase 18 : Seed de données réalistes à l'échelle - Pattern Map

**Mapped:** 2026-06-25
**Files analyzed:** 7 nouveaux/modifiés (1 migration, 5 modules seed + 1 entrypoint, 2 tests, 1 régénération de types)
**Analogs found:** 7 / 7 (couverture 100 % — tout a un analog direct dans le repo)

> Downstream (planner) : chaque fichier ci-dessous référence un analog EXACT avec
> chemin + lignes. Copier le pattern de l'analog, pas réinventer. Le repo a déjà tout
> le vocabulaire (migration colonne+check, script tsx service_role, batch insert,
> test RLS anon, scan no-perf).

---

## File Classification

| Nouveau/Modifié fichier | Role | Data Flow | Closest Analog | Match Quality |
|-------------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0018_seed_source_column.sql` | migration | DDL (ALTER + CHECK + index partiel) | `supabase/migrations/0008_profiles_role.sql` (col+check) + `0017_scalable_foundation.sql` (index CONCURRENTLY Partie B) | exact |
| `apps/jobs/scripts/seed.ts` | script / entrypoint | batch / orchestration | `apps/jobs/scripts/freeze-nile-fixture.ts` | exact (même dossier, même tsx+dotenv+fail) |
| `apps/jobs/scripts/seed/users.ts` | utility (seed module) | request-response (auth.admin.createUser) | `apps/jobs/src/jobs/outcome-tracker.ts` (service_role lazy) | role-match |
| `apps/jobs/scripts/seed/{subscriptions,payments,signals,affiliation,market}.ts` | utility (seed modules) | batch insert | `outcome-tracker.ts` insertOutcomes + `affiliate-commission.ts` RPC | role-match |
| `apps/jobs/scripts/seed/purge.ts` | utility (seed module) | batch delete (ordre FK inverse) | `affiliate-commission.ts` (wrapper RPC service_role) + RESEARCH §Ordre purge | role-match |
| `packages/supabase/src/repositories/__tests__/seed-rls.test.ts` | test | integration (anon-client RLS) | `packages/supabase/src/repositories/__tests__/affiliate-rls.test.ts` | exact |
| `apps/web/test/no-perf-seed-claims.test.ts` | test | static scan (no DB) | `apps/web/test/no-perf-claims.test.ts` | exact (même pattern collecte+FORBIDDEN regex) |
| `packages/supabase/src/database.types.ts` (modifié) | config (types générés) | — | régénération manuelle post-migration (convention repo, Pitfall 5/6) | n/a (édition main) |

---

## Pattern Assignments

### `supabase/migrations/0018_seed_source_column.sql` (migration, DDL)

**Analogs:** `supabase/migrations/0008_profiles_role.sql` (colonne text + CHECK), `0017_scalable_foundation.sql` (Partie B index CONCURRENTLY hors tx), `0014_…` (frontière producteur / advisors gate).

**Colonne text + CHECK borné** — copier la forme exacte de 0008 L.20-22 (`add column … not null default … check (… in (…))`). Pour 0018, `default 'live'` (les lignes existantes deviennent `live` — future-proof, RESEARCH §Périmètre 0018) :
```sql
-- Source : 0008_profiles_role.sql L.20-22 (col+check) — réappliquer par table colonnée.
alter table public.<table>
  add column source text not null default 'live'
  check (source in ('live', 'demo', 'backtest'));
```
**Périmètre = 8 tables** (RESEARCH §Périmètre 0018) : `profiles, subscriptions, payments, analyses, trade_setups, prediction_outcomes, affiliates, commissions` + 0-4 tables volume (`candles, snapshots, job_runs, telegram_posts`) selon décision volume au planning.

**En-tête de migration obligatoire** — copier le bloc de commentaire canonique de 0017 L.1-19 / 0016 L.1-14 : convention `apply_migration` via MCP (JAMAIS `supabase db push`), numéro `0018` (0017 = dernière sur disque ; **0013 ABSENTE — ne pas réutiliser**), découpage Partie A (DDL transactionnel) / Partie B (CONCURRENTLY).

**Index partiel `WHERE source='demo'` en Partie B** (Open Question 3 RESEARCH) — calquer le découpage Partie B de 0017 L.350-387 : `CREATE INDEX CONCURRENTLY` interdit en transaction (erreur 25001) → commenté en fin de fichier, exécuté via `execute_sql` un statement à la fois :
```sql
-- PARTIE B (hors apply_migration — Pitfall 1, miroir 0017 L.350-361).
-- Index partiel : accélère le delete WHERE source='demo' (D-06) sur les grosses tables.
-- create index concurrently analyses_source_demo_idx on public.analyses (source) where source = 'demo';
-- create index concurrently trade_setups_source_demo_idx on public.trade_setups (source) where source = 'demo';
-- create index concurrently payments_source_demo_idx on public.payments (source) where source = 'demo';
```

**Anti-pattern bloquant (V4 Access Control)** — `source` est un **label de provenance**, JAMAIS un gate de lecture. Aucune policy ne doit `using (source = …)`. Gate au phase-end : `get_advisors(security)` ne signale aucune nouvelle fuite RLS (miroir 0014 L.19-20 / 0017 L.418-422).

---

### `apps/jobs/scripts/seed.ts` (entrypoint, orchestration)

**Analog:** `apps/jobs/scripts/freeze-nile-fixture.ts` (MÊME dossier `scripts/`, même invocation `pnpm --filter jobs exec tsx scripts/…`).

**Bootstrap dotenv + path résolu depuis le script** (freeze-nile L.17-33) :
```typescript
// Source : freeze-nile-fixture.ts L.17-33
import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = resolve(SCRIPT_DIR, '../.env') // apps/jobs/.env
config({ path: ENV_PATH })
```

**Garde-fou fail-fast + secrets validés au démarrage** (freeze-nile L.40-53, sécurité CLAUDE.md) :
```typescript
// Source : freeze-nile-fixture.ts L.40-53
function fail(msg: string): never {
  console.error(`\n❌ ${msg}\n`)
  process.exit(1)
}
const url = process.env['SUPABASE_URL']?.trim()
const key = process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim()
if (!url) fail('SUPABASE_URL manquante dans apps/jobs/.env')
if (!key) fail('SUPABASE_SERVICE_ROLE_KEY manquante dans apps/jobs/.env')
```

**main().catch** terminal (freeze-nile L.222) : `main().catch((e) => fail((e as Error).message))`.

**Script npm à ajouter** dans `apps/jobs/package.json` (miroir L.7-8 `freeze-nile-fixture`) : `"seed": "tsx scripts/seed.ts"`.

**Ordre topologique d'orchestration** (RESEARCH §System Architecture + §Ordre purge) : `purge() → users → subscriptions/payments → analyses→trade_setups→prediction_outcomes → affiliates→…→commissions → market → refresh_mv_mrr()`.

---

### `apps/jobs/scripts/seed/users.ts` (seed module, auth.admin.createUser)

**Analog:** `apps/jobs/src/jobs/outcome-tracker.ts` (client service_role lazy L.31-44).

**Client service_role lazy** — réutiliser le `serviceClient` exporté de `packages/supabase/src/service-client.ts` (L.19-28) OU le pattern lazy in-script (outcome-tracker L.33-44). Le script étant dans `apps/jobs`, l'import de `service-client.ts` (marqué `server-only` L.4) est autorisé :
```typescript
// Source : outcome-tracker.ts L.33-44 (lazy) — ou import { serviceClient } from '@app/supabase'
function getServiceClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) throw new Error('seed: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY requis')
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

**Création user = seul chemin légal** (RESEARCH Pattern 1) — `auth.admin.createUser` (jamais INSERT direct dans `auth.users` ; le trigger `handle_new_user` crée `profiles`). Emails `.invalid` (RFC 2606), `email_confirm: true`, `user_metadata: { seed: true }`. Borner via `pLimit(5-10)` (Pitfall 4). Puis `UPDATE profiles SET role=…, source='demo' WHERE id = data.user.id`.

**Déterminisme faker** — `faker.seed(42)` UNE fois en tête, ordre de génération STABLE. Multi-locale `new Faker({ locale: [ar, base] })` (RESEARCH §Code Examples L.421-435).

---

### `apps/jobs/scripts/seed/{subscriptions,payments,signals,affiliation,market}.ts` (seed modules, batch insert)

**Analog:** `outcome-tracker.ts` (`insertOutcomes` repository batch) + `affiliate-commission.ts` (appel RPC `computeCommissions` L.62).

**Batch insert + labellisation `source`** (RESEARCH Pattern 2) — chunks de ~500-1000, throw sur erreur :
```typescript
// Source : RESEARCH Pattern 2 + pattern repository insertOutcomes (outcome-tracker.ts)
for (const chunk of chunks(rows, 1000)) {
  const { error } = await client.from('subscriptions').insert(chunk)
  if (error) throw new Error(`seed subscriptions: ${error.message}`)
}
// chaque row : { …, source: 'demo' }  ← colonne 0018
```

**Outcomes BRUTS uniquement (D-02 / VITR-03)** — `signals.ts` n'écrit que `outcome ∈ {hit_tp,hit_sl,flat}` + `realized_r` (numeric), JAMAIS de `win_rate`/`%`. Le schéma `prediction_outcomes` (0014 L.29-35) n'a AUCUNE colonne de perf → garde-fou structurel. `pattern_stats` (vue 0014 L.58-137) calcule tout (RESEARCH Pattern 3).

**Commissions via RPC, jamais en JS** — `affiliation.ts` seede `affiliates/codes/referrals` puis APPELLE `compute_affiliate_commissions(period)` (miroir `affiliate-commission.ts` L.62 `computeCommissions(client, period)`). Aucune boucle de calcul de commission en TS (RESEARCH §Don't Hand-Roll).

**Dates étalées (luxon)** — `payments.ts` étale `verified_at` sur ~12 mois UTC (`DateTime.utc()`, miroir `affiliate-commission.ts` L.23/L.60). `created_at` jamais identiques (Pitfall 1 — casse keyset).

**Refresh matview final** — fin du seed : `refresh_mv_mrr()` via service_role (RESEARCH Pitfall 5). Vérifier LIVE que `mv_mrr_month_idx` existe (0017 Partie B L.363-365) avant le REFRESH CONCURRENTLY.

---

### `apps/jobs/scripts/seed/purge.ts` (seed module, delete ordre FK inverse — D-06)

**Analog:** structure wrapper service_role (`affiliate-commission.ts`) + RESEARCH §Ordre purge FK-inverse L.268-286.

**Purge ciblée `WHERE source='demo'`** en ordre enfant→parent (RESEARCH L.268-285) — JAMAIS `TRUNCATE` (détruirait `live`, anti-pattern V4) :
```typescript
// Source : RESEARCH §Ordre purge (D-06). Ordre INVERSE de l'insertion.
// commissions → affiliates → prediction_outcomes → trade_setups → analyses
// → payments → subscriptions → profiles, chacun delete WHERE source='demo'.
const { error } = await client.from('commissions').delete().eq('source', 'demo')
if (error) throw new Error(`purge commissions: ${error.message}`)
```

**Users démo : pas de colonne `source` sur `auth.users`** (RESEARCH L.283-286) — purger par email pattern (`seed-*@demo.nexa.invalid`) via `auth.admin.listUsers` + `auth.admin.deleteUser` (cascade `on delete cascade` vers `profiles`). Miroir `affiliate-rls.test.ts` L.47-50 `deleteUser`.

---

### `packages/supabase/src/repositories/__tests__/seed-rls.test.ts` (test, integration anon RLS — SEED-03)

**Analog:** `packages/supabase/src/repositories/__tests__/affiliate-rls.test.ts` (calque EXACT — même dossier, même structure).

**Garde env + skipIf** (affiliate-rls L.27-31, L.53) :
```typescript
// Source : affiliate-rls.test.ts L.27-31 + L.53
const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? ''
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? ''
const SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''
const HAS_ENV = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SERVICE_ROLE_KEY)
describe.skipIf(!HAS_ENV)('SEED-03 : isolation RLS à l\'échelle (anon)', () => { … })
```

**Deux clients distincts** (affiliate-rls L.33-45) : `adminClient()` (service_role, persistSession:false) pour le SEED uniquement ; `signUpAndGetClient()` (anon) pour la LECTURE assertée. **CRITIQUE (Pitfall 3 RESEARCH)** : la lecture assertée passe TOUJOURS par le client anon, JAMAIS service_role (sinon faux vert).

**Assertions SEED-03** (D-07) — copier la forme `select` + filtre cross-user d'affiliate-rls L.112-134 :
- non-abonné lit **0** `trade_setups` (barrière `has_active_subscription()` = false) → `expect(data).toHaveLength(0)`.
- user A ne lit aucun `payments`/signal de user B → `filter(r => r.user_id === userIdB)` puis `toHaveLength(0)`.

**Cleanup** `afterAll` (affiliate-rls L.104-110) : delete service_role + `deleteUser`.

---

### `apps/web/test/no-perf-seed-claims.test.ts` (test, scan statique sans DB — SEED-02)

**Analog:** `apps/web/test/no-perf-claims.test.ts` (MÊME pattern : collecte récursive + regex FORBIDDEN + liste d'offenders).

**Différence de cible** : l'existant scanne les JSON i18n marketing ; le nouveau scanne le **code seed** `apps/jobs/scripts/seed/**` (RESEARCH §Scan no-perf-seed-claims, Volet A). Réutiliser le squelette `detectForbidden` + boucle d'offenders (no-perf-claims L.55-114) :
```typescript
// Source : no-perf-claims.test.ts L.55-59 (regex + détecteur)
// Échoue si le code seed contient une affectation à un champ de % de perf destiné à un INSERT.
const FORBIDDEN_SEED_FIELDS = /win_?rate|success_?rate|winRatePct|expectancy|hardcoded.*%/i
// Liste blanche : realized_r, outcome, amount_atomic, rate_bps (commission, PAS perf de trade).
```

**Test de contrôle non-trivial** (no-perf-claims L.74-78) : asserter que le détecteur attrape bien une valeur de contrôle (`win_rate: 0.9`) → garantit que le test n'est pas vacuously green.

**Placement** : `apps/web/test/**` couvert par le glob Vitest racine (no-perf-claims L.26, `vitest.config.ts`). Le scan lit des fichiers via `node:fs`/glob — aucune DB, donc toujours exécutable en CI.

---

### `packages/supabase/src/database.types.ts` (modifié — régénération manuelle)

**Convention repo (PAS d'analog code, c'est un process)** — après `apply_migration` 0018 + MCP `generate_typescript_types`, ré-éditer `database.types.ts` à la **main** (0017 L.5-10, 0016 L.7-11 ; le projet n'est PAS link → `gen types --linked` échoue par design). Ajouter `source` aux `Row`/`Insert`/`Update` des 8 tables colonnées + réappliquer les alias maison + override string `*_atomic` (Pitfall 6 RESEARCH).

---

## Shared Patterns

### Frontière service_role (écriture seed)
**Source:** `packages/supabase/src/service-client.ts` L.1-28 (`import 'server-only'` L.4 + `serviceClient`)
**Apply to:** tous les modules `seed/*` qui écrivent
- Le seed vit dans `apps/jobs` → service_role autorisé (CLAUDE.md « service_role réservé aux jobs »).
- `import 'server-only'` (L.4) = barrière build-time : ce client plante si jamais importé côté web.
- `persistSession: false, autoRefreshToken: false` (L.23-26) sur chaque createClient stateless.

### Frontière anon (preuve RLS — jamais service_role en lecture)
**Source:** `packages/supabase/src/anon-client.ts` (`createBrowserSupabaseClient`) + `affiliate-rls.test.ts` L.39-45
**Apply to:** `seed-rls.test.ts` uniquement
- La LECTURE assertée passe par anon/auth-client (`auth.uid()` = user testé). Pitfall 3 : `createClient(url, SERVICE_ROLE_KEY)` dans une assertion = faux vert interdit.

### Migration colonne + CHECK borné (text, pas enum)
**Source:** `0008_profiles_role.sql` L.20-22 ; convention repo (0001/0009/0012/0016 L.36 « text + check plutôt qu'enum natif »)
**Apply to:** `0018` sur les 8 tables
```sql
add column source text not null default 'live' check (source in ('live','demo','backtest'))
```

### Index CONCURRENTLY hors transaction (Partie B)
**Source:** `0017_scalable_foundation.sql` L.350-387 (Partie B commentée) + L.389-422 (script de gate INVALID/EXPLAIN)
**Apply to:** index partiel `source` de `0018`
- `CREATE INDEX CONCURRENTLY` interdit dans `apply_migration` (erreur 25001) → commenté, exécuté via `execute_sql` un statement à la fois, vérif `indisvalid` après chaque.

### Idempotence + déterminisme
**Source:** RESEARCH (faker.seed + purge WHERE source='demo') ; miroir idempotence `outcome-tracker.ts` (onConflict ignoreDuplicates) + `affiliate-commission.ts` (RPC upsert)
**Apply to:** `seed.ts` (purge avant reseed → N stable) ; `faker.seed(42)` global.

### RPC pour la logique métier (jamais recalculer en TS)
**Source:** `affiliate-commission.ts` L.62 (`computeCommissions(client, period)`) ; vues `pattern_stats`/`mv_mrr` (0014/0017)
**Apply to:** `affiliation.ts` (commissions via RPC), aucun agrégat % calculé en JS (VITR-03).

---

## No Analog Found

Aucun. Les 7 fichiers ont un analog direct dans le repo (couverture 100 %).

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | Tout couvert. `@faker-js/faker` est la seule dépendance nouvelle (devDep, `pnpm add -D -w`), mais son usage (`seed()`, multi-locale) est documenté dans RESEARCH §Code Examples. |

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `apps/jobs/{scripts,src/jobs}/`, `packages/supabase/src/{service-client,anon-client}.ts` + `repositories/__tests__/`, `apps/web/test/`
**Files scanned (read intégral):** 0008, 0014, 0016 (en-tête+1 table), 0017, no-perf-claims.test.ts, affiliate-rls.test.ts, service-client.ts, anon-client.ts, freeze-nile-fixture.ts, outcome-tracker.ts (partiel), affiliate-commission.ts, apps/jobs/package.json
**Pattern extraction date:** 2026-06-25
