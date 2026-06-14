---
phase: 01-socle-transverse-i18n-rtl-r-les-gating
plan: 03
subsystem: web (i18n shell + access gating)
tags: [i18n, rtl, next-intl, middleware, supabase-ssr, rls, gating, access-control]
requires:
  - "01-01 (migrations 0008/0009 LIVE: profiles.role, subscriptions, has_active_subscription(), RLS abonnés actifs; database.types regenerated)"
  - "01-02 (next-intl 4.13 wiring: i18n/routing,navigation,request + messages fr/en/ar; Tailwind v4 logical-props RTL)"
provides:
  - "Composed root middleware (handleI18n -> updateSession on one response) + x-pathname header"
  - "Single <html lang dir> shell under [locale] (root layout pass-through)"
  - "lib/auth/gate.ts: requireUser / requireActiveSub / requireRole (3 doors, same-origin returnTo)"
  - "Accessible LanguageSwitcher (listbox dropdown, same-page locale switch, NEXT_LOCALE cookie)"
  - "Gated layouts: (member) sub-gate, (admin) superadmin 404-gate; tarifs placeholder"
  - "auth + dashboard relocated under [locale] with localized redirects + externalized strings"
affects:
  - apps/web/middleware.ts
  - apps/web/src/lib/supabase/middleware.ts
  - apps/web/src/lib/auth/gate.ts
tech-stack:
  added: []
  patterns:
    - "Composed Next.js middleware: next-intl response MUTATED by Supabase updateSession (Pitfall 2)"
    - "RSC layout gate (defense-in-depth above RLS) — Pattern 3"
    - "Localized redirect (next-intl 4.x object form requires explicit locale via getLocale())"
    - "Inline SVG icons (no lucide-react install — threat T-01-SC)"
key-files:
  created:
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/components/LanguageSwitcher.tsx
    - apps/web/src/lib/auth/gate.ts
    - apps/web/src/app/[locale]/(member)/layout.tsx
    - apps/web/src/app/(admin)/layout.tsx
    - apps/web/src/app/[locale]/(marketing)/tarifs/page.tsx
    - apps/web/src/app/[locale]/(auth)/actions.ts
    - apps/web/src/app/[locale]/(auth)/login/page.tsx
    - apps/web/src/app/[locale]/(auth)/signup/page.tsx
    - apps/web/src/app/[locale]/dashboard/page.tsx
  modified:
    - apps/web/middleware.ts
    - apps/web/src/lib/supabase/middleware.ts
    - apps/web/src/app/layout.tsx
    - apps/web/src/messages/fr.json
    - apps/web/src/messages/en.json
    - apps/web/src/messages/ar.json
  removed:
    - apps/web/src/app/(auth)/actions.ts
    - apps/web/src/app/(auth)/login/page.tsx
    - apps/web/src/app/(auth)/signup/page.tsx
    - apps/web/src/app/dashboard/page.tsx
decisions:
  - "D-01-03-A: gate uses createClient() from lib/supabase/server.ts (already Database-typed) rather than re-wiring createServerSupabaseClient(await cookies())"
  - "D-01-03-B: localized redirect() in next-intl 4.13 requires explicit locale -> resolved server-side via getLocale() in gate.ts and actions.ts"
  - "D-01-03-C: dashboard kept OUTSIDE (member) (RESEARCH Q1) — reads only instruments (authenticated, not sub-gated); sub-gating it would block everyone in P1"
  - "D-01-03-D: lucide-react absent from package.json -> globe/chevron rendered as inline SVG (threat T-01-SC, no new npm install)"
requirements: [I18N-01, I18N-02, I18N-03, I18N-04, ACCESS-01, ACCESS-02, ACCESS-03]
metrics:
  duration: ~25 min
  completed: 2026-06-14
  tasks: 4
  files: 19
---

# Phase 01 Plan 03: Jointure i18n + gating — Shell [locale], middleware composé, gate.ts, sélecteur de langue Summary

Couche UX du gating (défense en profondeur au-dessus de la RLS du Plan 01) + activation effective de l'i18n du Plan 02 sur des pages réelles : arbre `app/` déplacé sous `[locale]` avec un seul `<html lang dir>`, middleware composé locale→session, primitive d'accès `gate.ts` (3 portes avec returnTo same-origin validé), et sélecteur de langue accessible RTL-aware.

