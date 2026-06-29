---
phase: 16-reskin-transversal-de-toutes-les-pages
plan: 02
subsystem: reskin-vitrine-tier1
tags: [reskin, landing, volt-green-reconcile, tier1-neon, glow, vitrine, tokens]
requires:
  - "Plan 16-01 (gates volt-orphan-free + theme-scan étendu, primitives glow/data-rain)"
  - "Phase 15 DS v3 dark unique (couche token --primary/--glow)"
provides:
  - "Landing green-only (data-theme=green figé, zéro orphelin volt sous apps/web/src)"
  - "Tarifs/méthodologie/légal Tier 1 token-pure avec accent néon (glow + filet --primary)"
  - "volt-orphan-free gate GREEN"
affects:
  - "Plans 16-03/16-04 (admin + dashboard buckets) — theme-scan Test 2 reste RED sur LEURS offenders"
tech-stack:
  added: []
  patterns:
    - "Glow = box-shadow var(--glow) via glowClass() — jamais ring-* (C-3/D-08)"
    - "Accent vitrine Tier 1 = couche token --primary uniquement, zéro littéral"
    - "Disclaimer source unique (<Disclaimer />), jamais de copie inline"
key-files:
  created: []
  modified:
    - "apps/web/src/components/landing/NexaLanding.tsx"
    - "apps/web/src/components/landing/NexaLandingEffects.tsx"
    - "apps/web/src/components/landing/nexa-landing.css"
    - "apps/web/src/app/[locale]/(marketing)/tarifs/page.tsx"
    - "apps/web/src/app/[locale]/(marketing)/methodologie/page.tsx"
    - "apps/web/src/app/[locale]/(marketing)/legal/[doc]/page.tsx"
decisions:
  - "D-16-02-A : Eyebrow (composant partagé) NON modifié — son défaut tone=purple utilise text-[var(--accent-brand)] (var tokenisée, passe theme-scan). Le swap law du plan vise les LITTÉRAUX dans les fichiers de page ; les pages consomment le composant, pas le littéral → grep d'acceptance retourne zéro. Toucher le défaut Eyebrow déborderait sur des surfaces hors plan."
  - "D-16-02-B : theme-scan Test 2 reste RED MAIS exclusivement sur des offenders hors plan 02 ((admin)/page.tsx, (admin)/sante/page.tsx bg-emerald/amber-500 ; dashboard/page.tsx text-red-600). Ces fichiers appartiennent aux buckets admin/dashboard (plans 16-03/16-04). Mes 3 surfaces vitrine sont token-pure (grep raw-palette = 0). Comportement TDD de gate étagé attendu (cf. plan 01 D-16-01-B)."
  - "D-16-02-C : carte vedette Tier 1 = la carte Standard 9$/mois (offre principale) — bordure border-primary/40 + glowClass('soft') ; CTA primaire glowClass('soft'). méthodologie/légal = filet d'accent --primary (h-px bg-primary/60) discret car pages prose."
  - "D-16-02-D : aucun % rendu sur les 3 pages → applyThreshold non requis (D-13 ne s'applique que si un % est affiché). Aucune promesse de gain introduite (no-perf-claims GREEN)."
metrics:
  duration: "~12 min"
  tasks: 2
  files: 6
  completed: "2026-06-23"
---

# Phase 16 Plan 02 : Reskin Tier 1 vitrine + réconciliation landing green-only — Summary

Wave 2 du reskin (axe vitrine Tier 1) : la landing passe du micro-monde Green/Volt au **green unique** du DS v3 (D-01/D-02/D-03), et les 3 pages vitrine non-landing (tarifs, méthodologie, légal) reçoivent l'**accent néon Tier 1 plein** sur une base déjà token-pure, garde-fous intacts.

## What Was Built

**Task 1 — Landing volt→green reconcile + cleanup orphelins (Pattern E) :**
- `NexaLanding.tsx` : root `data-theme="green"` figé ; bloc `nxl-theme-toggle` (+ 2 boutons) supprimé ; commentaire d'en-tête réécrit green-only.
- `NexaLandingEffects.tsx` : logique de thème entièrement retirée (`setTheme`, lecture/écriture `localStorage('nexa-landing-theme')`, listeners `.nxl-theme-toggle button`, défaut `'volt'`). data-rain, parallaxe, tilt, reveal/compteurs/jauge, progress/nav PRÉSERVÉS (theme-agnostic, reduced-motion gardés).
- `nexa-landing.css` : bloc `.nxl[data-theme="volt"]` supprimé ; 2 overrides volt `.mark-tile` supprimés ; CSS `.nxl-theme-toggle` supprimé. Branche `.nxl[data-theme="green"]` = seule branche vivante (D-03).

