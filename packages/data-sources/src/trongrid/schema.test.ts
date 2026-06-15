/**
 * Golden values — schema Zod TronGrid TRC-20 (figé sur la fixture Nile RÉELLE).
 *
 * Test hors-ligne : charge la fixture figée Plan 01 (source de vérité de la forme
 * JSON, PAS l'esquisse ASSUMED de RESEARCH) et vérifie le parsing tolérant.
 * Point clé : `value` reste une string atomique (BigInt côté consommateur, jamais
 * Number — Pitfall 4) ; token_info.address requis (sert l'invariant contrat) ;
 * .passthrough() tolère les champs en trop. Aucun appel réseau. Déterministe.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { Trc20TransfersResponseSchema, Trc20TransferSchema } from './schema.js'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const rawFixture = require('./__fixtures__/nile-trc20-transfer.json') as unknown

describe('Trc20TransfersResponseSchema — fixture Nile réelle', () => {
  it('parse la fixture réelle sans erreur et expose data[]', () => {
    const parsed = Trc20TransfersResponseSchema.parse(rawFixture)
    expect(parsed.data).toHaveLength(1)
    const t = parsed.data[0]!
    expect(t.from).toBe('TVF2Mp9QY7FEGTnr3DBpFLobA6jguHyMvi')
    expect(t.to).toBe('TK5vKwGSazWAaJeXpPJLZ5V6jHuryeLzaK')
    expect(t.token_info.address).toBe('TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf')
  })

  it('value reste une string atomique — BigInt(value) === montant attendu (1000 USDT)', () => {
    const parsed = Trc20TransfersResponseSchema.parse(rawFixture)
    const t = parsed.data[0]!
    expect(typeof t.value).toBe('string')
    expect(BigInt(t.value)).toBe(1_000_000_000n) // 1000 USDT, decimals 6
  })

  it('token_info.decimals === 6 sur la fixture USDT-test', () => {
    const parsed = Trc20TransfersResponseSchema.parse(rawFixture)
    expect(parsed.data[0]!.token_info.decimals).toBe(6)
  })

  it('tolère des champs en trop (.passthrough)', () => {
    const t = {
      transaction_id: 'abc',
      token_info: {
        symbol: 'USDT',
        address: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
        decimals: 6,
        name: 'Tether USD',
        unexpected_field: 'ok',
      },
      block_timestamp: 1781527728000,
      from: 'TVF2Mp9QY7FEGTnr3DBpFLobA6jguHyMvi',
      to: 'TK5vKwGSazWAaJeXpPJLZ5V6jHuryeLzaK',
      type: 'Transfer',
      value: '1000000000',
      extra_unexpected: 42,
    }
    expect(() => Trc20TransferSchema.parse(t)).not.toThrow()
  })

  it('échoue si token_info.address est absent (requis pour l\'invariant contrat)', () => {
    const t = {
      transaction_id: 'abc',
      token_info: { symbol: 'USDT', decimals: 6, name: 'Tether USD' },
      block_timestamp: 1781527728000,
      from: 'TVF2Mp9QY7FEGTnr3DBpFLobA6jguHyMvi',
      to: 'TK5vKwGSazWAaJeXpPJLZ5V6jHuryeLzaK',
      type: 'Transfer',
      value: '1000000000',
    }
    expect(() => Trc20TransferSchema.parse(t)).toThrow()
  })
})
