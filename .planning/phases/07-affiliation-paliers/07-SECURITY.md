---
phase: 07
slug: affiliation-paliers
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-18
---

# Phase 07 — Security : Affiliation à paliers (MERA)

> Contrat de sécurité par phase : frontières de confiance, registre de menaces, risques acceptés, traçabilité d'audit.

**Audit type:** Mitigation verification (registre plan-time, pas de scan de nouvelles menaces — `register_authored_at_plan_time: true`)
**ASVS Level:** L1 | **block_on:** high
**Result:** SECURED — 18/18 menaces CLOSED (17 mitigate + 1 accept)
**threats_open:** 0

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| visiteur → middleware (`?ref`) | input URL non fiable, validé regex avant pose du cookie | code d'affiliation (public) |
| client → cookie `aff_ref` | cookie httpOnly non lisible/forgeable depuis JS | code d'affiliation (last-touch 30j) |
| candidat → server action | input formulaire non fiable, validé zod serveur | candidature (email, motivation) |
| signUp / job → DB | écriture via service_role (bypass RLS) — `server-only` | referrals, commissions, payouts |
| affilié authentifié → DB | lecture dashboard via vue `security_invoker`, isolation `auth.uid()` | agrégats no-PII (revenu cumul/mois) |
| superadmin → server action | endpoint POST appelable directement, `requireRole` re-validé en tête | promotion, code, payout (tx_hash) |
| lien tx_hash → explorer | navigation externe (reverse-tabnabbing) | hash de transaction (public) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (evidence file:line) | Status |
|-----------|----------|-----------|-------------|---------------------------------|--------|
| T-07-SELFREF | Tampering/Fraud | compute + attributeReferral | mitigate | `0016_affiliation.sql:289` `and r.user_id <> a.user_id` (exclusion au calcul, inviolable) + `affiliates.ts:74` repo skip self-ref | closed |
| T-07-DOUBLEPAY | Tampering | commissions upsert / mark_paid / job | mitigate | `0016:184` `unique index commissions_aff_ref_period_idx` + `:308-312` `on conflict do update where status='due'` + `:345-353` `mark_commission_paid` raise si `row_count=0` ; job/repo appellent le RPC seulement | closed |
| T-07-PII | Information Disclosure | vue affiliate_dashboard + dashboard | mitigate | `0016:372` `create view ... with (security_invoker = true)` ; agrégats seuls (revenu cumul/mois), zéro user_id filleul ; `dashboard/page.tsx:66` lecture auth-client jamais service_role | closed |
| T-07-RLS-ISO | Info Disclosure/Elevation | RLS 6 tables | mitigate | `0016:66-227` `enable row level security` + SELECT scopé `auth.uid()` / `is_superadmin()` ; ZÉRO policy write (write = service_role bypass) | closed |
| T-07-EXPIRED | Tampering/Fraud | compute (join subscriptions) | mitigate | `0016:303-306` join `s.status='active' and s.current_period_end > now()` (AFF-05) | closed |
| T-07-FLOAT | Tampering | computeCommissionAtomic / commissions.ts | mitigate | `tiers.ts:89-91` BigInt-only `(baseAtomic * BigInt(rateBps)) / 10000n` ; `amount_atomic` typé `string`, RPC-only, aucun Number JS | closed |
| T-07-DRIFT | Tampering | TIERS vs affiliate_rate_bps SQL | mitigate | `tiers.ts:38-75` table bit-miroir du SQL `0016:236-253` ; golden test `tiers.test.ts:31-46` verrouille les bornes | closed |
| T-07-ATTR-CRASH | Denial of Service | attributeReferral / signUp | mitigate | `(auth)/actions.ts:60-71` try/catch, erreur loggée non propagée ; code inconnu/self-ref → no-op ; signup aboutit toujours | closed |
| T-07-TZ | Tampering | affiliate-commission period | mitigate | `affiliate-commission.ts:23,60` `DateTime.utc().toFormat('yyyy-MM')` (luxon), jamais `new Date()` ; M-04 regex période `:58` | closed |
| T-07-REFINJ | Tampering/Injection | captureRef (middleware) | mitigate | `captureRef.ts:22,32` `/^[A-Z0-9]{3,20}$/` AVANT `cookies.set`, jamais concaténé ; DB belt `0016:86` `check (code ~ ...)` | closed |
| T-07-COOKIE | Tampering | cookie aff_ref | mitigate | `captureRef.ts:38-40` `httpOnly + secure + sameSite='lax'` ; code forgé → no-op à la résolution DB | closed |
| T-07-RLS-WRITE | Elevation | écriture referrals | mitigate | aucune policy write (`0016:158`) ; écriture via `createAdminServiceClient()` dans repos `server-only` | closed |
| T-07-ADMIN-WRITE | Elevation | actions admin back-office | mitigate | `requireRole('superadmin')` en tête de CHAQUE action (`affiliation/actions.ts:38`, `payouts/actions.ts:30`) ; 404 non-superadmin | closed |
| T-07-CODETAKEN | Tampering | createCode | mitigate | `affiliates.ts:133-148` `.insert` + capture `23505 → CodeTakenError` → i18n `code_taken` ; PK sur `code` empêche l'écrasement | closed |
| T-07-EXTLINK | Tabnabbing | lien explorer tx_hash | mitigate | `payouts/page.tsx:113-115` `target="_blank" rel="noopener noreferrer"` | closed |
| T-07-DESTRUCT | Tampering | rejectApplication | mitigate | `ApplicationRowActions.tsx:139` AlertDialog + `<Textarea required>` ; re-check serveur `actions.ts:120` motif requis | closed |
| T-07-APP-INPUT | Tampering/Injection | submitApplication | mitigate | `[locale]/affiliation/actions.ts:34-46` zod `safeParse` serveur ; `:70-78` PostgREST paramétré, jamais concaténé | closed |
| T-07-NOPERF | Compliance/Legal | copy affiliate i18n | mitigate | `messages-parity-affiliate.test.ts:77-84` garde no-perf (FORBIDDEN regex fr/en/ar) ; `<Disclaimer/>` rendu | closed |
| T-07-SC | Tampering | npm installs | **accept** | `git diff 1686543~1 e0397ab -- '*package.json'` VIDE sur toute la Phase 7 → zéro dép. ajoutée. Voir Accepted Risks. | closed |

