/**
 * Job heartbeat — job pilote de santé
 *
 * Retourne { ok: true, ts: ISO } pour prouver que le runner est opérationnel.
 * Utilisé par dispatch.ts pour valider le pipeline bout-en-bout.
 *
 * Source : 01-RESEARCH.md §Code Examples §Dispatcher
 */

import type { Json } from '@app/supabase'

export async function heartbeat(): Promise<Json> {
  return {
    ok: true,
    ts: new Date().toISOString(),
  }
}
