---
phase: 11-composants-nexa-reskin-transversal-rebranding
plan: 07
subsystem: hero-greenfield
tags: [nexa, hero, css-animation, vanilla-ts, reduced-motion, i18n, accessibility, UI-02]
requires:
  - "Eyebrow + baseline i18n + ScoreRing + Button asChild + Link localisé (11-04)"
  - "token --nexa-ink / --primary / --accent-brand (11-01) ; polices font-display/font-accent (Phase 10)"
  - "keyframes pattern + double-garde reduced-motion globals.css (11-04)"
provides:
  - "WireframeGlobe (RSC SVG filaire green->purple, keyframe nexa-globe-spin gardé reduced-motion)"
  - "DataRain (RSC repeating-linear-gradient subtil aria-hidden, keyframe nexa-rain gardé reduced-motion)"
  - "FloatingCards (RSC, setups anonymisés zéro % via i18n hero.cards, ScoreRing couleur=risque)"
  - "HeroTilt (île client vanilla TS, garde matchMedia reduced-motion AVANT listener)"
  - "Hero (shell RSC composé, fond ink fixe D-04, baseline D-16) câblé sur la home"
affects:
  - "(marketing)/page.tsx : hero statique remplacé par <Hero /> ; futur reskin vitrine (11-08) consomme ce hero"
tech_stack:
  added: []
  patterns:
    - "globe filaire SVG + CSS rotate (transform-only GPU), data-rain gradient répété (Pattern 3/4 RESEARCH)"
    - "tilt vanilla TS pointermove -> CSS custom props, garde matchMedia AVANT addEventListener (Pattern 6 / Pitfall 2)"
    - "double-garde reduced-motion : @media (prefers-reduced-motion: no-preference) CSS + matchMedia JS"
    - "fond var(--nexa-ink) fixe theme-indépendant (D-04), texte forcé clair pour contraste"
    - "cartes anonymisées via i18n hero.cards (jamais DB), risk piloté ScoreRing (D-01/D-12)"
key_files:
  created:
    - apps/web/src/components/hero/WireframeGlobe.tsx
    - apps/web/src/components/hero/DataRain.tsx
    - apps/web/src/components/hero/FloatingCards.tsx
    - apps/web/src/components/hero/HeroTilt.tsx
    - apps/web/src/components/hero/Hero.tsx
  modified:
    - apps/web/src/styles/globals.css
    - apps/web/src/app/[locale]/(marketing)/page.tsx
    - apps/web/src/messages/fr.json
    - apps/web/src/messages/en.json
    - apps/web/src/messages/ar.json
    - apps/web/test/no-perf-claims.test.ts
    - apps/web/src/styles/__tests__/rtl-logical-props.test.ts
    - apps/web/src/components/nexa/Marquee.tsx
decisions:
  - "D-11-07-A"
  - "D-11-07-B"
  - "D-11-07-C"
metrics:
  duration: "~14 min"
  completed: "2026-06-21"
  tasks: 3
  files: 13
requirements: [UI-02, DESIGN-05, BRAND-04]
---

# Phase 11 Plan 07 : Hero animé greenfield NEXA (UI-02) Summary

Hero animé complet livré sur la home en CSS + vanilla TS UNIQUEMENT (D-05, GSAP/three.js/WebGL interdits, grep=0) : globe filaire rotatif SVG green→purple (D-02), cartes flottantes de setups anonymisés zéro % via i18n (D-01), data-rain subtil de fond (D-03), fond ink fixe theme-indépendant (D-04), tilt/parallaxe au pointer. Toute animation est doublement gardée par `prefers-reduced-motion` (CSS `@media (no-preference)` + garde JS `matchMedia` AVANT listener, Pitfall 2) → composition 100 % statique mais visible sous reduced-motion.

## What Was Built

