# Phase 19 : Dashboard utilisateur — Pattern Map

**Mapped:** 2026-06-26
**Files analyzed:** 22 (17 neufs, 5 modifiés)
**Analogs found:** 20 / 22 (2 sans analog direct : helper keyset + son test)

> Phase d'AGRÉGATION brownfield (~80 % câblage). Le risque dominant n'est PAS « comment construire » mais « réimplémenter par accident » (interdit D-02). Cette carte dit, pour chaque fichier neuf/modifié, QUEL fichier existant copier — et ce qu'il NE faut PAS dupliquer.

---

## File Classification

| Fichier neuf/modifié | Rôle | Flux de données | Analogue le plus proche | Qualité |
|----------------------|------|-----------------|-------------------------|---------|
| `supabase/migrations/0020_user_followed_setups.sql` | migration | CRUD / DDL | `migrations/0006` (table) + `0017` (RLS InitPlan + index CONCURRENTLY) | exact |
| `packages/supabase/src/repositories/__tests__/user-followed-rls.test.ts` | test | integration RLS | `__tests__/seed-rls.test.ts` | exact |
| `apps/web/src/lib/keyset/cursor.ts` | utility | transform (encode/decode) | `lib/signals/searchParams.ts` (Zod whitelist, jamais throw) | partiel |
| `apps/web/src/lib/keyset/__tests__/cursor.test.ts` | test | unit | — (aucun test util pur existant cité) | no-analog |
| `apps/web/src/lib/watchlist/queries.ts` | service/query | CRUD (read keyset) | `lib/signals/queries.ts` | exact |
| `apps/web/src/components/dash/WatchlistToggle.tsx` | component | event-driven (mutation optimiste) | `components/signals/SignalList.tsx` (browser client + react-query) | role-match |
| `apps/web/src/components/dash/__tests__/WatchlistToggle.test.tsx` | test | unit composant | `seed-rls.test.ts` (structure) — voir note | partiel |
| `apps/web/src/components/dash/DashShell.tsx` | component | request-response (nav client) | `components/LanguageSwitcher.tsx` (nav client a11y, propriétés logiques) | partiel |
| `apps/web/src/components/dash/AffiliateSummaryCard.tsx` | component | request-response (read agrégat) | `[locale]/affiliation/dashboard/page.tsx` (Card + formatAtomic BigInt) | role-match |
| `apps/web/src/components/dash/KeysetList.tsx` | component | request-response (liste paginée) | `components/signals/SignalList.tsx` + grille `SignalCard` | role-match |
| `apps/web/src/app/[locale]/(dash)/layout.tsx` | layout/route | request-response (gate + read) | `[locale]/(member)/layout.tsx` | exact |
| `apps/web/src/app/[locale]/(dash)/page.tsx` (overview) | page/route | request-response (read RSC) | `[locale]/(member)/signaux/page.tsx` + member layout | role-match |
| `apps/web/src/app/[locale]/(dash)/suivis/page.tsx` | page/route | request-response (read keyset) | `[locale]/(member)/signaux/page.tsx` | role-match |
| `apps/web/src/app/[locale]/(dash)/historique/page.tsx` | page/route | request-response (read keyset) | `[locale]/(member)/signaux/page.tsx` | role-match |
| `apps/web/src/app/[locale]/(dash)/watchlist/page.tsx` | page/route | request-response (read) | `[locale]/(member)/signaux/page.tsx` | role-match |
| `apps/web/src/app/[locale]/(dash)/abonnement/page.tsx` | page/route | request-response | `[locale]/(account)/abonnement/page.tsx` | exact (réhébergement) |
| `apps/web/src/app/[locale]/(dash)/parametres/page.tsx` | page/route | request-response + auth client | `[locale]/(account)/abonnement/page.tsx` (shell RSC) + `LanguageSwitcher` + `(auth)/actions.ts` signOut | role-match |
| `apps/web/src/app/[locale]/dashboard/page.tsx` (MODIF — stub remplacé) | page/route | — | redirect localisé (`(auth)/actions.ts` L.109/116) | exact |
| `apps/web/src/components/signals/SignalCard.tsx` (MODIF — câbler étoile) | component | — | insertion `WatchlistToggle` ; voir Pattern d'insertion | n/a |
| `apps/web/src/components/signals/SignalDetail.tsx` (MODIF — câbler étoile) | component | — | idem SignalCard | n/a |
| `packages/supabase/database.types.ts` (MODIF — régénérer) | config/types | — | convention `generate_typescript_types` + édition manuelle (0017 entête L.5-10) | exact |
| `apps/web/src/i18n/messages/*` (MODIF — clés FR/EN/AR) | config/i18n | — | parité stricte next-intl (P01 D-01-02-A) | exact |

