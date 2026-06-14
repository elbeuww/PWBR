---
phase: 01-socle-transverse-i18n-rtl-roles-gating
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - supabase/migrations/0008_profiles_role.sql
  - supabase/migrations/0009_subscriptions_gating.sql
  - packages/supabase/src/database.types.ts
  - packages/supabase/__tests__/gating-rls.test.ts
  - apps/web/middleware.ts
  - apps/web/src/lib/supabase/middleware.ts
  - apps/web/src/lib/auth/gate.ts
  - apps/web/src/app/layout.tsx
  - apps/web/src/app/[locale]/layout.tsx
  - apps/web/src/app/[locale]/(auth)/actions.ts
  - apps/web/src/app/[locale]/(auth)/login/page.tsx
  - apps/web/src/app/[locale]/(auth)/signup/page.tsx
  - apps/web/src/app/[locale]/(member)/layout.tsx
  - apps/web/src/app/[locale]/(member)/signaux/page.tsx
  - apps/web/src/app/[locale]/(marketing)/tarifs/page.tsx
  - apps/web/src/app/[locale]/dashboard/page.tsx
  - apps/web/src/app/(admin)/layout.tsx
  - apps/web/src/components/LanguageSwitcher.tsx
  - apps/web/src/i18n/routing.ts
  - apps/web/src/i18n/navigation.ts
  - apps/web/src/i18n/request.ts
  - apps/web/next.config.ts
  - apps/web/postcss.config.mjs
  - apps/web/src/styles/globals.css
  - apps/web/src/messages/fr.json
  - apps/web/src/messages/en.json
  - apps/web/src/messages/ar.json
  - apps/web/e2e/i18n.spec.ts
  - apps/web/e2e/gating.spec.ts
  - apps/web/e2e/auth.spec.ts
  - scripts/check-i18n-hardcoded.mjs
findings:
  critical: 5
  warning: 6
  info: 3
  total: 14
status: resolved
resolution: "5 BLOCKER + 6 WARNING corrigés par l'orchestrateur (2026-06-14). CR-05 = migration 0010 poussée live. CR-01/02/03/04 + WR-01/02/04/06 = code. WR-03/05 documentés (non-déclenchables / limitation connue). IN-01 (police arabe) reporté Phase 2 UI ; IN-02/03 = polish optionnel non bloquant. tsc supabase clean, web = seule la fixture v1.0 baseline, RLS 10/10."
---

# Phase 01 : Rapport de revue de code

**Reviewé :** 2026-06-14
**Profondeur :** standard
**Fichiers reviewés :** 31
**Statut :** issues_found

## Résumé

Phase couvrant le socle i18n/RTL (3 locales : fr/en/ar), le système d'authentification (Supabase Auth email+mot de passe), et les barrières de gating à deux niveaux — porte UX (gate.ts / layouts) et barrière données (RLS migrations 0008/0009).

L'architecture globale est correcte : le middleware compose next-intl et la session Supabase en mutant une seule `Response` (Pattern 2), `getUser()` est appelé partout côté serveur (jamais `getSession()`), le back-office admin retourne `notFound()` (404) et non un 403 révélateur, et les fonctions SQL `SECURITY DEFINER` ont leur `search_path` figé.

Cependant, cinq problèmes critiques ont été identifiés :

1. **Open-redirect incomplet** : `safeReturnTo` dans `gate.ts` ne gère pas les URL encodées (`%2F%2Fevil.com`) ni les variantes avec tabulations/espaces en début, qui passent tous les contrôles actuels.
2. **Race condition d'abonnement** : `requireActiveSub()` appelle deux fois `createClient()` (via `requireUser()` puis directement), créant potentiellement deux instances de client Supabase distinctes — l'une pourrait ne pas avoir les cookies rafraîchis de l'autre.
3. **Divulgation du message d'erreur en signup** : l'action `signUp` renvoie `error.message` de Supabase directement en query param, exposant des détails d'implémentation à l'utilisateur et dans les logs du navigateur.
4. **Cookie sans attribut `SameSite` explicite** dans `setAll` du middleware — le cast `options as Record<string, unknown>` ignore l'interface `ResponseCookie` typée de Next.js, risquant de supprimer des attributs de sécurité des cookies.
5. **RLS `profiles` — policy UPDATE absente mais le type `ProfileUpdate` l'autorise** : le type généré expose `role?: string` dans `Update`, laissant croire qu'un client pourrait écrire le rôle (même si la RLS de 0001 ne le permet pas, l'absence d'audit explicite dans la migration est un vecteur de confusion).

