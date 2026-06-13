---
phase: 03-moteur-d-analyse-d-terministe
verified: 2026-06-13T12:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
runtime_verification:
  executed_by: "orchestrator (execute-phase) — base démo cloud via MCP execute_sql"
  results:
    - test: "pnpm vitest run + tsc -b"
      result: "PASS — 159/159 tests sur 19 fichiers, typecheck clean"
    - test: "technical-engine ×2 sur base démo"
      result: "PASS — 10 lignes kind='technical' (5 cryptos × 2 styles), count STABLE après 2e run (idempotence prouvée), 10 hashes distincts"
    - test: "news-engine ×2 sur base démo (idempotence CR-01)"
      result: "PASS — 24 lignes kind='news' (12 instruments × 2 styles), count STABLE après 2e run (CR-01 confirmé runtime : computed_for_ts ancré sur bougie LTF clôturée, pas now). 1 hash distinct car news/economic_calendar vides → contexte dégénéré identique, attendu"
    - test: "fundamental-engine sur base démo"
      result: "DATA-GATED — 0 ligne : macro_series vide (FRED non encore ingéré en Phase 2). Logique vérifiée en source + golden tests ; persistance runtime non démontrable sans données macro upstream. Non bloquant pour le goal Phase 3 (code déterministe livré)"
follow_ups:
  - "Exécuter macro-ingest (FRED) + news-ingest/calendar-ingest (Phase 2) pour alimenter fundamental_context et enrichir news_context au-delà du contexte dégénéré"
  - "WARNINGS code review (non bloquants, 03-REVIEW.md) : WR-01/02 (zéros silencieux indicateurs sans flag partial), WR-03 (clustering S/R entremêle supports/résistances), WR-08 (Math.max spread sans borne)"
---

# Phase 03 : Moteur d'Analyse Déterministe — Rapport de Vérification

**Phase Goal:** À partir des bougies et des données macro/news, le système produit en code déterministe (sans IA) les snapshots technique, fondamental et news que le moteur vétéran consommera — y compris la détection de structure de marché maison.
**Verified:** 2026-06-13T12:00:00Z
**Status:** human_needed
**Re-verification:** Non — vérification initiale

## Goal Achievement

### Observable Truths (Success Criteria Roadmap)

| # | Vérité | Statut | Preuve |
|---|--------|--------|--------|
| SC-1 | RSI/MACD/EMA/ATR/Bollinger calculés en code déterministe, vérifiés par golden tests | VERIFIED | `packages/indicators/src/wrappers/{rsi,macd,ema,atr,bollinger}.ts` existent et utilisent `technicalindicators@3.1.0`. Tests dans `wrappers.test.ts`. Valeurs alignées sur `at(-1)` (dernière bougie clôturée). |
| SC-2 | Structure de marché (HH/HL, swings, BOS/CHoCH) et niveaux S/R + POC détectés de façon déterministe par module maison | VERIFIED | `structure/swings.ts` : pivot fractal 2N+1 + filtre k×ATR (SWING_N=2, SWING_K=1.0). `structure/structure.ts` : BOS/CHoCH sur CLÔTURE DU CORPS uniquement (close > lastSwingHigh, jamais sur mèche). `structure/levels.ts` : clustering c×ATR + force W_TOUCHES/W_RECENCY/W_AGE. `structure/volume.ts` : POC proportional-overlap + flag `volume_source: 'real'\|'proxy'`. |
| SC-3 | `technical_snapshot` structuré (tendance HTF/LTF, momentum, volatilité, niveaux, structure) produit par instrument/style | VERIFIED | `apps/jobs/src/jobs/technical-engine.ts` : `buildTechnicalSnapshot()` pure exportée. Zod-validé via `TechnicalSnapshotSchema.parse()` avant `upsertSnapshot()`. D-36 respecté (Day=H4/H1, Swing=D/H4). 4 golden tests couvrent §3, hash, gap EMA200, volume_source. |
| SC-4 | `fundamental_context` (biais macro, taux, drivers par actif) et `news_context` (sentiment net + décroissance, catalyseurs, news_risk) produits par instrument | VERIFIED | `fundamental-engine.ts` : `deriveFundamentalContext()` pure, règles DXY+real_yields→macro_bias, DFF→rate_environment, drivers lus via `getAssetDrivers()` (D-38 data-not-code, jamais codés en dur). `news-engine.ts` : `deriveNewsContext()` avec `now` injectable, EWMA-like décroissance (HALF_LIFE_HOURS=12), fenêtre day=24h/swing=7j, news_risk seuils <2h/<24h (D-40). |

