# Phase 11 : Composants NEXA, reskin transversal & rebranding - Pattern Map

**Mapped:** 2026-06-21
**Files analyzed:** 14 (à créer/modifier)
**Analogs found:** 11 / 14 (3 greenfield sans analog interne — hero anim, OG `next/og`)

> Règle d'or (verrouillée Phase 10) : tout nouveau composant suit le moule `cva + data-slot + cn`, référence **uniquement la couche component** des tokens (`var()` via classes Tailwind sémantiques `bg-primary`/`text-foreground`/`--signal-*`), **jamais** de littéral HEX/OKLCH ni de primitive `--nexa-*`. Seule exception sanctionnée : le SVG du logo (identité chromatique fixe).

---

## File Classification

| Fichier (créer/modifier) | Role | Data Flow | Analog le plus proche | Match |
|--------------------------|------|-----------|-----------------------|-------|
| `components/nexa/Eyebrow.tsx` | component (primitive) | request-response (statique RSC) | `components/ui/badge.tsx` | exact (extension cva) |
| `components/nexa/ScoreRing.tsx` | component (SVG/viz) | transform (props→SVG) | `components/signals/SignalCard.tsx` (bloc score 62-74) | role-match (pas de SVG ring existant) |
| `components/nexa/Marquee.tsx` | component (anim CSS) | request-response (statique RSC) | `components/ui/badge.tsx` (moule cva) + `globals.css` (anim) | partial (greenfield CSS) |
| `components/nexa/ConfidenceStat.tsx` | component (data viz) | CRUD-read via `applyThreshold` | `components/track-record/TrackRecordBlock.tsx` | exact (même source `applyThreshold`) |
| `components/nexa/Logo.tsx` | component (SVG asset) | request-response (statique RSC) | aucun SVG inline in-repo | **no analog** (greenfield SVG) |
| `components/hero/Hero.tsx` (+ WireframeGlobe/DataRain/FloatingCards/HeroTilt) | component (RSC shell + client islands) | event-driven (pointermove) | `(marketing)/page.tsx` (hero statique 33-44) | partial (structure), **no analog** (anim) |
| `components/signals/CandleChart.tsx` | component (chart client) | streaming/transform (lwc API) | lui-même (recoloration in-place) | exact (cible) |
| `components/signals/SignalCard.tsx` | component (RSC) | request-response | lui-même (recoloration in-place) | exact (cible) |
| `components/member/ExpiryBanner.tsx` | component (client) | CRUD-read (anon RLS) | lui-même (tokenisation) + `ui/alert.tsx` | exact (cible) |
| `app/[locale]/layout.tsx` | layout (RSC) | request-response | lui-même (header `<span>`→`<Logo>`) | exact (cible) |
| `app/layout.tsx` | layout (metadata) | config | lui-même (title+OG) + `app/sitemap.ts` (`metadataBase`) | exact (cible) |
| `app/icon.tsx` / `apple-icon.tsx` / `opengraph-image.tsx` | config (metadata files) | build (`next/og`) | `app/sitemap.ts` (convention metadata route) | **no analog** (greenfield `next/og`) |
| `messages/{fr,en,ar}.json` | config (i18n) | config | parité existante 3 langues | exact (édition + ajout clés) |
| `test/no-perf-claims.test.ts` | test (vitest text-scan) | batch (scan i18n) | lui-même (extension namespaces) | exact (cible) |

---

## Shared Patterns

### Moule composant tokenisé (cva + data-slot + cn)
**Source:** `apps/web/src/components/ui/badge.tsx` (lignes 1-49)
**Apply to:** Eyebrow, Marquee, ConfidenceStat, tout wrapper NEXA.

```typescript
// badge.tsx:1-8 — imports canoniques + cva
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"            // seulement si asChild requis
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex h-5 w-fit ... text-xs font-medium ...",
  { variants: { variant: { default: "bg-primary text-primary-foreground", ... } },
    defaultVariants: { variant: "default" } },
)
```
```typescript
// badge.tsx:30-47 — signature props + data-slot + cn merge
function Badge({ className, variant = "default", asChild = false, ...props }:
  React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"
  return <Comp data-slot="badge" data-variant={variant}
    className={cn(badgeVariants({ variant }), className)} {...props} />
}
export { Badge, badgeVariants }
```
**Conventions à copier :** `data-slot="<nom>"` sur l'élément racine ; `React.ComponentProps<"...">` + `VariantProps` pour le typage ; `cn(variants(...), className)` toujours en dernier (override appelant). Voir aussi `ui/card.tsx` (multi-parts `Card`/`CardHeader`/`CardContent` + `data-slot` par sous-élément) pour ConfidenceStat composé.