---

## Problèmes critiques

### CR-01 : open-redirect — URL-encodées non rejetées par `safeReturnTo`

**Fichier :** `apps/web/src/lib/auth/gate.ts:30-41`

**Problème :** `safeReturnTo` vérifie que `raw` ne commence pas par `//` ou `/\`, mais un attaquant peut contourner en passant `/%2Fevil.com` ou `%2F%2Fevil.com`. `raw.startsWith('//')` est `false` pour ces formes, et la regex `^[a-z][a-z0-9+.-]*:` ne les attrape pas non plus. Si next-intl ou le navigateur décode le paramètre avant de l'utiliser dans un `<a href>` ou dans un `router.push`, cela peut devenir une redirection hors-origine.

De plus, la chaîne n'est pas validée contre les slash inversés encodés (`%5C`) qui passent la vérification `/\\`.

**Correction :**

```typescript
function safeReturnTo(raw: string | null): string {
  if (!raw) return '/'
  // Décoder d'abord pour neutraliser l'encodage URL (%2F%2F, %5C, etc.)
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return '/'
  }
  // Doit commencer par '/' seul (pas '//', '/\' ou toute forme absolue)
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.startsWith('/\\')) {
    return '/'
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) {
    return '/'
  }
  // Retourner la version originale (encodée) — le routeur Next.js gère le décodage.
  return raw
}
```

---

### CR-02 : double instanciation de `createClient()` dans `requireActiveSub`

**Fichier :** `apps/web/src/lib/auth/gate.ts:61-79`

**Problème :** `requireActiveSub()` appelle `requireUser()` (qui crée un premier client Supabase et appelle `getUser()`) puis recrée un second client indépendant via `const supabase = await createClient()`. Dans un RSC Next.js avec `@supabase/ssr`, chaque appel à `createClient()` lit les cookies de la requête au moment de la création. Si les cookies de session ont été rafraîchis par le premier `getUser()` et que les modifications n'ont pas été propagées à la couche cookie du RSC (ce qui est possible selon l'implémentation de `createClient` côté serveur), le second client peut opérer avec un token expiré ou invalide — résultant en `0` lignes retournées même pour un abonné actif, bloquant correctement des utilisateurs légitimes.

Le bug est subtil : en pratique Next.js mutualise souvent les cookies de requête dans le même RSC, mais ce n'est pas garanti lorsque des Server Actions intermédiaires ou des lectures en cache sont impliquées.

**Correction :** Passer le client créé dans `requireUser` pour éviter la double instanciation :

```typescript
export async function requireUser(): Promise<{ user: User; supabase: SupabaseClient }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // ... redirect
  }
  return { user, supabase }
}

export async function requireActiveSub(): Promise<User> {
  const { user, supabase } = await requireUser()
  const { data } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('status', 'active')
    .gt('current_period_end', new Date().toISOString())
    .limit(1)
  // ...
  return user
}
```

---

### CR-03 : divulgation de `error.message` Supabase en query param (signup/signin)

**Fichier :** `apps/web/src/app/[locale]/(auth)/actions.ts:32-34` et `53-55`

**Problème :** Les erreurs Supabase sont passées directement en `query: { error: error.message }`. Les messages d'erreur Supabase Auth peuvent contenir des informations d'implémentation interne ("User already registered", "Email rate limit exceeded", "Invalid login credentials" — ce dernier peut être utilisé pour l'énumération d'emails). En Phase 1 l'information est exposée dans l'URL (loggée dans les proxies, les analytics, l'historique du navigateur), et dans le titre du document si la page lit ce paramètre.

En outre, si l'UI affiche ce paramètre sans sanitisation, c'est un vecteur XSS réflectif (dépend de l'implémentation de la page, mais le risque doit être coupé à la source).

**Correction :**

```typescript
// Mapper les codes d'erreur Supabase vers des clés i18n opaques
function toSafeErrorKey(message: string): string {
  if (message.includes('already registered')) return 'email-taken'
  if (message.includes('Invalid login')) return 'invalid-credentials'
  if (message.includes('rate limit')) return 'rate-limited'
  return 'auth-error'
}

