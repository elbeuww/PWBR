---
phase: 06-canal-telegram-public
plan: 01
subsystem: socle-partagé + formateur Telegram
tags: [telegram, track-record, i18n-ar, bidi, legal, packages-graph]
requires:
  - "@app/core threshold (P5 logique seuil)"
  - "@app/core replay/outcome (enum Outcome D-03)"
  - "vue pattern_stats live (migration 0014, P5)"
provides:
  - "@app/core MIN_SAMPLE/applyThreshold (source unique vitrine ↔ Telegram, D-11)"
  - "@app/supabase getPatternStats + PatternStatRow (repo lecture partagé web+jobs, D-49)"
  - "@app/core formatMessage/escapeHtml (formateur Telegram pur bilingue FR+AR)"
affects:
  - "apps/web track-record (re-export, surface inchangée)"
  - "job Telegram P6 (06-02/06-03) consommera formatMessage + getPatternStats sans toucher apps/web"
tech-stack:
  added: []
  patterns:
    - "extraction socle partagé en packages (core/supabase) + re-export mince côté web (graphe unidirectionnel D-49)"
    - "formateur pur zéro I/O golden-testable ; isolats bidi contrôlés ; escapeHtml systématique"
key-files:
  created:
    - packages/core/src/track-record/threshold.ts
    - packages/core/src/track-record/threshold.test.ts
    - packages/core/src/telegram/format.ts
    - packages/core/src/telegram/format.test.ts
    - packages/supabase/src/repositories/patternStats.ts
  modified:
    - packages/core/src/index.ts
    - packages/supabase/src/index.ts
    - apps/web/src/lib/track-record/threshold.ts
    - apps/web/src/lib/track-record/patternStats.ts
decisions:
  - "D-06-01-A : threshold.ts déplacé tel quel (contenu identique) en @app/core ; web re-exporte. Cohérence stricte vitrine ↔ Telegram (D-11), aucun changement de logique."
  - "D-06-01-B : getPatternStats typé SupabaseClient<Database> générique (anon RSC OU service_role job) — la vue grant SELECT anon+authenticated, service_role bypass. Un seul repo sert les deux appelants."
  - "D-06-01-C : disclaimer FR+AR en constantes dans format.ts (copy P2 identique, sans promesse de gain). Le job @app/core ne peut PAS importer les messages next-intl de apps/web (cross-app interdit, D-49)."
  - "D-06-01-D (Rule 2) : ajout de l'export barrel @app/core pour formatMessage/escapeHtml — non re-listé dans files_modified du plan pour Task 3, mais nécessaire à l'objectif « le job pourra importer sans toucher apps/web »."
metrics:
  duration: ~12 min
  completed: 2026-06-17
  tasks: 3
  files: 9
---

# Phase 06 Plan 01: Socle partagé + formateur Telegram bilingue Summary

Extraction du socle partagé (seuil track record + lecture agrégats) en packages réutilisables par le job Telegram sans franchir la frontière jobs→web (D-49), puis livraison du formateur de message pur bilingue FR+AR — le seul code vraiment neuf de la phase, couvrant TG-02/LEGAL-01/D-03/D-10/D-11 en golden tests.

## What Was Built

### Task 1 — threshold.ts → @app/core (TDD)
`MIN_SAMPLE`/`applyThreshold` + types déplacés en `packages/core/src/track-record/threshold.ts` avec contenu IDENTIQUE à la vitrine (aucun changement de logique, D-11). Barrel core exporte la fonction + les 4 types (suffixe `.js`). `apps/web/src/lib/track-record/threshold.ts` devient un re-export mince depuis `@app/core` (surface d'import inchangée pour les composants P5). Test golden core 8 cas vert.

### Task 2 — getPatternStats → @app/supabase
`getPatternStats(client: SupabaseClient<Database>)` porté en `packages/supabase/src/repositories/patternStats.ts` avec le SELECT EXACT `'dimension, bucket, period, n, win_rate, avg_r, expectancy'` sur `pattern_stats`, interface `PatternStatRow` (tous champs nullable), jamais de throw. Barrel `@app/supabase` exporte `getPatternStats` + `PatternStatRow` (service-client toujours sous garde D-07). Web re-câblé en re-export mince. Suite P5 non régressée.

### Task 3 — formatMessage pur bilingue FR+AR (TDD)
`packages/core/src/telegram/format.ts` : `formatMessage(input)` pur zéro I/O → string HTML unique (parse_mode HTML). Bloc FR (LTR) en haut, séparateur, bloc AR (RTL, lignes préfixées U+200F) en bas. `escapeHtml` ordre `& < >` sur toute donnée dynamique (T-06-INJ). Segments ticker/R/% isolés `U+2066…U+2069` (T-06-BIDI). Bloc win rate via `applyThreshold` (même seuil que la vitrine, TG-02/D-11). Disclaimer FR+AR dans chaque sortie (LEGAL-01). Type `FormatTrade` limité à symbol+direction+outcome+realized_r — entry/SL/TP n'entrent jamais (D-03/T-06-LEAK). Jour vide D-10 (« Aucun trade » FR + AR). Cap : top-10 par |R| + « +X autres », sortie < 4096 (Pitfall 3). 11 tests golden verts.

## Deviations from Plan

### Auto-fixed / additions

**1. [Rule 2 - Missing surface] Export barrel core de formatMessage**
- **Found during:** Task 3
- **Issue:** Les acceptance Task 3 n'exigent que `format.ts` exporte `formatMessage`/`escapeHtml`, mais l'objectif (« le job pourra importer ») suppose un export depuis le barrel `@app/core`.
- **Fix:** Ajout `export { formatMessage, escapeHtml }` + types dans `packages/core/src/index.ts`.
- **Files modified:** packages/core/src/index.ts
- **Commit:** 28d8800

Disclaimer copy : réutilisée de P2 (`disclaimer.footer` fr/ar) en constantes locales — le job en `@app/core` ne peut pas importer les messages next-intl de `apps/web` (D-49). Copy alignée P2, sans promesse de gain (LEGAL-01).

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-06-LEAK | `FormatTrade` n'accepte jamais entry/SL/TP ; test grep absence niveaux (0) |
| T-06-INJ | `escapeHtml` ordre `& < >` sur toute donnée dynamique ; test symbol HTML injecté échappé |
| T-06-BIDI | Seuls isolats contrôlés U+2066/U+2069/U+200F injectés (jamais de bidi externe) |
| T-06-LEGAL | Disclaimer FR+AR golden-testé présent dans chaque sortie |
| T-06-INVENT | `applyThreshold` partagé — jamais de % sous N<30, source unique avec la vitrine |

## Verification

- `npx vitest run` : 53 fichiers, 401 tests passés (dont core threshold 8 + format 11 ; P5 non régressée).
- `pnpm typecheck` : `tsc -b --noEmit` 0 erreur (baseline forbidden-service-import.ts non ressortie).
- Acceptance par tâche : threshold.test.ts exit 0 ; format.test.ts exit 0 ; grep niveaux dans format.ts == 0.

## TDD Gate Compliance

Tasks 1 et 3 (tdd="true") : test golden écrit puis vu échouer (RED Task 3 confirmé « no tests / module absent ») avant implémentation, puis vert (GREEN). Task 1 portée depuis le test existant vitrine, vert immédiat (logique identique, déplacement pur).

## Self-Check: PASSED
- packages/core/src/track-record/threshold.ts — FOUND
- packages/core/src/telegram/format.ts — FOUND
- packages/supabase/src/repositories/patternStats.ts — FOUND
- Commits 9757fdf, 882915d, 28d8800 — present in git log
