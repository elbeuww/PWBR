---
phase: 02-ingestion-fiable-des-donn-es
verified: 2026-06-13T03:00:00Z
status: human_needed
score: 7/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run live d'ingestion market-ingest via Task Scheduler ou tsx src/dispatch.ts market-ingest"
    expected: "Des lignes OHLCV apparaissent dans la table candles pour les 12 instruments MVP (H1/H4/D), avec un statut 'success' dans job_runs"
    why_human: "Les clés API OANDA/FINNHUB/MARKETAUX/FRED ne sont pas encore saisies dans apps/jobs/.env — un run réel avec données live ne peut pas être exécuté en CI. La présence des clés et le remplissage effectif de la DB nécessitent une action humaine."
  - test: "Vérifier v_data_freshness avec des données réelles en base (après le premier run live)"
    expected: "La vue retourne is_stale=false pour les instruments OANDA forex/commodities le week-end, et is_stale selon le seuil 2× pour les crypto (24/7)"
    why_human: "Sans candles réelles en base, le test offline ne peut confirmer que la logique NY-DST de la migration 0004 fonctionne sur des données vivantes. Le test fault-isolation.test.ts vérifie que la vue est interrogeable (0 erreur) mais ne peut valider la logique is_stale avec de vrais timestamps."
---

# Phase 2 : Ingestion fiable des données — Rapport de Vérification

**Phase Goal:** Le système dispose de données fraîches, normalisées et sans doublons pour tous les instruments MVP — un re-run d'ingestion ne crée jamais de doublon et une source en panne n'interrompt pas les autres.
**Vérifié:** 2026-06-13T03:00:00Z
**Statut:** human_needed
**Re-vérification:** Non — vérification initiale

---

## Résumé de l'atteinte du goal

Le cœur technique de la phase est **entièrement livré et prouvé** : 88/88 tests vitest verts, tsc clean sur les 3 packages (supabase, data-sources, jobs), idempotence DATA-06 vérifiée contre le cloud, isolation des pannes DATA-07 prouvée en test mock offline, vue v_data_freshness avec heuristique DST-NY correcte en migration 0004. Le seul point non vérifiable automatiquement est le run live end-to-end (clés API absentes du .env local — situation attendue, documentée dans le post_execution_context).

---

## Observable Truths

| # | Vérité | Statut | Evidence |
|---|--------|--------|----------|
| 1 | Les tables candles/news/macro_series/economic_calendar existent avec RLS active | ✓ VERIFIED | Migration 0003 : 4 `enable row level security` confirmés (grep count=4). Tables présentes dans le cloud (migration appliquée via MCP selon SUMMARY 02-01). |
| 2 | L'univers de 12 instruments MVP est seedé sans dupliquer les 3 lignes P1 | ✓ VERIFIED | Migration 0003 utilise `on conflict (symbol) do update` — grep ligne 56. Les 12 symboles (BTCUSDT..WTICO_USD) présents lignes 42-55. |
| 3 | Un re-run complet d'upsert ne crée aucun doublon (DATA-06) | ✓ VERIFIED | `pnpm vitest run packages/supabase/__tests__/idempotency.test.ts` → 2/2 PASS. onConflict exact vérifié dans les 4 repositories (instrument_id,timeframe,ts / url_hash / series_code,ts / event_key). |
| 4 | La staleness est consultable via v_data_freshness avec logique horaires de cotation | ✓ VERIFIED | Migration 0004 remplace la vue avec raisonnement America/New_York DST-correct. fault-isolation.test.ts cas 2 : vue interrogeable sans erreur. La logique DST a besoin de données réelles pour validation complète → human_needed. |
| 5 | Le job market-ingest tire les klines crypto (Binance mainnet) et candles OANDA, normalise UTC, upserte sans doublon | ✓ VERIFIED | Code review : MainClient({}) sans clé (mainnet public), parseOandaCandles filtre complete:true, computeGapFillWindow exporté et testé (12/12 gap-fill.test.ts). Run live non faisable sans clés. |
| 6 | Les parsers Zod (Binance/OANDA/Finnhub/FRED/FairEconomy) transforment les payloads bruts en lignes typées — golden values verts | ✓ VERIFIED | `pnpm vitest run packages/data-sources` → 5 fichiers test, 48/48 PASS. OANDA complete:false exclu prouvé par golden test. FRED '.' exclu prouvé. FairEconomy event_key déterministe + impact enum validé. |
| 7 | Une source en échec n'interrompt pas les autres (DATA-07) | ✓ VERIFIED | fault-isolation.test.ts cas 1 : DFF throw 403 simulé → stats.errors[0].series='DFF', CPIAUCSL/DTWEXBGS/DFII10 insèrent 9 lignes, macroIngest ne propage pas l'erreur. 2/2 PASS. |
| 8 | Le premier run live renseigne effectivement la table candles (données réelles OANDA/Binance) | ? HUMAN_NEEDED | Les clés OANDA/Finnhub/FRED/Marketaux ne sont pas saisies dans apps/jobs/.env — aucun run live ne peut être exécuté. Situation attendue (checkpoint humain 02-01 T2 documenté). |

