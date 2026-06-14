/**
 * OutputSchema §3 PERMISSIF — contrat JSON produit par la routine Claude (agent IA).
 *
 * Source de vérité : ARCHITECTURE.md §3 (schéma de sortie JSON). Encodé champ par
 * champ. Validé côté scoring-aggregator AVANT insertion (D-42) ; un JSON non
 * conforme est rejeté + loggé.
 *
 * A1 (concern revue quality [HIGH]) : le schéma est PERMISSIF — `z.object({...})`
 * SANS `.strict()`. L'exemple §3 contient opportunity_score/risk_level/confidence/
 * risk_reward/atr_distance_sl ; ces champs NE figurent PAS ici car le CODE les
 * produit/recalcule de façon déterministe (D-42/46/48/50), jamais l'agent. Si
 * l'agent les émet quand même, Zod les strip par défaut au lieu de provoquer un
 * rejet — ce qui rendrait le pipeline fragile au moindre extra de l'agent.
 *
 * Zod v4 : `z.iso.datetime()` pour les horodatages, `z.tuple` pour entry.zone,
 * `z.array(...).min(1).max(3)` pour take_profits. Types via z.infer.
 */
import { z } from 'zod'

const SessionEnum = z.enum(['asia', 'london', 'newyork', 'eod-swing'])
const StyleEnum = z.enum(['day', 'swing'])
const DirectionEnum = z.enum(['long', 'short'])
const EntryTypeEnum = z.enum(['limit', 'market', 'stop'])
const ImpactEnum = z.enum(['low', 'medium', 'high'])

const EntrySchema = z.object({
  type: EntryTypeEnum,
  price: z.number(),
  zone: z.tuple([z.number(), z.number()]),
})

// rr est recalculé par le code (D-42/50) — exclu du contrat agent.
const TakeProfitSchema = z.object({
  price: z.number(),
  alloc_pct: z.number(),
})

const NewsCatalystSchema = z.object({
  headline: z.string(),
  impact: ImpactEnum,
  direction: z.string(),
  ts: z.iso.datetime(),
})

const UpcomingRiskEventSchema = z.object({
  event: z.string(),
  ts: z.iso.datetime(),
  note: z.string(),
})

// PERMISSIF : z.object SANS .strict() (A1). opportunity_score/risk_level/
// confidence/risk_reward/atr_distance_sl volontairement absents (produits par le code).
export const OutputSchema = z.object({
  schema_version: z.string(),
  generated_at: z.iso.datetime(),
  session: SessionEnum,
  style: StyleEnum,
  instrument: z.string(),
  direction: DirectionEnum,
  timeframe_analysis: z.string(),
  entry: EntrySchema,
  stop_loss: z.number(),
  take_profits: z.array(TakeProfitSchema).min(1).max(3),
  technical_reasons: z.array(z.string()),
  fundamental_reasons: z.array(z.string()),
  news_catalysts: z.array(NewsCatalystSchema),
  upcoming_risk_events: z.array(UpcomingRiskEventSchema),
  invalidation: z.string(),
  veteran_note: z.string(),
  raw_indicators_ref: z.string(),
})

export type Output = z.infer<typeof OutputSchema>