---

## Pattern Assignments

### `supabase/migrations/0020_user_followed_setups.sql` (migration, CRUD/DDL)

**Analogues :** `migrations/0006_analyses_trade_setups.sql` (forme table + enable RLS), `migrations/0017_scalable_foundation.sql` (RLS InitPlan wrap + Partie B CONCURRENTLY).

**Création de table + RLS** — calque la forme `create table … / alter table … enable row level security` de `0006` L.55-76, MAIS avec policies write (contrairement à `trade_setups` qui est service_role-only). La colonne `user_id` porte `default (select auth.uid())` et chaque policy wrappe la fonction non corrélée — règle exacte lue dans `0017` L.41-42 et L.110-134 (policies `payments`/`subscriptions`) :

```sql
-- forme de policy à copier de 0017 (payments insert L.112-115, subscriptions select L.131-134)
for insert to authenticated with check (user_id = (select auth.uid()))   -- INSERT = with check SEUL
for select to authenticated using      (user_id = (select auth.uid()))   -- colonne JAMAIS wrappée (Pitfall 3)
for delete to authenticated using      (user_id = (select auth.uid()))
```

**Index keyset CONCURRENTLY** — copier le découpage Partie A / Partie B de `0017` L.350-387 : la table + RLS dans `apply_migration` ; l'index `(user_id, created_at desc, id desc)` via `execute_sql` UN statement à la fois (L.354), puis script de gate `indisvalid` (`0017` L.393-407) + EXPLAIN gabarit (L.409-413).

**Entête de migration** — copier le bloc convention `0017` L.5-19 (apply_migration jamais db push, numéro = prochain, édition manuelle `database.types.ts` après `generate_typescript_types`).

> **Tiebreaker keyset (open question RESEARCH §389) :** PK actuelle proposée = `(user_id, setup_id)`. Le helper keyset `(created_at desc, id desc)` exige un `id`. DÉCISION PLANNER : ajouter `id uuid not null default gen_random_uuid() unique` (aligne le helper générique) OU utiliser `setup_id` comme tiebreaker. Aligner l'index sur le choix.

---

### `packages/supabase/src/repositories/__tests__/user-followed-rls.test.ts` (test, integration RLS)

**Analogue :** `packages/supabase/src/repositories/__tests__/seed-rls.test.ts` (calque EXACT).

**À copier tel quel :**
- Bootstrap env + `HAS_ENV` + `describe.skipIf(!HAS_ENV)` — `seed-rls.test.ts` L.26-52.
- `adminClient()` (service_role = SEEDING uniquement) + `signUpAndGetClient()` + `deleteUser()` — L.32-49.
- Lecture assertée TOUJOURS via `clientA` (anon/auth-client), JAMAIS service_role — L.98-114.

**À adapter (preuve anti-IDOR UDASH-03) :** au lieu de « A lit 0 payment de B », tester l'ÉCRITURE :
```typescript
// clientA (auth.uid()=A) tente d'insérer un follow en usurpant user_id=B → rejeté par with check
const { error } = await clientA
  .from('user_followed_setups')
  .insert({ user_id: userIdB, setup_id })   // injection user_id d'autrui
// attendu : error (42501) OU 0 ligne — jamais succès
expect(error).not.toBeNull()
// + cas nominal : A insère/lit/supprime SA watchlist (user_id auto = default auth.uid())
```

---

### `apps/web/src/lib/keyset/cursor.ts` (utility, transform) — NEUF, aucun code n'existe

**Analogue partiel :** `lib/signals/searchParams.ts` — pour la PHILOSOPHIE, pas la forme. Copier le principe « jamais throw, valeur corrompue → fallback » (`searchParams.ts` L.39-48, `safeParse` champ par champ → undefined). Ici : curseur corrompu → `null` (= première page), jamais throw.

