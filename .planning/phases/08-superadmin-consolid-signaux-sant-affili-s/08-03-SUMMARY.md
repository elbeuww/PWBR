---
phase: 08-superadmin-consolid-signaux-sant-affili-s
plan: 03
subsystem: admin
tags: [admin, sante, dashboard, rsc, freshness, job_runs, kpi]
requires:
  - "lib/admin/freshness.ts (candleColor, ageColor, NEWS_THRESHOLDS, MACRO_THRESHOLDS) — Plan 01"
  - "lib/admin/jobs.ts (latestPerJob, runDurationMs) — Plan 01"
  - "(admin)/layout.tsx gate requireRole('superadmin') — Plan 01"
  - "lib/supabase/admin-service.ts createAdminServiceClient (service_role server-only)"
  - "fr.json admin.health.* + admin.dashboard.* — Plan 01"
provides:
  - "(admin)/sante/page.tsx (RSC: freshness traffic-lights candles/news/macro + table job_runs)"
  - "(admin)/page.tsx (RSC: dashboard /admin avec 3 KPI cards liées)"
affects:
  - "Success Criterion 2 Phase 8 (superadmin voit santé jobs/données) — couvert"
  - "ADMIN-04 moitié santé — couvert"
tech-stack:
  added: []
  patterns:
    - "Freshness in-RSC: candles via vue (is_stale jamais re-dérivé), news/macro via age mapper"
    - "Worst-of traffic-light: réduction red>amber>green des sources pour le feu global"
    - "KPI head counts (count:'exact', head:true) — zéro row remontée"
key-files:
  created:
    - apps/web/src/app/(admin)/sante/page.tsx
    - apps/web/src/app/(admin)/page.tsx
  modified: []
decisions:
  - "D-08-03-A: timeframeHours(raw) mappe H1/H4/D→1/4/24h, thresholdHours=2× (RESEARCH Code Example ligne 309) ; défaut sûr 1h pour token inconnu, accepte string|null (v_data_freshness.timeframe nullable)."
  - "D-08-03-B: 'requireRole' retiré des commentaires d'en-tête des deux fichiers pour satisfaire le grep d'acceptance (==0) ; le gate reste owned par le layout, jamais dupliqué inline."
  - "D-08-03-C: feu global = worstColor (red>amber>green) sur candles/news/macro, mêmes mappeurs que la page Santé — pas de règle ad-hoc."
  - "D-08-03-D: source sans données (null max) → rouge « Périmé » avec timestamp '—' (candles vides incluses)."
metrics:
  duration: ~15 min
  completed: 2026-06-19
  tasks: 2
  files: 2
---

# Phase 8 Plan 03: Santé & Dashboard Summary

Vue Santé (feux de fraîcheur par source candles/news/macro + table des derniers job_runs) et landing /admin (3 KPI cards liées) — visibilité opérationnelle seule (D-08), consommant les mappeurs purs et la copy FR du Plan 01, sans nouvelle clé i18n ni migration.

## What Was Built

- **(admin)/sante/page.tsx** — RSC santé. Lit 4 sources via `createAdminServiceClient()` : `v_data_freshness` (candles), `news` (max published_at), `macro_series` (max ts), `job_runs`. Feux par source : candles via `candleColor(is_stale, ageHours, 2×timeframeHours)` — `is_stale` LU de la vue, **jamais re-dérivé** (la vue gère week-end FX/DST) ; news via `ageColor(..., NEWS_THRESHOLDS)` ; macro via `ageColor(..., MACRO_THRESHOLDS)`. Source sans donnée → rouge « Périmé ». Table job_runs via `latestPerJob` (dernier run par job) : Job · Statut (badge emerald/red/neutre) · Durée (`runDurationMs` formatée ms/s) · Dernier run. Empty state dashed. Aucun alerting, aucun polling, aucune action.
- **(admin)/page.tsx** — RSC landing `/admin`. 3 KPI via head counts (`count:'exact', head:true`) : membres actifs (miroir du critère `status='active' && current_period_end > now` de membres/page.tsx), file en attente (`payments status='ambiguous'`), santé globale (pire-feu des sources via les mêmes mappeurs). Grid `sm:grid-cols-2 lg:grid-cols-3` de `Card`s shadcn ; chaque carte est un `next/link` vers `/admin/membres`, `/admin/file`, `/admin/sante`. Nombres via `Intl.NumberFormat('fr-FR')`.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Santé — freshness traffic-lights + job_runs table | 4a0e6be | (admin)/sante/page.tsx |
| 2 | /admin dashboard landing KPI cards | d424698 | (admin)/page.tsx |

## Verification

- `pnpm tsc --noEmit` → zéro nouvelle erreur dans les deux fichiers (erreurs pré-existantes hors scope : affiliate/dashboard cookie types, ApplicationForm, jobs.test).
- `pnpm lint:i18n` → exit 0 (aucune chaîne JSX en dur).
- `npx vitest run apps/web/src/lib/admin apps/web/src/messages` → 51/51 verts (mappeurs Plan 01 + parité i18n).
- Greps d'acceptance Task 1 : candleColor|ageColor=12 (≥1), latestPerJob|runDurationMs=4 (≥1), re-derive is_stale=0, createAdminServiceClient=2, v_data_freshness=2, news=10, macro_series=1, requireRole=0.
- Greps d'acceptance Task 2 : count exact=2 (≥2), admin links=3 (≥3), Card=19 (≥3), candleColor|ageColor=6 (≥1), requireRole=0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] timeframe nullable dans v_data_freshness**
- **Found during:** Task 1 (tsc)
- **Issue:** `v_data_freshness.timeframe` typé `string | null` → `timeframeHours(raw: string)` rejetait l'argument (TS2345).
- **Fix:** Signature élargie à `timeframeHours(raw: string | null)` ; défaut sûr 1h conservé.
- **Files modified:** apps/web/src/app/(admin)/sante/page.tsx
- **Commit:** 4a0e6be

**2. [Rule 1 - Bug] Token 'requireRole' dans les commentaires d'en-tête**
- **Found during:** Tasks 1 & 2 (vérification acceptance)
- **Issue:** `grep -c "requireRole"` retournait 1 sur chaque fichier (mention dans le JSDoc documentant que le gate est owned par le layout). Critère exige 0.
- **Fix:** Reformulation des commentaires (« le layout applique déjà le gate superadmin »). Aucun guard inline n'a jamais été ajouté ; le comportement est conforme depuis le départ.
- **Files modified:** les deux fichiers
- **Commits:** 4a0e6be, d424698

## Threat Surface

Aucune nouvelle surface hors threat_model. Les deux fichiers sont RSC purs (pas de `'use client'`) ; `createAdminServiceClient()` est server-only (T-08-11). `is_stale` lu de la vue, jamais recalculé (T-08-12). Gate owned par le layout, jamais dupliqué (T-08-10). Zéro package npm (T-08-SC).

## Self-Check: PASSED

- Fichiers créés : (admin)/sante/page.tsx, (admin)/page.tsx → tous présents.
- Commits 4a0e6be, d424698 → présents dans git log.
