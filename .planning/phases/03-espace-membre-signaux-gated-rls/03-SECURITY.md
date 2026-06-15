---
phase: 03
slug: espace-membre-signaux-gated-rls
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-15
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (3 PLAN `<threat_model>` blocks) → audit verified mitigations exist in code. block_on: high.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser ↔ Supabase (anon) | Front lit `trade_setups`/`candles` via client anon (session cookie), RLS = seule barrière | Setups scorés + OHLCV (produit payant) |
| Realtime (postgres_changes) | Canal browser portant la session user | Events INSERT/UPDATE `trade_setups` (filtrés RLS) |
| URL searchParams → requête DB | Filtres/tri fournis par l'utilisateur | Paramètres non fiables (style/risk/asset/sort) |
| Producteur (service_role, jobs) ↔ Front | service_role réservé aux jobs ; interdit dans `apps/web` (fixture lint bloquante) | Écritures setups/candles |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-RLS | Info Disclosure (paid-gate) | liste + détail | mitigate | Lecture anon-client + RLS `has_active_subscription()` ; non-abonné = 0 ligne (`queries.ts:105-108`, E2E `signals-rls.spec.ts:67-74`) | closed |
| T-03-01 | Info Disclosure (Realtime/RLS) | migration 0011 | mitigate | `replica identity full` + ajout publication idempotent ; RLS non contournée (`0011...sql:37,44-55`) | closed |
| T-03-02 | Info Disclosure (candles RLS) | migration 0011 | mitigate (ALIGN) | Policy candles recréée `using(has_active_subscription())` (`0011...sql:62-66`) | closed |
| T-03-RT | Info Disclosure (Realtime session) | SignalList | mitigate | Browser client (session), `postgres_changes` filtré RLS, jamais service_role (`SignalList.tsx:26,44,74-98`) | closed |
| T-03-05 | Tampering (input injection) | searchParams/queries | mitigate | Whitelist Zod `safeParse` puis `.eq/.in` paramétrés, zéro concat (`searchParams.ts:16-48`, `queries.ts:112-114`) | closed |
| T-03-SC | Tampering (supply chain) | package.json | mitigate | Versions pinnées légitimes (lightweight-charts 5.2.0 TradingView, react-query 5.101.0) ; recharts absent | closed |
| T-03-IDOR | Info Disclosure (/signaux/[id]) | route détail | mitigate | `.eq('id').eq('status','active').maybeSingle()` + payload Zod → `notFound()` (`[id]/page.tsx:103-121`) | closed |
| T-03-XSS | Tampering (contenu IA) | SignalDetail | mitigate | Contenu IA rendu VERBATIM en enfants texte React (échappé), 0 `dangerouslySetInnerHTML` ; test XSS multi-vecteurs (`SignalDetail.tsx`, `SignalDetail.test.tsx:84-104`) | closed |
| T-03-LEG | Compliance (disclaimer) | bandeau | mitigate | Bandeau non-dismissible `role="note"` sur liste + détail (`SignalsDisclaimerBanner.tsx:14-21`) | closed |

*Status: open · closed*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| IN-02 | T-03-05 | Champ Zod `asset` sans `.max()` — valeur paramétrée (`.eq('symbol',...)`, pas d'injection SQL). Durcissement suggéré, sous le seuil `block_on: high`. | gsd-security-auditor | 2026-06-15 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-15 | 9 | 9 | 0 | gsd-security-auditor (opus, ASVS L1, block_on high) |

---

## Human-Verify (hors menaces ouvertes)

- `signals-rls.spec.ts` prouve la barrière RLS mais `test.skip` sans env live (Supabase + `next dev` + migrations 0009/0010/0011). Code + test = preuve de mitigation ; le run GREEN live est un item human-verify (voir `03-HUMAN-UAT.md` #9).
- E2E Playwright `signal-detail` / realtime = items Wave 0 live-run, pas des menaces ouvertes.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-15
