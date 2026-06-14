import path from 'node:path'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// Racine du monorepo : un package-lock.json parasite dans le HOME fait
// inférer un mauvais root à Next (casse la résolution des packages workspace).
const monorepoRoot = path.join(__dirname, '..', '..')

const nextConfig: NextConfig = {
  // Nécessaire pour que Next.js transpile les packages workspace locaux
  // Source : 01-RESEARCH.md §Recommended Project Structure
  transpilePackages: ['@app/core', '@app/supabase'],
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
}

// Branche next-intl sur la config de requête i18n (routing + chargement messages).
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

export default withNextIntl(nextConfig)
