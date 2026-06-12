# Phase 2 : Ingestion fiable des données - Carte des patterns

**Mappé :** 2026-06-12
**Fichiers analysés :** 24 (nouveaux/modifiés)
**Analogues trouvés :** 22 / 24 (2 sans analogue exact — calendrier éco + vue freshness)

> Tous les fichiers de P2 se branchent sur l'infra **déjà écrite et testée en P1** (runner, dispatcher, repositories typés, migrations RLS, vitest cloud). La P2 n'écrit QUE le *mapping source→ligne typée* + l'*orchestration gap-fill*. Aucun nouveau pattern d'infra : copier les analogues P1 à la lettre.

---

## File Classification

| Fichier (nouveau/modifié) | Rôle | Data Flow | Analogue le plus proche | Qualité |
|---------------------------|------|-----------|-------------------------|---------|
| `packages/data-sources/src/binance/client.ts` | data-source client | request-response (SDK) | *(nouveau — pas de client externe en P1)* | role-partiel |
| `packages/data-sources/src/binance/schema.ts` | schema/transform | transform | `packages/core/src/time/candle.ts` (normalisation) | role-match |
| `packages/data-sources/src/oanda/client.ts` | data-source client | request-response (fetch) | *(nouveau — fetch+Zod maison)* | role-partiel |
| `packages/data-sources/src/oanda/schema.ts` | schema/transform | transform | `packages/core/src/time/candle.ts` | role-match |
| `packages/data-sources/src/oanda/instruments.ts` | mapping/config | transform | `supabase/migrations/0001...sql` (seed mapping) | role-partiel |
| `packages/data-sources/src/finnhub/client.ts` | data-source client | request-response (SDK) | *(nouveau)* | role-partiel |
| `packages/data-sources/src/marketaux/client.ts` | data-source client | request-response (fetch) | `oanda/client.ts` (même pattern fetch+Zod) | role-match |
| `packages/data-sources/src/fred/client.ts` | data-source client | request-response (fetch) | `oanda/client.ts` | role-match |
| `packages/data-sources/src/faireconomy/client.ts` | data-source client | request-response (fetch, caché) | `oanda/client.ts` | role-match |
| `packages/data-sources/src/index.ts` | barrel | — | `packages/supabase/src/index.ts` | exact |
| `packages/data-sources/src/**/schema.test.ts` | test (unit) | transform | `packages/core/src/time/candle.test.ts` (golden) | exact |
| `apps/jobs/src/jobs/market-ingest.ts` | job (ingestion) | batch / gap-fill | `apps/jobs/src/jobs/heartbeat.ts` | role-match |
| `apps/jobs/src/jobs/news-ingest.ts` | job (ingestion) | batch | `heartbeat.ts` | role-match |
| `apps/jobs/src/jobs/macro-ingest.ts` | job (ingestion) | batch | `heartbeat.ts` | role-match |
| `apps/jobs/src/jobs/calendar-ingest.ts` | job (ingestion) | batch (caché) | `heartbeat.ts` | role-match |
| `apps/jobs/src/dispatch.ts` *(modifié)* | dispatcher/registre | — | `apps/jobs/src/dispatch.ts` (lui-même) | exact |
| `apps/jobs/__tests__/fault-isolation.test.ts` | test (intégration) | event-driven | `apps/jobs/__tests__/runJob.test.ts` | exact |
| `apps/jobs/__tests__/gap-fill.test.ts` | test (unit, mock) | transform | `packages/core/.../candle.test.ts` | role-match |
| `packages/supabase/src/repositories/candles.ts` | repository | CRUD (upsert) | `packages/supabase/src/repositories/jobRuns.ts` | exact |
| `packages/supabase/src/repositories/news.ts` | repository | CRUD (upsert) | `jobRuns.ts` | exact |
| `packages/supabase/src/repositories/macroSeries.ts` | repository | CRUD (upsert) | `jobRuns.ts` | exact |
| `packages/supabase/src/repositories/economicCalendar.ts` | repository | CRUD (upsert) | `jobRuns.ts` | exact |
| `packages/supabase/__tests__/idempotency.test.ts` | test (intégration) | CRUD | `packages/supabase/__tests__/rls.test.ts` | exact |
| `supabase/migrations/0003_data_ingestion_tables.sql` | migration | DDL + RLS + seed | `supabase/migrations/0001...sql` | exact |
| `.env.example` *(modifié)* | config | — | `.env.example` (lui-même) | exact |

