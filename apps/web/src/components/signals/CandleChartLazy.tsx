'use client'

/**
 * CandleChartLazy — wrapper Client Component hébergeant le dynamic(ssr:false).
 *
 * Le chart (lightweight-charts) est client-only : il touche `window`/canvas et ne
 * doit JAMAIS être rendu côté serveur (Pitfall 5). `next/dynamic` avec `{ ssr:false }`
 * est interdit dans un Server Component sous Next 15 → l'import dynamique vit ici,
 * dans un Client Component, et la page RSC monte simplement <CandleChartLazy>.
 *
 * Parité de props stricte avec CandleChart (CandleChartProps réimporté).
 */
import dynamic from 'next/dynamic'
import type { CandleChartProps } from './CandleChart'

const CandleChart = dynamic(
  () => import('./CandleChart').then((m) => m.CandleChart),
  { ssr: false },
)

export function CandleChartLazy(props: CandleChartProps) {
  return <CandleChart {...props} />
}

export default CandleChartLazy
