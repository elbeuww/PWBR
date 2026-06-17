/**
 * formatMessage — formateur Telegram pur bilingue FR+AR (le seul code neuf P6).
 *
 * Fonction PURE, zéro I/O. Produit un unique string HTML (parse_mode: 'HTML')
 * destiné au canal Telegram PUBLIC. Garde-fous de la phase 6 :
 *
 *  - LEGAL-01 : chaque sortie contient le disclaimer FR ET AR (copy P2 identique).
 *  - TG-02 / D-11 : le bloc win rate passe par applyThreshold (@app/core) — même
 *    source de vérité que la vitrine ; jamais de % sous N<30.
 *  - D-03 / D-05 (T-06-LEAK) : le type d'entrée FormatTrade ne porte QUE
 *    symbol+direction+outcome+realized_r — entry/SL/TP n'entrent jamais ici.
 *  - T-06-INJ : escapeHtml sur TOUTE donnée dynamique avant insertion HTML.
 *  - T-06-BIDI : seuls des isolats contrôlés (U+2066/U+2069/U+200F) sont injectés ;
 *    le bloc AR est RTL, les segments ticker/R/% sont isolés LTR.
 *  - Pitfall 3 : sortie bornée < 4096 chars (cible ~3500) ; au-delà de 10 trades
 *    on ne détaille que le top |R| + « +X autres trades ».
 *
 * Source de spec : 06-RESEARCH §Pattern 2/3 + §Code Examples + Pitfalls 3/5.
 */
import { applyThreshold, type StatRow } from '../track-record/threshold.js'
import type { Outcome } from '../replay/outcome.js'

/** Isolat LTR (U+2066) — ouvre un segment gauche-à-droite noyé en RTL. */
const LRI = '⁦'
/** Pop directional isolate (U+2069) — ferme l'isolat courant. */
const PDI = '⁩'
/** Right-to-left mark (U+200F) — préfixe une ligne pour la forcer en RTL. */
const RLM = '‏'

/** Séparateur visuel entre bloc FR et bloc AR. */
const SEP = '────────────'

/** Nombre max de trades détaillés avant résumé « +X autres » (Pitfall 3). */
const MAX_DETAILED = 10

/** Disclaimer LEGAL-01 — copy P2 identique (jamais de promesse de gain). */
const DISCLAIMER_FR =
  '⚠️ Contenu éducatif. Aucune promesse de gain. Ceci ne constitue pas un conseil en investissement.'
const DISCLAIMER_AR =
  '⚠️ محتوى تعليمي. لا وعد بأي ربح. هذا ليس نصيحة استثمارية.'

/**
 * Trade minimal affichable (D-03) — JAMAIS de niveau premium (entry/SL/TP).
 * realized_r est le R réalisé mesuré par replayOutcome (peut être négatif/flat).
 */
export interface FormatTrade {
  symbol: string
  direction: 'long' | 'short'
  outcome: Outcome['outcome']
  realized_r: number
}

/** Type de post produit par le job (récap quotidien, fait notable, win rate seul). */
export type PostKind = 'recap' | 'notable' | 'winrate'

/** Entrée de formatMessage — agrégat win rate + liste de trades clôturés. */
export interface FormatInput {
  kind: PostKind
  winRate: StatRow
  trades: FormatTrade[]
}

/**
 * Échappe les caractères HTML actifs dans l'ordre & → < → > (T-06-INJ).
 * L'ordre est critique : `&` d'abord pour ne pas double-échapper les entités.
 */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Enveloppe un segment dans un isolat LTR + échappement HTML (ticker/R/% en RTL). */
function ltr(s: string): string {
  return LRI + escapeHtml(s) + PDI
}

/** Formate le R réalisé avec signe explicite et une décimale (+2.3R / -1.0R). */
function formatR(r: number): string {
  const sign = r >= 0 ? '+' : '-'
  return `${sign}${Math.abs(r).toFixed(1)}R`
}

/** Libellé FR du résultat (mapping D-03). */
function outcomeFr(o: Outcome['outcome']): string {
  switch (o) {
    case 'hit_tp':
      return '✅ TP1 atteint'
    case 'hit_sl':
      return '❌ SL touché'
    case 'flat':
      return '➖ clôture neutre (flat)'
  }
}

