---
phase: quick-260617-sy5
plan: 01
subsystem: telegram/core
tags: [telegram, legal, formatMessage, disclaimer, D-06-REVISED, LEGAL-01]
requires: [applyThreshold]
provides: [formatMessage-sans-disclaimer-par-message]
affects: [packages/core/src/telegram/format.ts]
tech-stack:
  added: []
  patterns: [fonction-pure, golden-tests, bidi-isolates]
key-files:
  created: []
  modified:
    - packages/core/src/telegram/format.ts
    - packages/core/src/telegram/format.test.ts
decisions:
  - "D-06 RÉVISÉE : disclaimer LEGAL-01 retiré du message, porté par la DESCRIPTION du canal Telegram (persistante)"
metrics:
  duration: ~5 min
  completed: 2026-06-17
  tasks: 1
  files: 2
---

# Phase quick-260617-sy5 Plan 01 : Retrait disclaimer Telegram par message Summary

Retrait des constantes `DISCLAIMER_FR`/`DISCLAIMER_AR` et de leurs `push` dans `formatMessage` ; le disclaimer LEGAL-01 n'est plus émis par message, il est désormais porté par la DESCRIPTION du canal Telegram. `formatMessage` reste une fonction pure.

## Décision verrouillée RÉVISÉE — D-06

**D-06 (Phase 6, "disclaimer FR+AR par message") est RÉVISÉE.**
Le disclaimer n'est plus répété dans chaque post Telegram. Il vit maintenant dans la **DESCRIPTION du canal Telegram** (persistante, en tête de canal, hors-code).

**LEGAL-01 reste SATISFAIT** : le contenu éducatif / "aucune promesse de gain" / "pas un conseil en investissement" demeure visible en permanence via la description du canal. Aucune régression légale — le disclaimer change seulement de support (par-message → description-canal).

## Ce qui a été fait

- Supprimé `DISCLAIMER_FR` et `DISCLAIMER_AR` de `format.ts`.
- Supprimé `frLines.push(DISCLAIMER_FR)` → dernier élément FR = `winRateLineFr(winRate)`.
- Supprimé `arLines.push(\`${RLM}${DISCLAIMER_AR}\`)` → dernier élément AR = `winRateLineAr(winRate)`.
- `return [...frLines, '', SEP, '', ...arLines].join('\n')` inchangé.
- Commentaire d'en-tête mis à jour : LEGAL-01/D-06 révisé → disclaimer porté par la description du canal.
- `format.test.ts` : bloc disclaimer inversé en `.not.toContain(...)` (FR + AR), renommé "AUCUN disclaimer par message (D-06 révisé)" ; ajout d'un bloc explicite "ligne taux de réussite TOUJOURS présente" couvrant N>=30 et N<30.

## Garde-fous préservés (inchangés)

- `escapeHtml` (T-06-INJ), isolats bidi LRI/PDI/RLM (T-06-BIDI).
- `winRateLineFr`/`winRateLineAr` via `applyThreshold` (TG-02 / D-11) — ligne taux conservée.
- `FormatTrade` = symbol+direction+outcome+realized_r uniquement (D-03 / D-05, pas de entry/SL/TP).
- Cap 4096 chars + "+X autres trades" (Pitfall 3).
- Jour vide D-10 ("Aucun trade" / "لا توجد").
- Fonction PURE, TS strict, aucun console.log, immutabilité.

## Vérification

- `pnpm vitest run format.test` → **13 passed (13)**.
- `pnpm typecheck` (`tsc -b --noEmit`) → **exit 0**.
- `grep -v '^[[:space:]]*[/*]' format.ts | grep -c -e 'Contenu éducatif' -e 'محتوى تعليمي' -e 'DISCLAIMER_'` → **0**.
- Aucun fichier hors périmètre modifié (`apps/jobs/src/jobs/telegram-publish.ts` intact, `.env` non touché).

## Périmètre

2 fichiers modifiés, rien d'autre :
- `packages/core/src/telegram/format.ts`
- `packages/core/src/telegram/format.test.ts`

Note : `brand/` apparaît untracked dans `git status` — pré-existant, hors périmètre, non touché.

## Deviations from Plan

None - plan exécuté exactement comme écrit (TDD RED → GREEN ; pas de refactor nécessaire).

## Commits

- `9b797ab` refactor(telegram): retirer le disclaimer LEGAL-01 par message (D-06 révisé)

## Self-Check: PASSED

- FOUND: packages/core/src/telegram/format.ts (modifié, commité)
- FOUND: packages/core/src/telegram/format.test.ts (modifié, commité)
- FOUND: commit 9b797ab
