---
phase: 02-ingestion-fiable-des-donn-es
reviewed: 2026-06-13T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - packages/supabase/src/repositories/candles.ts
  - packages/supabase/src/repositories/news.ts
  - packages/supabase/src/repositories/macroSeries.ts
  - packages/supabase/src/repositories/economicCalendar.ts
  - packages/supabase/src/index.ts
  - packages/supabase/__tests__/idempotency.test.ts
  - packages/data-sources/src/binance/client.ts
  - packages/data-sources/src/binance/schema.ts
  - packages/data-sources/src/oanda/client.ts
  - packages/data-sources/src/oanda/schema.ts
  - packages/data-sources/src/oanda/instruments.ts
  - packages/data-sources/src/finnhub/client.ts
  - packages/data-sources/src/finnhub/schema.ts
  - packages/data-sources/src/marketaux/client.ts
  - packages/data-sources/src/fred/client.ts
  - packages/data-sources/src/faireconomy/client.ts
  - packages/data-sources/src/index.ts
  - apps/jobs/src/jobs/market-ingest.ts
  - apps/jobs/src/jobs/news-ingest.ts
  - apps/jobs/src/jobs/macro-ingest.ts
  - apps/jobs/src/jobs/calendar-ingest.ts
  - apps/jobs/src/dispatch.ts
  - apps/jobs/__tests__/gap-fill.test.ts
  - apps/jobs/__tests__/fault-isolation.test.ts
  - supabase/migrations/0003_data_ingestion_tables.sql
  - .env.example
  - packages/data-sources/src/binance/schema.test.ts
  - packages/data-sources/src/oanda/schema.test.ts
  - packages/data-sources/src/finnhub/schema.test.ts
  - packages/data-sources/src/fred/schema.test.ts
  - packages/data-sources/src/faireconomy/schema.test.ts
findings:
  critical: 1
  warning: 6
  info: 6
  total: 13
status: fixed
fix_status:
  CR-01: fixed
  WR-01: fixed
  WR-02: fixed
  WR-03: fixed
  WR-04: fixed
  WR-05: fixed_pending_apply  # migration 0004 ecrite, apply via MCP requis
  WR-06: fixed
  IN-01: deferred
  IN-02: deferred
  IN-03: deferred
  IN-04: deferred
  IN-05: deferred
  IN-06: deferred
fixed_at: 2026-06-13T02:35:00Z
---

# Phase 02 : Code Review Report — Ingestion fiable des données

**Reviewed:** 2026-06-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Revue adversariale des repositories d'upsert, des 6 clients data-sources, des 4 jobs d'ingestion, de la migration 0003 et des tests. L'architecture est saine (frontières Zod systématiques, upserts idempotents alignés sur les index uniques, clés API depuis env avec throw si absentes, RLS lecture-seule sans policy write). Les chaînes d'appel ont été tracées jusqu'à `packages/core/time` (`lastClosedCandleStart`, `dailyAnchorStart`) et `runJob.ts`.

**Un défaut bloquant de correction** : le gap-fill utilise le **début de la dernière bougie clôturée** comme borne haute **exclusive**, ce qui exclut systématiquement cette bougie. Les données sont en retard permanent d'une bougie complète (1 jour entier en Daily), et la vue `v_data_freshness` marquera H1 **toujours stale** (âge ≥ 2,5 h > seuil 2 h). Pour une plateforme dont la valeur cœur est l'analyse sur données fraîches, c'est incorrect.

Côté robustesse : le respect de `Retry-After` annoncé (T-02-06) est du code mort dans les 5 clients ; le fallback Marketaux gaspille le quota et avale silencieusement l'erreur Finnhub ; un job dont 100 % des cibles échouent est quand même enregistré `status='success'` dans `job_runs`.

## Critical Issues

### CR-01 : Off-by-one gap-fill — la dernière bougie clôturée n'est jamais ingérée (retard systémique d'une bougie ; H1 toujours stale)

