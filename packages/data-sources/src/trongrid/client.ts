/**
 * Client TronGrid — lecture des transferts TRC-20 via fetch+Zod maison.
 *
 * Miroir de fred/client.ts (pLimit + pRetry + Retry-After 429). Différences TronGrid :
 *   - Clé `TRONGRID_API_KEY` lue de l'env (throw si absente), passée en HEADER
 *     `TRON-PRO-API-KEY` — JAMAIS en query param (T-04-KEYLEAK).
 *   - Base URL conditionnée par `TRON_NETWORK` : 'mainnet' → api.trongrid.io,
 *     sinon (défaut testnet Nile) → nile.trongrid.io.
 *   - Endpoint A : GET {base}/v1/accounts/{receiver}/transactions/trc20
 *       ?only_confirmed=true&contract_address={contract}&limit=200
 *     (only_confirmed=true filtre côté serveur le réorg, A2/Pitfall 3).
 *
 * T-04-KEYLEAK : clé en header serveur uniquement ; ce module NE DOIT JAMAIS être
 *   importé côté bundle navigateur (serveur/jobs uniquement).
 * Rate limit TronGrid : pLimit(2) (généreux, aligné fred).
 *
 * Référence : developers.tron.network — /v1/accounts/{address}/transactions/trc20.
 */
import pLimit from 'p-limit'
import pRetry from 'p-retry'
import { Trc20TransfersResponseSchema, type Trc20Transfer } from './schema.js'

// Rate limit TronGrid → pLimit(2) (miroir fred)
const limit = pLimit(2)

/** Base URL TronGrid conditionnée par le réseau (mainnet vs testnet Nile). */
function tronGridBase(): string {
  return process.env['TRON_NETWORK'] === 'mainnet'
    ? 'https://api.trongrid.io'
    : 'https://nile.trongrid.io'
}

/**
 * Récupère les transferts TRC-20 confirmés reçus par une adresse, pour un contrat.
 *
 * @param receiver - Adresse de réception (USDT_RECEIVE_ADDRESS, base58 T...).
 * @param contract - Adresse du contrat USDT officiel (.env, jamais saisie user).
 * @param limitCount - Nombre de transferts (default 200).
 * @returns Transferts TRC-20 parsés Zod (only_confirmed=true côté serveur).
 */
export async function fetchTrc20TransfersForReceiver(
  receiver: string,
  contract: string,
  limitCount = 200,
): Promise<Trc20Transfer[]> {
  // T-04-KEYLEAK : clé depuis env, throw si absente
  const apiKey = process.env['TRONGRID_API_KEY']
  if (!apiKey) {
    throw new Error('TRONGRID_API_KEY must be set in apps/jobs/.env')
  }

  const base = tronGridBase()

  return limit(() =>
    pRetry(
      async () => {
        const url =
          `${base}/v1/accounts/${encodeURIComponent(receiver)}/transactions/trc20` +
          `?only_confirmed=true` +
          `&contract_address=${encodeURIComponent(contract)}` +
          `&limit=${limitCount}`

        const res = await fetch(url, {
          // Clé en HEADER (jamais query param) — T-04-KEYLEAK
          headers: { 'TRON-PRO-API-KEY': apiKey },
        })

        if (!res.ok) {
          const err = new Error(`TronGrid: HTTP ${res.status} ${res.statusText}`)
          // Propager Retry-After pour onFailedAttempt (p-retry v8)
          if (res.status === 429) {
            const retryAfterSec = Number(res.headers.get('retry-after') ?? 0)
            if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
              ;(err as Error & { retryAfterMs?: number }).retryAfterMs = retryAfterSec * 1000
            }
          }
          throw err
        }

        const json: unknown = await res.json()
        return Trc20TransfersResponseSchema.parse(json).data
      },
      {
        retries: 3,
        onFailedAttempt: async ({ error }) => {
          // Respect Retry-After propagé depuis la Response (voir throw ci-dessus)
          const waitMs = (error as Error & { retryAfterMs?: number }).retryAfterMs
          if (waitMs && Number.isFinite(waitMs)) {
            await new Promise((resolve) => setTimeout(resolve, waitMs))
          }
        },
      },
    ),
  )
}

/**
 * Filtre côté code un transfert par hash de transaction.
 *
 * L'endpoint A ne filtre pas par hash → on récupère les transferts du destinataire
 * puis on sélectionne le `transaction_id` recherché. Retourne null si introuvable
 * (TX non confirmée / inexistante → verify mappe `not_confirmed`).
 *
 * @param receiver - Adresse de réception.
 * @param contract - Adresse du contrat USDT officiel.
 * @param txHash - Hash de transaction recherché (transaction_id).
 * @returns Le transfert correspondant ou null.
 */
export async function getTransferByHash(
  receiver: string,
  contract: string,
  txHash: string,
): Promise<Trc20Transfer | null> {
  const transfers = await fetchTrc20TransfersForReceiver(receiver, contract)
  return transfers.find((t) => t.transaction_id === txHash) ?? null
}
