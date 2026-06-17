/**
 * Job combine-engine — TROU #2 du pipeline (OPTION A, D-30).
 *
 * Assemble, par instrument × style, les 3 derniers snapshots SÉPARÉS
 * (kind technical/fundamental/news) en UN snapshot kind='combined' dont le
 * payload = { technical, fundamental, news } (forme CombinedSnapshot §3).
 * C'est le maillon manquant entre les 3 engines et `persist` : sans lui,
 * `persist`/`runGuardrails`/`scoreSetup` lisent `payload.technical` undefined
 * → « 0 setup écrit ».
 *
 * Conventions (miroir technical-engine / outcome-tracker) :
 *  - D-23 : logique PURE (buildCombinedPayload, pickTriplet) séparée de l'IO.
 *  - D-44 : content_hash via snapshotContentHash (@app/indicators), JAMAIS maison.
 *  - Cohérence temporelle : combiner UNIQUEMENT un triplet COMPLET partageant
 *    (instrument_id, style) ; ancrage du combined sur le snapshot TECHNICAL
 *    (computed_for_ts ancré sur une bougie réelle, anti look-ahead). JAMAIS now(),
 *    jamais latestMacroTs, jamais un kind fabriqué.
 *  - Triplet incomplet → skip + log (missing kinds), jamais combiné.
 *  - T-02-13 : stats.errors = message normalisé only, jamais une valeur de clé.
 *  - Pitfall 5 : per-instrument try/catch isolé.
 *  - WR-04 : 0 produit + erreurs → throw, pas de succès silencieux.
 *  - D-07 : service-client jamais importé depuis le barrel @app/supabase.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { snapshotContentHash } from '@app/indicators'
import { getLatestSnapshotsByKind, upsertSnapshot, listActiveInstruments } from '@app/supabase'
import type { Json, Database, SnapshotInsert } from '@app/supabase'
import type { CombinedSnapshot } from '@app/core'

export type Style = 'day' | 'swing'

// ─── Logique pure (D-23, testable hors-ligne) ─────────────────────────────────

/**
 * Assemble les 3 payloads §3 en un CombinedSnapshot { technical, fundamental, news }.
 * Pur, zéro IO. L'ordre d'insertion des clés top-level n'affecte PAS le hash
 * (snapshotContentHash trie récursivement, D-44).
 */
export function buildCombinedPayload(
  technical: CombinedSnapshot['technical'],
  fundamental: CombinedSnapshot['fundamental'],
  news: CombinedSnapshot['news'],
): CombinedSnapshot {
  return { technical, fundamental, news }
}

/** Triplet de valeurs (snapshots, payloads…) une par kind séparé. */
export interface KindTriplet<T> {
  technical: T | null
  fundamental: T | null
  news: T | null
}

/** Résultat de la décision de cohérence : complet (ok) ou kinds manquants. */
export type TripletDecision = { ok: true } | { ok: false; missing: string[] }

/**
 * Décide si un triplet est COMPLET (les 3 kinds présents). Sépare la cohérence
 * temporelle de l'IO pour la testabilité (D-23). Ne fabrique jamais un kind.
 * @returns {ok:true} si les 3 présents, sinon {ok:false, missing:[kinds absents]}.
 */
export function pickTriplet<T>(latest: KindTriplet<T>): TripletDecision {
  const missing: string[] = []
  if (latest.technical === null) missing.push('technical')
  if (latest.fundamental === null) missing.push('fundamental')
  if (latest.news === null) missing.push('news')
  return missing.length === 0 ? { ok: true } : { ok: false, missing }
}

// ─── IO : client service_role lazy ────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'combine-engine: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ─── Job principal ──────────────────────────────────────────────────────────────

const STYLES: Style[] = ['day', 'swing']

/**
 * Job combine-engine : pour chaque instrument actif × style, lit le dernier
 * snapshot de chaque kind séparé, et — si le triplet est COMPLET — assemble un
 * snapshot 'combined' ancré sur le computed_for_ts/timeframe_set du TECHNICAL,
 * puis l'upserte (idempotent onConflict). Triplet incomplet → skip + log.
 */
export async function combineEngine(): Promise<Json> {
  const stats = {
    inserted: 0,
    skipped: 0,
    errors: [] as Array<{ instrument: string; msg: string }>,
  }

  const client = getServiceClient()
  const instruments = await listActiveInstruments(client)

  for (const instrument of instruments) {
    try {
      for (const style of STYLES) {
        const latest = await getLatestSnapshotsByKind(client, instrument.id, style)
        const decision = pickTriplet(latest)

        if (!decision.ok) {
          // Cohérence temporelle critique : jamais combiner un triplet incomplet.
          stats.skipped++
          stats.errors.push({
            instrument: instrument.symbol,
            msg: `missing kinds: ${decision.missing.join(',')}`,
          })
          continue
        }

        // Triplet complet — assemblage non-null garanti par pickTriplet.
        const technical = latest.technical!
        const fundamental = latest.fundamental!
        const news = latest.news!

        const payloadObj = buildCombinedPayload(
          technical.payload as unknown as CombinedSnapshot['technical'],
          fundamental.payload as unknown as CombinedSnapshot['fundamental'],
          news.payload as unknown as CombinedSnapshot['news'],
        )
        const payload = payloadObj as unknown as Json

        // Ancrage sur le TECHNICAL (bougie réelle, anti look-ahead) — jamais now().
        const row: SnapshotInsert = {
          instrument_id: instrument.id,
          style,
          timeframe_set: technical.timeframe_set,
          kind: 'combined',
          computed_for_ts: technical.computed_for_ts,
          content_hash: snapshotContentHash(payload),
          payload,
          partial: technical.partial || fundamental.partial || news.partial,
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
      `combine-engine: 0 combined produit sur ${stats.errors.length} erreur(s) — ${stats.errors[0]?.msg ?? 'voir stats.errors'}`,
    )
  }

  return stats as Json
}