// Dans signUp :
if (error) {
  redirect({ href: { pathname: '/signup', query: { error: toSafeErrorKey(error.message) } }, locale })
}
```

---

### CR-04 : cast `options as Record<string, unknown>` dans `setAll` — attributs de sécurité des cookies potentiellement perdus

**Fichier :** `apps/web/src/lib/supabase/middleware.ts:35-37`

**Problème :** `response.cookies.set(name, value, options as Record<string, unknown>)` caste le type `options` vers `Record<string, unknown>`. La signature correcte de `response.cookies.set` attend un objet `ResponseCookie` qui inclut `httpOnly`, `secure`, `sameSite`, `path`, etc. Le cast supprime la validation TypeScript. Si `@supabase/ssr` passe ses options avec des noms de propriétés légèrement différents du type attendu par Next.js (camelCase vs lowercase), les attributs de sécurité (`httpOnly`, `secure`, `sameSite`) peuvent être silencieusement ignorés, rendant les cookies de session accessibles via JavaScript ou vulnérables aux CSRF.

Le cast correct est `options as Parameters<typeof response.cookies.set>[2]` ou `options as CookieOptions` (type exporté par `@supabase/ssr`).

**Correction :**

```typescript
import type { CookieOptions } from '@supabase/ssr'

cookiesToSet.forEach(({ name, value, options }) =>
  response.cookies.set(name, value, options as CookieOptions)
)
```

---

### CR-05 : `has_active_subscription()` — utilisateur avec `current_period_end IS NULL` et `status='active'` n'est pas géré

**Fichier :** `supabase/migrations/0009_subscriptions_gating.sql:70-77`

**Problème :** La colonne `current_period_end` est `nullable` (ligne 34 : `current_period_end timestamptz`). La fonction `has_active_subscription()` teste `s.current_period_end > now()` — en Postgres, toute comparaison avec `NULL` retourne `NULL` (ni vrai ni faux), ce qui signifie que `exists(...)` retourne `false` pour une ligne `status='active'` avec `current_period_end IS NULL`.

Ce comportement est documenté implicitement (`nullable tant que pending`) mais si un service_role crée une subscription `active` sans renseigner `current_period_end` (ex : abonnement à vie, compte test, erreur de migration P4), l'utilisateur sera bloqué malgré un abonnement actif. La vérification côté `requireActiveSub` en gate.ts effectue la même comparaison (`.gt('current_period_end', ...)`) et aurait le même comportement.

Ce n'est pas un problème de fuite de données — c'est une erreur de logique métier qui bloque des utilisateurs légitimes.

**Correction :** Documenter explicitement le contrat dans la migration ou modifier le helper pour accepter `NULL` comme absence d'expiration :

```sql
-- Option A : NULL = jamais expiré (abonnement perpétuel)
and (s.current_period_end is null or s.current_period_end > now())

