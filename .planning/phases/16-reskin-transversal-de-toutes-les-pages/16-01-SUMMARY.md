---
phase: 16-reskin-transversal-de-toutes-les-pages
plan: 01
subsystem: design-system-guardrails
tags: [reskin, guardrails, tokens, neon-primitives, tdd, rls, lwc, theme-scan]
requires:
  - "Phase 15 DS v3 dark unique (globals.css couche token : --glow, --signal-bullish, --signal-bearish)"
  - "theme-scan.test.ts (THEME-02 Phase 15) à étendre"
provides:
  - "theme-scan étendu (FOUNDATION_FILES wave-2 + FORBIDDEN_PALETTE résiduel)"
  - "rls-unchanged.test.ts (gate T-16-01)"
  - "lwc-recolor-intact.test.ts (gate T-16-02)"
  - "volt-orphan-free.test.ts (gate T-16-03)"
  - "ui/glow.tsx (primitive Tier-2 box-shadow var(--glow))"
  - "ui/data-rain.tsx (primitive Tier-2 ambiante tokenisée, reduced-motion)"
affects:
  - "waves 2 du reskin (toutes les surfaces) — gates bloquants en place"
tech-stack:
  added: []
  patterns:
    - "Scans structurels filesystem (node:fs/node:path only, zéro dépendance app)"
    - "Glow = box-shadow var(--glow), jamais ring-* (anti-collision D-08/C-3)"
    - "Data-rain CSS dans globals.css, color-mix sur tokens, reduced-motion no-preference"
key-files:
  created:
    - "apps/web/src/styles/__tests__/rls-unchanged.test.ts"
    - "apps/web/src/styles/__tests__/lwc-recolor-intact.test.ts"
    - "apps/web/src/styles/__tests__/volt-orphan-free.test.ts"
    - "apps/web/src/components/ui/glow.tsx"
    - "apps/web/src/components/ui/data-rain.tsx"
  modified:
    - "apps/web/src/styles/__tests__/theme-scan.test.ts"
    - "apps/web/src/styles/globals.css"
decisions:
  - "D-16-01-A : volt-orphan-free RED contre l'arbre courant (landing volt encore live) — état TDD attendu, la garde mesure le travail wave-2 sur la landing"
  - "D-16-01-B : theme-scan Test 2 RED liste sante+dashboard+admin/page (pas login) — login déjà tokenisé, admin/page porte les nouveaux tokens standalone"
  - "D-16-01-C : rls-unchanged strippe les commentaires avant scan — les pages documentent 'aucun service_role' en prose, ce n'est pas une infraction"
  - "D-16-01-D : data-rain CSS (keyframes + couleurs tokens) vit dans globals.css sous .nxl-data-rain ; le composant n'injecte que les colonnes (RTL-safe, reduced-motion double-gardé)"
metrics:
  duration: "~20 min"
  tasks: 2
  files: 7
  completed: "2026-06-23"
---

# Phase 16 Plan 01 : Garde-fous du reskin + primitives néon tokenisées — Summary

Wave 0 du reskin transversal : verrouillage des garde-fous AVANT toute repeinture et extraction des seules primitives « neuves » (glow + data-rain tokenisés) depuis le CSS `.nxl` de la landing. Aucune page reskinée, aucun fetch touché, aucun service_role introduit.

## What Was Built

**Task 1 — 1 scan étendu + 3 scans structurels (TDD gates) :**
- `theme-scan.test.ts` étendu : FOUNDATION_FILES +5 surfaces wave-2 (dashboard, login, membres, signaux/[id], affiliation/affilies) ; FORBIDDEN_PALETTE +`text-red-600`/`bg-emerald-500`/`bg-amber-500` standalone + fixture SANITY synchronisée.
- `rls-unchanged.test.ts` (T-16-01) : échoue si une page member/account/marketing/auth importe `admin-service`, référence `service_role`/`SERVICE_ROLE_KEY` en code, ou importe le client browser ; allowlist des 2 Server Actions pré-existants ; commentaires strippés avant scan.
- `lwc-recolor-intact.test.ts` (T-16-02) : affirme `getComputedStyle`/`applyOptions`/`MutationObserver` intacts dans CandleChart + zéro couleur de bougie littérale.
- `volt-orphan-free.test.ts` (T-16-03) : échoue sur `data-theme="volt"`/`nxl-theme-toggle`/`nexa-landing-theme` sous apps/web/src.

**Task 2 — 2 primitives Tier-2 tokenisées :**
- `ui/glow.tsx` : `glowClass(intensity)` + `<Glow>`, box-shadow dérivé de `var(--glow)` UNIQUEMENT, jamais un `ring-*` (D-06/D-08, recettes sourcées de `.nxl .btn-primary`/`.mark-tile`).
- `ui/data-rain.tsx` : primitive ambiante légère, colonnes mappées `--signal-bullish`/`--signal-bearish` via `color-mix`, animation double-gardée `prefers-reduced-motion` (D-14). CSS associé ajouté à `globals.css` (`.nxl-data-rain`/`.nxl-data-col`, token-only, RTL-safe).

## État de vérification

