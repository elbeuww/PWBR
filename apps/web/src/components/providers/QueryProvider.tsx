'use client'

/**
 * QueryProvider — wrapper @tanstack/react-query monté au-dessus de la surface
 * signaux (Plan 03-01, Task 3).
 *
 * Le QueryClient est mémorisé via useState (créé une seule fois par montage,
 * jamais recréé au re-render) — pattern client recommandé pour le App Router :
 * un client par instance navigateur, pas de partage entre requêtes SSR.
 * Sert de repli (D-16) au Realtime : initialData = rows RSC + refetch léger si le
 * canal n'atteint pas SUBSCRIBED.
 *
 * Analog structurel : components/ThemeProvider.tsx (provider client 'use client').
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
