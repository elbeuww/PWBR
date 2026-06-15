---
phase: 04-paiement-usdt-mvp-abonnement-jalon-encaissement
verified: 2026-06-15T17:05:00Z
status: human_needed
score: 8/8 requirements code-verified (5/5 roadmap success criteria code-present)
overrides_applied: 0
human_verification:
  - test: "Round-trip Nile testnet réel — payer le montant unique exact à USDT_RECEIVE_ADDRESS, coller le hash CONFIRMÉ, vérifier passage verified + abonnement actif."
    expected: "verifyPayment → { ok:true, verified } ; payments.status=verified, verified_at posé ; subscriptions.status=active, current_period_end = now()+période ; accès /signaux ouvert immédiatement (polling D-02)."
    why_human: "Exige un transfert on-chain réel + indexation TronGrid + Realtime/polling live. Non simulable en unit. (Le hash doit être DÉJÀ confirmé — voir gap différé cluster re-soumission.)"
  - test: "Replay réel — re-soumettre le MÊME hash confirmé sur une 2e réservation."
    expected: "23505 sur UNIQUE(tx_hash) global → code:'replay' SANS aucun appel TronGrid (arm avant lecture réseau). Aucune 2e activation."
    why_human: "L'invariant anti-replay/anti-TOCTOU est testé en unit (verify-arm.test.ts) mais l'ordre arm→23505→court-circuit doit être confirmé contre la vraie contrainte DB live."
  - test: "Cas ambigu réel (sur/sous-paiement) — envoyer un montant ≠ attendu, vérifier file superadmin."
    expected: "status=ambiguous, apparait dans (admin)/file ; superadmin Activer/Rejeter+motif/Ajuster fonctionne (service_role), payment transitionne, abonnement activé/rejeté."
    why_human: "Transfert on-chain hors-montant + actions admin réelles en session superadmin. RLS/404 non-superadmin sur (admin) à confirmer runtime."
  - test: "Back-office membres (ADMIN-01) en session superadmin réelle."
    expected: "Liste membres (email/statut/plan/expiration/dernier paiement), filtres statut + recherche email, actions activer/prolonger/révoquer/changer-plan ; 404 pour non-superadmin."
    why_human: "Lecture admin via service_role local (profiles sans policy RLS superadmin) — la barrière est requireRole. À confirmer secure-phase + runtime que non-superadmin reçoit bien 404."
  - test: "Expiration auto — exécuter le job subscription-expiry sur un abonnement échu, puis vérifier perte d'accès."
    expected: "active→expired ; has_active_subscription() = false ; redirection /tarifs ; sweep réservations expirées pending→rejected. job_runs tracé."
    why_human: "Exige une exécution job réelle contre la DB live + vérification de la coupe d'accès via RLS (runtime)."
  - test: "Information utilisateur avant expiration (PAY-05) — afficher le bandeau J-3/J-1."
    expected: "L'utilisateur abonné voit un rappel in-app à J-3/J-2/J-1 avec CTA Renouveler."
    why_human: "GAP DE CÂBLAGE : ExpiryBanner existe mais n'est rendu NULLE PART (voir gap WIRING-01). À ce jour l'utilisateur n'est PAS informé in-app. Décision humaine requise : câbler avant prod ou accepter le report."
gaps_deferred:
  - id: "cluster re-soumission (N-1 / WR-02 / WR-04)"
    truth: "Une tx soumise AVANT indexation TronGrid (tx_not_found) ne peut jamais être re-validée via l'UI (le hash reste armé sur la ligne rejected → re-soumission = replay)."
    status: known_deferred
    decision: "Différé — migration 0013 (tx_hash nullable, libération du hash sur tx_not_found, réemploi réservation). Documenté dans 04-DEFERRED-resubmission-cluster.md. NON bloquant pour un UAT contrôlé avec hash DÉJÀ confirmé ; BLOQUANT avant ouverture communauté/prod."
  - id: "WR-06"
    truth: "changePlan(period) ignore silencieusement la période (contredit D-11 prolongation admin)."
    status: known_deferred
    decision: "Succès partiel silencieux sur mutation d'accès — à prioriser dans le plan de clôture des warnings (cf. 04-DEFERRED §WR-06)."
  - id: "WR-01 / WR-03 / WR-05 / IN-01..04"
    truth: "Warnings revue non bloquants (discovery one-shot TOCTOU app-level seulement ; fuite error.message admin ; not_confirmed repose sur only_confirmed=true seul ; unique(user_id) subscriptions à confirmer ; parseFloat display-only ; getTransferByHash mort ; type==='Transfer' non asserté)."
    status: known_deferred
    decision: "Documentés dans 04-REVIEW.md + 04-DEFERRED. À traiter dans le plan warnings/secure-phase."
