# Phase 1: Socle transverse — i18n/RTL & rôles/gating - Research

**Researched:** 2026-06-14
**Domain:** Next.js 15 App Router i18n (`[locale]` + RTL) + Supabase RLS multi-rôles (gating défense-en-profondeur)
**Confidence:** HIGH (stack verrouillée + vérifiée npm 2026-06-14 ; patterns d'intégration recoupés docs officielles next-intl/Tailwind v4 + codebase lu directement ; quelques détails d'API next-intl 4.x tagués [ASSUMED] faute d'accès Context7 en session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 :** `localePrefix: 'always'` — toutes les URLs préfixées : `/fr/…`, `/en/…`, `/ar/…`. Aucune route sans préfixe.
- **D-02 :** `defaultLocale = 'fr'`. La racine `/` redirige vers `/fr`. Pas de détection Accept-Language au MVP (déterministe ; bascule via sélecteur). Détection ajoutable plus tard sans casser le routing.
- **D-03 :** Locales = `['fr', 'en', 'ar']`. `ar` → `dir="rtl"` ; `fr`/`en` → `ltr`. Toutes les chaînes d'interface externalisées via next-intl (aucune chaîne en dur). Raisonnement IA généré (FR/EN) affiché tel quel même en UI arabe.
- **D-04 :** Squelette RÉEL de `subscriptions` dès P1 (migration **0009**) → `has_active_subscription()` est une fonction RÉELLE et testable (à ce stade : 0 abonnement → tout user lit 0 setup). PAS de stub renvoyant false.
- **D-05 :** `profiles.role` ajouté en migration **0008**. Valeurs : `member` (défaut) / `affiliate` / `superadmin`. Lu côté serveur après `getUser()`, jamais via JWT.
- **D-06 :** Helpers RLS `has_active_subscription()` et `is_superadmin()` en `security definer` avec `search_path` figé. Réutilisent le pattern « journal privé » (lecture `authenticated`, écritures `service_role`). `has_active_subscription()` appliquée sur `trade_setups` ET `analyses`.
- **D-07 :** User authentifié SANS abonnement actif atteignant `/[locale]/membre…` → redirigé vers TARIFS (`/[locale]/tarifs`), pas login.
- **D-08 :** Visiteur NON authentifié atteignant une surface protégée → login avec `returnTo`.
- **D-09 :** Non-superadmin atteignant `(admin)` → **404** (discrétion), pas 403.
- **D-10 :** Sélecteur de langue en dropdown header, persistance cookie next-intl, reste sur la même page (route inchangée, locale changée).
- **D-11 :** P1 = Tailwind v4 + primitive RTL minimale uniquement (`ms-*`/`me-*`/`start`/`end`, `dir` auto, `<bdi>`/`Intl`). Design system complet reporté P2.

### Claude's Discretion
- Wiring exact next-intl (plugin, structure `messages/{locale}.json`, `i18n/routing.ts`) — pattern standard.
- Finalisation du wiring auth fonctionnel (login/signup actuellement squelettes) si nécessaire pour rendre le gating testable.
- Ordre de chaînage middleware : `next-intl` (locale) → `updateSession()` (existant). Ordre sensible.
- Détail contrainte SQL `profiles.role` (enum natif vs `check`) + schéma minimal `subscriptions` (`user_id`, `status`, `current_period_end`, etc.).

### Deferred Ideas (OUT OF SCOPE)
- Détection automatique Accept-Language à `/` — reportée (MVP déterministe + sélecteur).
- Design system visuel complet (thème, tokens marque, shadcn étoffés) — Phase 2.
- Traduction arabe du raisonnement IA — hors scope v2.0 (FR/EN affiché tel quel).
- Écriture/vérification des abonnements (paiement, transitions de statut) — Phase 4. P1 = squelette table + fonction RLS lecture seulement.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| I18N-01 | Navigue AR/EN/FR ; langue dans l'URL `/[locale]/…` et persiste | §next-intl wiring (routing `localePrefix:'always'`, middleware, cookie `NEXT_LOCALE`), §Architecture `[locale]` segment |
| I18N-02 | Layout bascule RTL pour l'arabe (propriétés logiques v4), éléments LTR (prix/symboles/nombres) corrects | §RTL Tailwind v4 (`dir` dynamique sur `<html>`, `ms-*`/`me-*`), §`<bdi>`/`Intl` pour LTR-dans-RTL |
| I18N-03 | Chaînes UI externalisées (next-intl) — aucune chaîne en dur | §`messages/{locale}.json` namespacés, `useTranslations`/`getTranslations`, §Validation (grep anti-chaîne-dure) |
| I18N-04 | Dates/nombres/devises selon la locale active | §`Intl.NumberFormat`/`Intl.DateTimeFormat` via next-intl `useFormatter`/`getFormatter` |
| ACCESS-01 | Visiteur non auth voit vitrine, ne peut atteindre espace membre | §gate.ts `requireUser` (redirect login+returnTo), §middleware cheap-redirect |
| ACCESS-02 | User auth SANS abonnement bloqué hors signaux — UI ET RLS : appel direct Supabase = 0 setup | §RLS `has_active_subscription()` sur trade_setups/analyses, §gate `requireActiveSub`, §Validation (test anon-client → 0 ligne) |
| ACCESS-03 | Rôles member/affiliate/superadmin portés par `profiles.role` (jamais JWT) ; chaque rôle → ses surfaces | §migration 0008 role, §gate `requireRole` lit `profiles.role` après `getUser()`, §RLS `is_superadmin()` |
| ACCESS-04 | Accès signaux conditionné par abonnement actif via RLS `has_active_subscription()`, prouvé cross-user/cross-role | §migration 0009 subscriptions + helper RLS, §Validation (tests cross-user/cross-role/expiré) |
</phase_requirements>

## Summary

Cette phase pose deux primitives transverses **avant toute UI publique**, ce qui évite deux refactors massifs documentés HIGH : (1) RTL après coup (inverse tout le layout) et (2) gating dispersé page par page. Tout est greffé sur un socle Next 15 App Router + Supabase SSR + monorepo pnpm DÉJÀ livré et testé (261/261). Le travail est essentiellement du **câblage de patterns standards** : next-intl 4.13 wiring (doc complète), propriétés logiques natives Tailwind v4 (aucun plugin), et le pattern RLS « journal privé » (migration 0006) étendu avec un helper `security definer`.

Les deux pièges de sécurité dominent : (a) **gating UI sans RLS** — le front lit avec l'anon-client public, donc un layout-gate seul fuit tous les signaux via un appel direct (Pitfall #5) → la RLS `has_active_subscription()` sur `trade_setups`/`analyses` est la VRAIE barrière, prouvée par un test anon-client « non-abonné → 0 ligne » ; (b) **rôle dans le JWT** (Pitfall #7) — `profiles.role` est lu serveur après `getUser()`, jamais dans un claim non revérifié. Deux dimensions orthogonales à ne pas confondre : abonnement actif (accès signaux, via RLS) vs rôle (accès dashboards affiliate/admin, via gate + RLS scoping).

Un point d'attention de wiring : le middleware racine actuel n'appelle QUE `updateSession()`. Il faut le composer avec le middleware next-intl, **locale d'abord** (next-intl doit voir l'URL brute pour résoudre la locale et écrire la response), **puis** rafraîchir la session sur cette même response — sans casser le refresh `getUser()`. `(admin)` reste HORS `[locale]` (back-office mono-langue).

