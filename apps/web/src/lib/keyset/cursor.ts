/**
 * cursor.ts — curseur de pagination keyset, opaque et tolérant (Plan 19-03, Task 1 ; UDASH-02).
 *
 * La pagination keyset (D-05) encode le tuple de tri `(created_at desc, id desc)`
 * en un jeton base64url opaque transporté dans l'URL. L'index
 * `user_followed_setups_keyset_idx (user_id, created_at desc, id desc)` (0020)
 * couvre exactement ce tri → Index Scan, pas OFFSET (barrière de scalabilité).
 *
 * Sécurité (threat T-19-10) : le curseur est OPAQUE, PAS un secret. Même falsifié,
 * la RLS `user_id = (select auth.uid())` scope toujours à l'utilisateur courant —
 * un curseur trafiqué ne produit qu'un offset incohérent (dégradation gracieuse),
 * jamais une élévation. Le décodage est TOLÉRANT (miroir de la philosophie de
 * `lib/signals/searchParams.ts`) : une valeur corrompue → null (première page),
 * sans jamais lever d'exception qui casserait le rendu de la page.
 */

/** Tuple de tri keyset : la position du dernier élément de la page courante. */
export interface Cursor {
  createdAt: string
  id: string
}

/**
 * Encode un curseur en chaîne base64url opaque. Le tuple est sérialisé en tableau
 * positionnel `[createdAt, id]` (compact, ordre stable) puis encodé base64url
 * (URL-safe : pas de `+`, `/`, `=`).
 */
export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify([c.createdAt, c.id])).toString('base64url')
}

/**
 * Décode un curseur opaque. Retourne `null` (première page) si le jeton est
 * absent, vide, corrompu, ou décode une valeur qui n'est pas un tuple
 * `[string, string]`. Ne lève JAMAIS : une URL trafiquée dégrade vers la
 * première page au lieu de casser le rendu.
 */
export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString())
    if (!Array.isArray(parsed) || parsed.length < 2) return null
    const [createdAt, id] = parsed
    if (typeof createdAt !== 'string' || typeof id !== 'string') return null
    return { createdAt, id }
  } catch {
    return null
  }
}
