/**
 * freeze-nile-fixture — capture la forme RÉELLE d'une réponse TronGrid (Nile testnet)
 * et fige la fixture + les golden values de B-04-01 (checkpoint réseau 04-01 Task 3).
 *
 * Ne RIEN inventer : ce script lit une vraie transaction TRC-20 confirmée arrivée sur
 * USDT_RECEIVE_ADDRESS, écrit la réponse brute dans __fixtures__/nile-trc20-transfer.json
 * et résume les valeurs vérifiées (A1-A7) dans __fixtures__/GOLDEN.md.
 *
 * Idempotent : ré-exécutable à volonté (réécrit la fixture depuis l'état on-chain courant).
 *
 * Lancement : pnpm --filter jobs exec tsx scripts/freeze-nile-fixture.ts
 * Pré-requis : apps/jobs/.env rempli (TRONGRID_API_KEY, USDT_RECEIVE_ADDRESS, TRON_NETWORK=nile)
 *              + au moins UNE transaction TRC-20 confirmée vers USDT_RECEIVE_ADDRESS.
 *
 * La clé API n'est JAMAIS affichée ni écrite dans la fixture (envoyée en header uniquement).
 */
import { config } from 'dotenv'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { base58ToHex } from '@app/data-sources/trongrid/address'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = resolve(SCRIPT_DIR, '../.env') // apps/jobs/.env
const REPO_ROOT = resolve(SCRIPT_DIR, '../../..')
const FIXTURE_DIR = resolve(
  REPO_ROOT,
  'packages/data-sources/src/trongrid/__fixtures__',
)
const FIXTURE_FILE = resolve(FIXTURE_DIR, 'nile-trc20-transfer.json')
const GOLDEN_FILE = resolve(FIXTURE_DIR, 'GOLDEN.md')

config({ path: ENV_PATH })

const BASE_URLS: Record<string, string> = {
  nile: 'https://nile.trongrid.io',
  mainnet: 'https://api.trongrid.io',
}

function fail(msg: string): never {
  console.error(`\n❌ ${msg}\n`)
  process.exit(1)
}

const apiKey = process.env['TRONGRID_API_KEY']?.trim()
const receiveAddr = process.env['USDT_RECEIVE_ADDRESS']?.trim()
const contractAddr = process.env['USDT_CONTRACT_ADDRESS']?.trim() || ''
const network = (process.env['TRON_NETWORK']?.trim() || 'nile').toLowerCase()

if (!apiKey) fail('TRONGRID_API_KEY manquante dans apps/jobs/.env')
if (!receiveAddr) fail('USDT_RECEIVE_ADDRESS manquante dans apps/jobs/.env')
const baseUrl = BASE_URLS[network]
if (!baseUrl) fail(`TRON_NETWORK invalide: "${network}" (attendu: nile | mainnet)`)

if (network === 'mainnet') {
  fail(
    'TRON_NETWORK=mainnet — refus de capturer une fixture sur le réseau réel. ' +
      'Utilise nile (testnet) pour figer la fixture. Mainnet est bloqué par LEGAL-02.',
  )
}

// Valide le format de l'adresse de réception AVANT tout appel réseau (T-04-ADDR).
let receiveHex: string
try {
  receiveHex = base58ToHex(receiveAddr)
} catch (e) {
  fail(
    `USDT_RECEIVE_ADDRESS invalide (checksum base58check) : ${receiveAddr} — ${(e as Error).message}`,
  )
}

interface Trc20Tx {
  transaction_id: string
  token_info?: { symbol?: string; address?: string; decimals?: number }
  block_timestamp?: number
  from?: string
  to?: string
  type?: string
  value?: string
}

interface Trc20Response {
  data?: Trc20Tx[]
  success?: boolean
  meta?: unknown
  error?: string
}

