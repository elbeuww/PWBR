/**
 * Client FairEconomy — calendrier économique via fetch+Zod maison (SANS clé API).
 *
 * Source : https://nfs.faireconomy.media/ff_calendar_thisweek.json
 * Format : [{ title, country, date (ISO), impact (High|Medium|Low), forecast, previous }]
 *
 * T-02-08 : schéma Zod tolérant (flux communautaire A3) — champs inattendus ignorés.
 * T-02-09 : aucune clé API (FairEconomy ne requiert pas d'auth).
 * Pitfall 5 : rate limit 2 téléchargements/5min — cache en mémoire, re-fetch 1×/jour max.
 *
 * Stratégie de cache (in-process, durée 24h) :
 *   Un timestamp de dernier fetch est conservé en mémoire. Si moins de 24h
 *   se sont écoulées depuis le dernier fetch réussi, le cache est retourné.
 *   Cache réinitialisé au redémarrage du process (job cron quotidien = acceptable).
 *   Pour un cache multi-process ou persistant : stocker en DB (hors scope plan 03).
 *
 * Référence : nfs.faireconomy.media (ForexFactory public JSON feed)
 */
import { z } from 'zod'
import { createHash } from 'crypto'
import { DateTime } from 'luxon'
import type { EconomicCalendarInsert } from '@app/supabase'

const FAIR_ECONOMY_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'

// Durée de cache : 24h en millisecondes (Pitfall 5 : re-fetch 1×/jour max)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

// Cache in-process (singleton par process — reset au redémarrage)
let _cache: { data: EconomicCalendarInsert[]; fetchedAt: number } | null = null

// Schéma d'un event FairEconomy — TOLÉRANT (A3 : flux communautaire)
// z.object().passthrough() = champs inattendus ignorés sans erreur
const FairEconomyEventSchema = z
  .object({
    title: z.string(),
    country: z.string().nullable().optional(),
    date: z.string(), // ISO (ex: "2026-06-06T12:30:00+00:00")
    impact: z.enum(['High', 'Medium', 'Low']).nullable().optional(),
    forecast: z.string().nullable().optional(),
    previous: z.string().nullable().optional(),
  })
  .passthrough() // Champs inattendus ignorés — schéma tolérant T-02-08

const FairEconomyCalendarSchema = z.array(FairEconomyEventSchema)

/**
 * Dérive un event_key déterministe depuis title|country|date (sha256 hex).
 * Même événement => même clé, toujours. Permet la déduplication upsert.
 */
function deriveEventKey(title: string, country: string | null | undefined, date: string): string {
  const raw = `${title}|${country ?? ''}|${date}`
  return createHash('sha256').update(raw).digest('hex')
}

/**
 * Télécharge le calendrier FairEconomy avec cache in-process 24h.
 * Retourne EconomicCalendarInsert[] normalisés.
 *
 * Pitfall 5 : ne re-fetch que si le cache a plus de 24h ou est absent.
 */
export async function fetchFairEconomyCalendar(): Promise<EconomicCalendarInsert[]> {
  const now = Date.now()

  // Retourner le cache si encore valide (< 24h)
  if (_cache !== null && now - _cache.fetchedAt < CACHE_TTL_MS) {
    return _cache.data
  }

  const res = await fetch(FAIR_ECONOMY_URL, {
    headers: {
      // User-agent poli — éviter un éventuel blocage bot
      'User-Agent': 'Mozilla/5.0 (compatible; trading-platform/1.0)',
    },
  })

  if (!res.ok) {
    throw new Error(`FairEconomy: HTTP ${res.status} ${res.statusText}`)
  }

  const json: unknown = await res.json()
  const data = parseFairEconomyCalendar(json)

  // Mettre à jour le cache in-process
  _cache = { data, fetchedAt: now }

  return data
}

/**
 * Parse la réponse FairEconomy brute et normalise en EconomicCalendarInsert[].
 *
 * event_key déterministe (sha256 hex de title|country|date).
 * event_at ISO UTC depuis la date ISO fournie.
 * impact validé dans l'enum High|Medium|Low (Zod).
 * Schéma tolérant : champs inattendus ignorés (A3, T-02-08).
 *
 * @param raw - Réponse JSON brute FairEconomy (unknown)
 * @returns EconomicCalendarInsert[] normalisés UTC
 */
export function parseFairEconomyCalendar(raw: unknown): EconomicCalendarInsert[] {
  const parsed = FairEconomyCalendarSchema.parse(raw)

  return parsed.map((event): EconomicCalendarInsert => {
    // Normaliser la date ISO en UTC
    const dt = DateTime.fromISO(event.date, { zone: 'utc' })
    const eventAt = dt.toISO()
    if (!eventAt) {
      throw new Error(`parseFairEconomyCalendar: invalid date "${event.date}"`)
    }

    return {
      source: 'faireconomy',
      event_key: deriveEventKey(event.title, event.country, event.date),
      title: event.title,
      country: event.country ?? null,
      event_at: eventAt,
      impact: event.impact ?? null,
      forecast: event.forecast ?? null,
      previous: event.previous ?? null,
    } satisfies EconomicCalendarInsert
  })
}