---

## Pattern Assignments

### `apps/jobs/src/jobs/market-ingest.ts` (job, gap-fill batch)

**Analogue :** `apps/jobs/src/jobs/heartbeat.ts` — signature d'un job ; **isolation par source** = Pattern 2 RESEARCH ; **borne haute** = `packages/core`.

Le job est une simple fonction `() => Promise<Json>` enregistrée dans `dispatch.ts`. `runJob` gère TOUT le monitoring (job_runs, started_at horloge locale, error). Le job ne fait QUE sa logique métier et **retourne ses stats** — il ne touche jamais `job_runs`.

**Signature d'un job** (copier de `heartbeat.ts:10-17`) :
```typescript
import type { Json } from '@app/supabase'

export async function marketIngest(): Promise<Json> {
  // ... logique métier, retourne stats
  return { inserted, skipped, errors }
}
```

**Borne haute exclusive — anti look-ahead** (consommer `packages/core`, NE PAS recalculer) :
```typescript
import { lastClosedCandleStart, dailyAnchorStart, TIMEFRAMES } from '@app/core'
import { DateTime } from 'luxon'

// D : ancre par source (OANDA 17:00 NY / Binance 00:00 UTC)
const until = lastClosedCandleStart(DateTime.utc(), TIMEFRAMES[tf]) // H1/H4
// Daily → dailyAnchorStart(broker, DateTime.utc())
```

**Isolation des pannes par instrument (DATA-07)** — chaque cible dans son propre try/catch, l'erreur va dans `stats.errors`, jamais propagée (le job retourne `success` partiel) :
```typescript
const stats = { inserted: 0, skipped: 0, errors: [] as Array<{ instrument: string; msg: string }> }
for (const inst of activeInstruments) {
  try { stats.inserted += await ingestOne(inst, tf) }
  catch (e) { stats.errors.push({ instrument: inst.symbol, msg: e instanceof Error ? e.message : String(e) }) }
}
return stats // les autres instruments ont continué
```

**Gap-fill (D-22)** — lire la dernière bougie en base via repository, tirer ce qui manque :
```typescript
const last = await getLastCandleTs(client, inst.id, tf) // null au 1er run → backfill
const since = last ?? backfillStart(tf)                 // 2 ans D / 6 mois H4/H1
// pagine since→until (OANDA count≤5000 count XOR from/to ; Binance limit≤1000 startTime/endTime)
```

> ⚠️ Le job a besoin du **client service_role** pour lire/upsert. Soit `runJob` le passe (à étendre), soit le job crée son propre client comme `runJob.ts:30-41` (lazy, depuis env). **Décision planner.** Anti-pattern : pas de MCP, SDK supabase-js direct (cf. `runJob.ts:11`).

---

### `apps/jobs/src/jobs/{news,macro,calendar}-ingest.ts` (jobs, batch)

**Analogue :** identique à `market-ingest.ts` — même squelette (fn `() => Promise<Json>`, isolation par source, retour stats). Différences métier :
- **news-ingest** : Finnhub primaire → Marketaux fallback (D-29) ; dédup `url_hash` ; mapping **par catégorie** Finnhub (`marketNews('crypto'|'forex'|'general')`), JAMAIS heuristique mots-clés (D-28).
- **macro-ingest** : 1×/jour ; séries FRED `DFF/CPIAUCSL/DTWEXBGS/DFII10` ; upsert `(series_code, ts)`.
- **calendar-ingest** : FairEconomy JSON **caché** (re-fetch 1×/jour max, rate limit 2/5min) ; upsert `event_key`.