### Couche component des tokens (le seul vocabulaire couleur autorisé)
**Source:** `apps/web/src/styles/globals.css` (lignes 67-128)
**Apply to:** TOUS les nouveaux composants + toutes les recolorations.

```css
/* globals.css:104-127 — couche 2 sémantique (FLIPPE au thème). Consommer via classes. */
:root {
  --primary: var(--nexa-green-500);   /* CTA/focus/actif — JAMAIS direction/score */
  --foreground: var(--nexa-ink);
  --muted-foreground: var(--nexa-neutral-500);
  --border: var(--nexa-neutral-200);
  --destructive: var(--nexa-signal-bear);
  /* Signaux trading — DISTINCTS de --primary (D-05), consommés en Phase 11 : */
  --signal-bullish: var(--nexa-signal-bull);   /* #16a34a sobre — win/long/TP */
  --signal-bearish: var(--nexa-signal-bear);   /* #dc2626 — loss/short/SL */
}
```
**Tokens disponibles aujourd'hui :** `--primary`, `--foreground`, `--muted-foreground`, `--border`, `--card`, `--secondary`, `--ring`, `--destructive`, `--signal-bullish`, `--signal-bearish` (couche component, flip-safe). Consommés en classes Tailwind : `text-foreground`, `bg-primary`, `text-muted-foreground`, `bg-[var(--signal-bullish)]`, etc.

**⚠ Tokens MANQUANTS en couche component (le planner doit les AJOUTER, Wave tokens-résidus) :**
- **purple accent** (eyebrow/gradient) : seules les primitives `--nexa-purple-500` (`globals.css:43`) / `--nexa-purple-400` (`:44`, variante sombre) existent. Aucun token sémantique `--secondary-brand`. → ajouter couche 2/3 repointant sur `--nexa-purple-*` (ne PAS consommer la primitive depuis un composant).
- **amber risque modéré** (ScoreRing) : **absent même en primitive**. → ajouter primitive amber (couche 1) puis sémantique → component, en respectant l'archi 3 couches, sans re-décider la palette.

### Préservation de la frontière de confiance (Anti-Pattern 3 — HARD)
**Source:** `apps/web/src/app/[locale]/(member)/layout.tsx:23-34` (fetch RLS anon-client serveur)
**Apply to:** CandleChart, SignalCard, ExpiryBanner, toute surface membre reskinée.

```typescript
// (member)/layout.tsx:23-34 — lecture RLS anon-client SERVEUR, jamais migrée au client
const supabase = await createClient()
const { data: sub } = await supabase
  .from('subscriptions').select('current_period_end')
  .eq('user_id', user.id).eq('status', 'active')
  .order('current_period_end', { ascending: false }).limit(1).maybeSingle()
return (<><ExpiryBanner currentPeriodEnd={sub?.current_period_end ?? null} />{children}</>)
```
Le reskin = swap visuel UNIQUEMENT. Ne JAMAIS déplacer un fetch serveur vers le client, ne jamais introduire `service_role` côté client.

### Propriétés logiques RTL (DESIGN-04 — HARD, testé)
**Source:** `apps/web/src/app/[locale]/layout.tsx:55-67`, `SignalCard.tsx` (commentaire 8-9)
**Apply to:** chaque nouveau composant + chaque surface reskinée.
Utiliser `ms-*`/`me-*`/`ps-*`/`pe-*`/`start-*`/`end-*`/`text-start`/`text-end` (ex. `layout.tsx:60` `ms-6`, `:64` `ms-auto`). JAMAIS `ml-/mr-/pl-/pr-/left-/right-/text-left`. Valeurs numériques en `<bdi>` + `font-mono tabular-nums` (precedent `SignalCard.tsx:52,65,92`). Enforce : `rtl-logical-props.test.ts` (Phase 10).

### Reduced-motion double-garde (D-05)
**Apply to:** Hero (globe, data-rain, marquee, tilt).
CSS : envelopper TOUTE anim dans `@media (prefers-reduced-motion: no-preference)` (composition reste visible, figée). JS : `if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return` AVANT d'attacher tout listener `pointermove` (Pitfall 2). Tester les deux états.

---

## Pattern Assignments

