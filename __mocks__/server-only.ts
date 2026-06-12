// Mock de server-only pour l'environnement Vitest (Node).
// Dans Next.js, ce module lève une erreur si importé côté client.
// Dans Vitest, les jobs tournent dans Node — le mock est un no-op volontaire.
export {}
