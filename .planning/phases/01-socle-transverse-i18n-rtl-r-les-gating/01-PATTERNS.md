# Phase 1: Socle transverse — i18n/RTL & rôles/gating - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 24 (created/modified/moved)
**Analogs found:** 18 / 24 (6 nouveaux sans analog → patterns RESEARCH.md)

> Defense-in-depth = 2 dimensions orthogonales. Gate UX (RSC layout, redirections) ≠ barrière données (RLS Postgres). Le gate améliore l'expérience ; **la RLS est la seule barrière non contournable** (front lit en anon-client). Tout fichier gate a un jumeau RLS.

---

## File Classification

| Fichier (créé/modifié/déplacé) | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `supabase/migrations/0008_profiles_role.sql` | migration | DDL + RLS | `0001_init_profiles...sql` (profiles + handle_new_user security definer) | exact |
| `supabase/migrations/0009_subscriptions_gating.sql` | migration | DDL + RLS | `0006_analyses_trade_setups.sql` (table + RLS authenticated + drop/recreate policies) | exact |
| `packages/supabase/src/database.types.ts` | model (généré) | — | déjà existant — RÉGÉNÉRER via `supabase gen types` | regen |
| `packages/supabase/__tests__/gating-rls.test.ts` | test | integration RLS | `packages/supabase/__tests__/rls.test.ts` | exact |
| `apps/web/src/i18n/routing.ts` | config | — | aucun (next-intl nouveau) | no-analog |
| `apps/web/src/i18n/navigation.ts` | config | — | aucun | no-analog |
| `apps/web/src/i18n/request.ts` | config | — | aucun | no-analog |
| `apps/web/src/messages/{fr,en,ar}.json` | config | — | aucun | no-analog |
| `apps/web/next.config.ts` | config | — | `apps/web/next.config.ts` (existant) | exact (modif) |
| `apps/web/postcss.config.mjs` | config | — | aucun (Tailwind v4 nouveau) | no-analog |
| `apps/web/src/styles/globals.css` | config | — | aucun | no-analog |
| `apps/web/middleware.ts` | middleware | request-response | `apps/web/middleware.ts` (existant) | exact (modif) |
| `apps/web/src/lib/supabase/middleware.ts` | middleware | request-response | `apps/web/src/lib/supabase/middleware.ts` (existant) | exact (modif) |
| `apps/web/src/lib/auth/gate.ts` | utility (RSC) | request-response | `apps/web/src/app/dashboard/page.tsx` (getUser+redirect) + `repositories/profiles.ts` (getUser+select) | role-match |
| `apps/web/src/app/[locale]/layout.tsx` | layout (RSC) | request-response | `apps/web/src/app/layout.tsx` (root `<html lang>`) | role-match |
| `apps/web/src/app/layout.tsx` | layout (RSC) | — | `apps/web/src/app/layout.tsx` (réduire/pass-through — Pitfall 7) | exact (modif) |
| `apps/web/src/app/[locale]/(auth)/login/page.tsx` | component (page) | — | `apps/web/src/app/(auth)/login/page.tsx` (DÉPLACÉ) | move |
| `apps/web/src/app/[locale]/(auth)/signup/page.tsx` | component (page) | — | `apps/web/src/app/(auth)/signup/page.tsx` (DÉPLACÉ) | move |
| `apps/web/src/app/[locale]/(auth)/actions.ts` | service (server action) | request-response | `apps/web/src/app/(auth)/actions.ts` (DÉPLACÉ + redirects localisés) | move+modif |
| `apps/web/src/app/[locale]/(member)/layout.tsx` | layout (RSC gate) | request-response | RESEARCH Pattern 3 (`requireActiveSub()`) | no-analog |
| `apps/web/src/app/[locale]/(member)/dashboard/page.tsx` | component (page) | CRUD-read | `apps/web/src/app/dashboard/page.tsx` (DÉPLACÉ sous member) | move |
| `apps/web/src/app/[locale]/(marketing)/tarifs/page.tsx` | component (page) | — | `apps/web/src/app/(auth)/login/page.tsx` (page placeholder simple) | role-match |
| `apps/web/src/app/(admin)/layout.tsx` | layout (RSC gate) | request-response | RESEARCH Pattern 4 (`requireRole('superadmin')`→notFound) | no-analog |
| `apps/web/src/components/LanguageSwitcher.tsx` | component (client) | event-driven | aucun (1er client component interactif) | no-analog |
| `apps/web/e2e/{i18n,gating}.spec.ts` | test | e2e | `apps/web/e2e/auth.spec.ts` | exact |