**File:** `apps/jobs/src/jobs/market-ingest.ts:60-66` (avec `apps/jobs/src/jobs/market-ingest.ts:107,120` et `apps/jobs/src/jobs/market-ingest.ts:158`)
**Issue:** `computeGapFillWindow` pose `until = lastClosedCandleStart(now, tf)` (resp. `dailyAnchorStart`). Ces fonctions de `packages/core/src/time/candle.ts:26` et `sessions.ts:42` retournent le **timestamp d'ouverture de la dernière bougie CLÔTURÉE**. Or le job utilise `until` comme borne haute **exclusive** sur l'openTime :
- Binance (`market-ingest.ts:120`) : `endTime = pageEnd.toMillis() - 1` avec `pageEnd ≤ until` → klines avec `openTime ≤ until − 1 ms` → la bougie ouvrant à `until` (clôturée, donc légitime) est **exclue**.
- Boucle (`market-ingest.ts:107`) : `while (currentStart < until)` → jamais de page couvrant `until` lui-même.

Trace concrète (validée par `gap-fill.test.ts:32-37`) : `now = 10:30`, H1 → `until = 09:00`. La bougie 09:00–10:00 est clôturée depuis 10:00 mais le run n'ingère que jusqu'à la bougie 08:00. Le run suivant rattrape 09:00 mais rate 10:00, etc. → **retard permanent d'une bougie** : 1 h en H1, 4 h en H4, **24 h en Daily**.

Conséquences en chaîne :
1. Le moteur d'analyse (Phase 3/4) raisonnera toujours sur une bougie de retard — en Daily, l'analyse du matin ignore la journée d'hier.
2. `v_data_freshness` (migration 0003, seuil = 2× tf) : en H1, l'âge de `last_ts` est toujours ≥ 2,5 h > 2 h → `is_stale = true` **en permanence**, rendant le signal de fraîcheur inutilisable.

L'anti look-ahead (D-10/DATA-05) exige d'exclure la bougie **en cours** (ouverte à 10:00), pas la dernière clôturée (09:00). Le commentaire « Borne haute exclusive (anti look-ahead) » confond les deux.

Note : côté OANDA, `to=until` peut, selon l'inclusivité de l'API, inclure la bougie ouvrant à `until` (le filtre `complete:true` protège déjà du look-ahead) — ce qui créerait en plus une **incohérence Binance/OANDA**.

**Fix:** rendre la borne haute = début de la bougie **en cours** (exclusive), c.-à-d. `until = lastClosedCandleStart(now, tf).plus({ minutes: TIMEFRAMES[tf] })` :
```typescript
// computeGapFillWindow — la bougie en cours commence à lastClosed + tf ;
// tout openTime < until correspond à une bougie clôturée.
const lastClosed =
  tf === 'D' ? dailyAnchorStart(broker, now) : lastClosedCandleStart(now, TIMEFRAMES[tf])
const until = lastClosed.plus({ minutes: TIMEFRAMES[tf] }) // borne exclusive correcte
```
Le filtre `complete:true` OANDA et le fait que Binance ne retourne la kline en cours qu'avec `openTime = until` (exclue par `endTime = pageEnd − 1`) préservent l'anti look-ahead. Mettre à jour `gap-fill.test.ts` (les golden values attendent actuellement le comportement bogué) et ajouter un test « la dernière bougie clôturée EST dans la fenêtre ».

## Warnings

### WR-01 : Respect de `Retry-After` = code mort dans les 5 clients (T-02-06 non implémenté)

**File:** `packages/data-sources/src/binance/client.ts:50-59`, `oanda/client.ts:86-95`, `finnhub/client.ts:64-73`, `marketaux/client.ts:88-96`, `fred/client.ts:78-87`
**Issue:** Le handler `onFailedAttempt` lit `(error as { headers?: ... }).headers['retry-after']`. Or :
1. Les erreurs levées sont des `new Error(\`... HTTP ${res.status} ...\`)` construites à la main — l'objet `Response` (et ses headers) est jeté ; **aucune** erreur ne porte jamais de propriété `headers`. La branche est inatteignable.
2. En p-retry ≥ 7 (le lockfile vise 8.0.0), `onFailedAttempt` reçoit un **objet contexte** `{ error, attemptNumber, retriesLeft }`, pas l'erreur elle-même — le cast `as { headers?: ... }` masque ce mismatch au typage.
3. Même si atteint : `Number(retryAfter)` sur un `Retry-After` au format HTTP-date donne `NaN` → `setTimeout(NaN)` = 0 ms.

