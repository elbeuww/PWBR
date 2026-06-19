---
slug: admin-route-unreachable
status: resolved
trigger: "Back-office (admin) inatteignable au runtime — découvert pendant l'UAT live de la Phase 8. GET /admin renvoie 307 → /fr/admin au lieu de servir le route group (admin) hors [locale]."
created: 2026-06-19
updated: 2026-06-19
root_cause: "BUG #1: middleware matcher n'excluait pas /admin → next-intl localePrefix:'always' redirige /admin→/fr/admin (inexistant). BUG #3 (découvert en cours): collision de routes parallèles — (affiliate)/dashboard ET dashboard résolvent tous deux vers /[locale]/dashboard → Next refuse de compiler. BUG #2: react-tooltip tire des sous-deps radix non résolues par turbopack-dev (tooling, pas prod)."
fix: "BUG #1: ajout de 'admin' au negative-lookahead du matcher (apps/web/src/middleware.ts). BUG #3: relocalisation (affiliate)/dashboard → affiliation/dashboard (URL dédiée /[locale]/affiliation/dashboard, profondeur d'import préservée), suppression du groupe (affiliate) vide. BUG #2: déclaration de @radix-ui/react-visually-hidden (hygiène ; le 500 dev résiduel est une limite turbopack-dev sur les exports TS-source .js de @app/*, géré par webpack en prod)."
verification: "typecheck tsc -b --noEmit exit 0 ; vitest 507 passed/4 skipped (zéro régression) ; runtime partiel : /admin ne redirige plus vers /fr/admin (matcher OK), /fr/affiliation → 200 (collision résolue). Le 404 final sur /admin + 200 superadmin restent non prouvables localement (turbopack-dev ne compile pas les pages important @app/core — même cause que le 500 /fr) → vérif runtime à faire en env propre (Vercel preview / CI), cohérent avec le report historique des E2E live."
files_changed:
  - apps/web/src/middleware.ts
  - "apps/web/src/app/[locale]/affiliation/dashboard/page.tsx (déplacé)"
  - "apps/web/src/app/[locale]/affiliation/dashboard/RevenueTabs.tsx (déplacé)"
  - apps/web/package.json
  - pnpm-lock.yaml
---

# Debug Session: admin-route-unreachable

## Symptoms

- **Expected behavior:** `GET /admin` (et sous-chemins `/admin/signaux`, `/admin/signaux/[id]`, `/admin/sante`, `/admin/affiliation/*`) sert le route group `(admin)` qui vit HORS `[locale]` (D-15, mono-FR). La garde `requireRole('superadmin')` dans `(admin)/layout.tsx` doit s'exécuter : 404 (notFound) pour non-auth ET authentifié-non-superadmin (jamais 200/redirect/403, threat T-04-ADMIN-ELEV), 200 pour superadmin. En parallèle, `GET /fr` (home marketing) doit rendre 200.
- **Actual behavior:**
  - BUG #1 (CRITIQUE) : `GET /admin` → **307 redirect vers `/fr/admin`**. Comme aucun `/[locale]/admin` n'existe, `/fr/admin` tombe en 404/500. Le back-office est inatteignable ; `requireRole('superadmin')` n'est JAMAIS atteint (le redirect locale frappe avant le RSC).
  - BUG #2 (HIGH) : `GET /fr` → **500** ("Module not found: Can't resolve '@radix-ui/react-visually-hidden'"). Ce 500 masque aussi le statut réel de `/fr/admin`.
- **Error messages:**
  - BUG #1 : pas d'erreur serveur — redirection 307. `curl -sL -o /dev/null -w "%{http_code} -> %{url_effective}" http://localhost:3001/admin` → `500 -> http://localhost:3001/fr/admin` (307 intermédiaire).
  - BUG #2 : `Module not found: Can't resolve '@radix-ui/react-visually-hidden'` depuis `@radix-ui/react-tooltip/dist/index.mjs:17` → `apps/web/src/components/ui/tooltip.tsx` → `TrackRecordView.tsx` → `TrackRecordBlock.tsx` → `[locale]/(marketing)/page.tsx`.
