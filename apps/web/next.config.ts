import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Nécessaire pour que Next.js transpile les packages workspace locaux
  // Source : 01-RESEARCH.md §Recommended Project Structure
  transpilePackages: ['@app/core', '@app/supabase'],
}

export default nextConfig
