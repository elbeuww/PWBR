import { defineConfig } from 'vitest/config'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Charge .env.test (gitignoré, racine) dans process.env — URL + clé anon pour
// les tests d'intégration RLS (AUTH-02). Les workers Vitest héritent de cet env.
// process.loadEnvFile = natif Node ≥ 20.12, aucune dépendance.
const envTestPath = path.resolve(__dirname, '.env.test')
if (existsSync(envTestPath)) {
  process.loadEnvFile(envTestPath)
}

export default defineConfig({
  resolve: {
    alias: {
      // server-only lève une erreur dans Next.js mais doit être un no-op dans Vitest
      // (les tests jobs s'exécutent dans Node, pas dans un bundle Next)
      'server-only': path.resolve(__dirname, '__mocks__/server-only.ts'),
      // Alias workspace pour les tests packages/data-sources et apps/jobs
      '@app/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@app/supabase': path.resolve(__dirname, 'packages/supabase/src/index.ts'),
      '@app/data-sources': path.resolve(__dirname, 'packages/data-sources/src/index.ts'),
      '@app/indicators': path.resolve(__dirname, 'packages/indicators/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/__tests__/**/*.test.ts'],
    globals: false,
  },
})
