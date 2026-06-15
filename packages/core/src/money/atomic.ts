/**
 * Conversion monétaire atomique — BigInt zéro-float (USDT TRC-20, 6 décimales).
 *
 * T-04-PREC / Pitfall 4 : un montant comme 9.02 N'EST PAS représentable
 * exactement en IEEE-754. On ne touche JAMAIS à Number()/parseFloat()/`* 1e6`.
 * Le parsing se fait par regex stricte + arithmétique BigInt pure, et toute
 * comparaison ultérieure doit être exacte (`===`), jamais avec un epsilon.
 *
 * Aucun analog dans le repo (RESEARCH §No Analog) — module net-new.
 */

/** Nombre de décimales d'un montant USDT TRC-20. */
export const USDT_DECIMALS = 6n

/** Facteur d'échelle : 10^USDT_DECIMALS (1 USDT = 1_000_000 unités atomiques). */
export const SCALE = 10n ** USDT_DECIMALS

/**
 * Regex stricte : un entier obligatoire, optionnellement suivi d'un point et de
 * 1 à 6 chiffres. Refuse : signe, espaces, "9.", ".5", >6 décimales, vide.
 */
const DECIMAL_RE = /^(\d+)(?:\.(\d{1,6}))?$/

/**
 * Convertit un montant décimal (string) en unités atomiques BigInt.
 *
 * @param decimal - Montant ex. "9.02", "9", "0.000001". Max 6 décimales.
 * @returns Montant atomique (ex. "9.02" -> 9020000n).
 * @throws Si la chaîne ne correspond pas à la regex stricte (incl. >6 décimales).
 */
export function toAtomic(decimal: string): bigint {
  const match = DECIMAL_RE.exec(decimal)
  if (!match) {
    throw new Error(`toAtomic: format de montant invalide "${decimal}"`)
  }

  const integerPart = match[1] ?? '0'
  const fractionRaw = match[2] ?? ''
  // Pad à droite jusqu'à USDT_DECIMALS chiffres (ex. "02" -> "020000").
  const fractionPadded = fractionRaw.padEnd(Number(USDT_DECIMALS), '0')

  return BigInt(integerPart) * SCALE + BigInt(fractionPadded)
}

/**
 * Formate un montant atomique BigInt en décimal string à 6 décimales fixes.
 *
 * @param atomic - Montant atomique (ex. 9020000n).
 * @returns Décimal string canonique (ex. 9020000n -> "9.020000").
 */
export function formatAtomic(atomic: bigint): string {
  const integerPart = atomic / SCALE
  const fractionPart = atomic % SCALE
  const fractionStr = fractionPart.toString().padStart(Number(USDT_DECIMALS), '0')
  return `${integerPart.toString()}.${fractionStr}`
}
