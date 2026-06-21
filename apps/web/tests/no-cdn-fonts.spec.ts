/**
 * no-cdn-fonts.spec.ts — garde runtime Wave-0 de DESIGN-02 (Phase 10).
 *
 * Behavior gardé : une fois les 5 polices NEXA self-hostées (next/font/local),
 * AUCUNE requête vers Google Fonts (fonts.googleapis.com / fonts.gstatic.com) ne
 * doit partir au runtime — la page charge ses .woff2 servis par Next, zéro CDN
 * (D-02/D-03 du 10-CONTEXT, esprit DESIGN-02).
 *
 * Méthode : on installe l'interception `page.on('request')` AVANT page.goto, on
 * collecte toutes les URLs émises pendant le chargement (jusqu'à networkidle), puis
 * on asserte qu'aucune n'a touché un host Google Fonts.
 *
 * Pré-requis GREEN (sinon ne PAS confondre échec et absence d'env) :
 *  - `pnpm --filter web dev` démarré sur http://localhost:3000 (baseURL playwright).
 *  - implémentation du plan 02 (fonts self-hostées) mergée.
 * Ce plan ne fait que CRÉER la spec (parse + --list) ; le GREEN est porté au merge
 * de la wave fonts (02), serveur dev requis.
 *
 * Source : 10-VALIDATION.md §DESIGN-02 (no-cdn-fonts) ; 10-PATTERNS.md §Wave-0 Test
 * Files ; mirror structurel de apps/web/e2e/i18n.spec.ts.
 */
import { test, expect } from '@playwright/test'

const GOOGLE_FONTS_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'] as const

test.describe('DESIGN-02 : zéro requête Google Fonts au runtime (polices self-hostées)', () => {
  test('aucune requête vers fonts.googleapis.com / fonts.gstatic.com sur /fr/login', async ({
    page,
  }) => {
    const cdnFontRequests: string[] = []

    // Interception installée AVANT navigation : on capte toute requête sortante.
    page.on('request', (request) => {
      const url = request.url()
      if (GOOGLE_FONTS_HOSTS.some((host) => url.includes(host))) {
        cdnFontRequests.push(url)
      }
    })

    // Route publique stable (pas d'auth requise).
    await page.goto('/fr/login')
    await page.waitForLoadState('networkidle')

    expect(
      cdnFontRequests,
      `Requêtes CDN Google Fonts détectées (les polices doivent être self-hostées) :\n${cdnFontRequests.join(
        '\n',
      )}`,
    ).toEqual([])
  })
})