---

### `apps/jobs/src/dispatch.ts` (modifié — registre)

**Analogue :** lui-même (`dispatch.ts:26-28`). Ajout des 4 jobs au registre, rien d'autre :
```typescript
import { marketIngest } from './jobs/market-ingest'
import { newsIngest } from './jobs/news-ingest'
import { macroIngest } from './jobs/macro-ingest'
import { calendarIngest } from './jobs/calendar-ingest'

const JOB_REGISTRY: Record<string, () => Promise<Json | undefined>> = {
  heartbeat,
  'market-ingest': marketIngest,
  'news-ingest': newsIngest,
  'macro-ingest': macroIngest,
  'calendar-ingest': calendarIngest,
}
```
> Le `run-job.cmd` existant fonctionne tel quel pour les nouveaux jobs (`run-job.cmd market-ingest`) — aucune modification du .cmd. Task Scheduler = nouveaux déclencheurs seulement (manuel/doc, cf. RESEARCH Runtime State).

---

### `packages/supabase/src/repositories/candles.ts` (repository, upsert idempotent)

**Analogue :** `packages/supabase/src/repositories/jobRuns.ts` — repository typé sur client passé en argument, type `ServiceClient = SupabaseClient<Database>`, erreurs explicites.

**Structure type** (copier `jobRuns.ts:10-13` pour le typage) :
```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, CandleRow, CandleInsert } from '../database.types'

type ServiceClient = SupabaseClient<Database>
```

**Upsert idempotent (DATA-06)** — `onConflict` = index unique de la migration, `ignoreDuplicates: false` (ré-écrit les corrections de bougie sans doublon) :
```typescript
export async function upsertCandles(client: ServiceClient, rows: CandleInsert[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await client.from('candles').upsert(rows, {
    onConflict: 'instrument_id,timeframe,ts',
    ignoreDuplicates: false,
  })
  if (error) throw new Error(`upsertCandles failed: ${error.message}`)
}
```

**Lecture du dernier ts (gap-fill)** — copier le pattern `select/order/limit/single` de `runJob.test.ts:52-64` (helper `getLastRun`) :
```typescript
export async function getLastCandleTs(
  client: ServiceClient, instrumentId: string, timeframe: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('candles').select('ts')
    .eq('instrument_id', instrumentId).eq('timeframe', timeframe)
    .order('ts', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(`getLastCandleTs failed: ${error.message}`)
  return data?.ts ?? null
}
```

> Clés d'upsert par table : candles `(instrument_id,timeframe,ts)`, news `url_hash`, macro `(series_code,ts)`, calendar `event_key`. Idem pattern pour `news.ts` / `macroSeries.ts` / `economicCalendar.ts` (changer table + onConflict). **Exporter chaque fonction depuis `packages/supabase/src/index.ts`** (cf. barrel `index.ts:32-34`).

---

### `packages/data-sources/src/oanda/client.ts` (client fetch+Zod maison)

**Analogue :** *pas de client externe en P1.* Pattern composé : **validation de frontière** (règle CLAUDE.md / coding-style.md « ne jamais faire confiance à la donnée externe ») + **secret depuis env** (`runJob.ts:31-37`) + **erreur explicite** (style repositories).

**Secret + base URL démo depuis env** (jamais en dur, cf. `runJob.ts:31-37`) :
```typescript
const token = process.env['OANDA_API_TOKEN']
if (!token) throw new Error('OANDA_API_TOKEN must be set in apps/jobs/.env')
const OANDA_BASE = 'https://api-fxpractice.oanda.com' // compte démo
```

