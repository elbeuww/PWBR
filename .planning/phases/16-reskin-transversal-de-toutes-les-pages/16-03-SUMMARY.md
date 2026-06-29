---
phase: 16-reskin-transversal-de-toutes-les-pages
plan: 03
subsystem: reskin-app-tier2
tags: [reskin, tier2, auth, account, member, funnel, glow, data-rain, rls, lwc, tokens]
requires:
  - "Plan 16-01 (gates rls-unchanged + lwc-recolor-intact + theme-scan étendu, primitives glow/data-rain)"
  - "Phase 15 DS v3 dark unique (couche token --primary/--glow/--signal-*/--destructive)"
provides:
  - "Auth (login/signup) Tier 2 calme : text-primary, glow sur CTA, data-rain ambiant reduced-motion"
  - "Dashboard residual offender corrigé (text-red-600 → text-destructive) + accent Tier 2"
  - "Account/abonnement + paiement-bientot + affiliation accent Tier 2 discret (filet --primary)"
  - "Membre dense (liste + détail trade) readability-first : glow sur cartes/en-tête seulement"
  - "RLS fetch byte-identique sur toutes les surfaces gated ; CandleChart verbatim (D-11)"
affects:
  - "Plan 16-04 (admin + bucket résiduel) — theme-scan Test 2 reste RED sur SES offenders admin"
tech-stack:
  added: []
  patterns:
    - "Glow Tier 2 = glowClass('soft') (box-shadow var(--glow)) — jamais ring-* (C-3/D-08)"
    - "Data-rain ambiant UNIQUEMENT sur surfaces calmes (auth) ; jamais sur données denses (D-05/D-14)"
    - "Accent Tier 2 sur surface dense/funnel = filet token --primary (h-px bg-primary/60), pas de voile"
    - "Readability-first dense (membre) : glow sur cartes/en-tête seulement, aucun gradient/aura"
key-files:
  created: []
  modified:
    - "apps/web/src/app/[locale]/(auth)/login/page.tsx"
    - "apps/web/src/app/[locale]/(auth)/signup/page.tsx"
    - "apps/web/src/app/[locale]/(account)/abonnement/page.tsx"
    - "apps/web/src/app/[locale]/(marketing)/paiement-bientot/page.tsx"
    - "apps/web/src/app/[locale]/dashboard/page.tsx"
    - "apps/web/src/app/[locale]/affiliation/page.tsx"
    - "apps/web/src/components/signals/SignalCard.tsx"
    - "apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx"
decisions:
  - "D-16-03-A : SignalList/FilterBar/SignalDetail/signaux/page.tsx (liste) étaient DÉJÀ token-purs (zéro littéral de palette, tokens --signal-*/bg-card/ring-ring/bg-muted/text-primary). Readability-first impose le glow sur CARTES seulement → glow appliqué via SignalCard (la carte) + l'en-tête de la route détail. Ces 4 fichiers n'avaient aucun travail de tokenisation ni d'accent à porter (le glow déborderait sur des listes/tables, interdit D-05) → laissés intacts. Déviation au files_modified du plan, conforme à C-6/D-05."
  - "D-16-03-B : surfaces denses/funnel non-auth (dashboard, abonnement, paiement-bientot, affiliation) reçoivent un accent Tier 2 = filet token --primary (h-px w-16 bg-primary/60), PAS de data-rain (réservé aux surfaces calmes auth, D-14). Le data-rain ambiant n'est posé QUE sur login + signup."
  - "D-16-03-C : SignalList.tsx importe légitimement lib/supabase/client (browser) pour le canal Realtime (pattern D-13/T-03-RT pré-existant). Ce n'est PAS une infraction rls-unchanged (le scan ne couvre que app/[locale]/** pages/layouts, pas les composants client). Fichier non touché."
  - "D-16-03-D : theme-scan Test 2 reste RED MAIS exclusivement sur (admin)/page.tsx + (admin)/sante/page.tsx (bg-emerald-500/bg-amber-500), fichiers du bucket admin (plan 16-04). Aucun fichier de plan 16-03 ne contribue d'offender. Comportement de gate TDD étagé (D-16-01-B / D-16-02-B)."
