# Phase 21 : Tests E2E + audit de scalabilité — Pattern Map

**Mapped:** 2026-06-26
**Files analyzed:** 9 (7 nouveaux, 2 modifiés)
**Analogs found:** 7 / 9 (2 sans analog code : rapport doc + CI)

> Source des routes URL (figées par lecture directe + `20-UAT.md`) :
> - **Dashboard utilisateur (Phase 19)** groupe `(dash)`, préfixe locale : `/fr/dashboard`, `/fr/dashboard/abonnement`, `/fr/dashboard/affiliation`, `/fr/dashboard/historique`, `/fr/dashboard/parametres`, `/fr/dashboard/suivis`, `/fr/dashboard/watchlist`.
> - **Cockpit superadmin (Phase 20)** groupe `(admin)`, segment `/admin` (confirmé par `gating.spec.ts` + `20-UAT.md`) : `/admin`, `/admin/membres`, `/admin/file`, `/admin/affiliation`, `/admin/affiliation/payouts`, `/admin/affiliation/affilies`, `/admin/sante`, `/admin/signaux`, `/admin/signaux/[id]`.

---

## File Classification

| Nouveau/Modifié | Role | Data Flow | Closest Analog | Match Quality |
|-----------------|------|-----------|----------------|---------------|
| `apps/web/e2e/auth.setup.ts` | test-setup (Playwright project) | request-response (login → storageState) | `apps/web/e2e/auth.spec.ts` | role-match (login flow) |
| `apps/web/e2e/fixtures/roles.ts` | config/utility | transform (constantes déterministes) | `apps/web/test/admin-rls.test.ts` (bloc constantes) + `apps/jobs/scripts/seed/config.ts` | role-match |
| `apps/jobs/scripts/seed-fixtures.ts` | script/seed | batch (provisioning idempotent service_role) | `apps/jobs/scripts/seed.ts` | exact (même rôle, même flow) |
| `apps/web/e2e/dash/*.spec.ts` | test (E2E) | request-response (nav + DOM) | `apps/web/e2e/auth.spec.ts` | exact |
| `apps/web/e2e/admin/*.spec.ts` | test (E2E) | request-response (gating 404 + cockpit) | `apps/web/e2e/gating.spec.ts` + `apps/web/test/admin-rls.test.ts` + `20-UAT.md` | exact |
| `playwright.config.ts` | config | — | `playwright.config.ts` (édition in-place) | self |
| `.github/workflows/ci.yml` | config (CI) | — | aucun (`.github/` absent) | no-analog |
| `.gitignore` | config | — | `.gitignore` (édition in-place) | self |
| `.planning/phases/21-*/21-AUDIT.md` | doc (rapport SCALE-06) | — | aucun (livrable doc) | no-analog |

---

## Pattern Assignments

### `apps/web/e2e/auth.setup.ts` (test-setup, request-response)

**Analog principal :** `apps/web/e2e/auth.spec.ts` (séquence login réelle) — réutiliser les sélecteurs DOM EXACTS prouvés.

**Sélecteurs de login à répliquer** (`auth.spec.ts` L.73-77) :
```typescript
await page.goto('/fr/login')
await page.locator('input[name="email"]').fill(email)
await page.locator('input[name="password"]').fill(TEST_PASSWORD)
await page.locator('button[type="submit"]').click()
await expect(page).toHaveURL('/fr/dashboard', { timeout: 10000 })
```

**Pattern setup-project + storageState** (RESEARCH §Pattern 1 / Code Examples) — un `setup()` par rôle authentifié, écrit `playwright/.auth/<role>.json`. `anon` n'a PAS de storageState (état vierge) :
```typescript
import { test as setup } from '@playwright/test'
import { FIXTURES, FIXTURE_PASSWORD } from './fixtures/roles'

for (const role of ['abonne', 'affilie', 'superadmin'] as const) {
  setup(`auth ${role}`, async ({ page }) => {
    await page.goto('/fr/login')
    await page.locator('input[name="email"]').fill(FIXTURES[role].email)
    await page.locator('input[name="password"]').fill(FIXTURE_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('/fr/dashboard')
    await page.context().storageState({ path: `playwright/.auth/${role}.json` })
  })
}
```

> **Sécurité (V3 ASVS) :** `playwright/.auth/` DOIT être `.gitignore` — cookies de session impersonnables. Voir Shared Patterns.

