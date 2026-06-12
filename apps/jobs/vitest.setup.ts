/**
 * Setup Vitest pour apps/jobs :
 * Charge apps/jobs/.env avant l'import des modules (notamment service-client.ts).
 *
 * Vitest charge ce fichier avant le test suite via setupFiles dans vitest.config.ts.
 */
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

config({ path: path.resolve(__dirname, 'apps/jobs/.env') })
