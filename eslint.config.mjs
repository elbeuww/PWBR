// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Ignorer les dossiers générés / artefacts
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },

  // Config de base JS recommandée
  js.configs.recommended,

  // Config TypeScript recommandée (strict)
  ...tseslint.configs.recommended,

  // Règle de sécurité D-07 : interdire l'import du module service_role depuis apps/web
  // Appliqué à tous les fichiers TS/TSX dans apps/web (préparation AUTH-03 — le module sera
  // créé au plan 02 ; la règle est posée maintenant pour prévenir toute régression dès le début).
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/supabase/**/service-*', '@app/supabase/service-client'],
              message:
                'Le client service_role est interdit côté web (apps/web). ' +
                'Ce module est réservé exclusivement à apps/jobs. ' +
                'Utiliser le client anon depuis @app/supabase/anon-client.',
            },
          ],
        },
      ],
    },
  },
)
