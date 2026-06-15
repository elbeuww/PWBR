/**
 * Barrel trongrid — vérification on-chain des paiements USDT TRC-20 (Phase 4).
 *
 * Regroupe : normalisation d'adresse (Plan 01), schéma Zod figé sur fixture réelle,
 * client TronGrid (fetch+Zod+p-retry), et la décision des invariants conjoints.
 */

// Normalisation d'adresse base58check <-> hex (Plan 01)
export { base58ToHex, hexToBase58, sameAddress } from './address.js'

// Schéma Zod figé sur la fixture Nile réelle
export {
  Trc20TokenInfoSchema,
  Trc20TransferSchema,
  Trc20TransfersResponseSchema,
} from './schema.js'
export type { Trc20TokenInfo, Trc20Transfer, Trc20TransfersResponse } from './schema.js'

// Client TronGrid (serveur/jobs uniquement — T-04-KEYLEAK)
export { fetchTrc20TransfersForReceiver, getTransferByHash } from './client.js'

// Décision des invariants conjoints (vérification financière)
export { verifyTransfer } from './verify.js'
export type { VerificationResult, VerifyContext } from './verify.js'
