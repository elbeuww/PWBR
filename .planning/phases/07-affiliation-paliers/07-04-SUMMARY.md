---
phase: 07-affiliation-paliers
plan: 04
subsystem: web/middleware + auth server-action
status: complete
requirements: [AFF-01, AFF-05]
tags: [ref-capture, cookie-aff-ref, last-touch, attribution-signup, service-role, best-effort, anti-injection, e2e-human-verify]
dependency_graph:
  requires:
    - "apps/web/src/middleware.ts (middleware composé handleI18n → updateSession, D-01-03-B)"
    - "apps/web/src/lib/supabase/admin-service.ts (createAdminServiceClient, service_role server-only)"
    - "@app/supabase : attributeReferral (07-03, best-effort code inconnu/self-ref/23505)"
    - "apps/web/src/app/[locale]/(auth)/actions.ts (signUp existant, redirect /paiement-bientot D-02-03-B)"
  provides:
    - "captureRef (helper middleware, pose cookie aff_ref validé 30j last-touch)"
    - "signUp étendu : lecture cookie aff_ref + attributeReferral best-effort + delete cookie"
    - "cookie aff_ref (httpOnly, secure, sameSite=lax, 30j) capturé sur ?ref valide"
  affects:
    - "07-05 (back-office : createCode alimente les codes que captureRef capture)"
    - "AFF-01 bout en bout (visiteur ?ref → attribué à l'affilié au signup)"
tech_stack:
  added: []
  patterns:
    - "capture ?ref dans le middleware composé en MUTANT la response next-intl (Pitfall 2, ordre locale → ref → session)"
    - "validation regex ^[A-Z0-9]{3,20}$ AVANT pose du cookie (anti-injection T-07-REFINJ)"
    - "attribution figée au signup via server action (le trigger DB ne voit pas le cookie HTTP — D-11)"
    - "attribution best-effort try/catch ABSOLU : signup réussit toujours (T-07-ATTR-CRASH, A2)"
    - "E2E authoré + GREEN human-verify (préconditions documentées, jamais fabriqué — D-01-04-C)"
key_files:
  created:
    - apps/web/src/lib/affiliate/captureRef.ts
    - apps/web/src/lib/affiliate/__tests__/captureRef.test.ts
    - apps/web/e2e/affiliation-attribution.spec.ts
  modified:
    - apps/web/src/middleware.ts
    - apps/web/src/app/[locale]/(auth)/actions.ts
    - .planning/phases/07-affiliation-paliers/deferred-items.md
decisions: [D-07-04-A, D-07-04-B, D-07-04-C]
commits: [f53302e, 0169370, f066d77]
metrics:
  duration: ~10 min
  tasks: 2
  files: 6
  tests_added: 8
  completed: 2026-06-18
---

# Phase 07 Plan 04 : Capture ?ref (cookie 30j last-touch) + attribution figée au signup Summary

Capture `?ref` branchée dans le middleware composé existant — un cookie `aff_ref` (httpOnly/secure/sameSite=lax, 30 jours, last-touch) est posé sur tout `?ref=CODE` conforme à `^[A-Z0-9]{3,20}$`, et ignoré sinon (anti-injection T-07-REFINJ). À l'inscription, `signUp` lit ce cookie côté serveur et écrit le referral via `attributeReferral` (service_role local, RLS interdit l'écriture front) en best-effort ABSOLU : code inconnu, self-ref, déjà attribué ou erreur DB — l'inscription réussit toujours et redirige vers `/paiement-bientot`. C'est le point dur de la phase : le trigger DB `handle_new_user` ne voit pas le cookie HTTP, donc l'attribution se fait dans la server action (D-11). AFF-01 est ainsi couvert bout en bout.

## Tasks Completed

### Task 1 — captureRef (helper middleware) + tests + insertion middleware (TDD)
- `captureRef(request, response)` : lit `request.nextUrl.searchParams.get('ref')`, normalise `toUpperCase().trim()`, valide `^[A-Z0-9]{3,20}$` AVANT pose. Valeur absente ou non conforme → no-op. Valide → `response.cookies.set({ name:'aff_ref', value:code, maxAge: 60*60*24*30, httpOnly:true, sameSite:'lax', secure:true, path:'/' })`. Last-touch (D-10) : écrase toujours.
- Inséré dans `middleware.ts` ENTRE `response.headers.set('x-pathname', …)` et `return await updateSession(…)` — ordre verrouillé **locale → ref → session** (D-09). MUTE la même response next-intl (ne la recrée pas, Pitfall 2).
- 8 tests vitest verts : code valide (valeur + 6 options), normalisation minuscule→majuscule, code non conforme/trop court/trop long → 0 cookie, absence/vide → 0 cookie, last-touch (le dernier gagne).
- Commits : `f53302e` (RED, module absent) → `0169370` (GREEN captureRef + middleware).

