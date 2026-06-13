---
phase: 02-ingestion-fiable-des-donn-es
plan: 03
subsystem: data-sources
tags: [news, macro, calendar, finnhub, fred, faireconomy, marketaux, zod, golden-tests, tdd]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [clients-news-macro-calendar, parsers-finnhub-fred-faireconomy-marketaux]
  affects: [02-04-jobs-news-macro-calendar]
tech_stack:
  added: [finnhub@2.0.14]
  patterns: [fetch+Zod maison, sha256 url_hash/event_key, pLimit+pRetry, in-process cache 24h, schema passthrough tolérant]
key_files:
  created:
    - packages/data-sources/src/finnhub/client.ts
    - packages/data-sources/src/finnhub/schema.ts
    - packages/data-sources/src/finnhub/schema.test.ts
    - packages/data-sources/src/marketaux/client.ts
    - packages/data-sources/src/fred/client.ts
    - packages/data-sources/src/fred/schema.test.ts
    - packages/data-sources/src/faireconomy/client.ts
    - packages/data-sources/src/faireconomy/schema.test.ts
    - packages/data-sources/src/__fixtures__/finnhub-news.json
    - packages/data-sources/src/__fixtures__/fred-observations.json
    - packages/data-sources/src/__fixtures__/faireconomy-calendar.json
  modified:
    - packages/data-sources/src/index.ts
    - packages/data-sources/package.json
decisions:
  - "D-28 : parseFinnhubNews laisse instrument_ids=[] — le job plan 04 injecte le mapping catégorie→instruments"
  - "D-30 : sentiment Finnhub free = null (le free tier ne retourne pas sentiment structuré pour crypto/forex)"
  - "FairEconomy cache in-process 24h (singleton par process) — reset au redémarrage du job cron quotidien, acceptable pour le périmètre MVP"
  - "Schema FairEconomy passthrough Zod — champs inattendus ignorés silencieusement (flux communautaire A3, T-02-08)"
metrics:
  duration: ~25min
  completed: "2026-06-13"
  tests_added: 33
  tests_total: 84
  tsc_clean: true
---

# Phase 2 Plan 03: Clients news/macro/calendrier Summary

Clients + parsers Zod déterministes pour Finnhub (SDK marketNews), Marketaux (fetch+Zod fallback), FRED (4 séries macro) et FairEconomy (calendrier économique sans clé), avec golden tests hors-ligne couvrant les règles métier critiques.

## What Was Built

4 clients news/macro/calendrier ajoutés au package `@app/data-sources` :

**Finnhub** (`finnhub/client.ts` + `finnhub/schema.ts`)
- SDK `finnhub@2.0.14` (version épinglée CLAUDE.md, T-02-SC)
- `fetchFinnhubNews(category)` : `marketNews(category)` UNIQUEMENT (D-28, Pitfall 2 — PAS companyNews/news-sentiment)
- `parseFinnhubNews(raw, category) => NewsInsert[]` : url_hash sha256 déterministe, sentiment=null (D-30 free tier), source='finnhub'
- pLimit(1) + pRetry Retry-After, FINNHUB_API_KEY env (T-02-09)

**Marketaux** (`marketaux/client.ts`)
- fetch+Zod maison `/v1/news/all`, pattern squelette oanda/client.ts
- `fetchMarketauxNews(symbols)` + `parseMarketauxNews(raw) => NewsInsert[]`
- sentiment_score provider (D-30), url_hash sha256, source='marketaux', MARKETAUX_API_KEY env
- Exposé comme fallback — la bascule Finnhub→Marketaux est câblée dans le job (plan 04, D-29)

**FRED** (`fred/client.ts`)
- fetch+Zod maison `series/observations`, fenêtre 2 ans
- `fetchFredSeries(seriesCode)` + `parseFredObservations(raw, code) => MacroSeriesInsert[]`
- Exclut `value === '.'` (observations manquantes FRED) — prouvé par golden test
- DTWEXBGS documenté comme proxy DXY (A5), FRED_API_KEY env, pLimit(2)

**FairEconomy** (`faireconomy/client.ts`)
- fetch+Zod SANS clé, URL `nfs.faireconomy.media/ff_calendar_thisweek.json`
- `fetchFairEconomyCalendar() => EconomicCalendarInsert[]` : cache in-process 24h (Pitfall 5 — rate limit 2/5min)
- `parseFairEconomyCalendar(raw) => EconomicCalendarInsert[]` : event_key sha256(title|country|date), impact enum High|Medium|Low, schéma passthrough tolérant (T-02-08)
- source='faireconomy'

**Barrel étendu** (`index.ts`) : 8 exports news/macro/calendrier ajoutés.

## Test Results

```
Test Files  5 passed (5) — data-sources complet
Tests      48 passed (48) — 33 nouveaux + 15 anciens Binance/OANDA
Suite      84 passed (84) — suite globale, 0 régressions
tsc --noEmit clean
```

Couverture golden :
- Finnhub : 11 tests (url_hash déterministe, sha256 correct, ts UTC, sentiment null, instrument_ids tableau)
- FRED : 7 tests (exclusion '.', ts UTC minuit, value numérique, order chronologique)
- FairEconomy : 15 tests (event_key sha256, impact enum H/M/L, schéma tolérant extra_field, event_at UTC)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Valeur golden published_at incorrecte dans schema.test.ts Finnhub**
- **Trouvé lors de :** Exécution GREEN (premier run)
- **Problème :** Unix timestamp 1749463200 = `2025-06-09T10:00:00.000Z` (pas 2026), valeur écrite manuellement sans vérification
- **Correction :** Calcul préalable `new Date(1749463200 * 1000).toISOString()` → correction de la golden value avant le commit GREEN
- **Fichiers :** `packages/data-sources/src/finnhub/schema.test.ts`

**2. [Rule 2 - Sécurité manquante] Schema FairEconomy passthrough non prévu explicitement dans la tâche**
- Ajouté `.passthrough()` sur le schéma Zod (champs inconnus ignorés sans erreur) — T-02-08 + A3 (flux communautaire)
- Prouvé par le test `extra_field` dans la fixture (event 3 contient un champ `extra_field`)

## Threat Surface

Aucun nouveau point d'entrée réseau ajouté par rapport au plan prévu. Les 4 clients sont des callers sortants (pull) sans exposition de surface entrante. Menaces T-02-08/T-02-09/T-02-11 adressées conformément au threat model.

## Known Stubs

`instrument_ids: []` dans parseFinnhubNews et parseMarketauxNews — intentionnel (D-28). Le mapping catégorie→instruments est câblé par le job (plan 04). Documenté en commentaire dans les deux parsers.

## Commits

| Hash | Message |
|------|---------|
| dbe54f3 | test(02-03): golden fixtures + failing tests Finnhub/FRED/FairEconomy — RED |
| 949c2dd | feat(02-03): clients Finnhub/Marketaux/FRED/FairEconomy + parsers Zod — GREEN |

## Self-Check: PASSED
