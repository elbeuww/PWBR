/**
 * Re-export mince de la lecture des agrégats track record (TRACK-03).
 *
 * La requête vit désormais en @app/supabase (source unique partagée vitrine ↔
 * job Telegram, D-49) — voir packages/supabase/src/repositories/patternStats.ts.
 * Ce module préserve la surface d'import historique de la vitrine P5 sans
 * dupliquer le SELECT ni franchir la frontière app (jobs n'importera jamais
 * apps/web). Le service-client reste sous garde ESLint (D-07).
 */
export { getPatternStats } from '@app/supabase'
export type { PatternStatRow } from '@app/supabase'
