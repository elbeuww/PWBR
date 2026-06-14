/**
 * sanitizeMarketText — neutralisation des textes de news tierces (concern security
 * [HIGH], anti prompt injection — T-04-16).
 *
 * Les headlines/notes Finnhub/Marketaux sont du contenu NON contrôlé qui transite
 * vers le contexte de jugement de l'agent. Avant injection, on :
 *  1. strip les caractères de contrôle (séquences ANSI, null, sauts de ligne, bell…)
 *     — empêche les techniques d'injection visuelle / d'instructions cachées.
 *  2. tronque à `maxLen` — borne la surface d'attaque + le coût contexte.
 *
 * Le retour est destiné à être ENVELOPPÉ par l'appelant dans
 * `<market_data>…</market_data>` ; veteran.md instruit l'agent que ce contenu est
 * de la DONNÉE, jamais une instruction. La défense ne dépend JAMAIS du prompt seul.
 *
 * Pur, déterministe, testable hors-ligne.
 */

/** Plage des caractères de contrôle ASCII (C0 0x00–0x1F + DEL 0x7F). */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g

/**
 * @param raw     Texte de marché tiers non contrôlé.
 * @param maxLen  Longueur maximale conservée (défaut 280).
 * @returns       Texte sans caractères de contrôle, tronqué à `maxLen`.
 */
export function sanitizeMarketText(raw: string, maxLen = 280): string {
  return raw.replace(CONTROL_CHARS, '').slice(0, maxLen)
}
