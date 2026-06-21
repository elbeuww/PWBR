---
phase: 10-fondation-design-system-nexa
plan: 03
subsystem: design-system-tokens
tags: [wave-3, oklch, tailwind-v4, theme, css-first, design-01, design-03, design-04, next-themes, rtl]
requires:
  - "Wave-0 garde design-tokens.test.ts + rtl-logical-props.test.ts (plan 10-01)"
  - "5 familles NEXA exposées en --font-archivo/space-grotesk/jetbrains-mono/chakra-petch/noto-arabic (plan 10-02)"
provides:
  - "globals.css en système OKLCH 3 couches (primitive @theme → semantic :root/.dark → component @theme inline)"
  - "Primitives NEXA : --nexa-green-500/600, --nexa-purple-500/400, --nexa-white, --nexa-ink, --nexa-signal-bull/bear, rampe neutre 5 pas"
  - "Tokens signaux trading --signal-bullish / --signal-bearish (distincts de --primary, D-05) — consommés en Phase 11"
  - "--font-sans/display/mono/accent/arabic repointés sur les 5 familles NEXA ; body → Space Grotesk"
affects:
  - "Phase 11 consomme --primary (brand green), --signal-* (trading), les 5 --font-*"
tech_stack:
  added: []
  patterns:
    - "Tailwind v4 CSS-first 3-couche : @theme (primitives theme-indépendantes) / @theme inline (component, var() only) / :root+.dark (semantic, seule couche qui flippe)"
    - "Brand vs signal namespace separation (D-05) — hue 155 brand ≠ hue 149 bullish"
    - "Body font via var(--font-sans) résolu (@theme inline) plutôt que var orpheline → pas de fallback system-ui silencieux"
key_files:
  created:
    - .planning/phases/10-fondation-design-system-nexa/10-03-SUMMARY.md
  modified:
    - apps/web/src/styles/globals.css
decisions:
  - "D-10-03-A (Rule 1) : les HEX de marque (#03d87f, #63279b, #1E5FBF) placés en commentaire de documentation faisaient échouer design-tokens.test.ts — la garde scanne TOUT le fichier (valeur ET commentaire), pas seulement les déclarations. Retiré ces HEX des commentaires (gardé les hue OKLCH + noms de var). Faux-positif évité : la garde mesure l'absence totale du HEX de marque obsolète, intention conservée."
  - "D-10-03-B : choix rampe neutre OKLCH chroma ~0.02 hue ~265 (navy-teinté) pour card/secondary/muted/border/input — cohérent avec l'ink NEXA (hue 269) sans virer gris pur. Discrétion Claude (10-CONTEXT §Claude's Discretion)."
  - "D-10-03-C : --destructive repointé sur --nexa-signal-bear (rouge réel) — résolution de l'Unknown #6 / discrétion CONTEXT : maintenant que les signaux sont des tokens dédiés (D-05), --destructive n'a plus à rester neutre comme en v2.0 (D-04 v2.0)."
  - "D-10-03-D : body repointé sur var(--font-sans) (= Space Grotesk via @theme inline) plutôt que de recréer un --font-latin. Évite une var orpheline → pas de fallback system-ui silencieux (10-RESEARCH §Runtime State Inventory)."
  - "D-10-03-E : .dark n'override que les tokens qui flippent ; les signaux trading (bull/bear) définis une seule fois en :root (une perte est rouge dans les deux thèmes). --primary garde --nexa-green-500 en dark (contraste OK sur fond ink)."
metrics:
  duration: ~8min
  tasks: 2
  files: 1
  completed: 2026-06-21
---

# Phase 10 Plan 03 : Migration globals.css → système OKLCH NEXA 3 couches Summary

