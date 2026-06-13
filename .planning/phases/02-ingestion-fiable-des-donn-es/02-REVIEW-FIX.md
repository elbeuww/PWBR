---
phase: 02-ingestion-fiable-des-donn-es
fixed_at: 2026-06-13T02:35:00Z
review_path: .planning/phases/02-ingestion-fiable-des-donn-es/02-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 02 : Code Review Fix Report

**Fixed at:** 2026-06-13T02:35:00Z
**Source review:** .planning/phases/02-ingestion-fiable-des-donn-es/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01 + WR-01..WR-06)
- Fixed: 7
- Skipped: 0

Note : WR-05 est marqué `fixed_pending_apply` — la migration est écrite et committée
mais doit être appliquée via MCP `apply_migration` avant d'être effective.

**Suite vitest :** 88 tests / 12 fichiers — tous passés (GREEN).

---

## Fixed Issues

### CR-01 : Off-by-one gap-fill — la dernière bougie clôturée n'est jamais ingérée

**Files modified:** `apps/jobs/src/jobs/market-ingest.ts`, `apps/jobs/__tests__/gap-fill.test.ts`
**Commit:** efbf73c
**Applied fix:**
`until` était `lastClosedCandleStart(now, tf)` (= ouverture de la dernière bougie clôturée).
La boucle `while (currentStart < until)` l'excluait, créant un retard permanent d'une bougie.

Fix : `until = lastClosed.plus({ minutes: TIMEFRAMES[tf] })` = ouverture de la bougie EN COURS.
L'anti look-ahead est préservé : filtre `complete:true` OANDA + `endTime = pageEnd - 1ms` Binance.

Golden tests mis à jour depuis premier principes :
- H1 `until` : `10:00` (était `09:00`) — bougie 09:00-10:00 maintenant dans la fenêtre
- H4 `until` : `08:00` (était `04:00`) — bougie 04:00-08:00 maintenant dans la fenêtre
- Nouveau test : la dernière bougie clôturée est bien dans `[since, until[`

### WR-01 : Respect de Retry-After = code mort dans les 5 clients

**Files modified:** `packages/data-sources/src/oanda/client.ts`, `packages/data-sources/src/marketaux/client.ts`, `packages/data-sources/src/fred/client.ts`, `packages/data-sources/src/binance/client.ts`, `packages/data-sources/src/finnhub/client.ts`
**Commit:** 9c4fb9e
**Applied fix:**
Clients fetch-maison (oanda, marketaux, fred) : capturer `Retry-After` depuis `res.headers.get()`
au point où la `Response` est disponible, propager via `err.retryAfterMs`, puis lire dans
`onFailedAttempt({ error })` (p-retry v8 API correcte — reçoit `RetryContext`, pas l'erreur brute).

Clients SDK (binance, finnhub) : suppression du code mort (le SDK ne propage pas les headers HTTP).
Backoff exponentiel p-retry + `pLimit` restent actifs. Documenté en commentaire.

### WR-02 : news-ingest — erreur Finnhub avalée silencieusement + fallback Marketaux déclenché 3x

**Files modified:** `apps/jobs/src/jobs/news-ingest.ts`
**Commit:** 4453329
**Applied fix:**
1. Erreur Finnhub toujours tracée dans `stats.errors` avec marqueur `fallback_used: true`
2. `fetchMarketauxNews([])` mémoïsé via `getMarketauxOnce()` — 1 appel max par run (quota 100/jour)
3. Fallback uniquement sur `catch` (erreur réelle) — `articles.length === 0` = `skipped` sans fallback

### WR-03 : Sentiment Marketaux non borné — un seul article hors [-1,1] fait échouer tout le lot

**Files modified:** `packages/data-sources/src/marketaux/client.ts`
**Commit:** f2f2961
**Applied fix:**
`sentiment_score: z.number().min(-1).max(1).nullable().optional().catch(null)` — article hors plage
conservé avec `sentiment=null` au lieu de faire échouer le batch entier (`.catch(null)` Zod v4).
Appliqué aussi sur `entities[].sentiment_score`.

### WR-04 : Job 100% échec enregistré status='success' dans job_runs

**Files modified:** `apps/jobs/src/jobs/market-ingest.ts`, `apps/jobs/src/jobs/news-ingest.ts`, `apps/jobs/src/jobs/macro-ingest.ts`
**Commit:** 2102967
**Applied fix:**
A la fin de chaque job, si `inserted === 0 AND skipped === 0 AND errors.length > 0`, lancer une
exception. `runJob` la capture et écrit `status='error'` dans `job_runs` (visible monitoring).
Les échecs partiels (certaines cibles OK) restent `status='success'` avec `stats.errors`.
`calendar-ingest.ts` non touché (source unique, non bloquant A3).

**Status :** fixed: requires human verification — la condition `skipped === 0` peut être ajustée
si des instruments sont légitimement skippés lors d'un run normal sans aucune insertion.

### WR-05 : Heuristique week-end FX — faux is_stale vendredi soir et dimanche hiver

**Files modified:** `supabase/migrations/0004_fix_freshness_weekend.sql` (nouveau fichier)
**Commit:** e22d532
**Applied fix:**
Migration `0004_fix_freshness_weekend.sql` écrite — recrée `v_data_freshness` avec `market_state`
raisonnant en `America/New_York` (DST géré par Postgres) :
- `DOW=5, hour>=17 NY` : vendredi >= 17h NY = fermeture FX
- `DOW=6` : samedi entier
- `DOW=0, hour<17 NY` : dimanche avant 17h NY

**Action requise :** Appliquer via MCP `apply_migration` — NE PAS appliquer manuellement en prod.

### WR-06 : Test d'idempotence — cleanup non vérifié

**Files modified:** `packages/supabase/__tests__/idempotency.test.ts`
**Commit:** 7808f09
**Applied fix:**
1. `afterAll` capture `{ error }` du delete et lance si non null
2. Vérification post-delete : `countCandles()` — si `residualCount !== 0`, throw avec message explicite
3. Commentaire clarifié : lignes synthétiques clairement marquées (ts=2020-01-01, open=10000)

---

## Skipped Issues

Aucun — tous les findings en scope ont été fixés.

---

## Info Findings (hors scope — deferred)

- **IN-01** : Pagination `break` sur page vide — piège extensibilité (avancer `currentStart = pageEnd`)
- **IN-02** : Imports inutilisés `vi`, `beforeEach` dans gap-fill.test.ts
- **IN-03** : Finnhub `String(error)` peut produire `[object Object]`
- **IN-04** : Migration — colonnes sans contraintes + `encodeURIComponent` OANDA
- **IN-05** : `stats.inserted` compte les upserts, pas les insertions réelles
- **IN-06** : `getServiceClient()` dupliqué 5 fois

---

_Fixed: 2026-06-13T02:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
