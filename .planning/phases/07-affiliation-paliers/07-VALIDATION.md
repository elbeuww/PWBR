---
phase: 7
slug: affiliation-paliers
status: validated
nyquist_compliant: partial
wave_0_complete: true
created: 2026-06-18
updated: 2026-06-18
---

# Phase 7 — Validation Strategy

> Contrat de validation par phase : échantillonnage de feedback pendant l'exécution + cartographie requirement→test.

**Result:** PARTIAL — 5/5 requirements ont une vérification automatisée au niveau logique/TS (53 tests verts) ; les comportements *live-infra* (RLS runtime, raise DB atomique, filtre abonnés actifs, rendu UI no-PII) sont intrinsèquement manuels (Supabase LIVE requis). Aucune lacune MISSING auto-générable.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 |
| **Config file** | `vitest.config.ts` (racine workspace) |
| **Quick run command** | `pnpm vitest run packages/core/src/affiliate packages/supabase/src/repositories/affiliation.guards.test.ts packages/supabase/src/repositories/__tests__/affiliates.test.ts "apps/web/src/lib/affiliate/__tests__/captureRef.test.ts" "apps/web/src/messages/__tests__/messages-parity-affiliate.test.ts"` |
| **Full suite command** | `pnpm test` (`vitest run`) + `pnpm typecheck` |
| **RLS network suite** | `pnpm vitest run packages/supabase/src/repositories/__tests__/affiliate-rls.test.ts` (exige `.env.test` live — voir Manual-Only) |
| **Estimated runtime** | ~210 ms (sous-ensemble affiliation, 53 tests) |

---

## Sampling Rate

- **After every task commit:** Run quick command (sous-ensemble affiliation).
- **After every plan wave:** Run `pnpm test` + `pnpm typecheck`.
- **Before `/gsd:verify-work`:** Full suite verte (hors tests réseau-gated, exécutés en staging).
- **Max feedback latency:** < 5 s (sous-ensemble) ; suite complète bornée.

---

## Per-Task Verification Map

| Plan | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Test File | Status |
|------|-------------|------------|-----------------|-----------|-------------------|-----------|--------|
| 07-01 | AFF-01 | T-07-ATTR-CRASH / T-07-SELFREF | `attributeReferral` best-effort : code inconnu→no-op, self-ref→skip, insert→ok, 23505→idempotent, autre erreur→throw | unit | quick | `repositories/__tests__/affiliates.test.ts` | ✅ green (5) |
| 07-01 | AFF-02 | T-07-RLS-ISO / T-07-PII | A ne lit ni commission ni referral de B ; vue `affiliate_dashboard` scopée ; superadmin voit tout | integration | RLS network | `repositories/__tests__/affiliate-rls.test.ts` | ⚠️ skipIf réseau (4) → Manual-Only |
| 07-02 | AFF-03 | T-07-FLOAT / T-07-DRIFT | Grille 8 paliers bit-à-bit SQL ; `computeCommissionAtomic` BigInt-only ; bornes verrouillées | unit | quick | `core/src/affiliate/__tests__/tiers.test.ts` | ✅ green (17 golden + BigInt) |
| 07-04 | AFF-03 | T-07-TZ | `computeCommissions` : rejet période hors 01-12 / non-YYYY-MM SANS appeler le RPC ; invoque RPC si valide | unit | quick | `repositories/affiliation.guards.test.ts` (M-04) | ✅ green (3) |
| 07-04 | AFF-05 | T-07-SELFREF | Exclusion auto-parrainage `r.user_id <> a.user_id` testée côté attribution (self-ref→skip) | unit | quick | `repositories/__tests__/affiliates.test.ts` | ✅ green |
| 07-04 | AFF-05 | — | Filtre filleuls ACTIFS uniquement (JOIN subscriptions `status='active'`) — 100 % DB SQL | runtime | — | (DB-only) | 🔵 Manual-Only |
| 07-05 | AFF-04 | T-07-DOUBLEPAY / CR-02 | `markCommissionPaid` appelle le RPC avec `p_amount_atomic` STRING ; propage l'erreur anti double-payout | unit | quick | `repositories/__tests__/affiliates.test.ts` | ✅ green (2) |
| 07-05 | AFF-04 | T-07-ADMIN-WRITE | `transitionApplication` : UPDATE filtré `id ET status=pending` ; lève si 0 ligne ; succès sur 1 ligne | unit | quick | `repositories/affiliation.guards.test.ts` (M-01) | ✅ green (3) |
| 07-05 | AFF-04 | T-07-DOUBLEPAY | Raise DB atomique réel (UPDATE where due + GET DIAGNOSTICS) sur double-payout | runtime | — | (RPC DB-only) | 🔵 Manual-Only |
| 07-06 | AFF-01 | T-07-REFINJ / T-07-COOKIE | `captureRef` : cookie httpOnly/secure/sameSite=lax, normalisation maj, rejet non-conforme/court/long, no-op absent, last-touch D-10 | unit | quick | `apps/web/src/lib/affiliate/__tests__/captureRef.test.ts` | ✅ green (9) |
| 07-06 | AFF-06 (no-perf) | T-07-NOPERF | Parité i18n fr/en/ar + garde no-perf (FORBIDDEN regex) sur la copy affiliation | unit | quick | `messages/__tests__/messages-parity-affiliate.test.ts` | ✅ green |
| 07-06 | AFF-02 | T-07-PII | Rendu dashboard no-PII (aucun user_id/email filleul) + métriques live cohérentes | runtime | — | (UI live) | 🔵 Manual-Only |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky/gated · 🔵 manual-only*

