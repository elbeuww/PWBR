# Phase 11 : Composants NEXA, reskin transversal & rebranding - Research

**Researched:** 2026-06-21
**Domain:** Frontend reskin (Next.js 15 App Router/RSC, Tailwind v4 CSS-first, shadcn/ui v4 + React 19), CSS-only animation, identité de marque (SVG/metadata files), garde-fous légaux (no-perf-claims), RTL/a11y.
**Confidence:** HIGH (stack verrouillée + analogs internes forts ; aucune nouvelle dépendance runtime à valider)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01** Cartes flottantes hero = setups anonymisés éducatifs : `instrument · direction · score /100 · niveau de risque`. **Zéro %**, aucun chiffre de gain.
- **D-02** Globe = **filaire (wireframe) rotatif** green/purple, rotation lente CSS.
- **D-03** Data-rain = **subtil, fond lointain** (faible densité/opacité, derrière le contenu).
- **D-04** Ambiance hero = **fond sombre fixe (ink)** même en thème clair.
- **D-05** Contrainte technique (verrouillée) : **CSS + vanilla TS uniquement**. GSAP / three.js / WebGL **interdits**. `motion` en dernier recours seulement. `prefers-reduced-motion` ⇒ **composition 100% statique** (pas d'animation, composition visuelle préservée).
- **D-06** Mark = **emblème hexagonal « N »**.
- **D-07** Wordmark = **Archivo bold, tracking large, majuscules** (`--font-display`).
- **D-08** Couleur du mark = **dégradé green→purple**.
- **D-09** Favicon = **mark seul (hexagone N)**, optimisé 16-32px.
- **D-10** Production = **SVG propre redessiné** aux hex exacts **`#03d87f` (green) / `#63279b` (purple)** ; variantes **clair/sombre** + **image OG**. NE PAS utiliser les jpg `branding/logo-concepts/*` (palette dérivée fausse).
- **D-11** Score /100 = **anneau radial (ring)**, chiffre au centre, lisible liste + détail.
- **D-12** Couleur du score = **niveau de RISQUE**, jamais « vert = gagnant » : faible→modéré→élevé = neutre→amber→bear. Brand green (hue 155) ≠ signal direction ; signaux dans namespace `--signal-*`.
- **D-13** Stats de confiance = **win-rate mesuré + N visible + provenance (backtest/réel)** via source unique `applyThreshold` (`@app/core`). **Jamais un % nu.**
- **D-14** Marquee = **instruments couverts + sessions de marché** (forex/crypto/métaux ; Londres/NY/Tokyo). Neutre, informatif.
- **D-15** Baseline = descripteur NEXA **« Nouvelle Ère · Alliance d'Échange »**, décliné FR/EN/AR, sans promesse de gain.
- **D-16** Placement baseline = **header + hero**.
- **D-17** Ton = **sobre & crédible (« vétéran »)** : expertise calme, pédagogue, zéro hype.
- **D-18** Admin = reskin **sobre** : tokens + primitifs/composants, **sans hero ni animations**.

### Claude's Discretion
- Fallback `prefers-reduced-motion` exact du hero (composition statique — détail de rendu libre).
- Structure fine nav header/footer, états vides/chargement (skeletons), micro-interactions — libres dans le périmètre reskin, contraintes légales/RTL/a11y respectées.
- Mapping technique couleurs NEXA dans `CandleChart` (`getComputedStyle` OU table mapping tokens→hex via API JS lwc). **Recoloration uniquement**, jamais migration du fetch RLS au client (Anti-Pattern 3).
- « Étendre primitif shadcn » vs « créer composant NEXA » pour chaque élément DESIGN-05.
- Traductions FR/EN/AR exactes de la baseline (rédaction sans slop).

### Deferred Ideas (OUT OF SCOPE)
- Aucune. La discussion est restée dans le périmètre. Nav/états vides/détail couleurs CandleChart = dans le périmètre reskin sous discrétion Claude, pas reportés.
- **⚠ À signaler** : divergence ROADMAP — note Phase 11 dit « 6 spec files E2E » mais **5** existent. Voir §Open Questions Q1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|----|------------------------------|------------------|
| DESIGN-05 | Bibliothèque composants NEXA tokenisée (eyebrow, gauges/rings, marquee, stats confiance), pas de CSS bespoke par page | §Standard Stack (cva/data-slot precedent), §Pattern ScoreRing/Marquee/Eyebrow/ConfidenceStat, §Architecture |
| BRAND-01 | Marque = « NEXA » partout ; zéro « MERA »/« Make Everybody Rich Again » | §Rebranding targets (4 fichiers exacts), §Pitfall i18n parité |
| BRAND-02 | Baseline trilingue conforme, sans promesse de gain | §Pattern baseline i18n, §Validation (no-perf-claims), §Copy |
| BRAND-03 | Logo (mark + favicon + variantes clair/sombre + OG) au header/footer/métadonnées | §Pattern App Router metadata files, §Pattern SVG Logo |
| BRAND-04 | Aucune promesse de gain ni % non mesuré dans surfaces reskinées (no-perf-claims étendu aux composants) | §Validation Architecture (extension scanner JSX/composant) |
| UI-01 | Vitrine NEXA trilingue | §Architecture (route group `(marketing)`), §Wave découpage |
| UI-02 | Hero animé (globe + cartes + data-rain + tilt), reduced-motion respecté | §Pattern Globe filaire CSS, §Data-rain CSS, §Tilt vanilla TS, §Pitfalls |
| UI-03 | Espace membre (liste + détail + chart), gating RLS préservé | §Pattern recoloration lwc, §ScoreRing, §SignalCard HEX hardcodés |
| UI-04 | Académie NEXA, RTL + fallback FR préservés | §Architecture, §Pitfall RTL logiques |
| UI-05 | Auth + compte/abonnement NEXA | §Architecture, §ExpiryBanner |
| UI-06 | Admin NEXA (sobre) | §Architecture (D-18, hors `[locale]`) |
| UI-07 | ExpiryBanner câblé membre/compte (dette WIRING-01/PAY-05) | §Pattern ExpiryBanner tokenisation + câblage `(account)/abonnement` |
</phase_requirements>

## Summary

Phase 11 = **reskin + composants + identité**, PAS de nouvelle capacité produit. La fondation (tokens OKLCH 3 couches, 5 polices self-hostées, thème no-flash, RTL) est **livrée et figée en Phase 10** (`globals.css`, `lib/fonts.ts`). Les 20 primitifs shadcn `ui/` se re-skinnent **automatiquement** parce que les noms sémantiques des tokens (`--primary`, `--foreground`, etc.) sont inchangés — **ne pas les forker, ne pas restyler par page**. Le vrai travail :
1. **Construire 6 composants NEXA** (Eyebrow, ScoreRing, Marquee, ConfidenceStat, Logo, Hero) en-repo, mêmes conventions cva + `data-slot` + `cn` que les primitifs existants, référençant **uniquement la couche component** (`var()`), jamais de littéral HEX/OKLCH.
2. **Recolorer les couleurs hardcodées résiduelles** : `CandleChart.tsx:49-53` (lwc ne lit pas les CSS vars → API JS) ET `SignalCard.tsx:38-39` (HEX direction `#15803D`/`#B91C1C` en dur — **cible non listée dans CONTEXT, découverte ici**) ET `ExpiryBanner.tsx:49` (`border-amber-*`).
3. **Hero greenfield** en CSS + vanilla TS uniquement (globe filaire = SVG/CSS 3D transforms ; data-rain = keyframes + gradient ; tilt = pointermove vanilla), avec fallback `prefers-reduced-motion` 100% statique.
4. **Rebranding** sur **4 fichiers de code exacts** + assets metadata files App Router (`icon`, `apple-icon`, `opengraph-image`).
5. **Étendre `no-perf-claims.test.ts`** du scan i18n vers le scan de **copy de composant** (hero/marquee/gauges).

**Primary recommendation:** Découper en 6 vagues (primitifs/tokens-residus → composants DESIGN-05 → reskin par route group → hero → rebranding/assets → tests/garde-fous). Pour chaque composant DESIGN-05, **étendre un primitif shadcn quand un correspond** (Eyebrow→badge, ConfidenceStat→card) ; **créer neuf seulement** pour ce qui n'a pas de primitif (ScoreRing SVG, Marquee, Hero). Aucune nouvelle dépendance runtime — tout est CSS/vanilla TS/SVG inline + `next/og` (déjà dans Next 15).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Reskin primitifs `ui/` | Build (Tailwind v4 CSS-first) | — | Re-point de tokens au build ; aucun runtime. Les noms sémantiques inchangés → reskin auto. |
| Composants NEXA tokenisés | Frontend Server (RSC par défaut) | Client (Marquee/Hero si interactivité) | RSC quand statique (Eyebrow, ScoreRing pur SVG, ConfidenceStat) ; `'use client'` seulement si listener (tilt hero, theme re-read lwc). |
| Hero animé | Client (vanilla TS) + Build (CSS) | — | CSS keyframes (build) + tilt parallax (pointer listener client). Pas de SSR du canvas. |
| Recoloration CandleChart | Client | — | lwc touche `window`/canvas → `'use client'` + `next/dynamic({ssr:false})` (déjà le cas). Couleurs lues via `getComputedStyle` au mount. |
| Logo / favicon / OG | Build (metadata files) + Frontend Server (RSC `<Logo>`) | — | `icon`/`apple-icon`/`opengraph-image` générés au build via `next/og` ; `<Logo>` SVG inline rendu RSC. |
| Rebranding texte | Frontend Server (RSC) + i18n | — | Header/title/metadata = RSC ; placeholders = messages i18n. |
| Gating RLS, `<Disclaimer />` | Frontend Server (RSC) | Database (RLS) | **INCHANGÉ** (Anti-Pattern 3) — le reskin ne touche jamais la frontière de fetch. |
| Garde no-perf-claims | Build/CI (Vitest) | — | Test unit text-scan, étendu à la couverture composant. |

## Standard Stack

> **Aucune nouvelle dépendance runtime n'est ajoutée par cette phase.** Tout le nécessaire est déjà installé (Phase 10 + v2.0) OU fourni par Next 15 (`next/og`). Le tableau ci-dessous liste ce qui est **consommé**, pas installé.

### Core (déjà présent — `apps/web/package.json`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15 (verrouillé, PAS 16) | App Router/RSC, metadata files, `next/og` | [VERIFIED: package.json] `"next": "15"`. App Router metadata files = chemin natif favicon/OG. |
| react / react-dom | ^19.2.7 | RSC + client components | [VERIFIED: package.json] React 19 (Next 15). |
| tailwindcss / @tailwindcss/postcss | 4.3.1 | CSS-first, tokens en `@theme`/`:root`/`.dark` | [VERIFIED: package.json] v4, **aucun `tailwind.config`** (CLAUDE.md verrouillé). |
| radix-ui | 1.5.0 | umbrella primitifs shadcn (`Slot`, etc.) | [VERIFIED: package.json] precedent `badge.tsx`/`alert.tsx` importent `radix-ui`. |
| class-variance-authority | 0.7.1 | variants typés des composants | [VERIFIED: package.json] precedent cva dans tous les `ui/`. |
| clsx + tailwind-merge | 2.1.1 / 3.6.0 | `cn()` helper (`@/lib/utils`) | [VERIFIED: package.json] composé dans tous les primitifs. |
| lucide-react | 1.18.0 | icônes | [VERIFIED: components.json] `iconLibrary: lucide`. |
| lightweight-charts | 5.2.0 | CandleChart (recoloration via API JS) | [VERIFIED: package.json] v5 API `addSeries(CandlestickSeries,…)` déjà en place. |
| next-intl | 4.13.0 | i18n trilingue (baseline, copy, parité clés) | [VERIFIED: package.json] messages `fr/en/ar.json`. |
| next-themes | 0.4.6 | thème no-flash | [VERIFIED: package.json] **conservé tel quel** (D-06 Phase 10). |
| @app/core | workspace:* | `applyThreshold` (source unique du % mesuré) | [VERIFIED: package.json] ConfidenceStat DOIT passer par là. |
| tw-animate-css | 1.4.0 | utilitaires d'animation CSS (`@import` dans globals.css) | [VERIFIED: globals.css ligne 2] déjà importé — base pour anim hero CSS-only. |

### Supporting (capacités natives — rien à installer)
| Capability | Source | Purpose | When to Use |
|------------|--------|---------|-------------|
| `next/og` (`ImageResponse`) | intégré Next 15 | Génération OG/icons dynamiques | `opengraph-image.tsx`, `icon.tsx`, `apple-icon.tsx` (variante code). [CITED: nextjs.org metadata/app-icons] |
| SVG inline | natif | Logo mark hexagonal, ScoreRing radial | `<Logo>` + `<ScoreRing>` — gradient `#03d87f`→`#63279b`, `stroke-dasharray`. |
| CSS `@keyframes` + 3D transforms | natif (Tailwind v4 + globals.css) | Globe filaire, data-rain, marquee | Anim hero/marquee CSS-only (D-05). |
| Pointer events vanilla | natif | Tilt/parallax hero | `'use client'` minimal, `pointermove` → CSS custom props. |
| `getComputedStyle` | natif | Lire tokens OKLCH résolus pour lwc | Recoloration CandleChart (Anti-Pattern 5). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS 3D / SVG globe | three.js / WebGL | **INTERDIT (D-05)**. CSS suffit pour un filaire rotatif lent. |
| CSS keyframes anim | GSAP / `motion` | **INTERDIT sauf dernier recours (D-05)**. `motion` réservé à CALIB-02 (v2). |
| `next/og` ImageResponse | export Figma statique .png | ImageResponse = source unique, theme-aware, versionné en code ; mais un .png statique reste valable pour le mark si plus simple. Les deux sanctionnés. |
| Étendre badge pour Eyebrow | composant bespoke | Préférer extension (CONTEXT discretion) quand le primitif correspond. |

**Installation:**
```bash
# AUCUNE installation runtime requise pour cette phase.
# next/og est fourni par next@15 ; tw-animate-css, radix-ui, cva, lucide déjà présents.
# (Si un primitif shadcn officiel manquant est requis — improbable — via CLI officielle uniquement.)
```

**Version verification:** Toutes les versions sont [VERIFIED: package.json] (lues dans `apps/web/package.json` cette session). `next/og` fait partie de `next@15` — pas d'entrée registre séparée. Aucune nouvelle ligne de dépendance n'est introduite.

## Package Legitimacy Audit

> **Cette phase n'installe aucun package externe.** La bibliothèque de composants NEXA est **authored in-repo** (radix-ui umbrella + `cn` + `data-slot`, precedent D-04-03-A confirmé par `badge.tsx`/`alert.tsx`). Le hero est **CSS + vanilla TS only** (D-05). Zéro nouvelle dépendance runtime (confirmé `11-UI-SPEC.md §Registry Safety`).

| Package | Registry | Disposition |
|---------|----------|-------------|
| (aucun nouveau) | — | N/A — phase 100% in-repo + capacités Next 15 natives |

**Packages removed due to slopcheck [SLOP] verdict:** none (aucun package à auditer)
**Packages flagged as suspicious [SUS]:** none

*slopcheck non exécuté car aucun package externe n'est installé. Si le planner décide d'extraire un primitif shadcn officiel supplémentaire, le tirer via la CLI shadcn officielle (registre officiel, pas de gate tierce requise — `11-UI-SPEC.md §Registry Safety`).*

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────────────────────┐
   Phase 10 (FIGÉ) ───► │ globals.css : 3 couches OKLCH                │
                        │  primitive --nexa-*  →  semantic :root/.dark │
                        │                       →  component @theme    │
                        │ lib/fonts.ts : 5 familles self-hostées       │
                        └───────────────────┬─────────────────────────┘
                                            │ var() component layer ONLY
                                            ▼
   ┌────────────────────────────────────────────────────────────────────┐
   │ Bibliothèque NEXA (DESIGN-05) — authored in-repo, cva + data-slot   │
   │  Eyebrow(→badge)  ScoreRing(SVG)  Marquee  ConfidenceStat(→card)    │
   │  Logo(SVG)        Hero(CSS+vanilla TS)                              │
   └───────┬───────────────────────────────────────────────┬────────────┘
           │ consommés par                                  │
           ▼                                                ▼
   ┌──────────────────────────┐                  ┌──────────────────────────┐
   │ Route groups reskinés     │                  │ Recoloration résiduelle   │
   │  (marketing) UI-01/02/04  │                  │  CandleChart.tsx (lwc API)│
   │  (member)    UI-03        │                  │  SignalCard.tsx (HEX→token)│
   │  (auth)(account) UI-05/07 │                  │  ExpiryBanner.tsx (amber) │
   │  (admin) UI-06 sobre      │                  └──────────────────────────┘
   └──────────┬───────────────┘
              │ PRÉSERVÉ (jamais touché par le reskin)
              ▼
   ┌────────────────────────────────────────────────────────────┐
   │ Frontière de confiance : gating RLS + fetch serveur +       │
   │ <Disclaimer /> + data-testid/ARIA des 5 specs E2E           │
   │  (Anti-Pattern 3 : reskin = swap tokens, JAMAIS migrer fetch)│
   └────────────────────────────────────────────────────────────┘

   Rebranding (BRAND-01/03) :
     app/layout.tsx (title+OG)  •  [locale]/layout.tsx:56 (<span>→<Logo>)
     app/icon.* app/apple-icon.* app/opengraph-image.* (metadata files)
     messages/fr.json:210,489 (MERA→NEXA)
```

### Recommended Project Structure
```
apps/web/src/
├── components/
│   ├── ui/                    # 20 primitifs shadcn — RESKIN AUTO, ne pas forker
│   ├── nexa/                  # NOUVEAU : bibliothèque NEXA (DESIGN-05)
│   │   ├── Eyebrow.tsx        # extend badge (cva variant) OU neuf
│   │   ├── ScoreRing.tsx      # SVG radial, couleur=risque (D-11/D-12)
│   │   ├── Marquee.tsx        # CSS-only scroll, reduced-motion→liste statique
│   │   ├── ConfidenceStat.tsx # extend card, via applyThreshold (D-13)
│   │   └── Logo.tsx           # SVG mark hexagonal + wordmark Archivo
│   ├── hero/                  # NOUVEAU : hero greenfield (UI-02)
│   │   ├── Hero.tsx           # composition (RSC shell + client islands)
│   │   ├── WireframeGlobe.tsx # SVG/CSS 3D, rotation @keyframes
│   │   ├── DataRain.tsx       # CSS gradient + keyframes, aria-hidden
│   │   ├── FloatingCards.tsx  # cartes setups anonymisés (D-01, zéro %)
│   │   └── HeroTilt.tsx       # 'use client' minimal — pointermove → CSS var
│   ├── member/ExpiryBanner.tsx # EXISTE — tokeniser ligne 49 (UI-07)
│   └── signals/
│       ├── CandleChart.tsx    # EXISTE — recolorer 49-53 via lwc API (UI-03)
│       └── SignalCard.tsx     # EXISTE — HEX direction 38-39 → --signal-* (UI-03)
├── app/
│   ├── layout.tsx             # root metadata title+OG (BRAND-01/03)
│   ├── icon.tsx|.png|.svg     # NOUVEAU favicon mark (BRAND-03)
│   ├── apple-icon.tsx|.png    # NOUVEAU
│   ├── opengraph-image.tsx    # NOUVEAU OG image (BRAND-03)
│   └── [locale]/layout.tsx    # header <span> → <Logo> (BRAND-01)
├── messages/{fr,en,ar}.json   # baseline (D-15), placeholders MERA→NEXA, copy
└── test/no-perf-claims.test.ts # ÉTENDRE à la couverture composant (BRAND-04)
```

### Pattern 1 : Composant NEXA tokenisé (cva + data-slot + var())
**What:** Tout nouveau composant suit le moule exact des primitifs existants : `cva()` pour les variants, `data-slot` pour le ciblage, `cn()` pour la fusion, classes Tailwind qui résolvent vers les tokens component-layer.
**When:** Eyebrow, ConfidenceStat (extension), tout wrapper NEXA.
**Example (precedent vérifié `badge.tsx`/`alert.tsx`):**
```typescript
// Source: apps/web/src/components/ui/badge.tsx (precedent in-repo)
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const eyebrowVariants = cva(
  // font-accent = Chakra Petch (token Phase 10) ; couleur = purple accent token, JAMAIS littéral
  "inline-flex items-center font-accent text-sm font-semibold uppercase tracking-wide text-[var(--secondary-brand)]",
  { variants: { tone: { purple: "", muted: "text-muted-foreground" } },
    defaultVariants: { tone: "purple" } },
)

export function Eyebrow({ className, tone, ...props }:
  React.ComponentProps<"span"> & VariantProps<typeof eyebrowVariants>) {
  return <span data-slot="eyebrow" className={cn(eyebrowVariants({ tone }), className)} {...props} />
}
```
> ⚠ Note : `--secondary-brand`/purple n'existe PAS encore comme token component-layer dans `globals.css` (seuls `--nexa-purple-*` primitives existent). Le planner doit **soit** ajouter un token sémantique purple en couche 2/3 (Phase 11 a le droit d'AJOUTER des tokens component, pas de re-décider la palette), **soit** consommer via une var component existante. Voir §Open Questions Q2. [ASSUMED]

### Pattern 2 : ScoreRing SVG radial accessible (D-11/D-12)
**What:** Anneau SVG via `stroke-dasharray`/`stroke-dashoffset` sur un `<circle>`, chiffre centré en `--font-mono`, couleur = **risque** (neutre→amber→bear), jamais `--primary`/green.
**When:** liste signaux (~40px, hit-area ≥44px) ET détail (~96px). Un seul composant paramétré par `size`.
**Example:**
```tsx
// Couleur = RISQUE (D-12), mappée à 3 tokens — JAMAIS --primary
const RISK_STROKE = {
  faible:  "var(--muted-foreground)",   // neutre
  modere:  "var(--amber...)",           // amber (token à confirmer, voir Q2)
  eleve:   "var(--signal-bearish)",     // bear extrême uniquement
} as const

export function ScoreRing({ score, risk, size = 40 }: ScoreRingProps) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.max(0, Math.min(100, score)) / 100)
  return (
    <div role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}
         aria-label={`Score ${score} sur 100, risque ${risk}`}
         style={{ inlineSize: size, blockSize: size, minInlineSize: 44, minBlockSize: 44 }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size/2} cy={size/2} r={r} fill="none"
                stroke="var(--border)" strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
                stroke={RISK_STROKE[risk]} strokeWidth={4} strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={offset}
                transform={`rotate(-90 ${size/2} ${size/2})`} />
      </svg>
      <span className="font-mono tabular-nums"><bdi>{score}</bdi></span>
    </div>
  )
}
```
**a11y:** `role="meter"` + `aria-valuenow/min/max` + `aria-label` parlant (texte i18n, pas le seul code couleur — colorblind-safe). Le `<svg>` décoratif est `aria-hidden`. Hit-area ≥44px en liste (UI-SPEC §Spacing exception). [CITED: WAI-ARIA meter role — pattern standard]

### Pattern 3 : Globe filaire rotatif CSS-only (UI-02, D-02/D-05)
**What:** Filaire rotatif **sans WebGL**. Deux approches viables :
- **(A) SVG + CSS rotate (recommandé) :** un `<svg>` de méridiens/parallèles (ellipses + lignes) avec `gradient` green→purple, animé par `@keyframes spin { to { transform: rotate(360deg) } }` (rotation lente ~40-60s, `transform: rotateY` pour la 3D si perspective parent). Léger, net, scalable, `aria-hidden`.
- **(B) CSS 3D pur :** plusieurs `<div>` ellipses en `transform: rotateY(Ndeg)` sous un parent `perspective`, rotation `@keyframes` sur l'axe Y. Plus « 3D » mais plus de DOM.
**Coût perf:** transform/opacity uniquement = composé sur GPU, pas de reflow. Garder le nombre de cercles bas (~8-12 lignes). Pas de `box-shadow` animé (coûteux).
**reduced-motion:** envelopper l'anim dans `@media (prefers-reduced-motion: no-preference)` ; sinon le globe reste **statique mais visible** (D-05 : composition préservée).
**Example:**
```css
@media (prefers-reduced-motion: no-preference) {
  .nexa-globe { animation: nexa-globe-spin 48s linear infinite; }
}
@keyframes nexa-globe-spin { to { transform: rotate(1turn); } }
/* fallback : pas de @keyframes appliqué → globe figé, toujours rendu */
```

### Pattern 4 : Data-rain subtil CSS-only (UI-02, D-03)
**What:** Pluie de données discrète, **derrière** le contenu, faible opacité.
**Approche recommandée (gradient répété + translation), pas de caractères JS :**
```css
.nexa-datarain {
  position: absolute; inset: 0; z-index: 0; opacity: 0.06;
  pointer-events: none;
  background-image: repeating-linear-gradient(
    to bottom, var(--primary) 0 2px, transparent 2px 18px);
  background-size: 100% 200%;
}
@media (prefers-reduced-motion: no-preference) {
  .nexa-datarain { animation: nexa-rain 6s linear infinite; }
}
@keyframes nexa-rain { to { background-position: 0 200%; } }
```
Contenu hero en `z-index: 1+`. `aria-hidden="true"` (décoratif). reduced-motion ⇒ rain figé à faible opacité (toujours présent, D-04 ambiance préservée). Alternative caractères (colonnes de glyphes) = plus de DOM/CPU — éviter en P1.

### Pattern 5 : Marquee accessible CSS-only RTL-aware (D-14)
**What:** Bande défilante d'instruments + sessions, **zéro %**, pause sous reduced-motion.
**Example:**
```tsx
// Dupliquer le contenu ×2 pour boucle continue ; aria-label décrit, items aria-hidden si dupliqués
<div className="nexa-marquee overflow-hidden" role="marquee" aria-label={t('marquee.label')}>
  <ul className="nexa-marquee-track flex gap-6">{items}{itemsClone}</ul>
