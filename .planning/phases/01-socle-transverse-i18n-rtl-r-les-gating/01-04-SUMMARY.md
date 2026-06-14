---
phase: 01-socle-transverse-i18n-rtl-r-les-gating
plan: 04
subsystem: tests-e2e-i18n-gating
tags: [e2e, playwright, i18n, rtl, gating, security, ci]
requires:
  - "01-01 (migrations 0008/0009 LIVE, gating RLS)"
  - "01-02 (next-intl 4.13, messages fr/en/ar)"
  - "01-03 (shell [locale], middleware composé, gate.ts, LanguageSwitcher)"
provides:
  - "Couverture E2E des 8 success criteria de la phase (i18n/RTL + gating/redirections)"
  - "Garde-fou CI anti-chaîne-dure (lint:i18n) — barrière de régression I18N-03"
  - "auth.spec.ts réparé pour les URLs localisées /fr/…"
affects:
  - "CI (nouveau script lint:i18n) ; suite E2E Playwright (3 specs, 18 tests)"
tech-stack:
  added: []
  patterns:
    - "E2E contre app live = vérification de la frontière sécurité au niveau UX"
    - "Check statique Node natif (zéro dépendance) pour interdire le texte en dur dans le JSX"
key-files:
  created:
    - apps/web/e2e/i18n.spec.ts
    - apps/web/e2e/gating.spec.ts
    - scripts/check-i18n-hardcoded.mjs
    - apps/web/src/app/[locale]/(member)/signaux/page.tsx
  modified:
    - apps/web/e2e/auth.spec.ts
    - package.json
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/messages/fr.json
    - apps/web/src/messages/en.json
    - apps/web/src/messages/ar.json
decisions:
  - "D-01-04-A : surface membre minimale [locale]/(member)/signaux créée pour activer requireActiveSub et rendre D-07 testable en E2E (le groupe (member) n'avait qu'un layout, aucun page → aucune URL membre ne déclenchait le gate)."
  - "D-01-04-B : nom de marque 'Vétéran Trading' marqué // i18n-ignore (autonyme jamais traduit) plutôt qu'externalisé en messages — choix produit, pas une chaîne traduisible."
  - "D-01-04-C : I18N-04 (formatage locale-aware) reste Manual-Only en P1 (aucune donnée numérique rendue) ; test skip explicite documenté, à activer en P3."
metrics:
  duration: ~30 min
  tasks: 3
  files: 9
  completed: 2026-06-14
---

# Phase 01 Plan 04 : Tests E2E i18n/RTL & gating + check anti-chaîne-dure — Summary

Filet Nyquist de la phase : 18 tests Playwright (3 specs) prouvent de bout en bout les redirections de gate (ACCESS-01/02/03 + open-redirect T-01-07) et la bascule i18n/RTL (I18N-01/02), plus un check statique Node (`lint:i18n`) qui interdit durablement tout texte utilisateur en dur dans le JSX (I18N-03) ; `auth.spec.ts` réparé pour les URLs `/fr/…`.

## What Was Built

- **apps/web/e2e/i18n.spec.ts** (I18N-01/02) : `/` → `/fr` (defaultLocale), bascule fr→ar via LanguageSwitcher en restant sur la même page, persistance après reload (cookie NEXT_LOCALE), `<html dir=rtl lang=ar>` en arabe vs `dir=ltr` en fr/en. I18N-04 explicitement `test.skip` (Manual-Only P1).
- **apps/web/e2e/gating.spec.ts** (ACCESS-01/02/03 + T-01-07) : non-auth sur `(member)` → `/fr/login?returnTo=…` ; user sans abo → `/fr/tarifs` (D-07, MANDATORY) ; `(admin)` → 404 pour non-auth ET non-superadmin (D-09, jamais 403) ; `returnTo=//evil.com` ne redirige pas hors origine après login.
- **apps/web/e2e/auth.spec.ts** (réparé) : toutes les URLs nues `/signup`,`/dashboard`,`/login` → `/fr/…`. Logique inchangée.
- **scripts/check-i18n-hardcoded.mjs** + script `lint:i18n` : scanne `app/**` et `components/**`, flag le texte JSX littéral et les attributs visibles (placeholder/aria-label/title/alt) hors `t(...)`, exit 1 (fichier:ligne) sur violation, 0 sinon. Support `// i18n-ignore`, autonymes de langue exclus.
- **apps/web/src/app/[locale]/(member)/signaux/page.tsx** (nouveau) : surface membre minimale activant `requireActiveSub` (sinon D-07 non déclenchable). Chaînes via namespace `signals` (fr/en/ar, parité stricte).