**Primary recommendation :** Découper en 3 fronts parallélisables — (1) i18n/RTL (next-intl wiring + déplacement de l'arbre `app/` sous `[locale]` + Tailwind v4 + `dir` dynamique), (2) migrations SQL 0008/0009 + helpers RLS + régénération des types, (3) `lib/auth/gate.ts` + tests anon-client. Le middleware composé est la jointure des fronts (1) et (3).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Résolution de locale depuis l'URL | Frontend Server (middleware next-intl) | — | next-intl résout `/fr|/en|/ar` au middleware, rewrite + cookie `NEXT_LOCALE` |
| Application `dir=rtl/ltr` | Frontend Server (`[locale]/layout.tsx` RSC) | Browser (CSS logical props) | `dir` posé serveur sur `<html>` ; Tailwind v4 inverse via propriétés logiques au rendu |
| Externalisation des chaînes UI | Frontend Server (RSC `getTranslations`) + Browser (`useTranslations`) | — | messages chargés serveur (`getRequestConfig`), passés aux client components via provider |
| Formatage nombres/dates/devises | Frontend Server + Browser (`Intl` via next-intl) | — | déterministe par locale ; `<bdi>` isole le LTR dans un flux RTL |
| Refresh de session | Frontend Server (middleware `updateSession`) | — | invariant existant : `getUser()` au seul middleware racine |
| Décision d'accès UX (redirections) | Frontend Server (RSC layout gate) | Frontend Server (middleware cheap-redirect) | gate lit `profiles.role`/`subscriptions` après `getUser()` ; redirige avant rendu |
| **Barrière anti-fuite de données** | **Database (RLS Postgres)** | — | **la seule barrière non contournable** ; le front lit en anon-client → RLS tranche |
| Source de vérité du rôle | Database (`profiles.role`) | — | jamais JWT ; lu serveur après `getUser()` |
| Source de vérité de l'abonnement | Database (`subscriptions` + helper RLS) | — | `has_active_subscription()` security definer |

## Standard Stack

### Core (nouvelles dépendances de cette phase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-intl | `4.13.0` | i18n routing `[locale]` + RSC messages + ICU (pluriels arabes) + `Intl` formatting | Seule lib conçue pour App Router (RSC + routing localisé natif). peerDep `next ^15\|\|^16`, `react ^19` ✓. [VERIFIED: npm registry — locked CLAUDE.md/STACK.md] |
| tailwindcss | `4.3.1` | Styling + **RTL natif via propriétés logiques** (`ms-*`/`me-*`/`ps-*`/`pe-*`/`start-*`/`end-*`) | Core verrouillé. v4 = CSS-first `@theme`, logical properties intégrées → RTL sans plugin. [VERIFIED: npm registry] |
| @tailwindcss/postcss | `4.3.1` | Plugin PostCSS Tailwind v4 (remplace `tailwindcss` + `autoprefixer` en plugin PostCSS) | Chemin d'installation officiel Tailwind v4 + Next 15. [VERIFIED: npm registry] |

### Supporting (déjà présents — à réutiliser, ne pas réinstaller)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/ssr | `0.12.0` | Auth cookies App Router (getAll/setAll + `getUser()`) | Déjà câblé dans `middleware.ts` + `anon-client.ts`. Le gate s'appuie dessus. |
| @supabase/supabase-js | `2.108.0` | Client DB/Auth, types `Database` | Régénérer `database.types.ts` après 0008/0009. |
| zod | `4.4.3` | Validation des frontières (env locale, formulaires) | `z.enum(['fr','en','ar'])` pour valider la locale ; déjà dans la stack. |
| vitest | `4.1.8` | Tests d'intégration RLS (anon-client cross-user) | Pattern existant `packages/supabase/__tests__/rls.test.ts` à répliquer. |
| @playwright/test | `1.60.0` | E2E (bascule locale, redirections de gate, RTL visuel) | Config racine `playwright.config.ts` présente. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| next-intl | next-i18next / react-i18next nu | ❌ Pensés Pages Router ; pas de routing localisé RSC. Verrouillé contre. |
| Propriétés logiques v4 natives | `tailwindcss-rtl` / `tailwindcss-logical` | ❌ `tailwindcss-rtl` abandonné 2022, incompatible config CSS-first v4 ; `tailwindcss-logical` redondant (v4 l'intègre). NE PAS installer. |
| `profiles.role` lu serveur | `role` dans JWT app_metadata | ❌ Désync token/DB, révocation difficile, `getSession()` non revérifié (Pitfall #7/AP3). |
| Enum natif Postgres pour `role` | `text` + `check (role in (...))` | **Recommandation : `text` + `check`** — cohérent avec le codebase (0006/0001 utilisent `check`), pas de migration `ALTER TYPE … ADD VALUE` (non transactionnel) si on ajoute un rôle plus tard. Voir §Templates SQL. |

**Installation :**
```bash
# apps/web — i18n + Tailwind v4 (absent du package.json actuel)
pnpm --filter web add next-intl@4.13.0
pnpm --filter web add -D tailwindcss@4.3.1 @tailwindcss/postcss@4.3.1
# RTL = natif Tailwind v4 (aucun paquet)
# Régénération des types après migrations :
supabase gen types typescript --linked > packages/supabase/src/database.types.ts
```

**Version verification (npm, 2026-06-14) :**
- `next-intl` 4.13.0 (latest) — peerDep `next: ^12..^16`, `react: >=19` ✓ [VERIFIED: npm registry]
- `tailwindcss` 4.3.1 (latest) [VERIFIED: npm registry]
- `@tailwindcss/postcss` 4.3.1 (latest) [VERIFIED: npm registry]

## Package Legitimacy Audit

> slopcheck non disponible en session (pip/binaire absents) ; toutes les nouvelles deps sont des paquets verrouillés du milestone, déjà figurant dans CLAUDE.md/STACK.md, vérifiés sur le registre npm avec dates de publication récentes et dépôts source connus.

| Package | Registry | Age (source repo) | Source Repo | slopcheck | Disposition |
|---------|----------|-------------------|-------------|-----------|-------------|
| next-intl | npm | Maintenu activement (4.13.0, publié 2026-06-05) | github.com/amannn/next-intl | N/A (indisponible) | Approuvé — verrouillé STACK.md, vérifié npm |
| tailwindcss | npm | Core, très actif | github.com/tailwindlabs/tailwindcss | N/A | Approuvé — core verrouillé |
| @tailwindcss/postcss | npm | Officiel Tailwind v4 | github.com/tailwindlabs/tailwindcss | N/A | Approuvé — paquet officiel monorepo Tailwind |

**Packages removed due to slopcheck [SLOP] verdict :** none
**Packages flagged as suspicious [SUS] :** none
**À NE PAS installer (vérifié non maintenu / incompatible) :** `tailwindcss-rtl` (abandonné 2022), `tailwindcss-logical` (redondant v4), `next-i18next` (Pages Router).

*slopcheck étant indisponible, le planner peut traiter ces 3 paquets comme `[ASSUMED]` et insérer un `checkpoint:human-verify` avant `pnpm add` s'il préfère. Risque faible : ce sont des paquets verrouillés et largement adoptés, vérifiés npm.*

## Architecture Patterns

### System Architecture Diagram

```
                          requête  /[locale]/...
                                │
                                ▼
   ┌────────────────────── middleware.ts (racine, unique) ──────────────────────┐
   │  1. handleI18n(req)  → résout locale, rewrite, set cookie NEXT_LOCALE       │
   │                        (next-intl voit l'URL BRUTE)  → produit `response`   │
   │  2. updateSession(req, response) → refresh getUser() sur CETTE response     │
   │     (cheap redirect possible : non-auth hors segments gated)                │
   └───────────────────────────────┬─────────────────────────────────────────────┘
                                    │ locale résolue + session fraîche
                                    ▼
   ┌──────────────────────────── app/[locale]/layout.tsx (RSC) ─────────────────┐
   │  <html lang={locale} dir={locale==='ar'?'rtl':'ltr'}>                       │
   │  setRequestLocale(locale)  →  NextIntlClientProvider(messages)              │
   └───────┬──────────────────────────┬───────────────────────────┬─────────────┘
           │ (marketing) public       │ (member) GATED            │
           ▼                          ▼                            ▼
   anon-client lit                requireActiveSub() ───┐   requireRole('superadmin')  (admin) HORS [locale]
   (RLS publique)                 getUser()+sub active  │   getUser()+profiles.role    → 404 si non
                                  sinon redirect /tarifs│
                                          │             │
                                          ▼ pages lisent trade_setups/analyses (anon-client)
                          ┌────────────────────────────────────────────┐
                          │  Supabase Postgres — RLS (barrière réelle)  │
                          │  trade_setups/analyses SELECT USING(        │
                          │     has_active_subscription() )  ← migr.0009 │
                          │  profiles.role ← migr.0008                   │
                          │  is_superadmin()/has_active_subscription()   │
                          │     SECURITY DEFINER search_path=public       │
                          └────────────────────────────────────────────┘
                                          ▲ service_role bypass (jobs, inchangé)
```

### Recommended Project Structure (greffe sur l'existant)
```
apps/web/
├── middleware.ts                    # MODIFIÉ : compose handleI18n + updateSession + capture ?ref (no-op P1)
├── postcss.config.mjs               # NOUVEAU : { plugins: { '@tailwindcss/postcss': {} } }
├── next.config.ts                   # MODIFIÉ : wrap avec createNextIntlPlugin('./src/i18n/request.ts')
└── src/
    ├── i18n/
    │   ├── routing.ts               # NOUVEAU : defineRouting({ locales:['fr','en','ar'], defaultLocale:'fr', localePrefix:'always' })
    │   ├── navigation.ts            # NOUVEAU : createNavigation(routing) → Link/redirect/usePathname/useRouter localisés
    │   └── request.ts               # NOUVEAU : getRequestConfig → charge messages/{locale}.json
    ├── messages/
    │   ├── fr.json                  # NOUVEAU : namespaces (common, nav, auth, access…)
    │   ├── en.json                  # NOUVEAU
    │   └── ar.json                  # NOUVEAU
    ├── styles/globals.css           # NOUVEAU : @import "tailwindcss"; (+ @theme minimal, font arabe)
    ├── lib/
    │   ├── auth/gate.ts             # NOUVEAU : requireUser / requireActiveSub / requireRole
    │   └── supabase/middleware.ts   # MODIFIÉ : updateSession(request, response?) accepte une response existante
    └── app/
        ├── [locale]/                # NOUVEAU segment — déplace (auth)/, dashboard/ ICI
        │   ├── layout.tsx           #   <html lang dir> + setRequestLocale + NextIntlClientProvider + globals.css
        │   ├── (auth)/login|signup  #   DÉPLACÉ depuis app/(auth)
        │   ├── (marketing)/tarifs/  #   NOUVEAU stub (cible de redirection D-07) — contenu réel P2
        │   ├── (member)/            #   NOUVEAU route group gated
        │   │   ├── layout.tsx       #     await requireActiveSub()
        │   │   └── (dashboard déplacé ici ou sous membre selon planner)
        │   └── (affiliate)/         #   (optionnel P1 : layout gate role=affiliate ; surfaces réelles P7)
        └── (admin)/                 # NOUVEAU, HORS [locale] (mono-langue)
            └── layout.tsx           #   await requireRole('superadmin') sinon notFound() (404, D-09)

supabase/migrations/
├── 0008_profiles_role.sql           # NOUVEAU : ALTER TABLE profiles ADD role + check + policy is_superadmin lecture
└── 0009_subscriptions_gating.sql    # NOUVEAU : table subscriptions + helpers RLS + MODIFIE policies trade_setups/analyses

packages/supabase/
├── src/database.types.ts            # RÉGÉNÉRÉ après 0008/0009
├── src/repositories/                # +subscriptionsRepo (optionnel P1)
└── __tests__/
    └── gating-rls.test.ts           # NOUVEAU : non-abonné → 0 setup ; cross-role ; expiré → 0
```

**Note structure :** Le `app/(auth)` et `app/dashboard` actuels DOIVENT migrer sous `[locale]/`. Le `app/layout.tsx` racine actuel (`<html lang="fr">`) devient un layout minimal (ou disparaît) ; le vrai `<html>` avec `lang`/`dir` dynamiques vit dans `[locale]/layout.tsx`. Next 15 autorise un seul `<html>`/`<body>` — vérifier qu'il n'est PAS dupliqué entre le root layout et `[locale]/layout`.

### Pattern 1 : Wiring next-intl 4.x (App Router, i18n routing)

**What:** 4 fichiers de config + plugin + segment `[locale]`.
**When to use:** une fois, fondation i18n.

```typescript
// src/i18n/routing.ts
// [CITED: next-intl.dev/docs/routing/setup] [ASSUMED: signature exacte 4.x]
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['fr', 'en', 'ar'],   // D-03
  defaultLocale: 'fr',           // D-02
  localePrefix: 'always',        // D-01 — toutes les URLs préfixées
})
```

```typescript
// src/i18n/navigation.ts
// [CITED: next-intl.dev/docs/routing/navigation]
import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
// Utiliser CES Link/redirect partout (préfixent la locale automatiquement) — D-10
```

```typescript
// src/i18n/request.ts
// [CITED: next-intl.dev/docs/getting-started/app-router] [ASSUMED: hasLocale 4.x]
import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
```

```typescript
// next.config.ts — MODIFIÉ (préserver l'existant : transpilePackages, turbopack root)
import createNextIntlPlugin from 'next-intl/plugin'
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
// ... nextConfig existant ...
export default withNextIntl(nextConfig)
```

```typescript
// app/[locale]/layout.tsx
// [CITED: next-intl.dev/docs/getting-started/app-router] [ASSUMED: setRequestLocale path 4.x]
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { setRequestLocale, getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import '@/styles/globals.css'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)                       // garde le rendu statique (sinon dynamique forcé)
  const messages = await getMessages()
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>  {/* I18N-02 */}
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
```

> ⚠️ **`setRequestLocale` oublié = rendu dynamique non voulu.** À appeler dans CHAQUE layout ET page statique sous `[locale]` (vitrine), sinon next-intl bascule la route en dynamique. (Voir Pitfall i18n.)

### Pattern 2 : Middleware composé (locale → session)

**What:** Chaîner `handleI18n` (next-intl) PUIS `updateSession` sur la même response.
**When to use:** middleware racine unique.
**Trade-offs:** Ordre sensible — next-intl doit voir l'URL brute et produire la response (rewrite + cookie locale) ; `updateSession` doit muter CETTE response (pas une nouvelle), sinon le rewrite locale OU le refresh session est perdu.

```typescript
// middleware.ts (racine) — MODIFIÉ
import createMiddleware from 'next-intl/middleware'
import { type NextRequest } from 'next/server'
import { routing } from './src/i18n/routing'
import { updateSession } from './src/lib/supabase/middleware'

const handleI18n = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  const response = handleI18n(request)        // 1. locale + rewrite + cookie NEXT_LOCALE
  // (P1 : capture ?ref no-op ici ; activée en P7)
  return await updateSession(request, response) // 2. refresh getUser() SUR cette response
}

export const config = {
  // matcher : exclure assets + _next ; couvrir routes UI (next-intl recommande son propre matcher)
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

```typescript
// src/lib/supabase/middleware.ts — MODIFIÉ : accepter une response existante à muter
export async function updateSession(
  request: NextRequest,
  response: NextResponse,           // ← NOUVEAU paramètre (la response de next-intl)
): Promise<NextResponse> {
  const supabase = createServerClient<Database>(URL, ANON, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        // NE PAS recréer la response (préserve le rewrite locale next-intl) :
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as Record<string, unknown>))
      },
    },
  })
  await supabase.auth.getUser()     // invariant : getUser(), jamais getSession()
  return response
}
```

> ⚠️ Le `updateSession` actuel **recrée** `response = NextResponse.next({request})` dans `setAll` — ce qui écraserait le rewrite locale de next-intl. La version composée doit muter la response transmise, jamais en recréer une. (Voir Pitfall ordre middleware.)

### Pattern 3 : RSC Layout Gate + RLS (défense en profondeur)

**What:** Le layout serveur fait la porte UX ; la RLS fait la porte données.
**When to use:** chaque segment gated (`(member)`, `(affiliate)`, `(admin)`).

```typescript
// app/[locale]/(member)/layout.tsx
import { requireActiveSub } from '@/lib/auth/gate'
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  await requireActiveSub()  // getUser() + subscriptions active sinon redirect('/tarifs') (D-07)
  return <>{children}</>     // les pages lisent trade_setups via anon-client → RLS re-tranche (ACCESS-02)
}
```

### Pattern 4 : `lib/auth/gate.ts` — lecture du rôle/abonnement APRÈS getUser()

**What:** centralise les 3 portes, jamais de logique de sécurité copiée.
**When to use:** tous les segments gated.

```typescript
// src/lib/auth/gate.ts (RSC helpers)
import 'server-only'
import { cookies, headers } from 'next/headers'
import { redirect } from '@/i18n/navigation'           // redirect localisé
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@app/supabase'