### `components/nexa/Eyebrow.tsx` (component, RSC)
**Analog:** `components/ui/badge.tsx` (extension). Copier le moule cva ci-dessus (Shared §moule).
- Font accent : classe `font-accent` (= Chakra Petch, token Phase 10 `--font-accent`), `text-sm font-semibold uppercase tracking-wide`.
- Couleur : variante purple → consommer le **futur token component purple** (pas `--nexa-purple-*` directement). Variante `muted` → `text-muted-foreground`.
- `data-slot="eyebrow"`, racine `<span>`, `React.ComponentProps<"span"> & VariantProps`.

### `components/nexa/ScoreRing.tsx` (component, SVG transform)
**Analog:** `components/signals/SignalCard.tsx:62-74` (bloc score neutre + barre) pour la sémantique « score = neutre, jamais green=gagnant ».
```tsx
// SignalCard.tsx:64-74 — precedent : score en tabular-nums, barre neutre bg-primary/bg-muted
<span className="text-2xl font-semibold tabular-nums text-primary"><bdi>{signal.opportunity_score}</bdi></span>
<div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
  <div className="h-full rounded-full bg-primary" style={{ inlineSize: `${scoreBar}%` }} />
</div>
```
**À FAIRE différemment (D-11/D-12) :** SVG `<circle>` radial via `stroke-dasharray`/`stroke-dashoffset` (`offset = c*(1 - score/100)`, `c = 2πr`), chiffre centré en `font-mono tabular-nums` + `<bdi>`. Couleur stroke = **RISQUE** (`faible→modéré→élevé` = `--muted-foreground` → token amber (à créer) → `--signal-bearish`), JAMAIS `--primary`/`--signal-bullish`. a11y : conteneur `role="meter" aria-valuenow/min/max` + `aria-label` i18n parlant ; `<svg>` `aria-hidden`. Hit-area liste ≥44px (UI-SPEC §Spacing exception).

### `components/nexa/Marquee.tsx` (component, anim CSS-only)
**Analog:** moule cva (badge) pour la structure ; `globals.css` pour le pattern keyframes.
- Contenu (D-14) : instruments + sessions (forex/crypto/métaux ; Londres/NY/Tokyo), neutre, **zéro %**, via i18n.
- Anim : `@keyframes` `translateX(-50%)` sous `@media (prefers-reduced-motion: no-preference)` ; sans preference → liste statique lisible. RTL : sens inversé (keyframe `nexa-scroll-rtl` ou `[dir="rtl"]` override). `aria-label` décrit la bande, items dupliqués `aria-hidden`.

### `components/nexa/ConfidenceStat.tsx` (component, CRUD-read mesuré)
**Analog:** `components/track-record/TrackRecordBlock.tsx` (source unique `applyThreshold`) + `ui/card.tsx` (multi-parts).
```typescript
// TrackRecordBlock.tsx:22-23,32-38 — source unique du % mesuré
import { applyThreshold } from '@/lib/track-record/threshold'
const overall = applyThreshold({ n: row.n ?? 0, win_rate: row.win_rate,
  expectancy: row.expectancy, avg_r: row.avg_r })   // sous N≥30 → état « insuffisant »
```
**HARD (D-13/BRAND-04) :** TOUJOURS passer par `applyThreshold` (`@app/core` / `@/lib/track-record/threshold`). Jamais un % nu. Sous `MIN_SAMPLE=30` → état « Track record en construction (N insuffisant) » (UI-SPEC Copywriting), N toujours visible + provenance (backtest/réel). Chiffres en `font-mono` + `<bdi>`.

### `components/nexa/Logo.tsx` (component SVG, greenfield — no analog)
**Analog:** aucun SVG inline in-repo. Greenfield.
- SVG inline : mark hexagonal « N » + wordmark `font-display` (Archivo) bold uppercase tracking large (D-07).
- `<linearGradient>` `#03d87f`→`#63279b` — **seule exception au var()-only** (asset de marque, identité chromatique fixe theme-indépendante, D-04). Tout le reste de l'app reste `var()`.
- Variantes clair/sombre. Réutilisé par header (`[locale]/layout.tsx:56`), footer, et source path des metadata files.
- Sécurité : SVG **statique authored**, jamais `dangerouslySetInnerHTML` (XSS).

