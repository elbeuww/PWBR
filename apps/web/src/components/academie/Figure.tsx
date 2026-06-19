/**
 * Figure — capture légendée (D-09, UI-SPEC §Layout 2).
 *
 * `next/image` (ratio 16:9 cohérent avec les couvertures) + `<figcaption>` atténué.
 * Le texte (alt + légende) vient du MDX (props) → aucun libellé en dur à externaliser.
 * `alt` est requis (a11y). Propriétés logiques uniquement.
 */
import Image from 'next/image'

interface FigureProps {
  src: string
  alt: string
  caption?: string
  width?: number
  height?: number
}

export function Figure({ src, alt, caption, width = 1280, height = 720 }: FigureProps) {
  return (
    <figure className="my-6">
      <div className="overflow-hidden rounded-lg border border-border">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="h-auto w-full"
          sizes="(min-width: 768px) 65ch, 100vw"
        />
      </div>
      {caption ? (
        <figcaption className="mt-2 text-sm text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  )
}
