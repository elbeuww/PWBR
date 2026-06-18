---
phase: 07-affiliation-paliers
verified: 2026-06-18T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Tester le flux end-to-end : s'inscrire via ?ref=MONCODE, vérifier que referrals contient une ligne, relancer affiliate-commission, vérifier commissions.amount_atomic > 0 en DB."
    expected: "La ligne referrals existe, commission calculée correctement (non-zero si filleul actif), statut 'due'."
    why_human: "Teste l'intégration réseau réelle (Supabase LIVE, cookie httpOnly, RPC SQL). Impossible sans serveur et DB live."
  - test: "Tester l'isolation RLS : lancer les tests affiliate-rls.test.ts avec .env.test pointant sur la DB LIVE (SUPABASE_URL + ANON_KEY + SERVICE_ROLE_KEY présents)."
    expected: "4 tests passent — A ne voit pas les commissions de B, A ne voit pas les referrals de B, A voit uniquement sa ligne dans affiliate_dashboard, le superadmin voit A et B."
    why_human: "Le fichier existe et est structuré correctement mais contient describe.skipIf(!HAS_ENV) : skippé en CI locale sans credentials réseau réels."
  - test: "Tester le back-office payout : depuis /affiliation/payouts (superadmin), saisir un tx_hash + montant et soumettre payCommission. Vérifier que la commission passe à 'paid' et qu'une tentative de double-payout lève une erreur."
    expected: "Commission status='paid', payout inséré avec tx_hash. Deuxième soumission avec le même commission_id retourne une erreur (RPC raise)."
    why_human: "Flux UI + mutation DB atomique. Impossible à vérifier par grep — nécessite une session superadmin réelle et une commission 'due' en DB."
  - test: "Vérifier l'affichage du dashboard affilié : naviguer vers /(affiliate)/dashboard avec un compte affilié réel. Vérifier que les métriques reflètent les données DB (signups, active_referrals, commissions_due_atomic), qu'aucun user_id de filleul n'est visible, et que le palier/taux est correct."
    expected: "Tuiles affichent des valeurs réelles issues de affiliate_dashboard. Aucun user_id ou email de filleul exposé. Barre de progression vers le palier suivant cohérente avec le nombre d'inscrits."
    why_human: "Vérification no-PII visuelle + cohérence UI/DB. Impossible par grep statique."
---

# Phase 07 : Affiliation Paliers — Rapport de Vérification

**Phase Goal:** Implémenter le programme d'affiliation à paliers MERA (AFF-01..AFF-05) : attribution ?ref cookie 30j, isolation RLS, calcul mensuel commissions 8 paliers, payout tracé anti double-payout, filtre filleuls actifs uniquement.
**Verified:** 2026-06-18T00:00:00Z
**Status:** human_needed — 5/5 truths VERIFIED statiquement ; 4 items nécessitent validation humaine (réseau + UI)
**Re-verification:** Non — vérification initiale

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AFF-01 : `?ref` capturé en cookie httpOnly 30j (last-touch) → attribution figée au signup | VERIFIED | `captureRef.ts` : cookie httpOnly/sameSite=lax/secure/30j, regex `^[A-Z0-9]{3,20}$` anti-injection. `actions.ts signUp` : lit `aff_ref` cookie, appelle `attributeReferral(service_role)` best-effort, delete cookie après. `referrals` UNIQUE(user_id) dans 0016 = figé au premier signup. |
| 2 | AFF-02 : isolation RLS — affilié ne voit que SES données (tables + vue no-PII) | VERIFIED | 0016 : policies SELECT scopées `auth.uid()` sur affiliates/affiliate_codes/referrals/commissions/payouts. Vue `affiliate_dashboard` : `security_invoker=true` + `where a.user_id = auth.uid()`. Dashboard RSC lit via `createServerSupabaseClient` (jamais service_role). Test `affiliate-rls.test.ts` : 4 assertions cross-user structurellement correctes (skipIf réseau absent). |
| 3 | AFF-03 : calcul mensuel commissions, grille 8 paliers, idempotent | VERIFIED | RPC `compute_affiliate_commissions` (0016 L.264-317) : 8 paliers via `affiliate_rate_bps()`, UNIQUE(affiliate_id, referral_id, period) + `on conflict do update where status='due'`. Job `affiliate-commission.ts` + `dispatch.ts` L.64 wired. Tiers.ts golden-testé (17 cas aux bornes). `computeCommissions` repository wrappers. |
| 4 | AFF-04 : payout tracé (tx_hash + montant + date, anti double-payout) + back-office | VERIFIED | RPC `mark_commission_paid` (0016 L.331-362) : UPDATE where status='due' + GET DIAGNOSTICS + raise si 0 + INSERT payouts — atomique. `payouts/actions.ts` : re-valide superadmin, valide ATOMIC_PATTERN, appelle `markCommissionPaid`. Page `/affiliation/payouts` RSC : liste commissions, `PayoutRowAction` par ligne due. |
| 5 | AFF-05 : commission sur abonnés ACTIFS uniquement + auto-parrainage exclu | VERIFIED | 0016 L.289 : `r.user_id <> a.user_id` (D-12, inviolable). L.302-306 : JOIN subscriptions where `status='active' AND current_period_end > now()` (définition canonique 0009 répliquée). Confirmé dans `commissions.ts` commentaire : « filtre filleul actif AFF-05, exclusion self-ref D-12 ». |