Résultat : sur un 429 Finnhub/FRED/Marketaux, les retries repartent immédiatement avec le backoff par défaut, en contradiction avec la doc des fichiers et le contrat T-02-06 — risque de prolonger le rate-limit sur les tiers gratuits.
**Fix:** capturer le `Retry-After` au point où la `Response` est disponible et le propager :
```typescript
if (!res.ok) {
  const err = new Error(`OANDA ${sourceSymbol} ${granularity}: HTTP ${res.status}`)
  ;(err as Error & { retryAfterMs?: number }).retryAfterMs =
    res.status === 429 ? Number(res.headers.get('retry-after') ?? 0) * 1000 || undefined : undefined
  throw err
}
// onFailedAttempt (p-retry v8) :
onFailedAttempt: async ({ error }) => {
  const waitMs = (error as Error & { retryAfterMs?: number }).retryAfterMs
  if (waitMs && Number.isFinite(waitMs)) await new Promise((r) => setTimeout(r, waitMs))
}
```

### WR-02 : news-ingest — erreur Finnhub avalée silencieusement + fallback Marketaux déclenché jusqu'à 3× par run avec `symbols=[]`

**File:** `apps/jobs/src/jobs/news-ingest.ts:58-96`
**Issue:** Trois défauts combinés :
1. **Erreur avalée** : si Finnhub échoue (`catch` ligne 75) et que le fallback Marketaux réussit, l'erreur Finnhub d'origine n'est enregistrée **nulle part** (ni `stats.errors`, ni log). Une clé Finnhub révoquée passerait inaperçue tant que Marketaux tient — violation directe de la règle « never silently swallow errors ».
2. **Quota gaspillé / stats faussées** : `fetchMarketauxNews([])` est appelé indépendamment pour chacune des 3 catégories (lignes 65 et 78). Marketaux free = 100 req/jour ; 3 requêtes identiques par run retournent les **mêmes** articles, dédupliqués par `url_hash` à l'upsert mais comptés 3× dans `stats.inserted`.
3. **`symbols=[]`** → `symbols.join(',') = ''` → requête `&symbols=` vide, comportement Marketaux non spécifié (news génériques ou erreur). Le fallback perd toute notion de catégorie (D-28), et la ligne 63 déclenche aussi le fallback sur « 0 résultats », ce que D-29 ne prévoit pas (fallback = échec/rate-limit uniquement).

**Fix:** mémoïser le fallback (1 seul appel Marketaux par run), tracer l'échec Finnhub dans `stats.errors` avec un marqueur `fallback_used: true`, et passer un mapping catégorie→symboles explicite (ou supprimer le paramètre si non utilisé) :
```typescript
} catch (err) {
  stats.errors.push({ category, msg: `finnhub: ${err instanceof Error ? err.message : String(err)} (fallback marketaux tenté)` })
  const fallbackArticles = await getMarketauxOnce() // mémoïsé pour le run
  ...
}
```

### WR-03 : Sentiment Marketaux non borné côté Zod — un seul article hors [-1, 1] fait échouer tout le lot

**File:** `packages/data-sources/src/marketaux/client.ts:28` (et `supabase/migrations/0003_data_ingestion_tables.sql:118`)
**Issue:** La DB impose `check (sentiment >= -1 and sentiment <= 1)`, mais le schéma Zod accepte `sentiment_score: z.number()` sans bornes. Un provider qui renvoie p.ex. `1.2` (ou un score agrégé hors plage) passe la frontière Zod, et l'upsert du **lot entier** échoue sur la contrainte check (l'upsert Supabase est tout-ou-rien) → toute la catégorie de news est perdue pour ce run. La frontière de validation ne reflète pas le contrat DB.
**Fix:** borner ou clamper à la frontière :
```typescript
sentiment_score: z.number().min(-1).max(1).nullable().optional()
// ou clamp : sentiment: article.sentiment_score == null ? null : Math.max(-1, Math.min(1, article.sentiment_score))
```

### WR-04 : Un job dont 100 % des cibles échouent est enregistré `status='success'` dans job_runs

