---
phase: 11-composants-nexa-reskin-transversal-rebranding
plan: 08
subsystem: ui-reskin
tags: [reskin, nexa, vitrine, academie, auth, admin, expiry-banner, phase-gate]
requires:
  - "11-03 (ExpiryBanner tokenisé)"
  - "11-04/05/06/07 (composants NEXA, recoloration, rebranding, hero, membre)"
provides:
  - "UI-01 vitrine (tarifs/methodologie) au design NEXA"
  - "UI-04 Académie index au design NEXA"
  - "UI-05 auth (login/signup) + compte/abonnement au design NEXA"
  - "UI-06 admin reskiné sobre (D-18)"
  - "UI-07 ExpiryBanner câblé sur (account)/abonnement (dette WIRING-01/PAY-05 levée)"
  - "Gate de phase 11 : suite unit verte + 5 specs E2E préservées"
affects:
  - "apps/web/src/app/[locale]/(marketing)/{tarifs,methodologie,academie}"
  - "apps/web/src/app/[locale]/(auth)/{login,signup}"
  - "apps/web/src/app/[locale]/(account)/abonnement"
  - "apps/web/src/app/(admin)/page.tsx"
  - "apps/web/src/messages/{fr,en,ar}.json (clé eyebrow)"
tech-stack:
  added: []
  patterns:
    - "Reskin = composition NEXA (Eyebrow + font-display + tokens) ; primitifs ui/ auto-reskinés, JAMAIS forkés"
    - "Fetch RLS anon-client serveur (createClient) pour current_period_end ; aucun service_role client"
key-files:
  created: []
  modified:
    - "apps/web/src/app/[locale]/(account)/abonnement/page.tsx"
    - "apps/web/src/app/[locale]/(marketing)/tarifs/page.tsx"
    - "apps/web/src/app/[locale]/(marketing)/methodologie/page.tsx"
    - "apps/web/src/app/[locale]/(marketing)/academie/page.tsx"
    - "apps/web/src/app/[locale]/(auth)/login/page.tsx"
    - "apps/web/src/app/[locale]/(auth)/signup/page.tsx"
    - "apps/web/src/app/(admin)/page.tsx"
    - "apps/web/src/messages/fr.json"
    - "apps/web/src/messages/en.json"
    - "apps/web/src/messages/ar.json"
decisions:
  - "D-11-08-A : eyebrow i18n keys ajoutées (pricing/methodology/academy/auth, fr/en/ar parité) — Eyebrow exige un label traduit, aucune clé réutilisable existante"
  - "D-11-08-B : token de titre = font-display (Archivo, défini en @theme), PAS font-heading (utilitaire no-op, non mappé dans @theme) — corrige une dérive latente sur les fichiers touchés"
  - "D-11-08-C : Disclaimer index Académie = satisfait par le Footer global ([locale]/layout.tsx) — pas de Disclaimer dédié dupliqué ; pages détail gardent le leur"
  - "D-11-08-D : admin dots vert/ambre/rouge = sémantique feux de fraîcheur données, PAS couleur de marque → conservés (D-18 sobre respecté, aucun hero/animation/Eyebrow)"
  - "D-11-08-E : E2E GREEN in-session = human-verify (precedent D-01-04-C ; dev server + Vercel preview requis, `!` du chemin casse le build local) — 5 specs parsent, sélecteurs préservés (35 tests listés)"
metrics:
  duration: "~25min"
  completed: "2026-06-21"
  tasks: 3
  files: 10
---

# Phase 11 Plan 08 : Reskin transversal NEXA + ExpiryBanner + gate de phase Summary

Reskin NEXA des surfaces restantes (vitrine, Académie, auth, compte, admin sobre) via composition tokens + Eyebrow + font-display, levée de la dette UI-07 (ExpiryBanner câblé sur abonnement via fetch RLS serveur), et passage du gate de phase (suite unit verte, 5 specs E2E préservées).

## What Was Built

### Task 1 — ExpiryBanner sur (account)/abonnement (UI-07, commit 8112e0e)
`abonnement/page.tsx` (RSC) câble désormais l'ExpiryBanner : `requireUser()` + `createClient()` serveur (anon-client RLS) → select `subscriptions.current_period_end` (`status='active'`, dernier `current_period_end`, `maybeSingle`) en réutilisant EXACTEMENT le pattern `(member)/layout.tsx:23-34`. Rendu `<ExpiryBanner currentPeriodEnd={sub?.current_period_end ?? null} />` en tête du `<main>`, au-dessus du PlanCard. Aucun `service_role`, aucun fetch client ajouté. PlanCard/QueryProvider/i18n préservés. **Dette WIRING-01/PAY-05 close** : le bandeau J-3/J-1 est désormais visible côté membre ET côté compte/abonnement.

### Task 2 — Reskin vitrine + Académie + auth + admin sobre (UI-01/04/05/06, commit d3a4dea)
- **Vitrine** (tarifs, methodologie) : Eyebrow + h1 `font-display`. ConfidenceStat/track-record inchangés (aucun % nu). Disclaimer (methodologie + Footer global) préservé.
- **Académie** (index) : Eyebrow + h1 `font-display`. RTL + fallback FR préservés (logique inchangée). Disclaimer satisfait par le Footer global ; pages détail gardent le leur.
- **Auth** (login/signup) : forms NEXA via primitifs `Input`/`Button` tokenisés + Eyebrow. **Rule 1** : couleurs hardcodées (`bg-[#2563EB]`, `border-black/15`) remplacées par tokens (`accent-brand`, `border-input`). `name`/`type`/`required`/`autoComplete`/`minLength` préservés (sélecteurs E2E auth intacts). Aucun changement de logique auth (`signIn`/`signUp`).
- **Admin** (page.tsx) : reskin SOBRE (D-18) — `font-display` sur le titre uniquement, AUCUN hero/animation/Eyebrow. Dots de fraîcheur (vert/ambre/rouge) conservés (sémantique feux données, pas marque).
- i18n : clé `eyebrow` ajoutée aux namespaces `pricing`/`methodology`/`academy`/`auth` en fr/en/ar (parité stricte).

