---
phase: quick-260617-nsh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/components/signals/CandleChartLazy.tsx
  - apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx
  - apps/web/next.config.ts
  - apps/web/package.json
autonomous: true
requirements: [BUILD-PROD]
must_haves:
  truths:
    - "pnpm --filter web build (webpack) passes with zero errors"
    - "ssr:false dynamic import lives in a Client Component, not the RSC"
    - "Workspace package .js imports resolve under webpack build"
    - "@app/data-sources is transpiled by Next"
  artifacts:
    - path: "apps/web/src/components/signals/CandleChartLazy.tsx"
      provides: "Client wrapper hosting dynamic(ssr:false) for CandleChart"
      contains: "'use client'"
    - path: "apps/web/next.config.ts"
      provides: "transpilePackages including @app/data-sources"
      contains: "@app/data-sources"
    - path: "apps/web/package.json"
      provides: "build script using webpack (no --turbopack)"
  key_links:
    - from: "apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx"
      to: "apps/web/src/components/signals/CandleChartLazy.tsx"
      via: "import CandleChartLazy"
      pattern: "CandleChartLazy"
---

<objective>
Corriger 3 erreurs de build production Next 15 (apps/web) bloquant Vercel. Corrections build/config UNIQUEMENT — zéro changement de logique métier (scoring, repos, jobs intacts).

Purpose: Débloquer le déploiement Vercel du monorepo pnpm.
Output: Wrapper Client Component pour le chart, page RSC nettoyée, next.config + package.json corrigés. Le build webpack passe.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# Page RSC fautive (ssr:false interdit en Server Component)
@apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx

# Composant chart déjà 'use client' (cible du dynamic import)
@apps/web/src/components/signals/CandleChart.tsx

# Config Next à corriger
@apps/web/next.config.ts
@apps/web/package.json

<interfaces>
<!-- Props exactes à reproduire dans le wrapper. Source: CandleChart.tsx -->
From apps/web/src/components/signals/CandleChart.tsx:
```typescript
export interface Candle {
  ts: string
  open: number
  high: number
  low: number
  close: number
}

export interface CandleChartProps {
  candles: Candle[]
  entry: number
  stopLoss: number
  takeProfits: number[]
  direction: 'long' | 'short'
  precision: number
}

export function CandleChart(props: CandleChartProps): JSX.Element
export default CandleChart
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wrapper Client Component + nettoyage page RSC</name>
  <files>apps/web/src/components/signals/CandleChartLazy.tsx, apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx</files>
  <action>
Créer apps/web/src/components/signals/CandleChartLazy.tsx avec `'use client'` en TOUTE 1re ligne (avant tout import/commentaire). Le fichier importe `dynamic` de 'next/dynamic', réimporte le type `CandleChartProps` depuis './CandleChart', déclare `const CandleChart = dynamic(() => import('./CandleChart').then((m) => m.CandleChart), { ssr: false })`, et exporte `function CandleChartLazy(props: CandleChartProps)` qui rend `<CandleChart {...props} />`. Conserver le commentaire d'intention (chart client-only, référence window/canvas — Pitfall 5).

Dans page.tsx : supprimer la ligne `import dynamic from 'next/dynamic'` (ligne 18 — n'est plus utilisée ailleurs, confirmé). Supprimer la déclaration `const CandleChart = dynamic(...)` (lignes 60-64) avec son commentaire. Ajouter `import { CandleChartLazy } from '../../../../../components/signals/CandleChartLazy'` à côté des autres imports de composants signals. Remplacer l'usage JSX `<CandleChart ... />` (lignes 151-158) par `<CandleChartLazy ... />` en conservant EXACTEMENT les mêmes props (candles, entry, stopLoss, takeProfits, direction, precision). Garder le commentaire ligne 13-14 reformulé si besoin (le dynamic vit maintenant dans le wrapper). Aucune autre modif de logique.
  </action>
  <verify>
    <automated>cd "apps/web" && pnpm --filter web build 2>&1 | grep -iE "ssr: false is not allowed|next/dynamic in Server" ; test $? -ne 0</automated>
  </verify>
  <done>CandleChartLazy.tsx existe avec 'use client' en ligne 1 ; page.tsx n'importe plus `dynamic` et utilise `<CandleChartLazy>` avec props identiques ; aucune erreur "ssr: false is not allowed" au build.</done>
</task>

<task type="auto">
  <name>Task 2: Build webpack + transpilePackages complet</name>
  <files>apps/web/package.json, apps/web/next.config.ts</files>
  <action>
Dans apps/web/package.json : changer le script `"build"` de `"next build --turbopack"` en `"next build"` (build webpack — applique l'extensionAlias .js→.ts pour les transpilePackages, ce que turbopack ne fait pas pour les packages workspace exportant du TS source). GARDER `"dev": "next dev --turbopack"` INCHANGÉ. Ne toucher aucun autre script.

Dans apps/web/next.config.ts : ajouter `'@app/data-sources'` au tableau `transpilePackages` (qui passe de `['@app/core', '@app/supabase']` à `['@app/core', '@app/supabase', '@app/data-sources']`). Raison : @app/data-sources est importé par apps/web/src/app/[locale]/(account)/abonnement/actions.ts (server action paiement USDT/TronGrid) et doit être transpilé. Ne pas toucher `outputFileTracingRoot` ni `turbopack.root` (le bloc `turbopack` reste pour `next dev`).
  </action>
  <verify>
    <automated>cd "apps/web" && pnpm --filter web build 2>&1 | grep -iE "Module not found|Can't resolve" ; test $? -ne 0</automated>
  </verify>
  <done>package.json build = "next build" (dev inchangé) ; next.config.ts transpilePackages contient @app/data-sources ; aucune erreur "Module not found / Can't resolve" pour les imports .js des packages workspace.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web build` passe SANS erreur en local (build webpack).
- Aucune erreur "ssr: false is not allowed" (Erreur 1).
- Aucune erreur "Module not found: Can't resolve './*.js'" (Erreur 2).
- @app/data-sources transpilé (Erreur 3).
- Typecheck/lint inchangés. AUCUN déploiement Vercel lancé.
- Aucune modif de logique métier (scoring/repos/jobs intacts).
</verification>

<success_criteria>
`pnpm --filter web build` termine avec exit 0 et zéro erreur. `dev` reste sur turbopack. Props du chart inchangées (parité fonctionnelle).
</success_criteria>

<output>
Create `.planning/quick/260617-nsh-fix-web-prod-build/260617-nsh-SUMMARY.md` when done
</output>