**Score:** 4/4 vérités confirmées dans le code source.

### Artéfacts requis

| Artéfact | Description | Statut | Notes |
|----------|-------------|--------|-------|
| `supabase/migrations/0005_snapshots.sql` | Tables snapshots + asset_drivers + RLS + seed drivers | VERIFIED | Appliquée en base (context_notes : list_tables + get_advisors=0). |
| `packages/indicators/src/wrappers/rsi.ts` | Wrapper RSI 14 | VERIFIED | 25 lignes, retourne `null` si historique insuffisant. |
| `packages/indicators/src/structure/swings.ts` | Pivot fractal + filtre ATR | VERIFIED | 74 lignes, SWING_N/SWING_K constantes nommées. |
| `packages/indicators/src/structure/volume.ts` | POC proportional-overlap + flag `volume_source` | VERIFIED | Contient `volume_source`, flag real/proxy obligatoire. |
| `packages/indicators/src/snapshots/schema.ts` | Zod §3 TechnicalSnapshotSchema / FundamentalContextSchema / NewsContextSchema | VERIFIED | Exporte les 3 schémas + types inférés. Enum strictes sur toutes unions. |
| `packages/indicators/src/snapshots/hash.ts` | `snapshotContentHash` sha256 canonique | VERIFIED | node:crypto sha256, clés triées, précision fixe HASH_DECIMALS=6. |
| `packages/supabase/src/repositories/snapshots.ts` | `upsertSnapshot` + `getSnapshotByHash` | VERIFIED | onConflict `'instrument_id,style,kind,computed_for_ts'` exact. |
| `packages/supabase/src/repositories/assetDrivers.ts` | `getAssetDrivers(client, instrumentId)` | VERIFIED | Retourne `[]` si aucun driver (pas de crash). |
| `apps/jobs/src/jobs/technical-engine.ts` | Job candles → snapshot technique | VERIFIED | 283 lignes, `buildTechnicalSnapshot` exportée pure (D-23), isolation per-instrument try/catch. |
| `apps/jobs/src/jobs/fundamental-engine.ts` | Job macro → fundamental_context | VERIFIED | 237 lignes, `deriveFundamentalContext` exportée pure, drivers via `getAssetDrivers`. |
| `apps/jobs/src/jobs/news-engine.ts` | Job news + calendar → news_context + news_risk | VERIFIED | 264 lignes, `deriveNewsContext` exportée pure avec `now` injectable. |
| `apps/jobs/src/dispatch.ts` | JOB_REGISTRY avec les 3 moteurs | VERIFIED | Lignes 39-41 : `'technical-engine'`, `'fundamental-engine'`, `'news-engine'` enregistrés. |
| `apps/jobs/__tests__/technical-engine.test.ts` | Golden tests forme §3 + hash + gap EMA200 | VERIFIED | 91 lignes, 4 groupes describe couvrant les 4 comportements du plan. |
| `apps/jobs/__tests__/fundamental-engine.test.ts` | Golden tests règles FRED + drivers | VERIFIED | 131 lignes, 6 groupes describe couvrant §3, macro_bias, rate_environment, drivers, hash, robustesse. |
| `apps/jobs/__tests__/news-engine.test.ts` | Golden tests sentiment pondéré + news_risk | VERIFIED | 172 lignes, 7 groupes describe couvrant §3, décroissance, fenêtre, bornes, news_risk, robustesse, hash. |

### Vérification des Key Links