### Task 3 — Gate de phase (préservation, aucun fichier modifié)
Aucun data-testid à restaurer (tous les sélecteurs E2E préservés par construction). Gate exécuté :
- **Suite unit complète** : `pnpm vitest run` → **582 passed | 4 skipped | 0 failed** (74 fichiers). Inclut no-perf-claims, no-mera-brand, rtl-logical-props, parité i18n fr/en/ar — tous verts.
- **Typecheck** : `pnpm --filter web exec tsc -b --noEmit` → exit 0.
- **lint:i18n** : `node scripts/check-i18n-hardcoded.mjs` → exit 0 (aucune chaîne en dur).
- **5 specs E2E** : `playwright test e2e/ --list` → **35 tests dans 5 fichiers** (i18n, affiliation-attribution, auth, gating, academie), parse OK, sélecteurs préservés. ROADMAP "6 specs" = coquille confirmée (5 existent). **Aucune 6e spec créée.**

## Verification Results

| Gate | Commande | Résultat |
|------|----------|----------|
| Unit suite | `pnpm vitest run` | 582 passed / 4 skipped / 0 failed |
| no-perf-claims | (inclus) | vert |
| no-mera-brand | (inclus) | vert |
| rtl-logical-props | (inclus) | vert |
| parité i18n fr/en/ar | (inclus) | vert |
| Typecheck | `tsc -b --noEmit` | exit 0 |
| lint:i18n | `check-i18n-hardcoded.mjs` | exit 0 |
| E2E parse + sélecteurs | `playwright test e2e/ --list` | 35 tests, 5 fichiers, OK |
| Aucun fork primitif ui/ | `git status` | confirmé |

## E2E — statut human-verify

L'exécution GREEN autoritaire des 5 specs exige un dev server `:3000` + `.env.local` Supabase + (pour academie) Vercel preview — le `!` du chemin projet casse le build local turbopack/webpack (RESEARCH Pitfall 2 ; header academie.spec). Conformément au precedent **D-01-04-C**, l'exécution in-session est documentée **human-verify**. Preuves apportées sans serveur : les 5 specs parsent (35 tests listés) et les sélecteurs qu'elles ciblent sont préservés :
- `auth.spec` : `input[name="email"]`, `input[name="password"]`, `button[type="submit"]` (forwarded par Input/Button) — présents.
- `academie.spec` : `h1`, `main p`, liens `a[href*="/academie"]`, Disclaimer (Footer global + pages détail) — présents.
- `i18n`/`gating`/`affiliation-attribution` : aucune surface ciblée modifiée par le reskin (logique auth/gating/i18n inchangée).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Couleurs hardcodées dans les forms auth**
- **Found during:** Task 2 (login/signup)
- **Issue:** `bg-[#2563EB]` (bleu institutionnel hérité v2.0, hors palette NEXA) et `border-black/15` en dur sur boutons/inputs — incompatibles avec le reskin NEXA et les thèmes clair/sombre.
- **Fix:** Remplacés par les primitifs `Input`/`Button` tokenisés (auto-reskinés via tokens shadcn) + lien `text-[var(--accent-brand)]`. `name`/`type`/`required`/`autoComplete`/`minLength` préservés.
- **Files modified:** login/page.tsx, signup/page.tsx
- **Commit:** d3a4dea

**2. [Rule 1 - Bug] Token de titre incorrect (font-heading no-op)**
- **Found during:** Task 2
- **Issue:** `font-heading` n'est PAS défini dans `@theme` (globals.css n'expose que `--font-display` → Archivo). `font-heading` produit un utilitaire sans CSS (titre rendu en font par défaut). methodologie l'utilisait déjà (dérive latente).
- **Fix:** Tous les titres des fichiers touchés utilisent `font-display` (vrai token de titre NEXA). Les autres occurrences `font-heading` hors scope du plan loggées comme dette mineure (non corrigées — surgical scope).
- **Files modified:** tarifs, methodologie, academie, login, signup, admin
- **Commit:** d3a4dea

### Added i18n keys (conformité Eyebrow)
Clé `eyebrow` ajoutée à `pricing`/`methodology`/`academy`/`auth` (fr/en/ar) — nécessaire au label traduit de l'Eyebrow, aucune clé existante réutilisable. Parité 3 langues respectée (tests parité verts).

## Threat Surface

| Threat ID | Disposition | Statut |
|-----------|-------------|--------|
| T-11-RLS | mitigate | OK — fetch RLS anon-client serveur, aucun service_role client (Task 1) |
| T-11-DISC | mitigate | OK — Disclaimer préservé sur chaque surface (Footer global + pages détail) |
| T-11-E2E | mitigate | OK — 5 specs parsent, data-testid/sélecteurs préservés |
| T-11-PERF | mitigate | OK — no-perf-claims vert, aucun % nu introduit |
| T-11-SC | mitigate | OK — aucun package npm installé |

Aucune nouvelle surface de menace introduite (pas de nouvel endpoint, auth path, ni accès fichier).

## Known Stubs

Aucun. Toutes les surfaces rendent des données réelles (catalogue Académie via fs, KPI admin via service_role server-only, ExpiryBanner via fetch RLS).

## Self-Check: PASSED
- Fichiers modifiés vérifiés présents (10/10).
- Commits 8112e0e + d3a4dea présents dans git log.
- Gate unit vert (582 passed), typecheck exit 0, lint:i18n exit 0.
