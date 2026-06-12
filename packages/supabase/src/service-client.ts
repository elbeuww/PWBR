// PREMIERE LIGNE DE CODE : import 'server-only' — interdit dans le bundle web (T-01 / D-07)
// Plante le build Next.js si importé côté client Component ou pages web.
// Pattern 5 : double barrière service_role — server-only (build-time) + ESLint (lint-time).
import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Client Supabase avec la clé service_role.
 *
 * - Bypass RLS : peut lire/écrire toutes les tables sans restriction.
 * - Réservé EXCLUSIVEMENT à apps/jobs.
 * - NE JAMAIS importer depuis apps/web (gardé par ESLint no-restricted-imports + server-only).
 * - persistSession: false + autoRefreshToken: false : client long-running stateless pour les jobs.
 *
 * Source : 01-RESEARCH.md §Code Examples §Client service_role + §Pattern 5
 */
export const serviceClient = createClient<Database>(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
)
