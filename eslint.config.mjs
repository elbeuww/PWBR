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
      // Généré par Next à chaque build (triple-slash + types auto) — non lintable.
      '**/next-env.d.ts',
      // Fixtures qui violent VOLONTAIREMENT une règle pour la tester (ex. D-07).
      '**/__lint_fixtures__/**',
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

  // Convention projet : un identifiant préfixé par `_` est intentionnellement inutilisé
  // (params ignorés, destructuring partiel, const conservée pour `typeof`). Aligné sur
  // l'usage déjà répandu dans le code (_opts, _cols, _col…).
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },

  // Fichiers de déclaration ambiante : ils décrivent des modules tiers et n'ont pas à
  // consommer localement chaque type déclaré (ex. NewsArticle documenté mais non exporté).
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // Scripts Node (ESM) hors build : fournir les globals d'exécution, sinon no-undef
  // sur process/console/URL… (ces fichiers ne tournent jamais dans un navigateur).
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
      },
    },
  },
)