### `components/hero/*` (RSC shell + client islands, greenfield — no analog anim)
**Analog (structure section/CTA) :** `(marketing)/page.tsx:33-44`.
```tsx
// page.tsx:33-44 — structure hero actuelle (à REMPLACER, greenfield)
<section className="py-16 md:py-24">
  <h1 className="max-w-3xl text-[40px] leading-tight font-semibold md:text-[56px]">{t('heroTitle')}</h1>
  <p className="mt-6 max-w-2xl text-base text-muted-foreground">{t('heroLede')}</p>
  <div className="mt-8"><Button asChild size="lg"><Link href="/tarifs">{t('heroCta')}</Link></Button></div>
</section>
```
**Contraintes (D-01..05) :** CSS + vanilla TS only (GSAP/three.js/WebGL interdits). Globe filaire SVG/CSS rotate ; data-rain `repeating-linear-gradient` + keyframes `aria-hidden`; cartes setups anonymisés (`instrument · direction · score · risque`, **zéro %**) ; fond ink fixe (`--nexa-ink`) indépendant du thème ; tilt = island `'use client'` minimale `pointermove`→CSS custom props avec garde reduced-motion. Baseline NEXA affichée (D-16). CTA via `Button asChild` + `Link` localisé (precedent ci-dessus).

### `components/signals/CandleChart.tsx` (recoloration lwc — cible UI-03)
**Analog:** lui-même. Recoloration in-place des HEX hardcodés.
```typescript
// CandleChart.tsx:49-53 — ACTUEL (HEX v2.0 brand-blue, à remplacer)
const UP_COLOR = '#15803D'
const DOWN_COLOR = '#B91C1C'
const ENTRY_COLOR = '#1E5FBF' // brand-blue
const SL_COLOR = '#B91C1C'
const TP_COLOR = '#15803D'
```
lwc ne lit pas les CSS vars (Anti-Pattern 5). Lire les tokens résolus via `getComputedStyle(node).getPropertyValue('--signal-bullish'|'--signal-bearish'|'--foreground').trim()` au mount, AVANT `createChart` (`:81`), puis injecter dans `addSeries(CandlestickSeries, { upColor, ... })` (`:96-104`) et `createPriceLine({ color })` (`:117-142`). Mapping : `UP/TP → --signal-bullish`, `DOWN/SL → --signal-bearish`, `ENTRY → --foreground`. **Theme toggle (Pitfall 5)** : observer `.dark` (next-themes `useTheme` ou `MutationObserver` sur `documentElement.classList`), relire + `series.applyOptions()`. NE PAS toucher le fetch RLS (Anti-Pattern 3 ; le composant est déjà `'use client'` monté `ssr:false`).

### `components/signals/SignalCard.tsx` (recoloration HEX direction — cible UI-03, découverte RESEARCH)
**Analog:** lui-même.
```typescript
// SignalCard.tsx:37-39 — ACTUEL (HEX direction en dur, à tokeniser)
const directionClass = isLong
  ? 'bg-[#15803D]/10 text-[#15803D] dark:bg-[#22C55E]/15 dark:text-[#22C55E]'
  : 'bg-[#B91C1C]/10 text-[#B91C1C] dark:bg-[#EF4444]/15 dark:text-[#EF4444]'
```
Remplacer par tokens `--signal-bullish`/`--signal-bearish` (couche component, flip-safe → supprime les variantes `dark:` manuelles) : ex. `bg-[var(--signal-bullish)]/10 text-[var(--signal-bullish)]`. Couleur = direction UNIQUEMENT (D-03) ; le bloc score reste neutre (`text-primary`, déjà conforme `:65,73`).

### `components/member/ExpiryBanner.tsx` (tokenisation amber — cible UI-07)
**Analog:** lui-même + `ui/alert.tsx` (déjà consommé `:18`).
```typescript
// ExpiryBanner.tsx:49 — ACTUEL (amber hardcodé, à tokeniser)
<Alert className="border-amber-600/30 bg-amber-500/10 text-amber-800 dark:text-amber-300">
```
Remplacer par styling warning piloté par token (futur token amber component-layer ou variante `warning` ajoutée à `alertVariants` dans `ui/alert.tsx:9-19`, moule §moule). **Câblage (account)/abonnement (UI-07)** : `abonnement/page.tsx` doit aussi rendre `<ExpiryBanner currentPeriodEnd={...} />` ; réutiliser le fetch RLS anon-client (precedent `(member)/layout.tsx:23-34`), jamais dupliquer la logique de jours (déjà dans le composant `:29-34`).

