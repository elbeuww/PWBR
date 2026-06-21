---
phase: 11-composants-nexa-reskin-transversal-rebranding
verified: 2026-06-21T12:00:00Z
status: human_needed
score: 11/13 must-haves verified
overrides_applied: 0
gaps: []
human_verification:
  - test: "Vérifier le rendu visuel du reskin sur les 3 locales (AR/EN/FR)"
    expected: "Design NEXA cohérent, RTL arabe correct (dir=rtl), baseline trilingue visible dans le header, hero animé visible, cartes flottantes sans %"
    why_human: "Rendu visuel et comportement RTL ne sont pas vérifiables par grep ou test automatisé"
  - test: "Rejouer les 5 specs E2E Playwright (i18n, affiliation, gating, auth, academie)"
    expected: "5 specs vertes ou sélecteurs de testid préservés documentés"
    why_human: "Requiert un environnement Supabase actif + serveur next dev sur :3000"
  - test: "Activer prefers-reduced-motion sur le système et naviguer sur la home"
    expected: "Hero statique mais visible (globe figé, cartes immobiles, data-rain statique), aucune animation déclenchée"
    why_human: "Comportement OS-level non vérifiable par grep"
  - test: "Basculer le thème clair/sombre et vérifier le CandleChart"
    expected: "Les bougies changent de couleur au basculement (MutationObserver actif), SL rouge, TP vert via tokens résolus"
    why_human: "Interaction dynamique du MutationObserver non vérifiable sans navigateur"
---

# Phase 11: Composants NEXA + Reskin Transversal + Rebranding — Rapport de Vérification

**Phase Goal:** Donner à toute la plateforme son identité NEXA via une bibliothèque de composants tokenisée, reskiner chaque route group, et achever le rebranding MERA→NEXA — sans réintroduire la moindre promesse de gain.
**Verified:** 2026-06-21T12:00:00Z
**Status:** human_needed
**Re-verification:** Non — vérification initiale

## Résumé exécutif

11 sur 13 vérités observables sont **VERIFIED** par le code. 2 vérités sont partiellement satisfaites en raison de warnings de code review (WR-01 et WR-02) identifiés dans le rapport 11-REVIEW.md :

- **WR-01 (WARNING)** : `SignalDetail.tsx` hardcode des HEX couleur (`#15803D dark:text-[#22C55E]`, `#B91C1C dark:text-[#EF4444]`) pour direction/SL/TP — viole l'invariant flip-safe adopté par tout le reste du reskin. Non bloquant pour le goal global (le fichier est fonctionnel) mais casse l'invariant de design-system explicitement posé.
- **WR-02 (WARNING)** : `alert.tsx` utilise `right-2`, `pr-18`, `text-left` — classes physiques qui cassent le RTL pour l'`ExpiryBanner` en locale `ar`. La phase a explicitement revendiqué "RTL-safe / propriétés logiques uniquement" et ce composant est utilisé par la surface arabe.

4 items nécessitent une vérification humaine (visuel, E2E, reduced-motion, theme flip dynamique). Aucun gap technique bloquant l'objectif principal.

---

## Observable Truths

