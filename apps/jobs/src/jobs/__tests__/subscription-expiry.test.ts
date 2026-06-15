/**
 * Test subscription-expiry — idempotence du job (Plan 06, PAY-05 / D-05 / D-10).
 *
 * Vérifie SANS DB réelle (mock du client service_role) que :
 *  - expireDue : 1er run expire N subscriptions, 2e run consécutif = 0 ligne
 *    (le WHERE status='active' AND current_period_end<=now() ne re-trouve rien).
 *  - releaseExpiredReservations : 1er run libère M payments pending expirés, 2e run = 0
 *    (le WHERE status='pending' AND reservation_expires_at<=now() ne re-trouve rien).
 *  - stats Json = { expired, released }.
 *
 * Le mock simule un store en mémoire : un UPDATE filtré renvoie les lignes éligibles
 * PUIS les transitionne hors de l'état filtré → un re-run trouve un ensemble vide
 * (reproduit fidèlement l'idempotence DB naturelle des deux sweeps).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Fixtures store en mémoire ────────────────────────────────────────────────

interface SubRow {
  id: string
  status: string
  current_period_end: string
}
interface PayRow {
  id: string
  status: string
  reservation_expires_at: string | null
}

const PAST = '2020-01-01T00:00:00.000Z'
const FUTURE = '2999-01-01T00:00:00.000Z'

let subs: SubRow[]
let pays: PayRow[]

// ─── Mock chaînable du query builder Supabase ─────────────────────────────────
//
// expireDue : .from('subscriptions').update(p).eq('status','active').lte('current_period_end', iso).select('id')
// releaseExpiredReservations : .from('payments').update(p).eq('status','pending').not('reservation_expires_at','is',null).lte('reservation_expires_at', iso).select('id')

function makeClient() {
  return {
    from(table: string) {
      const filters: { status?: string; nowIso?: string; notNull?: boolean } = {}
      let patch: Record<string, unknown> = {}
      const builder = {
        update(p: Record<string, unknown>) {
          patch = p
          return builder
        },
        eq(col: string, val: string) {
          if (col === 'status') filters.status = val
          return builder
        },
        not(_col: string, _op: string, _val: null) {
          filters.notNull = true
          return builder
        },
        lte(_col: string, iso: string) {
          filters.nowIso = iso
          return builder
        },
        // .select('id') termine la chaine et applique l'UPDATE au store en memoire
        select(_cols: string) {
          const nowIso = filters.nowIso ?? new Date().toISOString()
          if (table === 'subscriptions') {
            const eligible = subs.filter(
              (r) => r.status === filters.status && r.current_period_end <= nowIso,
            )
            for (const r of eligible) Object.assign(r, patch)
            return Promise.resolve({ data: eligible.map((r) => ({ id: r.id })), error: null })
          }
          // payments
          const eligible = pays.filter(
            (r) =>
              r.status === filters.status &&
              r.reservation_expires_at !== null &&
              r.reservation_expires_at <= nowIso,
          )
          for (const r of eligible) Object.assign(r, patch)
          return Promise.resolve({ data: eligible.map((r) => ({ id: r.id })), error: null })
        },
      }
      return builder
    },
  }
}

// `createClient` du SDK est remplacé par notre mock store-backed.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => makeClient(),
}))

import { subscriptionExpiry } from '../subscription-expiry'

describe('subscription-expiry — idempotence (PAY-05)', () => {
  beforeEach(() => {
    process.env['SUPABASE_URL'] = 'http://localhost'
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role'

    subs = [
      { id: 's1', status: 'active', current_period_end: PAST }, // échu -> expirable
      { id: 's2', status: 'active', current_period_end: PAST }, // échu -> expirable
      { id: 's3', status: 'active', current_period_end: FUTURE }, // encore valide
    ]
    pays = [
      { id: 'p1', status: 'pending', reservation_expires_at: PAST }, // expiré -> liberable
      { id: 'p2', status: 'pending', reservation_expires_at: PAST }, // expiré -> liberable
      { id: 'p3', status: 'pending', reservation_expires_at: PAST }, // expiré -> liberable
      { id: 'p4', status: 'pending', reservation_expires_at: FUTURE }, // réservation active
      { id: 'p5', status: 'pending', reservation_expires_at: null }, // soumis (pas de réservation)
    ]
  })

  it('1er run : expire les échus + libère les réservations expirées ; stats {expired,released}', async () => {
    const stats = (await subscriptionExpiry()) as { expired: number; released: number }
    expect(stats).toEqual({ expired: 2, released: 3 })

    // s1/s2 -> expired ; s3 inchangé. p1/p2/p3 -> rejected+motif ; p4/p5 inchangés.
    expect(subs.filter((r) => r.status === 'expired').map((r) => r.id)).toEqual(['s1', 's2'])
    expect(subs.find((r) => r.id === 's3')?.status).toBe('active')
    expect(pays.filter((r) => r.status === 'rejected').map((r) => r.id)).toEqual([
      'p1',
      'p2',
      'p3',
    ])
    expect(pays.find((r) => r.id === 'p4')?.status).toBe('pending')
    expect(pays.find((r) => r.id === 'p5')?.status).toBe('pending')
  })

  it('2e run consécutif : aucune ligne re-traitée (idempotent) ; stats {0,0}', async () => {
    await subscriptionExpiry() // 1er run consomme les éligibles
    const second = (await subscriptionExpiry()) as { expired: number; released: number }
    expect(second).toEqual({ expired: 0, released: 0 })
  })
})