**File:** `apps/jobs/src/jobs/market-ingest.ts:268-279`, `news-ingest.ts:85-94`, `macro-ingest.ts:64-70` (+ `apps/jobs/src/runJob.ts:60-63`)
**Issue:** L'isolation par cible (DATA-07/D-20) est correcte, mais elle est poussée jusqu'à masquer l'échec total : si **toutes** les séries FRED échouent (clé révoquée), ou tous les instruments (token OANDA expiré + Binance down), le job retourne `stats` normalement → `runJob` écrit `status='success'`. Le monitoring `job_runs` (contrainte projet « PC potentiellement éteint → monitoring job_runs ») ne verra jamais d'état `error` ; seule une inspection manuelle de `stats.errors` révélerait la panne. La staleness finira par monter, mais des jours plus tard pour le Daily.
**Fix:** à la fin de chaque job, échouer si rien n'a abouti :
```typescript
if (stats.inserted === 0 && stats.errors.length > 0) {
  throw new Error(`market-ingest: 0 cible ingérée, ${stats.errors.length} erreurs — ${stats.errors[0]?.msg}`)
}
return stats as Json
```
(`runJob` enregistrera alors `status='error'` ; les stats partielles peuvent être jointes au message.)

### WR-05 : Heuristique week-end FX de `v_data_freshness` — faux `is_stale` le vendredi soir et le dimanche 21h–22h UTC en hiver

**File:** `supabase/migrations/0003_data_ingestion_tables.sql:224-241`
**Issue:** Le marché FX ferme vendredi 17:00 NY (21:00 UTC été / 22:00 UTC hiver), mais `is_weekend_fx` ne couvre que `dow=6` (samedi) et `dow=0 AND hour<21` (dimanche). Deux trous :
1. **Vendredi 21:00 UTC → samedi 00:00 UTC** : marché fermé, `is_weekend_fx=false` → un instrument FX H1 dont la dernière bougie date de 20:00 est marqué stale dès 23:00 vendredi, à tort (3 h de faux positif chaque semaine).
2. **Dimanche 21:00–22:00 UTC en hiver** : marché encore fermé (ouverture 22:00 UTC EST), heuristique dit « ouvert » → faux stale pendant 1 h.
Le commentaire ligne 231 annonce une heuristique « conservatrice », mais ces fenêtres produisent l'inverse (faux positifs). Le calcul utilise par ailleurs `now() at time zone 'UTC'` au lieu de raisonner en `America/New_York`, alors que Postgres gère les TZ nativement.
**Fix:** calculer directement en zone NY (DST géré par Postgres) :
```sql
select (
  extract(dow from now() at time zone 'America/New_York') = 6                       -- samedi
  or (extract(dow from now() at time zone 'America/New_York') = 5
      and extract(hour from now() at time zone 'America/New_York') >= 17)            -- vendredi ≥ 17h NY
  or (extract(dow from now() at time zone 'America/New_York') = 0
      and extract(hour from now() at time zone 'America/New_York') < 17)             -- dimanche < 17h NY
) as is_weekend_fx
```

### WR-06 : Le test d'idempotence écrit des bougies synthétiques dans la table candles de production — cleanup non vérifié

**File:** `packages/supabase/__tests__/idempotency.test.ts:101-110,113-134`
**Issue:** Le test insère 2 bougies BTCUSDT H1 **fictives** (open 10000 au 2020-01-01 — le vrai BTC cotait ~7 200 $) dans la même table/instrument que les données réelles, via service_role sur la base pointée par `apps/jobs/.env`. Deux risques :
1. Le `delete` d'`afterAll` ignore son résultat (`error` non vérifié) — un échec réseau ou un process tué entre l'upsert et l'afterAll laisse des **prix OHLC faux** dans `candles`, consommés ensuite par les indicateurs/analyses des phases 3-4 (le risque exact que DATA-* cherche à éviter).
2. Aucune protection contre une exécution pointant l'environnement de prod.
**Fix:** vérifier le résultat du delete et le faire échouer bruyamment ; idéalement utiliser un instrument de test dédié (seedé inactif, p.ex. `TEST_SYNTHETIC`) plutôt que BTCUSDT :
```typescript
const { error } = await serviceClient.from('candles').delete()
  .eq('instrument_id', btcInstrumentId).eq('timeframe', 'H1').in('ts', [TEST_TS_1, TEST_TS_2])
if (error) throw new Error(`cleanup candles test échoué — données synthétiques résiduelles: ${error.message}`)
```

## Info

### IN-01 : Pagination — `break` sur page vide peut figer définitivement le gap-fill d'un instrument

