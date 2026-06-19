/**
 * frontmatter.ts — schéma Zod de la frontière de données du frontmatter MDX (D-11).
 *
 * Sécurité (threat T-09-02) : tout en-tête YAML d'un fichier MDX est une donnée
 * non fiable typée. `FrontmatterSchema.parse` est appliqué à la frontière au render
 * RSC ; un frontmatter invalide → erreur Zod (jamais rendu silencieusement).
 *
 * SOURCE UNIQUE des enums d'axes (theme/niveau/plateforme) : `searchParams.ts` les
 * importe d'ici, jamais de redéclaration (cohérence filtres ↔ contenu).
 *
 * Style Zod v4 : `z.iso.datetime()` pour la date ISO, fallback `z.string()`.
 */
import { z } from 'zod'

export const ThemeEnum = z.enum([
  'usage-plateforme',
  'bases-trading',
  'gestion-risque',
  'analyse-technique',
  'comprendre-signaux',
])

export const NiveauEnum = z.enum(['debutant', 'intermediaire'])

export const PlateformeEnum = z.enum(['mt4', 'mt5', 'autre'])

export const FrontmatterSchema = z.object({
  type: z.enum(['article', 'cours', 'lecon']),
  titre: z.string().min(1),
  resume: z.string().min(1),
  theme: ThemeEnum,
  niveau: NiveauEnum,
  plateforme: PlateformeEnum.optional(),
  date: z.iso.datetime().or(z.string()), // date de publication (ISO ou string)
  cover: z.string().min(1), // image de couverture
  // leçon : référence du cours + ordre
  course: z.string().optional(),
  order: z.number().int().positive().optional(),
})

export type Frontmatter = z.infer<typeof FrontmatterSchema>
