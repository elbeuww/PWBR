---
status: partial
phase: 02-ingestion-fiable-des-donn-es
source: [02-VERIFICATION.md]
started: 2026-06-13T03:05:00Z
updated: 2026-06-13T03:05:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Run live d'ingestion market-ingest

Prérequis : saisir les clés API dans `apps/jobs/.env` (OANDA_API_TOKEN, OANDA_ACCOUNT_ID — Finnhub/Marketaux/FRED pour les autres jobs ; Binance klines = sans clé).
Commande : `pnpm tsx apps/jobs/src/dispatch.ts market-ingest` (ou via Task Scheduler).
expected: Des lignes OHLCV apparaissent dans la table candles pour les 12 instruments MVP (H1/H4/D), avec un statut 'success' dans job_runs
result: PARTIEL ✓ (2026-06-13) — run live exécuté, job_runs status='success'. **Binance crypto OK** : 30 935 bougies réelles ingérées (BTC/ETH/SOL/BNB/XRP × D 729 / H4 1091 / H1 4367). **Reste OANDA** (4 forex + 3 commodities) : clés OANDA_API_TOKEN/OANDA_ACCOUNT_ID pas encore saisies (compte démo en attente de confirmation). Isolation des pannes confirmée en vrai (OANDA absent n'a pas bloqué Binance).

### 2. v_data_freshness avec données réelles

Après le premier run live : `select * from v_data_freshness order by canonical_symbol, timeframe;`
expected: is_stale=false pour les instruments OANDA forex/commodities le week-end (logique NY-DST migration 0004), et is_stale selon le seuil 2× timeframe pour les crypto (24/7)
result: PARTIEL ✓ (2026-06-13) — **Crypto 24/7 validé** : 15 lignes (5 × 3 TF) toutes is_stale=false sur données fraîches (H1 jusqu'à 01:00 UTC). **Reste FX week-end** : nécessite des candles OANDA en base (après saisie clés OANDA) pour vérifier la logique NY-DST de la migration 0004.

### 3. [À FAIRE] news/macro/calendar-ingest

Prérequis : saisir FINNHUB_API_KEY, MARKETAUX_API_KEY, FRED_API_KEY dans `apps/jobs/.env` puis **Ctrl+S** (au run du 2026-06-13 le fichier ne contenait que les 2 lignes Supabase — clés non sauvegardées).
Commande : `pnpm tsx apps/jobs/src/dispatch.ts news-ingest` / `macro-ingest` / `calendar-ingest`.
expected: lignes dans news / macro_series / economic_calendar, status='success' dans job_runs. (calendar-ingest = FairEconomy sans clé, devrait passer même sans les autres.)
result: [pending — clés à resaisir]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
