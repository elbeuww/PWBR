---
phase: 11-composants-nexa-reskin-transversal-rebranding
plan: 01
subsystem: design-system
tags: [tokens, css, oklch, design-system, nexa]
requires:
  - "globals.css 3-couches (primitive -> semantic -> component) verrouillée Phase 10"
provides:
  - "token component --color-accent-brand (purple accent, flippe clair/sombre)"
  - "token component --color-risk-moderate (amber risque modéré, teinte unique aux 2 thèmes)"
  - "primitive --nexa-amber-500 (hue 70)"
affects:
  - "Wave 2 : Eyebrow / ScoreRing / ExpiryBanner peuvent consommer ces tokens sans primitive en dur"
tech_stack:
  added: []
  patterns:
    - "var()-only hors couche 1 : aucun littéral OKLCH/HEX dans :root/.dark/@theme inline"
    - "token signal-like (teinte constante) non redéclaré en .dark (cf. --signal-*)"
key_files:
  created: []
  modified:
    - apps/web/src/styles/globals.css
decisions:
  - "D-11-01-A"
  - "D-11-01-B"
metrics:
  duration: "~5 min"
  completed: "2026-06-21"
  tasks: 2
  files: 1
requirements: [DESIGN-05]
---

# Phase 11 Plan 01 : Tokens component purple accent & amber risque Summary

Ajout en 3 couches de 2 familles de tokens NEXA — un **purple accent** (`--accent-brand`, flippe clair/sombre) et un **amber risque modéré** (`--risk-moderate`, teinte constante) — débloquant la Wave 2 (Eyebrow/ScoreRing/ExpiryBanner) sans consommer de primitive `--nexa-*` en dur.

## What Was Built

5 lignes de tokens ajoutées à `globals.css`, respectant l'architecture 3 couches verrouillée en Phase 10 (primitive `--nexa-*` -> sémantique `:root`/`.dark` -> component `@theme inline`), **sans re-décision de palette** (Pitfall 4) :

| Couche | Token | Valeur | Ligne |
|--------|-------|--------|-------|
| 1 `@theme` (primitive) | `--nexa-amber-500` | `oklch(0.7686 0.1647 70.08)` (hue 70, distinct du brand 155 et des signals 27/149) | 48 |
| 2 `:root` (sémantique) | `--accent-brand` | `var(--nexa-purple-500)` | 137 |
| 2 `:root` (sémantique) | `--risk-moderate` | `var(--nexa-amber-500)` | 138 |
| 2 `.dark` (override) | `--accent-brand` | `var(--nexa-purple-400)` (éclairci) | 166 |
| 3 `@theme inline` (component) | `--color-accent-brand` | `var(--accent-brand)` | 92 |
| 3 `@theme inline` (component) | `--color-risk-moderate` | `var(--risk-moderate)` | 93 |

Le purple primitive existait déjà (`--nexa-purple-500/400`, Phase 10) — non dupliqué. Seul l'amber était absent même en primitive.

## Decisions Made

- **D-11-01-A** : `--risk-moderate` GARDE sa teinte amber dans les deux thèmes (un risque modéré reste ambre clair/sombre) → déclaré une SEULE fois en `:root`, NON redéclaré en `.dark`. Même invariant que `--signal-bullish`/`--signal-bearish`. `--accent-brand` au contraire flippe (purple-500 light -> purple-400 dark éclairci), repointant sur une primitive dédiée existante.
- **D-11-01-B** : var()-only strict hors couche 1 — aucun littéral OKLCH/HEX introduit dans `:root`/`.dark`/`@theme inline` (Pitfall 3 : un littéral casserait silencieusement le flip `.dark`). Seule la primitive amber porte une valeur OKLCH, dans la couche 1.

## Verification

- **Task 1 (grep multi-critère)** : 7 occurrences des tokens cibles (5 déclarations + 2 refs `@theme inline`). Placement exact vérifié ligne par ligne (amber l.48 dans `@theme`, accent-brand :root l.137 + .dark l.166, risk-moderate :root l.138 uniquement, color-* l.92-93).
- **Task 2 (garde RTL fondation Phase 10)** : `pnpm vitest run apps/web/src/styles/__tests__/rtl-logical-props.test.ts` → exit 0, **2/2 tests verts**. L'ajout de tokens CSS n'introduit aucune classe physique (`ml-/mr-/pl-/pr-/left-/right-`).

## Deviations from Plan

None - plan exécuté exactement comme écrit. Task 2 est une vérification pure (aucun fichier modifié) → pas de commit séparé.

## Self-Check: PASSED

- FOUND: apps/web/src/styles/globals.css
- FOUND: commit 54cc3b1
