---
phase: 03-moteur-d-analyse-d-terministe
reviewed: 2026-06-13T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - apps/jobs/src/dispatch.ts
  - apps/jobs/src/jobs/fundamental-engine.ts
  - apps/jobs/src/jobs/news-engine.ts
  - apps/jobs/src/jobs/technical-engine.ts
  - packages/indicators/src/index.ts
  - packages/indicators/src/ohlcv.ts
  - packages/indicators/src/snapshots/hash.ts
  - packages/indicators/src/snapshots/schema.ts
  - packages/indicators/src/structure/levels.ts
  - packages/indicators/src/structure/structure.ts
  - packages/indicators/src/structure/swings.ts
  - packages/indicators/src/structure/volume.ts
  - packages/indicators/src/wrappers/atr.ts
  - packages/indicators/src/wrappers/bollinger.ts
  - packages/indicators/src/wrappers/ema.ts
  - packages/indicators/src/wrappers/macd.ts
  - packages/indicators/src/wrappers/rsi.ts
  - packages/supabase/src/index.ts
  - packages/supabase/src/repositories/assetDrivers.ts
  - packages/supabase/src/repositories/snapshots.ts
  - supabase/migrations/0005_snapshots.sql
findings:
  critical: 1
  warning: 8
  info: 5
  total: 14
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-13
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Le moteur déterministe est globalement bien structuré : logique pure séparée de l'IO (D-23), Zod-validation avant upsert (T-03), hash canonique sha256 (D-41), service-client jamais ré-exporté du barrel (D-07), RLS lecture-seule + écriture service_role bypass conforme (migration 0005). La canonicalisation du hash et les wrappers d'indicateurs sont corrects.

Cependant l'adversarial review révèle un défaut d'idempotence majeur sur le `news-engine` (BLOCKER : `computed_for_ts = now` casse la clé d'upsert → croissance illimitée de lignes), plus plusieurs valeurs par défaut silencieuses qui contredisent la doctrine "jamais de zéro silencieux" (Pitfall 2) : RSI/ATR/MACD retombent sur des neutres sans flag `partial`. Le clustering S/R a un bug de segmentation quand supports et résistances s'entremêlent en prix.

## Critical Issues

### CR-01: news-engine — `computed_for_ts = now` casse l'idempotence d'upsert → croissance illimitée

**File:** `apps/jobs/src/jobs/news-engine.ts:223`
**Issue:** La clé unique d'upsert est `(instrument_id, style, kind, computed_for_ts)` (migration 0005, ligne 42-43). Le `technical-engine` utilise `ltf.at(-1).ts` (stable, dérivé des données) et le `fundamental-engine` utilise `latestMacroTs` (stable). Mais le `news-engine` écrit `computed_for_ts: now.toISO()` où `now = DateTime.utc()` (ligne 204) — un instant qui change à chaque exécution. Conséquence : chaque run du job insère de NOUVELLES lignes au lieu de mettre à jour, car `computed_for_ts` ne collisionne jamais. Cela viole D-41 (idempotence des re-runs), fait croître la table `snapshots` sans borne (le job tourne par routine cron), et empêche tout consommateur Phase 4 de retrouver "le" snapshot news courant par sa clé naturelle. Le `content_hash` est stable mais n'entre pas dans la clé d'upsert.
**Fix:**
```typescript
// Dériver computed_for_ts d'une borne temporelle stable, pas de l'instant courant.
// Ex. : aligner sur la dernière bougie clôturée du style, ou bucketiser l'heure.
import { lastClosedCandleStart, TIMEFRAMES } from '@app/core'
// ...
const bucketTs = lastClosedCandleStart(now, TIMEFRAMES['H1']).toISO()!
// puis :
computed_for_ts: bucketTs,
// Ainsi un re-run dans la même fenêtre H1 upsert la même ligne (idempotent).
```

## Warnings

### WR-01: technical-engine — RSI/ATR/MACD retombent sur des neutres sans flag `partial` (Pitfall 2 violé)

**File:** `apps/jobs/src/jobs/technical-engine.ts:114-116, 137-144`
**Issue:** Le flag `partial` n'est levé QUE pour `ema200` (ligne 109-111). Mais avec < 14 bougies, `rsi(ltf) ?? 50`, `atr(ltf) ?? 0` et `macd(ltf)` (qui retourne `{0,0,0}` en repli, cf. macd.ts:43) produisent des valeurs neutres FAUSSES présentées comme réelles. Un snapshot avec historique insuffisant passe la validation Zod (les schémas n'exigent que `z.number()`) et est persisté avec `partial: false`, exactement le "zéro silencieux" que Pitfall 2 interdit. Un atr=0 fait ensuite passer le seuil de swing à 0 et casse le clustering (`avgAtr || 1`).
**Fix:**
```typescript
// Flagger chaque indicateur dont l'historique est insuffisant.
if (rsi(ltf) === null) missing.push('rsi')
if (atr(ltf) === null) missing.push('atr')
if (toOhlcv(ltf).closes.length < MACD_SLOW + MACD_SIGNAL) missing.push('macd')
// partial = missing.length > 0 reflète alors réellement les trous.
```

