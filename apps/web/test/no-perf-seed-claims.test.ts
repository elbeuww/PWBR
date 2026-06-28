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

// ──────────────────────────────────────────────────────────────────────────
// Volet C — surface OVERVIEW du dashboard utilisateur (dash) (UDASH-01, D-09 /
// VITR-03). L'overview « cockpit » NE DOIT exposer AUCUN chiffre de performance
// fabriqué : ni equity curve, ni P&L, ni ROI, ni pourcentage chiffré non issu d'un
// `applyThreshold` (track record mesuré). On scanne statiquement les fichiers source
// de l'overview (dash)/dashboard/page.tsx et de la carte d'affiliation montée dessus.
// Les revenus d'affiliation MESURÉS (formatAtomic) ne sont pas une allégation de perf
// de trade → ils n'utilisent jamais un `%` chiffré ici.
// ──────────────────────────────────────────────────────────────────────────

// apps/web/test/ → apps/web/src
const WEB_SRC = path.resolve(__dirname, '../src')
const DASH_UI_FILES = [
  path.join(WEB_SRC, 'app/[locale]/(dash)/dashboard/page.tsx'),
  path.join(WEB_SRC, 'components/dash/AffiliateSummaryCard.tsx'),
]

// Termes de performance FABRIQUÉE interdits sur l'overview (dash). On vise les
// signatures de faux dashboards : courbe d'equity, P&L/PnL, ROI, ou un pourcentage
// signé chiffré (« +12% ») — jamais légitime hors track record mesuré (applyThreshold).
const FORBIDDEN_PERF_UI = /\bequity\b|equity\s+curve|P&L|PnL|\bROI\b|[+-]\s*\d+(?:\.\d+)?\s*%/i

function detectPerfUi(value: string): boolean {
  return FORBIDDEN_PERF_UI.test(value)
}

describe('no-perf-overview-claims : aucun chiffre de perf fabriqué sur l’overview (dash) (D-09)', () => {
  it('le détecteur attrape une allégation plantée (+12% / equity curve) — non trivial', () => {
    // Anti vacuous-green : prouve que le scan échouerait si l'overview affichait une perf.
    expect(detectPerfUi('Performance : +12% ce mois')).toBe(true)
    expect(detectPerfUi('equity curve')).toBe(true)
    expect(detectPerfUi('ROI: 8.4')).toBe(true)
    expect(detectPerfUi('P&L cumulé')).toBe(true)
  })

  it('autorise le texte légitime de l’overview (revenus mesurés, pas de % chiffré)', () => {
    expect(detectPerfUi('revenus mesurés via formatAtomic')).toBe(false)
    expect(detectPerfUi('aucun pourcentage de performance fabriqué')).toBe(false)
    expect(detectPerfUi('Statut de l’abonnement')).toBe(false)
  })

  it('l’overview (dash) et la carte d’affiliation n’exposent aucun chiffre de perf', () => {
    const offenders: string[] = []
    for (const file of DASH_UI_FILES) {
      if (!existsSync(file)) continue
      const content = readFileSync(file, 'utf8')
      const lines = content.split(/\r?\n/)
      lines.forEach((line, idx) => {
        if (detectPerfUi(line)) {
          const rel = path.relative(WEB_SRC, file)
          offenders.push(`${rel}:${idx + 1} → "${line.trim()}"`)
        }
      })
    }
    expect(
      offenders,
      `Chiffre de performance fabriqué détecté sur l'overview (dash) :\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Volet D — surface OVERVIEW du cockpit SUPERADMIN (admin) (Plan 20-01, Task 3 ;
// ADASH-07, D-09 / VITR-03 / threat T-20-04). Le cockpit 4 axes (Acquisition /
// Revenus(MRR mesuré) / Ops / Conformité) NE DOIT exposer AUCUN chiffre de perf
// FABRIQUÉ : ni equity curve, ni P&L, ni ROI, ni pourcentage signé chiffré. Le MRR
// et les agrégats sont MESURÉS via RPC (matviews P17) — jamais un % codé en dur.
//   EXTINCTION : reste vert tant que le cockpit demeure honnête ; FAIL si le reskin
//   du cockpit (plan 20-05) introduit une signature de faux dashboard. Les
//   sous-composants `_components/AxisSummary*.tsx` rejoindront ce tableau dès création.
// ──────────────────────────────────────────────────────────────────────────

const ADMIN_UI_FILES = [
  path.join(WEB_SRC, 'app/admin/page.tsx'),
  path.join(WEB_SRC, 'app/admin/_components/AxisSummaryRevenus.tsx'),
  path.join(WEB_SRC, 'app/admin/_components/AxisSummaryOps.tsx'),
  path.join(WEB_SRC, 'app/admin/_components/AxisSummaryAcquisition.tsx'),
  path.join(WEB_SRC, 'app/admin/_components/AxisSummaryConformite.tsx'),
]

// Même détecteur que le volet C (signatures de faux dashboards), appliqué au cockpit.
const FORBIDDEN_PERF_UI_ADMIN = FORBIDDEN_PERF_UI

function detectPerfUiAdmin(value: string): boolean {
  return FORBIDDEN_PERF_UI_ADMIN.test(value)
}

describe('no-perf-admin-cockpit : aucun chiffre de perf fabriqué sur le cockpit (admin) (ADASH-07)', () => {
  it('le détecteur attrape une allégation plantée (+12% / equity / ROI) — non trivial', () => {
    expect(detectPerfUiAdmin('MRR +18% ce mois')).toBe(true)
    expect(detectPerfUiAdmin('equity curve superadmin')).toBe(true)
    expect(detectPerfUiAdmin('ROI global : 7.2')).toBe(true)
  })

  it('autorise le texte légitime du cockpit (MRR mesuré, pas de % chiffré)', () => {
    expect(detectPerfUiAdmin('MRR mesuré via get_mrr (matview)')).toBe(false)
    expect(detectPerfUiAdmin('Axe Conformité')).toBe(false)
  })

  it('le cockpit (admin)/page.tsx n’expose aucun chiffre de perf fabriqué', () => {
    const offenders: string[] = []
    for (const file of ADMIN_UI_FILES) {
      if (!existsSync(file)) continue
      const content = readFileSync(file, 'utf8')
      const lines = content.split(/\r?\n/)
      lines.forEach((line, idx) => {
        if (detectPerfUiAdmin(line)) {
          const rel = path.relative(WEB_SRC, file)
          offenders.push(`${rel}:${idx + 1} → "${line.trim()}"`)
        }
      })
    }
    expect(
      offenders,
      `Chiffre de performance fabriqué détecté sur le cockpit (admin) :\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
