/**
 * TradeExample — encadré « exemple de trade » pédago (D-09, UI-SPEC §Layout 2).
 *
 * RSC. Card neutre `bg-card border border-border p-6`, AUCUNE couleur vert/rouge
 * (D-04 : l'Académie ne porte aucun widget trading sémantique). Les libellés
 * (Entrée/Stop-loss/Take-profit/Ratio R:R) viennent de `academy.trade*`.
 *
 * Anti-inversion RTL (Pitfall 4, précédent dashboard affilié D-02-03-A) : CHAQUE
 * valeur numérique (prix/SL/TP/R:R) est enveloppée dans `<bdi>` pour que les
 * chiffres latins ne soient pas réordonnés dans un contexte arabe.
 */
import { getTranslations } from 'next-intl/server'

interface TradeExampleProps {
  /** Prix d'entrée (déjà formaté côté MDX, ex. "1.0850"). */
  entry: string
  /** Niveau de stop-loss. */
  stopLoss: string
  /** Niveau(x) de take-profit. */
  takeProfit: string
  /** Ratio risque/rendement (ex. "1:2.5"). */
  rr: string
}

export async function TradeExample({ entry, stopLoss, takeProfit, rr }: TradeExampleProps) {
  const t = await getTranslations('academy')

  const rows: Array<{ label: string; value: string }> = [
    { label: t('tradeEntry'), value: entry },
    { label: t('tradeStopLoss'), value: stopLoss },
    { label: t('tradeTakeProfit'), value: takeProfit },
    { label: t('tradeRr'), value: rr },
  ]

  return (
    <section className="my-6 rounded-lg border border-border bg-card p-6">
      <h4 className="text-base font-semibold text-foreground">{t('tradeExampleTitle')}</h4>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="text-base font-semibold tabular-nums text-foreground">
              <bdi>{row.value}</bdi>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