/** Libellé AR du résultat (mapping D-03). */
function outcomeAr(o: Outcome['outcome']): string {
  switch (o) {
    case 'hit_tp':
      return '✅ تحقّق الهدف TP1'
    case 'hit_sl':
      return '❌ لمس وقف الخسارة SL'
    case 'flat':
      return '➖ إغلاق محايد (flat)'
  }
}

/** Trie par |R| décroissant et tronque au top MAX_DETAILED ; renvoie le reste. */
function pickTop(trades: FormatTrade[]): { shown: FormatTrade[]; rest: number } {
  if (trades.length <= MAX_DETAILED) {
    return { shown: trades, rest: 0 }
  }
  const sorted = [...trades].sort((a, b) => Math.abs(b.realized_r) - Math.abs(a.realized_r))
  return { shown: sorted.slice(0, MAX_DETAILED), rest: trades.length - MAX_DETAILED }
}

/** Bloc win rate FR via applyThreshold (D-11) — même seuil que la vitrine. */
function winRateLineFr(row: StatRow): string {
  const t = applyThreshold(row)
  if (t.sufficient) {
    return `📊 Taux de réussite mesuré : ${t.winRatePct}% (N=${t.n})`
  }
  return `📊 Taux de réussite : échantillon insuffisant, N=${t.n}`
}

/** Bloc win rate AR via applyThreshold (D-11) — segments numériques isolés LTR. */
function winRateLineAr(row: StatRow): string {
  const t = applyThreshold(row)
  if (t.sufficient) {
    return `${RLM}📊 نسبة النجاح المقاسة: ${ltr(`${t.winRatePct}%`)} ${ltr(`N=${t.n}`)}`
  }
  return `${RLM}📊 نسبة النجاح: العيّنة غير كافية، ${ltr(`N=${t.n}`)}`
}

/**
 * Formate un message Telegram HTML bilingue prêt à envoyer (parse_mode HTML).
 *
 * @param input kind + agrégat win rate + trades clôturés (sans niveaux premium).
 * @returns Chaîne HTML unique < 4096 chars : bloc FR (LTR) puis bloc AR (RTL).
 */
export function formatMessage(input: FormatInput): string {
  const { trades, winRate } = input
  const { shown, rest } = pickTop(trades)

  // ── Bloc FR (LTR) ──────────────────────────────────────────────
  const titleFr =
    input.kind === 'winrate'
      ? '<b>📈 Track record</b>'
      : input.kind === 'notable'
        ? '<b>📈 Trade notable</b>'
        : '<b>📈 Récap du jour</b>'

  const frLines: string[] = [titleFr]

  if (input.kind !== 'winrate') {
    if (shown.length === 0) {
      frLines.push('Aucun trade clôturé aujourd’hui.')
    } else {
      for (const tr of shown) {
        frLines.push(
          `• ${escapeHtml(tr.symbol)} (${escapeHtml(tr.direction)}) — ${outcomeFr(tr.outcome)} ${formatR(tr.realized_r)}`,
        )
      }
      if (rest > 0) {
        frLines.push(`… +${rest} autres trades`)
      }
    }
  }

  frLines.push(winRateLineFr(winRate))
  frLines.push(DISCLAIMER_FR)

  // ── Bloc AR (RTL) ──────────────────────────────────────────────
  const titleAr =
    input.kind === 'winrate'
      ? `${RLM}<b>📈 سجل الأداء</b>`
      : input.kind === 'notable'
        ? `${RLM}<b>📈 صفقة بارزة</b>`
        : `${RLM}<b>📈 ملخص اليوم</b>`

  const arLines: string[] = [titleAr]

  if (input.kind !== 'winrate') {
    if (shown.length === 0) {
      arLines.push(`${RLM}لا توجد صفقات مغلقة اليوم.`)
    } else {
      for (const tr of shown) {
        arLines.push(
          `${RLM}• ${ltr(tr.symbol)} (${ltr(tr.direction)}) — ${outcomeAr(tr.outcome)} ${ltr(formatR(tr.realized_r))}`,
        )
      }
      if (rest > 0) {
        arLines.push(`${RLM}… ${ltr(`+${rest}`)} صفقات أخرى`)
      }
    }
  }

  arLines.push(winRateLineAr(winRate))
  arLines.push(`${RLM}${DISCLAIMER_AR}`)

  return [...frLines, '', SEP, '', ...arLines].join('\n')
}
