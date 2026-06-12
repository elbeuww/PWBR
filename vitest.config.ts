import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      // server-only lève une erreur dans Next.js mais doit être un no-op dans Vitest
      // (les tests jobs s'exécutent dans Node, pas dans un bundle Next)
      'server-only': path.resolve(__dirname, '__mocks__/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/__tests__/**/*.test.ts'],
    globals: false,
  },
})
