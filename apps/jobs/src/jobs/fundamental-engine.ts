/**
 * Job fundamental-engine — règles FRED déterministes (zéro IA) → fundamental_context §3.
 *
 * Deuxième slice fondamental (FUND-01) : lit les séries macro FRED en base,
 * dérive par règles nommées macro_bias (risk_on/off) + rate_environment (hawkish/dovish),
 * lit les drivers par actif depuis asset_drivers (data-not-code, D-38), Zod-valide,
 * hashe (D-41), upserte par instrument × style.
 *
 * Conventions :
 *  - D-23 : logique pure (deriveFundamentalContext) séparée de l'IO pour testabilité.
 *  - D-38 : drivers macro lus depuis la table asset_drivers, JAMAIS codés en dur.
 *  - T-02-13 : stats.errors = message normalisé only, jamais de valeur de clé.
 *  - T-03-14 : FundamentalContextSchema.parse AVANT upsert (fail fast sur dérive §3).
 *  - WR-04 : 0 produit + erreurs → throw, pas de succès silencieux.
 *  - D-07 : service-client jamais importé depuis le barrel @app/supabase.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import {
  snapshotContentHash,
  FundamentalContextSchema,
  type FundamentalContext,
} from '@app/indicators'
import { getAssetDrivers, listActiveInstruments, upsertSnapshot } from '@app/supabase'
import type {
  Json,
  Database,
  MacroSeriesRow,
  AssetDriverRow,
  SnapshotInsert,
} from '@app/supabase'

export type Style = 'day' | 'swing'

// ─── Codes FRED → rôle économique (D-38) ──────────────────────────────────────
//   DTWEXBGS = proxy DXY (dollar trade-weighted), DFII10 = real yields 10y,
//   DFF = federal funds rate. Codes pinés par golden test.
const SERIES_DXY = 'DTWEXBGS'
const SERIES_REAL_YIELDS = 'DFII10'
const SERIES_FED_FUNDS = 'DFF'

// Seuil de variation relative au-delà duquel une série est jugée "en mouvement"
// (sous ce seuil = plat/neutre). Constante nommée pinée par golden test.
const TREND_EPSILON = 0.001 // 0.1 %

// ─── Logique pure (D-23, testable hors-ligne) ─────────────────────────────────

type Direction = 'up' | 'down' | 'flat'

/**
 * Tendance d'une série macro : compare la dernière observation à la première
 * de la fenêtre fournie. Variation relative < TREND_EPSILON → 'flat'.
 * Les observations sont supposées triées chronologiquement (asc).
 */
function seriesDirection(rows: readonly MacroSeriesRow[]): Direction {
  if (rows.length < 2) return 'flat'
  const first = rows[0]!.value
  const last = rows.at(-1)!.value
  if (first === 0) return last > 0 ? 'up' : last < 0 ? 'down' : 'flat'
  const change = (last - first) / Math.abs(first)
  if (change > TREND_EPSILON) return 'up'
  if (change < -TREND_EPSILON) return 'down'
  return 'flat'
}

/** Filtre + tri chronologique des observations d'une série donnée. */
function seriesOf(macro: readonly MacroSeriesRow[], code: string): MacroSeriesRow[] {
  return macro.filter((r) => r.series_code === code).sort((a, b) => (a.ts < b.ts ? -1 : 1))
}

/** Libellé directionnel lisible pour dxy_trend / real_yields. */
function trendLabel(dir: Direction): string {
  return dir === 'up' ? 'rising' : dir === 'down' ? 'falling' : 'flat'
}

/**
 * Règle macro_bias (D-38) : DXY + real_yields montent ensemble → risk_off ;
 * descendent ensemble → risk_on ; signaux divergents → neutral.
 */
function deriveMacroBias(dxy: Direction, realYields: Direction): FundamentalContext['macro_bias'] {
  if (dxy === 'up' && realYields === 'up') return 'risk_off'
  if (dxy === 'down' && realYields === 'down') return 'risk_on'
  return 'neutral'
}

/**
 * Règle rate_environment (D-38) : DFF en hausse récente → hawkish ;
 * en baisse → dovish ; plat → neutral.
 */
function deriveRateEnvironment(fedFunds: Direction): FundamentalContext['rate_environment'] {
  if (fedFunds === 'up') return 'hawkish'
  if (fedFunds === 'down') return 'dovish'
  return 'neutral'
}

/**
 * Fonction pure : dérive un fundamental_context §3 depuis les séries macro FRED
 * et les drivers par actif (lus en table, jamais codés en dur — D-38).
 *
 * @param macroSeries - observations macro (toutes séries confondues, non triées OK)
 * @param assetDrivers - drivers de l'actif depuis asset_drivers ([] si aucun)
 */
