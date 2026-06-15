/**
 * replayOutcome — replay first-touch déterministe d'un setup expiré (TRACK-01).
 *
 * Fonction PURE, zéro I/O : rejoue un setup contre une séquence de bougies H1
 * (D-03) et retourne l'issue binaire « TP1 atteint avant SL » (D-01) avec le R
 * réalisé mesuré sur les PRIX des candles — jamais via le moteur de scoring
 * (anti-pattern : le replay mesure le prix réalisé, pas le score de génération).
 *
 * Règles produit appliquées :
 *  - D-01 : résultat binaire TP1 vs SL, R mesuré jusqu'à TP1 (pas de TP partiels).
 *  - D-02 : trade flat (ni TP ni SL avant valid_until) valorisé au close de la
 *    dernière bougie ≤ valid_until ; R>0 si prix dans le sens, R<0 sinon.
 *  - D-04 : bougie ambiguë (TP1 ET SL dans la même H1) → le niveau le plus proche
 *    de l'entrée est touché en premier (distTp <= distSl → hit_tp, tie ≤ = hit_tp).
 *
 * Les candles DOIVENT être fournies ordonnées par ts croissant et bornées à la
 * fenêtre du setup (ts < valid_until, anti look-ahead — responsabilité de l'appelant).
 *
 * Source de l'algo : 05-RESEARCH §Code Examples (porté tel quel).
 */

/** Bougie H1 minimale nécessaire au replay first-touch. */
export type ReplayCandle = {
  ts: string
  open: number
  high: number
  low: number
  close: number
}

/** Forme du setup dérivée du contrat §3 (schemas/output.ts) ; TP1 = take_profits[0]. */
export type ReplaySetup = {
  direction: 'long' | 'short'
  entry_price: number
  stop_loss: number
  take_profits: { price: number; alloc_pct: number }[]
  valid_until: string
}

/** Issue mesurée d'un setup rejoué. */
export type Outcome = {
  outcome: 'hit_tp' | 'hit_sl' | 'flat'
  realized_r: number
}

/**
 * Rejoue un setup contre ses bougies H1 et retourne l'issue first-touch + R.
 *
 * @param setup     Setup à rejouer (direction, entrée, SL, TP1).
 * @param candlesH1 Bougies H1 ordonnées par ts croissant, dans la fenêtre du setup.
 * @returns         { outcome, realized_r } déterministe.
 */
export function replayOutcome(setup: ReplaySetup, candlesH1: ReplayCandle[]): Outcome {
  const tp1 = setup.take_profits[0]!.price
  const sl = setup.stop_loss
  const entry = setup.entry_price
  const isLong = setup.direction === 'long'
  // Risque en unités de prix, > 0 par construction (entrée et SL du bon côté).
  const denom = isLong ? entry - sl : sl - entry

  const winR = Math.abs(tp1 - entry) / denom

  for (const c of candlesH1) {
    const hitTp = isLong ? c.high >= tp1 : c.low <= tp1
    const hitSl = isLong ? c.low <= sl : c.high >= sl

    if (hitTp && hitSl) {
      // D-04 : règle de distance — le niveau le plus proche de l'entrée touché en premier.
      const distTp = Math.abs(tp1 - entry)
      const distSl = Math.abs(entry - sl)
      return distTp <= distSl
        ? { outcome: 'hit_tp', realized_r: winR }
        : { outcome: 'hit_sl', realized_r: -1 }
    }
    if (hitTp) return { outcome: 'hit_tp', realized_r: winR }
    if (hitSl) return { outcome: 'hit_sl', realized_r: -1 }
  }

  // D-02 flat : R au close de la dernière bougie clôturée ≤ valid_until.
  const last = candlesH1[candlesH1.length - 1]
  if (!last) return { outcome: 'flat', realized_r: 0 } // aucune candle (gap de données, A3) → R neutre
  const r = isLong ? (last.close - entry) / denom : (entry - last.close) / denom
  return { outcome: 'flat', realized_r: r }
}