-- Option B (recommandé P1) : forcer NOT NULL avec une valeur sentinelle lointaine
-- et corriger la contrainte de colonne pour refléter l'intention.
```

---

## Avertissements

### WR-01 : `requireRole` — comparaison de rôle sans exhaustivité, rôle 'affiliate' redirige vers '/'

**Fichier :** `apps/web/src/lib/auth/gate.ts:81-100`

**Problème :** La fonction est typée pour accepter `'superadmin' | 'affiliate'`, mais si `data` est `null` (profil introuvable — possible si `handle_new_user` trigger n'a pas encore créé la ligne), `data?.role` est `undefined`, et `undefined !== 'superadmin'` → `notFound()`. C'est correct pour superadmin, mais si `role === 'affiliate'` et que le profil est introuvable, la redirection va vers `'/'` sans que l'utilisateur sache pourquoi. Plus grave : un rôle `'affiliate'` qui n'est pas vérifié redirige silencieusement vers la racine sans erreur — ce n'est pas un gate, c'est une redirection silencieuse, ce qui peut masquer des bugs de configuration.

**Correction :** Distinguer "profil introuvable" (erreur serveur) de "rôle insuffisant" (redirection intentionnelle) :

```typescript
if (!data) {
  // Profil manquant = erreur de données, pas un rôle insuffisant
  console.error(`requireRole: profile not found for user ${user.id}`)
  notFound()
}
if (data.role !== role) {
  if (role === 'superadmin') notFound()
  const locale = await getLocale()
  redirect({ href: '/', locale })
}
```

---

### WR-02 : `signIn` ne redirige pas vers `returnTo` après connexion

**Fichier :** `apps/web/src/app/[locale]/(auth)/actions.ts:56`

**Problème :** Après un `signIn` réussi, l'action redirige toujours vers `/dashboard`, ignorant le paramètre `returnTo` pourtant posé par `requireUser()` via `gate.ts`. L'utilisateur qui arrive sur `/fr/signaux` est redirigé vers `/fr/login?returnTo=/fr/signaux`, mais après connexion atterrit sur `/fr/dashboard` et doit naviguer manuellement vers `/fr/signaux`. Le test E2E (`gating.spec.ts:99-107`) teste l'open-redirect mais pas que `returnTo` valide est bien suivi — cette régression peut passer inaperçue.

**Correction :**

```typescript
export async function signIn(formData: FormData): Promise<void> {
  // ...
  const rawReturnTo = formData.get('returnTo')
  const returnTo = typeof rawReturnTo === 'string' ? safeReturnTo(rawReturnTo) : '/dashboard'
  redirect({ href: returnTo, locale })
}
```

Le formulaire login doit passer `returnTo` en champ caché depuis `searchParams`.

---

### WR-03 : `(admin)/layout.tsx` hors du segment `[locale]` — `requireRole` appelle `getLocale()` sans `setRequestLocale`

**Fichier :** `apps/web/src/app/(admin)/layout.tsx:1-12` et `apps/web/src/lib/auth/gate.ts:95`

**Problème :** Le layout admin est hors du segment `[locale]` (il est dans `app/(admin)/`, pas dans `app/[locale]/(admin)/`). Quand `requireRole` appelle `getLocale()` pour construire la redirection `affiliate`, il n'y a pas de `setRequestLocale` dans ce contexte. `getLocale()` peut retourner la locale par défaut (`fr`) ou lever une erreur si next-intl n'est pas configuré pour fonctionner hors du segment `[locale]`. La redirection `redirect({ href: '/', locale })` sera donc potentiellement incorrecte.

En pratique, pour `superadmin` le code atteint `notFound()` avant `getLocale()`, donc le bug ne se manifeste que si un utilisateur `affiliate` accède au back-office (chemin improbable en P1 mais codé).

**Correction :** Soit placer `(admin)` sous `[locale]`, soit utiliser `redirect('/fr')` avec locale hardcodée dans ce contexte mono-langue explicite, soit ajouter `getRequestConfig` fallback.

---

### WR-04 : test E2E open-redirect — assertion tautologique ligne 108

**Fichier :** `apps/web/e2e/gating.spec.ts:108`

**Problème :** La ligne `expect(new URL(page.url()).origin).toBe(new URL(page.url()).origin)` compare un objet à lui-même — l'assertion est toujours vraie et ne prouve rien. L'intention était probablement de comparer l'origine finale avec l'origine de `baseURL` (i.e., `http://localhost:3000`).

**Correction :**

```typescript
// Remplacer la ligne tautologique par :
const BASE_ORIGIN = new URL('http://localhost:3000').origin
expect(new URL(page.url()).origin).toBe(BASE_ORIGIN)
```

---

### WR-05 : `check-i18n-hardcoded.mjs` — `stripBraces` non-robuste sur JSX multi-lignes

**Fichier :** `scripts/check-i18n-hardcoded.mjs:79-89`

**Problème :** `stripBraces` tente de neutraliser les expressions `{...}` mais opère ligne par ligne. Une expression JSX multi-lignes comme :

```tsx
<p>
  {t(
    'key'
  )}
</p>
```

laisse des accolades orphelines sur des lignes intermédiaires. La boucle `do-while` ne les élimine pas car elles ne contiennent pas `{[^{}]*}` (pas de fermeture sur la même ligne). Résultat : les lignes intermédiaires sont analysées comme du contenu texte potentiel, générant de faux positifs — ou pire, masquant de vraies violations si le contenu se retrouve sur la même ligne qu'une accolade orpheline neutralisée.

