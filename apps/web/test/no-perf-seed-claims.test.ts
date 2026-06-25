/**
 * no-perf-seed-claims.test.ts — garde anti-allégation de performance dans le CODE
 * SEED (SEED-02 / VITR-03 / D-08), volet B du scan statique.
 *
 * Behavior : aucun fichier source sous `apps/jobs/scripts/seed/**` ne doit insérer
 * un champ de pourcentage de performance (win-rate, success-rate, expectancy, %
 * hardcodé). Les agrégats de perf vivent en DB (migrations 0009-0017) — toute
 * tentation de les recalculer/hardcoder dans le seed est l'anti-pattern central de
 * la phase 18 (double source de vérité + faux dashboards).
 *
 * Aucune connexion DB : le scan lit le code source via `node:fs` (récursif), donc
 * toujours exécutable en CI. Le test FAIL en listant le fichier, la ligne et le
 * motif fautif.
 *
 * Tolérance à l'absence : le dossier seed/ ne contient pour l'instant que
 * `config.ts` (Task 1). 0 offender = vert toléré — la garde se déclenche dès qu'un
 * futur fichier de seed (Wave ≥ 1) insère un champ de perf.
 *
 * Liste blanche (mentions LÉGITIMES, PAS des allégations de perf) :
 *   - `realized_r`     : R réalisé d'un prediction_outcome (donnée factuelle, pas un %)
 *   - `outcome`        : statut de sortie d'un trade (win/loss/be), pas un taux
 *   - `amount_atomic`  : montant atomique bigint (USDT ×10^6)
 *   - `rate_bps`       : taux de commission affiliation en basis points (PAS perf de trade)
 *
 * Note placement : le glob Vitest (vitest.config.ts) inclut `apps/web/test/**`.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// apps/web/test/ → racine workspace = remonter de 3 niveaux.
const SEED_DIR = path.resolve(__dirname, '../../jobs/scripts/seed')

// Champs de % de perf interdits dans le code seed (SEED-02). `win_rate`/`winRate`,
// `success_rate`/`successRate`, `winRatePct`, `expectancy`, ou un `%` hardcodé.
const FORBIDDEN_SEED_FIELDS = /win_?rate|success_?rate|winRatePct|expectancy|hardcoded.*%/i

// Identifiants factuels autorisés (neutralisés avant le scan pour éviter les faux
// positifs : aucun ne contient un motif interdit aujourd'hui, mais on documente
// l'intention et on protège contre une future extension de la regex).
const ALLOWED = /realized_r|outcome|amount_atomic|rate_bps/gi

function stripAllowed(value: string): string {
  return value.replace(ALLOWED, '')
}

function detectForbidden(value: string): boolean {
  return FORBIDDEN_SEED_FIELDS.test(stripAllowed(value))
}

// Collecte récursive des fichiers .ts du dossier seed (jamais de DB).
function collectSeedFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectSeedFiles(full)
    if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) return [full]
    return []
  })
}

describe('no-perf-seed-claims : aucun champ de % de perf dans le code seed (SEED-02)', () => {
  it('le détecteur attrape bien un champ planté « win_rate: 0.9 » (non trivial)', () => {
    // Anti vacuous-green : si la regex ne matchait rien, ce test FAIL.
    expect(detectForbidden('win_rate: 0.9')).toBe(true)
    expect(detectForbidden('const winRate = computeWinRate()')).toBe(true)
    expect(detectForbidden('success_rate: 0.62')).toBe(true)
    expect(detectForbidden('expectancy: 1.4')).toBe(true)
    expect(detectForbidden('winRatePct: 90')).toBe(true)
    expect(detectForbidden('/* hardcoded 90% */')).toBe(true)
  })

  it('autorise les champs factuels (realized_r, outcome, amount_atomic, rate_bps)', () => {
    expect(detectForbidden("realized_r: '1.5'")).toBe(false)
    expect(detectForbidden("outcome: 'win'")).toBe(false)
    expect(detectForbidden("amount_atomic: '9000000'")).toBe(false)
    expect(detectForbidden('rate_bps: 800')).toBe(false)
  })

  it('scan tolérant : un dossier seed sans offender ne jette pas (0 = vert)', () => {
    // Le dossier seed/ existe (config.ts posé en Task 1) mais ne doit contenir
    // aucun champ de perf → liste d'offenders vide tolérée.
    const files = collectSeedFiles(SEED_DIR)
    expect(Array.isArray(files)).toBe(true)
  })

  it('aucun fichier seed n’insère un champ de % de perf (SEED-02)', () => {
    const files = collectSeedFiles(SEED_DIR)
    const offenders: string[] = []
    for (const file of files) {
      const content = readFileSync(file, 'utf8')
      const lines = content.split(/\r?\n/)
      lines.forEach((line, idx) => {
        if (detectForbidden(line)) {
          const rel = path.relative(SEED_DIR, file)
          offenders.push(`${rel}:${idx + 1} → "${line.trim()}"`)
        }
      })
    }
    expect(
      offenders,
      `Champs de % de perf détectés dans le code seed :\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