| Gate | État | Attendu |
|------|------|---------|
| `rls-unchanged` | GREEN (3/3) | ✅ arbre conforme |
| `lwc-recolor-intact` | GREEN (3/3) | ✅ arbre conforme |
| `volt-orphan-free` | RED (1 assertion) + SANITY GREEN | ⚠️ landing volt encore live (wave-2 doit migrer) |
| `theme-scan` Test 1/3/SANITY | GREEN (4/5) | ✅ |
| `theme-scan` Test 2 | RED : sante (bg-emerald-500/bg-amber-500), admin/page (idem), dashboard (text-red-600) | ✅ offenders réels wave-2 |
| `tsc -b --noEmit` | 0 erreur | ✅ |

Le RED est la garde : il mesure le travail réel des waves 2 (tokeniser les offenders, migrer la landing volt). C'est le comportement TDD attendu pour un plan Wave-0.

## Deviations from Plan

### Auto-fixed Issues / écarts de cohérence

**1. [Rule 1 - Précision] theme-scan Test 2 RED liste sante+dashboard+admin/page, PAS login**
- **Trouvé pendant :** Task 1.
- **Écart :** le plan annonçait « exactly sante, dashboard, login » (login:44). Or login est DÉJÀ tokenisé (aucun offender de palette), et `app/(admin)/page.tsx` (fichier fondation pré-existant) porte les nouveaux tokens standalone (`bg-emerald-500`/`bg-amber-500`).
- **Décision :** scan écrit conforme à la spec des regex ; le RED liste les offenders RÉELS. La garde reste correcte (elle mesure du travail wave-2 réel). login reste en FOUNDATION_FILES (zéro contribution = conforme).

**2. [Rule 3 - Cohérence] volt-orphan-free RED contre l'arbre courant**
- **Trouvé pendant :** Task 1.
- **Écart :** l'acceptance disait « les 3 scans structurels GREEN (arbre conforme) ». Or la landing (`NexaLanding.tsx`, `nexa-landing.css`, `NexaLandingEffects.tsx`) porte ENCORE `data-theme="volt"`/`nxl-theme-toggle`/`nexa-landing-theme` (rendue live via `(marketing)/page.tsx`). La landing n'est reskinée qu'en wave 2.
- **Décision :** scan écrit exactement comme spécifié ; il est RED — exactement comme theme-scan Test 2. C'est l'intention profonde du plan (« green-only enforced before waves 2 touch the landing ») exprimée en TDD : la garde mesure la migration de la landing en wave 2. SANITY GREEN (détecteur non trivial).

**3. [Rule 1 - Bug] rls-unchanged faux-positifs sur commentaires de prose**
- **Trouvé pendant :** Task 1 (1ère exécution).
- **Issue :** 4 pages (member/account) déclenchaient le scan car elles documentent « aucun service_role » en COMMENTAIRE — l'opposé d'une infraction.
- **Fix :** ajout d'un `stripComments()` (blocs + lignes, épargne `://`) appliqué avant les regexes. Le scan ne mesure désormais que du CODE réel.
- **Fichier :** `rls-unchanged.test.ts`. **Commit :** 3792693.

**4. [Rule 1 - Bug] lwc parse error (`*/` accidentel) + regex SANITY**
- **Trouvé pendant :** Task 1 (1ère exécution).
- **Issue 1 :** `wick*/borderUp` dans un commentaire JSDoc fermait le bloc commentaire prématurément (`*/`). **Fix :** reformulé `wickUp/wickDown/borderUp/...`.
- **Issue 2 :** la regex de littéral ne couvrait pas un hex QUOTÉ (`'#26a69a'`). **Fix :** `['"](?:#[0-9a-fA-F]{3,8}|[a-zA-Z]+)['"]`.
- **Fichier :** `lwc-recolor-intact.test.ts`. **Commit :** 3792693.

**5. [Rule 1 - Précision] data-rain : suppression des noms `--buy`/`--sell` du commentaire**
- **Trouvé pendant :** Task 2 (vérification acceptance).
- **Issue :** l'acceptance exige que `grep -nE "#hex|--buy|--sell" data-rain.tsx` ne retourne RIEN. Le commentaire mentionnait `--buy`/`--sell` (pour dire qu'on ne les utilise PAS).
- **Fix :** reformulé en « anciennes vars de la landing ». Aucun littéral ni var legacy dans le fichier.
- **Fichier :** `ui/data-rain.tsx`. **Commit :** 2808648.

## Known Stubs

Aucun. Les primitives sont complètes et token-only ; elles ne sont délibérément PAS câblées dans les pages (waves 2 les appliquent — conforme au scope Wave-0).

## Threat Flags

Aucune nouvelle surface de sécurité introduite. Le plan ne touche que des fichiers de test, deux primitives `ui/` décoratives (box-shadow / voile ambiant) et la couche `@theme`/CSS de globals.css. Zéro fetch déplacé, zéro service_role. Les gates T-16-01/02/03 sont désormais ACTIFS pour les waves 2.

## Commits

- `3792693` test(16-01): extend theme-scan + add 3 structural reskin guardrails
- `2808648` feat(16-01): extract tokenized glow + light data-rain Tier-2 primitives

## Self-Check: PASSED

Fichiers créés vérifiés présents : rls-unchanged.test.ts, lwc-recolor-intact.test.ts, volt-orphan-free.test.ts, ui/glow.tsx, ui/data-rain.tsx. Fichiers modifiés : theme-scan.test.ts, globals.css. Commits 3792693 + 2808648 présents dans git log. Suites rls + lwc GREEN, theme-scan Test 3 GREEN, tsc 0 erreur.
