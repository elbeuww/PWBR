/**
 * persist — FRONTIÈRE DE CONFIANCE UNIQUE (D-43, SCORE-04/05).
 *
 * Seul point où la sortie qualitative NON FIABLE de l'agent devient une donnée
 * vérifiée et immuable. Aucun autre chemin d'écriture n'existe (l'agent écrit des
 * FICHIERS ; seul persist — service_role — insère, D-43 / T-04-07).
 *
 * Pipeline par artefact (calque technical-engine.ts : boucle isolée, Zod avant
 * upsert, stats normalisées, throw si 0 produit + erreurs) :
 *   a. stripFence + JSON.parse défensif        ──► rejet 'json_parse'
 *   b. OutputSchema.parse (Zod v4 §3)           ──► rejet 'zod_shape'
 *   c. getSnapshotByHash(raw_indicators_ref)    ──► rejet 'snapshot_not_found'
 *   d. runGuardrails (R:R, cohérence SL/TP, structure_against, alloc) ──► rejet code §3
 *   e. scoreSetup (D-42/46/48) + snapshot.partial → risk relevé (D-44, concern #4)
 *   f. expirePriorSetups (clé session_day, D-45) AVANT insert → insertAnalysis →
 *      insertTradeSetups (status='active', valid_until 24/72h)
 *   g. stats { written, rejected, reasons[normalisés] } → job_runs.stats (T-02-13)
 *
 * Sécurité :
 *  - run_id sanitisé dans runArtifacts.ts (anti path traversal, T-04-15).
 *  - stats.reasons = CODES normalisés uniquement, jamais une valeur de prix/clé
 *    (T-02-13, Pitfall 4) — testé.
 *  - aucune UPDATE des champs d'analyse (immuabilité SCORE-05) ; seul `status`
 *    transitionne via expirePriorSetups.
 *  - JSON non conforme → rejet + raison loggée, PAS de retry en P1.
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import {
  OutputSchema,
  scoreSetup,
  computeRiskReward,
  type Output,
  type CombinedSnapshot,
  type ScoreResult,
} from '@app/core'
import {
  getSnapshotByHash,
  insertAnalysis,
  insertTradeSetups,
  expirePriorSetups,
} from '@app/supabase'
import type {
  Json,
  Database,
  SnapshotRow,
  TradeSetupInsert,
  AnalysisInsert,
} from '@app/supabase'
import { readRunArtifacts } from './runArtifacts.js'

// ─── Constantes nommées (data-not-magic) ──────────────────────────────────────

/** Durée de validité d'un setup `day` (concern revue #3). */
export const DAY_VALID_HOURS = 24
/** Durée de validité d'un setup `swing` (concern revue #3). */
export const SWING_VALID_HOURS = 72
/** R:R minimum (règle dure §3) en dessous duquel un setup est rejeté. */
export const MIN_RR = 1.2

/** Chemin par défaut du prompt vétéran versionné (relatif à ce module). */
export const VETERAN_PROMPT_PATH = fileURLToPath(
  new URL('../../prompts/veteran.md', import.meta.url),
)

/**
 * prompt_version traçable (D-51, T-04-10) = `${semver front-matter}+${sha256(fichier)}`.
 *
 * Le semver (front-matter `version:`) reste lisible ; le sha256 du fichier ENTIER
 * rend la version infalsifiable (toute édition du prompt change le hash). On NE
 * réinvente JAMAIS de hash maison : node:crypto sha256 builtin.
 *
 * Lève si le front-matter `version:` est absent (pas de version silencieuse).
 *
 * @param promptPath chemin du fichier prompt (défaut : veteran.md).
 */
export function computePromptVersion(promptPath: string = VETERAN_PROMPT_PATH): string {
  const content = readFileSync(promptPath, 'utf8')
  const match = /^version:\s*(.+)$/m.exec(content)
  if (!match?.[1]) {
    throw new Error(`computePromptVersion: front-matter 'version:' absent dans ${path.basename(promptPath)}`)
  }
  const semver = match[1].trim()
  const hash = createHash('sha256').update(content).digest('hex')
  return `${semver}+${hash}`
}

/** Codes de rejet normalisés (T-02-13) — jamais de valeur de clé dans les logs. */
export type RejectReason =
  | 'json_parse'
  | 'zod_shape'
  | 'snapshot_not_found'
  | 'rr_below_min'
  | 'sl_coherence'
  | 'tp_bounds'
  | 'structure_against'
  | 'insert_error'

// ─── Logique pure (testable hors-ligne) ───────────────────────────────────────

/** Retire un éventuel fence markdown ```json ... ``` autour du JSON brut. */
export function stripFence(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('```')) return trimmed
  // Retire la première ligne (``` ou ```json) et le fence de fin.
  const withoutOpen = trimmed.replace(/^```[a-zA-Z]*\s*\n?/, '')
  return withoutOpen.replace(/\n?```$/, '').trim()
}