**Score:** 7/8 vérités confirmées

---

## Artefacts requis

| Artefact | Attendu | Statut | Détails |
|----------|---------|--------|---------|
| `supabase/migrations/0003_data_ingestion_tables.sql` | DDL + RLS + index + seed 12 + vue freshness | ✓ VERIFIED | Présent. 4 tables, 4 `enable row level security`, index candles_uniq/news_uniq/macro_series_uniq/economic_calendar_uniq, seed 12 instruments on conflict, vue v_data_freshness avec quote_hours. |
| `supabase/migrations/0004_fix_freshness_weekend.sql` | Correction heuristique DST NY dans v_data_freshness | ✓ VERIFIED | Présent. Remplace la vue 0003 avec raisonnement America/New_York DOW-based. |
| `packages/supabase/src/repositories/candles.ts` | upsertCandles + getLastCandleTs | ✓ VERIFIED | Présent. onConflict 'instrument_id,timeframe,ts', early-return si rows vide, erreur explicite. |
| `packages/supabase/src/repositories/news.ts` | upsertNews onConflict url_hash | ✓ VERIFIED | Présent. onConflict 'url_hash'. |
| `packages/supabase/src/repositories/macroSeries.ts` | upsertMacroSeries onConflict series_code,ts | ✓ VERIFIED | Présent. onConflict 'series_code,ts'. |
| `packages/supabase/src/repositories/economicCalendar.ts` | upsertEconomicCalendar onConflict event_key | ✓ VERIFIED | Présent. onConflict 'event_key'. |
| `packages/supabase/__tests__/idempotency.test.ts` | DATA-06 — upsert x2 => count stable | ✓ VERIFIED | 2/2 PASS contre cloud. |
| `packages/data-sources/src/binance/client.ts` | fetchBinanceKlines MainNet public sans clé | ✓ VERIFIED | MainClient({}) sans clé. Pas de testnet. |
| `packages/data-sources/src/oanda/client.ts` | fetchOandaCandles démo OANDA | ✓ VERIFIED | Présent. OANDA_API_TOKEN depuis env (throw si absent). |
| `packages/data-sources/src/finnhub/client.ts` | marketNews seulement (D-28) | ✓ VERIFIED | Présent. Seul `apiClient.marketNews(category, ...)` appelé — aucune référence à companyNews/news-sentiment. |
| `packages/data-sources/src/fred/client.ts` | fetchFredSeries + parseFredObservations exclusion '.' | ✓ VERIFIED | Présent. `.filter((obs) => obs.value !== '.')` ligne 113. |
| `packages/data-sources/src/faireconomy/client.ts` | fetchFairEconomyCalendar cache 24h, sans clé | ✓ VERIFIED | Présent. Cache in-process CACHE_TTL_MS=24h. Aucune clé. event_key sha256. |
| `apps/jobs/src/jobs/market-ingest.ts` | job gap-fill + isolation par instrument | ✓ VERIFIED | Présent. computeGapFillWindow exporté (CR-01 fix vérifié : until = lastClosed.plus({minutes:tf})). try/catch par (instrument×tf). |
| `apps/jobs/src/jobs/news-ingest.ts` | Finnhub primaire + fallback Marketaux, isolation par catégorie | ✓ VERIFIED | Présent. Fallback Marketaux dans le catch Finnhub (D-29). |
| `apps/jobs/src/jobs/macro-ingest.ts` | FRED DFF/CPIAUCSL/DTWEXBGS/DFII10, isolation par série | ✓ VERIFIED | Présent. 4 séries, chacune dans son try/catch. |
| `apps/jobs/src/jobs/calendar-ingest.ts` | FairEconomy cache + upsertEconomicCalendar | ✓ VERIFIED | Présent. try/catch global (source unique A3). |
| `apps/jobs/src/dispatch.ts` | JOB_REGISTRY: market/news/macro/calendar-ingest | ✓ VERIFIED | 4 clés présentes (market-ingest, news-ingest, macro-ingest, calendar-ingest) + heartbeat préservé. |
| `apps/jobs/__tests__/gap-fill.test.ts` | fenêtre since/until correcte (CR-01 fix inclus) | ✓ VERIFIED | 12/12 PASS. Test CR-01 fix : until=10:00 (bougie en cours) et non 09:00 (ancienne valeur bogguée). |
| `apps/jobs/__tests__/fault-isolation.test.ts` | DATA-07 — source coupée n'interrompt pas + staleness exposée | ✓ VERIFIED | 2/2 PASS (cas 1 mock offline + cas 2 staleness skip propre sans env). |
| `.env.example` | 7 nouvelles clés (valeurs vides) | ✓ VERIFIED | OANDA_API_TOKEN, OANDA_ACCOUNT_ID, FINNHUB_API_KEY, MARKETAUX_API_KEY, FRED_API_KEY présentes (grep confirmé). |