</div>
```
```css
.nexa-marquee-track { animation: none; } /* statique = liste lisible (reduced-motion / fallback) */
@media (prefers-reduced-motion: no-preference) {
  .nexa-marquee-track { animation: nexa-scroll 30s linear infinite; }
}
@keyframes nexa-scroll { to { transform: translateX(-50%); } }
[dir="rtl"] .nexa-marquee-track { animation-name: nexa-scroll-rtl; }
@keyframes nexa-scroll-rtl { to { transform: translateX(50%); } }
```
**RTL:** la direction de scroll suit `dir` (deux keyframes, ou `translateX` calculé). `transform: translateX` est direction-neutre côté CSS mais le sens doit être inversé manuellement en RTL. Pause au survol optionnelle (`:hover { animation-play-state: paused }`).

### Pattern 6 : Tilt/parallax hero vanilla TS (D-05, sans lib)
**What:** Léger tilt 3D au pointer, **vanilla TS only**, désactivé sous reduced-motion.
**Example:**
```tsx
'use client'
// island minimale : écrit dans des CSS custom props, le rendu reste CSS
export function HeroTilt({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return // D-05
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      el.style.setProperty('--tilt-x', `${((e.clientY - r.top)/r.height - 0.5) * -6}deg`)
      el.style.setProperty('--tilt-y', `${((e.clientX - r.left)/r.width - 0.5) * 6}deg`)
    }
    el.addEventListener('pointermove', onMove)
    return () => el.removeEventListener('pointermove', onMove)
  }, [])
  return <div ref={ref} style={{ transform: 'perspective(800px) rotateX(var(--tilt-x,0)) rotateY(var(--tilt-y,0))' }}>{children}</div>
}
```

### Pattern 7 : Recoloration lightweight-charts sans CSS vars (UI-03, Anti-Pattern 5)
**What:** lwc ne lit pas les CSS vars. Lire les tokens OKLCH **résolus** via `getComputedStyle` au mount + `applyOptions`, ré-appliquer au changement de thème.
**Example:**
```tsx
// dans le useEffect existant de CandleChart, AVANT createChart :
const root = containerRef.current!
const readToken = (name: string) =>
  getComputedStyle(root).getPropertyValue(name).trim()
