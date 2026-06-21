---
status: complete
phase: 11-composants-nexa-reskin-transversal-rebranding
source: [11-VERIFICATION.md]
started: 2026-06-21
updated: 2026-06-21
---

## Current Test

[testing complete — 4/4 validés par Borhane le 2026-06-21 (« tout est ok »)]

## Tests

### 1. Rendu visuel multi-locale (FR/EN/AR)
expected: Hero animé, baseline trilingue header/footer, et reskin NEXA s'affichent correctement dans les 3 locales ; le layout AR est en miroir RTL sans débordement ni chevauchement (notamment le bouton « Renouveler » de l'ExpiryBanner, corrigé en logique end-2/pe-18).
result: pass

### 2. Suite E2E Playwright (5 specs)
expected: i18n, affiliation-attribution, auth, gating, academie passent au vert sur un dev server avec env Supabase (ou Vercel preview). Sélecteurs name/type/h1/Disclaimer préservés.
result: pass

### 3. Comportement prefers-reduced-motion
expected: Avec reduced-motion activé au niveau OS, le hero rend une composition statique mais visible (globe/cartes/data-rain sans animation), pas d'écran vide ; double garde CSS @media + JS matchMedia.
result: pass

### 4. Theme flip dynamique CandleChart
expected: Bascule clair/sombre en live → la série bougies et les price lines se recolorent immédiatement (MutationObserver + applyOptions), sans remount ni perte du fetch RLS.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
