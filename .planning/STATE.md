---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Roadmap créée, en attente de planification de la Phase 1
last_updated: "2026-06-09T16:07:41.459Z"
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

**Project:** Plateforme d'Analyse de Trading "Vétéran"
**Last updated:** 2026-06-09

## Project Reference

**Core value:** Produire, pour chaque opportunité, une analyse fiable et explicable — score /100 + niveau de risque + plan de trade (entrée/SL/TP/R:R) — qui aide à décider avec discipline.
**Current focus:** Phase 1 — Fondations & Sécurité
**Mode:** mvp (Vertical MVP)
**Granularity:** fine (9 phases)

## Current Position

**Phase:** 1 — Fondations & Sécurité
**Plan:** Not yet planned
**Status:** Roadmap créée, en attente de planification de la Phase 1

**Progress:** [          ] 0/9 phases complete

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

**Next action:** `/gsd:plan-phase 1` pour décomposer la Phase 1 (Fondations & Sécurité) en plans exécutables.

**Notes pour la session suivante:** La Phase 1 porte 3 verrous critiques (sécurité RLS/service_role, conventions temporelles, modèle d'exécution Routines Claude). Ne pas écrire de prompt IA avant que ces verrous soient posés. Le frontend lecture (Phases 5-6) est parallélisable tôt dès que le schéma `trade_setups` est figé (config parallelization=true).

---
*State initialized: 2026-06-09*