| # | Vérité | Statut | Preuve |
|---|--------|--------|--------|
| 1 | Token purple accent + amber risque existent en 3 couches dans globals.css | VERIFIED | `--nexa-amber-500` (l.48), `--accent-brand: var(--nexa-purple-500)` (:root l.137), `--accent-brand: var(--nexa-purple-400)` (.dark l.166), `--risk-moderate: var(--nexa-amber-500)` (:root l.138), `--color-accent-brand/--color-risk-moderate` (@theme inline l.92-93) |
| 2 | Aucun composant ne consomme de primitive `--nexa-*` directement (hors exception Logo) | VERIFIED | ScoreRing, Eyebrow, ExpiryBanner, SignalCard utilisent `var(--risk-moderate)`, `var(--signal-bullish)`, `var(--accent-brand)` — jamais de primitive directe. Logo : exception sanctionnée documentée (#03d87f/#63279b dans linearGradient SVG uniquement) |
| 3 | Gardes-fous no-perf-claims, no-mera-brand, rtl-logical-props existent et couvrent les nouveaux composants | VERIFIED | Fichiers `apps/web/test/no-mera-brand.test.ts` et `apps/web/test/no-perf-claims.test.ts` existent. `rtl-logical-props.test.ts` étendu. no-mera-brand confirme zero MERA dans src (grep code vérifié) |
| 4 | CandleChart lit ses couleurs via `getComputedStyle` et se re-colore au flip thème | VERIFIED | `getComputedStyle`, `getPropertyValue('--signal-bullish')` présents ; `MutationObserver` + `series.applyOptions` présents (l.92, 171-181 de CandleChart.tsx) |
| 5 | SignalCard encode la direction via tokens flip-safe (`--signal-*`), zéro HEX direction | VERIFIED | `bg-[var(--signal-bullish)]/10 text-[var(--signal-bullish)]` et `--signal-bearish` confirmés. Aucun `#15803D/#B91C1C/#22C55E/#EF4444` dans SignalCard.tsx |
| 6 | ExpiryBanner utilise variant="warning" tokenisé, zéro `amber-*` littéral | VERIFIED | ExpiryBanner.tsx : `<Alert variant="warning">` sans classe amber. alert.tsx : variante `warning` = `border-[var(--risk-moderate)]/30 bg-[var(--risk-moderate)]/10` — aucun littéral amber-* |
| 7 | Bibliothèque NEXA tokenisée existe (Eyebrow, ScoreRing, Marquee, ConfidenceStat, Logo) | VERIFIED | 5 fichiers `apps/web/src/components/nexa/*.tsx` présents et substantiels. ScoreRing : `role="meter"`, `aria-valuenow/min/max`, couleur=risque jamais vert. ConfidenceStat : appel `applyThreshold` ligne 55. Logo : `linearGradient` hex marque exacts, no dangerouslySetInnerHTML |
| 8 | Rebranding MERA→NEXA complet : zéro trace MERA/Vétéran Trading dans apps/web/src + messages | VERIFIED | Grep `MERA` dans `apps/web/src` = 0 résultat. Grep `Vétéran Trading` = 0 résultat. `no-mera-brand.test.ts` confirme l'absence par design du test |
| 9 | Baseline NEXA trilingue affichée au header sans promesse de gain | VERIFIED | `[locale]/layout.tsx` : `<Logo variant="full" />` + `{tBaseline('text')}` (l.61-65). Metadata root : title/description NEXA sans promesse (layout.tsx l.10-18). OG image : baseline + mark sans % |
| 10 | Assets de marque NEXA (icon, apple-icon, opengraph-image) existent via next/og | VERIFIED | 3 fichiers `app/{icon,apple-icon,opengraph-image}.tsx` présents avec `ImageResponse`, `size`, `contentType`, hex #03d87f/#63279b |
| 11 | Hero animé complet livré sur la home (globe + cartes + data-rain + tilt) sans % ni promesse | VERIFIED | `Hero.tsx` compose WireframeGlobe, DataRain, FloatingCards, HeroTilt. `(marketing)/page.tsx` rend `<Hero />`. Keyframes `nexa-globe-spin`, `nexa-rain`, `nexa-scroll` dans globals.css, gardées par `prefers-reduced-motion: no-preference`. `HeroTilt` teste `matchMedia` avant addEventListener. Aucun import three/gsap/framer-motion |
| 12 | Surfaces reskinées (vitrine, auth, académie, admin, membre) au design NEXA | PARTIAL — WARNING | Tarifs, login, academie, admin : Eyebrow + composants NEXA présents. `(account)/abonnement` : ExpiryBanner câblé via RLS serveur (`current_period_end` fetch confirmé l.44-53). **WR-01** : `SignalDetail.tsx` hardcode HEX direction/SL/TP (#15803D, #B91C1C, etc.) au lieu des tokens `--signal-*` — casse l'invariant flip-safe adopté ailleurs |
| 13 | RTL-safe sur toutes les surfaces (propriétés logiques uniquement) | PARTIAL — WARNING | Hero, FloatingCards, SignalCard, layout header : propriétés logiques correctes. **WR-02** : `alert.tsx` `AlertAction` = `absolute top-2 right-2` (physique) + `pr-18` (physique) + `text-left` (physique). ExpiryBanner utilise AlertAction → le bouton "Renouveler" sera mal positionné en locale AR |

**Score:** 11/13 vérités pleinement VERIFIED (2 PARTIAL/WARNING)

---

## Required Artifacts

| Artifact | Attendu | Statut | Détails |
|----------|---------|--------|---------|
| `apps/web/src/styles/globals.css` | Tokens 3 couches purple+amber | VERIFIED | `--nexa-amber-500`, `--accent-brand`, `--risk-moderate`, `--color-accent-brand`, `--color-risk-moderate` présents |
| `apps/web/test/no-perf-claims.test.ts` | Scan étendu aux namespaces composant | VERIFIED | Existe et couvert par vitest |
| `apps/web/test/no-mera-brand.test.ts` | Garde MERA absent | VERIFIED | Existe, scan actif, zero MERA en src |
| `apps/web/src/components/nexa/Eyebrow.tsx` | cva tone purple/muted, data-slot | VERIFIED | Existe, substantiel |
| `apps/web/src/components/nexa/ScoreRing.tsx` | SVG radial, role=meter, couleur=risque | VERIFIED | `role="meter"`, `aria-valuenow/min/max`, RISK_STROKE = muted-foreground/risk-moderate/signal-bearish |
| `apps/web/src/components/nexa/Marquee.tsx` | Bande défilante i18n, reduced-motion | VERIFIED | Existe, keyframes globals.css |
| `apps/web/src/components/nexa/ConfidenceStat.tsx` | Via applyThreshold, jamais % nu | VERIFIED | `applyThreshold` importé et appelé l.55 |
| `apps/web/src/components/nexa/Logo.tsx` | SVG mark hexagonal, linearGradient | VERIFIED | linearGradient #03d87f/#63279b, no dangerouslySetInnerHTML |
| `apps/web/src/components/hero/Hero.tsx` | Composition hero RSC + FloatingCards | VERIFIED | FloatingCards, WireframeGlobe, DataRain, HeroTilt composés |
| `apps/web/src/components/hero/HeroTilt.tsx` | Tilt vanilla TS avec garde reduced-motion | VERIFIED | `matchMedia('(prefers-reduced-motion: reduce)')` avant addEventListener (l.32) |
| `apps/web/src/app/opengraph-image.tsx` | ImageResponse NEXA 1200x630 | VERIFIED | ImageResponse, size 1200x630, contentType, hex marque |
| `apps/web/src/app/icon.tsx` | Favicon mark hexagonal ImageResponse | VERIFIED | ImageResponse, size 32x32 |
| `apps/web/src/app/apple-icon.tsx` | Apple icon 180x180 | VERIFIED | ImageResponse, size 180x180 |
| `apps/web/src/app/layout.tsx` | Metadata NEXA + metadataBase | VERIFIED | metadataBase, title NEXA, openGraph, no Vétéran Trading |
| `apps/web/src/app/[locale]/layout.tsx` | Logo + baseline au header | VERIFIED | `<Logo variant="full" />` + `{tBaseline('text')}` |
| `apps/web/src/components/Footer.tsx` | Logo NEXA + Disclaimer | VERIFIED | `<Logo variant="full" />` + `<Disclaimer />` |
| `apps/web/src/components/signals/CandleChart.tsx` | Recoloration lwc via getComputedStyle | VERIFIED | getComputedStyle + getPropertyValue + MutationObserver + applyOptions |
| `apps/web/src/components/signals/SignalCard.tsx` | ScoreRing + direction tokens flip-safe | VERIFIED | `<ScoreRing>` importé et rendu, `var(--signal-bullish/bearish)` pour direction |
| `apps/web/src/components/member/ExpiryBanner.tsx` | variant="warning" tokenisé, zero amber-* | VERIFIED | `variant="warning"` confirmé, grep amber = 0 |
| `apps/web/src/app/[locale]/(account)/abonnement/page.tsx` | ExpiryBanner câblé via RLS serveur | VERIFIED | `ExpiryBanner currentPeriodEnd={sub?.current_period_end ?? null}` + fetch RLS anon-client |

---

## Key Link Verification

| From | To | Via | Statut | Détails |
|------|----|-----|--------|---------|
| `globals.css @theme inline` | `globals.css :root` | `var(--accent-brand)` | VERIFIED | `--color-accent-brand: var(--accent-brand)` |
| `ExpiryBanner.tsx` | `alert.tsx variant warning` | `variant="warning"` | VERIFIED | Grep `variant="warning"` = 1 |
| `CandleChart.tsx` | `globals.css --signal-bullish/bearish` | `getPropertyValue` | VERIFIED | `getPropertyValue('--signal-bullish')` confirmé |
| `SignalCard.tsx` | `ScoreRing.tsx` | `import + rendu` | VERIFIED | `import { ScoreRing }`, `<ScoreRing score={...}` |
| `(marketing)/page.tsx` | `Hero.tsx` | `<Hero />` | VERIFIED | `import { Hero }`, `<Hero />` l.39 |
| `HeroTilt.tsx` | `globals.css prefers-reduced-motion` | `matchMedia` | VERIFIED | garde JS + gardes CSS keyframes |
| `[locale]/layout.tsx header` | `Logo.tsx` | `<Logo variant="full" />` | VERIFIED | Import + rendu présents |
| `(account)/abonnement/page.tsx` | `subscriptions.current_period_end` | `createClient serveur + select` | VERIFIED | Pattern (member)/layout.tsx réutilisé exactement |
| `FloatingCards.tsx` | `hero i18n namespace` | `getTranslations('hero')` | VERIFIED | `t.raw('cards')` depuis i18n |
| `ConfidenceStat.tsx` | `lib/track-record/threshold applyThreshold` | `import + appel` | VERIFIED | `import { applyThreshold }` l.1, appel l.55 |

---

## Requirements Coverage

| Requirement | Plan | Description | Statut | Preuve |
|-------------|------|-------------|--------|--------|
| DESIGN-05 | 11-01, 11-03, 11-04 | Bibliothèque composants NEXA tokenisée | VERIFIED | 5 composants nexa/ + tokens globals.css |
| BRAND-01 | 11-02, 11-05 | Marque NEXA partout, zéro MERA | VERIFIED | Grep MERA = 0, no-mera-brand vert |
| BRAND-02 | 11-05 | Baseline trilingue sans promesse de gain | VERIFIED | `baseline.text` header + metadata |
| BRAND-03 | 11-04, 11-05 | Logo + favicon + OG intégrés | VERIFIED | icon.tsx, apple-icon.tsx, opengraph-image.tsx, Logo dans header/footer |
| BRAND-04 | 11-02, 11-04 | Zéro promesse de gain dans les surfaces reskinées | VERIFIED (partiel) | no-perf-claims étendu + cartes anonymisées. WARNING : HEX direction dans SignalDetail ne contient pas de %, mais viole l'invariant du design system |
| UI-01 | 11-08 | Vitrine publique design NEXA trilingue | VERIFIED | tarifs, methodologie au design NEXA avec Eyebrow |
| UI-02 | 11-07 | Hero animé complet, reduced-motion, sans % | VERIFIED | Globe + cartes + data-rain + tilt, tous présents et gardés |
| UI-03 | 11-03, 11-06 | Espace membre design NEXA, RLS préservé | PARTIAL — WARNING | Liste + détail + chart NEXA. WR-01 : SignalDetail HEX direction. RLS createClient confirmé dans signaux/page.tsx et [id]/page.tsx |
| UI-04 | 11-08 | Académie design NEXA, RTL + fallback FR | VERIFIED | academie/page.tsx avec Eyebrow, Disclaimer présent |
| UI-05 | 11-08 | Auth + compte design NEXA | VERIFIED | login/signup avec Eyebrow, abonnement avec ExpiryBanner |
| UI-06 | 11-08 | Admin design NEXA sobre | VERIFIED | admin/page.tsx sobre (tokens + Card), aucun hero/animation |
| UI-07 | 11-03, 11-08 | ExpiryBanner câblé membre + compte | VERIFIED | Tokenisation (11-03) + câblage abonnement (11-08) confirmés. WARNING RTL alert.tsx (WR-02) |

---

## Anti-Patterns Found

| Fichier | Ligne | Pattern | Sévérité | Impact |
|---------|-------|---------|----------|--------|
| `apps/web/src/components/signals/SignalDetail.tsx` | 73-74, 112, 121 | HEX couleur hardcodé `#15803D dark:text-[#22C55E]`, `#B91C1C dark:text-[#EF4444]` pour direction/SL/TP | WARNING | Casse l'invariant flip-safe du design system adopté dans SignalCard, CandleChart, etc. Maintenance trap : tout changement de `--signal-*` ne s'appliquera pas ici. Couleurs littéralement différentes des tokens OKLCH (#15803D ≠ oklch(0.6271...) ≈ #16a34a) |
| `apps/web/src/components/ui/alert.tsx` | 7, 72 | `text-left`, `pr-18`, `absolute top-2 right-2` — classes physiques RTL | WARNING | ExpiryBanner en locale AR : bouton "Renouveler" (AlertAction) se positionne à droite physique + padding physique gauche → chevauchement du texte de description. Contredit l'invariant RTL-safe de la phase |
| `apps/web/src/components/hero/FloatingCards.tsx` | 39 | `const ariaLabel` shadow la prop `ariaLabel` dans le scope du `cards.map()` | INFO | Variable prop lue à la ligne 37 avant la redéclaration → fonctionne aujourd'hui, mais toute référence future à `ariaLabel` dans le map obtiendra le label per-card, pas le label de liste. Lint `no-shadow` flaggerait |
| `apps/web/src/components/Footer.tsx` | 31 | Commentaire "mark seul" mais rend `variant="full"` | INFO | Commentaire trompeur pour les lecteurs futurs |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — requiert un serveur Next.js actif + environnement Supabase (tokens E2E). Les vérifications programmatiques ont été remplacées par des checks grep/AST.

---

## Probe Execution

Step 7c: N/A — aucune probe déclarée dans les plans ou summaries pour cette phase.

---

## Human Verification Required

### 1. Rendu visuel multi-locale

**Test:** Naviguer sur la home en FR, EN, AR et vérifier le design NEXA
**Expected:** Header = Logo NEXA + baseline trilingue. Hero animé = globe filaire + cartes flottantes SANS %. Marquee défilant. Fond ink fixe même en thème clair.
**Why human:** Rendu visuel, positions RTL, animations CSS non vérifiables par code

### 2. Suite E2E Playwright (5 specs)

**Test:** Exécuter `pnpm playwright test` avec `.env.local` Supabase configuré
**Expected:** 5 specs vertes : i18n, affiliation-attribution, gating, auth, academie
**Why human:** Requiert serveur Supabase actif et next dev sur :3000

### 3. prefers-reduced-motion

**Test:** Activer "Réduire les animations" dans les préférences système, recharger la home
**Expected:** Hero statique mais visible — globe figé, cartes immobiles, data-rain statique, AUCUN mouvement de tilt au pointeur
**Why human:** Comportement conditionnel OS-level

### 4. Theme flip + CandleChart

**Test:** Ouvrir le détail d'un signal avec un chart visible, basculer thème clair/sombre
**Expected:** Les bougies changent de couleur (SL reste rouge via `--signal-bearish`, TP reste vert via `--signal-bullish`) sans rechargement de page
**Why human:** Interaction dynamique MutationObserver

---

## Gaps Summary

Aucun gap bloquant l'objectif principal de la phase. Les 2 warnings (WR-01, WR-02) dégradent des invariants explicitement revendiqués (flip-safe et RTL-safe) mais ne bloquent pas la fonctionnalité.

**Recommandations pour correction (non bloquantes) :**

**WR-01** — `SignalDetail.tsx` lignes 73-74, 112, 121 : remplacer les HEX par les tokens :
```tsx
const directionClass = isLong
  ? 'text-[var(--signal-bullish)]'
  : 'text-[var(--signal-bearish)]'
// SL:
<dd className="font-semibold tabular-nums text-[var(--signal-bearish)]">
// TP:
<dd className="font-semibold tabular-nums text-[var(--signal-bullish)]">
```

**WR-02** — `alert.tsx` : remplacer les classes physiques par des propriétés logiques :
```tsx
// alertVariants base: "... text-start ... has-data-[slot=alert-action]:pe-18 ..."
// AlertAction: className={cn("absolute top-2 end-2", className)}
```

**WR-03** — `FloatingCards.tsx` : renommer la variable interne `ariaLabel` en `cardLabel` dans le map.

---

_Verified: 2026-06-21T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