/** Prix d'entrée conservateur selon la direction (miroir rr.ts / score.ts, D-50). */
export function conservativeEntry(output: Output): number {
  const [zMin, zMax] = output.entry.zone
  return output.direction === 'long' ? zMax : zMin
}

/**
 * Direction structurelle EFFECTIVE déduite de `bos_choch` + `trend_ltf`.
 *
 * Le modèle §3 ne porte PAS la direction dans `bos_choch` ('bos'|'choch'|null) :
 *  - BOS  = cassure dans le SENS de la tendance LTF établie (continuation).
 *  - CHoCH = cassure CONTRE la tendance LTF établie (retournement précoce).
 * On en déduit le sens de la cassure ; null/range ⇒ pas de signal directionnel.
 */
export function structureDirection(t: CombinedSnapshot['technical']): 'long' | 'short' | null {
  const sig = t.structure.bos_choch
  if (sig === null) return null
  const ltf = t.trend_ltf
  if (ltf === 'range') return null
  const trendDir: 'long' | 'short' = ltf === 'bullish' ? 'long' : 'short'
  const opposite: 'long' | 'short' = trendDir === 'long' ? 'short' : 'long'
  // BOS continue la tendance ; CHoCH la retourne.
  return sig === 'bos' ? trendDir : opposite
}

export interface GuardrailResult {
  rejected: boolean
  reason?: RejectReason
  /** Entrée conservatrice (= colonne entry_price, dualité — concern archi). */
  entryCons: number
  /** R:R global recalculé sur le bord conservateur (D-50). */
  rrGlobal: number
  /** R:R par TP (alimente take_profits jsonb). */
  perTp: Array<{ price: number; alloc_pct: number; rr: number }>
}

/**
 * Garde-fous déterministes §3 (D). PUR, testable séparément. Recalcule le R:R sur
 * le bord conservateur (anti-surestimation), vérifie la cohérence SL/entry/TP par
 * direction, la borne TP (1–3 + alloc=100), et REJETTE si la structure cassée
 * contredit la direction du trade (règle dure §3 — concern quality [HIGH]).
 */
export function runGuardrails(output: Output, snapshot: SnapshotRow): GuardrailResult {
  const entryCons = conservativeEntry(output)
  const t = (snapshot.payload as unknown as CombinedSnapshot).technical

  // computeRiskReward peut throw 'zero_sl_distance' → traité comme sl_coherence.
  let rr: ReturnType<typeof computeRiskReward>
  try {
    rr = computeRiskReward(output)
  } catch {
    return { rejected: true, reason: 'sl_coherence', entryCons, rrGlobal: 0, perTp: [] }
  }

  const base = { entryCons, rrGlobal: rr.global, perTp: rr.perTp }

  // Borne TP : 1–3 (déjà borné par Zod) + somme alloc_pct = 100 (rejet, pas borne silencieuse).
  const allocSum = output.take_profits.reduce((s, tp) => s + tp.alloc_pct, 0)
  if (allocSum !== 100) {
    return { rejected: true, reason: 'tp_bounds', ...base }
  }

  // Cohérence SL / entrée conservatrice / TP par direction.
  if (output.direction === 'long') {
    const ok =
      output.stop_loss < entryCons && output.take_profits.every((tp) => tp.price > entryCons)
    if (!ok) return { rejected: true, reason: 'sl_coherence', ...base }
  } else {
    const ok =
      output.stop_loss > entryCons && output.take_profits.every((tp) => tp.price < entryCons)
    if (!ok) return { rejected: true, reason: 'sl_coherence', ...base }
  }

  // Structure cassée CONTRE le trade (règle dure §3).
  const structDir = structureDirection(t)
  if (structDir !== null && structDir !== output.direction) {
    return { rejected: true, reason: 'structure_against', ...base }
  }

  // Règle dure §3 : R:R global recalculé < seuil → rejet.
  if (rr.global < MIN_RR) {
    return { rejected: true, reason: 'rr_below_min', ...base }
  }

  return { rejected: false, ...base }
}

/** Relève le risk_level d'un cran (jamais 'low'), pour snapshot.partial (D-44, concern #4). */
export function raiseRisk(level: ScoreResult['risk_level']): ScoreResult['risk_level'] {
  const next: Record<ScoreResult['risk_level'], ScoreResult['risk_level']> = {
    low: 'medium',
    medium: 'high',
    high: 'extreme',
    extreme: 'extreme',
  }
  return next[level]
}

/** session_day déterministe = jour UTC de generated_at (concern #1, jamais de glissement TZ). */
export function sessionDayOf(generatedAt: string): string {
  const d = DateTime.fromISO(generatedAt, { zone: 'utc' }).toISODate()
  if (d === null) throw new Error('invalid_generated_at')
  return d
}

/** valid_until via luxon (jamais `Date` maison, T-03-17). */
export function validUntilOf(generatedAt: string, style: string): string {
  const hours = style === 'swing' ? SWING_VALID_HOURS : DAY_VALID_HOURS
  const dt = DateTime.fromISO(generatedAt, { zone: 'utc' }).plus({ hours })
  const iso = dt.toISO()
  if (iso === null) throw new Error('invalid_generated_at')
  return iso
}