metrics:
  duration: "~10 min"
  tasks: 2
  files: 8
  completed: "2026-06-23"
---

# Phase 16 Plan 03 : Reskin Tier 2 app (auth + compte + membre + funnel) — Summary

Wave 2 du reskin, axe le plus sensible : les surfaces qui portent les **lectures gated RLS** (espace membre, compte) passent sous l'identité dark néon Tier 2 avec l'**accent discret** (glow), tandis que **chaque fetch RLS reste byte-identique** et **CandleChart reste verbatim** (D-11). Reskin className/markup UNIQUEMENT.

## What Was Built

**Task 1 — Tier 2 auth + compte + funnel (6 surfaces) :**
- `login` / `signup` (surfaces calmes) : swap legacy `text-[var(--accent-brand)]` → `text-primary` ; glow Tier 2 discret sur le bouton submit (`glowClass('soft')`, box-shadow `var(--glow)`, jamais un ring) ; data-rain ambiant très subtil (`<DataRain />`, reduced-motion double-gardé) — sur auth UNIQUEMENT.
- `dashboard` : residual offender corrigé `text-red-600` → `text-destructive` ; bouton sign-out tokenisé (border + hover:bg-muted) ; filet d'accent Tier 2 `--primary` ; surface dense → aucun voile ambiant.
- `abonnement` (compte, gated par requireUser dans le layout) : filet d'accent Tier 2 `--primary` sous le titre ; ExpiryBanner + fetch RLS `subscriptions` INCHANGÉS.
- `paiement-bientot` + `affiliation` : filet d'accent Tier 2 `--primary` discret.

**Task 2 — Tier 2 membre dense, readability-first (2 fichiers) :**
- `SignalCard` : glow discret sur la CARTE seulement (`glowClass('soft')`), conforme readability-first (D-05) — pas de gradient, pas d'aura, pas de voile ambiant.
- `signaux/[id]` (détail) : glow discret sur la carte d'en-tête seulement ; le fetch anti-IDOR (`createClient` + `from('trade_setups').eq('status','active').maybeSingle()` + validation Zod payload) et le fetch `candles` sont INCHANGÉS ; CandleChart non touché.

## État de vérification

| Gate | État | Note |
|------|------|------|
| `rls-unchanged` (T-16-01) | GREEN (3/3) | aucune page member/account/marketing/auth n'importe service_role ni ne migre un fetch client |
| `lwc-recolor-intact` (T-16-02) | GREEN (3/3) | getComputedStyle/applyOptions/MutationObserver intacts, zéro couleur de bougie littérale |
| CandleChart.tsx diff | VIDE | chart verbatim-préservé (D-11 / Pattern C) |
| member fetch diff | VIDE | createClient + fetchActiveSignals + anti-IDOR byte-identiques |
| `no-perf-claims` | GREEN (5/5) | aucune promesse de gain |
| `rtl-logical-props` | GREEN (3/3) | aucune classe directionnelle physique |
| `theme-scan` Test 1/3/SANITY | GREEN | |
| `theme-scan` Test 2 | RED — offenders HORS plan 03 | (admin)/page.tsx + (admin)/sante/page.tsx (bucket admin plan 16-04) |
| `pnpm typecheck` (tsc -b --noEmit) | 0 erreur | |
| `pnpm lint:i18n` | exit 0 | aucune chaîne en dur |
| data-rain hors auth | absent | grep DataRain/data-rain = 0 sur account/member/funnel/dashboard ; présent login+signup |
| data-testid / ARIA diff | aucun retrait/renommage | specs E2E gating/auth préservées |

Le seul RED (theme-scan Test 2) est intégralement imputable aux 2 fichiers admin du plan 16-04. Aucun fichier de CE plan ne contribue d'offender — comportement de gate TDD étagé documenté par les plans 01/02.

## Deviations from Plan

### Auto-fixed Issues / écarts de cohérence

