---
phase: 08-superadmin-consolid-signaux-sant-affili-s
plan: 01
subsystem: admin
tags: [admin, foundation, pure-functions, i18n, sidebar, tdd]
requires:
  - "lib/auth/gate.ts requireRole('superadmin')"
  - "components/admin/PayoutRowAction.tsx ('use client' + useTranslations shape)"
  - "lucide-react 1.18.0 (locked, already used)"
provides:
  - "lib/admin/signals.ts (postedSetupIdSet, telegramStatusFor)"
  - "lib/admin/freshness.ts (candleColor, ageColor, NEWS_THRESHOLDS, MACRO_THRESHOLDS)"
  - "lib/admin/jobs.ts (latestPerJob, runDurationMs)"
  - "(admin)/_components/AdminSidebar.tsx (client nav, active prefix-match)"
  - "(admin)/layout.tsx two-column shell"
  - "fr.json admin.{nav,dashboard,signals,health,affiliates}.* (Wave 2 file-disjoint)"
affects:
  - "Wave 2 plans 08-02/08-03/08-04 (consume pure fns + shell + copy, never touch fr.json)"
tech-stack:
  added: []
  patterns:
    - "Pure logic extracted to lib/admin/* (testable without rendering RSC)"
    - "Admin client island: plain next/link (HORS [locale]) + usePathname prefix-match"
key-files:
  created:
    - apps/web/src/lib/admin/signals.ts
    - apps/web/src/lib/admin/signals.test.ts
    - apps/web/src/lib/admin/freshness.ts
    - apps/web/src/lib/admin/freshness.test.ts
    - apps/web/src/lib/admin/jobs.ts
    - apps/web/src/lib/admin/jobs.test.ts
    - apps/web/src/app/(admin)/_components/AdminSidebar.tsx
  modified:
    - apps/web/src/app/(admin)/layout.tsx
    - apps/web/src/messages/fr.json
decisions:
  - "D-08-01-A: vitest glob déjà couvre apps/web/src/lib/**/*.test.ts (précédent D-05-01-D) — zéro changement de config."
  - "D-08-01-B: 'failed' retiré des commentaires JSDoc de signals.ts pour satisfaire grep d'acceptance (TelegramStatus = 'posted' | 'unpublished' uniquement)."
  - "D-08-01-C: admin.* FR-only (back-office HORS [locale]) — parité par-namespace non cassée (18/18 verts)."
metrics:
  duration: ~12 min
  completed: 2026-06-19
  tasks: 2
  files: 9
---

# Phase 8 Plan 01: Admin Foundation Summary

Fondation Phase 8 : trois fonctions logiques pures unit-testées (signals/freshness/jobs), le shell admin consolidé (sidebar D-01) sous le gate préservé, et la totalité des clés de copy FR Phase 8 en une passe — rendant les plans Wave 2 file-disjoints (parallèles, zéro contention sur fr.json).

## What Was Built

- **lib/admin/signals.ts** — `postedSetupIdSet` (notable: dedupe_key → setup-id Set) + `telegramStatusFor` (2 états posted/unpublished, jamais d'échec persistant, Pitfall 3).
- **lib/admin/freshness.ts** — `candleColor` (is_stale + bande ambre 1.5× seuil) + `ageColor` (news/macro par âge) + `NEWS_THRESHOLDS` (6h/24h) + `MACRO_THRESHOLDS` (36h/72h), bornes strictement supérieures.
- **lib/admin/jobs.ts** — `runDurationMs` (null si running/inanalysable) + `latestPerJob` (dernier run par job_name, ordre first-seen stable).
- **(admin)/_components/AdminSidebar.tsx** — îlot client `usePathname` prefix-match, plain `next/link` (admin HORS [locale]), 7 items D-01, icônes lucide, accent --primary réservé à l'actif.
- **(admin)/layout.tsx** — shell flex deux colonnes ; gate `requireRole('superadmin')` + provider + Toaster préservés verbatim.
- **fr.json** — bloc `admin.{nav,dashboard,signals,health,affiliates}.*` complet (sourcé UI-SPEC §Copywriting Contract).

## Tasks Completed

| Task | Name | Commits | Files |
| ---- | ---- | ------- | ----- |
| 1 | Pure admin logic + vitest (TDD) | f3c624a (RED), 3f4d54b (GREEN) | signals/freshness/jobs .ts + .test.ts |
| 2 | Admin shell + sidebar + FR copy | 93da8d8 | layout.tsx, AdminSidebar.tsx, fr.json |

## Verification

- `npx vitest run apps/web/src/lib/admin/*` → 33/33 verts (RED prouvé avant GREEN).
- `pnpm typecheck` → exit 0, zéro nouvelle erreur.
- `pnpm lint:i18n` → exit 0 (aucun texte JSX en dur).
- `npx vitest run apps/web/src/messages` → 18/18 (parité non régressée).
- Greps d'acceptance Task 2 : gate préservé (≥1), `next/link`==1, i18n-nav==0, `usePathname`==3, 7 hrefs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Token 'failed' dans les commentaires de signals.ts**
- **Found during:** Task 1 (vérification acceptance)
- **Issue:** `grep -c "'failed'" signals.ts` retournait 2 (occurrences en commentaires JSDoc documentant l'ABSENCE de l'état). Le critère exige 0.
- **Fix:** Reformulation des deux commentaires (« jamais un état d'échec persistant »). La logique était déjà conforme (`TelegramStatus = 'posted' | 'unpublished'`).
- **Files modified:** apps/web/src/lib/admin/signals.ts
- **Commit:** 3f4d54b

Aucun changement de config vitest requis (glob `apps/web/src/lib/**/*.test.ts` déjà présent, précédent D-05-01-D).

## Threat Surface

Aucune nouvelle surface hors threat_model. AdminSidebar est `'use client'` important uniquement next/link + next-intl + lucide — zéro service_role/env (T-08-03 mitigé). Gate préservé verbatim, sidebar montée SOUS le gate (T-08-01/T-08-02 mitigés). Zéro package npm installé (T-08-SC).

## Self-Check: PASSED

- Fichiers créés : signals.ts/test, freshness.ts/test, jobs.ts/test, AdminSidebar.tsx → tous présents.
- Commits f3c624a, 3f4d54b, 93da8d8 → présents dans git log.