| Composant | Type | Contrat clé |
|-----------|------|-------------|
| `WireframeGlobe.tsx` | RSC, SVG | Méridiens/parallèles (ellipses + lignes), gradient `var(--primary)`→`var(--accent-brand)`, `aria-hidden`, classe `.nexa-globe` animée `nexa-globe-spin` 48s SOUS no-preference seulement (figé sinon, D-05) |
| `DataRain.tsx` | RSC | `div.nexa-datarain` `inset-0` z-0 opacity 0.06 `pointer-events:none` `aria-hidden`, `repeating-linear-gradient(var(--primary))`, keyframe `nexa-rain` SOUS no-preference (figé sinon) |
| `FloatingCards.tsx` | RSC | Cartes setups `instrument · direction · score · risque` via i18n `hero.cards` (ÉDUCATIVES, ZÉRO %), `ScoreRing` couleur=risque, surfaces `bg-card/border-border`, offsets logiques alternés |
| `HeroTilt.tsx` | `'use client'` | Île minimale : `matchMedia('(prefers-reduced-motion: reduce)')` return AVANT `addEventListener` (Pitfall 2) ; `pointermove` set `--tilt-x/--tilt-y` ±6deg ; cleanup ; wrapper `perspective(800px) rotateX/rotateY(var(--tilt-*, 0deg))` |
| `Hero.tsx` | RSC | Shell Eyebrow + h1 + lede + 2 CTA (Button asChild + Link `/methodologie` & `/tarifs`), globe/data-rain z-bas, FloatingCards dans HeroTilt z-haut, **fond `var(--nexa-ink)` FIXE** (D-04), baseline (D-16) |

`globals.css` : keyframes `nexa-globe-spin` (rotate 1turn) + `nexa-rain` (background-position 0 200%), classes `.nexa-globe` / `.nexa-datarain` figées par défaut, animées seulement sous `@media (prefers-reduced-motion: no-preference)`.

i18n (3 fichiers, parité stricte) : namespace `hero {title, lede, ctaPrimary="Découvrir la méthode", ctaSecondary="Voir les tarifs", cardsLabel, cards[]}`. AR en miroir RTL. Cartes : EUR/USD·Long·82·modéré, BTC/USDT·Short·67·élevé, XAU/USD·Long·74·faible — ZÉRO %, aucun chiffre de gain.

## Decisions Made

- **D-11-07-A** : CTA primaire câblé sur `/methodologie` (route existante, « Découvrir la méthode » éducatif) et secondaire sur `/tarifs` — conforme UI-SPEC §Copywriting (CTA non-« gagnez »/« profitez »). L'ancien `home.heroCta` (« S'abonner / Voir les tarifs ») est abandonné au profit du namespace `hero` dédié ; `home.heroTitle/heroLede/heroCta` restent dans le JSON (non supprimés, hors scope) mais ne sont plus rendus.
- **D-11-07-B** : fond ink fixe via `style={{ backgroundColor: 'var(--nexa-ink)' }}` (primitive theme-indépendante, D-04) + texte forcé `text-white`/`text-white/70` — les tokens de thème (`text-foreground`) flipperaient sur fond clair et casseraient le contraste sur ce fond figé. C'est la SEULE surface où le texte ne suit pas les tokens de thème, justifié par le fond cyber fixe.
- **D-11-07-C** : `FloatingCards` reçoit `ariaLabel` en prop (fournie par Hero via `hero.cardsLabel`) plutôt qu'un `getTranslations` redondant — RSC pur, label porté sur le `<ul>`. Le score réutilise `ScoreRing` (11-04) avec `risk` ∈ {faible,modere,eleve} et `ariaTemplate` de `scoreRing` (jamais « vert=gagnant », D-12).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Faux positif libs interdites sur commentaire (HeroTilt)**
- **Found during:** Task 2
- **Issue:** Le commentaire documentant l'interdiction (« GSAP/three.js/framer-motion interdits ») matchait le grep `three\|gsap\|framer-motion` de l'acceptance, faisant échouer `-eq 0`. Précédent D-11-04-C.
- **Fix:** reformulation du commentaire (« moteurs WebGL/3D ou libs de motion interdits ») sans changer le code. Aucune lib tierce n'est importée.
- **Files modified:** apps/web/src/components/hero/HeroTilt.tsx
- **Commit:** adb3f87

