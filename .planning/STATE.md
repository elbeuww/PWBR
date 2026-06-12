---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-06-12T15:30:00.000Z"
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
  percent: 67
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
Plan: 2 of 3
**Phase:** 1 — Fondations & Sécurité
**Plan:** 01-02 COMPLETE (2026-06-12) — AUTH-01/02/03 GREEN. Next : plan 01-03 (jobs)
**Status:** Executing Phase 01

**Progress:** [          ] 0/9 phases complete (2/3 plans phase 01)

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
- D-14 (2026-06-12) : **Vision élargie v1.1** — abonnement 9 $/mois, Telegram public (1 signal/j) + privé (résumé abonnés), actions ajoutées, scalping confirmé (en dernier). Phases 1-9 inchangées ; extension en phases 10-13 (voir ROADMAP « Scope Update » + REQUIREMENTS v1.1 : DIST/MON/STOCK/PATT/RT).
- D-15 : % de réussite des patterns chartiques = mesuré par notre backtest (PATT-02), jamais affirmé sans données. Revue légale AMF/MiFID II obligatoire avant d'encaisser le premier abonnement.
- D-16 (2026-06-12) : Turbopack obligatoire pour apps/web (`next dev/build --turbopack`) — webpack interdit le `!` du chemin projet. `turbopack.root` + `outputFileTracingRoot` fixés (package-lock.json parasite dans le HOME). `packages/supabase` en moduleResolution Bundler (imports relatifs sans `.js` — Turbopack ne résout pas l'aliasing NodeNext dans les packages workspace).
- D-17 (2026-06-12) : MCP Supabase projet (`.mcp.json`, OAuth) opérationnel — migrations via `apply_migration`, types via `generate_typescript_types`, gate sécurité via `get_advisors` (0 alerte après migration 0002 revoke execute). Emails de test = `@gmail.com` uniques (Supabase Auth rejette example.com), cleanup via SQL service.

### Open todos / risques à lever

- **Phase 1 (research flag):** vérifier le modèle d'exécution réel des Routines Claude Code (cloud, quota ~15 runs/j Max, secrets, MCP cloud-hosted). Prévoir fallback Windows Task Scheduler pour INGEST+SNAPSHOT. Dépendance externe la plus incertaine.
- **Phase 1:** verrouiller la convention daily cross-asset (OANDA 17:00 NY vs Binance 00:00 UTC) + convention de bougie clôturée (anti look-ahead).
- **Phase 3 (research flag):** concevoir et tester la détection de structure de marché maison (HH/HL, BOS/CHoCH, swings, POC) — absente des libs.
- **Phase 4 (research flag):** point à plus haut risque — robustesse prompt vétéran, taux de rejet Zod, méthode de scoring. À itérer.
- **Phase 9 (research flag):** méthode de calibration (isotonic/Platt) et seuil d'échantillon minimal.
- **Phase 12 (research flag, v1.1):** source de données actions — Finnhub free n'offre plus les candles actions ; évaluer Alpha Vantage / Twelve Data / Polygon (tiers gratuits + rate limits).
- **Phase 11 (porte légale, v1.1):** revue « conseil en investissement » AMF/MiFID II avant d'encaisser le premier abonnement (vendre des signaux à des tiers ≠ outil perso).
- **Bloquants v2 (hors roadmap actuelle):** calibration prouvée + revue juridique MiFID II/AMF + licences de redistribution des données.

### Blockers

Aucun.

## Session Continuity

**Last session:** 2026-06-12 — plan 01-02 terminé (checkpoints levés via MCP Supabase, RLS 6/6, E2E 5/5, lint AUTH-03 OK, advisors 0 alerte).

**Next action:** Exécuter le plan `01-03` (jobs : runJob/job_runs via service_role + dispatcher Windows Task Scheduler) — `/gsd-execute-phase 1`.

**Notes pour la session suivante:** `apps/jobs/.env` est rempli (URL + service_role). Le MCP Supabase projet est connecté (ré-authentifier via /mcp si le token expire). Lancer le dev web avec `pnpm dev` (Turbopack, D-16).

---
*State initialized: 2026-06-09*
