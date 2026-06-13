/**
 * Déclaration de type minimale pour le module 'finnhub' (v2.0.14).
 * Le SDK finnhub n'embarque pas de types TypeScript.
 * Seule l'API utilisée ici est déclarée (DefaultApi + ApiClient).
 */
declare module 'finnhub' {
  type MarketNewsCategory = 'crypto' | 'forex' | 'general' | 'merger'

  interface NewsArticle {
    category?: string
    datetime: number
    headline: string
    id?: number
    image?: string | null
    related?: string | null
    source?: string
    summary?: string | null
    url: string
    [key: string]: unknown
  }

  interface ApiKeyAuth {
    apiKey: string
  }

  interface AuthenticationMap {
    api_key: ApiKeyAuth
    [key: string]: unknown
  }

  interface ApiClientInstance {
    authentications: AuthenticationMap
  }

  const ApiClient: { instance: ApiClientInstance }

  class DefaultApi {
    marketNews(
      category: MarketNewsCategory,
      opts: Record<string, unknown>,
      callback: (error: unknown, data: unknown) => void,
    ): void
  }

  export { DefaultApi, ApiClient }
  export default { DefaultApi, ApiClient }
}
