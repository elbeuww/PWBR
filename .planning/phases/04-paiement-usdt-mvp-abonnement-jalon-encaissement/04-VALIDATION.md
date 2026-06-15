---
phase: 04
slug: paiement-usdt-mvp-abonnement-jalon-encaissement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase = argent réel → correction prouvée obligatoire (nyquist_validation = true).
> `nyquist_compliant: false` tant que Wave 0 (fixtures TronGrid réelles + tests stubs) n'a pas frappé le réseau en direct (RESEARCH §Tertiary ASSUMED).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 `[VERIFIED: package.json]` |
| **Config file** | `vitest.config.ts` (racine) — globs `packages/**/*.test.ts`, `apps/**/__tests__/**`, `apps/web/test/**` |
| **Quick run command** | `pnpm test` (ou `npx vitest run <path>` pour un fichier ciblé) |
| **Full suite command** | `pnpm test` puis `pnpm test:e2e` (Playwright RLS cross-user + parcours paiement testnet) |
| **E2E framework** | Playwright 1.60.0 (auth, parcours paiement testnet Nile, RLS isolation `(admin)`) |
| **Estimated runtime** | unit+integration `pnpm test` ~25 s ; full suite avec `pnpm test:e2e` ~90 s |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <fichier concerné>` (atomic / address / verify — < 5 s de latence).
- **After every plan wave:** `pnpm test` (suite complète unit+integration — ~25 s).
- **Before `/gsd:verify-work`:** `pnpm test` + `pnpm test:e2e` verts + parité i18n (`pnpm lint:i18n` exit 0).
- **Max feedback latency:** 5 s (par-task, fichier ciblé) ; 25 s (par-wave, suite unit+integration).

---

## Per-Task Verification Map

> ❌ W0 = fichier de test absent tant que Wave 0 (Plans 01/04 TDD + apply_migration + fixtures réelles) n'est pas exécuté.
> ✅ = infrastructure existante (P1) couvre déjà.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | PAY-02 | — | montant 9.02→9020000n exact, zéro float | unit (TDD) | `npx vitest run packages/core/src/money/atomic.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | PAY-02 | A4 | base58↔hex golden + checksum corrompu throw | unit (TDD) | `npx vitest run packages/data-sources/src/trongrid/address.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | PAY-01/02 | A1 | fixture TronGrid Nile réelle figée (débloque W2) | manual (réseau) | checkpoint:human-verify (frappe TronGrid Nile) | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 1 | PAY-01 | T-04-SC | QR lib vettée offline/no-telemetry avant install | manual (gate) | checkpoint:human-verify bloquant (npmjs + postinstall) | N/A | ⬜ pending |
| 04-03-02 | 03 | 1 | PAY-01/05/06 | — | 8 blocs shadcn présents, root layout intact | smoke | `ls apps/web/src/components/ui/{table,form,textarea,sonner,tabs,alert,alert-dialog,progress}.tsx` | N/A | ⬜ pending |
| 04-03-03 | 03 | 1 | PAY-01/04/05/06, ADMIN-01/02 | T-04-I18N-LEAK | parité stricte payment fr/en/ar (récursive) | static | `pnpm typecheck && pnpm lint:i18n` | N/A | ⬜ pending |
| 04-02-01 | 02 | 1 | PAY-03/04, ADMIN-01/02 | T-04-REPLAY, T-04-RLS-ELEV, T-04-INCONSIST | UNIQUE(tx_hash) + RPC atomique + revoke execute + RLS pending-only | static (multi-critère) | `node -e "..."` (4 assertions sur 0012, voir 04-02 Task 1 verify) | N/A | ⬜ pending |
| 04-02-02 | 02 | 1 | PAY-03/04 | T-04-INCONSIST | 0012 appliquée LIVE via MCP `apply_migration` (PAS db push) | manual (MCP) | MCP `list_tables` + `get_advisors` après apply | N/A | ⬜ pending |
| 04-02-03 | 02 | 1 | PAY-03/04 | T-04-SVCKEY | repos service_role typés, 23505→'replay', barrel n'exporte pas le service-client | static | `pnpm typecheck` | N/A | ⬜ pending |
| 04-04-01 | 04 | 2 | PAY-02 | A1 | parseur Zod valide la fixture Nile réelle (passthrough) | unit (TDD) | `npx vitest run packages/data-sources/src/trongrid/schema.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-02 | 04 | 2 | PAY-02/04 | T-04-AUTODEC-A | 5 invariants : exact→active, over/under→ambiguous, wrong token/dest/non-confirmé→reject | unit (TDD) | `npx vitest run packages/data-sources/src/trongrid/verify.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-03 | 04 | 2 | PAY-02 | A7 | client fetch+Zod+p-retry (Retry-After), clé en header serveur | unit | `npx vitest run packages/data-sources/src/trongrid/` | ❌ W0 | ⬜ pending |
| 04-05-01 | 05 | 3 | PAY-03/04 | T-04-REPLAY-A, T-04-LEGAL, T-04-AMOUNTSET | tx_hash armé AVANT lecture réseau (anti-TOCTOU), gate legal mainnet, montant serveur | integration | `pnpm test` (replay 23505 + decision tree via verify.test.ts) | ❌ W0 | ⬜ pending |
| 04-05-02 | 05 | 3 | PAY-01/06 | T-04-AMOUNTSET | PlanCard→reservePayment, montant exact affiché `<bdi>`, QR offline | static | `pnpm typecheck && pnpm lint:i18n` | N/A | ⬜ pending |
| 04-05-03 | 05 | 3 | PAY-06 | — | discovery one-shot : 2e refusé, standard seul visible | unit+integration | `npx vitest run "apps/web/src/app/[locale]/(member)/abonnement/__tests__/discovery.test.ts"` | ❌ W0 | ⬜ pending |
| 04-06-01 | 06 | 3 | PAY-05 | — | job active→expired idempotent (re-run = 0 ligne 2e fois) | integration | `npx vitest run apps/jobs/src/jobs/__tests__/subscription-expiry.test.ts` | ❌ W0 | ⬜ pending |
| 04-06-02 | 06 | 3 | PAY-05 | — | coupe nette : non-abonné expiré → 0 signal (RLS) | integration | `npx vitest run apps/web/test/gating-rls.test.ts` (étend P1) | ✅ base existe | ⬜ pending |
| 04-06-03 | 06 | 3 | ADMIN-01/02 | T-04-RLS-ELEV | superadmin lit membres+file ; non-superadmin → 404 ; écritures service_role | e2e | `pnpm test:e2e` (Playwright `(admin)` cross-role) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Wave 0 = toutes les briques de test/fixtures qui doivent exister AVANT que le code aval (parseur, vérif, server action) ne soit prouvé. Réseau bloqué pendant la recherche → valeurs on-chain ASSUMED jusqu'à frappe réelle.

- [ ] `packages/core/src/money/atomic.ts` + `.test.ts` — PAY-02 (zéro-float, golden 9.02→9020000n)
- [ ] `packages/data-sources/src/trongrid/address.ts` + `.test.ts` — golden hex↔base58 + checksum corrompu throw (A4)
- [ ] **Fixtures TronGrid réelles** (Nile testnet) figées dans `__fixtures__/nile-trc20-transfer.json` + `GOLDEN.md` — **checkpoint:human-verify réseau requis (A1-A7)** ; débloque schema/verify
- [ ] `packages/data-sources/src/trongrid/schema.ts` + `schema.test.ts` (Zod figé sur fixture réelle)
- [ ] `packages/data-sources/src/trongrid/verify.ts` + `verify.test.ts` (5 invariants + decision tree over/under)
- [ ] migration `0012_payments.sql` (table + RLS + UNIQUE + offset + RPC) **appliquée via MCP `apply_migration`** + `database.types.ts` régénéré + barrel ré-exporte `payments`/repos
- [ ] `apps/jobs/src/jobs/__tests__/subscription-expiry.test.ts` (idempotence re-run)
- [ ] `apps/web/src/app/[locale]/(member)/abonnement/__tests__/discovery.test.ts` (one-shot)
- [ ] `apps/web/src/messages/payment` namespace fr/en/ar parité stricte (CI `check-i18n-hardcoded`)
- [ ] QR lib vettée (slopcheck + offline + postinstall) — checkpoint:human-verify

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fixture TronGrid Nile réelle figée | PAY-01/02 (A1-A7) | Réseau bloqué en recherche ; forme JSON réelle (champs `from/to/value/token_info`, base58 vs hex, header clé, seuil confirmations) non vérifiable hors réseau | Frapper `GET /v1/accounts/{addr}/transactions/trc20` sur Nile avec une vraie TX USDT-test ; figer la réponse en `__fixtures__/` + golden values (04-01 Task 3, checkpoint:human-verify) |
| Migration 0012 appliquée live | PAY-03/04 | Convention repo : migrations via MCP `apply_migration`, JAMAIS `supabase db push` ; le projet n'est pas `link`é → build/typecheck passe sans application (faux-positif) | MCP `apply_migration` (name `0012_payments`) + `list_tables` (payments + UNIQUE + RPC) + `get_advisors` security (WARN security-definer EXPECTED) (04-02 Task 2, [BLOCKING]) |
| Gate légal mainnet avant 1er encaissement réel | LEGAL-02 | Sign-off juriste = action humaine hors code ; bloque la prod, pas le dev (testnet libre) | `isLegalReviewDone()` doit renvoyer true (flag de revue juridique) AVANT toute activation réelle quand `TRON_NETWORK=mainnet` ; testnet Nile non concerné (04-05 Task 1) |
| QR lib legitimité | PAY-01 | Nouveau paquet npm entrant dans le bundle client d'une phase argent ; slopcheck non exécuté (réseau) ; non auto-approuvable | npmjs.com (âge/downloads/repo/postinstall) + confirmer rendu 100% offline encode l'adresse seule (04-03 Task 1, checkpoint:human-verify bloquant) |
| Parcours paiement testnet bout-en-bout | PAY-01..04 | Flux interactif on-chain réel (adresse→hash→polling→actif) | À la verification de phase : parcours Nile complet (PaymentPanel adresse/QR/montant → HashForm → VerificationPolling → abonnement actif) (04-05 verification) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (manual-only documentées ci-dessus)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (04-03 résolu via `pnpm typecheck && pnpm lint:i18n` en Task 3)
- [ ] Wave 0 covers all MISSING (❌ W0) references
- [ ] No watch-mode flags (toutes commandes en `run`, jamais `--watch`)
- [ ] Feedback latency < 5 s (par-task) / 25 s (par-wave)
- [ ] `nyquist_compliant: true` set in frontmatter (UNIQUEMENT après Wave 0 réellement exécuté : fixtures Nile + stubs verts)

**Approval:** pending — `nyquist_compliant` reste `false` jusqu'à exécution Wave 0.