async function main(): Promise<void> {
  const params = new URLSearchParams({
    only_confirmed: 'true',
    limit: '20',
    order_by: 'block_timestamp,desc',
  })
  if (contractAddr) params.set('contract_address', contractAddr)

  const url = `${baseUrl}/v1/accounts/${receiveAddr}/transactions/trc20?${params.toString()}`

  console.log(`\n🔎 Réseau : ${network} (${baseUrl})`)
  console.log(`🔎 Adresse de réception : ${receiveAddr}`)
  console.log(`   hex (0x41…)          : ${receiveHex}`)
  console.log(`🔎 Filtre contrat       : ${contractAddr || '(aucun — capture tout TRC-20)'}`)
  console.log(`🔎 GET ${url.replace(receiveAddr, receiveAddr)}\n`)

  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'TRON-PRO-API-KEY': apiKey!, accept: 'application/json' },
    })
  } catch (e) {
    fail(`Échec réseau (TronGrid injoignable) : ${(e as Error).message}`)
  }

  if (!res!.ok) {
    const body = await res!.text().catch(() => '')
    fail(`TronGrid a répondu ${res!.status} ${res!.statusText}\n${body.slice(0, 500)}`)
  }

  const json = (await res!.json()) as Trc20Response

  if (json.success === false || json.error) {
    fail(`TronGrid error: ${json.error ?? 'success=false'}`)
  }

  const txs = json.data ?? []
  if (txs.length === 0) {
    fail(
      `Aucune transaction TRC-20 confirmée trouvée vers ${receiveAddr}.\n` +
        `→ Fais d'abord UN transfert de test-USDT (ou tout token TRC-20) vers cette adresse sur Nile,\n` +
        `  attends la confirmation (~1 min), puis relance ce script.`,
    )
  }

  // Choix : la plus récente (data déjà triée desc). Si un contrat est fixé, on a déjà filtré.
  const tx = txs[0]!
  const tokenContract = tx.token_info?.address ?? '(inconnu)'
  const decimals = tx.token_info?.decimals ?? null
  const symbol = tx.token_info?.symbol ?? '(inconnu)'

  // Golden cross-check : le destinataire on-chain == notre adresse de réception ?
  let toHex = '(non décodable)'
  let toMatches = false
  if (tx.to) {
    try {
      toHex = base58ToHex(tx.to)
      toMatches = toHex.toLowerCase() === receiveHex.toLowerCase()
    } catch {
      /* laissé non décodable */
    }
  }

  const humanValue =
    tx.value && decimals !== null
      ? (Number(tx.value) / 10 ** decimals).toString()
      : '(n/a)'

  // 1) Fixture brute (réponse complète — c'est elle que le schéma Zod 04-04 doit valider).
  mkdirSync(FIXTURE_DIR, { recursive: true })
  writeFileSync(FIXTURE_FILE, JSON.stringify(json, null, 2) + '\n', 'utf8')

  // 2) GOLDEN.md — valeurs vérifiées (remplace les hypothèses A1-A7 par du réel).
  const golden = `# GOLDEN — Fixture TronGrid Nile (B-04-01)

> Généré par \`apps/jobs/scripts/freeze-nile-fixture.ts\` depuis une transaction RÉELLE.
> Réseau : **${network}** (${baseUrl}). NE PAS éditer à la main : relancer le script.

## Transaction de référence

| Champ | Valeur réelle observée |
|-------|------------------------|
| \`transaction_id\` | \`${tx.transaction_id}\` |
| \`from\` | \`${tx.from ?? '(absent)'}\` |
| \`to\` | \`${tx.to ?? '(absent)'}\` |
| \`to\` (hex 0x41…) | \`${toHex}\` |
| \`value\` (atomique) | \`${tx.value ?? '(absent)'}\` |
| \`token_info.symbol\` | \`${symbol}\` |
| \`token_info.address\` (CONTRAT) | \`${tokenContract}\` |
| \`token_info.decimals\` | \`${decimals ?? '(absent)'}\` |
| \`type\` | \`${tx.type ?? '(absent)'}\` |
| montant humain | \`${humanValue} ${symbol}\` |

## Invariants confirmés (remplacent A1-A7)

- **A1 — forme JSON** : enveloppe \`{ data: [...], success, meta }\`, items TRC-20 avec
  \`transaction_id\`, \`token_info.{symbol,address,decimals}\`, \`from\`, \`to\`, \`value\`, \`type\`, \`block_timestamp\`.
- **A2 — adresses base58** : \`from\`/\`to\` renvoyés en base58 (T…), décodables en hex 0x41 (checksum OK).
- **A3 — destinataire** : \`to\` == USDT_RECEIVE_ADDRESS → **${toMatches ? 'OUI ✅' : 'NON ❌ (À VÉRIFIER)'}** (hex ${toHex} vs ${receiveHex}).
- **A4 — montant** : \`value\` est une **string atomique** entière (×10^decimals). decimals=${decimals ?? '?'}.
- **A5 — only_confirmed** : requête avec \`only_confirmed=true\` → uniquement transactions confirmées.
- **A6 — header clé** : authentification via header \`TRON-PRO-API-KEY\` (jamais en query/body).
- **A7 — contrat** : \`token_info.address\` = **${tokenContract}** → renseigner \`USDT_CONTRACT_ADDRESS\` avec CETTE valeur.

## Action requise

${
  contractAddr
    ? toMatches && tokenContract.toLowerCase() === '' // placeholder
      ? ''
      : `- Vérifier que \`USDT_CONTRACT_ADDRESS=${contractAddr}\` correspond bien au contrat observé ci-dessus (\`${tokenContract}\`).`
    : `- ⚠️ \`USDT_CONTRACT_ADDRESS\` est VIDE → y mettre **${tokenContract}** (contrat réellement observé) après vérification sur https://nile.tronscan.org.`
}
`
  writeFileSync(GOLDEN_FILE, golden, 'utf8')

  // 3) Rapport console.
  console.log('✅ Fixture figée :')
  console.log(`   ${FIXTURE_FILE}`)
  console.log(`   ${GOLDEN_FILE}\n`)
  console.log(`   Transactions capturées : ${txs.length} (référence = la plus récente)`)
  console.log(`   Token : ${symbol}  |  contrat : ${tokenContract}  |  decimals : ${decimals}`)
  console.log(`   Montant : ${tx.value} atomique (${humanValue} ${symbol})`)
  console.log(
    `   Destinataire == adresse de réception : ${toMatches ? 'OUI ✅' : 'NON ❌ — VÉRIFIER'}\n`,
  )
  if (!contractAddr) {
    console.log(
      `👉 Renseigne maintenant dans apps/jobs/.env :\n   USDT_CONTRACT_ADDRESS=${tokenContract}\n   (après vérification sur https://nile.tronscan.org)\n`,
    )
  }
}

main().catch((e) => fail((e as Error).message))