### `app/[locale]/layout.tsx` (rebranding header — cible BRAND-01)
**Analog:** lui-même.
```tsx
// layout.tsx:55-56 — ACTUEL (texte marque en dur)
<header className="flex h-14 items-center justify-between bg-secondary px-4 md:px-6">
  <span className="font-semibold">Vétéran Trading</span> {/* i18n-ignore: marque */}
```
Remplacer le `<span>` par `<Logo />` (mark + wordmark + baseline D-16). Préserver `ms-6`/`ms-auto`/ThemeToggle/LanguageSwitcher/Footer.

### `app/layout.tsx` (metadata root — cible BRAND-01/03)
**Analog:** lui-même + `app/sitemap.ts:17` (`BASE_URL` via `process.env.NEXT_PUBLIC_SITE_URL`).
```typescript
// layout.tsx:10-13 — ACTUEL
export const metadata: Metadata = {
  title: 'Vétéran Trading Platform',
  description: "Plateforme d'analyse de trading — usage personnel",
}
```
Renommer en NEXA + ajouter OG metadata (et `metadataBase` aligné sur `NEXT_PUBLIC_SITE_URL` comme `sitemap.ts:17`). Root reste pass-through (Pitfall 7 — aucun `<html>` ici).

### `app/icon.tsx` / `app/apple-icon.tsx` / `app/opengraph-image.tsx` (greenfield — no analog)
**Analog:** `app/sitemap.ts` (seule autre metadata route in-repo — convention `export default function`). Aucun `favicon`/`icon`/OG existant (glob confirmé → greenfield).
Conventions Next 15 : fichiers à la **racine `app/`** (indépendant de `[locale]`). Variante générée : `export default function Image()` retournant `ImageResponse` (`next/og`, fourni par next@15) + exports `size`/`contentType`/`alt`. OG défaut 1200×630, apple-icon 180×180. Réutiliser le path SVG du `Logo` + hex `#03d87f`/`#63279b`, fond `--nexa-ink`.

### `messages/{fr,en,ar}.json` (i18n — cible BRAND-01/02)
**Analog:** parité existante 3 langues.
- Renommer `fr.json:210` `codePlaceholder: "Ex : MERA2026"` → NEXA ; `fr.json:489` `"…Vétéran Trading"` → NEXA.
- Ajouter baseline (D-15) + clés marquee/hero/états vides aux **3 fichiers simultanément** (parité stricte, `check-i18n-hardcoded.mjs`, Pitfall 3). Rédaction sans slop (`stop-slop`).

### `test/no-perf-claims.test.ts` (extension scanner — cible BRAND-04)
**Analog:** lui-même.
```typescript
// no-perf-claims.test.ts:27,37 — ACTUEL (namespaces + regex à étendre)
const MARKETING_NAMESPACES = ['home', 'pricing', 'paiement'] as const
const FORBIDDEN = /%|\d+\s*%|garanti|guaranteed|\bprofit\b|rentable/i
```
Ajouter au scan les namespaces des nouveaux composants (hero, marquee, gauges, baseline). Garder `stripAllowed` (`take-profits?` whitelisté, precedent D-02-03-D, `:30-34`). Garder l'exclusion `legal`/`disclaimer`. Conserver le cas de contrôle non-trivial (`:56-60`).

---

## No Analog Found

| Fichier | Role | Data Flow | Raison |
|---------|------|-----------|--------|
| `components/nexa/Logo.tsx` | component SVG | request-response | Aucun SVG inline authored in-repo. Greenfield (gradient `#03d87f`/`#63279b`, exception var()). |
| `components/hero/*` (anim) | component anim | event-driven | Aucune anim CSS/vanilla TS in-repo. Greenfield (globe/data-rain/tilt) — voir RESEARCH §Patterns 3-6 pour techniques. |
| `app/icon.tsx`/`apple-icon.tsx`/`opengraph-image.tsx` | metadata files | build (`next/og`) | Aucun fichier icon/OG/favicon existant (glob confirmé). `next/og` natif next@15 — voir RESEARCH §Pattern 8 + doc nextjs.org. |

---

## Metadata

**Analog search scope:** `apps/web/src/components/{ui,signals,member,track-record}`, `apps/web/src/app/**`, `apps/web/src/styles/globals.css`, `apps/web/test/`.
**Files scanned:** badge.tsx, alert.tsx, card.tsx, CandleChart.tsx, SignalCard.tsx, ExpiryBanner.tsx, TrackRecordBlock.tsx, globals.css, app/layout.tsx, [locale]/layout.tsx, (marketing)/page.tsx, (member)/layout.tsx, no-perf-claims.test.ts, + glob complet `app/**`.
**Pattern extraction date:** 2026-06-21