**Score : 5/5 truths vérifiées statiquement.**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0016_affiliation.sql` | 6 tables + 2 RPC + vue + grille | VERIFIED | 393 lignes, tables affiliates/affiliate_codes/affiliate_applications/referrals/commissions/payouts + RLS + compute + mark + affiliate_dashboard. |
| `packages/core/src/affiliate/tiers.ts` | Grille 8 paliers TS bit-à-bit SQL | VERIFIED | Logique identique au SQL (case order du plafond vers la base). Note : TIERS[7].minSignups=50001 mais la fonction court-circuite à 50000 → cohérence avec SQL vérifiée et golden-testée. |
| `packages/core/src/affiliate/__tests__/tiers.test.ts` | Tests golden 17 cas bornes | VERIFIED | 17 cas aux bornes + tests TIERS + tests computeCommissionAtomic BigInt. |
| `packages/supabase/src/repositories/affiliates.ts` | attributeReferral + promoteAffiliate + createCode | VERIFIED | 3 fonctions substantielles, best-effort + idempotence + guard D-12 au niveau TS. |
| `packages/supabase/src/repositories/commissions.ts` | computeCommissions + markCommissionPaid | VERIFIED | Wrappers minces RPC, string bigint CR-02. |
| `packages/supabase/src/repositories/referrals.ts` | countReferrals | VERIFIED | Compteur audience D-02. |
| `packages/supabase/src/repositories/affiliateApplications.ts` | listPendingApplications + transitionApplication | VERIFIED | File de revue + transition status. |
| `packages/supabase/src/repositories/__tests__/affiliate-rls.test.ts` | 4 assertions cross-user | VERIFIED (structure) / UNCERTAIN (exécution réseau) | Fichier substantiel, describe.skipIf(!HAS_ENV). Assertions correctes. Non exécuté sans credentials live → HUMAN needed. |
| `apps/web/src/lib/affiliate/captureRef.ts` | Capture ?ref cookie httpOnly | VERIFIED | 44 lignes, logique complète, regex + cookie flags. |
| `apps/web/src/middleware.ts` | captureRef câblé (locale→ref→session) | VERIFIED | L.21 import, L.32 appel. Ordre verrouillé. |
| `apps/web/src/app/[locale]/(auth)/actions.ts` | signUp lit cookie, appelle attributeReferral | VERIFIED | L.59-73 : lecture cookie aff_ref, attributeReferral best-effort, delete cookie. |
| `apps/web/src/app/[locale]/(affiliate)/dashboard/page.tsx` | Dashboard RSC no-PII, auth-client | VERIFIED | createServerSupabaseClient (jamais service_role), from('affiliate_dashboard'), BigInt formatAtomic, aucun user_id filleul exposé. |
| `apps/web/src/app/(admin)/affiliation/page.tsx` | File de revue back-office | VERIFIED | listPendingApplications via service_role, approveApplication + rejectApplication. |
| `apps/web/src/app/(admin)/affiliation/payouts/page.tsx` + `payouts/actions.ts` | Payout back-office tracé | VERIFIED | payCommission re-valide superadmin, valide atomic pattern, markCommissionPaid atomique. |
| `apps/jobs/src/jobs/affiliate-commission.ts` | Job mensuel luxon UTC | VERIFIED | Période UTC via luxon, computeCommissions(service_role), dispatch.ts L.64. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| middleware.ts | captureRef.ts | import + appel L.32 | WIRED | Ordre locale→ref→session documenté et câblé. |
| signUp action | attributeReferral (affiliates.ts) | import `@app/supabase` + appel L.61 | WIRED | Best-effort + delete cookie post-attribution. |
| affiliate-commission.ts | compute_affiliate_commissions (DB) | computeCommissions → rpc() | WIRED | dispatch.ts L.64 enregistre le job. |
| payouts/actions.ts | mark_commission_paid (DB) | markCommissionPaid → rpc() | WIRED | requireRole superadmin re-validé en tête. |
| (affiliate)/dashboard/page.tsx | affiliate_dashboard (vue) | createServerSupabaseClient → from('affiliate_dashboard') | WIRED | Jamais service_role — RLS scopée auth.uid(). |
| tiers.ts | SQL affiliate_rate_bps | miroir logique (golden-testé) | WIRED | Grille TS bit-à-bit SQL, 17 cas golden figés. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `(affiliate)/dashboard/page.tsx` | `data.total_signups`, `data.active_referrals`, `data.commissions_due_atomic` | Vue `affiliate_dashboard` → `from('affiliate_dashboard').maybeSingle()` | Oui — vue agrège depuis affiliates/referrals/subscriptions/payments/commissions LIVE | FLOWING (statique) / UNCERTAIN (runtime — human needed) |
| `(admin)/affiliation/payouts/page.tsx` | `rows` | `commissions` table via `createAdminServiceClient()` → select avec join affiliates→profiles→payouts | Oui — requête DB réelle avec JOIN | FLOWING |
| `affiliate-commission.ts` | `stats` | `compute_affiliate_commissions` RPC | Oui — RPC exécute INSERT/upsert en DB | FLOWING |

---

### Garde-fous financiers — vérification détaillée

| Garde-fou | Décision | Emplacement SQL | Emplacement TS | Statut |
|-----------|----------|-----------------|----------------|--------|
| Exclusion auto-parrainage | D-12 (inviolable) | 0016 L.289 : `r.user_id <> a.user_id` dans la jointure du RPC | `affiliates.ts` L.74 : guard TS supplémentaire au level attribution | VERIFIED |
| Idempotence UNIQUE(affiliate_id, referral_id, period) | D-05, T-07-DOUBLEPAY | 0016 L.184-185 : index unique + `on conflict do update where status='due'` | Documenté dans `commissions.ts` commentaire | VERIFIED |
| Anti double-payout (raise si déjà payée) | T-07-DOUBLEPAY | 0016 L.347-352 : UPDATE where status='due' + GET DIAGNOSTICS + raise si v_updated=0 | `commissions.ts markCommissionPaid` propagate l'erreur | VERIFIED |
| Filtre filleuls ACTIFS uniquement | AFF-05 | 0016 L.302-306 : JOIN subscriptions where `status='active' AND current_period_end > now()` | N/A (calcul 100% DB) | VERIFIED |
| No-PII vue dashboard | D-13, T-07-PII | Vue 0016 L.372-392 : GROUP BY a.id, zero user_id filleul, `security_invoker=true` | Dashboard RSC lit via auth-client uniquement | VERIFIED |
| Commission jamais écrasée si payée | D-15 | `on conflict do update where status='due'` (L.312) | N/A | VERIFIED |
| Validation code vanity anti-injection | T-07-REFINJ | 0016 L.86 : `code ~ '^[A-Z0-9]{3,20}$'` (PK check) | `captureRef.ts` L.22 + `actions.ts` L.36 (double validation) | VERIFIED |
| Montants atomiques jamais Number (BigInt) | CR-02, T-07-FLOAT | bigint Postgres, string PostgREST | `computeCommissionAtomic` BigInt, `formatAtomic(BigInt(...))` dans pages | VERIFIED |

---

### Cohérence grille TS / SQL

La grille TS (`tiers.ts`) présente une subtilité documentée :
- `TIERS[7].minSignups = 50001` (plafond affiché)
- Mais `affiliateRateBps()` court-circuite à `>= 50000` → 2000 bps (comme le SQL `>= 50000 → 2000`)
- Résultat : 50000 inscrits → 2000 bps dans les deux (TS et SQL). Cohérent.
- Cas 50001 : TS → 2000 (premier if), SQL → 2000 (`>= 50000`). Cohérent.
- Test golden L.31 : `[50000, 2000]` et L.45-47 : `50001 → 2000`. VERROUILLE les deux cas.

**Verdict grille : bit-à-bit identique SQL/TS, golden-testée.**

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|-------------|-------------|--------|----------|
| AFF-01 | 07-01/07-02/07-06 | Attribution ?ref cookie 30j last-touch → referrals au signup | SATISFIED | captureRef.ts + middleware wired + signUp action + attributeReferral + UNIQUE(user_id) referrals |
| AFF-02 | 07-01/07-03 | Isolation RLS affilié ne voit que SES données | SATISFIED (structure) / human-verify (exécution) | RLS policies 0016 + security_invoker vue + auth-client dashboard + test structuré (skip réseau) |
| AFF-03 | 07-01/07-04 | Calcul mensuel commissions RPC, grille 8 paliers, idempotent UNIQUE période | SATISFIED | compute_affiliate_commissions 0016 + tiers.ts golden-testé + job wired dispatch |
| AFF-04 | 07-01/07-05 | Payout tracé tx_hash+montant+date, anti double-payout, back-office | SATISFIED | mark_commission_paid atomic 0016 + payouts/actions.ts superadmin + payouts/page.tsx |
| AFF-05 | 07-01/07-04 | Commission abonnés ACTIFS uniquement + auto-parrainage exclu | SATISFIED | JOIN subscriptions status='active' + r.user_id <> a.user_id dans RPC 0016 |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/app/[locale]/(auth)/actions.ts` | 69 | `console.error(...)` best-effort attribution | Info | Intentionnel (logging serveur d'erreur best-effort documenté — pas de stub) |
| `apps/web/src/app/[locale]/affiliation/actions.ts` | 82 | `console.error(...)` insert échoué | Info | Intentionnel (anti-fuite d'implémentation, loggé côté serveur) |

Aucun TBD/FIXME/XXX non référencé. Aucun `return null` / `return []` stub non justifié. Aucun placeholder UI.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `affiliateRateBps(50000) === 2000` | `node -e "import('./packages/core/src/affiliate/tiers.js').then(m=>console.log(m.affiliateRateBps(50000)))"` | Non exécutable sans build (ESM/tsx requis) | SKIP — golden-testé via vitest |
| `computeCommissionAtomic(9_000_000n, 1400) === 1_260_000n` | vitest tiers.test.ts | 17 cas passés (contexte SUMMARY) | PASS (indirecte — test golden documenté) |
| Job `affiliate-commission` enregistré dans dispatch | `grep "affiliate-commission" apps/jobs/src/dispatch.ts` | L.64 : `'affiliate-commission': affiliateCommission` | PASS |
| `captureRef` câblé dans middleware | `grep "captureRef" apps/web/src/middleware.ts` | L.21 import + L.32 appel | PASS |

---

### Différés et dette documentée

| Item | Type | Décision | Impact |
|------|------|----------|--------|
| Tests RLS réseau (`affiliate-rls.test.ts`) | Différé réseau (D-05-01-DEFER) | skipIf(!HAS_ENV) — exécutables dès .env.test live disponible | WARNING — couverture réseau non prouvée en CI |
| Windows Task Scheduler affiliate-commission | Opérationnel (hors code) | Délégué manuellement — job dispatch.ts est prêt | WARNING — scheduling réel non vérifié par le code |
| `supabase gen types --linked` désactivé | Convention repo (D-01-01-D) | database.types.ts édité manuellement après generate_typescript_types | Info — technique intentionnelle, documentée |

---

### Human Verification Required

#### 1. Flux end-to-end attribution ?ref

**Test:** Naviguer vers `/?ref=MONCODE`, s'inscrire avec un email neuf, vérifier la table `referrals` en DB.
**Expected:** Une ligne dans `referrals` avec `affiliate_id` correspondant au code, `user_id` du nouvel user.
**Why human:** Cookie httpOnly, redirection post-signup, écriture service_role — ne peut être vérifié que par exécution réelle.

#### 2. Tests RLS réseau (affiliate-rls.test.ts)

**Test:** Lancer `pnpm vitest run packages/supabase/src/repositories/__tests__/affiliate-rls.test.ts` avec `.env.test` contenant `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
**Expected:** 4 tests passent — isolation cross-user prouvée sur la DB LIVE avec migration 0016.
**Why human:** describe.skipIf(!HAS_ENV) — skippé sans credentials réseau réels. La structure d'assertion est correcte mais non exécutée en CI.

#### 3. Anti double-payout back-office

**Test:** Via `/affiliation/payouts` (superadmin), payer une commission (tx_hash + montant), puis retenter le paiement de la même commission.
**Expected:** Premier paiement : ok:true, commission status='paid', payouts inséré. Deuxième tentative : erreur `mark_commission_paid: commission X introuvable ou déjà payée`.
**Why human:** Mutation DB atomique + gestion d'erreur UI — impossible à vérifier statiquement.

#### 4. Dashboard affilié no-PII et métriques live

**Test:** Se connecter avec un compte affilié (role='affiliate') ayant des filleuls réels, naviguer vers `/(affiliate)/dashboard`.
**Expected:** Tuiles affichent des valeurs réelles (non-zero si filleuls actifs), aucun user_id/email de filleul visible, palier/taux cohérents avec le nombre d'inscrits, barre de progression correcte.
**Why human:** Rendu UI + données DB live — vérification no-PII visuelle et cohérence palier/commission.

---

### Gaps Summary

Aucun gap BLOCKER identifié. Les 5 requirements (AFF-01..AFF-05) sont couverts structurellement et câblés bout en bout. Les 4 items de vérification humaine sont des validations runtime/réseau/UI qui ne peuvent pas être prouvées par analyse statique du code, non des lacunes d'implémentation.

---

_Verified: 2026-06-18T00:00:00Z_
_Verifier: Claude (gsd-verifier) — analyse statique exhaustive (SQL, TS, wiring, tests, UI)_
