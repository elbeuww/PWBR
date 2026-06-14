'use client'

/**
 * ThemeProvider — wrapper next-themes (D-02, class strategy).
 *
 * Réexporte le provider next-themes pour pouvoir l'utiliser dans le layout RSC
 * ([locale]/layout.tsx) tout en restant un client component. Le no-flash SSR est
 * géré par next-themes (script pré-paint) + suppressHydrationWarning sur <html>.
 *
 * Source : 02-RESEARCH.md §Pattern 1 ; 02-PATTERNS.md §ThemeProvider.
 */
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
