/**
 * Gating MRR (T-17-MV-TEST, SCALE-03 / D-02) — Plan 17-02 Task 2 (Wave-0).
 *
 * Prouve le gating au NIVEAU FONCTION : un utilisateur authentifié non-superadmin
 * appelant get_mrr() reçoit 0 ligne. Les matviews n'ont pas de RLS → la lecture
 * passe par un wrapper SECURITY DEFINER `get_mrr()` dont la garde
 * `where (select is_superadmin())` filtre SILENCIEUSEMENT (pas une erreur) les
 * non-superadmins (migration 0017, plan 17-01).
 *
 * Miroir Vitest de apps/web/tests/signals-rls.spec.ts (qui est Playwright) : même
 * invariant d'isolement (non-privilégié = 0), robuste même base vide.
 *
 * SÉCURITÉ TEST : AUCUN service_role côté front. La lecture se fait via le client
 * anon « nu » (@supabase/supabase-js) authentifié par signUp — exactement le
 * chemin du navigateur. La clé service contournerait la garde is_superadmin() et
 * invaliderait le test ; elle est strictement interdite ici.
 *
 * Pré-requis GREEN (sinon ne PAS confondre échec et absence d'env) :
 *  - .env.test rempli (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *  - migration 0017 (matview mv_mrr + wrapper get_mrr() gated) LIVE → plan 17-04
 *  - "Confirm email" désactivé (signUp ouvre une session)
 *
 * Tant que 0017 n'est PAS appliquée LIVE OU que l'env est absent → le test SKIP.
 * Ne PAS fabriquer un GREEN : ce test est posé en Wave-0 comme filet de régression
 * gating, il deviendra exécutable après l'application LIVE (plan 17-04).
 *
 * Source : 17-02-PLAN.md Task 2 ; 17-RESEARCH.md §Validation Wave 0 ; 17-VALIDATION.md.
 */
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// PostgREST renvoie ce code quand la fonction RPC n'existe pas dans le cache de
// schéma → migration 0017 (get_mrr) PAS encore appliquée LIVE (plan 17-04).
const FN_NOT_FOUND_CODE = 'PGRST202'

const TEST_PASSWORD = 'TestPassword123!'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

const hasEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

function uniqueEmail(): string {
  return `vitest-mrr-gating-${Date.now()}@gmail.com`
}

describe('T-17-MV-TEST / SCALE-03 : non-superadmin lit 0 ligne via get_mrr() (gating matview)', () => {
  // Garde de skip env : si l'URL ou la clé anon manque, le test SKIP (ne pas
  // confondre absence d'env / migration non appliquée avec un échec réel).
  it.skipIf(!hasEnv)(
    'client anon authentifié non-superadmin → rpc("get_mrr") renvoie 0 ligne sans erreur',
    async (ctx) => {
      // Client anon « nu » (= chemin navigateur), JAMAIS service_role.
      const supabase = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string)

      // Crée un utilisateur authentifié SANS privilège superadmin.
      const { error: signUpError } = await supabase.auth.signUp({
        email: uniqueEmail(),
        password: TEST_PASSWORD,
      })
      expect(signUpError, 'signUp ne doit pas échouer').toBeNull()

      // Appel du wrapper gated : la garde is_superadmin() filtre SILENCIEUSEMENT.
      const { data, error } = await supabase.rpc('get_mrr')

      // Wave-0 : si 0017 n'est PAS encore appliquée LIVE, get_mrr() est absent du
      // cache de schéma (PGRST202). On SKIP dynamiquement plutôt que de fabriquer
      // un faux échec — le test devient assertif une fois 0017 LIVE (plan 17-04).
      if (error?.code === FN_NOT_FOUND_CODE) {
        ctx.skip()
        return
      }

      expect(error, 'la garde is_superadmin() filtre silencieusement (pas d’erreur)').toBeNull()
      expect(data ?? [], 'un non-superadmin ne lit AUCUNE ligne MRR').toHaveLength(0)
    },
  )
})
