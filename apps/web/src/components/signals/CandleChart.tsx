/**
 * CandleChart — graphique chandeliers lecture seule (Plan 03-03 Task 1 ; MEMB-03, D-12).
 *
 * 'use client' + monté via next/dynamic({ ssr:false }) depuis la route détail
 * (Pitfall 5 : lightweight-charts touche `window`/canvas → jamais en SSR).
 *
 * Color law D-12 : bougies up=vert / down=rouge ; ligne entrée=brand-blue dashed ;
 * SL=rouge ; chaque TP=vert. Lignes légendées (title) pour rester colorblind-safe.
 * Lecture seule : handleScroll/handleScale=false, crosshair mode 0 (Normal off).
 *
 * Robustesse : une erreur de montage ne casse PAS la page — le plan résumé textuel
 * (D-09, SignalDetail) reste lisible. Le canvas reste LTR même en dir=rtl ; les
 * valeurs numériques hors-canvas sont encadrées <bdi> par les composants appelants.
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  createChart,
  CandlestickSeries,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'

/** Une bougie OHLCV lue depuis `candles` (sous-ensemble réel de 0003). */
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
  /** instruments.precision — décimales prix par actif. */
  precision: number
}

// Couleurs sémantiques trading (UI-SPEC §Color) — alignées sur SignalCard.
const UP_COLOR = '#15803D'
const DOWN_COLOR = '#B91C1C'
const ENTRY_COLOR = '#1E5FBF' // brand-blue (neutre)
const SL_COLOR = '#B91C1C'
const TP_COLOR = '#15803D'

/** Convertit un ISO timestamp en UTCTimestamp (secondes) pour lightweight-charts. */
function toUtcSeconds(iso: string): UTCTimestamp {
  return Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp
}

export function CandleChart({
  candles,
  entry,
  stopLoss,
  takeProfits,
  precision,
}: CandleChartProps) {
  const t = useTranslations('signalDetail')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let chart: IChartApi | null = null
    let observer: ResizeObserver | null = null

    try {
      const digits = Number.isFinite(precision) && precision >= 0 ? Math.trunc(precision) : 2

      chart = createChart(el, {
        autoSize: true,
        // Lecture seule (D-12) : aucune interaction de navigation.
        handleScroll: false,
        handleScale: false,
        crosshair: { mode: CrosshairMode.Normal },
        layout: { background: { color: 'transparent' }, textColor: 'currentColor' },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, timeVisible: true },
        localization: {
          priceFormatter: (price: number) => price.toFixed(digits),
        },
      })

      // API v5 unifiée : addSeries(CandlestickSeries, …) — pas l'ancien helper v4.
      const series: ISeriesApi<'Candlestick'> = chart.addSeries(CandlestickSeries, {
        upColor: UP_COLOR,
        downColor: DOWN_COLOR,
        borderUpColor: UP_COLOR,
        borderDownColor: DOWN_COLOR,
        wickUpColor: UP_COLOR,
        wickDownColor: DOWN_COLOR,
        priceFormat: { type: 'price', precision: digits, minMove: 1 / 10 ** digits },
      })

      series.setData(
        candles.map((c) => ({
          time: toUtcSeconds(c.ts),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      )

      // Lignes de plan légendées (D-12) : entrée neutre dashed, SL rouge, TP vert.
      series.createPriceLine({
        price: entry,
        color: ENTRY_COLOR,
        lineStyle: LineStyle.Dashed,
        lineWidth: 2,
        axisLabelVisible: true,
        title: t('lineEntry'),
      })
      series.createPriceLine({
        price: stopLoss,
        color: SL_COLOR,
        lineStyle: LineStyle.Solid,
        lineWidth: 2,
        axisLabelVisible: true,
        title: t('lineSL'),
      })
      takeProfits.forEach((tp, i) => {
        series.createPriceLine({
          price: tp,
          color: TP_COLOR,
          lineStyle: LineStyle.Solid,
          lineWidth: 1,
          axisLabelVisible: true,
          title: `${t('lineTp')}${i + 1}`,
        })
      })

      chart.timeScale().fitContent()

      // Repli responsive si autoSize indisponible (anciens navigateurs).
      observer = new ResizeObserver(() => {
        chart?.timeScale().fitContent()
      })
      observer.observe(el)
    } catch {
      // Render-fail toléré : le plan résumé textuel (D-09) reste lisible.
      setFailed(true)
    }

    return () => {
      observer?.disconnect()
      chart?.remove()
    }
  }, [candles, entry, stopLoss, takeProfits, precision, t])

  if (failed) {
    return (
      <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground" role="status">
        {t('chartUnavailable')}
      </p>
    )
  }

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className="h-[360px] w-full overflow-hidden rounded-xl ring-1 ring-foreground/10 md:h-[420px]"
      aria-hidden="true"
    />
  )
}

export default CandleChart
