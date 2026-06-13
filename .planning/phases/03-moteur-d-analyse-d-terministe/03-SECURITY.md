---
phase: 3
slug: moteur-d-analyse-d-terministe
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-13
---

# Phase 3 — Security : Moteur d'analyse déterministe

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Premier audit sécurité du projet. Registre construit à partir des blocs
> `<threat_model>` des 4 plans (mode : `register_authored_at_plan_time: true` →
> vérification des mitigations seulement, pas de scan de nouvelles menaces).
> Fichiers d'implémentation lus en read-only ; jamais patchés.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| jobs (service_role) → Postgres | Moteurs écrivent les snapshots via service_role (bypass RLS) | snapshots/asset_drivers (interne) |
| apps/web (anon/authenticated) → Postgres | Lecture seule des snapshots/asset_drivers, jamais d'écriture | données d'analyse (lecture) |
| candles/news/macro/calendar DB (trusted) → engines | Données Phase 2 ; revalidation §3 à la frontière (Zod avant persist) | OHLCV / news / macro (validées) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-01 | Elevation of Privilege | table snapshots | mitigate | `0005_snapshots.sql:31` RLS on ; `:33-37` policy select-only `to authenticated` ; `:39` AUCUNE write policy → service_role bypass (D-05) | closed |
| T-03-02 | Elevation of Privilege | table asset_drivers | mitigate | `0005_snapshots.sql:66` RLS on ; `:68-72` policy select-only ; `:74` AUCUNE write policy (D-05) | closed |
| T-03-03 | Information disclosure | service_role via barrel | mitigate | `index.ts` exporte uniquement clients anon + repos + types ; service-client non ré-exporté (`:5-9`, D-07). `serviceClient` vit à `service-client.ts:19`, importable par chemin exact seulement | closed |
| T-03-04 | Tampering (content_hash forgeable) | content_hash | **accept** | sha256 d'un payload canonique non-secret (`hash.ts:44-46`). PAS un contrôle d'accès : `getSnapshotByHash` (`snapshots.ts:41-56`) = lookup par contenu ; zéro usage `apps/web`. Idempotence/intégrité seulement (D-41). Voir Accepted Risks | closed |
| T-03-05 | Tampering (hash non déterministe) | canonical JSON | mitigate | `hash.ts:18-37` : clés triées récursivement (`:30`), décimales fixes `HASH_DECIMALS=6` via `toFixed` (`:13,:22`), non-finite→null (`:21`) ; golden-testé | closed |
| T-03-06 | Integrity (tick-volume FX présenté comme vrai) | POC volume | mitigate | `volume.ts:31,60` `volume_source` obligatoire ; enum `['real','proxy']` (`schema.ts:19`) ; engine tague par broker (`technical-engine.ts:147,202-204`). D-35 | closed |
| T-03-07 | Cryptography (hash hand-rollé) | hash | mitigate | `hash.ts:10` `import { createHash } from 'node:crypto'` ; `:46` `createHash('sha256')`. Pas de hash maison | closed |
| T-03-08 | Input Validation (dérive de forme snapshot) | Zod §3 | mitigate | Schémas Zod §3 dans `packages/indicators/src/snapshots/schema.ts` ; `.parse` avant chaque upsert (cf. T-03-10/14) | closed |
| T-03-09 | Information disclosure (service_role en web/NEXT_PUBLIC_) | secret env | mitigate | service_role lu uniquement via `process.env` dans les jobs. `service-client.ts:4` `import 'server-only'` (barrière build) + ESLint `no-restricted-imports` (`eslint.config.mjs:29-36`). Aucune exposition NEXT_PUBLIC_ | closed |
| T-03-10 | Input validation (dérive technical) | parse avant persist | mitigate | `technical-engine.ts:245` `TechnicalSnapshotSchema.parse` AVANT `upsertSnapshot` `:260` | closed |
| T-03-11 | Information disclosure (secret dans job_runs.stats) | stats | mitigate | `technical-engine.ts:268-271` stats.errors = `err.message` / symbole normalisé only ; jamais de valeur de clé (T-02-13) | closed |
| T-03-12 | Availability (un instrument crashe le job) | isolation | mitigate | `technical-engine.ts:225-272` try/catch par instrument + `stats.skipped` ; throw seulement si `inserted===0 && errors>0` (`:276`) | closed |
| T-03-13 | Information disclosure (service_role vers web) | barrel/lint | mitigate | Double barrière T-03-09 : `server-only` + ESLint group (`eslint.config.mjs:34`). Fixture `forbidden-service-import.ts` prouve que la garde se déclenche (D-07) | closed |
| T-03-14 | Input validation (dérive fundamental/news) | parse avant persist | mitigate | `fundamental-engine.ts:202` `FundamentalContextSchema.parse` avant upsert `:217` ; `news-engine.ts:224` `NewsContextSchema.parse` avant upsert `:244` | closed |
| T-03-15 | Information disclosure (secret dans job_runs.stats) | stats | mitigate | `fundamental-engine.ts:222-225` + `news-engine.ts:249-252` message normalisé only (T-02-13) | closed |
| T-03-16 | Tampering (drivers macro codés en dur) | asset_drivers | mitigate | `fundamental-engine.ts:198` `getAssetDrivers` lit la table `asset_drivers` (`assetDrivers.ts:19-33`) ; seedée + extensible par SQL (`0005_snapshots.sql:88-113`). D-38 | closed |
| T-03-17 | Integrity (fenêtre TZ mal calculée) | news_risk | mitigate | `news-engine.ts:21` luxon `DateTime` ; fenêtres `now.minus({hours})` (`:87`), `fromISO(...,{zone:'utc'})` (`:93,103,120`) ; seuils `{day:2h, swing:24h}` (`:42-44`, D-40). Pas de Date maison | closed |
| T-03-SC (03-01) | Tampering (npm installs) | supply chain | mitigate | Aucun nouveau package dans 03-01. `03-RESEARCH.md:110` | closed |
| T-03-SC (03-02) | Tampering (technicalindicators@3.1.0) | supply chain | mitigate | LOCKED par CLAUDE.md ; audité `03-RESEARCH.md:98-110` Package Legitimacy (aucun [SUS]) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-04 | `content_hash` = sha256 d'un payload canonique non-secret → reproductible par quiconque peut reconstruire le payload. **Par conception** : hash pour idempotence (clé dedup d'upsert) et référence d'intégrité (D-41), PAS un token de contrôle d'accès. Vérifié : jamais utilisé comme garde d'auth — `getSnapshotByHash` = lookup par contenu, zéro consommation `apps/web`. Le contrôle d'accès est assuré par RLS (T-03-01/02) + isolation service_role (T-03-09/13). Re-évaluer si le hash devient un token non-devinable dans une URL publique. | Borhane (founder) | 2026-06-13 |

*Accepted risks do not resurface in future audit runs.*

---

## Secret Handling (conventions projet vérifiées)

- service_role lu exclusivement via `process.env['SUPABASE_SERVICE_ROLE_KEY']` dans les moteurs `apps/jobs`.
- `.env` / `.env.local` / `.env.*.local` gitignorés à la racine → `apps/jobs/.env` couvert.
- Double barrière sur le service-client : `import 'server-only'` (build) + ESLint `no-restricted-imports` (lint), avec une fixture en échec permanent prouvant la garde.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-13 | 18 | 18 | 0 | gsd-security-auditor (Opus), mode verify-mitigations |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-13