async function client() {
  return createServerSupabaseClient(await cookies())
}

export async function requireUser() {
  const supabase = await client()
  const { data: { user } } = await supabase.auth.getUser()   // jamais getSession() (Pitfall #7)
  if (!user) {
    const path = (await headers()).get('x-pathname') ?? '/'  // ou via middleware header
    redirect({ href: { pathname: '/login', query: { returnTo: path } }, locale: /* current */ 'fr' }) // D-08
  }
  return user!
}

export async function requireActiveSub() {
  const user = await requireUser()
  const supabase = await client()
  // RLS subscriptions: l'user ne lit que les siennes ; on vérifie qu'au moins une est active
  const { data } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('status', 'active')
    .gt('current_period_end', new Date().toISOString())
    .limit(1)
  if (!data || data.length === 0) redirect('/tarifs')         // D-07 (funnel, pas login)
  return user
}

export async function requireRole(role: 'superadmin' | 'affiliate') {
  const user = await requireUser()
  const supabase = await client()
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (data?.role !== role) {
    if (role === 'superadmin') notFound()   // 404 discrétion (D-09)
    redirect('/')                            // affiliate : redirection neutre
  }
  return user
}
```

> Le gate est la **porte UX** ; il NE remplace PAS la RLS. `requireActiveSub` peut s'appuyer sur la lecture `subscriptions` filtrée par RLS, mais la non-fuite des signaux dépend de la RLS sur `trade_setups`/`analyses`, pas du gate.

### Pattern 5 : LTR-dans-RTL (prix / nombres / dates) — I18N-02 + I18N-04

```tsx
// Montant/prix dans un flux arabe : isoler la direction avec <bdi> + Intl
import { useFormatter } from 'next-intl'
function Price({ value }: { value: number }) {
  const format = useFormatter()
  // <bdi> empêche l'inversion bidi du nombre/symbole dans un paragraphe RTL
  return <bdi>{format.number(value, { style: 'currency', currency: 'USD' })}</bdi>
}
// Dates : format.dateTime(date, { dateStyle: 'medium' }) — locale-aware (I18N-04)
```

### Anti-Patterns to Avoid
- **AP1 — Gater les signaux uniquement au layout (sans RLS) :** le front lit en anon-client ; un appel direct devtools/script aspire tout. → RLS `has_active_subscription()` obligatoire (Pitfall #5).
- **AP3 — Rôle dans le JWT :** désync, révocation difficile. → `profiles.role` + `getUser()` + `is_superadmin()` (Pitfall #7).
- **AP4 — i18n/RTL après coup :** refactor global des marges/alignements. → poser `[locale]` + `ms-*/me-*` + `dir` dès la 1re page.
- **`(admin)` sous `[locale]` :** mélange traduction inutile + complique le matcher. → garder `(admin)` HORS `[locale]`.
- **Classes physiques `ml-*/mr-*/pl-*/pr-*/left-*/right-*/text-left` dans le nouveau code :** ne s'inversent pas en RTL. → propriétés logiques (`ms-*/me-*/ps-*/pe-*/start-*/end-*/text-start`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Routing localisé `/fr|/en|/ar` | Routeur i18n maison + parsing URL | next-intl `defineRouting`/middleware | Gère prefix, cookie, rewrite, fallback, redirections |
| Chargement messages par locale | `fetch`/import manuel par composant | `getRequestConfig` + `useTranslations`/`getTranslations` | Split par namespace, RSC + client cohérents |
| Inversion RTL des marges/paddings | Classes conditionnelles `dir==='ar'?'mr':'ml'` | Propriétés logiques natives Tailwind v4 | S'inversent automatiquement selon `dir`, zéro condition |
| Formatage nombres/dates/devises | `toLocaleString` éparpillé + arrondis maison | `Intl` via next-intl `useFormatter`/`getFormatter` | Pluriels arabes ICU, devises, cohérence locale |
| Vérif d'abonnement anti-fuite | Filtre applicatif côté JS sur les résultats | RLS Postgres `has_active_subscription()` | Le seul point non contournable ; le filtre JS est by-passé par appel direct |
| Récursion de policy RLS | Policy qui lit une table elle-même protégée | Helper `security definer` `search_path` figé | Évite la récursion + l'injection de schéma |
| Isolation cross-user du rôle | Comparer un claim JWT | `profiles.role` lu après `getUser()` + RLS | JWT non revérifié → élévation de privilège |

**Key insight :** Dans ce domaine, **toute barrière qui vit côté front est cosmétique**. La sécurité du revenu repose ENTIÈREMENT sur la RLS Postgres. Le gate UX et le middleware améliorent l'expérience (redirections) mais ne protègent rien à eux seuls.

## Runtime State Inventory

> Phase de type « ajout migration + déplacement de routes » (pas un pur rename, mais touche du state). Inventaire explicite :

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `profiles` existe (id/email/created_at), liée à `auth.users` par trigger `handle_new_user` (search_path=''). Pas de colonne `role`. | Migration 0008 : `ALTER TABLE` additif (DEFAULT 'member' pour les lignes existantes). Le trigger n'écrit PAS `role` → le DEFAULT couvre les nouveaux users. |
| Live service config | Supabase cloud : « Confirm email » OFF (D-02 v1.0), connecté via MCP. Migrations appliquées via MCP `apply_migration` (PAS `db push`, cf. 0006). | Appliquer 0008/0009 via le même canal (MCP apply_migration / Supabase CLI linked). Checkpoint human-action probable (cloud). |
| OS-registered state | Aucun pour cette phase (Windows Task Scheduler concerne les jobs d'ingestion, non touchés). | None — vérifié (phase front + DB schema). |
| Secrets/env vars | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (tests). Pas de nouveau secret en P1. | None — réutilise l'existant. `.env.test` requis pour les tests RLS GREEN. |
| Build artifacts | `database.types.ts` (généré) deviendra stale après 0008/0009 ; `apps/web/tsconfig.tsbuildinfo`. `app/layout.tsx` root + routes `(auth)`/`dashboard` déplacées sous `[locale]`. | Régénérer `database.types.ts` (`supabase gen types`). Vérifier que les imports vers `(auth)`/`dashboard` suivent le déplacement. |

## Common Pitfalls

### Pitfall 1 : Gating UI sans RLS — fuite du contenu payant (Pitfall #5 / AP1)
**What goes wrong :** abonnement vérifié seulement dans `(member)/layout.tsx`, `trade_setups`/`analyses` restent en `select to authenticated using(true)` (0006). Le front lit en anon-client → un appel direct (devtools, script supabase-js) aspire tous les signaux.
**Why it happens :** on croit que la porte du layout suffit.
**How to avoid :** migration 0009 REMPLACE la policy par `using(public.has_active_subscription())` sur les deux tables. Helper `security definer` `search_path=public`. Test anon-client « non-abonné → 0 ligne ».
**Warning signs :** aucune policy modifiée sur trade_setups en migration ; test « non-abonné lit 0 signal » absent.

### Pitfall 2 : Ordre middleware cassant getUser/locale
**What goes wrong :** `updateSession` exécuté avant next-intl, OU `updateSession` recrée la response → le rewrite locale est perdu OU le refresh session ne se propage pas. Symptômes : locale qui « saute », session non rafraîchie en RSC.
**Why it happens :** le `updateSession` actuel fait `response = NextResponse.next({request})` dans `setAll`.
**How to avoid :** locale d'abord (`handleI18n` produit la response), puis `updateSession(request, response)` qui MUTE cette response (Pattern 2). Tester la matrice locale × authentifié.
**Warning signs :** `NextResponse.next()` recréé dans le middleware composé ; cookies de session absents en aval.

### Pitfall 3 : `setRequestLocale` oublié → rendu dynamique
**What goes wrong :** une page/layout sous `[locale]` sans `setRequestLocale(locale)` bascule la route en rendu dynamique (perte du SSG pour la future vitrine, perf dégradée).
**How to avoid :** appeler `setRequestLocale(locale)` dans le layout `[locale]` ET chaque page statique. `generateStaticParams` retourne toutes les locales.
**Warning signs :** vitrine rendue dynamiquement ; warning next-intl en build.

### Pitfall 4 : Rôle dans le JWT (Pitfall #7 / AP3)
**What goes wrong :** `role` stocké en app_metadata, gating dessus → token stale conserve un privilège.
**How to avoid :** `profiles.role` (0008), lu serveur après `getUser()`, jamais `getSession()`. RLS via `is_superadmin()`.
**Warning signs :** `role` écrit en app_metadata ; `getSession()` dans un gate.

### Pitfall 5 : Classes physiques résiduelles cassant le RTL (Pitfall #11 / AP4)
**What goes wrong :** `ml-*/mr-*/left-*/text-left` ne s'inversent pas en arabe → layout cassé.
**How to avoid :** propriétés logiques uniquement (`ms-*/me-*/start-*/text-start`). Variants `rtl:`/`ltr:` pour les exceptions (flèches). Grep le nouveau code.
**Warning signs :** classes physiques dans le diff ; prix/dates inversés en arabe (manque `<bdi>`).

### Pitfall 6 : Helper RLS sans `search_path` figé → récursion/injection
**What goes wrong :** `has_active_subscription()`/`is_superadmin()` sans `set search_path` → récursion de policy (la fonction lit une table elle-même protégée) ou détournement de schéma.
**How to avoid :** `security definer set search_path = public` (miroir de `handle_new_user` qui utilise `search_path=''` en 0001). `stable`. Référencer les tables en `public.xxx`.
**Warning signs :** fonction sans `set search_path` ; erreur de récursion à la lecture des signaux.

### Pitfall 7 : `<html>`/`<body>` dupliqués entre root layout et `[locale]/layout`
**What goes wrong :** le `app/layout.tsx` actuel rend `<html lang="fr"><body>`. Si `[locale]/layout.tsx` rend AUSSI `<html dir>`, Next 15 produit deux `<html>` → DOM invalide, `dir` non appliqué.
**How to avoid :** le `<html>`/`<body>` avec `lang`/`dir` dynamiques vit UNIQUEMENT dans `[locale]/layout.tsx`. Réduire le root layout à un pass-through (`return children`) ou le supprimer si Next l'autorise pour cette structure.
**Warning signs :** deux `<html>` dans le HTML rendu ; `dir` absent malgré la locale ar.

## Code Examples

### Migration 0008 — profiles.role (text + check, recommandé)
```sql
-- supabase/migrations/0008_profiles_role.sql
-- D-05 : role member/affiliate/superadmin, lu serveur après getUser() (jamais JWT)
-- Choix text+check (cohérent 0001/0006 ; pas d'ALTER TYPE non transactionnel plus tard)
alter table public.profiles
  add column role text not null default 'member'
  check (role in ('member', 'affiliate', 'superadmin'));

-- Helper is_superadmin (security definer, search_path figé — Pitfall 6)
create function public.is_superadmin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'superadmin'
  );
