---
phase: 03-espace-membre-signaux-gated-rls
plan: 03
subsystem: ui
tags: [lightweight-charts, next-dynamic, rls, next-intl, i18n, signals, rtl, tdd, idor]

# Dependency graph
requires:
  - phase: 03-espace-membre-signaux-gated-rls (Plan 03-01)
    provides: "format.ts (formatPrice/formatRelativeAge), shadcn collapsible/tooltip, lightweight-charts 5.2.0, namespaces i18n signalDetail/glossary, migration 0011 (RLS candles gatée)"
  - phase: 03-espace-membre-signaux-gated-rls (Plan 03-02)
    provides: "queries.ts (anon-client pattern), SignalsDisclaimerBanner, color law D-03 (SignalCard), page LISTE /signaux"
  - phase: 01-socle-transverse
    provides: "client anon serveur (@supabase/ssr), groupe (member)+requireActiveSub (gate au layout), navigation i18n localisée, vitest config (alias workspace + .env.test)"
provides:
  - "Surface DÉTAIL membre : route RSC /signaux/[id] lit trade_setup actif by id + candles via anon-client + RLS (MEMB-03)"
  - "Anti-IDOR : maybeSingle by id + status=active → signal expiré/inexistant/non-autorisé = notFound (aucune fuite, T-03-IDOR)"
  - "CandleChart lightweight-charts v5 lecture seule (handleScroll/Scale false), price lines entrée/SL/TP légendées, monté next/dynamic ssr:false (Pitfall 5)"
  - "SignalDetail niveau 1 (explication simple : veteran_note VERBATIM + plan résumé) → niveau 2 (analyse approfondie dépliable, raisons/news/invalidation/risk events VERBATIM) (MEMB-04, D-09/D-10)"
  - "ContributingFactors : repli D-11 (liste dérivée des *_reasons + barre neutre globale, AUCUN graphe de décomposition)"
  - "GlossaryTooltip : aide additive (tooltip shadcn) sur le jargon, sans altérer le contenu IA"
  - "Test SignalDetail.test.tsx : contenu IA rendu VERBATIM + score == colonne + zéro injection HTML (T-03-XSS)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chart client-only = next/dynamic(() => import(...).then(m => m.X), { ssr:false }) depuis un RSC (Pitfall 5)"
    - "Détail gated = anon-client + maybeSingle(by id, status=active) ; RLS = barrière, notFound = réponse uniforme (anti-IDOR)"
    - "Contenu IA VERBATIM = enfant texte React {p.champ}, jamais d'injection HTML, jamais une clé i18n (seuls les titres de section le sont)"
    - "Niveau 2 collapsible = CollapsibleContent forceMount + data-[state=closed]:hidden → contenu dans le DOM (SEO/a11y) et assertable en test"
    - "Test composant sans jsdom = renderToStaticMarkup (react-dom/server) en environnement node + oxc jsx:automatic (vitest 4 / rolldown)"

key-files:
  created:
    - apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx
    - apps/web/src/components/signals/CandleChart.tsx
    - apps/web/src/components/signals/SignalDetail.tsx
    - apps/web/src/components/signals/ContributingFactors.tsx
    - apps/web/src/components/signals/GlossaryTooltip.tsx
    - apps/web/src/components/signals/__tests__/SignalDetail.test.tsx
  modified:
    - apps/web/src/messages/fr.json
    - apps/web/src/messages/en.json
    - apps/web/src/messages/ar.json
    - vitest.config.ts