**Frontière Zod — count XOR from/to** (Pitfall 3) :
```typescript
import { z } from 'zod'
const OandaCandlesSchema = z.object({ candles: z.array(z.object({
  time: z.string(), mid: z.object({ o: z.string(), h: z.string(), l: z.string(), c: z.string() }),
  volume: z.number(), complete: z.boolean(),
})) })

const url = `${OANDA_BASE}/v3/instruments/${oandaSymbol}/candles`
  + `?granularity=${gran}&from=${fromIso}&to=${toIso}&price=M` // count XOR from/to
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
if (!res.ok) throw new Error(`OANDA ${oandaSymbol} ${gran}: HTTP ${res.status}`)
const parsed = OandaCandlesSchema.parse(await res.json()) // frontière
```

**Wrap chaque appel** dans `p-limit` + `p-retry` (ESM only, valeurs CLAUDE.md §rate limits : OANDA `pLimit(2)`, Finnhub `pLimit(1)`+Retry-After, Binance `pLimit(3)`, FRED `pLimit(2)`).

> `marketaux/client.ts`, `fred/client.ts`, `faireconomy/client.ts` = **même squelette exact** (fetch + Zod frontière + erreur explicite + p-limit/p-retry). Seuls l'URL, le schéma Zod et la clé env changent. `faireconomy` n'a aucune clé mais ajoute le **cache** (table ou fichier, re-fetch 1×/jour max).

---

### `packages/data-sources/src/binance/client.ts` + `finnhub/client.ts` (wrappers SDK)

**Binance** — SDK `binance` (tiagosiebler), **mainnet public sans clé** pour klines (testnet n'a PAS d'historique — Pitfall 1) :
```typescript
import { MainClient } from 'binance'
const client = new MainClient({}) // pas de clé : getKlines est non signé
const klines = await client.getKlines({ symbol, interval: '1h', startTime, endTime, limit: 1000 })
// Kline[] = tuples [openTime, open, high, low, close, volume, closeTime, ...]
```

**Finnhub** — SDK officiel, `marketNews(category)` (PAS `companyNews`/`news-sentiment` = premium/US-only, Pitfall 2). Clé depuis env (pattern `runJob.ts:31-37`).

> Les deux wrappent la réponse SDK dans un **schema Zod de normalisation** (`schema.ts` voisin) → ligne typée, comme les clients fetch. Frontière obligatoire même via SDK.

---

### `packages/data-sources/src/*/schema.ts` (transform → ligne normalisée)

