---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-06-10T02:10:00.000Z"
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 3
  completed_plans: 1
  percent: 3
---

# Project State

**Project:** Plateforme d'Analyse de Trading "Vétéran"
**Last updated:** 2026-06-09

## Project Reference

**Core value:** Produire, pour chaque opportunité, une analyse fiable et explicable — score /100 + niveau de risque + plan de trade (entrée/SL/TP/R:R) — qui aide à décider avec discipline.
**Current focus:** Phase 01 — fondations-s-curit
**Mode:** mvp (Vertical MVP)
**Granularity:** fine (9 phases)

## Current Position

Phase: 01 (fondations-s-curit) — EXECUTING
Plan: 2 of 3 (01-01 COMPLETE)
**Phase:** 1 — Fondations & Sécurité
**Plan:** 01-01 COMPLETE — proceeding to 01-02 (Auth + RLS)
**Status:** Executing Phase 01

**Progress:** [          ] 0/9 phases complete (1/3 plans phase 01)

```
Phase 1  [ ] Fondations & Sécurité          ← next
Phase 2  [ ] Ingestion fiable des données
Phase 3  [ ] Moteur d'analyse déterministe
Phase 4  [ ] Moteur IA "vétéran" & scoring
Phase 5  [ ] Dashboard des opportunités
Phase 6  [ ] Détail trade & charting
Phase 7  [ ] Risque & dimensionnement
Phase 8  [ ] Journal & boucle de feedback
Phase 9  [ ] Backtest & calibration
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 0/9 |
| Plans complete | 0 |
| Requirements covered | 0/44 (planned) |

## Accumulated Context

### Decisions

- Forfait Claude Max + routines planifiées (pas de clé API) en Phase 1 ; backend Next.js lit seulement Supabase.
- Marchés : crypto + forex + or/argent/pétrole (pas d'actions). Styles Day + Swing en MVP, scalping en v2.
- Indicateurs/R:R/sizing/outcomes calculés en code déterministe ; Claude raisonne uniquement.
- Single-writer / backend read-only ; Supabase = unique frontière producteur/consommateur (rend la v2 streaming additive).
- Démarrage compte démo/testnet obligatoire avant capital réel.
- D-07 : ESLint no-restricted-imports posée avant création du module service_role (plan 02) — barrière lint-time préventive dans apps/web.
- D-09 : DAILY_ANCHOR.oanda = { zone: America/New_York, hour: 17 } / binance = { zone: UTC, hour: 0 } — convention daily cross-asset verrouillée dans packages/core.
- D-10 : lastClosedCandleStart via floor(epoch/tf)-1 — borne haute exclusive, anti look-ahead garanti (DATA-05 satisfait).
- D-11 : Strict skeleton 4 packages — apps/web, apps/jobs, packages/core, packages/supabase déclarés ; data-sources/indicators en phases ultérieures.
- D-12 : .env.example commité sans secret (4 clés vides), .gitignore exclut .env/.env.local.
- D-13 : Vitest + Playwright configurés racine ; golden values DATA-05 vertes (16/16).

### Open todos / risques à lever

- **Phase 1 (research flag):** vérifier le modèle d'exécution réel des Routines Claude Code (cloud, quota ~15 runs/j Max, secrets, MCP cloud-hosted). Prévoir fallback Windows Task Scheduler pour INGEST+SNAPSHOT. Dépendance externe la plus incertaine.
- **Phase 1:** verrouiller la convention daily cross-asset (OANDA 17:00 NY vs Binance 00:00 UTC) + convention de bougie clôturée (anti look-ahead).
- **Phase 3 (research flag):** concevoir et tester la détection de structure de marché maison (HH/HL, BOS/CHoCH, swings, POC) — absente des libs.
- **Phase 4 (research flag):** point à plus haut risque — robustesse prompt vétéran, taux de rejet Zod, méthode de scoring. À itérer.
- **Phase 9 (research flag):** méthode de calibration (isotonic/Platt) et seuil d'échantillon minimal.
- **Bloquants v2 (hors roadmap actuelle):** calibration prouvée + revue juridique MiFID II/AMF + licences de redistribution des données.

### Blockers

- None.

## Session Continuity

**Next action:** Exécuter le plan `01-02` (Auth + RLS Supabase) — le workspace est prêt, l'infra de test est posée.

**Notes pour la session suivante:** Plan 01-01 COMPLET. Les 3 verrous temporels (D-09/D-10/D-11) sont résolus. Prochain verrou critique = sécurité RLS/service_role (plan 01-02). La règle ESLint anti-service_role est déjà posée dans eslint.config.mjs — le plan 02 crée le module interdit et doit faire passer les tests RLS.

---
*State initialized: 2026-06-09*