key-decisions:
  - "D-03-03-A : test composant via renderToStaticMarkup (react-dom/server, déjà présent) en env node, SANS installer jsdom/@testing-library/@vitejs-plugin-react. Évite 3 nouvelles deps pour un seul test verbatim ; l'assertion porte sur le markup string (contient veteran_note/reason/invalidation + score)."
  - "D-03-03-B : vitest 4 (rolldown) utilise oxc, pas esbuild → JSX activé via `oxc: { jsx: 'automatic' }` (l'option esbuild est ignorée). include étendu à .test.tsx. Le test lui-même est écrit en React.createElement (pas de JSX) pour rester un script TS robuste."
  - "D-03-03-C : Niveau 2 = CollapsibleContent `forceMount` + `data-[state=closed]:hidden`. Le contenu approfondi reste dans le DOM (replié visuellement) → meilleur SEO/a11y ET assertable verbatim sans simuler le clic. `motion-reduce:transition-none` respecte prefers-reduced-motion."
  - "D-03-03-D : CandleChart utilise `autoSize: true` (lightweight-charts v5) + ResizeObserver de repli ; render-fail capté en try/catch → message `chartUnavailable` (le plan résumé reste lisible, D-09). dir='ltr' forcé sur le canvas (D-12), valeurs hors-canvas en <bdi> côté SignalDetail."

patterns-established:
  - "Détail gated anti-IDOR : maybeSingle(by id + status=active) via anon-client ; notFound() uniforme pour expiré/inexistant/non-autorisé (jamais de 403 discriminant)."
  - "Contenu IA faisant foi rendu en texte React échappé ; glossaire = sur-couche additive, jamais une substitution."
  - "Repli D-11 documenté : pas de breakdown persisté → facteurs contributifs (liste) + barre neutre du score global."

requirements-completed: [MEMB-03, MEMB-04]

# Metrics
duration: ~9min
completed: 2026-06-15
---

# Phase 3 Plan 03 : Surface DÉTAIL d'un trade Summary

**Route RSC /signaux/[id] qui lit le trade_setup actif by id + ses candles via anon-client + RLS (anti-IDOR maybeSingle/status=active → notFound), monte un CandleChart lightweight-charts v5 lecture seule (price lines entrée/SL/TP, no-SSR), et rend SignalDetail en deux niveaux (explication simple veteran_note → analyse approfondie dépliable) avec contenu IA VERBATIM, repli D-11 « facteurs contributifs » (sans graphe de décomposition) et glossaire additif. Couvert par un test verbatim TDD (RED→GREEN).**

## Performance

- **Duration:** ~9 min
- **Completed:** 2026-06-15
- **Tasks:** 2
- **Files modified:** 10 (6 créés, 4 modifiés)