**Analogue :** `packages/core/src/time/candle.ts` — transformation pure et déterministe, normalisation UTC. Le schéma parse la réponse source puis **mappe vers la ligne typée DB** en UTC. Réutiliser `lastClosedCandleStart`/`DAILY_ANCHOR` de `@app/core` pour exclure la bougie en cours — ne JAMAIS refloorer maison (Don't Hand-Roll).

---

### Tests

**`packages/data-sources/src/**/schema.test.ts`** — analogue `packages/core/src/time/candle.test.ts` (golden values). Fixtures JSON réelles dans `__fixtures__/`, parse Zod + normalisation, déterministe hors-ligne. Style : `describe`/`it`, `expect(...).toBe(...)`, fixture fixe en tête.

**`packages/supabase/__tests__/idempotency.test.ts` (DATA-06)** — analogue `packages/supabase/__tests__/rls.test.ts`. Intégration contre Supabase cloud :
- env via `process.env['SUPABASE_URL'] / SERVICE_ROLE_KEY` (cf. `rls.test.ts:28-30`)
- client service_role `createClient<Database>(..., { auth: { persistSession: false, autoRefreshToken: false } })` (`rls.test.ts:49-51`)
- **cleanup SQL en `afterAll`/`afterEach`** via service_role `delete().in('id', ids)` (cf. `runJob.test.ts:42-48`)
- assertion : upsert ×2 ⇒ `count` identique (0 doublon).

**`apps/jobs/__tests__/fault-isolation.test.ts` (DATA-07)** — analogue `apps/jobs/__tests__/runJob.test.ts`. Charge `apps/jobs/.env` via `dotenvConfig({ path: ... })` (`runJob.test.ts:15-21`). Simule une clé invalide sur UNE source ⇒ `stats.errors` peuplé, les autres ingèrent, `status` reste `success`.

**`apps/jobs/__tests__/gap-fill.test.ts` (D-22)** — unit avec repository mocké : dernier ts en base → fenêtre `since/until` correcte. Style golden (`candle.test.ts`).

---

### `supabase/migrations/0003_data_ingestion_tables.sql` (DDL + RLS + seed)

**Analogue :** `supabase/migrations/0001_init_profiles_instruments_job_runs.sql` — **copier la structure exacte** : `create table` → `enable row level security` → policy `select to authenticated using (true)` → AUCUNE policy write (réservé service_role bypass) → seed en données.

**RLS sur CHAQUE nouvelle table** (Pitfall RESEARCH / 0001 lignes 44-54) :
```sql
create table public.candles ( ... );
alter table public.candles enable row level security;
create policy "candles: lecture authentifiés"
  on public.candles for select to authenticated using (true);
-- AUCUNE policy insert/update → écriture service_role uniquement
```

**Index unique = clé d'upsert** (doit matcher `onConflict` des repositories) :
```sql
create unique index candles_uniq on public.candles (instrument_id, timeframe, ts);
-- news: unique (url_hash) ; macro_series: unique (series_code, ts) ; economic_calendar: unique (event_key)
```

**Extension de `instruments` + re-seed 12 instruments** (Runtime State : 3 lignes seed existantes XAU_USD/EUR_USD/BTCUSDT — éviter doublon) :
- ajouter colonnes : symbole canonique (`BTC/USD`...), `source_symbol` (`BTCUSDT`/`EUR_USD`/`WTICO_USD`), catégorie étendue, décimales, horaires de cotation (D-18/D-19).
- `is_active` flag (D-17) — la table existante a `active` : aligner le nom ou ajouter.
- seed par `insert ... on conflict (symbol) do update` pour ne pas dupliquer les 3 lignes P1.
- **Trigger `security definer` → `set search_path = ''` obligatoire** si nouveau trigger (cf. 0001:90).

> Après migration : régénérer `database.types.ts` (MCP `generate_typescript_types` ou `supabase gen types`) et committer — sinon repositories non typés (Pitfall 6). Vérifier `get_advisors` = 0 alerte RLS.

---

### `.env.example` (modifié — contrat de secrets)

**Analogue :** lui-même. Ajouter les nouvelles clés **vides** sous `# --- Côté JOBS (apps/jobs/.env) ---` (jamais préfixées `NEXT_PUBLIC_`, D-12) :
```
OANDA_API_TOKEN=
OANDA_ACCOUNT_ID=
BINANCE_API_KEY=        # optionnel — klines = mainnet public sans clé
BINANCE_API_SECRET=
FINNHUB_API_KEY=
MARKETAUX_API_KEY=
FRED_API_KEY=
# FairEconomy = aucune clé
```

---

## Shared Patterns

### Secret depuis env (jamais en dur)
**Source :** `apps/jobs/src/runJob.ts:31-37` + `packages/supabase/src/service-client.ts:19-28`
**Appliquer à :** tous les clients data-sources, tous les jobs.
```typescript
const key = process.env['XXX_API_KEY']
if (!key) throw new Error('XXX_API_KEY must be set in apps/jobs/.env')
```

### Client service_role lazy (jobs)
**Source :** `apps/jobs/src/runJob.ts:30-41`
**Appliquer à :** tout job/repository qui écrit en base.
```typescript
return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
```
> NE JAMAIS importer `service-client.ts` depuis apps/web (garde server-only + ESLint, `service-client.ts:4`). Les jobs créent leur client à l'exécution depuis env.

### Frontière Zod (V5 Input Validation — central P2)
**Source :** convention CLAUDE.md + `coding-style.md` ; modèle de pureté `packages/core/src/time/candle.ts`
**Appliquer à :** CHAQUE réponse de source externe (fetch ET SDK) avant tout upsert.
```typescript
const parsed = SourceSchema.parse(await res.json()) // ne jamais faire confiance à la donnée externe
```

### Repository typé sur client injecté
**Source :** `packages/supabase/src/repositories/jobRuns.ts:10-13`
**Appliquer à :** candles, news, macroSeries, economicCalendar.
```typescript
type ServiceClient = SupabaseClient<Database>
export async function upsertX(client: ServiceClient, rows: XInsert[]): Promise<void> { ... }
```

### Erreur explicite, jamais silencieuse
**Source :** `jobRuns.ts:33-35`, `instruments.ts:24-27`
**Appliquer à :** tous les repositories et clients.
```typescript
if (error) throw new Error(`opName failed: ${error.message}`)
```

### Horloge locale pour les timestamps de run
**Source :** `jobRuns.ts:19-31` (`started_at`/`finished_at` = `new Date().toISOString()`)
**Appliquer à :** déjà géré par `runJob` — les jobs n'y touchent pas. Ne JAMAIS mixer avec `now()` Postgres (dérive d'horloge).

