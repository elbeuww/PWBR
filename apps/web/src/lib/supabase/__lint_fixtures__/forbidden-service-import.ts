/**
 * FIXTURE LINT (AUTH-03) — ce fichier DOIT faire échouer `pnpm lint`.
 *
 * Il prouve que la barrière ESLint `no-restricted-imports` (plan 01, D-07)
 * bloque tout import du client service_role depuis apps/web (T-01).
 * Ne JAMAIS corriger cette erreur lint : c'est le test.
 */

// eslint doit signaler cette ligne (groupe interdit '@app/supabase/service-client')
import { serviceClient } from '@app/supabase/service-client'

export const fixture = serviceClient
