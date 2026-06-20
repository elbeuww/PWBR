---
status: complete
phase: 01-socle-transverse-i18n-rtl-r-les-gating
source: [01-VERIFICATION.md]
started: 2026-06-14T15:00:00Z
updated: 2026-06-20T00:00:00Z
---

## Current Test

[all tests resolved]

## Tests

### 1. Exécution runtime des 18 tests E2E Playwright
expected: 18 tests passent — `next dev` sur :3000 avec `.env.local` rempli + migrations 0008/0009/0010 live, puis `pnpm --filter web test:e2e` (i18n.spec.ts + gating.spec.ts + auth.spec.ts) : bascule fr→ar sur la même page, `dir=rtl` en arabe, redirection `/` → `/fr`, returnTo non vide sur surface member non-auth, auth-sans-abo → `/fr/tarifs`, admin non-superadmin → 404, `returnTo=//evil.com` reste sur l'origine, auth.spec.ts non régressé.
result: [pass] — Exécuté 2026-06-20 contre `next dev` :3000 + Supabase cloud : 24 tests verts (i18n 6/6, gating 13/13, auth 5/5) + 1 skip documenté (I18N-04). Tous les comportements ci-dessus confirmés. Bug réel trouvé+corrigé au passage : `localeDetection` laissait `/` partir sur `/en` (en-US) → fix `routing.ts` (`localeDetection:false`).

### 2. Rendu visuel de l'arabe en production
expected: Texte arabe lisible avec interlignage correct (IN-01 : aucun CDN Google Fonts configuré en P1 — accepté, reporté Phase 2 UI).
result: [skip] — Accepté-reporté (IN-01) : aucun CDN Google Fonts en P1, police système lisible, polish typographique reporté Phase UI. Non bloquant.

### 3. I18N-04 — formatage locale-aware
expected: Aucun test E2E requis en P1 (Manual-Only documenté dans 01-04-PLAN.md : aucune donnée numérique rendue dans l'UI avant P3). À ajouter dans i18n.spec.ts dès qu'une valeur formatée apparaît.
result: [skip] — Manual-Only documenté : aucune donnée numérique rendue dans l'UI avant P3 ; `test.skip()` en place. À activer dès qu'une valeur formatée apparaît.

## Summary

total: 3
passed: 1
issues: 0
pending: 0
skipped: 2
blocked: 0

## Gaps

Aucun. Item testable (E2E) vert le 2026-06-20 ; items 2-3 documentés (acceptation IN-01 + Manual-Only P1).
