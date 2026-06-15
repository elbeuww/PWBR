/**
 * format.ts — formatage pur prix + âge relatif pour la surface signaux
 * (Plan 03-01, Task 3).
 *
 * Fonctions PURES (aucun JSX, aucun accès DOM). L'encadrement `<bdi>` (anti-
 * inversion RTL) est fait par les composants appelants, PAS ici (D-context UI-SPEC).
 *
 * - formatPrice : décimales = instruments.precision (int réel de la table 0001),
 *   via Intl.NumberFormat (figures groupées + min/max fraction = precision).
 * - formatRelativeAge : âge relatif vulgarisé (« il y a 2 h ») via
 *   Intl.RelativeTimeFormat, locale-aware.
 */

const RELATIVE_UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: 'year', seconds: 60 * 60 * 24 * 365 },
  { unit: 'month', seconds: 60 * 60 * 24 * 30 },
  { unit: 'day', seconds: 60 * 60 * 24 },
  { unit: 'hour', seconds: 60 * 60 },
  { unit: 'minute', seconds: 60 },
  { unit: 'second', seconds: 1 },
]

/**
 * Formate un prix avec un nombre fixe de décimales (= instruments.precision).
 * Utilise Intl.NumberFormat → respecte la locale (séparateurs) sans concaténation.
 */
export function formatPrice(value: number, precision: number, locale?: string): string {
  const digits = Number.isFinite(precision) && precision >= 0 ? Math.trunc(precision) : 2
  return new Intl.NumberFormat(locale ?? 'en', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/**
 * Formate l'âge d'une date en chaîne relative (« il y a 2 h », « 3 days ago »).
 * Choisit l'unité la plus grande dont la magnitude >= 1.
 */
export function formatRelativeAge(date: Date | string, locale?: string): string {
  const then = date instanceof Date ? date : new Date(date)
  const diffSeconds = (then.getTime() - Date.now()) / 1000 // négatif = passé
  const rtf = new Intl.RelativeTimeFormat(locale ?? 'en', { numeric: 'auto' })

  const abs = Math.abs(diffSeconds)
  for (const { unit, seconds } of RELATIVE_UNITS) {
    if (abs >= seconds || unit === 'second') {
      const valueInUnit = Math.round(diffSeconds / seconds)
      return rtf.format(valueInUnit, unit)
    }
  }
  return rtf.format(0, 'second')
}