**Forme** (gabarit RESEARCH §219-246, base64url opaque) :
```typescript
export interface Cursor { createdAt: string; id: string }
export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify([c.createdAt, c.id])).toString('base64url')
}
export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null
  try { const [createdAt, id] = JSON.parse(Buffer.from(raw, 'base64url').toString()); return { createdAt, id } }
  catch { return null }
}
```

> Si le curseur transite par l'URL, l'enregistrer comme param Zod whitelisté en ÉTENDANT `searchParams.ts` (param `cursor` + `tab`) plutôt qu'un nouveau parseur — Don't Hand-Roll RESEARCH §273.

---

### `apps/web/src/lib/watchlist/queries.ts` (service, CRUD read keyset)

**Analogue :** `lib/signals/queries.ts` (exact).

**À copier :**
- Entête frontière producteur-unique (jamais service_role, RLS = vraie barrière) — `queries.ts` L.1-17.
- Signature `(supabase: SupabaseClient<Database>, params)` + retour `{ data, error }` — L.59-62, L.44-47.
- Pattern `!inner` join + normalisation type front — L.49-50, L.136-138.

**À adapter (keyset, D-04/D-05) :** source unique `user_followed_setups ⋈ trade_setups!inner` filtré par `status` (Suivis = `active` ; Historique = `in ('invalidated','expired')` + join `prediction_outcomes` pour l'issue). Tri keyset + tuple-compare PostgREST (RESEARCH §237-245, Pitfall 4) :
```typescript
.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE + 1)
if (cursor) q = q.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
```
> Le `!inner` sous RLS `has_active_subscription()` filtre tout pour un abonné expiré → 0 ligne = barrière renouvellement D-03 gratuite (vérifier A2 live).

---

### `apps/web/src/components/dash/WatchlistToggle.tsx` (component, mutation optimiste)

**Analogue :** `components/signals/SignalList.tsx` (browser client + react-query).

**À copier :**
- `'use client'` + entête sécurité (createClient browser PORTE la session cookies → RLS) — `SignalList.tsx` L.1-29.
- `const supabase = useMemo(() => createClient(), [])` (import `../../lib/supabase/client`) — L.33, L.51.
- Usage `@tanstack/react-query` (ici `useMutation`/`useQueryClient` au lieu de `useQuery`) — L.32.

**Nouveau (mutation optimiste, RESEARCH §190-217) :** `onMutate` flip optimiste, `onError` rollback + `toast.error` (`sonner` déjà vendored). NE JAMAIS envoyer `user_id` (default auth.uid() + with check = anti-IDOR). Icône `Star` lucide — vérifier l'import sinon SVG inline ≥44px (précédent `LanguageSwitcher.tsx` L.13-14, L.25-43 : SVG inline quand lucide absent). Hit-area ≥44px (UI-SPEC, `LanguageSwitcher` `min-h-11 min-w-11` L.168).

---

### `apps/web/src/components/dash/DashShell.tsx` (component, nav client)

**Analogue :** `components/LanguageSwitcher.tsx` (nav client a11y + RTL logique).

**À copier :** `'use client'`, propriétés logiques uniquement (`end-0`, `text-start`, `ms-`/`me-` — `LanguageSwitcher.tsx` L.183, L.200), patterns a11y clavier si menu, `usePathname`/`useRouter` de `../i18n/navigation` (L.20) pour l'item actif. **Interdit :** glow/néon sur la nav (D-01) — l'item actif = accent fill/underline subtil, jamais `glowClass` (contraste avec `SignalCard.tsx` L.79-81 qui, lui, a le droit au glow car surface de valeur).

---

### `apps/web/src/components/dash/AffiliateSummaryCard.tsx` (component, read agrégat conditionnel)

**Analogue :** `[locale]/affiliation/dashboard/page.tsx` (exact pour le rendu montants).

**À copier :**
- Lecture vue `affiliate_dashboard` (security_invoker, no-PII) via anon-client RSC — `affiliation/dashboard/page.tsx` L.65-72.
- `formatAtomic(BigInt(...))` JAMAIS `Number` (perte précision) + `<bdi>` — L.47-50, L.191-193.
- Import `@app/core` (`TIERS`, `affiliateRateBps`, `formatAtomic`) — L.25.

**À adapter (D-10) :** carte résumé CONDITIONNELLE — rendue seulement si l'user est affilié (`requireRole('affiliate')` ne convient pas dans le user-dash car il REDIRIGE ; lire le rôle/affiliate row et conditionner le rendu). Lien « Voir mon tableau d'affiliation » → `/affiliation/dashboard`. Pas d'onglet plein.

---

### `apps/web/src/app/[locale]/(dash)/layout.tsx` (layout, gate + read)

**Analogue :** `[locale]/(member)/layout.tsx` (exact).

**À copier :**
- `requireUser()` (PAS `requireActiveSub` — D-03 : l'abonné expiré entre pour renouveler) — calque `(member)/layout.tsx` L.18-19 en swappant le helper (`gate.ts` L.78-81).
- Lecture `subscriptions.current_period_end` anon-client RSC pour `ExpiryBanner` — L.22-30 (copier verbatim).
- `<ExpiryBanner currentPeriodEnd={sub?.current_period_end ?? null} />` — L.33-34.

**Nouveau :** monter `<DashShell>` (sidebar + bottom-nav) autour de `{children}`. ExpiryBanner en tête (D-08).

---

### `apps/web/src/app/[locale]/(dash)/page.tsx` (overview) + `suivis`/`historique`/`watchlist`/`abonnement` (pages RSC)

**Analogue :** `[locale]/(member)/signaux/page.tsx` (structure RSC complète).

**À copier (signaux/page.tsx) :**
- Entête « lecture serveur gated, aucun guard inline (gate au layout), aucun repo service_role » — L.1-15.
- `setRequestLocale` + `getTranslations` + `createClient()` + `parseSignalsParams(await searchParams)` — L.32-39.
- Trois états soignés error / 0-ligne / contenu — L.54-75 (réutiliser pour loading Skeleton / empty / error / renewal, UI-SPEC §135).
- Montage `QueryProvider > SignalList` sans réimplémenter — L.72-74 (D-02 : AGRÉGER).

**Overview (UDASH-01, D-08) :** ordre figé abonnement+ExpiryBanner → 3-4 derniers signaux (`fetchActiveSignals(..., limit 3-4)` existant) → raccourcis. Interdit equity/P&L/ROI (D-09, Pitfall 6).
**Suivis/Historique :** monter `KeysetList` lisant `lib/watchlist/queries.ts`.
**Abonnement :** réhéberger la surface `(account)/abonnement/page.tsx` OU rediriger (discrétion planner) — ne PAS cloner `PlanCard`/`QueryProvider` (L.65-71).

---

### `apps/web/src/app/[locale]/(dash)/parametres/page.tsx` (page settings, NEUF — UDASH-06)

**Analogues :** `[locale]/(account)/abonnement/page.tsx` (shell RSC + ExpiryBanner), `components/LanguageSwitcher.tsx` (sélecteur langue à monter), `(auth)/actions.ts` (signOut server action).

**À copier :**
- Shell RSC `main` max-width + `text-start` + header + filet `--primary` — `(account)/abonnement/page.tsx` L.55-63.
- `requireUser()` (L.44) + lecture sub pour le lien gestion abonnement.
- Sélecteur langue : monter `<LanguageSwitcher />` existant (Don't Hand-Roll) — pas de toggle thème (`forcedTheme="dark"`, D-11).
- Déconnexion : `<form action={signOut}>` — calque `dashboard/page.tsx` L.47-54 + action `(auth)/actions.ts` L.112-117.

**Nouveau (client) :** changement mdp `supabase.auth.updateUser({ password })` (RESEARCH §362-365), client `@/lib/supabase/client`. Préférences notifications = UI seule, AUCUNE delivery (D-12).

---

### `apps/web/src/app/[locale]/dashboard/page.tsx` (MODIF — stub remplacé)

Le stub actuel (liste `instruments`, L.16-93) est remplacé par une redirection vers `(dash)`. Copier le pattern redirect localisé de `(auth)/actions.ts` L.109/116 (`redirect({ href: '/dashboard', locale })` → ici vers l'overview `(dash)`). Auditer les `href="/dashboard"` internes (RESEARCH §288).

---

### `SignalCard.tsx` / `SignalDetail.tsx` (MODIF — câbler l'étoile)

Insérer `<WatchlistToggle setupId={signal.id} />`. **Contrainte :** `SignalCard.tsx` est server-renderable (PAS `'use client'`, L.5) et son corps entier est un `<Link>` (L.72-76) — placer l'étoile en élément frère hors du `<Link>` (sinon clic capturé / hydratation imbriquée). Hit-area ≥44px. Le toggle est un îlot client autonome.

---

## Shared Patterns

### Frontière producteur-unique (anon-client RLS, jamais service_role)
**Source :** `lib/signals/queries.ts` L.1-17 ; `(member)/layout.tsx` L.4-7 ; `affiliation/dashboard/page.tsx` L.9-14.
**Apply to :** TOUTES les lectures `(dash)` (overview, suivis, historique, abonnement, affiliation) et l'écriture watchlist.
```typescript
const supabase = await createClient() // anon SSR + cookies ; RLS tranche. AUCUN import service-client.
```

### Gate au layout, jamais guard inline
**Source :** `lib/auth/gate.ts` L.78-118 ; `(member)/layout.tsx` L.18.
**Apply to :** `(dash)/layout.tsx` (`requireUser`). `requireRole('affiliate')` REDIRIGE — ne pas l'utiliser pour la carte conditionnelle (lire le rôle et conditionner le rendu à la place).

### RLS = vraie barrière (test anti-IDOR anon-client)
**Source :** `seed-rls.test.ts` L.9-21, L.98-114.
**Apply to :** `user-followed-rls.test.ts`. Lecture/écriture assertée TOUJOURS via anon-client ; service_role = seeding seul.

### Montants atomiques (BigInt, jamais Number)
**Source :** `affiliation/dashboard/page.tsx` L.47-50.
**Apply to :** `AffiliateSummaryCard`. `formatAtomic(BigInt(atomic ?? '0'))` + `<bdi>`.

### RTL + tokens Tailwind v4
**Source :** `LanguageSwitcher.tsx` (propriétés logiques) ; `SignalCard.tsx` L.61-62 (`bg-[var(--token)]`).
**Apply to :** tous les composants `dash`. Propriétés logiques uniquement (`ms`/`me`/`ps`/`pe`/`start`/`end`), `bg-[var(--token)]` JAMAIS `bg-[--token]` (CR-01 P16).

### i18n parité stricte FR/EN/AR
**Source :** convention next-intl (toutes pages). Chaînes externalisées via `getTranslations`/`useTranslations`.
**Apply to :** toute nouvelle clé (copywriting UI-SPEC §104-118) ajoutée aux 3 fichiers messages à parité.

---

## No Analog Found

| Fichier | Rôle | Flux | Raison |
|---------|------|------|--------|
| `apps/web/src/lib/keyset/cursor.ts` | utility | transform | Aucun helper de curseur en code (seuls les index DB posés P17). Analogue de PHILOSOPHIE seulement (`searchParams.ts` : jamais throw). Gabarit dans RESEARCH §219. |
| `apps/web/src/lib/keyset/__tests__/cursor.test.ts` | test | unit | Pas de test d'util pur cité ; structure Vitest standard (round-trip encode/decode + curseur corrompu → null). |

---

## Metadata

**Analog search scope :** `apps/web/src/{app,components,lib}`, `packages/supabase/src/repositories/__tests__`, `supabase/migrations`.
**Files scanned (Read intégral) :** `gate.ts`, `SignalList.tsx`, `searchParams.ts`, `ExpiryBanner.tsx`, `migrations/0017`, `migrations/0006`, `seed-rls.test.ts`, `(member)/layout.tsx`, `affiliation/dashboard/page.tsx`, `(account)/abonnement/page.tsx`, `dashboard/page.tsx` (stub), `(member)/signaux/page.tsx`, `SignalCard.tsx`, `queries.ts`, `LanguageSwitcher.tsx`, `(auth)/actions.ts`.
**Pattern extraction date :** 2026-06-26
