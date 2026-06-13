/**
 * Job news-engine — sentiment pondéré-décroissant + news_risk imminent → news_context §3.
 *
 * Troisième slice (FUND-02/03) : lit les news + le calendrier économique en base,
 * dérive net_sentiment (moyenne pondérée à décroissance temporelle, fenêtre alignée
 * au style — D-39), recent_catalysts, upcoming_events, et le flag news_risk
 * (event high-impact <2h day / <24h swing — D-40). Zod-valide, hashe, upserte.
 *
 * Conventions :
 *  - D-23 : logique pure (deriveNewsContext) avec `now` injectable pour testabilité.
 *  - D-24 : sentiment null (free tier) = absence, jamais un 0 pondéré faux.
 *  - D-39 : fenêtre day≈24h / swing≈7j, décroissance EWMA-like (half-life nommée).
 *  - D-40 : news_risk seuils <2h / <24h LOCKED, calculés via luxon (jamais Date maison).
 *  - T-02-13 : stats.errors = message normalisé only, jamais de valeur de clé.
 *  - T-03-14 : NewsContextSchema.parse AVANT upsert (fail fast sur dérive §3).
 *  - WR-04 : 0 produit + erreurs → throw, pas de succès silencieux.
 *  - D-07 : service-client jamais importé depuis le barrel @app/supabase.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import {
  snapshotContentHash,
  NewsContextSchema,
  type NewsContext,
} from '@app/indicators'
import { listActiveInstruments, upsertSnapshot } from '@app/supabase'
import type {
  Json,
  Database,
  NewsRow,
  EconomicCalendarRow,
  SnapshotInsert,
} from '@app/supabase'

export type Style = 'day' | 'swing'

// ─── Fenêtres + seuils par style (D-39 / D-40, LOCKED) ─────────────────────────
//   window_hours : largeur de la fenêtre de sentiment.
//   risk_hours   : un event high-impact en deçà → news_risk true.
const STYLE_PARAMS: Record<Style, { windowHours: number; riskHours: number }> = {
  day: { windowHours: 24, riskHours: 2 },
  swing: { windowHours: 24 * 7, riskHours: 24 },
}

// Demi-vie de la décroissance temporelle du sentiment (D-39).
// Une news vieille de HALF_LIFE_HOURS pèse moitié moins qu'une news instantanée.
const HALF_LIFE_HOURS = 12

// Impact considéré "fort" pour news_risk (D-40). Comparaison insensible à la casse.
const HIGH_IMPACT = 'high'

// Nombre de catalyseurs récents conservés dans le contexte.
const MAX_CATALYSTS = 5
// Nombre d'événements à venir conservés.
const MAX_UPCOMING = 5

// ─── Logique pure (D-23, testable hors-ligne) ─────────────────────────────────

/** Poids de décroissance exponentielle : 0.5 ^ (age_hours / HALF_LIFE_HOURS). */
function decayWeight(ageHours: number): number {
  return Math.pow(0.5, ageHours / HALF_LIFE_HOURS)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Fonction pure : dérive un news_context §3.
 *
 * @param news - news (toutes confondues) ; filtrées par instrument + fenêtre ici
 * @param calendar - événements economic_calendar (futurs + passés OK)
 * @param instrumentId - id de l'instrument cible (filtre instrument_ids)
 * @param style - 'day' | 'swing' (fenêtre + seuil news_risk)
 * @param now - instant de référence (injectable pour déterminisme)
 */
export function deriveNewsContext(
  news: readonly NewsRow[],
  calendar: readonly EconomicCalendarRow[],
  instrumentId: string,
  style: Style,
  now: DateTime,
): NewsContext {
  const { windowHours, riskHours } = STYLE_PARAMS[style]
  const windowStart = now.minus({ hours: windowHours })

  // News de l'instrument, dans la fenêtre, ts ascendant.
  const relevant = news
    .filter((n) => n.instrument_ids.includes(instrumentId))
    .filter((n) => {
      const ts = DateTime.fromISO(n.published_at, { zone: 'utc' })
      return ts.isValid && ts >= windowStart && ts <= now
    })
    .sort((a, b) => (a.published_at < b.published_at ? -1 : 1))

  // net_sentiment = moyenne pondérée par décroissance. Sentiment null = absence (D-24).
  let weightedSum = 0
  let weightTotal = 0
  for (const n of relevant) {
    if (n.sentiment === null) continue // free tier : absence, pas un 0 faux (D-24)
    const ts = DateTime.fromISO(n.published_at, { zone: 'utc' })
    const ageHours = now.diff(ts, 'hours').hours
    const w = decayWeight(ageHours)
    weightedSum += n.sentiment * w
    weightTotal += w
  }
  const netSentiment = weightTotal === 0 ? 0 : clamp(weightedSum / weightTotal, -1, 1)

  // recent_catalysts : titres les plus récents de la fenêtre.
  const recentCatalysts = relevant
    .slice()
    .reverse()
    .slice(0, MAX_CATALYSTS)
    .map((n) => n.title)

  // upcoming_events : events futurs triés par proximité.
  const upcoming = calendar
    .map((c) => ({ row: c, at: DateTime.fromISO(c.event_at, { zone: 'utc' }) }))
    .filter((e) => e.at.isValid && e.at > now)
    .sort((a, b) => (a.at < b.at ? -1 : 1))
  const upcomingEvents = upcoming.slice(0, MAX_UPCOMING).map((e) => e.row.title)

  // news_risk (D-40) : un event high-impact tombe dans la fenêtre de risque.
  const riskHorizon = now.plus({ hours: riskHours })
  const newsRisk = upcoming.some(
    (e) => (e.row.impact ?? '').toLowerCase() === HIGH_IMPACT && e.at <= riskHorizon,
  )

  return {
    net_sentiment: Math.round(netSentiment * 1e6) / 1e6,
    recent_catalysts: recentCatalysts,
    upcoming_events: upcomingEvents,
    news_risk: newsRisk,
  }
}

// ─── IO : client + lecture news / calendrier ───────────────────────────────────

type ServiceClient = ReturnType<typeof createClient<Database>>

function getServiceClient(): ServiceClient {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'news-engine: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Fenêtre de lecture news : couvre la plus large fenêtre style (swing = 7j) + marge.
const READ_WINDOW_DAYS = 8

/** Lit les news publiées dans la fenêtre de lecture (toutes instruments confondus). */
async function readNews(client: ServiceClient, now: DateTime): Promise<NewsRow[]> {
  const since = now.minus({ days: READ_WINDOW_DAYS }).toISO()!
  const { data, error } = await client
    .from('news')
    .select('*')
    .gte('published_at', since)
    .order('published_at', { ascending: true })
  if (error) {
    throw new Error(`readNews failed: ${error.message}`)
  }
  return data ?? []
}

/** Lit les événements du calendrier à venir (jusqu'à la fenêtre swing). */
async function readCalendar(client: ServiceClient, now: DateTime): Promise<EconomicCalendarRow[]> {
  const until = now.plus({ days: READ_WINDOW_DAYS }).toISO()!
  const { data, error } = await client
    .from('economic_calendar')
    .select('*')
    .gte('event_at', now.toISO()!)
    .lte('event_at', until)
    .order('event_at', { ascending: true })
  if (error) {
    throw new Error(`readCalendar failed: ${error.message}`)
  }
  return data ?? []
}

// ─── Job principal ──────────────────────────────────────────────────────────��─

const STYLES: Style[] = ['day', 'swing']
const TIMEFRAME_SET: Record<Style, string> = { day: 'news-24h', swing: 'news-7d' }

/**
 * Job news-engine : pour chaque instrument actif × style, dérive et persiste un
 * news_context §3 déterministe. Isolé par instrument (Pitfall 5).
 */
export async function newsEngine(): Promise<Json> {
  const stats = {
    inserted: 0,
    skipped: 0,
    errors: [] as Array<{ instrument: string; msg: string }>,
  }

  const client = getServiceClient()
  const now = DateTime.utc()
  const [news, calendar] = await Promise.all([readNews(client, now), readCalendar(client, now)])

  const instruments = await listActiveInstruments(client)

  for (const instrument of instruments) {
    try {
      for (const style of STYLES) {
        const context = deriveNewsContext(news, calendar, instrument.id, style, now)

        // T-03-14 : valider §3 AVANT persist (fail fast sur dérive de forme).
        const validated = NewsContextSchema.parse(context)
        const payload = validated as unknown as Json

        const row: SnapshotInsert = {
          instrument_id: instrument.id,
          style,
          timeframe_set: TIMEFRAME_SET[style],
          kind: 'news',
          computed_for_ts: now.toISO()!,
          content_hash: snapshotContentHash(payload),
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
      `news-engine: 0 snapshot produit sur ${stats.errors.length} erreur(s) — ${stats.errors[0]?.msg ?? 'voir stats.errors'}`,
    )
  }

  return stats as Json
}
