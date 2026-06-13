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
result: [pending]

### 2. v_data_freshness avec données réelles

Après le premier run live : `select * from v_data_freshness order by canonical_symbol, timeframe;`
expected: is_stale=false pour les instruments OANDA forex/commodities le week-end (logique NY-DST migration 0004), et is_stale selon le seuil 2× timeframe pour les crypto (24/7)
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