---

## Pattern Assignments

### `supabase/migrations/0008_profiles_role.sql` (migration, DDL+RLS)

**Analog:** `supabase/migrations/0001_init_profiles_instruments_job_runs.sql`

**`text + check` constraint pattern** (0001 lines 35-41 — broker/asset_class use `check (... in (...))`, PAS enum natif). Appliquer à `role` :
```sql
alter table public.profiles
  add column role text not null default 'member'
  check (role in ('member', 'affiliate', 'superadmin'));
```
> DEFAULT 'member' couvre les lignes existantes ET les nouveaux users (le trigger `handle_new_user` n'écrit PAS `role`).

**Security-definer helper pattern** (0001 lines 86-97 — `handle_new_user` est le modèle EXACT : `security definer set search_path`). Pour `is_superadmin()`, langage `sql stable` + `search_path = public` (helper RLS lit `public.profiles`, doit pouvoir résoudre le schéma) :
```sql
create function public.is_superadmin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'superadmin'
  );
$$;
```
> NOTE divergence search_path : `handle_new_user` (0001 l.90) utilise `search_path = ''` (plpgsql, références qualifiées partout). Les helpers RLS SQL utilisent `search_path = public` (référencent `public.profiles` directement). Les deux figent search_path — c'est l'invariant (Pitfall 6).

**Revoke/grant défensif** (PAS dans 0001/0006 — nouveau, voir migration 0002 `0002_revoke_execute_trigger_functions.sql` pour le pattern revoke execute) :
```sql
revoke execute on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated;
```

---

### `supabase/migrations/0009_subscriptions_gating.sql` (migration, DDL+RLS)

**Analog:** `supabase/migrations/0006_analyses_trade_setups.sql`

**Table + RLS authenticated pattern** (0006 lines 23-43 — table, `enable row level security`, policy `for select to authenticated`, AUCUNE policy write = service_role bypass). Pour `subscriptions`, scoper la lecture par `user_id = auth.uid()` (comme 0001 profiles l.19-22) :
```sql
create table public.subscriptions (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references public.profiles(id) on delete cascade,
  status              text        not null default 'pending'
                                  check (status in ('pending','active','expired','canceled')),
  plan                text        not null default 'standard'
                                  check (plan in ('discovery','standard')),
  current_period_end  timestamptz,
  created_at          timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "subscriptions: lire les siennes"
  on public.subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy "subscriptions: superadmin voit tout"
  on public.subscriptions for select to authenticated
  using (public.is_superadmin());
-- AUCUNE policy insert/update/delete → activation service_role (P4)
```
> Colonne = `current_period_end` (D-05, aligné Stripe-like). RESEARCH A6 : ARCHITECTURE.md cite `expires_at` — TRANCHÉ sur `current_period_end`, le helper RLS DOIT référencer le même nom.

**Index pattern** (0006 lines 86-87 `create index ... on (...)`):
```sql
create index subscriptions_active_idx
  on public.subscriptions (user_id, status, current_period_end);
```

**has_active_subscription() helper** (miroir `is_superadmin` de 0008) :
```sql
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
```

**DROP/RECREATE policy pattern — NOMS EXACTS À DROPER** (lus dans 0006 l.38-41 et l.78-81) :
```sql
-- nom EXACT de 0006 (sinon migration échoue) :
drop policy "trade_setups: lecture authentifiés" on public.trade_setups;
create policy "trade_setups: abonnés actifs"
  on public.trade_setups for select to authenticated
  using (public.has_active_subscription());

drop policy "analyses: lecture authentifiés" on public.analyses;
create policy "analyses: abonnés actifs"
  on public.analyses for select to authenticated
  using (public.has_active_subscription());
```
> ⚠️ Le nom EXACT des policies à drop est `"trade_setups: lecture authentifiés"` et `"analyses: lecture authentifiés"` (vérifié dans 0006). Un nom erroné fait échouer la migration.

---

### `packages/supabase/__tests__/gating-rls.test.ts` (test, integration RLS)

**Analog:** `packages/supabase/__tests__/rls.test.ts`

**Env guard + skip pattern** (rls.test.ts lines 28-30, 72-78 — vars lues, `if (!SUPABASE_URL ...) return` dans chaque `it`, test RED documenté si absent):
```typescript
const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? ''
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? ''
const SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''
```

**signUp helper + cleanup pattern** (rls.test.ts lines 36-53 — `signUpAndGetClient`, `deleteUser` via service_role, emails `@gmail.com` uniques par `Date.now()`, cleanup `afterAll`). Réutiliser tel quel.

**Assertion RLS « 0 ligne » pattern** (rls.test.ts lines 120-129 — `expect(error).toBeNull()` + `expect(data).toHaveLength(0)` pour deny silencieux). Cœur du test gating :
```typescript
it('non-abonné lit 0 trade_setup via anon-client (has_active_subscription)', async () => {
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
```
> Étendre : isolation cross-user `subscriptions` (clientA ne lit pas les abos de B — miroir rls.test.ts l.120-129) ; cross-role (member ne voit pas via `is_superadmin()`).

---

### `apps/web/src/lib/supabase/middleware.ts` (middleware, MODIFIÉ)

**Analog:** lui-même (existant, lines 14-44)

**À MODIFIER** : `updateSession(request)` → `updateSession(request, response)` qui MUTE la response passée (next-intl). Le code actuel (l.28-29) **recrée** `response = NextResponse.next({request})` dans `setAll` — ce qui ÉCRASE le rewrite locale de next-intl. Pattern cible (RESEARCH Pattern 2) :
```typescript
export async function updateSession(
  request: NextRequest,
  response: NextResponse,           // ← NOUVEAU param (response de next-intl)
): Promise<NextResponse> {
  const supabase = createServerClient<Database>(URL, ANON, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        // NE PAS recréer la response (préserve le rewrite locale) :
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as Record<string, unknown>))
      },
    },
  })
  await supabase.auth.getUser()     // invariant préservé : getUser(), jamais getSession()
  return response
}
```
> Invariant à NE PAS casser (l.39-41) : `getUser()` au seul middleware racine.

---

### `apps/web/middleware.ts` (middleware racine, MODIFIÉ)

**Analog:** lui-même (existant, lines 12-24)

**Composition locale→session** (existant ne fait que `updateSession(request)` l.13). Cible :
```typescript
import createMiddleware from 'next-intl/middleware'
import { routing } from './src/i18n/routing'
import { updateSession } from './src/lib/supabase/middleware'
const handleI18n = createMiddleware(routing)
export async function middleware(request: NextRequest) {
  const response = handleI18n(request)            // 1. locale + rewrite + cookie NEXT_LOCALE
  return await updateSession(request, response)   // 2. refresh sur CETTE response
}
```
**Matcher pattern** (réutiliser l.17-23 existant, vérifier compat next-intl) :
```typescript
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

---

### `apps/web/src/lib/auth/gate.ts` (utility RSC) — NOUVEAU

**Analogs:** `apps/web/src/app/dashboard/page.tsx` (getUser+redirect l.18-26) + `packages/supabase/src/repositories/profiles.ts` (getUser puis select `.eq('id', user.id).single()` l.16-32) + `apps/web/src/lib/supabase/server.ts` (createClient via `cookies()`)

**getUser guard pattern** (dashboard/page.tsx l.18-26 — `getUser()` puis `if (!user) redirect`). Ne JAMAIS utiliser getSession (T-03). Centraliser en 3 portes (RESEARCH Pattern 4) :
```typescript
import 'server-only'
import { cookies, headers } from 'next/headers'
import { redirect } from '@/i18n/navigation'        // redirect LOCALISÉ (D-08/D-07)
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server' // PATTERN existant server.ts

export async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()  // jamais getSession()
  if (!user) {
    const path = (await headers()).get('x-pathname') ?? '/'  // header injecté par middleware
    redirect({ href: { pathname: '/login', query: { returnTo: path } } }) // D-08
  }
  return user!
}
export async function requireActiveSub() {
  const user = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase.from('subscriptions').select('id')
    .eq('status', 'active').gt('current_period_end', new Date().toISOString()).limit(1)
  if (!data || data.length === 0) redirect('/tarifs')        // D-07 (funnel, PAS login)
  return user
}
export async function requireRole(role: 'superadmin' | 'affiliate') {
  const user = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (data?.role !== role) {
    if (role === 'superadmin') notFound()  // 404 discrétion (D-09)
    redirect('/')
  }
  return user
}
```
> Le `.eq('id', user.id).single()` + handling `PGRST116` vient de `repositories/profiles.ts` (l.20-32). Le gate est la porte UX ; la non-fuite dépend de la RLS, pas du gate.

**Open question (RESEARCH Q2) :** `returnTo` nécessite le pathname courant → le middleware composé écrit un header `x-pathname` sur la response ; `requireUser` le lit via `headers()`.

---

### `apps/web/src/app/[locale]/layout.tsx` (layout RSC) — NOUVEAU

**Analog:** `apps/web/src/app/layout.tsx` (root `<html lang="fr">` l.8-14)

Le root rend `<html lang="fr"><body>` codé en dur (l.10). Le NOUVEAU `[locale]/layout.tsx` porte le SEUL `<html>` avec lang/dir dynamiques (RESEARCH Pattern 1) :
```tsx
export default async function LocaleLayout({ children, params }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)                       // sinon rendu dynamique forcé (Pitfall 3)
  const messages = await getMessages()
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body><NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider></body>
    </html>
  )
}
```
> ⚠️ Pitfall 7 : un SEUL `<html>`/`<body>`. Le root `app/layout.tsx` DOIT être réduit en pass-through (`return children`) — ne PAS garder son `<html>`.

---

### `apps/web/src/app/layout.tsx` (root, MODIFIÉ → pass-through)

**Analog:** lui-même (l.8-14)
Retirer `<html>/<body>` (déplacés dans `[locale]/layout`). Réduire à `return children` ou supprimer si Next 15 l'autorise (RESEARCH A5 — valider qu'il n'y a qu'UN `<html>`). Conserver l'export `metadata` (l.3-6) si root subsiste.

---

### `apps/web/src/app/[locale]/(auth)/actions.ts` (server action, DÉPLACÉ+MODIFIÉ)

**Analog:** `apps/web/src/app/(auth)/actions.ts` (existant)
Déplacer sous `[locale]`. **MODIFIER les redirects** `'/dashboard'`/`'/login'`/`'/signup'` (l.32,51,57,...) → redirects LOCALISÉS via `@/i18n/navigation` (RESEARCH Q3). Garder la structure signUp/signIn/signOut + `createClient()` from server.ts.

---

### `apps/web/src/app/[locale]/(member)/dashboard/page.tsx` (page, DÉPLACÉ)

**Analog:** `apps/web/src/app/dashboard/page.tsx` (existant)
Déplacer sous `(member)`. Le gate `requireActiveSub()` vit au layout `(member)`, donc retirer le `getUser()+redirect` inline (l.18-26) si gated par le layout. Garder le pattern lecture instruments via repository (l.29-36). Externaliser les chaînes en dur (titre, libellés) via `useTranslations`/`getTranslations` (I18N-03). Remplacer styles inline + `textAlign:'left'` par utilities logiques (`text-start`).
> RESEARCH Q1 : dashboard sous `(member)` SEULEMENT s'il affiche des signaux. S'il ne lit que `instruments` (lecture authenticated, non gated par abo), le laisser authentifié simple sous `[locale]` hors `(member)`. À trancher par le planner selon le contenu cible.

---

### `apps/web/src/app/[locale]/(marketing)/tarifs/page.tsx` (page placeholder) — NOUVEAU

**Analog:** `apps/web/src/app/(auth)/login/page.tsx` (page simple, structure `<main><h1>...`)
Placeholder : titre Heading « Tarifs » + body. `setRequestLocale(locale)` (Pitfall 3, page statique). Chaînes via next-intl (I18N-03). Cible de redirection D-07.

---

### `apps/web/e2e/{i18n,gating}.spec.ts` (e2e)

**Analog:** `apps/web/e2e/auth.spec.ts`
**Patterns réutilisables** : `uniqueEmail(tag)` via `Date.now()` (l.24-26), `signUp(page,email)` helper (l.28-34), `await expect(page).toHaveURL(...)` pour les redirections (l.55-59 — exactement le cas ACCESS-01 non-auth→login). Pour gating : adapter `toHaveURL('/fr/login')` (locale préfixée) ; pour 404 admin → `expect(page.locator(...)).toBeVisible()` sur le 404. Pour i18n : bascule locale, assert `<html dir="rtl">` en ar.

---

## Shared Patterns

### Security-definer RLS helper (search_path figé)
**Source:** `supabase/migrations/0001_*.sql` lines 86-97 (`handle_new_user`)
**Apply to:** `is_superadmin()` (0008), `has_active_subscription()` (0009)
```sql
create function public.X() returns ... language sql stable
  security definer set search_path = public as $$ ... public.table ... $$;
