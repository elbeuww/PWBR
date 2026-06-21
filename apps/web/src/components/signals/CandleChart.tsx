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

/**
 * Couleurs résolues depuis les tokens NEXA (couche component, flip-safe, 11-01).
 * lightweight-charts ne lit PAS les CSS vars (canvas) → on résout les tokens via
 * getComputedStyle au montage ET à chaque flip de thème (Pitfall 5). UP/TP =
 * --signal-bullish, DOWN/SL = --signal-bearish, entrée = --foreground (neutre).
 */
interface ChartColors {
  up: string
  down: string
  entry: string
}

function readChartColors(el: HTMLElement): ChartColors {
  const cs = getComputedStyle(el)
  const read = (name: string): string => cs.getPropertyValue(name).trim()
  return {
    up: read('--signal-bullish'),
    down: read('--signal-bearish'),
    entry: read('--foreground'),
  }
}

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
    let themeObserver: MutationObserver | null = null

    try {
      const digits = Number.isFinite(precision) && precision >= 0 ? Math.trunc(precision) : 2

      // Résolution initiale des couleurs depuis les tokens NEXA (flip-safe).
      let colors = readChartColors(el)

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
        upColor: colors.up,
        downColor: colors.down,
        borderUpColor: colors.up,
        borderDownColor: colors.down,
        wickUpColor: colors.up,
        wickDownColor: colors.down,
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

      // Lignes de plan légendées (D-12) : entrée neutre dashed, SL bearish, TP bullish.
      // Refs conservées pour re-colorer au flip de thème (applyOptions, Pitfall 5).
      const entryLine = series.createPriceLine({
        price: entry,
        color: colors.entry,
        lineStyle: LineStyle.Dashed,
        lineWidth: 2,
        axisLabelVisible: true,
        title: t('lineEntry'),
      })
      const slLine = series.createPriceLine({
        price: stopLoss,
        color: colors.down,
        lineStyle: LineStyle.Solid,
        lineWidth: 2,
        axisLabelVisible: true,
        title: t('lineSL'),
      })
      const tpLines = takeProfits.map((tp, i) =>
        series.createPriceLine({
          price: tp,
          color: colors.up,
          lineStyle: LineStyle.Solid,
          lineWidth: 1,
          axisLabelVisible: true,
          title: `${t('lineTp')}${i + 1}`,
        }),
      )

      chart.timeScale().fitContent()

      // Re-coloration au flip de thème (Pitfall 5) : lightweight-charts ne réagit
      // pas aux CSS vars → on observe le toggle .dark sur <html>, relit les tokens
      // résolus et applique les nouvelles couleurs aux séries et price lines.
      const recolor = (): void => {
        colors = readChartColors(el)
        series.applyOptions({
          upColor: colors.up,
          downColor: colors.down,
          borderUpColor: colors.up,
          borderDownColor: colors.down,
          wickUpColor: colors.up,
          wickDownColor: colors.down,
        })
        entryLine.applyOptions({ color: colors.entry })
        slLine.applyOptions({ color: colors.down })
        tpLines.forEach((line) => line.applyOptions({ color: colors.up }))
      }
      themeObserver = new MutationObserver(recolor)
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      })

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
      themeObserver?.disconnect()
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
