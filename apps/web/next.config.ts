import path from 'node:path'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// Racine du monorepo : un package-lock.json parasite dans le HOME fait
// inférer un mauvais root à Next (casse la résolution des packages workspace).
const monorepoRoot = path.join(__dirname, '..', '..')

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
  // Les packages workspace (@app/*) exportent du TS SOURCE et utilisent des
  // imports d'extension `.js` (réécriture ESM TypeScript : `./time/constants.js`
  // pointe en réalité vers `constants.ts`). Le build webpack (next build) ne
  // résout PAS `.js → .ts` par défaut, contrairement à `tsc`/turbopack-dev →
  // « Module not found: Can't resolve './*.js' ». On câble l'extensionAlias
  // webpack pour que ces specifiers `.js` retombent sur les sources `.ts/.tsx`.
  webpack: (config) => {
    config.resolve = config.resolve ?? {}
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    }
    return config
  },
}

// Branche next-intl sur la config de requête i18n (routing + chargement messages).
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

export default withNextIntl(nextConfig)
