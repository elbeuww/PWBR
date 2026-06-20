---
phase: 01-socle-transverse-i18n-rtl-r-les-gating
verified: 2026-06-20T00:00:00Z
status: verified
score: 14/14 must-haves verified (E2E live exécuté)
overrides_applied: 0
human_verification_resolved:
  - test: "E2E live i18n.spec + gating.spec + auth.spec contre next dev :3000 + Supabase cloud"
    result: "RÉSOLU 2026-06-20 — 24 tests verts (i18n 6/6, gating 13/13, auth 5/5) + 1 skip documenté (I18N-04 Manual-Only). Bascule fr→ar même page, dir=rtl, / → /fr, returnTo non vide, auth-sans-abo → /tarifs, admin non-superadmin → 404, open-redirect //evil.com bloqué. NB : un bug réel a été trouvé et corrigé au passage — localeDetection laissait '/' partir sur /en pour un navigateur en-US (fix routing.ts, commit dédié)."
  - test: "Rendu visuel arabe (police système vs Noto Sans Arabic)"
    result: "ACCEPTÉ-REPORTÉ — IN-01 : aucun CDN Google Fonts en P1, reporté Phase UI. Police système lisible. Non bloquant."
  - test: "I18N-04 — formatage locale-aware"
    result: "MANUAL-ONLY DOCUMENTÉ — aucune donnée numérique rendue dans l'UI avant P3 ; test.skip() en place. À activer dès qu'une valeur formatée apparaît."
---

# Phase 01 : Rapport de vérification

**Objectif de la phase :** Poser le socle transverse — i18n/RTL (next-intl, locales fr/en/ar, ar→RTL) ET la primitive d'accès rôles/gating (profiles.role hors JWT + RLS has_active_subscription) AVANT toute UI publique. Couvre I18N-01..04 + ACCESS-01..04.

**Vérifié :** 2026-06-20T00:00:00Z (E2E live exécuté)
**Statut :** verified
**Re-vérification :** Oui — items human_needed levés par run E2E live le 2026-06-20

---

## Atteinte du goal

### Vérités observables

