/**
 * Normalisation d'adresse TRON — base58check <-> hex (préfixe 0x41).
 *
 * T-04-ADDR : la vérification du checksum (double-SHA256) est obligatoire ;
 *   `base58ToHex` throw sur checksum corrompu → on ne compare jamais une adresse
 *   non vérifiée (faux positif = paiement crédité au mauvais destinataire).
 * T-04-CRYPTO : sha256 via `crypto` natif Node, JAMAIS réimplémenté (V6 ASVS).
 * Stack : AUCUNE dépendance tronweb (RESEARCH §"NE PAS installer tronweb").
 *
 * Seul analog repo : marketaux/client.ts (createHash natif).
 */
import { createHash } from 'crypto'

/** Alphabet base58 (Bitcoin/TRON), sans 0 O I l. */
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/** sha256(sha256(payload))[0..4] — checksum base58check. */
function checksum(payload: Buffer): Buffer {
  return createHash('sha256')
    .update(createHash('sha256').update(payload).digest())
    .digest()
    .subarray(0, 4)
}

/** Décode une chaîne base58 en Buffer (préserve les zéros de tête). */
function base58Decode(input: string): Buffer {
  let acc = 0n
  for (const char of input) {
    const index = ALPHABET.indexOf(char)
    if (index < 0) {
      throw new Error(`base58Decode: caractère hors alphabet "${char}"`)
    }
    acc = acc * 58n + BigInt(index)
  }

  let hex = acc.toString(16)
  if (hex.length % 2) hex = '0' + hex
  const body = acc === 0n ? Buffer.alloc(0) : Buffer.from(hex, 'hex')

  let leadingZeros = 0
  for (const char of input) {
    if (char === '1') leadingZeros++
    else break
  }

  return Buffer.concat([Buffer.alloc(leadingZeros, 0), body])
}

/** Encode un Buffer en base58 (préserve les zéros de tête → '1'). */
function base58Encode(buf: Buffer): string {
  let acc = buf.length === 0 ? 0n : BigInt('0x' + buf.toString('hex'))
  let out = ''
  while (acc > 0n) {
    const rem = Number(acc % 58n)
    out = ALPHABET[rem] + out
    acc = acc / 58n
  }
  for (const byte of buf) {
    if (byte === 0) out = '1' + out
    else break
  }
  return out
}

/**
 * Convertit une adresse TRON base58check en hex lowercase (21 octets, préfixe 41).
 *
 * @param addr - Adresse base58 ex. "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t".
 * @returns Hex lowercase ex. "41a614f803...".
 * @throws Si le checksum est invalide (adresse corrompue).
 */
export function base58ToHex(addr: string): string {
  const full = base58Decode(addr)
  if (full.length < 5) {
    throw new Error('base58ToHex: adresse trop courte')
  }
  const payload = full.subarray(0, full.length - 4)
  const provided = full.subarray(full.length - 4)
  const expected = checksum(payload)
  if (Buffer.compare(provided, expected) !== 0) {
    throw new Error('base58ToHex: checksum invalide (adresse corrompue)')
  }
  return payload.toString('hex')
}

/**
 * Convertit un hex TRON (21 octets, préfixe 41) en adresse base58check.
 *
 * @param hex - Hex avec ou sans préfixe "0x".
 * @returns Adresse base58 ex. "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t".
 */
export function hexToBase58(hex: string): string {
  const clean = hex.replace(/^0x/i, '')
  const payload = Buffer.from(clean, 'hex')
  return base58Encode(Buffer.concat([payload, checksum(payload)]))
}

/**
 * Compare deux adresses TRON quelle que soit leur forme (base58 ou hex).
 *
 * Normalise chaque entrée en hex lowercase (vérification de checksum incluse pour
 * les formes base58) puis compare exactement.
 *
 * @param a - Adresse base58 (T...) ou hex (41.../0x41...).
 * @param b - Adresse base58 (T...) ou hex (41.../0x41...).
 * @returns true si les deux désignent la même adresse.
 */
export function sameAddress(a: string, b: string): boolean {
  const normalize = (s: string): string =>
    (s.startsWith('T') ? base58ToHex(s) : s.replace(/^0x/i, '')).toLowerCase()
  return normalize(a) === normalize(b)
}