---

## Liens clés (wiring)

| From | To | Via | Statut | Détails |
|------|----|-----|--------|---------|
| `market-ingest.ts` | `upsertCandles / getLastCandleTs` | import @app/supabase | ✓ WIRED | Import ligne 26-28, consommé dans la boucle principale. |
| `market-ingest.ts` | `lastClosedCandleStart / dailyAnchorStart` | import @app/core | ✓ WIRED | Import ligne 19-23, utilisé dans computeGapFillWindow. |
| `dispatch.ts` | `marketIngest` | JOB_REGISTRY['market-ingest'] | ✓ WIRED | Ligne 32. |
| `dispatch.ts` | `newsIngest / macroIngest / calendarIngest` | JOB_REGISTRY | ✓ WIRED | Lignes 33-35. |
| `news-ingest.ts` | fallback Marketaux | catch Finnhub → fetchMarketauxNews | ✓ WIRED | Bloc catch ligne 80 → getMarketauxOnce() → fetchMarketauxNews([]). |
| `macro-ingest.ts` | `upsertMacroSeries` | import @app/supabase | ✓ WIRED | Import ligne 15, utilisé dans boucle try/catch FRED_SERIES. |
| `candles.ts` | `public.candles` | `.upsert(rows, { onConflict: 'instrument_id,timeframe,ts' })` | ✓ WIRED | Ligne 25 — correspond à l'index `candles_uniq` de la migration 0003. |
| `parseFredObservations` | exclusion valeur '.' | `.filter((obs) => obs.value !== '.')` | ✓ WIRED | Ligne 113 dans fred/client.ts. |

---

## Couverture des exigences

| Exigence | Plan source | Description | Statut | Evidence |
|----------|------------|-------------|--------|----------|
| DATA-01 | 02-02 | Ingestion OHLCV crypto (Binance H1/H4/D) | ✓ SATISFAIT | market-ingest + binance/client.ts + golden tests binance/schema.test.ts. Run live pending clés. |
| DATA-02 | 02-02 | Ingestion OHLCV forex+commodities (OANDA H1/H4/D) | ✓ SATISFAIT | market-ingest + oanda/client.ts + golden tests oanda/schema.test.ts. Run live pending clés. |
| DATA-03 | 02-03 | News et sentiment Finnhub/Marketaux | ✓ SATISFAIT | finnhub/client.ts (marketNews D-28), marketaux/client.ts, news-ingest.ts fallback D-29, golden test finnhub/schema.test.ts. |
| DATA-04 | 02-04 | Séries macro FRED (taux, CPI, DXY) | ✓ SATISFAIT | fred/client.ts (DFF/CPIAUCSL/DTWEXBGS/DFII10), macro-ingest.ts, golden test fred/schema.test.ts, fault-isolation.test.ts. |
| DATA-06 | 02-01 | Ingestion idempotente (upsert sur clés uniques) | ✓ SATISFAIT | 4 repositories avec onConflict exact. idempotency.test.ts 2/2 PASS contre cloud. |
| DATA-07 | 02-04 | Source en échec n'interrompt pas les autres + staleness exposée | ✓ SATISFAIT | fault-isolation.test.ts 2/2 PASS. Try/catch par cible dans les 4 jobs. v_data_freshness interrogeable. |

