# Architecture — Plateforme d'Analyse de Trading "Vétéran"

> Greenfield. Stack : Next.js + Supabase + Claude Max (routines planifiées, **pas de clé API en Phase 1**).
> Marchés MVP : crypto (Binance testnet), forex + XAU + XAG + WTI/Brent (OANDA démo). Styles : Day + Swing (H1 → Daily).
> Capital 500 $, démarrage démo. Perso → communauté.

## 1. Vue d'ensemble — Flux de données

```
SOURCES EXTERNES
 OANDA (FX/métaux/énergie)  Binance testnet (crypto)
 Finnhub/Marketaux (news+sentiment)   FRED (macro)
        │ candles OHLCV   │ articles+sent   │ macro series
        ▼
COUCHE INGESTION (scripts Node/TS lancés par la routine)
 • market-ingest : OHLCV multi-TF → normalise UTC → upsert candles
 • news-ingest   : articles + sentiment → dédoublonne → insert news
 • macro-ingest  : FRED → upsert macro_series
        │ écrit (client JS Supabase service_role)
        ▼
SUPABASE (Postgres)
 instruments · candles · news · macro_series · analyses · trade_setups
 journal · backtests · prediction_outcomes · users · community_*
 + Auth + Realtime + Storage
   ▲ lit candles/news/macro    │ écrit analyses + trade_setups + scoring
   │                           ▼
MOTEUR D'ANALYSE "VÉTÉRAN" (Claude Code scheduled agent, forfait Max)
 A. pré-calc indicateurs (technicalindicators, déterministe, Node)
 B. Claude raisonne comme trader 50 ans → technique+fondamental+news
 C. produit JSON structuré (score/100, risque, R:R, raisons)
 D. persiste via MCP Supabase / client JS
        │
        ▼
FRONTEND Next.js (App Router)
 • Dashboard opportunités (tri par score)  • Détail trade (chart+raisons)
 • Journal & feedback  • Backtest viewer  • Realtime (nouvelles analyses)
        ▼
   UTILISATEUR
```

**Principe clé** : le backend Next.js n'appelle JAMAIS Claude en Phase 1. Il lit seulement Supabase. C'est la routine planifiée (agent Claude Code sous Max) qui produit l'intelligence et persiste. Next.js = couche lecture + realtime.

## 2. Découpage en composants / modules

Monorepo pnpm, beaucoup de petits fichiers (200-400 lignes), haute cohésion :

```
/apps/web              → Next.js (front + lecture Supabase)
/apps/jobs             → scripts TS lancés par les routines planifiées
/packages/core         → types partagés, schémas Zod, constantes
/packages/data-sources → clients OANDA/Binance/Finnhub/FRED
/packages/indicators   → wrappers technicalindicators (déterministe)
/packages/supabase     → client typé, repositories, migrations
/agents                → prompts + définitions des routines Claude
/supabase/migrations   → SQL versionné
```

| Module | Responsabilité | Entrées | Sorties |
|--------|----------------|---------|---------|
| market-ingest | Pull OHLCV multi-TF (H1,H4,D), normalise UTC, upsert idempotent | OANDA/Binance | `candles` |
| news-ingest | Pull articles+sentiment, dédoublonne (hash url+titre), mappe instrument | Finnhub/Marketaux | `news` |
| macro-ingest | Pull séries macro (taux, CPI, DXY) | FRED | `macro_series` |
| technical-engine | Calcul déterministe indicateurs (RSI, MACD, EMA, ATR, Bollinger, structure HH/HL, S/R, volume) — PAS d'IA | `candles` | `technical_snapshot` |
| fundamental-engine | Agrège macro + calendrier éco + biais directionnel par actif | `macro_series` | `fundamental_context` |
| news-engine | Score sentiment net, catalyseurs récents/à venir par actif | `news` | `news_context` |
| veteran-analyzer | Claude combine les 3 contextes → raisonnement trader → JSON | snapshots | `analyses`+`trade_setups` |
| scoring-aggregator | Garde-fous déterministes post-IA (clamp R:R, cohérence SL/TP, filtre seuil) | sortie IA | setups validés |
| persistence | Repositories typés, upsert idempotent, RLS | tous | Supabase |
| dashboard (web) | Opportunités triées par score, détail trade, charts | Supabase read | UI |
| journal-feedback | Logger trades pris, comparer prédiction vs réel | user+setups | `journal`,`prediction_outcomes` |
| backtest | Rejoue analyses passées sur candles, calcule métriques | `analyses`+`candles` | `backtests` |

