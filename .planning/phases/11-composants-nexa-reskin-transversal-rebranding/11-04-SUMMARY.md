---
phase: 11-composants-nexa-reskin-transversal-rebranding
plan: 04
subsystem: design-system
tags: [nexa, components, cva, svg, i18n, accessibility, applyThreshold]
requires:
  - "token component --accent-brand + --risk-moderate (11-01)"
  - "polices Phase 10 (font-display Archivo, font-accent Chakra Petch, font-mono JetBrains)"
  - "applyThreshold source unique (@app/core via @/lib/track-record/threshold, P5)"
provides:
  - "Eyebrow (cva tone purple/muted) — surtitre technique tokenisé"
  - "Marquee (RSC) — bande défilante instruments+sessions, keyframes RTL-aware reduced-motion-safe"
  - "ScoreRing (SVG radial) — role=meter accessible, couleur=risque jamais green=gagnant"
  - "ConfidenceStat — % toujours via applyThreshold, jamais % nu, N+provenance dans les 2 branches"
  - "Logo (SVG statique) — mark hexagonal N + wordmark Archivo, gradient #03d87f->#63279b"
affects:
  - "11-05 (header <span>->Logo), 11-06 (reskin membre), 11-07 (hero), 11-08 (vitrine) consomment ces contrats"
tech_stack:
  added: []
  patterns:
    - "moule cva + data-slot + cn (Eyebrow), composé Card multi-parts (ConfidenceStat)"
    - "label/labels traduits fournis par l'appelant -> RSC sans 'use client' (precedent closeLabel D-02-01-F)"
    - "exception var()-only sanctionnée : hex de marque #03d87f/#63279b dans le SVG du Logo uniquement"
    - "keyframes CSS sous @media (prefers-reduced-motion: no-preference) + override [dir=rtl] (double-garde D-05)"
key_files:
  created:
    - apps/web/src/components/nexa/Eyebrow.tsx
    - apps/web/src/components/nexa/Marquee.tsx
    - apps/web/src/components/nexa/ScoreRing.tsx
    - apps/web/src/components/nexa/ConfidenceStat.tsx
    - apps/web/src/components/nexa/Logo.tsx
  modified:
    - apps/web/src/styles/globals.css
    - apps/web/src/messages/fr.json
    - apps/web/src/messages/en.json
    - apps/web/src/messages/ar.json
decisions:
  - "D-11-04-A"
  - "D-11-04-B"
  - "D-11-04-C"
metrics:
  duration: "~12 min"
  completed: "2026-06-21"
  tasks: 3
  files: 9
requirements: [DESIGN-05, BRAND-03, BRAND-04]
---

# Phase 11 Plan 04 : Bibliothèque de composants NEXA tokenisée Summary

5 composants NEXA in-repo (Eyebrow, Marquee, ScoreRing, ConfidenceStat, Logo) suivant le moule `cva + data-slot + cn`, consommant UNIQUEMENT la couche component des tokens (`var()`) — seule exception sanctionnée : le gradient hex de marque du Logo. Keyframes Marquee RTL-aware reduced-motion-safe dans `globals.css` + 4 namespaces i18n (marquee, scoreRing, confidenceStat, baseline) à parité stricte FR/EN/AR. Interface-first : ces composants sont les contrats que les plans aval (11-05/06/07/08) consomment.

## What Was Built