**1. [Rule 1 - Précision] 4 fichiers `files_modified` non touchés car déjà token-purs**
- **Trouvé pendant :** Task 2 (lecture des fichiers membre).
- **Écart :** le plan listait `signaux/page.tsx` (liste), `SignalList.tsx`, `FilterBar.tsx`, `SignalDetail.tsx` dans `files_modified`. Or ces 4 fichiers étaient DÉJÀ entièrement token-purs (tokens `--signal-bullish/bearish`, `bg-card`, `ring-ring`, `ring-foreground/10`, `bg-muted`, `text-primary`, `border-input`, `border-foreground/10`) — aucun littéral de palette, aucun `ring-[#…]`.
- **Décision :** readability-first (D-05/C-6) impose le glow sur les CARTES uniquement, pas sur les listes/tables/contrôles de filtre/contenu de détail. Le glow a donc été appliqué via `SignalCard` (la carte) + l'en-tête de la route détail. Appliquer un glow sur la liste/FilterBar/contenu détail violerait D-05 (« glow on cards only, no heavy neon on dense data »). Ces 4 fichiers n'avaient ni tokenisation ni accent à porter → laissés intacts (frontière de scope : ne modifier que le nécessaire).

**2. [Rule 3 - Cohérence] data-rain réservé aux surfaces calmes auth uniquement**
- **Trouvé pendant :** Task 1.
- **Écart :** le plan permet le data-rain « ambient eligible » sur les surfaces calmes mais l'interdit sur les surfaces denses. dashboard et abonnement affichent des données denses (table d'instruments, cartes de paiement).
- **Décision :** data-rain posé UNIQUEMENT sur login + signup. dashboard/abonnement/paiement-bientot/affiliation reçoivent un accent Tier 2 alternatif (filet token `--primary`) — accent présent (anti « tokenisé mais fade », C-6) sans voile sur données denses (D-05/D-14). Acceptance grep confirmée : data-rain présent en (auth) uniquement, zéro ailleurs.

**3. [Rule 1 - Bug] littéral `data-rain` dans des commentaires déclenchait le grep d'acceptance**
- **Trouvé pendant :** vérification d'acceptance Task 1 + Task 2.
- **Issue :** mes commentaires « pas de data-rain sur surface dense » contenaient le substring `data-rain`, faisant matcher le grep d'acceptance `DataRain|data-rain` sur abonnement/dashboard/SignalCard (l'opposé d'une infraction).
- **Fix :** reformulé en « pas de voile ambiant » / « aucun voile ambiant ». Le grep d'acceptance retourne désormais zéro hors auth.
- **Fichiers :** abonnement/page.tsx, dashboard/page.tsx, SignalCard.tsx.

## Known Stubs

Aucun. Toutes les surfaces restent fonctionnelles ; les fetch RLS et l'ExpiryBanner sont préservés et opérationnels. Le placeholder légal et le funnel paiement-bientot (P4) sont des états produit intentionnels gérés hors phase, pas des stubs de reskin.

## Threat Flags

Aucune nouvelle surface de sécurité. Le reskin touche className/markup UNIQUEMENT :
- T-16-03-01 (IDOR membre) : `rls-unchanged` GREEN, fetch `signaux`/`[id]` byte-identique, aucun service_role, aucune migration client.
- T-16-03-02 (CandleChart) : diff VIDE, `lwc-recolor-intact` GREEN.
- T-16-03-03 (auth) : login/signup render-only, gates dans les layouts (non touchés), aucun service_role.
- T-16-03-SC : zéro install npm (primitives glow/data-rain réutilisées du plan 16-01).

## Commits

- `e94fa2d` feat(16-03): Tier 2 reskin auth + account + funnel surfaces
- `fda34b6` feat(16-03): Tier 2 member dense surfaces, readability-first glow on cards only

## Self-Check: PASSED

Fichiers modifiés vérifiés présents (8/8 : login, signup, abonnement, paiement-bientot, dashboard, affiliation, SignalCard, signaux/[id]). Commits e94fa2d + fda34b6 présents dans git log. rls-unchanged + lwc-recolor-intact GREEN, CandleChart diff vide, member fetch diff vide, no-perf-claims/rtl-logical-props GREEN, typecheck 0 erreur, lint:i18n exit 0, data-rain en (auth) uniquement. RED résiduel de theme-scan Test 2 imputé hors plan 03 (bucket admin, plan 16-04).