---

### `apps/web/e2e/fixtures/roles.ts` (config/utility, transform)

**Analog :** `apps/web/test/admin-rls.test.ts` (bloc de constantes figées en tête) + convention domaine `.invalid` de `seed.ts`.

**Pattern constantes figées** (calqué sur `admin-rls.test.ts` L.39-54 + `seed.ts` L.19 domaine `.invalid`, RFC 2606) :
```typescript
export const FIXTURE_PASSWORD = process.env['E2E_FIXTURE_PW'] ?? 'TestPassword123!'

export const FIXTURES = {
  free:       { email: 'e2e-fixture-free@nexa-e2e.invalid',       role: 'member' },
  abonne:     { email: 'e2e-fixture-abonne@nexa-e2e.invalid',     role: 'member' },
  affilie:    { email: 'e2e-fixture-affilie@nexa-e2e.invalid',    role: 'member' },
  superadmin: { email: 'e2e-fixture-superadmin@nexa-e2e.invalid', role: 'superadmin' },
} as const
// anon = pas d'entrée (état non authentifié)
```

> Le préfixe `e2e-fixture-` + domaine `@nexa-e2e.invalid` est la clé d'isolation (purge ciblée, Pitfall 2). NE PAS utiliser `@gmail.com` ici (réservé aux comptes jetables interactifs des specs existantes ; les fixtures sont des comptes service stables).

---

### `apps/jobs/scripts/seed-fixtures.ts` (script/seed, batch)

**Analog :** `apps/jobs/scripts/seed.ts` — copier la STRUCTURE entière (boot env, fail-fast secrets, client service_role, purge idempotente → recreate). Distinct du seed ~10k (D-05).

**Boot env + fail-fast secrets** (`seed.ts` L.25-58) :
```typescript
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(SCRIPT_DIR, '../.env') }) // apps/jobs/.env

function fail(msg: string): never { console.error(`\n❌ seed-fixtures: ${msg}\n`); process.exit(1) }
const url = process.env['SUPABASE_URL']?.trim()
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim()
if (!url) fail('SUPABASE_URL manquante dans apps/jobs/.env.')
if (!serviceRoleKey) fail('SUPABASE_SERVICE_ROLE_KEY manquante (le nom seul, jamais la valeur).')
```

**Client service_role stateless** (`seed.ts` L.61-63) :
```typescript
const client = createClient<Database>(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
```

**Provisioning + promotion superadmin** — combiner le pattern createUser de `admin-rls.test.ts` L.56-100 (`auth.admin.createUser` puis `profiles.update({ role: 'superadmin' })` via service_role) avec l'idempotence purge→recreate de `seed.ts` (L.69-71). `email_confirm: true` car « Confirm email » peut être ON (RESEARCH Pitfall 3) :
```typescript
// idempotent : supprimer-si-existe (par préfixe fixture) puis recréer — calque purge() de seed.ts
for (const { email, role } of Object.values(FIXTURES)) {
  await client.auth.admin.createUser({ email, password: FIXTURE_PASSWORD, email_confirm: true })
  if (role === 'superadmin') {
    await client.from('profiles').update({ role: 'superadmin' }).eq(/* id du user créé */)
  }
  // abonne → insérer une subscription active déterministe (cf. seed/subscriptions.ts)
}
```

> **Idempotence (D-04) :** purge ciblée par préfixe `e2e-fixture-` AVANT recreate (jamais toucher `source='demo'` ni `source='live'`). Re-run sûr, N stable — exactement le contrat de `seed.ts` (L.16-23).

---

### `apps/web/e2e/dash/*.spec.ts` (test E2E, request-response)

**Analog :** `apps/web/e2e/auth.spec.ts` — structure `test.describe` + assertions web-first + lecture de table seedée.

**Assertion table / contenu rendu** (`auth.spec.ts` L.86-89) :
```typescript
const rows = page.locator('table tbody tr')
await expect(rows.first()).toBeVisible({ timeout: 5000 })
expect(await rows.count()).toBeGreaterThanOrEqual(1)
```

