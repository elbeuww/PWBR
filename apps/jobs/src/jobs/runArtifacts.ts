/**
 * readRunArtifacts — lecture sécurisée des fichiers JSON produits par l'ANALYZE
 * (concern revue #2 HIGH — anti path traversal sur run_id, T-04-15).
 *
 * L'ANALYZE (04-04) écrit un fichier par (instrument × style) sous
 * `run-artifacts/<run_id>/<instrument>_<style>.json`. `run_id` provient de
 * l'environnement (process.env['RUN_ID']) — donc UNTRUSTED jusqu'à validation.
 *
 * Défense en profondeur (3 couches) :
 *  1. `RUN_ID_RE` = format strict `<session>-<YYYYMMDD>T<HHmm>Z` (regex allow-list).
 *  2. `path.resolve` + assertion `startsWith(RUN_ARTIFACTS_DIR + path.sep)` :
 *     même si la regex laissait passer un cas tordu, le chemin résolu DOIT rester
 *     sous le répertoire de base (anti `../`).
 *  3. chaque basename de fichier est re-validé (pas de séparateur, suffixe .json).
 *
 * Liste vide = `throw 'no_artifacts'` (concern security [LOW]) : un répertoire
 * valide mais sans fichier n'est JAMAIS un succès silencieux.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** Répertoire racine des artefacts de run (créé par l'ANALYZE en 04-04). */
export const RUN_ARTIFACTS_DIR = path.resolve(process.cwd(), 'run-artifacts')

/** Format strict d'un run_id : `<session>-<YYYYMMDD>T<HHmm>Z` (ex. london-20260614T0700Z). */
export const RUN_ID_RE = /^[a-z]+-\d{8}T\d{4}Z$/

export interface RunArtifact {
  /** Symbole d'instrument extrait du nom de fichier (ex. EURUSD). */
  instrument: string
  /** Style extrait du nom de fichier (day | swing). */
  style: string
  /** Contenu brut du fichier (non parsé — la frontière persist.ts parse + valide). */
  raw: string
}

/**
 * Liste et lit les artefacts JSON d'un run, après sanitisation stricte du run_id.
 *
 * @throws Error('invalid_run_id') si le run_id échoue la regex OU si le chemin
 *         résolu sort de RUN_ARTIFACTS_DIR (path traversal), OU si un basename
 *         contient un séparateur de chemin.
 * @throws Error('no_artifacts') si le répertoire ne contient aucun `*.json`.
 */
export function readRunArtifacts(runId: string): RunArtifact[] {
  // Couche 1 : allow-list de forme.
  if (!RUN_ID_RE.test(runId)) {
    throw new Error('invalid_run_id')
  }

  // Couche 2 : confinement du chemin résolu sous le répertoire de base.
  const dir = path.resolve(RUN_ARTIFACTS_DIR, runId)
  if (!dir.startsWith(RUN_ARTIFACTS_DIR + path.sep)) {
    throw new Error('invalid_run_id')
  }

  const entries = readdirSync(dir)
  const artifacts: RunArtifact[] = []

  for (const name of entries) {
    if (!name.endsWith('.json')) continue
    // Couche 3 : un basename légitime ne contient aucun séparateur de chemin.
    if (name.includes('/') || name.includes('\\')) {
      throw new Error('invalid_run_id')
    }

    const base = name.slice(0, -'.json'.length)
    const sep = base.lastIndexOf('_')
    // Nom attendu : <instrument>_<style>.json. Un nom non conforme est ignoré
    // (ne casse pas le run ; il sera invisible côté frontière).
    if (sep <= 0 || sep >= base.length - 1) continue

    const instrument = base.slice(0, sep)
    const style = base.slice(sep + 1)
    const raw = readFileSync(path.join(dir, name), 'utf8')
    artifacts.push({ instrument, style, raw })
  }

  // Liste vide = échec explicite, jamais succès silencieux.
  if (artifacts.length === 0) {
    throw new Error('no_artifacts')
  }

  return artifacts
}
