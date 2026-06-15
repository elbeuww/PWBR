/**
 * Test CR-01 — l'arm-step exige EXACTEMENT 1 ligne ; hard-stop sur 0 (fenêtre anti-replay).
 *
 * Contrat (Pitfall 2) : armer le UNIQUE(tx_hash) AVANT toute lecture réseau. Un
 * UPDATE qui matche 0 ligne n'est PAS une erreur PostgREST → si on continue, le
 * tx_hash n'est jamais écrit, le filet UNIQUE ne se déclenche jamais, et on ouvre une
 * fenêtre de réutilisation du hash entre lignes (double-activation).
 *
 * On vérifie :
 *  - 0 ligne armée (`.update(...).select('id')` → { data: [], error: null }) ⇒
 *    verifyPayment retourne code:'expired' et fetchTrc20TransfersForReceiver
 *    n'est JAMAIS appelée (pas de lecture réseau, pas d'activation).
 *  - 23505 (rejeu) court-circuite TOUJOURS avant toute lecture réseau (code:'replay').
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks des frontières d'I/O de actions.ts ---

// SSR anon : getUser() renvoie un user connecté.
vi.mock('../../../../../lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u-1' } } }) },
  }),
}))

// Gate légal : review faite (ne bloque pas ; on teste de toute façon en testnet).
vi.mock('../../../../../lib/legal-gate', () => ({
  isLegalReviewDone: vi.fn().mockReturnValue(true),
}))

// data-sources : la lecture réseau et la vérif on-chain. On espionne fetch pour
// prouver qu'elle n'est JAMAIS appelée sur le chemin 0-ligne / replay.
// vi.hoisted : la const doit exister avant la factory vi.mock (hoistée en tête).
const { fetchTrc20TransfersForReceiver } = vi.hoisted(() => ({
  fetchTrc20TransfersForReceiver: vi.fn(),
}))
vi.mock('@app/data-sources', () => ({
  fetchTrc20TransfersForReceiver,
  verifyTransfer: vi.fn(),
}))

// Le client service_role est créé via createClient de supabase-js. On le pilote
// par test via une variable mutable.
let serviceClientImpl: unknown
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => serviceClientImpl),
}))

// Repository/RPC : on n'attend aucun appel sur les chemins testés, mais on fournit
// des stubs sûrs pour éviter tout I/O réel.
vi.mock('@app/supabase', () => ({
  OFFSET_RESERVATION_MINUTES: 60,
  ReplayError: class ReplayError extends Error {},
  OffsetExhaustedError: class OffsetExhaustedError extends Error {},
  reserveOffset: vi.fn(),
  transitionPayment: vi.fn(),
  activateForPayment: vi.fn(),
}))

import { verifyPayment } from '../actions'

const TX = 'a'.repeat(64)

/**
 * Construit un client service_role mocké :
 *  - le SELECT initial (maybeSingle) renvoie une ligne pending,
 *  - l'arm UPDATE(...).select('id') renvoie `armedRows`.
 */
function makeServiceClient(armedRows: Array<{ id: string }>) {
  // SELECT initial : .from().select().eq().eq().maybeSingle()
  const maybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: 'pay-1',
      user_id: 'u-1',
      plan: 'standard',
      expected_amount_atomic: '9000001',
      status: 'pending',
    },
    error: null,
  })
  const selectRead = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle,
  }

  // UPDATE arm : .from().update().eq().eq().eq().select('id') → Promise
  const armSelect = vi.fn().mockResolvedValue({ data: armedRows, error: null })
  const updateChain = {
    eq: vi.fn().mockReturnThis(),
    select: armSelect,
  }

  return {
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue(selectRead),
      update: vi.fn().mockReturnValue(updateChain),
    })),
  }
}

describe('CR-01 — arm-step exige 1 ligne, hard-stop sur 0', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env['SUPABASE_URL'] = 'http://localhost'
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service-key'
    process.env['USDT_CONTRACT_ADDRESS'] = 'TContract'
    process.env['USDT_RECEIVE_ADDRESS'] = 'TReceiver'
    delete process.env['TRON_NETWORK']
  })

  it('0 ligne armée ⇒ code:"expired" et AUCUNE lecture réseau (pas d’activation)', async () => {
    serviceClientImpl = makeServiceClient([]) // arm matche 0 ligne

    const result = await verifyPayment('pay-1', TX)

    expect(result).toEqual({ ok: false, status: 'rejected', code: 'expired' })
    expect(fetchTrc20TransfersForReceiver).not.toHaveBeenCalled()
  })

  it('23505 (rejeu) ⇒ code:"replay" AVANT toute lecture réseau', async () => {
    // SELECT initial OK, mais l'arm renvoie une erreur 23505.
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'pay-1',
        user_id: 'u-1',
        plan: 'standard',
        expected_amount_atomic: '9000001',
        status: 'pending',
      },
      error: null,
    })
    const armSelect = vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } })
    serviceClientImpl = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis(), maybeSingle }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis(), select: armSelect }),
      })),
    }

    const result = await verifyPayment('pay-1', TX)

    expect(result).toEqual({ ok: false, status: 'rejected', code: 'replay' })
    expect(fetchTrc20TransfersForReceiver).not.toHaveBeenCalled()
  })
})