---

# Phase 4: Paiement USDT MVP & abonnement — JALON ENCAISSEMENT — Verification Report

**Phase Goal:** Encaisser un premier abonnement de façon sûre et automatique en USDT TRC-20, et faire vivre l'abonnement (activation, expiration). Densité de risque maximale (tout l'argent).
**Verified:** 2026-06-15
**Status:** human_needed
**Re-verification:** No — initial goal-backward verification (post-REVIEW, 2 Critical FIXED).

## Goal Achievement

### Core money-path goal verdict — CODE VERIFIED (runtime → HUMAN_NEEDED)

The money path is implemented correctly and the two critical defects are fixed on `master`:

- **Arm-before-network-read (anti-TOCTOU)** — `verifyPayment` (actions.ts:204-333) writes `tx_hash` to the pending row via UPDATE **before** any TronGrid call. CR-01 fix present: the arm UPDATE uses `.select('id')` and `if (!armed || armed.length === 0) return code:'expired'` (l.247-272) — a 0-row match is now an authoritative hard-stop, no silent continue. 23505 short-circuits to `replay` (l.255-258) with `fetchTrc20TransfersForReceiver` never called (proven by `verify-arm.test.ts`).
- **Global anti-replay** — `UNIQUE(tx_hash)` GLOBAL index `payments_tx_hash_global_idx` (0012:63-64) is the inviolable net; same hash never credits two accounts.
- **5 conjoint invariants** — `verifyTransfer` (verify.ts:50-77): (1) token identity by **contract address only** (no symbol/decimals) → `wrong_token`; (2) recipient normalized hex↔base58 → `wrong_recipient`; (3) confirmation (`confirmed===false` → `not_confirmed`, + client `only_confirmed=true`); (4) amount strict BigInt `===`, zero float → exact/over/under; over/under → `ambiguous` (never auto-activate/reject).
- **BigInt zero-float (CR-02 fix)** — `database.types.ts` now types `expected_amount_atomic: string` / `amount_atomic: string|null` (l.313-343); repos write `.toString()` (payments.ts:106,153,246), read via `BigInt()`. No `Number()` on atomic amounts anywhere on the path.
- **Exactly-once activation** — RPC `activate_subscription_for_payment` (0012:120-165) updates payment→verified `WHERE status='pending'` (idempotent, raises on 0-row) AND upserts subscription→active in ONE transaction; `revoke execute` from public/anon/authenticated.

**Verdict:** code present + correct + tested. Live on-chain confirmation (real Nile round-trip, replay, ambiguous, expiry, admin) is the only remaining unknown → routed to HUMAN_NEEDED.

### Requirement Verdicts

