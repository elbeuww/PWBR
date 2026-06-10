/**
 * Conventions de sessions de marché — packages/core (D-09)
 *
 * Daily natif par source :
 * - OANDA (forex/métaux/énergie) : aligné sur la clôture FX réelle = 17:00 NY
 * - Binance (crypto 24/7) : aligné sur minuit UTC = 00:00 UTC
 *
 * Source: moment.github.io/luxon (zones/DST, setZone, startOf)
 */
import { DateTime } from 'luxon'

/**
 * Ancre daily par source de données (D-09).
 * Définit le fuseau et l'heure à laquelle un nouveau "daily" commence
 * pour chaque broker/exchange.
 */
export const DAILY_ANCHOR = {
  /** OANDA : convention FX réelle — 17:00 New York (gère DST automatiquement via luxon) */
  oanda: { zone: 'America/New_York', hour: 17 },
  /** Binance : crypto 24/7 — minuit UTC */
  binance: { zone: 'UTC', hour: 0 },
} as const

export type DataSource = keyof typeof DAILY_ANCHOR

/**
 * Retourne le timestamp de début de la dernière journée daily CLÔTURÉE
 * selon la convention de la source de données.
 *
 * "Clôturée" signifie : le daily en cours (dont l'ouverture est ≤ now)
 * n'est PAS inclus — on retourne le daily précédent.
 *
 * Gestion DST : luxon applique automatiquement le décalage DST pour
 * America/New_York (EDT UTC-4 en été, EST UTC-5 en hiver).
 *
 * Invariant : résultat < now (anti look-ahead D-10)
 *
 * @param source  Source de données ('oanda' | 'binance')
 * @param now     Instant de référence (tout fuseau)
 * @returns DateTime (dans le fuseau de la source) du début du dernier daily clôturé
 */
export function dailyAnchorStart(source: DataSource, now: DateTime): DateTime {
  const anchor = DAILY_ANCHOR[source]
  // Convertir `now` dans le fuseau de la source
  const nowInZone = now.setZone(anchor.zone)

  // Construire l'ouverture du daily EN COURS :
  // c'est le dernier jour où l'heure anchor a eu lieu ET est ≤ now
  let currentDailyOpen = nowInZone.startOf('day').set({ hour: anchor.hour })

  // Si l'heure anchor du jour courant est encore dans le futur par rapport à now,
  // le daily en cours a commencé hier à l'heure anchor
  if (currentDailyOpen > nowInZone) {
    currentDailyOpen = currentDailyOpen.minus({ days: 1 })
  }

  // La dernière journée CLÔTURÉE est le daily précédent
  const lastClosedDaily = currentDailyOpen.minus({ days: 1 })

  return lastClosedDaily
}
