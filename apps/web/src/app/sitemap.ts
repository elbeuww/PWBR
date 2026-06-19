/**
 * sitemap.ts — sitemap trilingue de l'Académie + hreflang (Q3, RESEARCH §Sitemap).
 *
 * `listAllContent()` (Plan 02) énumère chaque slug avec les locales RÉELLEMENT présentes
 * (jamais les fallbacks). `alternates.languages` n'annonce donc QUE les locales réelles :
 * le fallback FR servi sous /ar n'est PAS déclaré `hreflang="ar"` (threat T-09-SEO — sinon
 * Google indexerait du FR comme arabe).
 *
 * Base URL via `process.env` (placeholder documenté A4 : la valeur réelle vient de la
 * config Vercel — NEXT_PUBLIC_SITE_URL). Défaut localhost en l'absence d'env (dev).
 */
import type { MetadataRoute } from 'next'
import { listAllContent } from '@/lib/academie/content'
import { routing } from '@/i18n/routing'

/** Domaine canonique du site (config Vercel). Placeholder A4 : surchargé par l'env. */
const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const items = await listAllContent()

  const entries: MetadataRoute.Sitemap = []

  // Index de l'Académie pour chaque locale (toutes réelles).
  for (const locale of routing.locales) {
    entries.push({
      url: `${BASE_URL}/${locale}/academie`,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${BASE_URL}/${l}/academie`]),
        ),
      },
    })
  }

  // Une entrée par contenu, dans la locale FR canonique, avec hreflang des locales réelles.
  for (const item of items) {
    // hreflang : SEULEMENT les locales réellement présentes (pas les fallbacks — Q3).
    const languages = Object.fromEntries(
      item.locales.map((l) => [l, `${BASE_URL}/${l}/academie/${item.slug}`]),
    )
    // URL canonique : FR si présent, sinon la première locale réelle.
    const canonicalLocale = item.locales.includes('fr') ? 'fr' : item.locales[0]
    if (!canonicalLocale) continue

    entries.push({
      url: `${BASE_URL}/${canonicalLocale}/academie/${item.slug}`,
      alternates: { languages },
    })
  }

  return entries
}
