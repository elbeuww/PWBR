---
phase: 16-reskin-transversal-de-toutes-les-pages
plan: 04
subsystem: reskin-academie-admin
tags: [reskin, tier2, tier3, academie, admin, rtl, fallback, tokens, glow, service-role]
requires:
  - "Plan 16-01 (gates theme-scan étendu + rls-unchanged + primitives glow ui/glow.tsx)"
  - "Phase 15 DS v3 dark unique (couche token --signal-bullish/--risk-moderate/--destructive/--glow)"
provides:
  - "Académie index/article/leçon + ContentCard/FallbackBanner/Callout : DS v3 Tier 2 token-pur, glow discret sur cartes de contenu"
  - "RTL propriétés logiques + FR fallback (FallbackBanner) préservés sur l'Académie"
  - "Admin résiduel tokenisé Tier 3 sober : status dots sante + admin/page via --signal-bullish/--risk-moderate (zéro effet)"
  - "theme-scan Test 2 GREEN (tous les offenders résiduels résolus) — gate fondation entièrement verte"
  - "service_role admin-only intact (createAdminServiceClient non touché) ; aucun import admin-service hors (admin)/**"
affects:
  - "Clôture du reskin transversal Phase 16 (dernier plan) — toutes surfaces sous DS v3 dark néon"
tech-stack:
  added: []
  patterns:
    - "Académie carte de contenu = glowClass('soft') (box-shadow var(--glow)) — jamais ring-* (C-3/D-08)"
    - "Status dots admin = tokens sémantiques bg-[--signal-bullish]/bg-[--risk-moderate] (Tier 3 sober, swap law)"
    - "Tier 3 admin : tokens + bordure néon minimale, zéro effet (pas de glow, pas de data-rain, D-18)"
    - "Propriétés logiques RTL admin par cohérence (ms-/text-end), même en FR-LTR"
key-files:
  created: []
  modified:
    - "apps/web/src/components/academie/ContentCard.tsx"
    - "apps/web/src/app/(admin)/sante/page.tsx"
    - "apps/web/src/app/(admin)/page.tsx"
    - "apps/web/src/app/(admin)/membres/page.tsx"
    - "apps/web/src/app/(admin)/affiliation/affilies/page.tsx"
decisions:
  - "D-16-04-A : les 3 pages Académie (index/[slug]/[slug]/[lesson]) + FallbackBanner + Callout étaient DÉJÀ entièrement token-pures (tokens --foreground/text-primary/bg-card/ring-foreground/10/border-border/border-primary), zéro littéral de palette, zéro classe directionnelle physique, FR fallback intact. L'unique travail net-new Tier 2 = appliquer l'accent discret (C-6/D-04) = glow sur la CARTE de contenu (ContentCard) via glowClass('soft'), miroir exact de SignalCard (plan 03). Aucun glow sur listes/TOC/contenu prose (readability-first, D-05/D-07). 5 des 6 fichiers files_modified Académie laissés intacts (déjà conformes) — frontière de scope, conforme C-6."
  - "D-16-04-B : (admin)/page.tsx tokenisé EN PLUS des files_modified du plan. Il portait le MÊME offender DOT_CLASS (bg-emerald-500/bg-amber-500, lignes 53-57) que sante, et figure dans FOUNDATION_FILES du theme-scan. Le plan le classait verify-only (Phase 15) mais il n'avait jamais été tokenisé. Le critical_constraint exige theme-scan Test 2 GREEN → fix appliqué (Rule 2/3 : fonctionnalité critique manquante / gate bloquante). Sans ce fix, Test 2 serait resté RED."
  - "D-16-04-C : status dots admin (sante + admin/page) = bg-[--signal-bullish] (sain/green), bg-[--risk-moderate] (limite/amber), bg-destructive (périmé/red) — statut sémantique tokenisé, pas un effet. Tier 3 sober respecté : c'est une couleur de fond de pastille (bordure/fond néon minimal autorisé), pas un glow/aura/animation. Aucun box-shadow var(--glow) sur l'admin (vérifié par grep)."
  - "D-16-04-D : 3 offenders de propriété physique corrigés en logique pour cohérence RTL (plan : « keep logical for consistency ») — membres ml-2→ms-2, affilies text-right→text-end (×2). Non couverts par rtl-logical-props.test.ts (qui ne scanne que globals.css/layout/alert/nexa/hero) mais exigés par l'action du plan. signaux/[id] était déjà entièrement logique → non touché."
  - "D-16-04-E : service_role admin-only intégralement préservé. createAdminServiceClient() + tous les fetch (.from/.select) byte-identiques sur les 5 fichiers admin (diff = className/markup uniquement, vérifié par grep sur le diff). L'import admin-service reste présent dans les 5 pages admin et nulle part ailleurs (C-2). Reskin className-only confirmé (T-16-04-01/02 mitigés)."