### Task 2 — Attribution au signup (wrapper signUp service_role) + E2E
- `signUp` étendu APRÈS `auth.signUp` réussi (`data.user`) et AVANT `redirect('/paiement-bientot')` : lit `(await cookies()).get('aff_ref')?.value`, appelle `attributeReferral(createAdminServiceClient(), { affiliate_code, referral_user_id: data.user.id })` dans un `try/catch` best-effort (échec loggé serveur, jamais propagé), puis `cookieStore.delete('aff_ref')` (consommé une fois).
- `toSafeErrorKey`, `signIn`, `signOut` et la cible `/paiement-bientot` intacts (D-02-03-B). Aucune modification de `supabase.auth`/`getUser`/`getSession` au-delà du `data` destructuré sur `signUp`.
- E2E `affiliation-attribution.spec.ts` authoré (3 tests, assertions réelles) : `?ref=TESTCODE` → cookie posé, code invalide → 0 cookie, signup → ligne `referrals` via service_role. `npx playwright test --list` parse les 3 tests. GREEN = human-verify (préconditions en tête du spec + deferred-items.md).
- Commit : `f066d77`.

## Decisions Made

- **D-07-04-A** : `captureRef` inséré comme 3ᵉ étape du middleware composé en MUTANT la response next-intl (jamais `NextResponse.next()` recréée — même invariant que `updateSession`, Pitfall 2/D-01-03-B). Ordre verrouillé locale → ref → session (D-09). Cookie httpOnly (T-07-COOKIE, non lisible/forgeable JS) + sameSite=lax (capture cross-site sur navigation top-level depuis un lien influenceur, A1).
- **D-07-04-B** : attribution figée à l'inscription via server action (D-11) — le trigger DB `handle_new_user` (`search_path=''`) ne voit pas le cookie HTTP, donc l'écriture `referrals` se fait dans `signUp` via service_role local (`createAdminServiceClient`, server-only ; la RLS D-07 interdit toute écriture front sur `referrals`). Cookie consommé (`delete`) une fois — le last-touch s'est déjà joué côté cookie.
- **D-07-04-C** : best-effort ABSOLU (T-07-ATTR-CRASH, A2) — `attributeReferral` enveloppé dans `try/catch` ; `console.error` serveur (jamais `console.log` ; logging d'échec best-effort), jamais propagé. Un code inconnu / self-ref (D-12, no-op repo) / 23505 idempotent / erreur DB ne bloque JAMAIS la création de compte ; `signUp` redirige `/paiement-bientot` dans tous les cas.

## Deviations from Plan

None — plan exécuté tel qu'écrit. Les chemins/symboles exacts du frontmatter `files_modified` sont respectés ; aucune fonctionnalité critique manquante détectée (le best-effort, l'anti-injection et le service_role server-only étaient déjà spécifiés au plan et au threat_model).

## Verification

- `npx vitest run apps/web/src/lib/affiliate/__tests__/captureRef.test.ts` → **8/8 verts**.
- `npx vitest run` (suite complète) → **465 passed | 4 skipped** (non-régression, 0 fail).
- `pnpm typecheck` → **0 erreur**.
- `pnpm lint:i18n` → **exit 0** (aucune chaîne en dur).
- `npx playwright test --list affiliation-attribution.spec.ts` → **3 tests listés** (parse OK).
- Acceptance greps : `attributeReferral(`=2, `paiement-bientot`=1 (inchangé), `aff_ref` (get+delete)=2.
- Sécurité service_role : `SUPABASE_SERVICE_ROLE_KEY` lue uniquement via `process.env` (sans préfixe `NEXT_PUBLIC_`), dans `admin-service.ts` (`import 'server-only'`). Aucune fuite vers le bundle client. Le seul match `NEXT_PUBLIC_.*SERVICE_ROLE` est un message d'erreur littéral (faux positif), pas une variable.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-07-REFINJ | regex `^[A-Z0-9]{3,20}$` validée AVANT pose du cookie ; valeur jamais concaténée |
| T-07-COOKIE | cookie aff_ref httpOnly + secure + sameSite=lax ; code forgé → no-op à la résolution DB |
| T-07-ATTR-CRASH | attribution best-effort try/catch ; un code invalide ne bloque jamais l'inscription (A2) |
| T-07-RLS-WRITE | écriture referrals via service_role local (admin-service server-only) ; aucune policy write front |
| T-07-SC | aucun paquet npm ajouté |

## Known Stubs

None. `captureRef` et le wrapper d'attribution sont câblés à des données réelles (cookie HTTP + `attributeReferral` 07-03 contre la DB). L'E2E n'est pas un stub — c'est un test authoré dont le GREEN relève d'une vérification humaine (préconditions infra), documenté en deferred-items.md.

## Human-Verify Preconditions (E2E AFF-01)

Le run GREEN de `affiliation-attribution.spec.ts` exige (sans quoi le vert n'est pas vérifiable) :
1. Dev server sur `http://localhost:3000`.
2. Table `affiliate_codes` pré-populée avec `TESTCODE`, rattaché à un affilié seedé (`affiliates.user_id` ≠ compte signup de test) via service_role.
3. `.env` chargé : `SUPABASE_URL` (ou `NEXT_PUBLIC_SUPABASE_URL`) + `SUPABASE_SERVICE_ROLE_KEY` (assertion DB cross-user de la ligne `referrals`). « Confirm email » OFF (D-02), emails `@gmail.com`.

Détaillé dans `deferred-items.md` (section 07-04).

## Next Steps

- 07-05 (back-office affiliation) : `promoteAffiliate`/`createCode` (les codes créés ici alimentent ce que `captureRef` capture), `listPendingApplications`/`transitionApplication`, `markCommissionPaid` + mapping `CodeTakenError`.
- Ops : exécuter l'E2E AFF-01 GREEN une fois les 3 préconditions human-verify fournies.

## Self-Check: PASSED