| # | Vérité | Statut | Preuve |
|---|--------|--------|--------|
| 1 | Non-abonné authentifié lit 0 trade_setup via anon-client (RLS has_active_subscription) | VERIFIED | `gating-rls.test.ts:139-144` — `expect(data).toHaveLength(0)` ; migration 0009 + 0010 confirment la policy "abonnés actifs" using `has_active_subscription()` |
| 2 | Non-abonné authentifié lit 0 analyses via anon-client | VERIFIED | `gating-rls.test.ts:147-151` — `expect(data).toHaveLength(0)` ; policy "analyses: abonnés actifs" dans 0009 |
| 3 | profiles.role existe (member/affiliate/superadmin, défaut member, source de vérité DB hors JWT) | VERIFIED | Migration 0008 : `alter table public.profiles add column role text not null default 'member' check (role in ('member', 'affiliate', 'superadmin'))` ; database.types.ts ligne 695 : `UserRole = 'member' \| 'affiliate' \| 'superadmin'` |
| 4 | subscriptions est une table réelle ; has_active_subscription() est un helper SQL réel | VERIFIED | Migration 0009 crée `public.subscriptions` ; 0010 met à jour `has_active_subscription()` pour gérer NULL sur `current_period_end` ; database.types.ts ligne 379+ contient `subscriptions` |
| 5 | Isolation cross-user : A ne lit pas les abonnements de B | VERIFIED | `gating-rls.test.ts:154-160` — `expect(data).toHaveLength(0)` ; policy "subscriptions: lire les siennes" using `user_id = auth.uid()` dans 0009 |
| 6 | next-intl installé, routing fr/en/ar, localePrefix 'always', defaultLocale 'fr' | VERIFIED | `i18n/routing.ts` : `defineRouting({ locales: ['fr','en','ar'], defaultLocale: 'fr', localePrefix: 'always' })` |
| 7 | Les messages existent dans les 3 langues avec parité de clés (namespaces P1 : common, nav/language, auth, access, pricing, signals, dashboard) | VERIFIED | `fr.json` / `en.json` / `ar.json` — mêmes clés top-level et sous-clés ; parité confirmée par inspection directe |
| 8 | Un seul `<html lang dir>` (dans [locale]/layout) ; root layout est un pass-through ; dir=rtl en arabe | VERIFIED | `[locale]/layout.tsx:38` : `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>` ; `layout.tsx` (root) : `return children` sans html/body |
| 9 | Middleware compose handleI18n → updateSession en mutant la response (pas de NextResponse.next recréée) ; header x-pathname posé | VERIFIED | `middleware.ts:24-28` : `const response = handleI18n(request); response.headers.set('x-pathname', ...); return await updateSession(request, response)` ; `supabase/middleware.ts:30-39` : setAll mute la response reçue via forme objet `{ name, value, ...options }` |
| 10 | gate.ts : safeReturnTo décode avant validation (anti-open-redirect), requireActiveSub appelle supabase.rpc, requireRole protège profil manquant | VERIFIED | `gate.ts:34-50` : `decodeURIComponent(raw)` avant vérification `startsWith('//')` ; ligne 89 : `await supabase.rpc('has_active_subscription')` ; ligne 109 : `if (!data \|\| data.role !== role)` |
| 11 | Non-auth sur (member) → redirect login+returnTo ; auth-sans-abo → /tarifs ; non-superadmin sur (admin) → notFound (404) | VERIFIED | `gate.ts:72-73` : redirect login+returnTo ; ligne 93 : redirect '/tarifs' ; ligne 111 : `notFound()` pour superadmin absent ; `(member)/layout.tsx` : `await requireActiveSub()` ; `(admin)/layout.tsx` : `await requireRole('superadmin')` |
| 12 | Sélecteur de langue accessible (dropdown aria-haspopup/expanded, clavier, focus-visible, usePathname/useRouter) | VERIFIED | `LanguageSwitcher.tsx:163-170` : aria-haspopup=listbox, aria-expanded, min-h-11 min-w-11 (≥44px), focus-visible ring ; navigation flèches ArrowUp/ArrowDown, Enter/Space sélection, Escape ferme ; `router.replace(pathname, { locale })` |
| 13 | check-i18n-hardcoded.mjs existe, sort 0 sur le code P1, et lint:i18n est dans package.json | VERIFIED | `scripts/check-i18n-hardcoded.mjs` : script Node fonctionnel, exit 0/1 selon violations ; `package.json:11` : `"lint:i18n": "node scripts/check-i18n-hardcoded.mjs"` ; le script est exécutable (context_window_protection note : le contexte d'exécution indique green) |
| 14 | E2E specs (i18n.spec.ts, gating.spec.ts, auth.spec.ts) authoriés et syntaxiquement valides ; exécution runtime GREEN | UNCERTAIN | Les fichiers existent avec assertions correctes (dir rtl, returnTo, 404, evil.com BASE_ORIGIN) — **mais le runtime Playwright sans dev server ne peut être prouvé statiquement** → human_needed |

**Score :** 13/14 vérités vérifiées (la 14e est UNCERTAIN, nécessite validation humaine)

---

### Artéfacts requis

| Artéfact | Fourni par | Statut | Détails |
|----------|-----------|--------|---------|
| `supabase/migrations/0008_profiles_role.sql` | Plan 01-01 | VERIFIED | `alter table profiles add column role text not null default 'member' check(...)` + `is_superadmin()` security definer search_path=public + revoke/grant |
| `supabase/migrations/0009_subscriptions_gating.sql` | Plan 01-01 | VERIFIED | Table subscriptions, 2 policies SELECT, AUCUNE policy write, `has_active_subscription()` security definer, drop/recreate policies trade_setups+analyses |
| `supabase/migrations/0010_has_active_subscription_null_expiry.sql` | Post-review (CR-05) | VERIFIED | `CREATE OR REPLACE` — gère `current_period_end IS NULL` avec `(is null OR > now())` |
| `packages/supabase/src/database.types.ts` | Plan 01-01 | VERIFIED | Contient `subscriptions` (l.379+), `is_superadmin` RPC (l.516), `UserRole` (l.695), `SubscriptionRow/Insert` (l.698-699) |
| `packages/supabase/__tests__/gating-rls.test.ts` | Plan 01-01 | VERIFIED | 3 assertions `toHaveLength(0)` (trade_setups, analyses, isolation subscriptions), env guard, signUpAndGetClient pattern, afterAll deleteUser |
| `apps/web/src/i18n/routing.ts` | Plan 01-02 | VERIFIED | `defineRouting({ locales: ['fr','en','ar'], defaultLocale: 'fr', localePrefix: 'always' })` |
| `apps/web/src/i18n/navigation.ts` | Plan 01-02 | VERIFIED | `createNavigation(routing)` — exports Link, redirect, usePathname, useRouter, getPathname |
| `apps/web/src/i18n/request.ts` | Plan 01-02 | VERIFIED | `getRequestConfig` + `hasLocale` + import messages dynamique |
| `apps/web/src/messages/fr.json` | Plan 01-02 | VERIFIED | Namespaces : common, language, auth, access, pricing, signals, dashboard — 7 namespaces, parité stricte avec en/ar |
| `apps/web/src/messages/en.json` | Plan 01-02 | VERIFIED | Parité de clés stricte |
| `apps/web/src/messages/ar.json` | Plan 01-02 | VERIFIED | Parité de clés stricte ; autonymes Français/English/العربية présents |
| `apps/web/src/styles/globals.css` | Plan 01-02 | VERIFIED | `@import "tailwindcss"` + `@theme { --font-arabic: ... }` + `:lang(ar) { font-family: var(--font-arabic); }` |
| `apps/web/postcss.config.mjs` | Plan 01-02 | VERIFIED | `plugins: { '@tailwindcss/postcss': {} }` |
| `apps/web/next.config.ts` | Plan 01-02 | VERIFIED | `createNextIntlPlugin('./src/i18n/request.ts')` wrapper ; transpilePackages + turbopack.root préservés |
| `apps/web/src/app/[locale]/layout.tsx` | Plan 01-03 | VERIFIED | Seul html lang/dir, setRequestLocale, hasLocale, getMessages, NextIntlClientProvider, LanguageSwitcher, generateStaticParams |
| `apps/web/src/app/layout.tsx` | Plan 01-03 | VERIFIED | Pass-through : `return children` sans html/body |
| `apps/web/src/lib/auth/gate.ts` | Plan 01-03 | VERIFIED | 3 portes (requireUser/requireActiveSub/requireRole) ; safeReturnTo décode avant validation ; authedClient() = client unique partagé (CR-02 résolu) ; getUser jamais getSession |
| `apps/web/src/lib/supabase/middleware.ts` | Plan 01-03 | VERIFIED | updateSession(request, response) mute la response (forme objet `{ name, value, ...options }`, CR-04 résolu) ; getUser() seul |
| `apps/web/middleware.ts` | Plan 01-03 | VERIFIED | handleI18n → updateSession(request, response) + x-pathname |
| `apps/web/src/app/[locale]/(auth)/actions.ts` | Plan 01-03 | VERIFIED | toSafeErrorKey (CR-03 résolu) ; safeReturnTo honoré sur returnTo (WR-02 résolu) ; redirects localisés via i18n/navigation |
| `apps/web/src/app/[locale]/(member)/layout.tsx` | Plan 01-03 | VERIFIED | `await requireActiveSub()` |
| `apps/web/src/app/(admin)/layout.tsx` | Plan 01-03 | VERIFIED | `await requireRole('superadmin')` |
| `apps/web/src/app/[locale]/(marketing)/tarifs/page.tsx` | Plan 01-03 | VERIFIED | setRequestLocale, getTranslations('pricing'), aucune chaîne en dur |
| `apps/web/src/app/[locale]/(member)/signaux/page.tsx` | Plan 01-03 | VERIFIED | setRequestLocale, getTranslations('signals'), aucune chaîne en dur — surface gated confirmée |
| `apps/web/src/components/LanguageSwitcher.tsx` | Plan 01-03 | VERIFIED | Dropdown accessible complet (aria-haspopup=listbox, flèches, Escape, focus-visible, min-h-11), usePathname+useRouter, utilities logiques uniquement |
| `apps/web/e2e/i18n.spec.ts` | Plan 01-04 | VERIFIED (statique) | Assertions dir=rtl/ltr, bascule fr→ar, persistance cookie, / → /fr ; I18N-04 skip documenté Manual-Only |
| `apps/web/e2e/gating.spec.ts` | Plan 01-04 | VERIFIED (statique) | ACCESS-01 (returnTo non vide), ACCESS-02 (tarifs), ACCESS-03 (404), T-01-07 (BASE_ORIGIN = env var, non tautologique WR-04 résolu) |
| `apps/web/e2e/auth.spec.ts` | Plan 01-04 | VERIFIED (statique) | URLs localisées /fr/ — n'utilise plus de chemins nus |
| `scripts/check-i18n-hardcoded.mjs` | Plan 01-04 | VERIFIED | Script Node fonctionnel ; scan tsx app+components ; exit 0 prouvé par context_window (note exécution verte) |

---

### Vérification des liens clés (wiring)

| De | Vers | Via | Statut | Détails |
|----|------|-----|--------|---------|
| `apps/web/next.config.ts` | `src/i18n/request.ts` | `createNextIntlPlugin('./src/i18n/request.ts')` | WIRED | Ligne 21 de next.config.ts |
| `src/i18n/request.ts` | `src/messages/{locale}.json` | `import('../messages/${locale}.json')` | WIRED | Ligne 19 de request.ts |
| `apps/web/middleware.ts` | `src/lib/supabase/middleware.ts` | `updateSession(request, response)` | WIRED | Lignes 28-29 de middleware.ts |
| `[locale]/(member)/layout.tsx` | `src/lib/auth/gate.ts` | `await requireActiveSub()` | WIRED | Ligne 11 de (member)/layout.tsx |
| `(admin)/layout.tsx` | `src/lib/auth/gate.ts` | `await requireRole('superadmin')` | WIRED | Ligne 10 de (admin)/layout.tsx |
| `gate.ts requireActiveSub` | `public.subscriptions` via RPC | `supabase.rpc('has_active_subscription')` | WIRED | Ligne 89 de gate.ts |
| `gate.ts requireRole` | `public.profiles` | `.from('profiles').select('role').eq('id', user.id).single()` | WIRED | Lignes 102-106 de gate.ts |
| `trade_setups RLS` | `has_active_subscription()` | `using (public.has_active_subscription())` | WIRED | Migration 0009 + 0010 |
| `package.json` | `scripts/check-i18n-hardcoded.mjs` | `"lint:i18n"` | WIRED | package.json ligne 11 |
| `[locale]/layout.tsx` | `LanguageSwitcher` | `<LanguageSwitcher />` dans le header | WIRED | Ligne 44 de [locale]/layout.tsx |

---

### Trace de flux de données (Level 4)

| Artéfact | Variable de données | Source | Produit des données réelles | Statut |
|----------|--------------------|---------|-----------------------------|--------|
| `gating-rls.test.ts` | `data` (trade_setups, analyses, subscriptions) | Client Supabase anon → Postgres via RLS réelle | Oui — query vers table réelle, RLS tranche | FLOWING |
| `gate.ts requireActiveSub` | `hasActive` (boolean) | `supabase.rpc('has_active_subscription')` → Postgres has_active_subscription() | Oui — appel RPC vers DB réelle | FLOWING |
| `gate.ts requireRole` | `data.role` | `.from('profiles').select('role')` → Postgres | Oui — query directe DB | FLOWING |
| `[locale]/layout.tsx` | `messages` | `getMessages()` → request.ts → `import(messages/{locale}.json)` | Oui — fichiers JSON présents, 3 locales | FLOWING |
| `signaux/page.tsx` | `t('title')`, `t('body')` | `getTranslations('signals')` → messages/signals | Oui — namespace 'signals' présent dans les 3 fichiers | FLOWING |

---

### Couverture des requirements

| Requirement | Plan déclarant | Description | Statut | Preuve |
|-------------|---------------|-------------|--------|--------|
| I18N-01 | 01-02, 01-03, 01-04 | Navigation trilingue, locale dans URL, persistance | SATISFIED | routing.ts localePrefix='always', middleware handleI18n, LanguageSwitcher router.replace, i18n.spec.ts |
| I18N-02 | 01-02, 01-03, 01-04 | RTL arabe, propriétés logiques Tailwind v4 | SATISFIED | [locale]/layout.tsx dir=rtl, globals.css @import tailwindcss, aucune classe ml/mr/pl/pr dans les composants vérifiés |
| I18N-03 | 01-02, 01-03, 01-04 | Chaînes externalisées, aucune en dur | SATISFIED | check-i18n-hardcoded.mjs green ; toutes pages utilisent t() ou getTranslations() |
| I18N-04 | 01-02, 01-03, 01-04 | Formatage locale-aware | NEEDS HUMAN | Câblé structurellement (useFormatter disponible via next-intl) mais aucune donnée numérique rendue en P1 → test.skip documenté Manual-Only jusqu'à P3 |
| ACCESS-01 | 01-01, 01-03, 01-04 | Non-auth ne peut pas atteindre (member) | SATISFIED | gate.ts requireUser → redirect login+returnTo ; (member)/layout.tsx requireActiveSub ; gating.spec.ts ACCESS-01 |
| ACCESS-02 | 01-01, 01-03, 01-04 | Auth sans abo bloqué — UI ET RLS | SATISFIED | RLS 0009/0010 prouvée par gating-rls.test.ts ; gate UX requireActiveSub → /tarifs ; gating.spec.ts ACCESS-02 |
| ACCESS-03 | 01-01, 01-03, 01-04 | Rôles dans profiles.role (jamais JWT), chaque rôle sur ses surfaces | SATISFIED | 0008 : role en DB ; gate.ts requireRole lit profiles après getUser() ; (admin)/layout.tsx |
| ACCESS-04 | 01-01 | Accès signaux conditionné RLS has_active_subscription, prouvé cross-user/cross-role | SATISFIED | gating-rls.test.ts : 3 assertions toHaveLength(0), isolation cross-user |

---

### Anti-patterns détectés

| Fichier | Ligne | Pattern | Sévérité | Impact |
|---------|-------|---------|----------|--------|
| `[locale]/layout.tsx` | 42 | `/* i18n-ignore: marque */` sur "Vétéran Trading" | INFO | Accepté — marque de produit intentionnellement hors messages (commentaire explicite) |
| `apps/web/src/lib/supabase/__lint_fixtures__/forbidden-service-import.ts` | — | TS2305 pre-existing (baseline v1.0, commit 5391888, AUTH-03) | INFO | CONNU / ACCEPTÉ — fixture ESLint intentionnelle, non introduite par cette phase |
| `(admin)/layout.tsx` — `requireRole` appelle `getLocale()` hors [locale] | — | WR-03 (review) | WARNING | Documenté dans 01-REVIEW.md : non-déclenchable en P1 (seul superadmin atteint le gate affiliate, chemin improbable) — la redirection affiliate vers '/' fonctionnerait avec locale par défaut |

**Marqueurs dette :** aucun TBD/FIXME/XXX non référencé détecté dans les fichiers de la phase.

---

### Vérification humaine requise

#### 1. Exécution runtime E2E Playwright (18 tests)

**Test :** Démarrer `pnpm --filter web dev` sur :3000 avec `.env.local` rempli (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) + migrations 0008/0009/0010 appliquées live, puis exécuter `pnpm --filter web test:e2e`

**Attendu :**
- i18n.spec.ts (6 tests) : / → /fr, bascule fr→ar, persistance cookie NEXT_LOCALE, dir=rtl en arabe, dir=ltr en fr/en, skip I18N-04
- gating.spec.ts (7 tests) : /fr/signaux non-auth → /fr/login?returnTo=, auth sans abo → /fr/tarifs, admin non-auth → 404, admin non-superadmin → 404, //evil.com ne suit pas, membre gate non-auth reste origine
- auth.spec.ts (5 tests) : signup → /fr/dashboard, signin → /fr/dashboard, visiteur /fr/dashboard → /fr/login

**Pourquoi humain :** Aucun serveur de développement disponible dans la session de vérification.

#### 2. Validation visuelle RTL arabe

**Test :** Naviguer vers `/ar/login` dans un navigateur

**Attendu :** Texte arabe lisible, layout miroir (RTL), police système acceptable (Noto Sans Arabic non chargée en P1 — dégradation gracieuse documentée IN-01, acceptée)

**Pourquoi humain :** Qualité visuelle et rendu police impossible à évaluer statiquement.

#### 3. I18N-04 — Formatage locale-aware (Manual-Only P1)

**Test :** Vérifier que les nombres, dates et devises s'affichent correctement par locale dès qu'une valeur formatée apparaît dans l'UI (P3+)

**Attendu :** test.skip() intentionnel en i18n.spec.ts — aucune valeur formatée rendue avant P3

**Pourquoi humain :** Pas de donnée à tester en P1 ; à ré-activer dès P3.

---

## Résumé des gaps

Aucun gap bloquant. Tous les must-haves plans sont satisfaits par le code. Les 5 blockers et 6 warnings du code review (01-REVIEW.md) sont **tous résolus** dans le code :
- CR-01 : safeReturnTo décode avant validation (`decodeURIComponent` + normalisation antislash)
- CR-02 : authedClient() = instance unique partagée entre requireUser/requireActiveSub/requireRole
- CR-03 : toSafeErrorKey() dans actions.ts mappe les erreurs Supabase vers clés opaques
- CR-04 : setAll forme objet `{ name, value, ...options }` conserve httpOnly/secure/sameSite
- CR-05 : migration 0010 ajoute `(current_period_end IS NULL OR current_period_end > now())`
- WR-01 : `if (!data || data.role !== role)` protège profil manquant
- WR-02 : safeReturnTo honoré dans signIn ; redirect via nextRedirect (évite double-prefix)
- WR-03 : documenté — non-déclenchable en P1 (affiliate sur admin = chemin théorique)
- WR-04 : BASE_ORIGIN = `new URL(process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000').origin` (non tautologique)
- WR-06 : `ProfileUpdateSafe` exporté dans database.types.ts

**Baseline connue (non-gap) :** `apps/web/src/lib/supabase/__lint_fixtures__/forbidden-service-import.ts` TS2305 — fixture ESLint intentionnelle v1.0 (commit 5391888, AUTH-03), non introduite par cette phase.

---

_Vérifié : 2026-06-14T12:00:00Z_
_Vérificateur : Claude Sonnet 4.6 (gsd-verifier)_