metrics:
  duration: "~6 min"
  tasks: 2
  files: 5
  completed: "2026-06-23"
---

# Phase 16 Plan 04 : Reskin Académie (Tier 2) + Admin résiduel (Tier 3 sober) — Summary

Dernier plan du reskin transversal. L'**Académie** trilingue passe sous DS v3 Tier 2 avec l'accent discret (glow sur cartes de contenu), **RTL logique + FR fallback rigoureusement préservés**. L'**admin** résiduel est tokenisé Tier 3 **sober** (zéro effet) : les derniers status dots en palette brute (`bg-emerald-500`/`bg-amber-500`) passent aux tokens sémantiques, faisant tourner la gate **theme-scan Test 2 au VERT** intégralement. Reskin className/markup UNIQUEMENT ; `service_role` reste admin-only et chaque fetch est byte-identique.

## What Was Built

**Task 1 — Académie Tier 2 (RESKIN-04) :**
- `ContentCard` : accent Tier 2 discret = `glowClass('soft')` (box-shadow `var(--glow)`, jamais un ring) sur la carte de contenu, miroir exact de `SignalCard`. Readability-first : aucun glow sur listes/TOC/prose, aucun gradient de titre (D-07).
- `academie/page.tsx` (index) + `[slug]/page.tsx` (article/cours) + `[slug]/[lesson]/page.tsx` (leçon) + `FallbackBanner` + `Callout` : déjà entièrement token-purs (tokens DS v3, propriétés logiques, FR fallback via `FallbackBanner` intact) → verify-only, laissés intacts (D-16-04-A).
- FR fallback préservé : `FallbackBanner` toujours rendu en tête quand `resolved.fallback` (article + cours), logique inchangée.

**Task 2 — Admin résiduel Tier 3 sober (RESKIN-05) :**
- `sante/page.tsx` + `(admin)/page.tsx` : `DOT_CLASS` status dots `bg-emerald-500`→`bg-[--signal-bullish]`, `bg-amber-500`→`bg-[--risk-moderate]` (statut sémantique tokenisé). `(admin)/page.tsx` ajouté hors files_modified pour faire passer theme-scan Test 2 au vert (D-16-04-B).
- `membres/page.tsx` : `ml-2`→`ms-2` (propriété logique). `affiliation/affilies/page.tsx` : `text-right`→`text-end` (×2, propriété logique).
- `signaux/[id]/page.tsx` : déjà token-pur + logique → non touché.
- Tier 3 sober : zéro glow, zéro data-rain, zéro animation. `service_role` (`createAdminServiceClient`) et tous les fetch byte-identiques.

## État de vérification

| Gate | État | Note |
|------|------|------|
| `theme-scan` Test 1/2/3/SANITY | **GREEN (5/5)** | **Test 2 désormais VERT** — tous les offenders résiduels résolus (sante + admin/page) |
| `rtl-logical-props` | GREEN (3/3) | aucune classe directionnelle physique introduite |
| `rls-unchanged` | GREEN (3/3) | aucune page member/marketing/auth n'importe service_role ; admin-service confiné à (admin)/** |
| `no-perf-claims` | GREEN (5/5) | aucune promesse de gain |
| `no-mera-brand` | GREEN | aucune réintroduction MERA |
| `pnpm typecheck` (tsc -b --noEmit) | 0 erreur | |
| `pnpm lint:i18n` | exit 0 | aucune chaîne en dur |
| Académie acceptance grep (palette/physique) | VIDE | tokens + propriétés logiques uniquement |
| FallbackBanner (FR fallback) | présent | `[slug]/page.tsx` lignes 27/92/177 inchangées |
| glow Académie (Tier 2 accent) | présent | `glowClass` sur ContentCard |
| admin glow/data-rain | absent | grep `DataRain\|data-rain\|var(--glow)\|glowClass` sur 5 fichiers admin = 0 |
| admin-service import (5 pages) | présent | service_role admin-only intact |
| fetch / createAdminServiceClient / data-testid diff | VIDE | reskin className/markup uniquement |