**Task 2 — Tier 1 accent tarifs/méthodologie/légal :**
- `tarifs` : carte Standard (9$/mois, offre vedette) → `border-primary/40` + `glowClass('soft')` (box-shadow `var(--glow)`, jamais un ring) ; CTA primaire → `glowClass('soft')` ; `<Disclaimer />` ajouté (LEGAL-01, source unique).
- `méthodologie` + `légal` : filet d'accent vitrine `h-px w-16 bg-primary/60` sous le titre (couche token `--primary`, signature Tier 1 discrète sur pages prose).
- Aucune raw-palette introduite ; RTL logique, `data-testid`/ARIA, i18n FR/EN/AR inchangés.

## État de vérification

| Gate | État | Note |
|------|------|------|
| `volt-orphan-free` | GREEN (2/2) | landing green-only, zéro orphelin sous apps/web/src |
| `no-perf-claims` | GREEN | aucune promesse de gain |
| `no-mera-brand` | GREEN | rebranding préservé |
| `rtl-logical-props` | GREEN | aucune classe directionnelle physique introduite |
| `theme-scan` Test 1/3/SANITY | GREEN | |
| `theme-scan` Test 2 | RED — offenders HORS plan 02 uniquement | (admin)/page.tsx, (admin)/sante/page.tsx, dashboard/page.tsx → buckets plans 16-03/16-04 |
| `pnpm typecheck` (tsc -b --noEmit) | 0 erreur | |
| `pnpm lint:i18n` | exit 0 | aucune chaîne en dur |
| grep raw-palette 3 vitrine | 0 match | surfaces token-pure |
| grep `<Disclaimer` tarifs | 1 match | Disclaimer préservé |
| grep `glowClass` tarifs | 3 matches | import + carte vedette + CTA |

Le RED de theme-scan Test 2 est intégralement imputable aux fichiers admin/dashboard appartenant aux plans 16-03/16-04 (comportement de gate TDD étagé documenté par plan 01). Les 3 surfaces de CE plan ne contribuent aucun offender.

## Deviations from Plan

### Auto-fixed Issues / écarts de cohérence

**1. [Rule 1 - Précision] theme-scan Test 2 RED uniquement sur des offenders hors plan 02**
- **Trouvé pendant :** Task 2 (exécution du gate).
- **Écart :** l'acceptance demandait « theme-scan GREEN ». Le scan complet est RED, mais EXCLUSIVEMENT sur `(admin)/page.tsx`, `(admin)/sante/page.tsx` (`bg-emerald-500`/`bg-amber-500`) et `dashboard/page.tsx` (`text-red-600`) — fichiers des buckets admin/dashboard (plans 16-03/16-04), jamais touchés par ce plan.
- **Décision :** mes 3 surfaces vitrine sont token-pure (grep raw-palette = 0). Aucune correction hors scope (frontière de scope : ne corriger que les problèmes causés par la tâche courante). Le RED mesure le travail réel des plans suivants — comportement TDD attendu (cf. plan 01 D-16-01-B).

**2. [Rule 3 - Cohérence] Eyebrow partagé non modifié malgré le swap law `var(--accent-brand)`→`--primary`**
- **Trouvé pendant :** Task 2.
- **Écart :** le swap law liste `text-[var(--accent-brand)]`→`text-primary`. Le composant partagé `nexa/Eyebrow.tsx` utilise `text-[var(--accent-brand)]` dans son défaut `tone=purple`.
- **Décision :** les pages consomment `<Eyebrow>` (composant tokenisé, var → passe theme-scan), PAS le littéral. Le grep d'acceptance sur les fichiers de page retourne zéro. Modifier le défaut d'Eyebrow déborderait sur toutes les surfaces qui l'utilisent (hors scope plan 02). Eyebrow laissé intact.

## Known Stubs

Aucun. Les 3 pages restent fonctionnelles ; le placeholder légal (`reviewPending`) est intentionnel et géré par le gate LEGAL-02 (hors plan), non un stub de reskin.

## Threat Flags

Aucune nouvelle surface de sécurité. Le reskin touche className/markup UNIQUEMENT : aucun `createClient`/`from(`/`.select(` modifié, aucun fetch migré server→client, aucun `service_role` introduit. T-16-02-01 (RLS inchangée), T-16-02-02 (branche volt morte), T-16-02-03 (no-perf-claims), T-16-02-SC (zéro install npm) tous respectés.

## Commits

- `b731968` feat(16-02): reconcile landing to green-only, remove volt orphans
- `5bd2f36` feat(16-02): apply Tier 1 neon accent on tarifs, methodologie, legal

## Self-Check: PASSED

Fichiers modifiés vérifiés présents (6/6). Commits b731968 + 5bd2f36 présents dans git log. volt-orphan-free GREEN, no-perf-claims/no-mera-brand/rtl-logical-props GREEN, typecheck 0 erreur, lint:i18n exit 0. RED résiduel de theme-scan Test 2 imputé hors plan 02 (plans 16-03/16-04).
