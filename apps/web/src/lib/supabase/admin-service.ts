import 'server-only'

/**
 * admin-service.ts — client service_role LOCAL réservé au back-office (admin).
 *
 * D-07 / D-13 : le module @app/supabase/service-client est lint-interdit côté web
 * (no-restricted-imports). On crée donc le client service_role LOCALEMENT via le SDK
 * (createClient n'est pas restreint), exactement comme apps/jobs. `server-only` plante
 * le build si jamais ce module fuit dans un bundle navigateur (double barrière).
 *
 * Usage EXCLUSIF : RSC `(admin)/**` (lecture cross-user que la RLS profiles ne permet
 * pas) et Server Actions admin ('use server') pour les mutations subscriptions/payments
 * (la RLS n'autorise AUCUN update/delete client — D-08/D-13). Jamais ailleurs.
 *
 * Déviation actée (Plan 06) : le plan prévoyait une lecture admin « anon-client + RLS
 * is_superadmin() ». Or `profiles` n'a AUCUNE policy superadmin (0008) → toute jointure
 * email échoue sous RLS anon. La lecture des membres passe donc par ce client service_role
 * côté serveur (sûr : jamais exposé au bundle).
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@app/supabase'

export function createAdminServiceClient() {
  const url = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'admin-service: SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY requis (apps/web/.env.local)',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