**Séparation critique : technique = déterministe (code), PAS Claude.** Claude lit le snapshot déjà calculé. Évite l'hallucination de chiffres d'indicateurs et économise les tokens. Claude fait le raisonnement/synthèse, pas l'arithmétique.

## 3. Moteur d'analyse "vétéran"

### Philosophie
Un trader de 50 ans ne trade pas un signal isolé. Il empile des **confluences** : structure de marché + tendance HTF + niveau clé + momentum + contexte macro + absence de catalyseur news contraire. Le score reflète la **qualité de la confluence**, pas la force d'un indicateur unique. Le risque reflète la **probabilité d'invalidation** et le contexte (volatilité, news imminente, session).

### Entrées (assemblées par code AVANT Claude)
```
technical_snapshot {
  trend_htf: bullish|bearish|range  (Daily/H4 structure + EMA200)
  trend_ltf: ...                    (H1)
  momentum:  { rsi, macd_hist, slope }
  volatility:{ atr, atr_percentile }
  key_levels:[ {price, type:support|resistance|poc, strength} ]
  structure: { last_swing_high, last_swing_low, bos|choch }
  volume_state: expanding|contracting
}
fundamental_context {
  macro_bias: risk_on|risk_off|neutral
  rate_environment: hawkish|dovish|neutral
  dxy_trend, real_yields, asset_specific_drivers[]
}
news_context {
  net_sentiment: -1..+1
  recent_catalysts:[ {headline, ts, impact, direction} ]
  upcoming_events:[ {event, ts, expected_impact} ]  (calendrier éco)
}
```

### Pondération → note /100

| Bloc | Poids day | Poids swing | Logique |
|------|-----------|-------------|---------|
| Alignement tendance HTF/LTF | 25 | 30 | Aligné = plein, contre-tendance = 0 |
| Confluence niveau clé (entrée près S/R fort) | 20 | 20 | Proximité + force |
| Momentum confirmant | 15 | 10 | RSI/MACD dans le sens |
| Contexte fondamental aligné | 15 | 20 | macro/taux dans le sens |
| Sentiment news aligné / pas de contradiction | 10 | 10 | net_sentiment cohérent |
| Qualité R:R (≥1.5 day, ≥2 swing) | 15 | 10 | R:R faible = pénalité |
| **Pénalités** | — | — | News high-impact imminente (-15), volatilité extrême (-10), structure cassée contre le trade (rejet) |

Règles dures (avant scoring fin) :
- R:R < 1.2 → setup rejeté (non écrit).
- Trend HTF contredit franchement la direction ET pas de catalyseur fort → cap score à 45.
- Event high-impact dans <2h (day) / <24h (swing) → flag `news_risk` + risque relevé.

### Score de risque (SÉPARÉ du score d'opportunité)
`risk_level ∈ {low, medium, high, extreme}` dérivé de : distance SL en ATR (trop serré = high), volatilité percentile, news imminente, liquidité de session, contre-tendance HTF. Le **sizing** en découle : risque fixe par trade (1-2 % du capital), taille = risque$ / (distance SL × valeur pip).

### Schéma de sortie JSON (produit par la routine Claude)
```json
{
  "schema_version": "1.0",
  "generated_at": "2026-06-09T07:00:00Z",
  "session": "london",
  "style": "day",
  "instrument": "XAU_USD",
  "direction": "long",
  "opportunity_score": 78,
  "risk_level": "medium",
  "confidence": "moderate",
  "timeframe_analysis": "Daily haussier, H4 pullback sur support, H1 momentum repart",
  "entry": { "type": "limit", "price": 2318.50, "zone": [2316.0, 2320.0] },
  "stop_loss": 2305.00,
  "take_profits": [
    { "price": 2335.0, "alloc_pct": 50, "rr": 1.2 },
    { "price": 2352.0, "alloc_pct": 50, "rr": 2.5 }
  ],
  "risk_reward": 1.85,
  "atr_distance_sl": 1.3,
  "technical_reasons": [
    "Daily en HH/HL, prix au-dessus EMA200",
    "Rejet du support H4 2316 (POC volume)",
    "MACD H1 croisement haussier, RSI 47 sortant de survente"
  ],
  "fundamental_reasons": [
    "DXY en repli, real yields baissent → favorable à l'or",
    "Biais risk-off léger soutient la demande de valeur refuge"
  ],
  "news_catalysts": [
    { "headline": "Fed minutes dovish", "impact": "high", "direction": "bullish", "ts": "2026-06-08T18:00:00Z" }
  ],
  "upcoming_risk_events": [
    { "event": "US CPI", "ts": "2026-06-10T12:30:00Z", "note": "réduire/clôturer avant" }
  ],
  "invalidation": "Clôture H4 sous 2305 = thèse invalidée (perte de structure)",
  "veteran_note": "Pullback propre dans une tendance saine. Je ne chasse pas, j'attends le retest. CPI dans 2 jours : ne pas surexposer.",
  "raw_indicators_ref": "hash du snapshot utilisé"
}
```
Validé par Zod côté `scoring-aggregator` avant insertion. JSON non conforme = rejeté + loggé.

