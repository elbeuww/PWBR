import path from 'node:path'
import type { NextConfig } from 'next'

// Racine du monorepo : un package-lock.json parasite dans le HOME fait
// inférer un mauvais root à Next (casse la résolution des packages workspace).
const monorepoRoot = path.join(__dirname, '..', '..')

const nextConfig: NextConfig = {
  // Nécessaire pour que Next.js transpile les packages workspace locaux
  // Source : 01-RESEARCH.md §Recommended Project Structure
  transpilePackages: ['@app/core', '@app/supabase'],
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
}

export default nextConfig