| Req | Verdict | Evidence |
| --- | ------- | -------- |
| **PAY-01** Adresse USDT TRC-20 + montant exact dû | VERIFIED (runtime UI → HUMAN) | `PaymentPanel.tsx`: réseau « TRC-20 (TRON) » en grand (l.78), QR maison de l'adresse publique (l.83), adresse + copie 1-tap (l.88-101), montant unique + copie primaire mobile (l.104-120). Montant posé serveur via `reserveOffset` (D-05), jamais client. `page.tsx` fournit `USDT_RECEIVE_ADDRESS` (env). |
| **PAY-02** Soumission hash + vérif on-chain TronGrid | VERIFIED (live → HUMAN) | `HashForm` → `verifyPayment` ; `fetchTrc20TransfersForReceiver` (client.ts:41-95, clé en header `TRON-PRO-API-KEY`, `only_confirmed=true`, p-retry/Retry-After) ; `verifyTransfer` 5 invariants ; fixture Nile réelle figée + trongrid tests. Screenshot optionnel (D-03). |
| **PAY-03** Paiement valide → activation auto (période + expiration) | VERIFIED (live → HUMAN) | `result.kind==='exact'` → `activateForPayment` → RPC atomique pose `current_period_end = greatest(coalesce(end,now()),now()) + period` ; aucune intervention manuelle. |
| **PAY-04** Replay/mauvais montant-token-destinataire/non-confirmé rejetés + tracés ; ambigus → file superadmin | VERIFIED (live → HUMAN) | Replay = `UNIQUE(tx_hash)` global + arm-first ; wrong_token/recipient/not_confirmed via `verifyTransfer` → `transitionPayment('rejected', reject_reason)` ; over/under → `ambiguous` (D-06/D-07) visibles dans `(admin)/file`. ⚠️ Limite connue : tx_not_found pré-indexation (cluster différé). |
| **PAY-05** Expiration auto + utilisateur informé + perte d'accès | PARTIAL — GAP de câblage | Expiration: `subscription-expiry.ts` + `expireDue` (active→expired WHERE period_end<=now()) idempotent + sweep réservations. Perte d'accès: `has_active_subscription()` (coupe nette D-10). **« Utilisateur informé » NON satisfait**: `ExpiryBanner.tsx` existe et est correct mais n'est **rendu nulle part** (orphelin — voir WIRING-01). |
| **PAY-06** Découverte 3$/7j one-shot puis bascule standard | VERIFIED (logique) | `canConsumeDiscovery` (discovery.ts:22-26) testé ; appliqué dans `reservePayment` + `getDiscoveryAvailability` ; pricing D-12. ⚠️ WR-01 : enforcement seulement app-level (TOCTOU concurrent), pas d'index DB unique partiel — pricing-abuse, non double-crédit (différé). |
| **ADMIN-01** Superadmin voit les membres (état abo/paiement) | VERIFIED (runtime → HUMAN) | `(admin)/membres/page.tsx`: colonnes email/statut/plan/expiration/dernier paiement (D-14), filtres statut + recherche email, `MemberRowActions` (activer/prolonger/révoquer/changer-plan, D-13). Lecture service_role local ; layout (admin) `requireRole('superadmin')` → 404. |
| **ADMIN-02** Superadmin traite la file ambiguë (activer/rejeter) | VERIFIED (runtime → HUMAN) | `(admin)/file/page.tsx` liste les `ambiguous` (attendu/reçu, hash TronScan, capture) ; `file/actions.ts`: activatePayment / rejectPayment (motif requis D-08) / adjustPayment ; re-guard `requireRole` par action + service_role local. |