**2. [Rule 3 - Blocking] Assertion de tolérance obsolète dans no-perf-claims**
- **Found during:** Task 2
- **Issue:** Le test affirmait `LOCALES.fr['hero'] === undefined` (« pas encore créé »). La création du namespace `hero` rendait cette assertion fausse → test rouge, acceptance bloquée.
- **Fix:** assertion de tolérance reportée sur un namespace garanti absent (`namespaceInexistant`) + nouvelle assertion prouvant que `hero` EST présent et scanné (BRAND-04).
- **Files modified:** apps/web/test/no-perf-claims.test.ts
- **Commit:** adb3f87

**3. [Rule 3 - Blocking] rtl-logical-props : tolérance obsolète + faux positif Marquee**
- **Found during:** Task 3
- **Issue:** (a) le test affirmait `listTsx(components/nexa) === []` alors que nexa/ contient déjà 5 composants (11-04) → rouge pré-existant. (b) le commentaire de `Marquee.tsx:20` (`ml-/mr-/pl-/pr-/left-/right-`) matchait le scan de classe physique. L'acceptance Task 3 exige `rtl-logical-props` exit 0.
- **Fix:** tolérance reportée sur un chemin garanti absent (`components/__inexistant__`) ; commentaire Marquee reformulé (« préfixes margin/padding/inset orientés gauche-droite ») sans toucher au code. nexa/ et hero/ restent scannés par le test de non-régression (vert).
- **Files modified:** apps/web/src/styles/__tests__/rtl-logical-props.test.ts, apps/web/src/components/nexa/Marquee.tsx
- **Commit:** e8ced78

## Verification

- **Greps acceptance** : `nexa-globe-spin` (globals.css=2), `nexa-rain` (=2), `aria-hidden` (DataRain=2), `prefers-reduced-motion` (HeroTilt=2, globals.css=3), `Hero` (page.tsx=2), `nexa-ink` (Hero.tsx=2), `ctaPrimary="Découvrir la méthode"` (fr=1).
- **Greps interdits = 0** : `three|gsap|framer-motion` dans hero/ = 0 ; `heroTitle` dans page.tsx = 0 (hero statique disparu).
- **no-perf-claims** : `pnpm vitest run` 5/5 vert (namespace `hero` scanné, zéro % nu).
- **rtl-logical-props** : 3/3 vert (hero/* + nexa/* scannés, aucune classe physique).
- **i18n** : `check-i18n-hardcoded.mjs` exit 0 ; JSON fr/en/ar valides ; namespace `hero` à parité.
- **tsc** : `pnpm --filter web exec tsc -b --noEmit` exit 0 (0 erreur).
- **Suite web complète** : `pnpm vitest run apps/web` → 28 fichiers / 177 tests verts.
- **Manuel (VALIDATION §Manual-Only, non exécuté en session)** : rendu visuel hero + bascule reduced-motion OS dans les 3 locales (fr/en/ar-RTL) — nécessite `pnpm --filter web dev`.

## Known Stubs

Aucun. Les données des cartes sont volontairement statiques (i18n `hero.cards`, contenu ÉDUCATIF anonymisé D-01) — par conception, jamais alimentées par la DB (le hero est une vitrine, pas une surface de signaux gated). Ce n'est pas un stub à résoudre dans un plan futur.

## Self-Check: PASSED

- FOUND: apps/web/src/components/hero/WireframeGlobe.tsx
- FOUND: apps/web/src/components/hero/DataRain.tsx
- FOUND: apps/web/src/components/hero/FloatingCards.tsx
- FOUND: apps/web/src/components/hero/HeroTilt.tsx
- FOUND: apps/web/src/components/hero/Hero.tsx
- FOUND: commit ee64a29 (Task 1)
- FOUND: commit adb3f87 (Task 2)
- FOUND: commit e8ced78 (Task 3)