**Résultat suite quick (2026-06-18) :** `Test Files 5 passed | 1 skipped (6) · Tests 53 passed | 4 skipped (57)` en 210 ms. Les 4 skipped = `affiliate-rls.test.ts` (réseau-gated).

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. vitest 4.1.8 + `vitest.config.ts` étaient déjà en place ; aucun framework à installer. Tous les fichiers de test ci-dessus existent et sont verts (hors gated réseau).

---

## Manual-Only Verifications

Comportements *live-infra* — non automatisables sans Supabase LIVE / session UI réelle. Repris du `07-VERIFICATION.md` (status `human_needed`) et `07-SECURITY.md` (human-verify items). Ce ne sont PAS des lacunes d'implémentation : la logique statique est COVERED, seul le runtime réseau/DB/UI reste à éprouver.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Isolation RLS cross-user runtime | AFF-02 | `affiliate-rls.test.ts` est `describe.skipIf(!HAS_ENV)` — exige un moteur RLS Postgres réel (impossible à simuler en unit). | `pnpm vitest run packages/supabase/src/repositories/__tests__/affiliate-rls.test.ts` avec `.env.test` = `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`. Attendu : 4 tests verts (A↛B commissions/referrals, vue scopée, superadmin voit tout). **À lancer sur staging avant exposition multi-tenant.** |
| Flux end-to-end attribution `?ref` | AFF-01 | Cookie httpOnly + redirection signup + écriture service_role — runtime réseau réel. | Naviguer `/?ref=MONCODE`, s'inscrire (email neuf), vérifier `referrals` (ligne avec `affiliate_id` du code, `user_id` du nouvel user) puis relancer `affiliate-commission` → `commissions.amount_atomic > 0`, statut `due`. |
| Raise DB atomique anti double-payout | AFF-04 | `mark_commission_paid` RPC : UPDATE where due + GET DIAGNOSTICS + raise — vérifiable seulement en DB live. | Via `/affiliation/payouts` (superadmin), payer une commission (tx_hash 64-hex + montant), retenter le même `commission_id`. Attendu : 1er → `paid` + payout inséré ; 2e → erreur RPC. |
| Filtre filleuls ACTIFS uniquement | AFF-05 | JOIN `subscriptions status='active' AND current_period_end > now()` 100 % SQL — pas de frontière JS testable. | Filleul avec abonnement expiré → commission 0 ; filleul actif → commission non-nulle. Vérifier en relançant le RPC sur données live. |
| Dashboard affilié no-PII + métriques live | AFF-02 | Rendu UI + données DB live — vérification no-PII visuelle. | Compte `role='affiliate'` avec filleuls réels → `/(affiliate)/dashboard`. Attendu : valeurs réelles, aucun user_id/email filleul, palier/taux/barre cohérents. |

---

## Validation Sign-Off

- [x] Tous les requirements (AFF-01..05) ont une vérification automatisée à leur frontière logique/TS OU une entrée Manual-Only justifiée (live-infra)
- [x] Continuité d'échantillonnage : aucun bloc de 3 tâches consécutives sans vérification automatisée
- [x] Wave 0 couvre toutes les références MISSING (aucune — infra préexistante)
- [x] Aucun flag watch-mode (`vitest run` partout)
- [x] Feedback latency < 5 s (sous-ensemble affiliation)
- [x] Suite quick verte : 53 passed / 4 skipped (réseau-gated)
- [ ] `nyquist_compliant: true` — **non** : 5 comportements live-infra restent Manual-Only (réseau/DB/UI). Statut `partial` assumé : automatisé là où automatable, manuel pour le live-infra.

**Approval:** validated PARTIAL 2026-06-18 — couverture automatisée maximale atteinte (53 tests verts), 5 vérifications Manual-Only documentées (intrinsèquement live-infra, non lacunes d'implémentation). Aucune lacune MISSING auto-générable → auditeur non spawné.

---

## Validation Audit 2026-06-18

| Metric | Count |
|--------|-------|
| Requirements | 6 (AFF-01..05 + no-perf) |
| COVERED (automated, green) | 5 frontières logique/TS |
| PARTIAL/Manual-Only (live-infra) | 5 comportements runtime |
| MISSING (auto-générable) | 0 |
| Auditeur spawné | Non (zéro lacune automatable) |