## What Was Built

### Task 1 — Middleware composé (`b4cbf97`)
- `apps/web/middleware.ts` : `handleI18n(request)` produit la response (rewrite locale + cookie `NEXT_LOCALE`), pose `x-pathname`, puis `updateSession(request, response)` mute cette même response.
- `apps/web/src/lib/supabase/middleware.ts` : `updateSession` accepte désormais une `response: NextResponse` et la MUTE dans `setAll` (`response.cookies.set`) au lieu de recréer `NextResponse.next()` (Pitfall 2). `getUser()` conservé (Pitfall 4). Matcher exclut `api/_next/assets`.

### Task 2 — Restructure [locale] + LanguageSwitcher (`04e773c`)
- `apps/web/src/app/[locale]/layout.tsx` : SEUL `<html lang={locale} dir={ar?rtl:ltr}>`, `hasLocale`+`notFound`, `setRequestLocale` (Pitfall 3), `generateStaticParams`, `NextIntlClientProvider`, header avec `LanguageSwitcher` ancré `ms-auto`/`end` (logique).
- `apps/web/src/app/layout.tsx` réduit à un pass-through (`return children`) — plus de `<html>` (Pitfall 7).
- `apps/web/src/components/LanguageSwitcher.tsx` : dropdown `role="listbox"` accessible (aria-haspopup/expanded, navigation flèches/Home/End, Enter/Espace/Échap, aria-selected/aria-current, focus-visible ring `#2563EB`), autonymes non traduits, même-page via `usePathname`+`useRouter().replace(pathname,{locale})`, utilities logiques uniquement, icônes SVG inline.

### Task 3 — gate.ts + layouts gated + tarifs (`63694b8`)
- `apps/web/src/lib/auth/gate.ts` (`server-only`) : `requireUser` (getUser, returnTo validé same-origin), `requireActiveSub` (subscriptions active & non expirée sinon `/tarifs`, D-07), `requireRole` (profiles.role après getUser ; superadmin absent → `notFound()` 404 D-09 ; affiliate → `/`). Redirects localisés via `getLocale()`.
- `apps/web/src/app/[locale]/(member)/layout.tsx` : `await requireActiveSub()`.
- `apps/web/src/app/(admin)/layout.tsx` (HORS [locale]) : `await requireRole('superadmin')`.
- `apps/web/src/app/[locale]/(marketing)/tarifs/page.tsx` : placeholder via messages `pricing`, `setRequestLocale`.

### Task 4 — Déplacement auth+dashboard, redirects localisés (`3bbcda3`)
- `(auth)/login,signup,actions` et `dashboard` déplacés sous `[locale]/` ; anciens emplacements supprimés.
- `actions.ts` : redirects localisés (`redirect({href, locale})`), plus de `/dashboard` nu.
- `dashboard` HORS `(member)` : lit `instruments`, guard `getUser` localisé, chaînes namespace `dashboard`, classes logiques (zéro `textAlign`/physique).
- `login/signup` : chaînes namespace `auth`. Namespace `dashboard` ajouté à fr/en/ar (parité de clés stricte — vérifiée).

## How to Verify

```bash
# Typecheck (gate passe : seul l'erreur fixture baseline documentée subsiste)
cd apps/web && npx tsc --noEmit -p tsconfig.json
# -> seule erreur attendue : __lint_fixtures__/forbidden-service-import.ts (baseline v1.0 AUTH-03)

# Grep structurels
grep -q "updateSession(request, response)" apps/web/middleware.ts   # composition
grep -q "x-pathname" apps/web/middleware.ts                          # returnTo source
grep -q "dir={locale" "apps/web/src/app/[locale]/layout.tsx"        # single html dir
grep -q "usePathname" apps/web/src/components/LanguageSwitcher.tsx   # same-page switch
grep -q "getUser" apps/web/src/lib/auth/gate.ts                      # Pitfall 4
```