## Verification Results

| Vérification | Commande | Résultat |
|---|---|---|
| Task 1 static | `test -f i18n.spec.ts && grep dir && grep /fr/ auth.spec.ts` | ✅ OK |
| Task 2 static | `grep returnTo/404/tarifs/evil.com gating.spec.ts` | ✅ OK |
| Task 3 check | `pnpm lint:i18n` | ✅ exit 0 (« aucune chaîne en dur ») |
| Check détecte bien | chaîne plantée dans tarifs/page.tsx | ✅ exit 1 + file:line, revert propre |
| Typecheck monorepo | `pnpm typecheck --force` | ✅ exit 0 (aucune nouvelle erreur) |
| Playwright parse/list | `npx playwright test --list` | ✅ 18 tests / 3 specs listés sans erreur |

## E2E Execution Honesty (playwright_note)

Les 18 specs sont **authorées, syntaxiquement valides et découvertes par le runner** (`--list` OK). Elles n'ont **PAS été exécutées en vert** dans cette session : aucun dev server (`http://localhost:3000` → HTTP 000) ni `.env.local` (Supabase URL/ANON) n'étaient disponibles. Les navigateurs Playwright sont installés. Aucune exécution verte n'est fabriquée.

**À vérifier humainement (GREEN E2E) :**
1. Remplir `apps/web/.env.local` (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY) ; « Confirm email » désactivé (D-02).
2. `pnpm dev` (next dev sur :3000).
3. `pnpm test:e2e` → attendu : auth.spec (5) + i18n.spec (6 + 1 skip) + gating.spec (6) verts.
4. Revue visuelle RTL arabe (`/ar/login`, `/ar/signaux`) — miroir layout (Manual-Only I18N-02).

## Deviations from Plan

### Auto-added (Rule 2 — critical functionality)

**1. [Rule 2] Surface membre `(member)/signaux/page.tsx` créée**
- **Found during:** Task 2. Le groupe `(member)` ne contenait qu'un `layout.tsx` (aucun `page.tsx`) → aucune URL membre ne résolvait, donc `requireActiveSub` (D-07) n'était jamais déclenché par une route. D-07 est MANDATORY en E2E.
- **Fix:** page minimale `signaux` sous `(member)` + namespace messages `signals` (fr/en/ar). Le gate du layout parent s'applique : auth-sans-abo → `/tarifs`, non-auth → `/login+returnTo`.
- **Files:** `apps/web/src/app/[locale]/(member)/signaux/page.tsx`, `messages/{fr,en,ar}.json`
- **Commit:** 5cf68db

### Auto-fixed (Rule 3 — blocking the check)

**2. [Rule 3] `// i18n-ignore` sur le nom de marque 'Vétéran Trading'**
- **Found during:** Task 3. Le check signalait `layout.tsx:43 Vétéran Trading`.
- **Fix:** marqueur `// i18n-ignore: marque` en bout de ligne (autonyme de marque, non traduisible). Le check repasse vert.
- **Files:** `apps/web/src/app/[locale]/layout.tsx`
- **Commit:** 8a6e59e

## Known Stubs

- `[locale]/(member)/signaux/page.tsx` : placeholder volontaire (titre + body via messages). Le contenu réel des signaux (trade_setups/analyses via RLS ACCESS-02) arrive en **Phase 3**. Stub documenté, n'empêche pas l'objectif du plan (activer le gate D-07) ; chaînes déjà i18n-isées.

## Baseline (non régressé)

`tsc -b --force` sort 0. L'erreur baseline documentée (`__lint_fixtures__/forbidden-service-import.ts`, fixture ESLint v1.0) n'apparaît pas sous `tsc -b` (fichier hors graphe de build, géré par ESLint seul) — aucune nouvelle erreur introduite.

## Commits

- 700cffb — test(01-04): localise auth.spec URLs + e2e i18n.spec (I18N-01/02)
- 5cf68db — test(01-04): e2e gating.spec (ACCESS-01/02/03 + open-redirect T-01-07)
- 8a6e59e — chore(01-04): check statique anti-chaine-dure i18n + script lint:i18n (I18N-03)

## Self-Check: PASSED

- Fichiers créés : i18n.spec.ts, gating.spec.ts, check-i18n-hardcoded.mjs, (member)/signaux/page.tsx, 01-04-SUMMARY.md — tous présents.
- Commits 700cffb / 5cf68db / 8a6e59e — tous présents dans git log.
