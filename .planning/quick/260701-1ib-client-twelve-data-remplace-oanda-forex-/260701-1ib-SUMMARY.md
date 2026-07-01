---
phase: quick/260701-1ib
plan: 01
subsystem: data-ingestion
tags: [twelvedata, oanda, forex, ohlcv, market-ingest, rate-limit]
requires:
  - "@app/supabase CandleInsert"
  - "@app/data-sources barrel"
  - "apps/jobs market-ingest job"
provides:
  - "fetchTwelveDataTimeSeries (fetch + throttle 8/min + p-retry)"
  - "parseTwelveDataTimeSeries (Zod → CandleInsert[] ascendants)"
  - "toTwelveDataSymbol / toTwelveDataInterval / TWELVEDATA_SYMBOLS"
  - "ingestTwelveData routé pour dataSource 'oanda'"
  - "migration 0022 (désactive XAG_USD + WTICO_USD)"
affects:
  - "apps/jobs/src/jobs/market-ingest.ts (route forex/or)"
tech-stack:
  added: []
  patterns: ["fetch maison + Zod (pas de SDK npm)", "throttle module-level strict", "p-retry AbortError pour erreurs non-retryable"]
key-files:
  created:
    - packages/data-sources/src/twelvedata/client.ts
    - packages/data-sources/src/twelvedata/schema.ts
    - packages/data-sources/src/twelvedata/instruments.ts
    - packages/data-sources/src/twelvedata/schema.test.ts
    - packages/data-sources/src/__fixtures__/twelvedata-timeseries.json
    - supabase/migrations/0022_disable_uncovered_instruments.sql
  modified:
    - packages/data-sources/src/index.ts
    - apps/jobs/src/jobs/market-ingest.ts
decisions:
  - "broker='oanda' conservé en DB (pas de churn) ; routage code vers Twelve Data — réversible = revert"
  - "un seul appel TD par (instrument × tf), outputsize=5000 couvre le backfill max → 1 crédit, tient 8/min"
  - "4xx (404) non-retryable via AbortError ; 429 retryable (Retry-After) ; 5xx retryable"
metrics:
  duration: ~12min
  tasks: 3
  files: 8
  completed: 2026-07-01
---

# Quick 260701-1ib: Client Twelve Data (remplace OANDA forex/or) Summary

Remplace OANDA (token mort, 401) par un client Twelve Data fetch+Zod maison pour les bougies OHLCV forex + or. Le pipeline forex/or ingère à nouveau des bougies fraîches (5 instruments FREE) sans régresser la crypto Binance ; les 2 instruments non couverts (argent/pétrole) sont isolés en 404 puis désactivés par migration.

## Tâches exécutées