E2E (redirections, RTL visuel, bascule de langue) couverts par le Plan 04 (Wave 3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pas de script `typecheck` dans apps/web/package.json**
- **Found during:** Task 3 verify (`pnpm --filter web typecheck`).
- **Issue:** Le plan supposait un script `typecheck` au niveau `apps/web` ; seul la racine en a un (`tsc -b`). `pnpm --filter web typecheck` → "None of the selected packages has a typecheck script".
- **Fix:** Exécuté la même intention via `npx tsc --noEmit -p tsconfig.json` dans `apps/web` (gate documenté du plan). Aucun fichier modifié — adaptation de commande uniquement.
- **Files modified:** aucun.

**2. [Rule 1 - Bug] Signature `redirect` localisé next-intl 4.13 exige `locale`**
- **Found during:** Task 3 typecheck.
- **Issue:** `redirect({ href })` et `redirect('/tarifs')` rejetés par TS — l'overload localisé de next-intl 4.x requiert `{ href, locale }`.
- **Fix:** Résolution serveur de la locale via `getLocale()` (next-intl/server) puis `redirect({ href, locale })` dans `gate.ts` ET `actions.ts`. Ajout `return user as never` après le redirect de `requireUser` (le compilateur ne narrow pas le `never` ; `redirect` lève NEXT_REDIRECT à l'exécution).
- **Files modified:** apps/web/src/lib/auth/gate.ts, apps/web/src/app/[locale]/(auth)/actions.ts
- **Commit:** 63694b8, 3bbcda3

**3. [Rule 3 - Blocking] Artefacts `.next/types` périmés référençant les anciennes routes**
- **Found during:** Task 4 typecheck (après déplacement).
- **Issue:** `.next/types/validator.ts` (généré par Next) référençait `(auth)/login`, `(auth)/signup`, `dashboard` aux anciens chemins → TS2307.
- **Fix:** Supprimé `apps/web/.next/types` (artefact de build gitignored, régénéré au prochain `next dev`/`build`). Aucun fichier source touché.
- **Files modified:** aucun (artefact).

**4. [Rule 2 - Missing functionality] Namespace `dashboard` absent des messages**
- **Found during:** Task 4 (externalisation des chaînes du dashboard, I18N-03).
- **Issue:** Le dashboard déplacé doit externaliser ses chaînes, mais aucun namespace `dashboard` n'existait dans fr/en/ar.
- **Fix:** Ajout du namespace `dashboard` (10 clés) aux 3 fichiers de messages avec parité stricte (vérifiée par script).
- **Files modified:** apps/web/src/messages/{fr,en,ar}.json
- **Commit:** 3bbcda3

## Threat Surface

Aucune nouvelle surface non couverte par le `<threat_model>` du plan. Mitigations appliquées :
- T-01-06 (Spoofing) : `getUser()` partout dans `gate.ts`, jamais la variante session.
- T-01-07 (Open Redirect) : `safeReturnTo()` rejette `//`, `/\`, et tout `scheme:` ; n'accepte qu'un chemin démarrant par un seul `/`.
- T-01-08 (Info Disclosure) : `(admin)` non-superadmin → `notFound()` (404).
- T-01-09 (flash gated) : gate au RSC layout → redirect serveur avant rendu.
- T-01-02 (EoP) : `requireRole` lit `profiles.role` après `getUser()`, jamais un claim JWT.
- T-01-SC : aucun nouveau package npm (lucide-react absent → SVG inline).

## Known Stubs

- `apps/web/src/app/[locale]/(marketing)/tarifs/page.tsx` — placeholder intentionnel (cible de redirection D-07). Contenu réel des offres = Phase 2/4. Chaînes via messages `pricing`, non en dur. Documenté dans le plan (contenu réel P2).
- `(member)` et `(admin)` n'ont pas encore de pages enfants réelles (layouts gated seuls) — surfaces réelles livrées aux phases produit ultérieures (Phase 3 membre, Phase 8 superadmin). Les portes UX sont posées et fonctionnelles.

## Self-Check: PASSED

- Tous les fichiers créés vérifiés présents (10 nouveaux + SUMMARY).
- Tous les commits de tâche vérifiés présents : b4cbf97, 04e773c, 63694b8, 3bbcda3.
- Typecheck : seule l'erreur fixture baseline documentée (forbidden-service-import.ts) subsiste — aucune nouvelle erreur.
- Parité des clés messages `dashboard` fr/en/ar : true.