| Composant | Type | Contrat clé |
|-----------|------|-------------|
| `Eyebrow.tsx` | RSC, cva | `tone` purple=`var(--accent-brand)` / muted=`text-muted-foreground`, `font-accent` uppercase, `data-slot="eyebrow"` |
| `Marquee.tsx` | RSC | items i18n (instruments+sessions, zéro %), clone `aria-hidden`, `role="marquee"` + `aria-label`, classes logiques uniquement |
| `ScoreRing.tsx` | RSC, SVG | anneau `stroke-dasharray`/`dashoffset` (offset=c·(1−score/100)), `role="meter"` aria-valuenow/min/max, couleur=risque (muted-foreground/risk-moderate/signal-bearish), score clampé [0,100], hit-area 44px, chiffre `font-mono` `<bdi>` |
| `ConfidenceStat.tsx` | RSC, Card composé | `applyThreshold` (source unique) ; `sufficient:false` → « en construction » sans %, `true` → winRatePct ; N+provenance dans LES DEUX branches |
| `Logo.tsx` | RSC, SVG | mark hexagonal N + wordmark `font-display` Archivo, `linearGradient` `#03d87f`→`#63279b`, variant full/mark, SVG statique authored (jamais d'injection HTML brute) |

`globals.css` : keyframes `nexa-scroll` (translateX −50%) + `nexa-scroll-rtl` (+50%), `.nexa-marquee-track` statique par défaut, animée seulement sous `prefers-reduced-motion: no-preference`, sens inversé en `[dir="rtl"]`.

i18n (3 fichiers, parité stricte) : `marquee {label, items[]}`, `scoreRing {riskLabels{faible,modere,eleve}, ariaTemplate}`, `confidenceStat {inConstruction, sampleLabel, provenanceBacktest, provenanceReel}`, `baseline {text}` = « Nouvelle Ère · Alliance d'Échange » (D-15, sans promesse de gain).

## Decisions Made

- **D-11-04-A** : `label`/`labels` traduits fournis par l'appelant (ScoreRing, ConfidenceStat) plutôt qu'un `getTranslations` interne → composants RSC purs sans `'use client'`, réutilisables liste+détail+membre. Precedent `closeLabel` (D-02-01-F). Marquee est RSC async (`getTranslations` direct) car il n'a pas de paramètre dynamique appelant.
- **D-11-04-B** : exception var()-only confirmée — les hex `#03d87f`/`#63279b` ne vivent QUE dans le `<linearGradient>` du Logo (identité chromatique fixe theme-indépendante, RESEARCH A2). `gradientId` suffixé par `variant` pour éviter une collision d'`id` si plusieurs `<Logo>` coexistent. Tout le reste de l'app reste `var()`.
- **D-11-04-C** : couleur ScoreRing = risque strict ; les commentaires de doc reformulés pour ne PAS contenir les substrings `var(--primary)`/`signal-bullish`/`dangerouslySetInnerHTML` (sinon les greps d'acceptance `-eq 0` échouent sur la doc). Le code ne référence aucun de ces tokens/API interdits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Faux positif `lint:i18n` sur annotation CVA (Eyebrow)**
- **Found during:** Task 1
- **Issue:** `& VariantProps<typeof eyebrowVariants>` lu comme texte JSX par le détecteur regex maison (precedent D-04-03-C / D-02-01-F).
- **Fix:** `// i18n-ignore: annotation de type CVA` en bout de ligne (mécanisme prévu par le script).
- **Files modified:** apps/web/src/components/nexa/Eyebrow.tsx
- **Commit:** 36f61cf

**2. [Rule 3 - Blocking] `aria-label="NEXA"` flaggé hardcodé + erreur tsc TS1005 (Logo)**
- **Found during:** Task 3
- **Issue:** L'autonyme de marque « NEXA » sur `aria-label` est flaggé par `check-i18n-hardcoded`. La tentative initiale `{/* i18n-ignore */}` inline entre attributs JSX cassait la compilation (TS1005 `'...' expected`).
- **Fix:** extraction `const brandName = "NEXA" // i18n-ignore: nom de marque (autonyme)` + référence `aria-label={brandName}` → valide TSX ET reconnu par le script. Precedent autonyme `Vétéran Trading` (layout.tsx).
- **Files modified:** apps/web/src/components/nexa/Logo.tsx
- **Commit:** 5a5db3e

**3. [Rule 1 - Doc] Greps d'acceptance pollués par les commentaires de doc**
- **Found during:** Tasks 2 et 3
- **Issue:** Les greps interdits (`-eq 0`) `var(--primary)|signal-bullish` (ScoreRing) et `dangerouslySetInnerHTML` (Logo) matchaient les substrings dans les commentaires explicatifs, faisant échouer les acceptance.
- **Fix:** reformulation des commentaires (« token CTA/actif », « token de hausse », « injection HTML brute ») sans changer le code. Le code n'utilise aucun de ces tokens/API.
- **Files modified:** apps/web/src/components/nexa/ScoreRing.tsx, apps/web/src/components/nexa/Logo.tsx
- **Commits:** 52025eb, 5a5db3e

## Verification

- **Greps acceptance** : `data-slot` (Eyebrow=2), `role="meter"` (ScoreRing=2), `applyThreshold` (ConfidenceStat=4), `linearGradient` (Logo=2), `#03d87f`/`#63279b` (Logo=1 chacun) — tous présents.
- **Greps interdits = 0** : `var(--primary)|signal-bullish` (ScoreRing=0), `dangerouslySetInnerHTML` (Logo=0).
- **ScoreRing tokens risque** : `var(--risk-moderate)` + `var(--signal-bearish)` + `var(--muted-foreground)` présents ; `minInlineSize/minBlockSize 44` (hit-area).
- **globals.css** : `nexa-scroll` ET `nexa-scroll-rtl` ET `prefers-reduced-motion: no-preference` présents.
- **i18n** : `check-i18n-hardcoded.mjs` exit 0 ; JSON fr/en/ar valides ; 5 tests de parité (18 assertions) verts.
- **no-perf-claims** : `pnpm vitest run` exit 0, 4/4 (namespaces marquee/baseline/confidenceStat/scoreRing scannés, zéro % nu).
- **tsc** : `pnpm --filter web exec tsc -b --noEmit` → 0 erreur (aucune nouvelle dans components/nexa).

## Self-Check: PASSED

- FOUND: apps/web/src/components/nexa/Eyebrow.tsx
- FOUND: apps/web/src/components/nexa/Marquee.tsx
- FOUND: apps/web/src/components/nexa/ScoreRing.tsx
- FOUND: apps/web/src/components/nexa/ConfidenceStat.tsx
- FOUND: apps/web/src/components/nexa/Logo.tsx
- FOUND: commit 36f61cf (Task 1)
- FOUND: commit 52025eb (Task 2)
- FOUND: commit 5a5db3e (Task 3)