*Status: open · closed · Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## MEDIUM fixes (security-review commit `0969c98`) — confirmés présents

| Fix | Threat link | Evidence |
|-----|-------------|----------|
| M-01 transition `.eq('status','pending')` guard | T-07-ADMIN-WRITE | `affiliation/actions.ts:85` (re-process impossible) |
| M-02 email lu depuis la ligne DB (pas formData) | T-07-ADMIN-WRITE | `actions.ts:81-89` select `applicant_email` par `application_id` |
| M-03 tx_hash hex borné | payout / T-07-DOUBLEPAY | `payouts/actions.ts:26,39` `/^[A-Fa-f0-9]{64}$/` avant RPC |
| M-04 période regex avant RPC | T-07-TZ | `commissions.ts:28,35` + `affiliate-commission.ts:58` |
| M-05 clés d'erreur opaques | Info Disclosure | `toSafeErrorKey` / `fail()` — clé générique, détail loggé serveur |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-07-01 | T-07-SC | Phase 7 n'ajoute AUCUNE dépendance npm (`git diff 1686543~1 e0397ab -- '*package.json'` vide sur les 22 commits). Aucune nouvelle surface supply-chain ; stack verrouillée (CLAUDE.md) inchangée. Aucune mitigation requise. | Borhane (fondateur) | 2026-06-18 |

---

## Deferred (LOW — `deferred-items.md`, NON bloquants à L1)

- **L-01** cookie `aff_ref` supprimé même si l'attribution échoue (race last-touch) — `(auth)/actions.ts:73`.
- **L-02** pas de `UNIQUE(tx_hash)` sur `payouts` (anti-double-pay par-commission seulement) — `0016_affiliation.sql`.
- **L-03** pas d'invalidation de session sur rétrogradation de rôle (`requireRole` lit le rôle live) — `lib/auth/gate.ts`.
- **L-04** `submitApplication` non rate-limité + pas de `UNIQUE(applicant_email)` — `[locale]/affiliation/actions.ts`.

Aucun ne contredit une disposition `mitigate` déclarée. Durcissement v1 jugé acceptable.

---

## Human-Verify Items (evidence-of-intent, PAS des gaps)

Tests gated réseau/credentials (skipIf `.env.test`) — intention encodée, statique déjà CLOSED ci-dessus :

1. **RLS cross-user** — `affiliate-rls.test.ts` (`:31` skipIf `HAS_ENV`). Asserte T-07-RLS-ISO au runtime. **À lancer sur staging avant exposition multi-tenant.**
2. **E2E attribution** (`?ref` → cookie → signup → referral) — Playwright env-gated. Confirme T-07-REFINJ + T-07-ATTR-CRASH bout-en-bout.

---

## ASVS L1 Mapping

| Contrôle ASVS L1 | Menaces couvertes | Statut |
|------------------|-------------------|--------|
| V1.2 Access control entry-point authentifié | T-07-ADMIN-WRITE, T-07-RLS-WRITE | requireRole re-validé / RLS write = service_role |
| V4.1 Access control object-level | T-07-RLS-ISO, T-07-PII | RLS `auth.uid()`/`is_superadmin` ; vue security_invoker ; no-PII |
| V5.1 Input validation | T-07-REFINJ, T-07-APP-INPUT, T-07-TZ, M-03/M-04 | regex/zod à chaque frontière avant DB |
| V5.3 Output encoding / injection | T-07-APP-INPUT | PostgREST paramétré, zéro concaténation |
| V7.4 Error handling (no leakage) | M-05 | clés i18n opaques, détail loggé serveur |
| V3.4 Cookie security attributes | T-07-COOKIE | httpOnly + secure + sameSite=lax |
| V13.x liens externes | T-07-EXTLINK | rel="noopener noreferrer" |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-18 | 18 | 18 | 0 | gsd-security-auditor (Opus) + orchestrateur |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-18 — SECURED. 18/18 menaces résolues (17 mitigate CLOSED + 1 accept loggé). 0 OPEN, 0 flag non enregistré, block_on=high → aucun blocker. Phase 07 peut shipper.