## 4. Schéma Supabase

Convention : `snake_case`, PK `id uuid default gen_random_uuid()`, timestamps UTC.

- **`instruments`** — symbol (unique, `XAU_USD`/`BTCUSDT`), broker (oanda|binance), asset_class (crypto|forex|metal|energy), display_name, pip_size, min_size, precision, active. *RLS : lecture authenticated, écriture service_role.*
- **`candles`** — instrument_id FK, timeframe (H1|H4|D), ts, OHLCV. Index **unique (instrument_id, timeframe, ts)** ; index `(instrument_id, timeframe, ts desc)`. *RLS lecture authenticated, écriture service_role.*
- **`news`** — source, url_hash (unique), title, summary, published_at, sentiment (-1..1), impact, instrument_ids uuid[]. *RLS lecture authenticated.*
- **`macro_series`** — series_code (FRED), ts, value. Unique (series_code, ts). *RLS lecture authenticated.*
- **`analyses`** — run_id, session, style, instrument_id FK, snapshot jsonb (traçabilité), model, created_at. *RLS lecture owner/communauté (P2), écriture service_role.*
- **`trade_setups`** — analysis_id FK, instrument_id FK, direction, opportunity_score int (indexé), risk_level, entry_price, stop_loss, take_profits jsonb, risk_reward, payload jsonb (JSON §3), status (active|invalidated|expired), valid_until. Index `(opportunity_score desc, created_at desc)`. *RLS lecture authenticated/communauté.*
- **`journal`** — user_id FK, trade_setup_id FK nullable, instrument_id FK, direction, entry/exit/sl, size, account_type (demo|live), opened_at, closed_at, pnl, pnl_pct, r_multiple, outcome, notes. **RLS strict `user_id = auth.uid()`.**
- **`prediction_outcomes`** — trade_setup_id FK, predicted_direction, predicted_score, hit_tp, hit_sl, realized_r, evaluated_at, evaluation_window. *RLS lecture authenticated.*
- **`backtests`** — name, params jsonb, metrics jsonb (win_rate, expectancy, profit_factor, max_dd), equity_curve jsonb. *RLS lecture authenticated.*
- **`job_runs`** — job_name, status, started_at, finished_at, error, stats jsonb (monitoring).
- **Communauté (P2)** — `profiles`, `community_follows`, `community_comments`, `community_watchlists`, `subscriptions` (Stripe).

## 5. Routines planifiées (forfait Max, sans clé API)

Claude Code (app Windows) supporte des **scheduled agents** (prompt + outils MCP Supabase + exécution scripts Node). Le forfait **Max** couvre l'usage. La routine N'UTILISE PAS la clé API : l'agent Claude Code « est » le modèle.

Anatomie d'un job :
```
1. INGEST  → node apps/jobs/ingest.ts <session>   (pull → upsert candles/news/macro, client service_role)
2. PREP    → node apps/jobs/snapshot.ts <session> (technical_snapshot déterministe + contextes)
3. ANALYZE → l'agent LIT les snapshots et RAISONNE (cœur Claude) → JSON §3 par instrument×style
4. PERSIST → MCP Supabase (insert analyses + trade_setups) ou node apps/jobs/persist.ts (Zod + upsert)
```
Clés brokers/news + service_role en `.env` côté scripts Node. Claude n'a jamais besoin de la clé API Anthropic.

Horaires (UTC) :
| Job | Cron UTC | Couvre |
|-----|----------|--------|
| session-asia | `00 23 * * 0-4` | Tokyo/Sydney — JPY, AUD, crypto, or |
| session-london | `00 07 * * 1-5` | Londres — EUR/GBP, métaux, énergie, swing daily |
| session-newyork | `30 12 * * 1-5` | NY + macro US — USD, or, WTI, crypto |
| eod-swing | `00 21 * * 1-5` | Clôture daily → réévalue swing |
| outcome-eval | `00 22 * * *` | Évalue prediction_outcomes |
| weekly-backtest | `00 06 * * 6` | Backtest agrégé hebdo |

Crypto = 24/7 (chaque session). Robustesse : scripts idempotents, `job_runs` monitoré, sources en échec → `stale`, Windows Task Scheduler en backup ingestion.

## 6. Boucle d'apprentissage / feedback