**Couverture E2E-01 (rôle `abonne`)** — naviguer les 7 routes `(dash)` et asserter le rendu (pas via le seed 10k, via les fixtures déterministes D-05). storageState injecté par le projet `abonne` (pas de login dans le test) :
```typescript
import { test, expect } from '@playwright/test'
test('dashboard abonné rend les sections principales', async ({ page }) => {
  await page.goto('/fr/dashboard')
  await expect(page.getByRole('heading')).toBeVisible()
})
// idem /fr/dashboard/{abonnement,affiliation,historique,suivis,watchlist,parametres}
```

> Anti-pattern (RESEARCH) : pas de `waitForTimeout` → web-first assertions auto-retry. Ne PAS re-`signUp` dans ces specs (le storageState rôle s'en charge).

---

### `apps/web/e2e/admin/*.spec.ts` (test E2E, request-response)

**Analog 1 — isolation 404 (E2E-02) :** `apps/web/e2e/gating.spec.ts` (patterns 404 déjà éprouvés).

**Pattern 404 discret** (`gating.spec.ts` L.80-92) — JAMAIS 403 (threat T-01-08) :
```typescript
const response = await page.goto(ADMIN_SURFACE)
expect(response?.status()).toBe(404)
```

**Pattern redirection gating non-abonné** (`gating.spec.ts` L.73-75) :
```typescript
await page.goto('/fr/signaux')
await expect(page).toHaveURL(/\/fr\/tarifs/, { timeout: 5000 }) // requireActiveSub
```

**Analog 2 — scénarios cockpit (E2E-01) :** `20-UAT.md` (11 items observables) → ~1:1 en `test()` sous storageState `superadmin`. Mapping figé :

| 20-UAT item | Route | Assertion E2E |
|-------------|-------|---------------|
| 2. Gating cockpit | `/admin` | superadmin → 200 contenu ; `abonne`/`anon` → `status()===404` |
| 3. Cockpit 4 axes + provenance | `/admin` | 4 sections ordre Revenus→Ops→Acquisition→Conformité ; ligne « Mesuré · N=… » |
| 4. Sidebar 4 axes | `/admin` | 4 en-têtes, liens vers `/admin/*`, item actif surligné |
| 5. Table membres keyset+filtres | `/admin/membres` | filtre statut/source/email ; bouton « Charger la page suivante » ; colonne `source` |
| 6. File paiements keyset | `/admin/file` | pagination keyset, email membre par ligne |
| 7. Offrir temps gratuit | `/admin/membres` | dialog presets 7j/1mois/3mois, toast succès, bouton désactivé pendant envoi |
| 8. Suspendre/réactiver | `/admin/membres` | confirmation destructive motif requis ; redirection `/login?suspended=1` |
| 9. Marquer commission payée | `/admin/affiliation/payouts` | RPC gated, toast, état payé, pas de double-paiement |
| 10. Conformité read-only | `/admin` | feu ROUGE par défaut (LEGAL_REVIEW_DONE), version+date, pas de drill-down |
| 11. Santé / signaux anon-client | `/admin/sante`, `/admin/signaux`, `/admin/signaux/[id]` | rendu lecture seule, pas de bouton édition/création |

**Analog 3 — contrat données deux-rôles (reste en Vitest) :** `apps/web/test/admin-rls.test.ts` NE doit PAS être réécrit en E2E (D-02). Il reste la preuve « barrière données » (cross-user 0-ligne, RPC write `forbidden`). L'E2E prouve l'EFFET visible (404 / DOM vide), pas la RLS.

---

### `playwright.config.ts` (config — édition in-place)

**Modifs ciblées (ne pas réécrire) :**

1. **`projects` par rôle** (RESEARCH Pattern 1) — remplacer le projet unique `chromium` (L.33-38) par : `setup` (testMatch `*.setup.ts`) + un projet par rôle avec `dependencies: ['setup']` + `use.storageState`. `anon` sans storageState, `testMatch` sur `e2e/**/anon-*.spec.ts`.
2. **`webServer`** — décommenter L.43-47 et passer en `build && start` pour CI (RESEARCH Pattern 2) :
```typescript
webServer: {
  command: 'pnpm --filter web build && pnpm --filter web start',
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env['CI'],
  timeout: 120_000,
}
```
3. **`retries` CI** (RESEARCH Pitfall 6) : `retries: process.env['CI'] ? 2 : 0`. Garder `trace: 'on-first-retry'` (déjà présent L.30).

> Conserver `testDir: 'apps/web'` + le double `testMatch` `e2e/**` ET `tests/**` (L.16-17) pour ne pas casser les gardes Vitest/Playwright existantes.

---

### `.github/workflows/ci.yml` (config CI — AUCUN analog, à créer)

**Pas d'analog dans le repo** (`.github/` absent — D-09 du CONTEXT était faux). Suivre l'exemple RESEARCH §Code Examples (pnpm@9.15.9 + Playwright). Job unique séquencé : `pnpm install --frozen-lockfile` → `lint` → `typecheck` → `test` (vitest) → `playwright install --with-deps chromium` → `test:e2e` (bloquant). Secrets GitHub : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Upload `playwright-report/` en artefact `if: ${{ !cancelled() }}`.

> Scripts npm racine vérifiés : `lint`=`eslint .`, `typecheck`=`tsc -b --noEmit`, `test`=`vitest run`, `test:e2e`=`playwright test`. packageManager = `pnpm@9.15.9`.

---

### `.planning/phases/21-*/21-AUDIT.md` (doc SCALE-06 — AUCUN analog code)

Livrable documentaire (D-10). Méthodologie figée par RESEARCH §Pattern 3 + §Méthodologie des seuils. Pas de pattern code à copier — exécution via MCP Supabase (`execute_sql` pour `EXPLAIN (ANALYZE, BUFFERS)`, `get_advisors` pour baseline+delta). Cibles d'audit (D-07) : paginations keyset (membres/file/signaux suivis), RPC KPI gated (`get_mrr`/`get_acquisition_funnel`/`get_churn`/`get_plan_mix`), policies RLS wrappées `(select …)` des migrations `0017_scalable_foundation.sql` + `0021_admin_cockpit.sql`.

---

## Shared Patterns

### Provisioning service_role + promotion superadmin
**Source :** `apps/web/test/admin-rls.test.ts` L.64-100 · `apps/jobs/scripts/seed.ts` L.61-63
**Apply to :** `seed-fixtures.ts`
```typescript
const admin = createClient(URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
await admin.auth.admin.createUser({ email, password, email_confirm: true })
await admin.from('profiles').update({ role: 'superadmin' }).eq('id', superId) // promotion
// teardown : await admin.auth.admin.deleteUser(userId)
```

### Fail-fast secrets (jamais logguer la valeur)
**Source :** `seed.ts` L.48-58 (CLAUDE.md sécurité)
**Apply to :** `seed-fixtures.ts`, et indirectement le job CI (secrets en GitHub Secrets uniquement, jamais committés/logués).

### 404 discret (jamais 403) — gating back-office
**Source :** `apps/web/e2e/gating.spec.ts` L.80-92
**Apply to :** tous les specs `e2e/admin/*` en rôles `anon`/`abonne`
```typescript
expect((await page.goto(route))?.status()).toBe(404) // T-01-08 : l'existence ne fuit jamais
```

### storageState `.gitignore` (V3 session management)
**Source :** RESEARCH §Pattern 1 / Security Domain
**Apply to :** `.gitignore` — ajouter `playwright/.auth/`. (`.next/`, `test-results/`, `playwright-report/` déjà présents L.5/19/20.)

### Web-first assertions (anti-flaky)
**Source :** `auth.spec.ts` (`expect(locator).toBeVisible`, `toHaveURL` avec timeout) — jamais `waitForTimeout`.
**Apply to :** tous les specs `e2e/dash/*` et `e2e/admin/*`.

---

## No Analog Found

| Fichier | Role | Data Flow | Raison |
|---------|------|-----------|--------|
| `.github/workflows/ci.yml` | config (CI) | — | `.github/` totalement absent du repo (vérifié RESEARCH). Suivre l'exemple YAML RESEARCH §Code Examples. |
| `.planning/phases/21-*/21-AUDIT.md` | doc (rapport) | — | Livrable documentaire SCALE-06, pas de code. Méthodo : RESEARCH §Pattern 3. |

---

## Metadata

**Analog search scope :** `playwright.config.ts`, `apps/web/e2e/{auth,gating}.spec.ts`, `apps/web/test/admin-rls.test.ts`, `apps/jobs/scripts/seed.ts` (+ `seed/`), `apps/web/src/app/(admin)/**`, `apps/web/src/app/[locale]/(dash)/**`, `.gitignore`, `package.json`, `20-UAT.md`
**Fichiers scannés :** ~12 lus directement
**Pattern extraction date :** 2026-06-26