$$;
revoke execute on function public.is_superadmin() from public, anon;  -- défensif
grant execute on function public.is_superadmin() to authenticated;

-- (l'user lit déjà sa propre ligne profiles via 0001 ; pas de nouvelle policy requise P1)
```

### Migration 0009 — subscriptions squelette + gating RLS
```sql
-- supabase/migrations/0009_subscriptions_gating.sql
-- D-04 : squelette RÉEL (pas de stub) ; à ce stade 0 abonnement → tout user lit 0 setup
-- D-06 : has_active_subscription() security definer ; applique sur trade_setups + analyses

create table public.subscriptions (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references public.profiles(id) on delete cascade,
  status              text        not null default 'pending'
                                  check (status in ('pending','active','expired','canceled')),
  plan                text        not null default 'standard'
                                  check (plan in ('discovery','standard')),  -- P4 enrichit
  current_period_end  timestamptz,                    -- null tant que non activé
  created_at          timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- L'user lit les SIENNES (jamais celles des autres)
create policy "subscriptions: lire les siennes"
  on public.subscriptions for select to authenticated
  using (user_id = auth.uid());
-- Superadmin voit tout (policy additive)
create policy "subscriptions: superadmin voit tout"
  on public.subscriptions for select to authenticated
  using (public.is_superadmin());
-- AUCUNE policy insert/update/delete pour authenticated → activation = service_role (P4)

create index subscriptions_active_idx
  on public.subscriptions (user_id, status, current_period_end);

-- Helper gating (security definer, search_path figé)
create function public.has_active_subscription() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = auth.uid()
      and s.status = 'active'
      and s.current_period_end > now()
  );
$$;
revoke execute on function public.has_active_subscription() from public, anon;
grant execute on function public.has_active_subscription() to authenticated;

-- MODIFIE la policy 0006 : signaux réservés aux abonnés actifs (Pitfall #5)
drop policy "trade_setups: lecture authentifiés" on public.trade_setups;
create policy "trade_setups: abonnés actifs"
  on public.trade_setups for select to authenticated
  using (public.has_active_subscription());

drop policy "analyses: lecture authentifiés" on public.analyses;
create policy "analyses: abonnés actifs"
  on public.analyses for select to authenticated
  using (public.has_active_subscription());
```

> ⚠️ Vérifier le nom EXACT de la policy à `drop` (lu dans 0006 : `"trade_setups: lecture authentifiés"` et `"analyses: lecture authentifiés"`). Un nom erroné fait échouer la migration.

### Test gating (Vitest intégration anon-client — réplique rls.test.ts)
```typescript
// packages/supabase/__tests__/gating-rls.test.ts (extrait du pattern existant)
// ACCESS-02/04 : un user authentifié SANS abonnement actif lit 0 trade_setup
it('non-abonné lit 0 trade_setup via anon-client (RLS has_active_subscription)', async () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return
  const { data, error } = await clientA.from('trade_setups').select('id')
  expect(error, `SELECT trade_setups: ${error?.message}`).toBeNull()
  expect(data).toHaveLength(0)   // 0 abonnement → 0 ligne (Pitfall #5)
})
it('non-abonné lit 0 analyses via anon-client', async () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return
  const { data } = await clientA.from('analyses').select('id')
  expect(data).toHaveLength(0)
})
// ACCESS-03 cross-role : un member ne peut PAS lire via is_superadmin() les lignes superadmin-only
// (à compléter quand des données superadmin existent ; P1 prouve au moins l'isolation subscriptions)
```

### globals.css + postcss (Tailwind v4)
```css
/* src/styles/globals.css */
@import "tailwindcss";   /* v4 : remplace les 3 @tailwind directives */
/* @theme minimal (D-11) — design system complet en P2 */
@theme {
  --font-arabic: "Noto Sans Arabic", system-ui, sans-serif;
}
/* Police arabe mappée sur :lang(ar) */
:lang(ar) { font-family: var(--font-arabic); }
```
```javascript
// apps/web/postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwindcss-rtl` plugin | Propriétés logiques natives v4 (`ms-*/me-*`) | Tailwind v4 | Aucun plugin RTL ; `tailwindcss-rtl` abandonné 2022, incompatible v4 |
| `tailwind.config.js` | CSS-first `@theme` + `@import "tailwindcss"` | Tailwind v4 | Config dans le CSS ; `@tailwindcss/postcss` plugin |
| next-intl 3.x `createSharedPathnamesNavigation` | next-intl 4.x `createNavigation(routing)` + `defineRouting` | next-intl 4.0 | API unifiée ; suivre la doc 4.x, pas les tutos 3.x |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` (getAll/setAll + getUser) | déjà adopté (v1.0) | Invariant à préserver |
| `role` dans JWT/app_metadata | `profiles.role` + `getUser()` + RLS helper | décision projet (D-V2-05) | Pas de désync token/DB |

**Deprecated/outdated :**
- next-intl 3.x navigation APIs : remplacées par `createNavigation` en 4.x — ignorer les exemples 3.x.
- `tailwindcss-rtl` / `tailwindcss-logical` : ne pas installer.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Signatures next-intl 4.x exactes (`defineRouting`, `createNavigation`, `getRequestConfig({requestLocale})`, `setRequestLocale` depuis `next-intl/server`, `hasLocale` depuis `next-intl`) | Pattern 1 | LOW — confirmé par WebSearch (noms de fonctions next-intl.dev) ; détail d'import à valider à l'implémentation contre la doc 4.13 (Context7 indisponible en session) |
| A2 | `createMiddleware(routing)` retourne une fonction `(req) => NextResponse` mutable composable avec updateSession | Pattern 2 | MEDIUM — l'API existe ; la composition exacte (muter la response next-intl) à valider par test de la matrice locale×session |
| A3 | `text + check` préférable à enum natif Postgres pour `role` | Standard Stack / SQL | LOW — cohérent codebase ; reste un choix Claude's Discretion (D-05 laisse le détail libre) |
| A4 | `revoke execute … from public/anon` sur les helpers est compatible avec leur usage en policy (security definer s'exécute comme le owner) | SQL 0008/0009 | LOW — pratique standard Supabase ; à vérifier que la policy ne casse pas (les policies invoquent la fonction dans le contexte du rôle ; security definer couvre l'accès aux tables) |
| A5 | Le root `app/layout.tsx` peut être réduit/supprimé sans casser Next 15 quand `[locale]/layout` porte `<html>` | Pitfall 7 / Structure | MEDIUM — Next exige un `<html>`/`<body>` ; valider qu'il n'y en a qu'un seul (root pass-through OU root supprimé selon ce que Next autorise pour un segment `[locale]` racine) |
| A6 | `current_period_end` est le nom de colonne souhaité (vs `expires_at` utilisé dans ARCHITECTURE.md) | SQL 0009 | LOW — CONTEXT.md D-05 cite `current_period_end` ; ARCHITECTURE.md cite `expires_at`. **Aligner avec le planner** ; le helper RLS doit référencer le même nom. |

**Note A6 (à trancher en planification) :** CONTEXT.md (discrétion) suggère `current_period_end` ; le template RLS d'ARCHITECTURE.md utilise `expires_at`. Choisir UN nom et l'utiliser dans la table ET dans `has_active_subscription()`. Recommandation : `current_period_end` (aligné Stripe-like, cité par l'utilisateur).

## Open Questions

1. **Où va `dashboard` actuel après le déplacement sous `[locale]` ?**
   - What we know : `app/dashboard/page.tsx` existe (v1.0), lit probablement des données authentifiées.
   - What's unclear : devient-il `(member)/dashboard` (gated abonnement) ou reste-t-il une page authentifiée simple (non gated) en P1 ?
   - Recommendation : le déplacer sous `[locale]/` ; le placer sous `(member)` SEULEMENT s'il affiche des signaux. Sinon le laisser authentifié simple. À trancher par le planner selon son contenu.

2. **`returnTo` : comment le gate connaît-il le pathname courant ?**
   - What we know : `redirect('/login?returnTo=...')` (D-08) nécessite le chemin demandé.
   - What's unclear : RSC n'a pas accès direct à l'URL ; option = header `x-pathname` injecté par le middleware.
   - Recommendation : le middleware composé écrit un header `x-pathname` (ou `x-url`) sur la response ; `requireUser` le lit via `headers()`. Pattern courant App Router.

3. **Faut-il finaliser le wiring auth (login/signup) en P1 ?**
   - What we know : actions auth sont des squelettes fonctionnels (signUp/signIn/signOut) ; redirigent vers `/dashboard` (chemin sans locale).
   - What's unclear : les redirections auth doivent passer aux Link/redirect localisés.
   - Recommendation : adapter les redirections auth (`/dashboard` → localisé) — minimal, requis pour que le gating soit testable de bout en bout (CONTEXT.md discrétion l'autorise).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm workspaces | install next-intl/tailwind | ✓ (monorepo en place) | 9.x | — |
| Supabase CLI (`supabase gen types`, migrations) | régénération types + apply 0008/0009 | ✓ (MCP connecté ; CLI linked attendu) | — | MCP `apply_migration` |
| Supabase cloud project | tests RLS GREEN (anon-client) | ✓ (v1.0 utilise déjà) | — | tests RED sans `.env.test` (pattern existant) |
| `.env.test` (URL + ANON + SERVICE_ROLE) | tests d'intégration RLS | ⚠️ à vérifier | — | tests skip si absent (pattern `if (!SUPABASE_URL) return`) |

**Missing dependencies with no fallback :** aucune bloquante.
**Missing dependencies with fallback :** `.env.test` — sans elle les tests RLS restent RED/skip (pattern existant accepté). Checkpoint human-action probable pour appliquer 0008/0009 sur le cloud + remplir `.env.test`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (intégration RLS) + Playwright 1.60.0 (E2E) |
| Config file | `vitest.config.ts` (racine), `playwright.config.ts` (racine) |
| Quick run command | `pnpm --filter @app/supabase test` (tests RLS ciblés) |
| Full suite command | `pnpm test` (Vitest workspace) puis `pnpm test:e2e` (Playwright) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACCESS-02 | non-abonné lit 0 trade_setup (anon-client) | integration | `pnpm --filter @app/supabase test gating-rls` | ❌ Wave 0 (`packages/supabase/__tests__/gating-rls.test.ts`) |
| ACCESS-04 | non-abonné lit 0 analyses ; abonné expiré → 0 | integration | idem | ❌ Wave 0 |
| ACCESS-03 | member ne lit pas données superadmin-only ; isolation subscriptions cross-user | integration | idem (étendre `rls.test.ts` pattern) | ❌ Wave 0 |
| ACCESS-01 | visiteur non-auth redirigé hors `(member)` vers login+returnTo | e2e | `pnpm test:e2e gating` | ❌ Wave 0 (`apps/web/e2e/gating.spec.ts`) |
| ACCESS-03 | non-superadmin sur `(admin)` → 404 | e2e | idem | ❌ Wave 0 |
| I18N-01 | bascule FR/EN/AR, locale dans l'URL, persiste (cookie) | e2e | `pnpm test:e2e i18n` | ❌ Wave 0 (`apps/web/e2e/i18n.spec.ts`) |
| I18N-02 | `dir=rtl` sur `<html>` en ar ; prix non inversés (`<bdi>`) | e2e | idem | ❌ Wave 0 |
| I18N-03 | aucune chaîne en dur (grep) | static check | `pnpm lint:i18n` ou grep CI | ❌ Wave 0 (script grep) |
| I18N-04 | nombres/dates formatés par locale | unit/e2e | `pnpm test:e2e i18n` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit :** `pnpm --filter @app/supabase test gating-rls` (RLS = cœur sécurité) + `pnpm --filter web typecheck`/`build`.
- **Per wave merge :** `pnpm test` (Vitest full) + `pnpm test:e2e` (Playwright).
- **Phase gate :** suite complète verte + revue visuelle RTL arabe avant `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/supabase/__tests__/gating-rls.test.ts` — couvre ACCESS-02/03/04 (réplique le pattern `rls.test.ts`)
- [ ] `apps/web/e2e/i18n.spec.ts` — couvre I18N-01/02/04 (bascule locale, `dir`, formatage)
- [ ] `apps/web/e2e/gating.spec.ts` — couvre ACCESS-01/03 (redirections, 404 admin)
- [ ] Script grep anti-chaîne-dure (I18N-03) — CI : échoue si JSX contient du texte littéral hors `messages/`
- [ ] `.env.test` rempli (URL + ANON + SERVICE_ROLE) — sinon tests RLS skip (pattern existant)
- [ ] Vitest config : s'assurer que `packages/supabase/__tests__` est inclus dans le workspace (déjà le cas pour `rls.test.ts`)

## Security Domain

> `security_enforcement` non désactivé → section incluse. Cette phase EST le cœur sécurité du milestone (gating revenu + rôles).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth + `getUser()` revérifié serveur (jamais `getSession()`) |
| V3 Session Management | yes | Refresh session au seul middleware racine ; cookies httpOnly @supabase/ssr |
| V4 Access Control | **yes (central)** | RLS Postgres `has_active_subscription()`/`is_superadmin()` (security definer) + RSC layout gate ; rôle hors JWT |
| V5 Input Validation | yes | `z.enum(['fr','en','ar'])` pour la locale ; `hasLocale` avant rendu ; check constraints SQL sur role/status |
| V6 Cryptography | no (P1) | Aucune crypto en P1 (paiement on-chain = P4) |

### Known Threat Patterns for Next 15 App Router + Supabase RLS
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Lecture directe des signaux via anon-client (contourne le layout) | Information Disclosure | RLS `has_active_subscription()` sur trade_setups/analyses ; test « 0 ligne » |
| Élévation de privilège via rôle dans JWT stale | Elevation of Privilege | `profiles.role` + `getUser()` + `is_superadmin()` ; jamais app_metadata |
| Récursion / injection de schéma dans helper RLS | Tampering / EoP | `security definer set search_path = public` ; tables en `public.xxx` ; `stable` |
| Énumération de l'existence du back-office | Information Disclosure | non-superadmin → `notFound()` (404), pas 403 (D-09) |
| `getSession()` cru dans une décision d'accès | Spoofing | `getUser()` partout (invariant existant à préserver) |

## Sources

### Primary (HIGH confidence)
- Codebase lu directement (2026-06-14) : `apps/web/middleware.ts`, `src/lib/supabase/middleware.ts` (`updateSession`/`getUser()`), `app/layout.tsx` (`<html lang="fr">` codé en dur), `app/(auth)/actions.ts`, `packages/supabase/src/anon-client.ts`, `packages/supabase/__tests__/rls.test.ts` (pattern test), `supabase/migrations/0001` (profiles + trigger search_path) & `0006` (RLS journal privé à étendre), `apps/web/next.config.ts`, `apps/web/package.json` (Tailwind ABSENT), `.planning/config.json` (nyquist_validation: true) — **HIGH** (source primaire)
- `.planning/research/STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `SUMMARY.md` (v2.0) — next-intl 4.13, RTL natif v4, modèle RLS multi-rôles, middleware composé, anti-patterns AP1/AP3/AP4 — **HIGH**
- `.planning/REQUIREMENTS.md` (I18N-01..04, ACCESS-01..04), `ROADMAP.md` Phase 1, `STATE.md` (D-V2-04/05), CONTEXT.md (D-01..D-11) — **HIGH**
- npm registry (vérifié 2026-06-14) : next-intl 4.13.0 (peerDep next ^12..^16 / react >=19), tailwindcss 4.3.1, @tailwindcss/postcss 4.3.1 — **HIGH**