### WR-02: macd / bollinger wrappers — repli silencieux sur objet zéro au lieu de null

**File:** `packages/indicators/src/wrappers/macd.ts:42-44`, `packages/indicators/src/wrappers/bollinger.ts:40-42`
**Issue:** `rsi`, `ema`, `atr` retournent `null` quand l'historique est insuffisant (contrat honnête). Mais `macd` retourne `{ macd: 0, signal: 0, histogram: 0 }` et `bollinger` retourne `{ middle: 0, ... }`. Le caller ne peut pas distinguer "MACD réellement nul" d'"historique insuffisant". Incohérence de contrat dans le même package, source directe de WR-01.
**Fix:**
```typescript
export function macd(rows: readonly CandleRow[]): MacdValue | null {
  return macdSeries(rows).at(-1) ?? null
}
// idem bollinger → BollingerValue | null ; laisser le caller décider du repli + flag partial.
```

### WR-03: clusterLevels — segmentation S/R erronée quand supports et résistances s'entremêlent en prix

**File:** `packages/indicators/src/structure/levels.ts:50-63`
**Issue:** Les points (highs=resistance, lows=support) sont fusionnés puis triés UNIQUEMENT par prix (ligne 53). Le clustering séquentiel exige `p.type === last[0].type` (ligne 58). Quand un support a un prix intercalé entre deux résistances proches, le support coupe le cluster de résistance en deux, et inversement. Résultat : des zones S/R réelles sont fragmentées de façon dépendante de l'entrelacement prix support/résistance — niveaux sous-comptés, force (`touches`) sous-estimée. La comparaison se fait aussi vs `last[0].price` (ancre du 1er membre), donc une dérive lente de prix au-delà de `tol` n'est pas détectée correctement.
**Fix:**
```typescript
// Clusteriser SÉPARÉMENT par type avant de trier/regrouper.
const byType = (pts: SwingPoint[]) =>
  [...pts].sort((a, b) => a.price - b.price) /* puis regroupement intra-type */
const resClusters = clusterSorted(points.filter((p) => p.type === 'resistance'))
const supClusters = clusterSorted(points.filter((p) => p.type === 'support'))
// + comparer chaque point au DERNIER membre du cluster, pas à last[0].
```

### WR-04: deriveFundamentalContext — drivers ignorent `weight`, dédup non gérée

