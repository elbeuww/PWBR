/**
 * searchParams.ts — parsing/sérialisation Zod des filtres multi-axes de l'Académie,
 * persistés dans l'URL (D-05). Calque sur `signals/searchParams.ts`.
 *
 * Sécurité (threat T-09-01) : chaque axe est validé par une whitelist `z.enum`
 * importée de `frontmatter.ts` (source unique). `parseAcademyParams` filtre les
 * valeurs hors-enum (jamais propagées, jamais de throw, jamais de string brute).
 * Multi-select par axe : `theme=a&theme=b` collecté en `string[]`, les membres
 * invalides du tableau sont retirés.
 */
import { z } from 'zod'
import { ThemeEnum, NiveauEnum, PlateformeEnum } from './frontmatter'

export const AcademyParamsSchema = z.object({
  theme: z.array(ThemeEnum).default([]),
  niveau: z.array(NiveauEnum).default([]),
  plateforme: z.array(PlateformeEnum).default([]),
})

export type AcademyParams = z.infer<typeof AcademyParamsSchema>

type RawParams = Record<string, string | string[] | undefined>

/** Normalise une valeur de searchParams (string | string[]) en tableau de strings. */
function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * Collecte les membres valides d'un axe : chaque candidat est validé via
 * `.safeParse` contre l'enum ; les valeurs hors whitelist sont écartées (jamais
 * propagées vers une requête ni vers l'UI). Ne throw jamais.
 */
function pickEnumArray<T extends z.ZodTypeAny>(
  enumSchema: T,
  value: string | string[] | undefined,
): z.infer<T>[] {
  const out: z.infer<T>[] = []
  for (const candidate of toArray(value)) {
    const r = enumSchema.safeParse(candidate)
    if (r.success) out.push(r.data)
  }
  return out
}

/**
 * Parse des searchParams bruts en filtres validés. Axe par axe : toute valeur hors
 * whitelist est ignorée. Un filtre corrompu ne bloque jamais l'affichage ni
 * n'atteint la requête.
 */
export function parseAcademyParams(raw: RawParams): AcademyParams {
  return {
    theme: pickEnumArray(ThemeEnum, raw.theme),
    niveau: pickEnumArray(NiveauEnum, raw.niveau),
    plateforme: pickEnumArray(PlateformeEnum, raw.plateforme),
  }
}

/**
 * Sérialise des filtres en URLSearchParams. Omet les axes vides → URL propre,
 * round-trip stable avec parseAcademyParams (multi-valeur via append).
 */
export function serializeAcademyParams(params: AcademyParams): URLSearchParams {
  const qs = new URLSearchParams()
  for (const v of params.theme) qs.append('theme', v)
  for (const v of params.niveau) qs.append('niveau', v)
  for (const v of params.plateforme) qs.append('plateforme', v)
  return qs
}