**Score:** 8/8 requirements code-verified ; 5/5 roadmap success criteria code-present. PAY-05 partiellement satisfait (expiration OK, information utilisateur = gap de câblage).

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `supabase/migrations/0012_payments.sql` | VERIFIED | Table payments + RLS producteur-unique + UNIQUE(tx_hash) global + index offset partiel + RPC atomique. Appliquée LIVE via MCP. |
| `packages/data-sources/src/trongrid/{verify,client,schema,address}.ts` | VERIFIED | 5 invariants, only_confirmed=true, clé header, fixture Nile réelle. |
| `packages/supabase/src/repositories/{payments,subscriptions}.ts` | VERIFIED | `.toString()` atomic (CR-02), reserveOffset, transitionPayment, activateForPayment, expireDue, releaseExpiredReservations. |
| `apps/web/.../(account)/abonnement/{actions,discovery,PaymentPanel,page}.tsx` | VERIFIED | Arm-first (CR-01), gate légal, discovery one-shot, UI PAY-01. |
| `apps/jobs/.../subscription-expiry.ts` | VERIFIED | expireDue + sweep, idempotent, test {expired,released}. |
| `apps/web/.../(admin)/{membres,file}/{page,actions}.tsx` | VERIFIED | ADMIN-01/02 vue + actions service_role + re-guard. |
| `apps/web/src/components/member/ExpiryBanner.tsx` | ⚠️ ORPHANED | Composant correct mais **importé/rendu nulle part** → PAY-05 « informé » non livré au runtime. |
| `apps/web/src/lib/legal-gate.ts` | VERIFIED | Consommé par verifyPayment (mainnet && !done → legal_gate). |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| verifyPayment | UNIQUE(tx_hash) | arm UPDATE `.select('id')` AVANT lecture réseau | WIRED (CR-01) |
| verifyPayment | TronGrid | fetchTrc20TransfersForReceiver + verifyTransfer | WIRED |
| verifyTransfer exact | subscriptions | activateForPayment → RPC atomique | WIRED |
| reservePayment | montant unique | reserveOffset (service_role, D-05) | WIRED |
| (admin)/file | transitions | file/actions service_role + requireRole | WIRED |
| subscription-expiry | active→expired | expireDue + RLS has_active_subscription() | WIRED |
| **ExpiryBanner** | **member surface** | **render in (member) layout/page** | **NOT_WIRED (WIRING-01)** |
| verifyPayment | legal gate | isLegalReviewDone() mainnet | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full suite green | `pnpm test` | **359 passed (47 files)** | PASS |
| CR-01 arm 0-row hard-stop + replay no-network | verify-arm.test.ts | 2/2 pass | PASS |
| ExpiryBanner rendered somewhere | `grep -rln ExpiryBanner apps/web/src` (excl. self) | aucune occurrence | FAIL → WIRING-01 |
| Atomic columns typed string (CR-02) | grep database.types.ts | `string` / `string \| null` | PASS |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
| ---- | ------- | -------- | ------ |
| ExpiryBanner.tsx | artefact orphelin (non rendu) | WARNING | PAY-05 « utilisateur informé » non livré (WIRING-01). |
| subscriptions.ts:79-86 | changePlan ignore `period` | WARNING | WR-06 — succès partiel silencieux (différé). |
| PaymentPanel.tsx:46 | `Number.parseFloat` display-only | INFO | IN-02 — montant copié = chaîne canonique, float jamais resoumis. OK. |
| actions admin (membres/file) | `error.message` brut | WARNING | WR-03 — fuite gated superadmin (différé). |

Aucun marqueur de dette `TBD/FIXME/XXX` non référencé sur le chemin argent. Les `LIMITE CONNUE` commentées (actions.ts:265-269) renvoient au suivi dédié `04-DEFERRED-resubmission-cluster.md`.

### Gaps Summary

Le cœur monétaire (réception → soumission → vérif on-chain sûre → activation exactly-once) est implémenté, testé, et les 2 Critical de la revue sont fixés et présents sur `master` (CR-01 arm-first hard-stop, CR-02 string typing zéro-float). 359/359 tests verts.

Un **gap de câblage actionnable (WIRING-01)** subsiste : `ExpiryBanner` existe mais n'est rendu nulle part → la clause PAY-05 « l'utilisateur est informé » avant expiration n'est pas livrée au runtime (l'expiration auto + la perte d'accès, elles, fonctionnent). C'est le seul écart entre le code et un critère de succès. Décision humaine demandée : câbler le bandeau dans la surface membre avant prod, ou acter son report (le reste de PAY-05 est satisfait).

Les **gaps connus/différés** (cluster re-soumission via migration 0013 ; WR-06 changePlan(period) ; WR-01/03/05 ; IN-01..04) sont documentés et ne bloquent PAS un UAT testnet contrôlé avec un hash DÉJÀ confirmé. Ils bloquent l'ouverture communauté/prod.

**Statut global : human_needed** — le code délivre la capacité promise ; il faut un round-trip Nile testnet réel (paiement / replay / ambigu / expiry / admin superadmin) pour confirmer le comportement live, et une décision sur WIRING-01.

---

_Verified: 2026-06-15_
_Verifier: Claude (gsd-verifier)_
