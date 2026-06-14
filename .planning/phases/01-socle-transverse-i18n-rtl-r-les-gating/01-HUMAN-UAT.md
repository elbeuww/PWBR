---
status: partial
phase: 01-socle-transverse-i18n-rtl-r-les-gating
source: [01-VERIFICATION.md]
started: 2026-06-14T15:00:00Z
updated: 2026-06-14T15:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Exécution runtime des 18 tests E2E Playwright
expected: 18 tests passent — `next dev` sur :3000 avec `.env.local` rempli + migrations 0008/0009/0010 live, puis `pnpm --filter web test:e2e` (i18n.spec.ts + gating.spec.ts + auth.spec.ts) : bascule fr→ar sur la même page, `dir=rtl` en arabe, redirection `/` → `/fr`, returnTo non vide sur surface member non-auth, auth-sans-abo → `/fr/tarifs`, admin non-superadmin → 404, `returnTo=//evil.com` reste sur l'origine, auth.spec.ts non régressé.
result: [pending]

### 2. Rendu visuel de l'arabe en production
expected: Texte arabe lisible avec interlignage correct (IN-01 : aucun CDN Google Fonts configuré en P1 — accepté, reporté Phase 2 UI).
result: [pending]

### 3. I18N-04 — formatage locale-aware
expected: Aucun test E2E requis en P1 (Manual-Only documenté dans 01-04-PLAN.md : aucune donnée numérique rendue dans l'UI avant P3). À ajouter dans i18n.spec.ts dès qu'une valeur formatée apparaît.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