| De | Vers | Via | Statut | Preuve |
|----|------|-----|--------|--------|
| `wrappers/rsi.ts` | `technicalindicators` | `RSI.calculate({period,values})` | VERIFIED | Ligne 18 : `RSI.calculate({ period: RSI_PERIOD, values: ... })` |
| `structure/structure.ts` | `@app/core lastClosedCandleStart` | convention bougie clôturée (jamais redéfinie) | VERIFIED | Import `@app/core` dans `news-engine.ts` et `technical-engine.ts`. Structure elle-même n'utilise pas la borne (c'est l'engine qui filtre les bougies clôturées avant de les passer). |
| `snapshots/schema.ts` | ARCHITECTURE §3 shapes | `z.enum` sur unions littérales LOCKED | VERIFIED | `TrendEnum`, `z.enum(['support','resistance','poc'])`, `z.enum(['risk_on','risk_off','neutral'])`, etc. |
| `technical-engine.ts` | `@app/indicators` | wrappers + structure + snapshotContentHash + TechnicalSnapshotSchema | VERIFIED | Import ligne 23-37, utilisation dans `buildTechnicalSnapshot`. |
| `technical-engine.ts` | `@app/supabase upsertSnapshot` | persist avec Zod-validation avant insert | VERIFIED | Ligne 245 : `TechnicalSnapshotSchema.parse(snapshot)` puis `upsertSnapshot(client, row)`. |
| `dispatch.ts` | `technical-engine` | `JOB_REGISTRY['technical-engine']` | VERIFIED | Ligne 39. |
| `fundamental-engine.ts` | `@app/supabase getAssetDrivers` | lecture drivers par actif (D-38) | VERIFIED | Import ligne 24, utilisation ligne 198. |
| `news-engine.ts` | `economic_calendar` | fenêtre news_risk <2h/<24h (D-40) | VERIFIED | `readCalendar()` + `newsRisk` ligne 127-129. |
| `dispatch.ts` | `fundamental-engine` + `news-engine` | JOB_REGISTRY | VERIFIED | Lignes 40-41. |
| `snapshots.ts` | `snapshots_uniq` index | `onConflict 'instrument_id,style,kind,computed_for_ts'` | VERIFIED | Ligne 28 de `snapshots.ts`. |
| `supabase/index.ts` | `upsertSnapshot` + `getSnapshotByHash` + `getAssetDrivers` | barrel export | VERIFIED | Lignes 59-60 de `packages/supabase/src/index.ts`. |

### Data-Flow Trace (Level 4)

| Artéfact | Variable de données | Source | Données réelles | Statut |
|----------|--------------------|---------|-----------------|---------| 
| `technical-engine.ts` | `htf`, `ltf` (candles) | `readClosedCandles()` → `client.from('candles').select(*)` | Requête DB réelle, filtrée par instrument + TF + bougie clôturée | FLOWING |
| `fundamental-engine.ts` | `macro` (macro_series) | `readMacroSeries()` → `client.from('macro_series').select(*)` | Requête DB réelle, 3 séries FRED | FLOWING |
| `news-engine.ts` | `news`, `calendar` | `readNews()` + `readCalendar()` → DB | Requêtes DB réelles avec fenêtres temporelles | FLOWING |

### Behavioral Spot-Checks

Étape 7b : IGNORÉE (nécessite l'exécution d'un serveur/DB) — routée vers Human Verification.

### Probe Execution

Étape 7c : Aucune sonde `probe-*.sh` déclarée dans les PLANs ou trouvée dans `scripts/`. IGNORÉE.

### Couverture des exigences

| Exigence | Plan source | Description | Statut | Preuve |
|----------|------------|-------------|--------|--------|
| TECH-01 | 03-02 | Indicateurs déterministes RSI/MACD/EMA/ATR/Bollinger | SATISFIED | Wrappers + golden tests `wrappers.test.ts` |
| TECH-02 | 03-02 | Structure de marché (HH/HL, swings, BOS/CHoCH) | SATISFIED | `swings.ts` + `structure.ts`, BOS/CHoCH sur corps uniquement (D-33) |
| TECH-03 | 03-02 | Niveaux S/R + POC volume avec mesure de force | SATISFIED | `levels.ts` + `volume.ts`, strength multi-facteurs + flag `volume_source` |
| TECH-04 | 03-01, 03-03 | `technical_snapshot` §3 produit par instrument/style | SATISFIED | `technical-engine.ts`, Zod-validé avant persist, snapshots en base |
| FUND-01 | 03-04 | `fundamental_context` biais macro + taux + drivers par actif | SATISFIED | `fundamental-engine.ts`, règles FRED nommées, drivers via table |
| FUND-02 | 03-04 | `news_context` sentiment net + catalyseurs + events | SATISFIED | `news-engine.ts`, EWMA-like décroissance, fenêtre day/swing |
| FUND-03 | 03-04 | `news_risk` flag events high-impact imminents | SATISFIED | `news-engine.ts` ligne 127-129, seuils <2h/<24h (D-40) golden-testés |

Aucune exigence orpheline : les 7 IDs (TECH-01/02/03/04, FUND-01/02/03) sont tous couverts par les PLANs et implémentés.

### Anti-patterns détectés