**File:** `apps/jobs/src/jobs/market-ingest.ts:123` et `apps/jobs/src/jobs/market-ingest.ts:176`
**Issue:** Si une page intermédiaire ne retourne aucune kline/candle (trou de données > taille de page, incident source), la boucle `break` ; au run suivant `getLastCandleTs` redonne le même point de départ → re-`break` au même endroit, indéfiniment. Improbable avec les majors actuelles (pages de 1000/5000 bougies), mais c'est un piège d'extensibilité (D-17 : ajout d'instruments sans changer le code).
**Fix:** sur page vide, avancer `currentStart = pageEnd` au lieu de `break`.

### IN-02 : Imports inutilisés dans gap-fill.test.ts

**File:** `apps/jobs/__tests__/gap-fill.test.ts:12`
**Issue:** `vi` et `beforeEach` importés mais jamais utilisés (le commentaire d'en-tête parle d'un « repository mocké » qui n'existe pas dans ce fichier).
**Fix:** `import { describe, it, expect } from 'vitest'` et corriger le commentaire d'en-tête.

### IN-03 : Finnhub — `String(error)` peut produire `[object Object]` et relayer du contenu SDK non maîtrisé

**File:** `packages/data-sources/src/finnhub/client.ts:51`
**Issue:** Le callback SDK passe `error: unknown` ; `String(error)` sur un objet non-Error donne `[object Object]` (message inutilisable dans `stats.errors`/`job_runs`), et si le SDK (superagent) joint l'URL de requête au message, le token query-param Finnhub pourrait transiter vers `job_runs` — contraire à T-02-13.
**Fix:** narrowing explicite + filtre : `error instanceof Error ? error.message : 'finnhub sdk error'` (ne jamais relayer un objet brut).

### IN-04 : Migration — nouvelles colonnes instruments sans contraintes ; symboles non encodés dans l'URL OANDA

**File:** `supabase/migrations/0003_data_ingestion_tables.sql:24-28` ; `packages/data-sources/src/oanda/client.ts:67`
**Issue:** `quote_hours` est un `text` libre (le commentaire annonce `'24/7' | 'fx'` mais aucune check constraint — une typo `'FX'` casse silencieusement la logique de `v_data_freshness` ligne 250-257) ; `canonical_symbol`/`source_symbol` sans unicité ni not null. Côté OANDA, `sourceSymbol` est interpolé dans le path sans `encodeURIComponent` (valeur issue de la DB, risque faible, mais la frontière d'entrée n'est pas défendue).
**Fix:** `add constraint instruments_quote_hours_chk check (quote_hours in ('24/7','fx'))` ; `encodeURIComponent(sourceSymbol)` dans le path.

### IN-05 : `stats.inserted` compte les lignes upsertées, pas les insertions réelles

**File:** `apps/jobs/src/jobs/market-ingest.ts:264`, `news-ingest.ts:74,81`, `macro-ingest.ts:63`, `calendar-ingest.ts:58`
**Issue:** Chaque run macro re-tire 2 ans de FRED et compte ~730 « inserted » alors que 1 seul point est nouveau ; le re-run du même lot de candles (overlap volontaire d'une bougie) compte aussi la ligne ré-upsertée. Le monitoring ne distingue pas « rien de neuf » d'« ingestion massive ».
**Fix:** renommer en `upserted` (honnête) ou dériver le delta via un count avant/après si la métrique compte pour le monitoring.

### IN-06 : `getServiceClient()` dupliqué à l'identique dans 5 fichiers

**File:** `apps/jobs/src/jobs/market-ingest.ts:71-82`, `news-ingest.ts:29-40`, `macro-ingest.ts:24-35`, `calendar-ingest.ts:21-32`, `apps/jobs/src/runJob.ts:30-41`
**Issue:** Même fonction copiée 5 fois (seul le préfixe du message d'erreur change). Une évolution (options client, validation env) devra être répliquée partout — et `runJob` crée déjà un client par run en plus de celui du job (2 clients par exécution).
**Fix:** extraire `apps/jobs/src/lib/service-client.ts` (hors barrel `@app/supabase`, pour rester sous la garde ESLint D-07) et le réutiliser ; idéalement passer le client de `runJob` au job.

---

_Reviewed: 2026-06-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
