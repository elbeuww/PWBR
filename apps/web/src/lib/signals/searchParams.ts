/**
 * searchParams.ts — parsing/sérialisation Zod des filtres + tri de la surface
 * signaux, persistés dans l'URL (Plan 03-01, Task 3 ; MEMB-01/02).
 *
 * Sécurité (threat T-03-05) : chaque filtre traduit en `.eq/.in` côté requête
 * Supabase est validé par une whitelist `z.enum`. `parseSignalsParams` utilise
 * `.safeParse` champ par champ et IGNORE toute valeur hors enum (jamais de throw,
 * jamais d'injection de string brute dans une requête). `asset` est une string
 * libre mais reste une valeur paramétrée (`.eq`), jamais concaténée.
 *
 * Style Zod v4 : analog `packages/core/src/schemas/output.ts` (z.enum, z.infer).
 * D-08 : tri par défaut = score décroissant.
 */
import { z } from 'zod'

const StyleEnum = z.enum(['day', 'swing']) // miroir trade_setups.style (0006)
const RiskEnum = z.enum(['low', 'medium', 'high', 'extreme']) // miroir trade_setups.risk_level (0006)
const ClassEnum = z.enum(['crypto', 'forex', 'metal', 'energy']) // miroir instruments.asset_class (0001)
const SortEnum = z.enum(['score', 'recent', 'rr']) // D-08 (défaut appliqué ci-dessous)

export const SignalsParamsSchema = z.object({
  style: StyleEnum.optional(),
  risk: RiskEnum.optional(),
  class: ClassEnum.optional(),
  asset: z.string().min(1).optional(),
  sort: SortEnum.default('score'),
})

export type SignalsParams = z.infer<typeof SignalsParamsSchema>

type RawParams = Record<string, string | string[] | undefined>

/** Normalise une valeur de searchParams (Next 15 peut donner string[]) en string. */
function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

/**
 * Parse des searchParams bruts en filtres validés. Champ par champ : une valeur
 * hors whitelist est ignorée (undefined) au lieu de faire échouer tout le parse —
 * un filtre corrompu ne doit jamais bloquer l'affichage ni atteindre la requête.
 */
export function parseSignalsParams(raw: RawParams): SignalsParams {
  const pick = <T extends z.ZodTypeAny>(schema: T, value: string | string[] | undefined) => {
    const r = schema.safeParse(firstString(value))
    return r.success ? r.data : undefined
  }

  const sortResult = SortEnum.safeParse(firstString(raw.sort))

  return {
    style: pick(StyleEnum, raw.style),
    risk: pick(RiskEnum, raw.risk),
    class: pick(ClassEnum, raw.class),
    asset: pick(z.string().min(1), raw.asset),
    sort: sortResult.success ? sortResult.data : 'score',
  }
}

/**
 * Sérialise des filtres en URLSearchParams. Omet le tri par défaut (score) et les
 * filtres absents → URL propre, round-trip stable avec parseSignalsParams.
 */
export function serializeSignalsParams(params: SignalsParams): URLSearchParams {
  const qs = new URLSearchParams()
  if (params.style) qs.set('style', params.style)
  if (params.risk) qs.set('risk', params.risk)
  if (params.class) qs.set('class', params.class)
  if (params.asset) qs.set('asset', params.asset)
  if (params.sort && params.sort !== 'score') qs.set('sort', params.sort)
  return qs
}

// ──────────────────────────────────────────────────────────────────────────
// Surface watchlist (Plan 19-03, Task 2 ; UDASH-02) — schéma frère.
//
// La watchlist (suivis/historique) ne partage AUCUN filtre avec les signaux ;
// on isole donc son schéma plutôt que de polluer SignalsParamsSchema. Deux
// params seulement :
//   - `tab`    : onglet whitelisté (suivis | historique), défaut suivis. Comme
//                `style`/`risk`, une valeur hors enum n'atteint JAMAIS la requête
//                (anti-injection T-19-09) — elle retombe sur le défaut.
//   - `cursor` : jeton keyset OPAQUE (cf. lib/keyset/cursor.ts). Validé non-vide
//                seulement : le décodage réel (base64url → tuple) se fait via
//                `decodeCursor`, et le tuple est passé à `.or()` PARAMÉTRÉ
//                PostgREST, jamais concaténé en SQL. Un curseur corrompu → null
//                (première page) côté decodeCursor, jamais throw, jamais injection.
//
// Décision (Claude's Discretion tranchée, RESEARCH) : réutiliser le pattern
// maison safeParse champ par champ — NE PAS ajouter `nuqs`.
// ──────────────────────────────────────────────────────────────────────────

const TabEnum = z.enum(['suivis', 'historique']) // onglet watchlist (défaut appliqué ci-dessous)

export const WatchlistParamsSchema = z.object({
  tab: TabEnum.default('suivis'),
  cursor: z.string().min(1).optional(),
})

export type WatchlistParams = z.infer<typeof WatchlistParamsSchema>

/**
 * Parse des searchParams bruts en params watchlist. Champ par champ via
 * `.safeParse` : un `tab` hors whitelist retombe sur `suivis`, un `cursor`
 * vide/absent → undefined. Jamais de throw, jamais de valeur brute propagée.
 */
export function parseWatchlistParams(raw: RawParams): WatchlistParams {
  const tabResult = TabEnum.safeParse(firstString(raw.tab))
  const cursorResult = z.string().min(1).safeParse(firstString(raw.cursor))

  return {
    tab: tabResult.success ? tabResult.data : 'suivis',
    cursor: cursorResult.success ? cursorResult.data : undefined,
  }
}

/**
 * Sérialise des params watchlist en URLSearchParams. Omet l'onglet par défaut
 * (suivis) et le curseur absent → URL propre, round-trip stable.
 */
export function serializeWatchlistParams(params: WatchlistParams): URLSearchParams {
  const qs = new URLSearchParams()
  if (params.tab && params.tab !== 'suivis') qs.set('tab', params.tab)
  if (params.cursor) qs.set('cursor', params.cursor)
  return qs
}