### Migration : table → RLS → policy select authenticated → seed données
**Source :** `supabase/migrations/0001_init_profiles_instruments_job_runs.sql:32-54`
**Appliquer à :** toutes les nouvelles tables P2.

### Test intégration cloud : env + service_role + cleanup
**Source :** `packages/supabase/__tests__/rls.test.ts:28-53` + `apps/jobs/__tests__/runJob.test.ts:15-48`
**Appliquer à :** idempotency.test.ts, fault-isolation.test.ts.

### p-limit + p-retry par source (ESM only)
**Source :** CLAUDE.md §rate limits (pas d'analogue code en P1 — premier usage).
**Appliquer à :** chaque appel de client data-source. Valeurs : OANDA `pLimit(2)`, Finnhub `pLimit(1)`+Retry-After, Binance `pLimit(3)`, FRED `pLimit(2)`.

---

## No Analog Found

| Fichier | Rôle | Data Flow | Raison |
|---------|------|-----------|--------|
| `packages/data-sources/src/faireconomy/client.ts` (partie **cache**) | client | request-response caché | Aucune logique de cache (table/fichier hebdo) n'existe en P1 — concevoir d'après RESEARCH Pitfall 5. Le squelette fetch+Zod reste calqué sur `oanda/client.ts`. |
| Vue/colonne **`v_data_freshness`** (staleness, dans la migration 0003) | DDL (vue calculée) | transform | Aucune vue SQL ni calcul de staleness en P1. Concevoir d'après D-26/D-27 + Pitfall 4 (consulter horaires de cotation via luxon/`DAILY_ANCHOR`, marché fermé ≠ stale). Crypto 24/7 toujours évaluable. |

> Pour ces 2 surfaces, le planner s'appuie sur RESEARCH.md (Patterns, Pitfalls 4 & 5) plutôt que sur un analogue code.

---

## Metadata

**Périmètre de recherche d'analogues :** `apps/jobs/src`, `packages/supabase/src`, `packages/core/src`, `supabase/migrations`, racine (vitest.config, .env.example).
**Fichiers scannés (hors node_modules) :** runJob.ts, dispatch.ts, heartbeat.ts, jobRuns.ts, instruments.ts, profiles.ts, service-client.ts, index.ts (×2), candle.ts, sessions.ts, constants.ts, candle.test.ts, rls.test.ts, runJob.test.ts, 0001_init...sql, vitest.config.ts, run-job.cmd, .env.example.
**`packages/data-sources` :** n'existe pas encore (créé en P2 selon D-11) — clients = surface neuve calquée sur les conventions P1.
**Date d'extraction :** 2026-06-12