1. **Task 1 (TDD)** — Client `twelvedata/` : `client.ts` (throttle strict 8/min, p-retry), `schema.ts` (Zod → `CandleInsert[]` ascendants, throw body `status=error`), `instruments.ts` (mapping symbole/intervalle), fixture + 12 tests golden. Barrel exporté. RED (`0354882`) → GREEN (`1ed6faa`).
2. **Task 2** — Routage `market-ingest` : `ingestTwelveData` remplace `ingestOanda` (orphelins `ingestOanda`/`OANDA_GRANULARITY_MAP`/`OANDA_MAX_CANDLES` supprimés), filtre anti look-ahead `ts < until`, migration 0022 créée. Commit `5b29ae1`.
3. **Task 3 (partiel — cf. limitation MCP)** — Smoke test `dispatch market-ingest` réel exécuté et vérifié. Amélioration 4xx non-retryable commit `931ebd4`. **Migration NON appliquée** (à faire par l'orchestrateur).

## Commits

- `0354882` test — golden tests RED
- `1ed6faa` feat — client Twelve Data fetch+Zod GREEN
- `5b29ae1` feat — route dataSource oanda → Twelve Data + migration 0022
- `931ebd4` fix — 4xx non-retryable (AbortError)

## ⚠️ Migration à appliquer par l'orchestrateur (MCP indisponible ici)

**Fichier** : `supabase/migrations/0022_disable_uncovered_instruments.sql`
**Appliquer via** MCP `apply_migration` (name `0022_disable_uncovered_instruments`), JAMAIS `supabase db push` (projet non linké — convention repo 0016/0017/0018).

**Corps SQL** :
```sql
update public.instruments
set active = false
where source_symbol in ('XAG_USD', 'WTICO_USD');
```

**Vérification post-apply** (execute_sql) :
```sql
SELECT source_symbol, active FROM public.instruments
WHERE source_symbol IN ('XAG_USD','WTICO_USD');
-- attendu : les deux active=false
```
Réversible : `SET active = true` (ex. passage plan Grow/Venture).

## Résultat du smoke test `dispatch market-ingest`

Run réel exécuté (statut `job finished success`, ~5,5 min avec throttle 8s). Stats depuis `job_runs.stats` + counts table `candles` :

| source_symbol | active | broker  | count bougies | max(ts) | statut |
|---------------|--------|---------|--------------|---------|--------|
| EUR_USD  | true | oanda   | 5924 | 2026-06-30T23:00:00Z (H1) | ✅ TD |
| GBP_USD  | true | oanda   | 5933 | 2026-06-30T23:00:00Z (H1) | ✅ TD |
| USD_JPY  | true | oanda   | 5938 | 2026-06-30T23:00:00Z (H1) | ✅ TD |
| AUD_USD  | true | oanda   | 5959 | 2026-06-30T23:00:00Z (H1) | ✅ TD |
| XAU_USD  | true | oanda   | 6049 | 2026-06-30T23:00:00Z (H1) | ✅ TD |
| BTCUSDT  | true | binance | 6743 | 2026-06-30T23:00:00Z (H1) | ✅ non régressé |
| XAG_USD  | true | oanda   | 0    | NONE | ⛔ 404 (sera inactif via 0022) |
| WTICO_USD| true | oanda   | 0    | NONE | ⛔ 404 (sera inactif via 0022) |

- **`stats.inserted = 29833`**, `stats.skipped = 0`.
- **`stats.errors`** : uniquement XAG/USD + WTI/USD en `HTTP 404 Not Found` (H1/H4/D chacun) — isolés par instrument (fault-isolation), le job réussit.
- Les 5 instruments forex/or et BTCUSDT ont un `max(ts)` frais = dernière H1 clôturée (run à 2026-07-01T00:xxZ). Crypto Binance intacte.
- Note : au moment du smoke test XAG/WTI sont encore `active=true` (migration non appliquée) → ils apparaissent en erreur. Après application de 0022 ils ne seront plus interrogés.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - rate-limit correctness] 4xx Twelve Data rendus non-retryable**
- **Found during:** Task 3 (smoke test)
- **Issue:** Twelve Data renvoie un vrai `HTTP 404` pour XAG/WTI (pas seulement body `status=error`). Le chemin `!res.ok` du client faisait ré-essayer p-retry 4× → gaspillage du quota 8/min (T-1ib-03) et ralentissement du run.
- **Fix:** `!res.ok` avec `4xx` (hors 429) → `throw new AbortError(err)` (non-retryable) ; 429 respecte Retry-After ; 5xx reste retryable.
- **Files modified:** packages/data-sources/src/twelvedata/client.ts
- **Commit:** `931ebd4`

## Deferred Issues (hors scope — pré-existant)

`pnpm -C apps/jobs exec tsc --noEmit` remonte des erreurs TS PRÉ-EXISTANTES, sans rapport avec cette tâche, dans des fichiers non touchés :
- `src/jobs/__tests__/telegram-publish.test.ts` (TS2352/TS2493)
- `src/telegram/bot.ts` (TS2353 `disable_web_page_preview`)

`market-ingest.ts` (fichier modifié) ne produit AUCUNE erreur. `packages/data-sources` typecheck exit 0. Non corrigés (scope boundary).

## Known Stubs

Aucun.

## Threat Flags

Aucun nouveau. Mitigations du threat model honorées : T-1ib-01 (frontière Zod + ordre forcé), T-1ib-02 (apikey env-only, jamais loggée), T-1ib-03 (throttle strict + 4xx non-retryable), T-1ib-04 (filtre `ts < until`).

## Self-Check

- Fichiers créés : vérifiés présents (voir commits).
- Commits `0354882` / `1ed6faa` / `5b29ae1` / `931ebd4` présents dans `git log`.
- Tests : 12/12 verts. Typecheck data-sources : exit 0. Smoke test : inserted=29833, 0 erreur fatale.

## Self-Check: PASSED