**File:** `apps/jobs/src/jobs/fundamental-engine.ts:113-116`
**Issue:** La table `asset_drivers` porte une colonne `weight` (migration 0005 ligne 63) et la clé unique est `(instrument_id, driver_code)`. Le code mappe `driver_code(direction)` mais ignore complètement `weight`. Si une seed future donne un poids différencié, il est silencieusement perdu — la dérivation `asset_specific_drivers` n'est donc pas fidèle aux données (contredit D-38 "data-not-code"). Le tri par `driver_code` seul n'est pas un comparateur total stable si deux codes égaux existaient (impossible ici par l'index unique, mais le comparateur `<` ternaire n'est pas robuste).
**Fix:**
```typescript
// Inclure weight dans le libellé OU documenter explicitement qu'il est hors §3.
.map((d) => `${d.driver_code}(${d.direction > 0 ? '+' : ''}${d.direction}${d.weight !== 1 ? `×${d.weight}` : ''})`)
// Comparateur total : (a, b) => a.driver_code.localeCompare(b.driver_code)
```

### WR-05: deriveNewsContext — `upcoming_events` peut dédupliquer des titres et perdre des events distincts

**File:** `apps/jobs/src/jobs/news-engine.ts:117-122, 126-128`
**Issue:** `upcomingEvents` ne garde que `e.row.title`. Le `news_risk` (ligne 126) scanne TOUS les `upcoming` (non tronqués) — correct — mais deux events high-impact partageant le même `title` deviennent indistinguables dans `upcoming_events`, et le `slice(0, MAX_UPCOMING)` après tri par proximité peut écarter un event high-impact pertinent du payload exposé tout en le comptant dans `news_risk`. Incohérence entre ce qui déclenche le flag et ce qui est montré à l'IA. Mineur mais trompeur pour le "vétéran".
**Fix:** Conserver `{title, impact, at}` (au moins l'impact) dans `upcoming_events`, ou garantir que tout event ayant déclenché `news_risk` figure dans la liste exposée.

### WR-06: seriesDirection — branche `first === 0` court-circuite TREND_EPSILON

**File:** `apps/jobs/src/jobs/fundamental-engine.ts:59`
**Issue:** Quand la première observation vaut exactement 0, `last > 0 ? 'up'` déclare 'up'/'down' sans appliquer `TREND_EPSILON`. Une variation infinitésimale (bruit) est alors classée directionnelle au lieu de 'flat'. Pour DFF (fed funds, peut être ~0) ou real yields (DFII10, oscille autour de 0 et peut être négatif), un point de base de bruit bascule `macro_bias`/`rate_environment` de façon non déterministe vis-à-vis de l'intention du seuil. Aussi : real yields peut être négatif, donc `Math.abs(first)` est correct, mais la fenêtre compare premier↔dernier — un aller-retour intra-fenêtre est invisible (choix assumé, mais à documenter).
**Fix:**
```typescript
if (first === 0) {
  if (Math.abs(last) <= TREND_EPSILON) return 'flat'
  return last > 0 ? 'up' : 'down'
}
```

### WR-07: detectSwings / clusterLevels — atr=0 et avgAtr=0 dégradent silencieusement le filtre

**File:** `packages/indicators/src/structure/swings.ts:46, 68`; `packages/indicators/src/structure/levels.ts:46-47`
**Issue:** Si l'historique < ATR_PERIOD, `atrSeries` est vide → `avgAtr = 0` → `threshold = SWING_K * 0 = 0` (swings.ts:68) : tout micro-pivot devient un swing confirmé (le filtre anti-bruit k×ATR est désactivé sans signalement). Dans levels.ts:47 `tol = CLUSTER_C * (avgAtr || 1)` retombe sur `1` — une tolérance absolue de 1.0 unité-prix qui n'a aucun sens dimensionnel selon l'instrument (1.0 sur EURUSD ≈ tout fusionne ; 1.0 sur BTC ≈ rien ne fusionne). Comportement non déterministe selon l'échelle de prix de l'actif.
**Fix:** Propager un état "ATR indisponible" jusqu'au flag `partial` du snapshot plutôt que de neutraliser silencieusement le seuil ; ou exiger un minimum de bougies avant de produire des swings/levels.

### WR-08: technical-engine — `Math.max(...highs)` / `Math.min(...lows)` spread sur grand tableau peut throw

**File:** `apps/jobs/src/jobs/technical-engine.ts:122-123`; `packages/indicators/src/structure/volume.ts:33-34`
**Issue:** `Math.max(...highs)` via spread dépile chaque élément en argument. Sur de longs historiques (lecture `candles` sans LIMIT, technical-engine.ts:188-194 ne borne pas le nombre de lignes), un très grand tableau peut dépasser la limite d'arguments et lever `RangeError: Maximum call stack size exceeded`. Le fallback de `structure.lastSwingHigh ?? Math.max(...highs)` n'est atteint que si la structure est nulle, mais la requête `readClosedCandles` n'a aucune borne — l'historique grossit indéfiniment.
**Fix:**
```typescript
const max = highs.reduce((m, v) => (v > m ? v : m), -Infinity)
const min = lows.reduce((m, v) => (v < m ? v : m), Infinity)
// + borner readClosedCandles (.limit(N) ou .gte('ts', cutoff - lookback)).
```

## Info

### IN-01: news-engine — `readNews` ne filtre pas par instrument côté DB

**File:** `apps/jobs/src/jobs/news-engine.ts:159-170`
**Issue:** `readNews` lit toutes les news de la fenêtre (tous instruments) puis filtre en mémoire dans `deriveNewsContext` (ligne 90). Acceptable au volume P1, mais le filtrage `instrument_ids.includes(...)` côté JS sur un tableau Postgres non indexé devient coûteux à l'échelle. Documenter comme dette assumée.
**Fix:** À terme, `.contains('instrument_ids', [instrumentId])` côté requête par instrument, ou index GIN.

### IN-02: atrPercentile — défaut 0 ambigu et `<=` inclut la valeur elle-même

**File:** `apps/jobs/src/jobs/technical-engine.ts:75-81`
**Issue:** Retourne `0` quand la série ATR est vide (historique insuffisant) — indistinguable d'un percentile réel de 0. Et `series.filter((v) => v <= last)` inclut toujours `last`, donc le percentile minimal possible est `1/length`, jamais 0 strict. Cohérent mais à documenter (golden test pinne déjà le comportement).
**Fix:** Documenter la convention `<=` ; envisager `partial` quand série ATR vide plutôt que 0.

### IN-03: hash.ts — canonicalize sérialise `undefined`/symbols en `null` silencieusement

**File:** `packages/indicators/src/snapshots/hash.ts:35-36`
**Issue:** Les valeurs non sérialisables tombent sur `null`. Comme le payload est toujours un objet Zod-validé (formes §3 sans `undefined`), c'est sûr en pratique, mais un futur champ optionnel `undefined` se hasherait comme `null` — collision potentielle entre "champ absent" et "champ null". Doctrine déterministe OK pour le périmètre actuel.
**Fix:** Aucun changement requis ; ajouter un commentaire de garde si des champs optionnels apparaissent en §3.

### IN-04: schema.ts — KeyLevel autorise `volume_source` optionnel sur tous les types, pas seulement `poc`

**File:** `packages/indicators/src/snapshots/schema.ts:14-20`
**Issue:** `volume_source` est `.optional()` au niveau du `KeyLevelSchema`, donc un `support`/`resistance` pourrait porter un `volume_source` (incohérent — seul le POC en a un, cf. technical-engine.ts:147). Le flag d'honnêteté D-35 n'est structurellement attaché qu'au POC par convention, pas par le schéma.
**Fix:** Discriminated union (`type: 'poc'` ⇒ `volume_source` requis ; sinon interdit) pour rendre l'invariant D-35 inviolable par construction.

### IN-05: fundamental-engine — `stats.skipped` jamais incrémenté

**File:** `apps/jobs/src/jobs/fundamental-engine.ts:178-181`
**Issue:** `stats.skipped` est déclaré et retourné mais jamais incrémenté (contrairement à technical-engine qui l'utilise). Champ mort dans la sortie de monitoring `job_runs`. Le `news-engine` a le même champ inutilisé.
**Fix:** Retirer `skipped` du `fundamental-engine`/`news-engine` ou l'incrémenter quand `latestMacroTs === null` / instrument sans driver.

---

_Reviewed: 2026-06-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