- **Timeline:** BUG #1 latent depuis Phase 4 (création du route group `(admin)`) — jamais détecté car les E2E live (ACCESS-03/03b dans `apps/web/e2e/gating.spec.ts`) n'ont JAMAIS tourné contre un serveur live (toujours différés, D-01-04-C). BUG #2 introduit en Phase 5 (`TrackRecordView` + tooltip). Découverts ensemble pendant l'UAT live de la Phase 8 (2026-06-19).
- **Reproduction:**
  1. `pnpm exec tsc -b` (rebuild des dist workspace — sinon `@app/core` ne résout pas).
  2. `pnpm --filter web dev` (TURBOPACK obligatoire — webpack refuse de démarrer à cause du `!` dans le chemin projet).
  3. `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/admin` → 307 (au lieu de 404).
  4. `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/fr` → 500 (au lieu de 200).

## Suspected Causes (pré-investigation orchestrateur — à valider/réfuter)

- BUG #1 : `apps/web/src/middleware.ts` (~ligne 48) — le `config.matcher` `'/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'` n'exclut PAS `/admin`. `handleI18n = createMiddleware(routing)` avec `routing.localePrefix='always'` (`apps/web/src/i18n/routing.ts`) préfixe donc la locale sur `/admin`. Fix candidat : ajouter `admin` aux exclusions du negative-lookahead (comme `api`), en s'assurant que `updateSession` (refresh session Supabase) et `captureRef` restent cohérents pour les chemins admin (vérifier que la garde RSC `requireRole` lit toujours correctement la session sans le refresh middleware).
- BUG #2 : `@radix-ui/react-visually-hidden@1.2.5` est présent dans le store pnpm mais NON lié dans `apps/web/node_modules` et NON déclaré dans `apps/web/package.json`. Fix candidat : `pnpm install` propre (réparer le lien hoisté) ou déclarer la dépendance directe.

## Current Focus

- hypothesis: Le matcher du middleware capture `/admin` → next-intl `localePrefix:'always'` le redirige sous `/fr` ; le back-office hors `[locale]` devient inatteignable.
- test: Exclure `/admin` du matcher, redémarrer le dev turbopack, vérifier `/admin` → 404 (non-auth + non-superadmin) et accès superadmin → 200.
- expecting: 404 sur `/admin*` pour non-superadmin, plus de redirect `/fr/admin`.
- next_action: gather initial evidence (lire middleware.ts + routing.ts + (admin)/layout.tsx + gate.ts requireRole, confirmer le mécanisme de redirect et l'impact sur updateSession)

## Evidence

- timestamp 2026-06-19: `curl -sL http://localhost:3001/admin` → 307 → `/fr/admin` (final 500). Confirmé par l'orchestrateur.
- timestamp 2026-06-19: `curl http://localhost:3001/fr` → 500, log dev = "Can't resolve '@radix-ui/react-visually-hidden'".
- timestamp 2026-06-19: `routing.ts` confirme `localePrefix: 'always'`, locales fr/en/ar, defaultLocale fr.
- timestamp 2026-06-19: `middleware.ts` matcher exclut api/_next/assets mais PAS admin.
- timestamp 2026-06-19: `@radix-ui+react-visually-hidden@1.2.5` présent dans `node_modules/.pnpm/` mais absent de `apps/web/node_modules/@radix-ui/` et de `apps/web/package.json`.

## Eliminated

(aucune hypothèse éliminée pour l'instant)

## Environment Notes

- Dev server turbopack SAIN en arrière-plan : http://localhost:3001 (tâche bg `blmplshe6`). Port 3000 libéré.
- Webpack INUTILISABLE en dev (le `!` du chemin `Potatos WILL BECOME RICH !` est réservé à la syntaxe loader webpack) → toujours `next dev --turbopack`.
- Les dist/ des packages workspace doivent être à jour (`pnpm exec tsc -b`) sinon `@app/core` (sous-chemins `.js`) ne résout pas.
- `apps/web/.env.local` ne contient QUE l'anon key (pas de `SUPABASE_SERVICE_ROLE_KEY`) → les pages `(admin)` qui appellent `createAdminServiceClient()` THROW au rendu (item séparé de l'UAT visuelle, hors périmètre de ces 2 bugs de routing/dep).

## Resolution

(en cours)