export function deriveFundamentalContext(
  macroSeries: readonly MacroSeriesRow[],
  assetDrivers: readonly AssetDriverRow[],
): FundamentalContext {
  const dxyDir = seriesDirection(seriesOf(macroSeries, SERIES_DXY))
  const realYieldsDir = seriesDirection(seriesOf(macroSeries, SERIES_REAL_YIELDS))
  const fedFundsDir = seriesDirection(seriesOf(macroSeries, SERIES_FED_FUNDS))

  // asset_specific_drivers : un libellé par driver de la table (data-not-code).
  // ex. or → ['DXY(-1)', 'REAL_YIELDS(-1)'] ; vide si l'actif n'a aucun driver.
  const assetSpecificDrivers = [...assetDrivers]
    .sort((a, b) => (a.driver_code < b.driver_code ? -1 : 1))
    .map((d) => `${d.driver_code}(${d.direction > 0 ? '+' : ''}${d.direction})`)

  return {
    macro_bias: deriveMacroBias(dxyDir, realYieldsDir),
    rate_environment: deriveRateEnvironment(fedFundsDir),
    dxy_trend: trendLabel(dxyDir),
    real_yields: trendLabel(realYieldsDir),
    asset_specific_drivers: assetSpecificDrivers,
  }
}

// ─── IO : client + lecture macro_series ────────────────────────────────────────

type ServiceClient = ReturnType<typeof createClient<Database>>

function getServiceClient(): ServiceClient {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'fundamental-engine: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Codes FRED pertinents pour le contexte fondamental (limite la lecture en base).
const RELEVANT_SERIES = [SERIES_DXY, SERIES_REAL_YIELDS, SERIES_FED_FUNDS] as const

// Fenêtre d'observations macro lue (suffisante pour juger la tendance récente).
const MACRO_WINDOW = 90 // ~90 dernières observations par série

/**
 * Lit les observations macro pertinentes (DXY/real_yields/DFF) sur la fenêtre récente.
 * @returns observations toutes séries confondues, ts ascendant.
 */
async function readMacroSeries(client: ServiceClient): Promise<MacroSeriesRow[]> {
  const { data, error } = await client
    .from('macro_series')
    .select('*')
    .in('series_code', RELEVANT_SERIES as unknown as string[])
    .order('ts', { ascending: false })
    .limit(MACRO_WINDOW * RELEVANT_SERIES.length)
  if (error) {
    throw new Error(`readMacroSeries failed: ${error.message}`)
  }
  // Remettre en ordre chronologique ascendant pour seriesDirection.
  return (data ?? []).slice().sort((a, b) => (a.ts < b.ts ? -1 : 1))
}

// ─── Job principal ──────────────────────────────────────────────────────────��─

const STYLES: Style[] = ['day', 'swing']
const TIMEFRAME_SET: Record<Style, string> = { day: 'macro', swing: 'macro' }

/**
 * Job fundamental-engine : pour chaque instrument actif × style, dérive et persiste
 * un fundamental_context §3 déterministe. Isolé par instrument (Pitfall 5).
 * Le contexte macro est commun ; seuls les asset_specific_drivers varient par actif.
 */
export async function fundamentalEngine(): Promise<Json> {
  const stats = {
    inserted: 0,
    skipped: 0,
    errors: [] as Array<{ instrument: string; msg: string }>,
  }

  const client = getServiceClient()
  const macro = await readMacroSeries(client)

  // computed_for_ts = ts de la dernière observation macro pertinente (commune).
  const latestMacroTs = macro.at(-1)?.ts ?? null
  if (latestMacroTs === null) {
    // Aucune donnée macro en base → rien à dériver (pas de crash, skip global).
    return stats as Json
  }

  const instruments = await listActiveInstruments(client)

  for (const instrument of instruments) {
    try {
      const drivers = await getAssetDrivers(client, instrument.id)
      const context = deriveFundamentalContext(macro, drivers)

      // T-03-14 : valider §3 AVANT persist (fail fast sur dérive de forme).
      const validated = FundamentalContextSchema.parse(context)
      const payload = validated as unknown as Json
      const contentHash = snapshotContentHash(payload)

      for (const style of STYLES) {
        const row: SnapshotInsert = {
          instrument_id: instrument.id,
          style,
          timeframe_set: TIMEFRAME_SET[style],
          kind: 'fundamental',
          computed_for_ts: latestMacroTs,
          content_hash: contentHash,
          payload,
          partial: false,
        }
        await upsertSnapshot(client, row)
        stats.inserted++
      }
    } catch (err) {
      // T-02-13 : message normalisé uniquement, jamais la valeur de clé.
      stats.errors.push({
        instrument: instrument.symbol,
        msg: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // WR-04 : 0 produit total + erreurs → échec, pas de succès silencieux.
  if (stats.inserted === 0 && stats.errors.length > 0) {
    throw new Error(
      `fundamental-engine: 0 snapshot produit sur ${stats.errors.length} erreur(s) — ${stats.errors[0]?.msg ?? 'voir stats.errors'}`,
    )
  }

  return stats as Json
}