Migre `globals.css` des tokens plats HEX bleus v2.0 (#1E5FBF institutionnel) vers un système OKLCH NEXA en 3 couches : primitives brutes (brand cyber green/royal purple, ink, white, signaux trading, rampe neutre) en `@theme`, sémantiques (`:root`/`.dark`) repointées sur ces primitives, component (`@theme inline`) inchangé en noms et 100 % `var()`. Repointe les `--font-*` sur les 5 familles NEXA du plan 02 (body → Space Grotesk, `:lang(ar)` → Noto). Bascule `.dark` (next-themes) et propriétés logiques (RTL) préservées. La garde `design-tokens.test.ts` passe RED → GREEN.

## What Was Built

- **Couche 1 — primitives (`@theme`, theme-indépendantes)** : 5 `--font-*` repointés (Archivo/Space Grotesk/JetBrains Mono/Chakra Petch/Noto), + ramps OKLCH brutes : `--nexa-green-500/600` (brand, hue 155), `--nexa-purple-500/400` (hue 303), `--nexa-white`, `--nexa-ink`, `--nexa-signal-bull` (hue 149 sobre) / `--nexa-signal-bear` (rouge), rampe neutre 5 pas (chroma ~0.02, hue ~265). Commentaire CSS portant explicitement la règle D-05 (brand green ≠ signal direction).
- **Couche 2 — sémantique (`:root`/`.dark`)** : tous les tokens shadcn (`--primary`, `--background`, `--ring`, `--destructive`…) repointés sur `var(--nexa-*)`. `--primary` = brand green (D-05), `--primary-foreground` = ink (green clair → texte sombre), `--ring` = green, `--destructive` = signal-bear (rouge réel). `--signal-bullish`/`--signal-bearish` exposés, distincts de `--primary`. `.dark` n'override que ce qui flippe.
- **Couche 3 — component (`@theme inline`)** : noms `--color-*`/`--radius-*` INCHANGÉS depuis v2.0, `--font-sans` repointé `var(--font-space-grotesk)`, 100 % `var()` (anti-Pitfall 3).
- **Base layer / `:lang(ar)`** : body → `var(--font-sans)` (Space Grotesk, D-02) au lieu de `var(--font-latin)` orphelin ; `:lang(ar)` résout `var(--font-arabic)` → Noto ; `line-height`/`font-family` direction-neutres → RTL préservé.

## Verification Results

- `design-tokens.test.ts` : **GREEN 4/4** (oklch présent, `--nexa-green-500` défini, aucun HEX de marque #1E5FBF/#03d87f/#63279b, `@theme inline` = var() only).
- `rtl-logical-props.test.ts` : **GREEN** (aucune classe physique ml-/mr-/pl-/pr-/left-/right- dans globals.css après migration).
- `tsc --noEmit` (apps/web) : **exit 0**, aucune nouvelle erreur.
- Aucune var de police orpheline (`--font-latin`/`--font-inter`/`--font-ibm-plex-arabic`) référencée → 0 occurrence.
- Bascule `.dark` no-flash + RTL trilingue : vérification runtime déférée au merge de wave par `no-flash.spec.ts` (dev server :3000 requis, plan 10-01).
- 0 dépendance npm ajoutée (CSS pur).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] HEX de marque en commentaire faisaient échouer la garde**
- **Found during:** Task 1 (vérification design-tokens).
- **Issue:** mes commentaires de documentation (`/* cyber green #03d87f */`, `/* royal purple #63279b */`, `#1E5FBF v2.0`) contenaient les HEX de marque obsolètes. `design-tokens.test.ts` scanne tout le fichier (valeur ET commentaire) → assertion (3) RED bien que la couche sémantique soit 100 % OKLCH.
- **Fix:** retiré les HEX littéraux des commentaires (gardé hue OKLCH + noms de var). L'intention de la garde (zéro HEX de marque obsolète dans le fichier) est respectée.
- **Files modified:** apps/web/src/styles/globals.css
- **Commit:** 56be63d

### Decisions de discrétion (CONTEXT §Claude's Discretion)

- `--destructive` repointé sur le rouge réel (`--nexa-signal-bear`) — résout l'Unknown #6 : avec des signaux dédiés (D-05), plus besoin de garder `--destructive` neutre comme en v2.0.
- Rampe neutre OKLCH navy-teintée (hue 265) plutôt que gris pur, pour cohérence avec l'ink NEXA.

## Threat Mitigations Applied

- **T-10-05** (valeur littérale dans `@theme inline` casse .dark) : `@theme inline` resté 100 % `var()` ; assertion (4) de design-tokens.test.ts GREEN. Bascule .dark fonctionnelle (seule couche `:root`/`.dark` flippe).
- **T-10-06** (FOUC token tardif) : primitives en `@theme`/`:root` (parsées synchroniquement avec la feuille), aucune injection JS ; next-themes pré-paint conservé (D-06).
- **T-10-07** (fuite RTL prop physique) : rtl-logical-props.test.ts GREEN ; seules `font-family`/`line-height` (direction-neutres) ajoutées au base layer.
- **T-10-SC** (installs) : 0 paquet npm — accept, aucun checkpoint requis.

## Self-Check: PASSED

- FOUND: apps/web/src/styles/globals.css (modified) — 13 occurrences nexa-green-500/signal-*/font-space-grotesk
- FOUND commit: 56be63d (Task 1)
- FOUND commit: f15fa97 (Task 2)
- design-tokens.test.ts GREEN 4/4, rtl-logical-props.test.ts GREEN, tsc exit 0
