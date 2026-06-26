/**
 * searchParams.ts — parsing/sérialisation Zod des filtres de la table utilisateurs
 * superadmin, persistés dans l'URL (Plan 20-01, Task 1 ; ADASH-02/04).
 *
 * Sécurité (threat T-20-02) : chaque filtre traduit en `.eq/.in` côté requête
 * Supabase est validé par une whitelist `z.enum`. `parseAdminUsersParams` utilise
 * `.safeParse` CHAMP PAR CHAMP et IGNORE toute valeur hors enum (jamais de throw,
 * jamais d'injection de string brute dans une requête). `q` (recherche email/id)
 * et `cursor` (jeton keyset opaque) restent des valeurs paramétrées, jamais
 * concaténées : `cursor` est revalidé/décodé plus tard par `sanitizeCursor` côté
 * requête (un curseur corrompu → première page, jamais throw, jamais injection).
 *
 * Calque exact : apps/web/src/lib/signals/searchParams.ts (`WatchlistParamsSchema`).
 * Aucune dépendance nouvelle (zod déjà au lock-file).
 */
import { z } from 'zod'

const StatusEnum = z.enum(['active', 'expired', 'none']) // état d'abonnement (miroir subscriptions.status agrégé)
const SourceEnum = z.enum(['demo', 'backtest', 'live']) // colonne `source` (migration 0018)

export const AdminUsersParamsSchema = z.object({
  status: StatusEnum.optional(),
  source: SourceEnum.optional(),
  q: z.string().min(1).optional(), // recherche email / id
  cursor: z.string().min(1).optional(), // jeton keyset opaque (sanitizeCursor côté requête)
})

export type AdminUsersParams = z.infer<typeof AdminUsersParamsSchema>

type RawParams = Record<string, string | string[] | undefined>

/** Normalise une valeur de searchParams (Next 15 peut donner string[]) en string. */
function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

/**
 * Parse des searchParams bruts en filtres validés. Champ par champ via `.safeParse` :
 * une valeur hors whitelist est ignorée (undefined) au lieu de faire échouer tout le
 * parse — un filtre corrompu ne doit jamais bloquer l'affichage ni atteindre la requête.
 */
export function parseAdminUsersParams(raw: RawParams): AdminUsersParams {
  const pick = <T extends z.ZodTypeAny>(schema: T, value: string | string[] | undefined) => {
    const r = schema.safeParse(firstString(value))
    return r.success ? r.data : undefined
  }

  return {
    status: pick(StatusEnum, raw.status),
    source: pick(SourceEnum, raw.source),
    q: pick(z.string().min(1), raw.q),
    cursor: pick(z.string().min(1), raw.cursor),
  }
}

/**
 * Sérialise des filtres en URLSearchParams. Omet les filtres absents → URL propre,
 * round-trip stable avec parseAdminUsersParams.
 */
export function serializeAdminUsersParams(params: AdminUsersParams): URLSearchParams {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.source) qs.set('source', params.source)
  if (params.q) qs.set('q', params.q)
  if (params.cursor) qs.set('cursor', params.cursor)
  return qs
}
