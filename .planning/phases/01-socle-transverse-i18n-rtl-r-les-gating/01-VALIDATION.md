---
phase: 1
slug: socle-transverse-i18n-rtl-r-les-gating
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-14
approved: 2026-06-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (intégration, `packages/supabase/__tests__/`) + Playwright 1.60.0 (E2E, `apps/web/e2e/`) |
| **Config file** | `vitest.config.ts` (racine) ; `playwright.config.ts` (racine) — déjà présents (couvrent `rls.test.ts` / `auth.spec.ts`) |
| **Quick run command** | `pnpm --filter @app/supabase test gating-rls` (RLS = cœur sécurité) + `pnpm --filter web typecheck` |
| **Full suite command** | `pnpm test` (Vitest workspace) puis `pnpm --filter web exec playwright test` (E2E) |
| **Estimated runtime** | Vitest ciblé ~15–30 s (réseau Supabase) ; typecheck ~20–40 s ; suite Playwright ~60–120 s (dev server + 3 specs) ; full ~3–4 min |

**Pré-requis GREEN :** `.env.test` (NEXT_PUBLIC_SUPABASE_URL + ANON + SERVICE_ROLE) rempli, migrations 0008/0009 poussées (01-01 T3 BLOCKING), dev server `apps/web` lancé pour les E2E. Sans `.env`, les tests RLS/E2E **skip** (pattern existant) — ne pas confondre skip et GREEN.

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @app/supabase test gating-rls` (si touche DB/gate) + `pnpm --filter web typecheck` (si touche TS).
- **After every plan wave:** Run `pnpm test` (Vitest full) + `pnpm --filter web exec playwright test` (Playwright full).
- **Before `/gsd:verify-work`:** Full suite green + revue visuelle RTL arabe.
- **Max feedback latency:** ~40 s (quick) ; ~4 min (full).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | ACCESS-02, ACCESS-03, ACCESS-04 | T-01-01 / T-01-02 / T-01-03 | RLS `has_active_subscription()`/`is_superadmin()` security definer search_path figé ; rôle hors JWT | static (grep DDL) | `grep -v '^--' supabase/migrations/0009_subscriptions_gating.sql \| grep -c "has_active_subscription"` (≥3) | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | ACCESS-02, ACCESS-03, ACCESS-04 | T-01-01 / T-01-04 | Anon-client non-abonné → 0 ligne ; isolation subscriptions cross-user | integration | `pnpm --filter @app/supabase test gating-rls` (RED attendu jusqu'à T3) | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | ACCESS-02, ACCESS-03, ACCESS-04 | T-01-01 / T-01-04 | Push migrations + types régénérés → gating-rls GREEN ; rls.test.ts non régressé | integration (checkpoint:human-action BLOCKING) | `pnpm --filter @app/supabase test gating-rls && pnpm --filter @app/supabase test rls` | ✅ (créé T2) | ⬜ pending |
| 01-02-01 | 02 | 1 | I18N-01, I18N-03 | T-01-SC | Paquets verrouillés versions exactes ; plugin next-intl + Tailwind v4 câblés | static (node check) | `node -e "const p=require('./apps/web/package.json');process.exit(p.dependencies['next-intl']&&p.devDependencies['@tailwindcss/postcss']?0:1)"` | ✅ | ⬜ pending |
| 01-02-02 | 02 | 1 | I18N-01 | T-01-05 | `hasLocale` fallback defaultLocale (locale URL non fiable) | static (grep) | `grep -q "localePrefix" apps/web/src/i18n/routing.ts && grep -q "getRequestConfig" apps/web/src/i18n/request.ts` | ✅ | ⬜ pending |
| 01-02-03 | 02 | 1 | I18N-03 | — | Parité de clés stricte fr/en/ar (aucune chaîne manquante/en dur) | static (node parity) | `node -e "<script parité k(f)===k(e)===k(a)>"` (cf. 01-02 T3) | ✅ | ⬜ pending |
| 01-03-01 | 03 | 2 | ACCESS-01 | T-01-06 / T-01-07 | Middleware compose handleI18n→updateSession en mutant la response (pas de perte locale/session) ; x-pathname pour returnTo | static (grep) | `grep -q "updateSession(request, response)" apps/web/middleware.ts && grep -q "x-pathname" apps/web/middleware.ts && grep -q "handleI18n" apps/web/middleware.ts` | ✅ | ⬜ pending |
| 01-03-02 | 03 | 2 | I18N-01, I18N-02 | — | Un seul `<html lang dir>` ; root pass-through ; switcher accessible RTL-aware | static (grep) | `grep -rL "<html" apps/web/src/app/layout.tsx >/dev/null && grep -q "dir={locale" apps/web/src/app/[locale]/layout.tsx && grep -q "usePathname" apps/web/src/components/LanguageSwitcher.tsx` | ✅ | ⬜ pending |
| 01-03-03 | 03 | 2 | ACCESS-01, ACCESS-02, ACCESS-03 | T-01-06 / T-01-07 / T-01-08 / T-01-09 / T-01-02 | gate.ts getUser() jamais getSession ; returnTo same-origin validé ; non-superadmin→notFound ; gate au RSC layout ; typé contre types régénérés | static (grep) + typecheck | `grep -q "getUser" apps/web/src/lib/auth/gate.ts && ! grep -q "getSession" apps/web/src/lib/auth/gate.ts && pnpm --filter web typecheck` | ✅ | ⬜ pending |
| 01-03-04 | 03 | 2 | I18N-03, I18N-04 | — | Routes auth+dashboard sous [locale] ; redirects localisés ; chaînes externalisées ; classes logiques (RTL) | static (grep/test -f) | `test -f "apps/web/src/app/[locale]/(auth)/actions.ts" && test -f "apps/web/src/app/[locale]/dashboard/page.tsx" && ! grep -rn "textAlign" "apps/web/src/app/[locale]/dashboard/page.tsx"` | ✅ | ⬜ pending |
| 01-04-01 | 04 | 3 | I18N-01, I18N-02, I18N-04 | — | Bascule locale même page + persistance ; `<html dir=rtl/lang=ar>` ; / → /fr | e2e | `pnpm --filter web exec playwright test e2e/i18n.spec.ts` | ❌ W0 | ⬜ pending |
| 01-04-02 | 04 | 3 | ACCESS-01, ACCESS-02, ACCESS-03 | T-01-07 / T-01-08 | non-auth→login+returnTo ; auth-sans-abo→/tarifs ; non-superadmin→404 ; returnTo //evil.com non suivi | e2e | `pnpm --filter web exec playwright test e2e/gating.spec.ts` | ❌ W0 | ⬜ pending |
| 01-04-03 | 04 | 3 | I18N-03 | T-01-10 | Aucune chaîne en dur dans le JSX hors messages/ | static check | `node scripts/check-i18n-hardcoded.mjs` (exit 0) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*File Exists: ✅ = test/cible présent · ❌ W0 = créé en Wave 0 d'exécution*

---

## Wave 0 Requirements

Wave 0 (exécution, AVANT toute implémentation) doit créer / vérifier :

- [ ] `packages/supabase/__tests__/gating-rls.test.ts` — stubs ACCESS-02/03/04 (créé par 01-01 T2, réplique `rls.test.ts`)
- [ ] `apps/web/e2e/i18n.spec.ts` — stubs I18N-01/02/04 (créé par 01-04 T1)
- [ ] `apps/web/e2e/gating.spec.ts` — stubs ACCESS-01/02/03 + returnTo same-origin (créé par 01-04 T2)
- [ ] `scripts/check-i18n-hardcoded.mjs` + script npm `lint:i18n` — I18N-03 (créé par 01-04 T3)
- [ ] `.env.test` rempli (URL + ANON + SERVICE_ROLE) — sinon tests RLS/E2E skip
- [ ] Vitest : confirmer `packages/supabase/__tests__` inclus dans le workspace (déjà le cas pour `rls.test.ts`)
- [ ] Playwright : confirmer `playwright.config.ts` racine + navigateurs installés (`pnpm --filter web exec playwright install` si absent)

*Frameworks Vitest + Playwright déjà installés et configurés (rls.test.ts / auth.spec.ts existent) — pas d'install framework supplémentaire requise.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rendu visuel RTL arabe (miroir layout, ancrage `end`, dropdown menu côté start) | I18N-02 | L'attribut `dir=rtl` est asserté en E2E, mais la justesse VISUELLE du miroir (pas de classe physique oubliée) nécessite l'œil humain | Charger `/ar/login` et `/ar/dashboard`, vérifier que header/switcher/champs sont bien en miroir, aucun débordement |
| Formatage locale-aware d'une donnée réelle (nombre/prix/date via `<bdi>`/`useFormatter`) | I18N-04 | En P1 aucune donnée numérique réelle n'est rendue dans l'UI ; le câblage `useFormatter` existe mais n'a pas de donnée à formater avant P3 | Vérifié pleinement en P3+ quand une valeur formatée apparaît ; en P1, présence de l'import/usage `useFormatter` suffit (01-03 T4) |

*Note : si l'implémentation 01-04 T1 rend une donnée formatée (ex. date de page), elle sera assertée en E2E et retirée d'ici.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (01-03 T1→T2 static + T3 typecheck cassent toute fenêtre ; W0 specs couvrent Wave 3)
- [x] Wave 0 covers all MISSING references (gating-rls, i18n.spec, gating.spec, lint:i18n script, .env.test)
- [x] No watch-mode flags
- [x] Feedback latency < 240 s (full suite)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-14
</content>