- Chaque `trade_setup` = prédiction horodatée. Job `outcome-eval` rejoue les candles : TP avant SL → `hit_tp`/`realized_r` ; SL avant → `hit_sl`/R≈-1 ; sinon expiré. Écrit `prediction_outcomes` (mesure le **modèle**, indépendant de l'exécution user).
- `journal` = trades réels de l'utilisateur (mesure l'**exécution** : slippage, discipline).
- Métriques : win rate par bucket de score (**calibration**), expectancy, profit factor, R moyen, max DD, précision par actif/session/style, écart modèle vs exécution.
- Backtest `weekly` rejoue les analyses historiques. **Anti-surajustement** : walk-forward, out-of-sample, pas de ré-optimisation a posteriori.
- Sizing : risque fixe (1 % de 500 $ = 5 $), taille = risque$ / (distance SL × valeur pip), modulé par `risk_level`.

## 7. Roadmap technique

**Phase 0 — Fondations** : monorepo pnpm, `core` (types+Zod), client Supabase typé, migrations + RLS de base, clients data-sources (OANDA/Binance/Finnhub/FRED), `ingest.ts` pilote, Next.js squelette + auth.

**Phase 1 — MVP Day/Swing (perso, démo)** : technical/fundamental/news engines, routines Claude (asia/london/newyork), scoring-aggregator + Zod + garde-fous, dashboard (tri score, filtres), détail trade (lightweight-charts + SL/TP + raisons), journal + sizing calculator, outcome-eval + weekly-backtest + page métriques, realtime, disclaimers.

**Phase 2 — Scalping + communauté + API + monétisation** : clé API Anthropic (analyses live à la demande), scalping M1/streaming (websockets), communauté (profiles/follows/commentaires/watchlists/leaderboard), Stripe (tiers free/pro), alertes (email/push/Telegram), scale (Upstash Redis, CDN).

## 8. Risques + gestion

| Risque | Mitigation |
|--------|------------|
| Rate limits API (free) | Backoff (p-retry) + cache + p-limit, espacer jobs, pull ciblé |
| Fraîcheur données | Champ `ts` + flag `stale`, refus d'analyse si candle trop vieille |
| Routines (PC éteint) | `job_runs` monitoré, Windows Task Scheduler backup, idempotence |
| Sur-ajustement backtest | Walk-forward, out-of-sample, calibration par bucket |
| Hallucination chiffres Claude | Indicateurs calculés en code, Claude raisonne seulement, Zod + garde-fous |
| Dérive schéma JSON | `schema_version` + Zod strict, rejet+log |
| Conseil financier (légal) | Disclaimers "éducatif, pas un conseil", aucune promesse de gain |
| Sécurité clés broker | Démo/testnet d'abord, `.env` non commitées, service_role jamais exposé au front |
| RLS mal configurée | journal strict `user_id=auth.uid()`, tests RLS, service_role réservé aux jobs |
| Petit capital 500 $ | Risque fixe ≤1-2 %/trade codé en dur, démo obligatoire avant live, alerte sizing |

## 9. Stack technique

**Frontend** : Next.js 15 (App Router, RSC) + TS ; Tailwind + shadcn/ui ; **lightweight-charts** (TradingView OSS) ; `@supabase/ssr` + `@supabase/supabase-js` (auth, realtime) ; `@tanstack/react-query` ; zod ; recharts (equity/calibration).

**Jobs/moteur** : TS + tsx ; **technicalindicators** ; clients OANDA REST v20 / `binance` (ou ccxt futur) / `finnhub` / FRED ; zod ; `@supabase/supabase-js` **service_role** (jobs only) ; date-fns/luxon (UTC/sessions) ; **p-retry** + **p-limit** ; pino → `job_runs`.

**Infra/outillage** : Supabase (Postgres+Auth+Realtime+RLS) ; migrations SQL versionnées (CLI Supabase) ; Claude Code scheduled agents (Max) + Windows Task Scheduler backup ; pnpm workspaces ; ESLint+Prettier+TS strict ; Vitest (unit, 80 %) + Playwright (E2E) ; GitHub Actions.

## Principes transverses
- **Déterminisme d'abord** : indicateurs, R:R, sizing, outcome-eval calculés en code. Claude = raisonnement uniquement.
- **Idempotence** : upserts sur clés uniques, re-run sûr.
- **Immutabilité** : analyses/setups jamais mutés ; nouvelle version + ancien marqué `expired`/`invalidated`.
- **Traçabilité** : chaque analyse stocke le `snapshot` exact utilisé.
- **Sécurité par défaut** : RLS stricte, service_role isolé aux jobs, démo/testnet avant capital réel.