## Accomplishments
- Route DÉTAIL RSC : lecture gated by id + status=active via anon-client, `maybeSingle()` → `notFound()` pour signal expiré/inexistant/non-autorisé (anti-IDOR T-03). Candles RLS-gatées (0011) limit 150 (D-12). Chart monté via `next/dynamic ssr:false` (Pitfall 5). Aucun guard inline, aucun repo service_role.
- CandleChart lightweight-charts v5 : `addSeries(CandlestickSeries)` (PAS l'API v4), `createPriceLine` entrée (brand-blue dashed) / SL (rouge) / chaque TP (vert) légendées, lecture seule (`handleScroll`/`handleScale` false, crosshair Normal), cleanup `chart.remove()`, render-fail toléré (message `chartUnavailable`).
- SignalDetail : Niveau 1 « Explication simple » = veteran_note VERBATIM + plan résumé (direction sémantique, entrée/SL/TP via `formatPrice`+precision en `<bdi>`, R:R, niveau de risque i18n) ; Niveau 2 « Analyse approfondie » collapsible repliée par défaut = technical/fundamental/news + ContributingFactors + invalidation + upcoming_risk_events, tout VERBATIM. Score NEUTRE = colonne `opportunity_score` (D-03), jamais dérivé du payload.
- ContributingFactors : repli D-11 (liste dérivée des `*_reasons` + barre de progression NEUTRE du score global), aucun graphe de décomposition par dimension.
- GlossaryTooltip : tooltip shadcn additif (trigger 44px, focusable, dismiss Esc/blur), définition depuis le namespace `glossary`.
- Test SignalDetail.test.tsx (TDD) : assertions verbatim (veteran_note + technical_reason + invalidation) + score == colonne + zéro injection HTML, via `renderToStaticMarkup` (node, sans jsdom).
- i18n : 16 clés `signalDetail` ajoutées (plan/lignes chart/raisons/chartUnavailable/glossaryLabel) en parité stricte fr/en/ar.

## Task Commits

1. **Task 1 : Route détail [id] + CandleChart v5 no-SSR** — `63c8c4f` (feat)
2. **Task 2 RED : test verbatim SignalDetail (échec attendu)** — `9c0bdec` (test)
3. **Task 2 GREEN : SignalDetail + ContributingFactors + GlossaryTooltip** — `0367b75` (feat)

**Plan metadata :** commit docs final (ce SUMMARY + STATE + ROADMAP + REQUIREMENTS).

## TDD Gate Compliance
- RED gate : `9c0bdec` (`test(03-03)`) — test échoue (module SignalDetail absent). ✓
- GREEN gate : `0367b75` (`feat(03-03)`) — implémentation, 4/4 verts. ✓
- REFACTOR : aucun commit séparé nécessaire (code propre dès GREEN).

## Files Created/Modified
- `apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx` — route RSC détail (anti-IDOR, candles, chart no-SSR, SignalDetail)
- `apps/web/src/components/signals/CandleChart.tsx` — chart lightweight-charts v5 lecture seule + price lines
- `apps/web/src/components/signals/SignalDetail.tsx` — niveaux 1/2 contenu IA VERBATIM
- `apps/web/src/components/signals/ContributingFactors.tsx` — repli D-11 (liste, barre neutre)
- `apps/web/src/components/signals/GlossaryTooltip.tsx` — aide additive jargon (tooltip)
- `apps/web/src/components/signals/__tests__/SignalDetail.test.tsx` — test verbatim TDD (node, renderToStaticMarkup)
- `apps/web/src/messages/{fr,en,ar}.json` — 16 clés signalDetail (parité stricte)
- `vitest.config.ts` — oxc jsx:automatic + include .test.tsx (infra test composant)

## Decisions Made
- **D-03-03-A** : test composant via `renderToStaticMarkup` en env node — pas d'installation jsdom/@testing-library/@vitejs-plugin-react. Une seule assertion verbatim ne justifie pas 3 deps + un projet jsdom séparé.
- **D-03-03-B** : JSX vitest 4 via `oxc: { jsx: 'automatic' }` (esbuild ignoré sous rolldown). Le test écrit en `React.createElement` (sans JSX) pour robustesse.
- **D-03-03-C** : Niveau 2 = `CollapsibleContent forceMount` + `data-[state=closed]:hidden` → contenu dans le DOM (SEO/a11y/testable), replié visuellement. `motion-reduce` respecté.
- **D-03-03-D** : CandleChart `autoSize` + ResizeObserver de repli + try/catch render-fail (message `chartUnavailable`, D-09). Canvas `dir='ltr'`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Infra de test composant absente (jsdom/testing-library)**
- **Found during :** Task 2 (test verbatim SignalDetail.test.tsx)
- **Issue :** la config vitest ne couvrait que `.test.ts` en env node, sans transform JSX ni framework de rendu composant. Le plan exige un test qui « monte SignalDetail » et asserte le rendu verbatim.
- **Fix :** rendu via `renderToStaticMarkup` (react-dom/server, déjà présent) en env node + `oxc: { jsx: 'automatic' }` + include `.test.tsx`. Aucune nouvelle dépendance (évite le risque slop d'un install). Test écrit en `React.createElement`.
- **Files modified :** vitest.config.ts, SignalDetail.test.tsx
- **Verification :** 4/4 verts ; suite complète 294/294 verte (aucune régression).
- **Committed in :** RED `9c0bdec` (config+test), GREEN `0367b75` (oxc finalisé avec l'impl)

---

**Total deviations :** 1 auto-fixée (1 blocking). Aucun scope creep ; aucune dépendance ajoutée.

## Issues Encountered
- Comme au Plan 03-02, les commandes verify du plan font `! grep -q "<token>"` sur des fichiers dont les COMMENTAIRES documentaient l'invariant (`addCandlestickSeries`, `dangerouslySetInnerHTML`, `recharts`). Reformulation des commentaires (sans changer la logique) pour que les greens reflètent l'absence réelle de ces patterns en code. Les invariants (API v5 uniquement, rendu échappé, repli D-11 sans graphe de décomposition) sont inchangés et toujours documentés.

## Verification Results
- `pnpm typecheck` (tsc -b --noEmit) : **0 erreur** (route détail + tous composants).
- `pnpm vitest run SignalDetail.test.tsx` : **4/4 verts** (verbatim veteran_note/reason/invalidation + score == colonne + zéro injection HTML).
- `pnpm vitest run` (suite complète) : **294/294 verts**, 37 fichiers — aucune régression.
- `node scripts/check-i18n-hardcoded.mjs` (lint:i18n) : **exit 0** (parité fr/en/ar, aucune chaîne en dur).
- `eslint` sur les 6 fichiers du plan : **exit 0** (zéro erreur/warning).
- Verify Task 1 (greps) : maybeSingle ✓, eq status active ✓, notFound ✓, ssr:false ✓, instruments!inner(...) ✓, addSeries(CandlestickSeries) ✓, pas d'API v4 ✓, createPriceLine ✓, handleScroll ✓, chart.remove ✓ ; repositories/ == 0, requireActiveSub == 0.
- Verify Task 2 (greps) : dangerouslySetInnerHTML == 0, recharts == 0 ; test verbatim vert.

## Threat Surface
- **T-03-IDOR** (Information Disclosure) : mitigé — `maybeSingle()` by id + `eq('status','active')` + RLS `has_active_subscription()` ; signal expiré/inexistant/non-autorisé → `notFound()` uniforme (aucune fuite, pas de 403 discriminant).
- **T-03-XSS** (Tampering) : mitigé — contenu IA rendu en enfant texte React (échappé), zéro injection HTML ; test asserte l'absence d'injection. Glossaire = sur-couche additive.
- **T-03-RLS** (Information Disclosure) : mitigé — lecture anon-client uniquement (route serveur), aucun repo/clé service_role dans apps/web. Candles gatées par 0011.
- **T-03-LEG** (Compliance) : mitigé — SignalsDisclaimerBanner (D-20) sur la surface détail.
- Aucune nouvelle surface réseau/auth/schéma introduite (lecture seule). Pas de threat_flag.

## E2E note
Les tests e2e `signal-detail` (Playwright, chart + plan) restent dans la stratégie de validation de phase (Wave 0 gap), exécutables avec serveur live (même contrainte que 03-02). Le test unitaire verbatim (MEMB-04) couvre le cœur de la fidélité du contenu IA hors environnement live.

## User Setup Required
None — aucune nouvelle variable d'environnement, aucune nouvelle dépendance npm, aucune migration. Migration 0011 (candles gatées) déjà appliquée (Wave 1).

## Next Phase Readiness
- Surfaces LISTE (03-02) et DÉTAIL (03-03) complètes et gated (RLS prouvée). MEMB-01..05 observables.
- Phase 3 prête pour la vérification globale (`/gsd:verify-work`) : il reste les e2e live (signals-rls/signal-detail/signals-realtime) à exécuter en human-verify avec serveur up.
- Frontière producteur-unique respectée bout en bout : lecture front via anon-client + RLS uniquement.

## Self-Check: PASSED

---
*Phase: 03-espace-membre-signaux-gated-rls*
*Completed: 2026-06-15*
