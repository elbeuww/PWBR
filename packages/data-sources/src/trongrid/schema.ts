/**
 * Schéma Zod TronGrid TRC-20 — figé sur la fixture Nile RÉELLE (Plan 01).
 *
 * Source de vérité : __fixtures__/nile-trc20-transfer.json (forme observée en
 * direct sur Nile, PAS l'esquisse ASSUMED de RESEARCH). Forme observée :
 *   { data:[{ transaction_id, token_info:{symbol,address,decimals,name},
 *             block_timestamp, from, to, type:"Transfer", value:"<atomique>" }],
 *     success, meta:{at,page_size} }
 *
 * Pitfall 4 / T-04-PREC : `value` est conservé en STRING atomique. Le consommateur
 *   fait `BigInt(value)` — JAMAIS Number()/parseFloat (perte de précision IEEE-754).
 * T-04-FAKETOKEN : token_info.address est REQUIS (sert l'invariant contrat dans
 *   verify.ts — identité par adresse, jamais par symbol/decimals).
 * Style tolérant (marketaux) : .passthrough() pour ignorer les champs en trop, afin
 *   de ne pas casser sur une évolution de l'API TronGrid.
 *
 * `confirmed` : champ optionnel. L'endpoint client filtre déjà `only_confirmed=true`
 *   donc la fixture (déjà filtrée) ne le porte pas → absence = confirmé. S'il est
 *   présent et `=== false`, verify.ts rejette `not_confirmed` (anti-réorg, A7).
 */
import { z } from 'zod'

/** Métadonnées du token TRC-20 — token_info.address requis (invariant contrat). */
export const Trc20TokenInfoSchema = z
  .object({
    symbol: z.string(),
    address: z.string(), // REQUIS : seule source d'identité du token (T-04-FAKETOKEN)
    decimals: z.number().int(),
    name: z.string().optional(),
  })
  .passthrough()

/** Un transfert TRC-20 tel que retourné par TronGrid. */
export const Trc20TransferSchema = z
  .object({
    transaction_id: z.string(),
    token_info: Trc20TokenInfoSchema,
    block_timestamp: z.number(),
    from: z.string(),
    to: z.string(),
    type: z.string(), // "Transfer"
    value: z.string(), // ATOMIQUE en string — BigInt(value) côté consommateur
    confirmed: z.boolean().optional(), // absent = confirmé (only_confirmed côté client)
  })
  .passthrough()

/** Réponse paginée de l'endpoint /v1/accounts/{addr}/transactions/trc20. */
export const Trc20TransfersResponseSchema = z
  .object({
    data: z.array(Trc20TransferSchema),
    success: z.boolean().optional(),
    meta: z
      .object({
        at: z.number().optional(),
        page_size: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()

export type Trc20TokenInfo = z.infer<typeof Trc20TokenInfoSchema>
export type Trc20Transfer = z.infer<typeof Trc20TransferSchema>
export type Trc20TransfersResponse = z.infer<typeof Trc20TransfersResponseSchema>