// ─── IO : client service_role (lazy local, D-07) ──────────────────────────────

type ServiceClient = ReturnType<typeof createClient<Database>>

function getServiceClient(): ServiceClient {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error('persist: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ─── Job principal ─────────────────────────────────────────────────────────���──

interface PersistStats {
  written: number
  rejected: number
  reasons: string[]
}

/**
 * Frontière de confiance : lit les artefacts du run, valide/score/persiste
 * immuablement ou rejette+log (codes normalisés). Throw si 0 écrit + des rejets
 * (WR-04 / Pitfall 6 — pas de succès silencieux).
 */
export async function persist(): Promise<Json> {
  const runId = process.env['RUN_ID']
  if (!runId) {
    throw new Error('persist: RUN_ID must be set (résolu/exporté par l\'ANALYZE en 04-04)')
  }
  const model = process.env['MODEL_LABEL'] ?? 'claude-code-max'
  // prompt_version traçable (D-51) : l'ANALYZE l'exporte ; sinon on le calcule depuis
  // veteran.md (semver front-matter + sha256 du fichier) — jamais de fallback opaque.
  const promptVersion = process.env['PROMPT_VERSION'] ?? computePromptVersion()

  const client = getServiceClient()
  const stats: PersistStats = { written: 0, rejected: 0, reasons: [] }

  const reject = (reason: RejectReason): void => {
    stats.rejected++
    stats.reasons.push(reason) // CODE normalisé uniquement (T-02-13).
  }

  for (const artifact of readRunArtifacts(runId)) {
    try {
      // (a) parse défensif
      let parsed: unknown
      try {
        parsed = JSON.parse(stripFence(artifact.raw))
      } catch {
        reject('json_parse')
        continue
      }

      // (b) Zod §3
      const outputResult = OutputSchema.safeParse(parsed)
      if (!outputResult.success) {
        reject('zod_shape')
        continue
      }
      const output: Output = outputResult.data

      // (c) résoudre le snapshot exact
      const snapshot = await getSnapshotByHash(client, output.raw_indicators_ref)
      if (!snapshot) {
        reject('snapshot_not_found')
        continue
      }

      // (d) garde-fous déterministes
      const guard = runGuardrails(output, snapshot)
      if (guard.rejected) {
        reject(guard.reason!)
        continue
      }

      // (e) scoring déterministe (jamais le score de l'agent)
      const combined = snapshot.payload as unknown as CombinedSnapshot
      const scored = scoreSetup(combined, output, output.style, {
        now: output.generated_at,
      })
      // snapshot.partial → risk relevé (D-44 : on conserve tout pour calibration,
      // pas de rejet), jamais 'low' si partial.
      const riskLevel = snapshot.partial ? raiseRisk(scored.risk_level) : scored.risk_level

      // (f) immuabilité : expirer AVANT insert (clé session_day, D-45)
      const sessionDay = sessionDayOf(output.generated_at)
      await expirePriorSetups(client, {
        instrument_id: snapshot.instrument_id,
        style: output.style,
        session: output.session,
        session_day: sessionDay,
      })

      const analysisRow: AnalysisInsert = {
        run_id: runId,
        session: output.session,
        style: output.style,
        instrument_id: snapshot.instrument_id,
        snapshot: snapshot.payload,
        model,
        prompt_version: promptVersion,
        schema_version: output.schema_version,
      }
      const { id: analysisId } = await insertAnalysis(client, analysisRow)

      const setupRow: TradeSetupInsert = {
        analysis_id: analysisId,
        instrument_id: snapshot.instrument_id,
        style: output.style,
        session: output.session,
        session_day: sessionDay,
        direction: output.direction,
        opportunity_score: scored.opportunity_score,
        risk_level: riskLevel,
        confidence: scored.confidence,
        // dualité : colonne = bord conservateur ; payload.entry.price = médian agent inchangé.
        entry_price: guard.entryCons,
        stop_loss: output.stop_loss,
        take_profits: guard.perTp as unknown as Json,
        risk_reward: guard.rrGlobal,
        payload: output as unknown as Json,
        status: 'active',
        valid_until: validUntilOf(output.generated_at, output.style),
      }
      await insertTradeSetups(client, [setupRow])

      stats.written++
    } catch (err) {
      // Erreur inattendue (IO DB, etc.) → rejet normalisé isolé (Pitfall 5 : un
      // artefact défaillant ne crash pas le run). Code seul, jamais de valeur.
      reject('insert_error')
      void err
    }
  }

  // WR-04 / Pitfall 6 : 0 écrit + des rejets → échec, pas de succès silencieux.
  if (stats.written === 0 && stats.rejected > 0) {
    throw new Error(`persist: 0 setup écrit sur ${stats.rejected} rejet(s)`)
  }

  return stats as unknown as Json
}