const UP = readToken('--signal-bullish')   // remplace '#15803D'
const DOWN = readToken('--signal-bearish') // remplace '#B91C1C'
const ENTRY = readToken('--foreground')    // neutre (remplace brand-blue '#1E5FBF')
// ... addSeries({ upColor: UP, downColor: DOWN, ... }) ; createPriceLine({ color: UP/DOWN/ENTRY })
```
**Theme toggle:** ajouter au dépendance `useEffect` un signal de thème (`useTheme()` de next-themes côté client) OU un `MutationObserver` sur `document.documentElement.classList` (`.dark`), pour relire les tokens et `series.applyOptions()` quand le thème change. **Recoloration uniquement** — ne JAMAIS toucher le fetch RLS serveur (Anti-Pattern 3). [CITED: lightweight-charts v5 applyOptions API]

### Pattern 8 : App Router metadata files — favicon / icons / OG (BRAND-03)
**What:** Conventions natives Next 15. Fichiers statiques OU générés par code (`next/og`).
**Conventions (confirmées) :**
- `app/favicon.ico` — **uniquement** à la racine `app/`, **non générable** par code. [CITED: nextjs.org metadata/app-icons]
- `app/icon.(ico|jpg|jpeg|png|svg)` statique **ou** `app/icon.tsx` généré.
- `app/apple-icon.(jpg|jpeg|png)` statique **ou** `app/apple-icon.tsx` généré (défaut 180×180).
- `app/opengraph-image.(jpg|jpeg|png|gif)` statique **ou** `app/opengraph-image.tsx` généré (défaut **1200×630**).
- Variante générée : `export default function Image()` retournant `ImageResponse`, + exports optionnels `size`, `contentType`, `alt`.
**Example (OG dynamique theme-aware, hex de marque exacts) :**
```tsx
// app/opengraph-image.tsx  — Source: nextjs.org/docs/.../metadata/opengraph-image
import { ImageResponse } from 'next/og'
export const alt = 'NEXA — Nouvelle Ère · Alliance d\'Échange'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export default function Image() {
  return new ImageResponse(
    (<div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center',
        justifyContent:'center', background:'#0a0e1a',
        backgroundImage:'linear-gradient(135deg,#03d87f,#63279b)' }}>
        {/* mark hexagonal N + wordmark NEXA */}
     </div>),
    size,
  )
}
```
**⚠ Placement (mono-`[locale]`) :** le seul `<html>` vit dans `app/[locale]/layout.tsx`, mais les metadata files (`icon`/`apple-icon`/`opengraph-image`/`favicon.ico`) vont à la **racine `app/`** (ils s'attachent aux `<head>` via le système metadata, indépendant de la locale). [CITED: nextjs.org app-icons]

### Pattern 9 : Logo SVG hexagonal (BRAND-03, D-06/D-08/D-10)
**What:** `<Logo>` = SVG inline (mark hexagonal « N » + wordmark Archivo), gradient `#03d87f`→`#63279b` via `<linearGradient>`. Variantes clair/sombre par `currentColor` ou via classes thème.
**When:** header (`[locale]/layout.tsx:56`), footer, + source du favicon/OG (réutiliser le path SVG).
**Note:** les hex exacts `#03d87f`/`#63279b` sont **autorisés DANS le SVG du logo** (c'est un asset de marque, pas un token de composant) — c'est la seule exception sanctionnée au « var() only », car le mark a une identité chromatique fixe indépendante du thème. Tout le RESTE consomme `var()`. [ASSUMED — à confirmer planner : exception logo vs règle var()]

### Anti-Patterns to Avoid
- **Forker/dupliquer les primitifs `ui/`** : ils se reskinnent par re-point de tokens. Restyler par page = CSS bespoke interdit (DESIGN-05). [VERIFIED: 11-UI-SPEC §Component Inventory]
- **Littéral HEX/OKLCH dans `@theme inline` ou un composant** : casse silencieusement le flip `.dark`. Composants = `var()` only (sauf SVG logo). [VERIFIED: globals.css commentaire Pitfall 3 + 10-PATTERNS]
- **Migrer le fetch RLS vers le client** « pour faciliter le reskin » (Anti-Pattern 3). Le reskin = swap visuel uniquement. [VERIFIED: ROADMAP §Phase 11 Notes]
- **GSAP/three.js/WebGL/`motion`** pour le hero (D-05). [VERIFIED: REQUIREMENTS Out of Scope]
- **Brand green (hue 155) pour encoder direction/score** (D-05/D-12). Direction = `--signal-*`, score = échelle risque. [VERIFIED: globals.css commentaire D-05]
- **Propriétés physiques** (`ml-/mr-/left-/right-/text-left`) — RTL cassé, fail `rtl-logical-props.test.ts` (Phase 10). [VERIFIED: 10-PATTERNS]
- **% nu / promesse de gain** dans tout composant — fail `no-perf-claims` étendu (BRAND-04). [VERIFIED: REQUIREMENTS]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Thème no-flash | Script d'injection custom | next-themes (Phase 10, conservé) | Déjà résolu, pré-paint + `suppressHydrationWarning`. |
| % mesuré + seuil N | Logique inline dans ConfidenceStat | `applyThreshold` (`@app/core`) | Source unique (D-13), cohérent Phases 13/14, garde anti-% nu. |
| Variants de composant | `className` conditionnels manuels | `cva` (precedent `ui/`) | Typage + cohérence avec les 20 primitifs. |
| Génération OG/favicon | Pipeline d'images externe | `next/og` ImageResponse | Natif Next 15, theme-aware, versionné en code. |
| Animation hero | GSAP/lib d'anim | CSS `@keyframes` + `tw-animate-css` + vanilla TS | D-05 verrouillé ; CSS suffit pour filaire/rain/marquee. |
| Couleurs lwc | Re-implémenter un theming chart | `getComputedStyle` + `applyOptions` | lwc expose l'API JS ; pas besoin de patcher la lib. |
| Fusion de classes | concat manuelle | `cn()` (`@/lib/utils`) | `clsx`+`tailwind-merge` déjà en place. |

**Key insight:** Cette phase ne crée presque rien de bas niveau — elle **assemble** la fondation Phase 10 et les primitifs existants. Le seul code « nouveau » non trivial = SVG (ScoreRing/Logo) et anim CSS/vanilla (Hero). Tout le reste est composition + re-point de tokens.

## Runtime State Inventory

> Phase de reskin/rebranding (rename MERA→NEXA + assets). Inventaire des états runtime au-delà des fichiers.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — la marque « MERA » n'est PAS une clé/collection/ID en base. Les `trade_setups`/`instruments`/`pattern_stats` ne contiennent pas la chaîne de marque. (Vérifié : occurrences MERA = code header + 2 placeholders i18n + `.planning/**` docs.) | Aucune migration de données. Édition code/i18n uniquement. |
| Live service config | **None** dans le périmètre code. (Telegram/affiliation non touchés par le reskin.) | Aucune. |
| OS-registered state | **None** — pas de tâche planifiée référençant « MERA » (les jobs sont Phase 12). | Aucune. |
| Secrets/env vars | **None** — aucune var d'env nommée d'après la marque. Le placeholder `codePlaceholder: "Ex : MERA2026"` (`fr.json:210`) est du **texte UI**, pas un code réel ni un secret. | Renommer le texte (`NEXA2026`). Aucun secret. |
| Build artifacts | **Favicon/icons existants** : vérifier s'il existe un `app/favicon.ico` v2.0 à remplacer ; les nouveaux metadata files (`icon`/`apple-icon`/`opengraph-image`) sont générés au build. Polices .woff2 déjà en place (Phase 10). | Remplacer/ajouter les metadata files ; rebuild régénère icons/OG. |

**Canonical question — après mise à jour des fichiers, quel état runtime garde encore l'ancienne marque ?** Réponse : **aucun état persistant**. Le rebranding MERA→NEXA est purement **code + i18n + assets statiques** (4 fichiers de code + metadata files). Aucune donnée stockée, aucun secret, aucune tâche OS à re-enregistrer. C'est un rename « propre » côté présentation.

## Common Pitfalls

### Pitfall 1 : Cibles de couleur hardcodée oubliées
**What goes wrong:** CONTEXT liste CandleChart + ExpiryBanner, mais **`SignalCard.tsx:38-39` a aussi des HEX direction en dur** (`#15803D`/`#B91C1C`/`#22C55E`/`#EF4444`) — découvert cette session. Si non recoloré, la liste signaux garde l'ancienne palette.
**Why:** Hérité v2.0, antérieur au namespace `--signal-*`.
**How to avoid:** Wave « recoloration résiduelle » = scanner TOUT le code pour HEX/`amber-`/`blue-` hardcodés (grep `#[0-9A-Fa-f]{6}` + `(amber|blue|red|green)-\d` dans `apps/web/src`). Cibles connues : `CandleChart.tsx:49-53`, `SignalCard.tsx:38-39`, `ExpiryBanner.tsx:49`.
**Warning signs:** Un composant rend une couleur qui ne flippe pas avec le thème.

### Pitfall 2 : reduced-motion partiel
**What goes wrong:** Désactiver l'anim CSS mais laisser le listener `pointermove` JS actif → tilt persiste sous reduced-motion (viole D-05).
**Why:** Deux chemins (CSS + JS) ; oublier le garde JS.
**How to avoid:** `matchMedia('(prefers-reduced-motion: reduce)')` côté JS AVANT d'attacher tout listener (Pattern 6) ET `@media (prefers-reduced-motion: no-preference)` pour TOUTE anim CSS. Tester les deux états.
**Warning signs:** Mouvement résiduel quand l'OS est en « réduire les animations ».

### Pitfall 3 : Parité des clés i18n cassée par la baseline
**What goes wrong:** Ajouter la baseline en `fr.json` sans `en.json`/`ar.json` → fail parité, manque la version arabe.
**Why:** 3 langues, parité stricte (`check-i18n-hardcoded.mjs`).
**How to avoid:** Toute nouvelle clé (baseline D-15, marquee, états vides) ajoutée aux 3 fichiers simultanément. Rédiger sans slop (`stop-slop`). RTL : la baseline arabe doit lire correctement en miroir.
**Warning signs:** Test de parité rouge, ou clé affichée brute.

### Pitfall 4 : Token purple/amber component-layer manquant
**What goes wrong:** Eyebrow veut `--secondary-brand` (purple) et ScoreRing veut un amber « modéré », mais seuls les **primitives** `--nexa-purple-*` existent ; aucun token component purple/amber n'est exposé en couche 2/3.
**Why:** Phase 10 n'a exposé que green/signal en couche sémantique.
**How to avoid:** Phase 11 PEUT **ajouter** des tokens component (purple accent, amber risque) en respectant l'architecture 3 couches (primitive→semantic→component), **sans re-décider la palette**. Ne PAS consommer le primitive directement depuis un composant. Voir Open Question Q2.
**Warning signs:** Composant référençant `var(--nexa-*)` (primitive) au lieu d'un token component.

### Pitfall 5 : CandleChart re-render au theme toggle non géré
**What goes wrong:** Tokens lus une fois au mount ; au passage clair↔sombre le chart garde les anciennes couleurs.
**Why:** `getComputedStyle` au mount uniquement.
**How to avoid:** Observer le thème (next-themes `useTheme` ou `MutationObserver` sur `.dark`) et `series.applyOptions()` + relire les tokens (Pattern 7).
**Warning signs:** Couleurs chart figées après toggle.

### Pitfall 6 : Préservation des data-testid/ARIA E2E
**What goes wrong:** Restructurer le DOM d'une surface reskinée casse un sélecteur des 5 specs (`i18n`, `affiliation-attribution`, `auth`, `gating`, `academie`).
**Why:** Le reskin touche le markup.
**How to avoid:** Avant de reskiner une route group, grep ses `data-testid`/rôles utilisés par les specs et les **préserver**. Lancer la suite E2E après chaque vague de reskin.
**Warning signs:** Spec E2E rouge après reskin.

## Code Examples

(Voir §Architecture Patterns 1-9 — chaque pattern porte un exemple vérifié contre un precedent in-repo ou la doc officielle citée.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Favicon via `<link>` dans `<head>` manuel | Metadata files App Router (`app/icon.*`, `favicon.ico`) | Next 13+ App Router | Convention par fichier, pas de `<head>` manuel. [CITED: nextjs.org] |
| OG image statique exportée | `next/og` `ImageResponse` (génération code, theme-aware) | Next 13.3+ | OG versionné en code, dynamique. [CITED: nextjs.org] |
| lwc v4 `addCandlestickSeries()` | v5 `addSeries(CandlestickSeries, …)` | lwc 5.x | Déjà en place dans `CandleChart.tsx`. [VERIFIED: CandleChart.tsx:96] |
| `tailwind.config` JS | Tailwind v4 CSS-first (`@theme` dans CSS) | Tailwind v4 | Tokens en CSS, aucun config (verrouillé). [VERIFIED: globals.css] |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs` : déjà remplacé par `@supabase/ssr` (hors périmètre reskin, ne pas toucher).
- Hex direction v2.0 (`#15803D`/`#B91C1C`/`#1E5FBF`) : à remplacer par `--signal-*`/`--foreground`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Un token component purple/amber doit être ajouté en Phase 11 (couche 2/3) car seuls les primitives existent | Pattern 1, Pitfall 4, Q2 | Si un token existe déjà sous un autre nom, ajout redondant. Faible — vérifiable par grep `globals.css`. |
| A2 | Les hex exacts `#03d87f`/`#63279b` sont autorisés DANS le SVG du logo (exception à var()-only) | Pattern 9 | Si la règle var()-only s'applique même au SVG, le logo doit dériver d'un token. Mais un mark a une identité fixe theme-indépendante (D-04 ambiance) → exception raisonnable. |
| A3 | `favicon.ico` ancien peut exister à `app/` (v2.0) et devoir être remplacé | Runtime State, Pattern 8 | Si absent, simple ajout. Vérifiable par glob `app/favicon.ico`. |
| A4 | La couverture composant de no-perf-claims se fait par scan de la copy i18n des composants hero/marquee/gauges (mêmes namespaces étendus) plutôt que par rendu JSX | Validation Architecture | Si le contenu est inline JSX (pas i18n), un scan i18n le rate. Mais la copy DOIT passer par i18n (Copywriting Contract) → scan i18n suffit si on ajoute les namespaces des composants. |

## Open Questions

1. **Divergence E2E : ROADMAP dit « 6 spec files », 5 existent.**
   - Ce qu'on sait : `apps/web/e2e/` contient exactement 5 specs (`i18n`, `affiliation-attribution`, `gating`, `auth`, `academie`) — vérifié par glob cette session. Aucune spec membre/signaux.
   - Ce qui est flou : la 6e (probablement « member/signaux ») était-elle attendue/à créer, ou la note ROADMAP est-elle une coquille ?
   - Recommandation : **ne pas casser les 5 existants**. Le planner peut (a) traiter « 6 » comme coquille et préserver les 5, OU (b) ajouter une spec member/signaux de préservation reskin (couvre UI-03). Trancher en planning. Ne bloque PAS l'implémentation.

2. **Tokens component purple (Eyebrow) et amber (ScoreRing risque modéré).**
   - Ce qu'on sait : `globals.css` expose green/signal-bull/signal-bear en couche sémantique ; purple et amber n'existent qu'en **primitives** (`--nexa-purple-*`) ou pas du tout (amber absent).
   - Ce qui est flou : nom exact des tokens component à ajouter pour purple accent (eyebrow/gradient) et amber (risque modéré).
   - Recommandation : Phase 11 **ajoute** ces tokens component en respectant les 3 couches (primitive amber à ajouter en couche 1 si absent → sémantique → component), sans re-décider la palette verrouillée. À spécifier dans le 1er plan (Wave tokens-résidus).

3. **Câblage `(account)/abonnement` de l'ExpiryBanner.**
   - Ce qu'on sait : l'ExpiryBanner est câblé dans `(member)/layout.tsx:34`. UI-07 exige aussi sa visibilité sur `(account)/abonnement`.
   - Ce qui est flou : `abonnement/page.tsx` lit-il déjà `current_period_end` (anon-client RLS) ?
   - Recommandation : vérifier `abonnement/page.tsx` en planning ; réutiliser le même fetch RLS anon-client (jamais service_role côté client), pas de duplication de logique.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/pnpm + Next 15 dev | build/dev reskin | ✓ | next 15 | — |
| `next/og` | icons/OG génération | ✓ (intégré next 15) | — | .png statiques exportés |
| Vitest | no-perf-claims étendu | ✓ | 4.x (root) | — |
| Playwright + `next dev` sur :3000 | E2E préservation | ✓ | @playwright/test (root) | — |

**Missing dependencies with no fallback:** Aucune.
**Missing dependencies with fallback:** Aucune (phase 100% in-repo + natif).

## Validation Architecture

> Phase avec garde-fou no-perf-claims (BRAND-04) + préservation E2E + parité i18n. Nyquist validation : **enabled**.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (unit/text-scan) + Playwright (E2E) — harness existant racine repo |
| Config file | `vitest.config.ts` + `playwright.config.ts` (racine) — glob inclut `apps/web/test/**/*.test.ts` |
| Quick run command | `pnpm vitest run apps/web/test/no-perf-claims.test.ts` |
| Full suite command | `pnpm vitest run` (unit) + `pnpm playwright test` (E2E, requiert `next dev` :3000) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRAND-04 | Aucun % nu/promesse dans copy composant (hero/marquee/gauges) | unit (text-scan i18n étendu) | `pnpm vitest run apps/web/test/no-perf-claims.test.ts` | ✅ (à ÉTENDRE — namespaces composant absents) |
| BRAND-01 | Zéro « MERA »/« Make Everybody Rich Again » en code/contenu | unit (scan) | nouveau test ou extension no-perf scan MERA | ❌ Wave (test scan rebrand) |
| DESIGN-04 | Propriétés logiques only (RTL) sur surfaces reskinées | unit (regex scan) | `pnpm vitest run apps/web/tests/rtl-logical-props.test.ts` (Phase 10) | ✅ (étendre la liste des fichiers scannés aux nouveaux composants) |
| UI-01..06 | data-testid/ARIA préservés post-reskin | E2E | `pnpm playwright test` (5 specs) | ✅ (5 specs — préserver) |
| BRAND-02 | Parité clés baseline FR/EN/AR | unit | test parité i18n existant + `check-i18n-hardcoded.mjs` | ✅ |
| DESIGN-05 | ScoreRing `role=meter`/aria ; Marquee aria-label | E2E/unit (optionnel) | smoke a11y | ❌ Wave (optionnel) |

### Sampling Rate
- **Per task commit:** `pnpm vitest run apps/web/test/no-perf-claims.test.ts` + le test de la cible touchée.
- **Per wave merge:** `pnpm vitest run` (toute la suite unit) + typecheck.
- **Phase gate:** suite unit verte + `pnpm playwright test` (5 specs) verts avant `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] Étendre `apps/web/test/no-perf-claims.test.ts` : ajouter les namespaces i18n des nouveaux composants (hero/marquee/gauges/baseline) au scan, + un cas de contrôle composant. Garder `take-profit(s)` whitelisté (precedent D-02-03-D).
- [ ] (Optionnel) test scan rebrand : assert `MERA`/`Make Everybody Rich Again` absent de `apps/web/src` + messages (hors `.planning/**`).
- [ ] Étendre `rtl-logical-props.test.ts` (Phase 10) à la liste des nouveaux fichiers composant/hero.
- [ ] (Optionnel, lié Q1) spec E2E member/signaux de préservation reskin.

*Aucune install de framework — harness Vitest+Playwright déjà en place (10-PATTERNS §No Analog Found).*

## Security Domain

> `security_enforcement` non explicitement `false` → inclus. Phase frontend/reskin : surface de sécurité limitée mais réelle (préservation RLS, XSS via copy/SVG).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Auth inchangée (reskin auth = visuel uniquement, UI-05). |
| V3 Session Management | no | Inchangé. |
| V4 Access Control | **yes** | **Gating RLS PRÉSERVÉ** — le reskin ne migre JAMAIS le fetch RLS vers le client (Anti-Pattern 3). `service_role` jamais exposé côté client (ExpiryBanner/abonnement = anon-client RLS). |
| V5 Input Validation | partial | Copy via i18n (pas d'input neuf). SVG/Logo authored in-repo (pas d'upload utilisateur). |
| V6 Cryptography | no | Aucune crypto introduite. |
| V14 Config | yes | Aucun secret hardcodé ; hex de marque ≠ secret. |

### Known Threat Patterns for {Next.js 15 / React 19 reskin}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fuite de données gated via fetch client (reskin) | Information Disclosure | NE PAS migrer le fetch RLS au client (Anti-Pattern 3) ; garder le fetch serveur + RLS. |
| `service_role` côté client | Elevation of Privilege | anon-client RLS uniquement dans les composants client (ExpiryBanner precedent). |
| XSS via SVG/`dangerouslySetInnerHTML` | Tampering | Logo/ScoreRing = SVG **statique authored**, pas d'injection ; jamais `dangerouslySetInnerHTML` sur contenu dynamique. |
| Promesse de gain réintroduite (exposition légale) | (légal) | Garde `no-perf-claims` étendu (BRAND-04) + revue copy sans slop. |

## Sources

### Primary (HIGH confidence)
- `apps/web/package.json`, `components.json`, `globals.css`, `lib/fonts.ts` — stack, tokens, polices (lus cette session) — VERIFIED.
- `apps/web/src/components/ui/badge.tsx`, `alert.tsx` — precedent cva/data-slot/cn — VERIFIED.
- `apps/web/src/components/signals/{CandleChart,SignalCard}.tsx`, `member/ExpiryBanner.tsx` — cibles recoloration (HEX en dur) — VERIFIED.
- `apps/web/test/no-perf-claims.test.ts` — scanner i18n à étendre — VERIFIED.
- `apps/web/e2e/*` — 5 specs (divergence ROADMAP « 6 ») — VERIFIED par glob.
- `11-CONTEXT.md`, `11-UI-SPEC.md`, `10-PATTERNS.md`, `REQUIREMENTS.md`, `ROADMAP.md` — décisions + périmètre — VERIFIED (source projet).
- nextjs.org — App Router metadata files (favicon/icon/apple-icon/opengraph-image) + `ImageResponse` (size/contentType/alt, défauts 1200×630 / 180×180, favicon non générable, racine `app/`) — CITED.

### Secondary (MEDIUM confidence)
- WebSearch (nextjs.org + guides communautaires) — confirmation conventions metadata files Next 15 — MEDIUM (recoupé avec doc officielle).

### Tertiary (LOW confidence)
- Patterns CSS globe/data-rain/marquee/tilt — techniques standard CSS/SVG (training) — exemples à ajuster au rendu réel par le planner/implémenteur. Aucune lib externe en jeu.

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH — aucune nouvelle dépendance, tout VERIFIED dans package.json.
- Architecture/patterns composants : HIGH — precedent in-repo direct (badge/alert/CandleChart).
- Metadata files Next 15 : HIGH — doc officielle citée.
- Anim hero CSS/vanilla : MEDIUM — techniques standard, mais rendu visuel exact = itération implémenteur (discrétion Claude).
- Pitfalls : HIGH — dérivés du code lu + commentaires verrouillés Phase 10.

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (stack verrouillée, stable 30 jours)
