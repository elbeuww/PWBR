---
phase: 11-composants-nexa-reskin-transversal-rebranding
plan: 03
subsystem: signals-ui / member-ui / ui-primitives
tags: [reskin, tokens, recoloration, theme-flip, lightweight-charts, alert-variant]
requires:
  - "11-01 tokens component-layer (--signal-bullish/--signal-bearish/--risk-moderate)"
  - "--foreground sémantique (10-fondation, flippe en .dark)"
provides:
  - "CandleChart recoloré via tokens résolus + re-color au theme toggle (lwc applyOptions)"
  - "SignalCard direction tokenisée flip-safe (--signal-*)"
  - "alert.tsx variante warning tokenisée (var(--risk-moderate))"
  - "ExpiryBanner stylé par variant=warning, zéro littéral amber"
affects:
  - "toute surface rendant CandleChart / SignalCard / ExpiryBanner / Alert variant=warning"
tech-stack:
  added: []
  patterns:
    - "lwc recoloration : getComputedStyle(containerRef).getPropertyValue('--token') au montage + MutationObserver(.dark) → applyOptions"
    - "direction encodée par tokens flip-safe (plus de variantes dark: manuelles)"
    - "variante CVA warning consommant un token component-layer (pas de couleur Tailwind nommée)"
key-files:
  created: []
  modified:
    - apps/web/src/components/signals/CandleChart.tsx
    - apps/web/src/components/signals/SignalCard.tsx
    - apps/web/src/components/ui/alert.tsx
    - apps/web/src/components/member/ExpiryBanner.tsx
decisions:
  - "D-11-03-A : couleurs lwc résolues via getComputedStyle au montage + MutationObserver sur la classe de <html> (flip .dark) → series.applyOptions + priceLine.applyOptions. Choisi plutôt que resolvedTheme de next-themes en dépendance du useEffect (évite un remount complet du chart à chaque toggle ; recoloration in-place plus fluide)."
  - "D-11-03-B : refs des price lines (entry/SL/TP) conservées en variables locales du useEffect pour les re-colorer au flip sans recréer le chart."
  - "D-11-03-C : mapping couleur figé — UP/TP → --signal-bullish, DOWN/SL → --signal-bearish, entrée → --foreground (neutre). Les tokens --signal-* gardent leur teinte aux 2 thèmes (perte = rouge partout) ; --foreground flippe → l'entrée s'éclaircit en dark."
metrics:
  duration: ~10min
  tasks: 3
  files: 4
  completed: 2026-06-21
---

# Phase 11 Plan 03 : Recoloration résiduelle HEX/littéraux → tokens NEXA Summary

Recoloration des trois dernières surfaces à couleur figée (CandleChart, SignalCard, ExpiryBanner) vers les tokens NEXA flip-safe de 11-01, avec re-coloration du chart lightweight-charts au toggle de thème et ajout d'une variante `warning` tokenisée à `alertVariants`.

## What Was Built

- **CandleChart.tsx** — supprimé les 5 const HEX (`UP/DOWN/ENTRY/SL/TP`). `readChartColors(el)` résout `--signal-bullish` / `--signal-bearish` / `--foreground` via `getComputedStyle().getPropertyValue()` au montage. Couleurs injectées dans `addSeries(CandlestickSeries, …)` et chaque `createPriceLine`. Un `MutationObserver` sur `document.documentElement` (filtre `class`) relit les tokens au flip `.dark` et applique `series.applyOptions` + `priceLine.applyOptions` sur entry/SL/TP (Pitfall 5). Disconnect ajouté au cleanup. Fetch RLS serveur intact (composant reste `use client`, aucun `createClient`/`from(`/`supabase` ajouté).
- **SignalCard.tsx** — `directionClass` passe des 4 HEX (+ variantes `dark:` manuelles) à `bg-[var(--signal-bullish)]/10 text-[var(--signal-bullish)]` (long) / `--signal-bearish` (short). Le token flippe seul → plus de `dark:`. Bloc score neutre (`text-primary`, D-03) inchangé.
- **alert.tsx** — variante `warning` ajoutée à `alertVariants` : `border-[var(--risk-moderate)]/30 bg-[var(--risk-moderate)]/10 text-[var(--risk-moderate)]` + description tokenisée. Aucun littéral `amber-*`.
- **ExpiryBanner.tsx** — `<Alert>` passe du className amber hardcodé à `variant="warning"`. Logique J-3/J-1 (`daysUntil`, `windowDays`, `remaining <= 0 → return null`), ICU `payment.expiryBanner`, CTA Renouveler et propriétés logiques (`text-start`/`mx-auto`) intactes. Fetch RLS via prop `currentPeriodEnd` (serveur) inchangé.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Recolorer CandleChart via tokens résolus + re-color theme toggle | 51eb874 | CandleChart.tsx |
| 2 | Tokeniser SignalCard direction (HEX → --signal-*) | 571b9c5 | SignalCard.tsx |
| 3 | Variante warning tokenisée alert.tsx + tokeniser ExpiryBanner | 67568b3 | alert.tsx, ExpiryBanner.tsx |

## Verification

- `grep -cE "#(15803D|B91C1C|1E5FBF)" CandleChart.tsx` = 0 ; `getPropertyValue` présent ; `applyOptions`+`MutationObserver` présents ; aucun `createClient/from(/supabase` ajouté.
- `grep -cE "#(15803D|B91C1C|22C55E|EF4444)" SignalCard.tsx` = 0 ; `var(--signal-bullish)` ET `var(--signal-bearish)` présents ; aucune classe `dark:` de direction ; `text-primary` (score) intact.
- `grep -c "amber-" ExpiryBanner.tsx` = 0 ; `alert.tsx` contient la variante `warning` consommant `var(--risk-moderate)` (zéro `amber-`) ; `ExpiryBanner` utilise `variant="warning"` ; logique J-3/J-1 intacte (6 références).
- `pnpm vitest run apps/web/src/styles/__tests__/rtl-logical-props.test.ts` → 3/3 vert.
- `pnpm --filter web exec tsc -b --noEmit` → 0 erreur sur les 4 fichiers du plan.

## Deviations from Plan

None - plan exécuté exactement comme écrit (mapping couleur, MutationObserver, variante warning conformes à l'interface annoncée).

## Threat Surface

- **T-11-RLS** (mitigate) : aucun `createClient`/`from(`/`supabase` ajouté dans CandleChart ou ExpiryBanner (vérifié par grep = 0). Frontière de confiance serveur→client préservée (Anti-Pattern 3).
- **T-11-FLIP** (mitigate) : tous les HEX direction et littéraux `amber-*` supprimés (greps = 0) ; couleurs désormais flip-safe via tokens component-layer.
- **T-11-XSS** (accept) : valeurs de couleur lues depuis tokens authorés (`getComputedStyle`), aucune entrée dynamique injectée dans le chart.
- **T-11-SC** (mitigate) : aucun package npm installé.

Aucune nouvelle surface de sécurité introduite.

## Self-Check: PASSED

- FOUND: apps/web/src/components/signals/CandleChart.tsx (51eb874)
- FOUND: apps/web/src/components/signals/SignalCard.tsx (571b9c5)
- FOUND: apps/web/src/components/ui/alert.tsx (67568b3)
- FOUND: apps/web/src/components/member/ExpiryBanner.tsx (67568b3)
- Commits 51eb874, 571b9c5, 67568b3 présents dans git log.
