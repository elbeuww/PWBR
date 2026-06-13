/**
 * Hash de contenu déterministe (D-41) — raw_indicators_ref.
 *
 * snapshotContentHash = sha256(canonicalJson(payload)). Canonicalisation :
 *  - clés d'objets triées récursivement (ordre indépendant)
 *  - nombres arrondis à une PRÉCISION DÉCIMALE FIXE (jamais de float brut)
 * → mêmes bougies + même code ⇒ même hash sur toutes plateformes (Pitfall 3).
 * On n'invente JAMAIS de hash maison : node:crypto sha256 builtin (T-03-07).
 */
import { createHash } from 'node:crypto'

/** Décimales conservées avant hachage (gèle le bruit flottant). */
export const HASH_DECIMALS = 6

type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

/** Sérialise une valeur en JSON canonique : clés triées + nombres à précision fixe. */
function canonicalize(value: unknown): Json {
  if (value === null) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    // arrondi à HASH_DECIMALS puis renormalisé (évite -0 et 1.230000001)
    return Number(value.toFixed(HASH_DECIMALS))
  }
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: { [k: string]: Json } = {}
    for (const key of Object.keys(obj).sort()) {
      out[key] = canonicalize(obj[key])
    }
    return out
  }
  // undefined / fonctions / symboles : exclus (non sérialisables, non déterministes)
  return null
}

/**
 * Calcule le hash de contenu sha256 d'un payload de snapshot.
 * @param payload - objet de snapshot (forme §3 ou indicateurs bruts)
 * @returns sha256 hex (64 caractères)
 */
export function snapshotContentHash(payload: unknown): string {
  const canonical = JSON.stringify(canonicalize(payload))
  return createHash('sha256').update(canonical).digest('hex')
}