**Correction :** Soit passer à une analyse AST (ts-morph, @babel/parser) pour la fiabilité, soit documenter explicitement la limitation et faire en sorte que la règle de style impose les expressions JSX sur une seule ligne.

---

### WR-06 : types générés — `ProfileUpdate.role` est `string` optionnel, aucune protection contre l'écriture du rôle côté client

**Fichier :** `packages/supabase/src/database.types.ts:326-330`

**Problème :** Le type `ProfileUpdate` (et donc `TablesUpdate<'profiles'>`) expose `role?: string`. Un développeur utilisant ce type pour une mise à jour client pourrait écrire `supabase.from('profiles').update({ role: 'superadmin' })` sans que TypeScript s'y oppose. Certes, la RLS de la migration 0001 bloque l'écriture au niveau DB (selon les commentaires des migrations), mais cette protection n'est pas vérifiable ici — le type généré crée une fausse impression de surface d'attaque autorisée.

**Correction :** Créer un type `ProfileUpdateSafe` qui omet `role` pour le code applicatif, et utiliser ce type dans les repositories :

```typescript
// Dans database.types.ts (section raccourcis manuels)
export type ProfileUpdateSafe = Omit<Database['public']['Tables']['profiles']['Update'], 'role'>
```

---

## Infos

### IN-01 : `globals.css` — police arabe chargée sans `@font-face` ni lien vers un CDN

**Fichier :** `apps/web/src/styles/globals.css:8`

**Problème :** `--font-arabic: "Noto Sans Arabic", system-ui, sans-serif` référence Noto Sans Arabic mais aucun `@font-face` ni `<link rel="preconnect">` vers Google Fonts n'est présent. En l'absence de la police dans le système, le fallback `system-ui` sera utilisé, ce qui peut donner un rendu inattendu pour l'arabe selon l'OS. En développement ce n'est pas bloquant, mais en production cela dégradera l'expérience RTL.

**Correction :** Ajouter dans `[locale]/layout.tsx` :
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600&display=swap" rel="stylesheet" />
```
Ou utiliser `next/font/google` pour le chargement optimisé.

---

### IN-02 : `gating-rls.test.ts` — cleanup `afterAll` ne supprime pas le user B si le seed subscription échoue

**Fichier :** `packages/supabase/__tests__/gating-rls.test.ts:117-125`

**Problème :** `userIdB` est initialisé dans `beforeAll` avant le seed de l'abonnement. Si le seed `insert` lève une erreur (ligne 112 : `throw new Error(...)`) le `beforeAll` se termine en erreur, mais `userIdB` est déjà renseigné. Dans `afterAll`, `deleteUser(userIdB)` sera appelé correctement. Ce n'est pas un bug de nettoyage. En revanche, `userIdA` est déclaré avec `let userIdA: string` sans initialisation — si `signUpAndGetClient(emailA)` lève une erreur, `userIdA` reste `undefined` et `afterAll` tente `deleteUser(undefined)` qui passera un `undefined` à `admin.auth.admin.deleteUser()`, provoquant une erreur Supabase silencieuse (la fonction `deleteUser` n'a pas de guard `if (!userId) return`).

**Correction :**

```typescript
async function deleteUser(userId: string | undefined) {
  if (!userId || !SERVICE_ROLE_KEY) return
  // ...
}
```

---

### IN-03 : `LanguageSwitcher` — `aria-current` redondant avec `aria-selected` sur `role="option"`

**Fichier :** `apps/web/src/components/LanguageSwitcher.tsx:196-197`

**Problème :** Les éléments `<li role="option">` portent à la fois `aria-selected={isActive}` (correct pour `role="option"`) et `aria-current={isActive ? 'true' : undefined}`. L'attribut `aria-current` est défini pour les éléments de navigation (`role="link"`, `role="menuitem"`) et non pour `role="option"` — certains lecteurs d'écran peuvent annoncer les deux attributs, causant une répétition. `aria-selected` suffit.

**Correction :** Supprimer `aria-current` de ces éléments `<li role="option">`.

---

_Reviewé : 2026-06-14_
_Reviewer : Claude Sonnet 4.6 (gsd-code-reviewer)_
_Profondeur : standard_