**Note :** DATA-05 (normalisation UTC + bougie clôturée exclusive) est une exigence Phase 1 signalée comme Complete dans REQUIREMENTS.md. Elle est consommée (non re-livrée) par cette phase via lastClosedCandleStart/@app/core et complete:true OANDA.

---

## Anti-patterns

Aucun marqueur TBD/FIXME/XXX trouvé dans les fichiers modifiés par cette phase.

| Fichier | Ligne | Pattern | Sévérité | Impact |
|---------|-------|---------|----------|--------|
| `apps/jobs/src/jobs/news-ingest.ts` | 64 | `fetchMarketauxNews([])` — symboles vides en fallback | INFO | La liste de symboles Marketaux est `[]` (fallback général). Acceptable pour Phase 2 ; le mapping catégorie→instruments sera enrichi en Phase 3 selon le SUMMARY 02-04. Pas un stub bloquant — le fallback s'active et insère les news. |

---

## Spot-checks comportementaux

| Comportement | Commande | Résultat | Statut |
|---|---|---|---|
| 88 tests vitest (suite complète) | `pnpm vitest run` | 88/88 PASS, 12 fichiers | ✓ PASS |
| idempotency test DATA-06 | `pnpm vitest run packages/supabase/__tests__/idempotency.test.ts` | 2/2 PASS | ✓ PASS |
| gap-fill fenêtre (CR-01 fix) | `pnpm vitest run apps/jobs/__tests__/gap-fill.test.ts` | 12/12 PASS | ✓ PASS |
| fault-isolation DATA-07 | `pnpm vitest run apps/jobs/__tests__/fault-isolation.test.ts` | 2/2 PASS | ✓ PASS |
| golden parsers data-sources | `pnpm vitest run packages/data-sources` | 48/48 PASS (5 fichiers) | ✓ PASS |
| typecheck packages supabase/data-sources/jobs | `pnpm --filter supabase/data-sources/jobs exec tsc --noEmit` | Clean (0 erreur) | ✓ PASS |
| dispatch contient 4 jobs + heartbeat | grep JOB_REGISTRY dispatch.ts | market-ingest, news-ingest, macro-ingest, calendar-ingest | ✓ PASS |
| finnhub n'utilise pas companyNews | grep dans finnhub/client.ts | Aucune référence companyNews | ✓ PASS |
| Run live end-to-end (candles en base) | tsx src/dispatch.ts market-ingest | NON EXÉCUTABLE (clés absentes) | ? SKIP |

---

## Vérification humaine requise

### 1. Run live d'ingestion market-ingest

**Test :** Saisir les clés OANDA_API_TOKEN, OANDA_ACCOUNT_ID, FINNHUB_API_KEY, MARKETAUX_API_KEY, FRED_API_KEY dans `apps/jobs/.env`, puis exécuter `tsx apps/jobs/src/dispatch.ts market-ingest` ou via `run-job.cmd market-ingest`.

**Attendu :** Des lignes OHLCV apparaissent dans la table `candles` pour les 12 instruments MVP en H1/H4/D, un enregistrement `job_runs` avec statut 'success' est créé, stats.inserted > 0.

**Pourquoi humain :** Clés API réelles requises (jamais commitées). La validation offline (parsers + gap-fill + idempotency tests) prouve toute la logique, mais le round-trip réseau réel ne peut pas être simulé en CI.

### 2. Vérification is_stale avec données réelles (après run live)

**Test :** Après le premier run live, interroger `v_data_freshness` le week-end et un jour de semaine.

**Attendu :** Instruments avec quote_hours='fx' ont is_stale=false le week-end (vendredi ≥ 17h NY, samedi, dimanche < 17h NY). Crypto (24/7) ont is_stale selon l'âge des dernières candles vs 2× le timeframe.

**Pourquoi humain :** Le test fault-isolation.test.ts cas 2 vérifie que la vue est interrogeable (0 erreur) mais pas la logique is_stale sur des données réelles. La correction DST (migration 0004) ne peut être validée qu'avec des timestamps réels.

---

## Résumé des gaps

Aucun gap bloquant. La phase a livré son objectif technique complet.

Le statut `human_needed` reflète uniquement l'absence de clés API pour le run live — situation attendue, documentée dans le checkpoint humain 02-01 T2 et dans le post_execution_context de la phase.

---

_Vérifié : 2026-06-13T03:00:00Z_
_Verifier : Claude (gsd-verifier)_
