/**
 * mdx-components.tsx — mapping `MDX_COMPONENTS` injecté à `compileMDX` (D-09).
 *
 * Allowlist FIXE de composants maison (threat T-09-XSS : aucun raw-HTML passthrough,
 * aucune exécution de contenu distant — seuls les composants ci-dessous sont
 * disponibles dans le MDX). Le `<Disclaimer />` n'est VOLONTAIREMENT PAS dans le
 * mapping : il est injecté par la PAGE après `{content}` (RESEARCH Pattern 2), pour
 * qu'un auteur ne puisse pas l'oublier (LEGAL-01).
 *
 * `HeadingWithAnchor` réutilise l'`id` posé par rehype-slug (Plan 04 : remark/rehype
 * options de compileMDX). Le titre devient cliquable/ancré, cohérent avec les slugs
 * du TOC (toc.ts, même algorithme github-slugger).
 */
import { Callout } from './Callout'
import { Steps, Step } from './Steps'
import { Figure } from './Figure'
import { TradeExample } from './TradeExample'

/** H2 ancré : réutilise l'`id` (rehype-slug) et expose un lien d'ancrage. */
function HeadingWithAnchor({ id, children, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2 id={id} className="group scroll-mt-24 text-xl font-semibold text-foreground" {...props}>
      {id ? (
        <a href={`#${id}`} className="no-underline">
          {children}
        </a>
      ) : (
        children
      )}
    </h2>
  )
}

export const MDX_COMPONENTS = {
  Callout,
  Steps,
  Step,
  Figure,
  TradeExample,
  h2: HeadingWithAnchor,
}
