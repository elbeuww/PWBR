import path from 'node:path'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// Racine du monorepo : un package-lock.json parasite dans le HOME fait
// inférer un mauvais root à Next (casse la résolution des packages workspace).
const monorepoRoot = path.join(__dirname, '..', '..')

// Les packages workspace (@app/*) sont en `moduleResolution: NodeNext` et utilisent
// des imports d'extension `.js` (réécriture ESM TypeScript : `./time/constants.js`
// pointe en réalité vers `constants.ts`). On garde `.js` (requis par tsc + jobs tsx).
// Ni webpack (next build) ni Turbopack (next dev) ne résolvent `.js → .ts` par défaut
// pour ces sous-imports relatifs internes au package → on câble l'alias sur LES DEUX
// bundlers (le bloc webpack seul laissait `next dev --turbopack` casser : AFF/TRACK
// « Module not found: Can't resolve './*.js' »).
const extensionAlias = {
  '.js': ['.ts', '.tsx', '.js'],
  '.mjs': ['.mts', '.mjs'],
  '.cjs': ['.cts', '.cjs'],
}

const nextConfig: NextConfig = {
  // Nécessaire pour que Next.js transpile les packages workspace locaux
  // Source : 01-RESEARCH.md §Recommended Project Structure
  transpilePackages: ['@app/core', '@app/supabase', '@app/data-sources'],
  // Le lint est exécuté séparément en CI/local via `pnpm lint` (`eslint .` racine),
  // qui applique la règle de sécurité AUTH-03 (no-restricted-imports service-client)
  // ET voit échouer la fixture intentionnelle `__lint_fixtures__/forbidden-service-import.ts`
  // (le test de la garde D-07 reste intact). On ne re-linte PAS pendant `next build` :
  // sinon cette fixture — conçue pour faire échouer le lint — casse le build de prod
  // Vercel. La garde de sécurité n'est PAS affaiblie (toujours active sous `pnpm lint`).
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  // L'alias `.js → .ts` est câblé côté webpack uniquement. Turbopack (Next 15.5)
  // n'expose PAS d'`extensionAlias` (clé rejetée : « Unrecognized key ... at turbopack »)
  // et ne réécrit pas `.js → .ts` pour les sous-imports internes d'un package workspace
  // résolu via son `exports` map. Le dev tourne donc sur webpack (`next dev`, sans
  // `--turbopack`) → même résolveur que `next build`, zéro divergence dev/prod.
  webpack: (config) => {
    config.resolve = config.resolve ?? {}
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ...extensionAlias,
    }
    return config
  },
}

// Branche next-intl sur la config de requête i18n (routing + chargement messages).
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

export default withNextIntl(nextConfig)