### Secondary (MEDIUM confidence)
- WebSearch next-intl 4 App Router (defineRouting / createNavigation / getRequestConfig / setRequestLocale / hasLocale, déplacement sous `[locale]`) — recoupé next-intl.dev — **MEDIUM**
- WebSearch Tailwind v4 Next.js (`@tailwindcss/postcss`, `@import "tailwindcss"`, CSS-first `@theme`, logical properties natives) — recoupé tailwindcss.com — **MEDIUM**

### Tertiary (LOW confidence)
- Signatures d'import exactes next-intl 4.x (`setRequestLocale` depuis `next-intl/server`, `hasLocale` depuis `next-intl`) — training data + WebSearch, **à valider contre la doc 4.13 à l'implémentation** (Context7/ctx7 indisponibles en session) — **LOW** (voir Assumptions A1/A2)

## Metadata

**Confidence breakdown :**
- Standard stack : HIGH — versions verrouillées + vérifiées npm 2026-06-14.
- Architecture (middleware composé, gate, RLS) : HIGH — patterns du repo (0006, rls.test.ts) + recherche v2.0 ; détail d'API next-intl 4.x à confirmer (A1/A2).
- Pitfalls : HIGH — issus de PITFALLS.md v2.0 + invariants lus dans le codebase.
- Détail d'import next-intl 4.x : MEDIUM-LOW — Context7 indisponible ; tagué [ASSUMED], à valider.

**Research date :** 2026-06-14
**Valid until :** 2026-07-14 (stack stable ; next-intl/Tailwind évoluent — revérifier si > 30 jours)