```
> `''` pour plpgsql triggers (références qualifiées partout), `public` pour helpers RLS SQL. JAMAIS sans search_path (Pitfall 6 : récursion/injection).

### RLS « lecture conditionnée, écriture service_role »
**Source:** `0001_*.sql` (l.19-54), `0006_*.sql` (l.36-83)
**Apply to:** toutes les tables P1 + policies modifiées
```sql
alter table public.X enable row level security;
create policy "..." on public.X for select to authenticated using (<condition>);
-- AUCUNE policy insert/update/delete → écriture service_role bypass
```
> Invariant projet : front lit (RLS), jobs écrivent (service_role). P1 n'introduit AUCUNE écriture front.

### Client Supabase serveur (RSC) — getUser jamais getSession
**Source:** `apps/web/src/lib/supabase/server.ts` (createClient via `cookies()` async + getAll/setAll), `dashboard/page.tsx` l.18-26
**Apply to:** `gate.ts`, tous les RSC gated
> T-03 invariant : `getUser()` revalide le token. `getSession()` interdit dans toute décision d'accès (Pitfall 4/AP3).

### Externalisation des chaînes (next-intl)
**Source:** aucun (nouveau) — RESEARCH Pattern 1
**Apply to:** TOUTE page/composant sous `[locale]` (login, signup, dashboard, tarifs, LanguageSwitcher)
> `getTranslations` (RSC) / `useTranslations` (client). AUCUNE chaîne en dur (I18N-03, validé par grep CI). Remplace tous les littéraux des analogs déplacés (login/dashboard).

### Propriétés logiques RTL (Tailwind v4)
**Source:** aucun (nouveau) — UI-SPEC §Primitive RTL
**Apply to:** TOUT nouveau JSX
> `ms-*/me-*/ps-*/pe-*/start-*/end-*/text-start`. INTERDIT `ml/mr/pl/pr/left/right/text-left` (les analogs login/dashboard utilisent `textAlign:'left'` inline l.68-71 → à convertir). Prix/nombres/dates en `<bdi>` + `Intl` (next-intl `useFormatter`).

---

## No Analog Found

Le planner utilise les patterns RESEARCH.md (cités) plutôt qu'un analog codebase :

| Fichier | Role | Raison | Pattern source |
|---|---|---|---|
| `src/i18n/{routing,navigation,request}.ts` | config | next-intl absent du codebase | RESEARCH Pattern 1 |
| `src/messages/{fr,en,ar}.json` | config | aucun i18n existant | RESEARCH §messages namespacés |
| `postcss.config.mjs` + `src/styles/globals.css` | config | Tailwind ABSENT du codebase (aucun CSS, aucun config) | RESEARCH §globals.css + postcss |
| `[locale]/(member)/layout.tsx` | layout gate | 1er layout-gate du projet | RESEARCH Pattern 3 |
| `(admin)/layout.tsx` | layout gate | 1er back-office, HORS `[locale]` | RESEARCH Pattern 4 (requireRole→notFound) |
| `components/LanguageSwitcher.tsx` | client component | 1er composant client interactif (dropdown a11y) | UI-SPEC §Sélecteur de langue + RESEARCH §navigation |

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `apps/web/src/app/`, `apps/web/src/lib/`, `apps/web/middleware.ts`, `apps/web/next.config.ts`, `apps/web/e2e/`, `packages/supabase/src/`, `packages/supabase/__tests__/`
**Files scanned:** 13 analogs lus intégralement
**Pattern extraction date:** 2026-06-14