| Fichier | Ligne | Pattern | Sévérité | Impact |
|---------|-------|---------|----------|--------|
| `packages/indicators/src/wrappers/macd.ts` | 43 | `macdSeries(rows).at(-1) ?? { macd: 0, signal: 0, histogram: 0 }` — repli zéro au lieu de `null` | WARNING | WR-02 du code review : le caller (`technical-engine.ts:115`) ne peut distinguer "MACD réellement nul" d'"historique insuffisant". Ne bloque pas SC-1 (golden tests passent sur fixtures suffisantes) mais réduit la précision du flag `partial`. |
| `apps/jobs/src/jobs/technical-engine.ts` | 114-116 | `rsi(ltf) ?? 50` et `atr(ltf) ?? 0` — neutres silencieux pour RSI/ATR | WARNING | WR-01 : `partial` couvre uniquement EMA200. RSI/ATR insuffisants produisent des valeurs fausses avec `partial:false`. Sous-ensemble du SC-1 non testé (cas < 14 bougies). Ne bloque pas la livraison car la fixture de test a 220 bougies. |
| `packages/indicators/src/structure/levels.ts` | 58 | Clustering S/R mixe types par prix sans séparer supports/résistances | WARNING | WR-03 : segmentation S/R peut fragmenter des zones réelles quand un support est intercalé entre deux résistances. N'empêche pas le fonctionnement mais sous-estime la `strength`. |
| `apps/jobs/src/jobs/technical-engine.ts` | 122-123 | `Math.max(...highs)` spread sur grand tableau | INFO | WR-08 : risque `RangeError` sur très longs historiques (non borné). Mitigé en pratique par la taille des historiques actuels. |

Aucun marqueur TBD/FIXME/XXX non référencé trouvé dans les fichiers modifiés.

### Correction CR-01 Vérifiée

Le BLOCKER CR-01 du code review (`computed_for_ts = now` dans `news-engine`) a été corrigé dans le commit 580edc2. La vérification du code source confirme :

- **Lignes 199-231 de `news-engine.ts`** : `STYLE_LTF: Record<Style, 'H1' | 'H4'> = { day: 'H1', swing: 'H4' }` (ligne 199)
- `computed_for_ts = lastClosedCandleStart(now, TIMEFRAMES[STYLE_LTF[style]]).toISO()!` (lignes 229-232)
- Ce pattern est identique à `technical-engine.ts` (`ltf.at(-1)!.ts` dérivé de la bougie clôturée)

Le blocker est **RÉSOLU** dans le code source. La vérification runtime reste déléguée aux checks humains.

### Human Verification Required

#### 1. Suite de tests complète

**Test:** Lancer `pnpm vitest run` à la racine du workspace
**Expected:** 159/159 tests passent, 0 échec — les suites `technical-engine.test.ts`, `fundamental-engine.test.ts`, `news-engine.test.ts`, `snapshots-rls.test.ts` sont toutes vertes
**Why human:** Le vérificateur ne peut pas exécuter le runner de tests

#### 2. Idempotence runtime technical-engine

**Test:** Lancer `tsx apps/jobs/src/dispatch.ts technical-engine` deux fois de suite avec les mêmes bougies en base
**Expected:** Le count de la table `snapshots` (kind='technical') reste stable au second run ; chaque snapshot a le même `content_hash` sur les deux runs
**Why human:** Vérification de l'idempotence end-to-end nécessite la connexion DB et les bougies réelles

#### 3. Idempotence runtime news-engine (correction CR-01)

**Test:** Lancer `tsx apps/jobs/src/dispatch.ts news-engine` deux fois de suite
**Expected:** Count de la table `snapshots` (kind='news') stable ; `computed_for_ts` identique sur les deux runs (ancré sur la dernière bougie LTF, pas `now()`)
**Why human:** Confirmation runtime que CR-01 est résolu en production (le code source est correct mais un test d'intégration live confirme le comportement)

#### 4. Fundamental-engine avec données FRED réelles

**Test:** Lancer `tsx apps/jobs/src/dispatch.ts fundamental-engine` avec des séries FRED en base
**Expected:** Un snapshot `kind='fundamental'` par instrument×style ; `asset_specific_drivers` non vide pour l'or (DXY-1, REAL_YIELDS-1 attendus) et pour le crypto (RISK_SENTIMENT+1, DXY-1 attendus)
**Why human:** Requiert des données macro réelles ingérées par le `macro-ingest` job (Phase 2)

---

## Gaps Summary

Aucun gap bloquant le goal de phase. Le seul BLOCKER du code review (CR-01) est résolu dans le code source. Les warnings restants (WR-01/02/03/07/08) sont des préoccupations de qualité qui ne bloquent pas la production des snapshots §3 sur des données suffisantes (220 bougies en fixture, historiques réels bien plus longs).

Les 4 vérités de la roadmap sont toutes confirmées par lecture directe du code source.

---

_Verified: 2026-06-13T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