## Deviations from Plan

### Auto-fixed Issues / écarts de cohérence

**1. [Rule 2 - Fonctionnalité critique] `(admin)/page.tsx` tokenisé hors files_modified**
- **Trouvé pendant :** Task 2 (run theme-scan Test 2).
- **Issue :** `(admin)/page.tsx` portait le MÊME offender `DOT_CLASS` (`bg-emerald-500`/`bg-amber-500`) que `sante`, et figure dans `FOUNDATION_FILES` du theme-scan. Le plan le classait verify-only (Phase 15) — classification erronée, il n'avait jamais été tokenisé.
- **Fix :** swap law appliquée (`bg-[--signal-bullish]`/`bg-[--risk-moderate]`). Le `critical_constraint` exige theme-scan Test 2 GREEN ; sans ce fix Test 2 serait resté RED.
- **Fichiers :** `app/(admin)/page.tsx`. **Commit :** c0c0ce7.

**2. [Rule 1 - Précision] 5 des 6 fichiers Académie déjà token-purs → non touchés**
- **Trouvé pendant :** Task 1 (lecture des 3 pages + 3 composants).
- **Écart :** les 3 pages + `FallbackBanner` + `Callout` étaient déjà entièrement token-purs (zéro littéral, propriétés logiques, FR fallback intact). L'unique travail Tier 2 net-new = l'accent discret = glow sur la carte de contenu (`ContentCard`).
- **Décision :** glow appliqué via `ContentCard` uniquement (readability-first, D-05). Appliquer un glow sur listes/TOC/prose violerait D-05/D-07. Les 5 autres fichiers laissés intacts (frontière de scope).

**3. [Rule 3 - Cohérence] 3 offenders de propriété physique corrigés en logique**
- **Trouvé pendant :** Task 2 (scan RTL des fichiers admin modifiés).
- **Écart :** `membres` (`ml-2`), `affilies` (`text-right` ×2) utilisaient des propriétés physiques. Non couvertes par `rtl-logical-props.test.ts` (scope limité) mais l'action du plan exige « logical RTL props … keep logical for consistency ».
- **Fix :** `ml-2`→`ms-2`, `text-right`→`text-end`. **Fichiers :** membres, affilies. **Commit :** c0c0ce7.

## Known Stubs

Aucun. Les surfaces Académie restent fonctionnelles (FR fallback opérationnel, MDX rendu inchangé) ; l'admin reste pleinement fonctionnel (service_role + fetch byte-identiques). Aucun stub de reskin.

## Threat Flags

Aucune nouvelle surface de sécurité. Le reskin touche className/markup UNIQUEMENT :
- T-16-04-01 (Information Disclosure Académie) : `rls-unchanged` GREEN, aucune page marketing n'importe service_role.
- T-16-04-02 (Elevation of Privilege admin) : `createAdminServiceClient` + `requireRole('superadmin')` (layout) non touchés ; diff = className-only.
- T-16-04-03 (admin existence leak) : routing/gating non touché.
- T-16-04-SC : zéro install npm (primitive glow réutilisée du plan 16-01).

## Commits

- `ab8821b` feat(16-04): Tier 2 discreet glow on Academie ContentCard
- `c0c0ce7` feat(16-04): tokenize admin residual offenders Tier 3 sober

## Self-Check: PASSED

Fichiers modifiés vérifiés présents (5/5 : ContentCard, sante, admin/page, membres, affilies). Commits ab8821b + c0c0ce7 présents dans git log. theme-scan 5/5 GREEN (Test 2 désormais vert), rtl-logical-props/rls-unchanged/no-perf-claims/no-mera-brand GREEN, typecheck 0 erreur, lint:i18n exit 0. FallbackBanner + FR fallback préservés, glow Académie présent, zéro glow/data-rain admin, admin-service présent dans 5 pages, fetch/service_role/data-testid diff vide.
