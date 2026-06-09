# Plateforme d'Analyse de Trading "Vétéran"

## What This Is

Plateforme d'analyse de trading qui combine analyse chartique (technique) et analyse fondamentale + news pour identifier des opportunités, noter chaque trade sur 100, évaluer son risque, et proposer entrée / stop-loss / take-profits / ratio R:R avec un raisonnement explicite. L'IA se comporte comme un trader vétéran (50 ans d'expérience). D'abord outil personnel (capital réel 500 $, démarrage sur compte démo), puis partagé avec une communauté. Utilisateur de niveau intermédiaire.

## Core Value

Produire, pour chaque opportunité, une analyse fiable et explicable — score /100 + niveau de risque + plan de trade (entrée/SL/TP/R:R) — qui aide à décider avec discipline. Si tout le reste échoue, **la qualité et la traçabilité de l'analyse d'un trade** doit fonctionner.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Ingestion des données marché OHLCV multi-timeframes (H1/H4/Daily) pour crypto (Binance) + forex/or/argent/pétrole (OANDA)
- [ ] Ingestion des news + sentiment (Finnhub/Marketaux) et macro (FRED)
- [ ] Moteur d'indicateurs techniques déterministe (RSI, MACD, EMA, ATR, Bollinger, structure de marché, S/R)
- [ ] Moteur d'analyse "vétéran" (routine planifiée Claude Max) produisant un JSON structuré par trade (score/100, risque, entrée, SL, TP, R:R, raisons techniques/fondamentales/news, invalidation)
- [ ] Persistance des analyses + setups dans Supabase avec validation Zod et garde-fous déterministes
- [ ] Dashboard Next.js : liste des opportunités triées par score, filtres (actif, style, risque)
- [ ] Vue détail d'un trade : chart (lightweight-charts) + niveaux SL/TP + raisonnement + note du vétéran
- [ ] Routines planifiées aux ouvertures de marché (Asie/Londres/New York) + EOD swing
- [ ] Journal de trading (trades réels de l'utilisateur, demo/live) + calculateur de sizing (risque fixe 1-2 %)
- [ ] Boucle d'apprentissage : évaluation prédiction vs résultat (prediction_outcomes) + backtest hebdo + métriques (win rate, calibration du score, expectancy)
- [ ] Disclaimers conseil financier (éducatif, pas un conseil)

### Out of Scope

- Actions / equities — non couvertes en MVP (focus crypto + forex + commodités)
- Scalping / temps réel (M1, websockets) — reporté en Phase 2 (infra temps réel plus lourde)
- Clé API Anthropic / analyses live à la demande — reporté en Phase 2 (Phase 1 = forfait Max + routines planifiées, coût zéro)
- Communauté (profils, follows, commentaires, leaderboard) + monétisation Stripe — reporté en Phase 2
- Exécution automatique des trades (passage d'ordres) — hors scope (outil d'aide à la décision, pas de bot d'exécution)

## Context

- **Fondateur** : Borhane, développeur (maîtrise Next.js + Supabase, plusieurs projets e-commerce existants). Niveau trading intermédiaire (connaît chandeliers, S/R, gestion du risque).
- **Capital** : 500 $. Démarrage obligatoire sur compte démo/testnet avant tout capital réel. Apprentissage durant la phase démo via la boucle de feedback.
- **Forfait Claude Max** disponible → permet de faire tourner des routines/agents planifiés sans coût par token. L'app Claude Code tourne sur Windows.
- **MCP Supabase déjà connecté.**
- **Architecture détaillée** : voir `ARCHITECTURE.md` à la racine du projet (flux de données, schéma Supabase, moteur de scoring, JSON de sortie, cron des routines, boucle d'apprentissage, stack).
- **Principe clé** : le backend Next.js ne fait que lire Supabase en Phase 1 ; c'est la routine planifiée (agent Claude Code sous Max) qui produit l'intelligence et persiste. Les indicateurs sont calculés en code (déterministe) — Claude raisonne, n'invente pas les chiffres.

## Constraints

- **Tech stack**: Next.js 15 + Supabase (Postgres/Auth/Realtime/RLS) — réutilise les compétences existantes du fondateur.
- **Budget**: Phase 1 à coût quasi nul — sources de données gratuites (testnet/démo), pas de clé API Anthropic (forfait Max + routines).
- **Données**: OANDA (forex/métaux/énergie), Binance (crypto), Finnhub/Marketaux (news), FRED (macro). Tiers gratuits → gérer les rate limits.
- **Sécurité**: démo/testnet d'abord (pas de fonds réels), clés en `.env` non commitées, service_role réservé aux jobs, RLS stricte (journal privé).
- **Légal**: contenu éducatif, disclaimers explicites, aucune promesse de gain (responsabilité communauté).
- **Robustesse routines**: PC potentiellement éteint → jobs idempotents + monitoring `job_runs` + Windows Task Scheduler en backup.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Forfait Max + routines planifiées (pas de clé API) en Phase 1 | Coût zéro, backend ne fait que lire Supabase | — Pending |
| Marchés : crypto + forex + or/argent/pétrole (pas d'actions) | Adapté à 500 $, sources gratuites, 24/7 crypto | — Pending |
| Styles Day + Swing en MVP, scalping en Phase 2 | Swing/Day partagent le même moteur ; scalping = temps réel coûteux | — Pending |
| Indicateurs calculés en code (déterministe), Claude raisonne seulement | Évite l'hallucination de chiffres, économise les tokens | — Pending |
| Stack Next.js + Supabase | Réutilise les compétences du fondateur, MCP déjà connecté | — Pending |
| Démarrage compte démo obligatoire avant capital réel | Apprentissage sans risque, boucle de feedback | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-09 after initialization*
