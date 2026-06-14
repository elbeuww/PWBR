# Phase 4: Moteur IA "vétéran" & scoring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 4-Moteur IA "vétéran" & scoring
**Areas discussed:** Calcul du score /100, Frontière Zod + persist, Run batch & rétention, Immuabilité & versions, Risk level, Prompt vétéran, Confidence, Univers session→instruments, Multi-TP & allocation, Traçabilité de version, Golden tests scoring

---

## Calcul du score /100 (D-42)

| Option | Description | Selected |
|--------|-------------|----------|
| Code déterministe | Code calcule depuis snapshot + barème §3 ; agent fournit qualitatif + sélection | ✓ |
| Agent calcule, code vérifie | Agent calcule la note, code re-borne | |
| Hybride borné | Code base + ajustement agent ±N points | |

**User's choice:** Code déterministe (reco)
**Notes:** Motivé par reproductibilité, golden tests, calibration win-rate/bucket (§6).

---

## Frontière Zod + persist (D-43)

| Option | Description | Selected |
|--------|-------------|----------|
| persist.ts + log&skip | Script Node Zod+garde-fous+service_role ; rejet logué+skip, pas de retry | ✓ |
| persist.ts + retry 1× | Idem mais 1 nouvelle tentative agent sur rejet | |
| Insert MCP + validation | Agent insère via MCP, validation DB/trigger | |

**User's choice:** persist.ts + log&skip (reco)
**Notes:** Garde non contournable (agent jamais d'insert direct) ; taux de rejet mesuré pour itérer.

---

## Run batch & rétention (D-44, D-49)

| Option | Description | Selected |
|--------|-------------|----------|
| Boucle + écrire tout valide | Boucle instrument×style ; écrit tous setups R:R≥1.2, pas de seuil score | ✓ |
| Boucle + seuil score≥X | Idem mais n'écrit que score≥X | |
| Méga-prompt session | Tous snapshots dans un raisonnement | |

**User's choice:** Boucle + écrire tout valide (reco) ; univers via config versionnée (reco)
**Notes:** Contexte borné, échecs isolés ; tout gardé pour calibration. Univers = `apps/jobs/config/sessions.ts` ∩ instruments.active, crypto chaque session.

---

## Immuabilité & versions (D-45)

| Option | Description | Selected |
|--------|-------------|----------|
| Code expire à l'insert | Clé (instrument,style,session,jour) ; code marque antérieurs expired à l'insert | ✓ |
| Job d'expiration séparé | Job planifié expire selon valid_until | |
| Append-only sans expiration | Empilage, "plus récent par clé" calculé à la lecture | |

**User's choice:** Code expire à l'insert (reco)
**Notes:** valid_until day ~24h / swing quelques jours ; invalidated par outcome-eval (P6).

---

## Risk level (D-46)

| Option | Description | Selected |
|--------|-------------|----------|
| Code déterministe | Code dérive des facteurs §3 (ATR, percentile, news, session, HTF) | ✓ |
| Agent juge le risque | Agent évalue, code vérifie cohérence | |

**User's choice:** Code déterministe (reco)
**Notes:** Même cohérence/traçabilité que le score.

---

## Prompt vétéran & sortie JSON (D-47)

| Option | Description | Selected |
|--------|-------------|----------|
| Fichier versionné + 1 bloc/instrument | Prompt dans repo (veteran.md), 1 JSON/instrument, persist.ts parse+Zod | ✓ |
| Prompt inline dans le runbook | Prompt dans la def du scheduled agent, non versionné | |

**User's choice:** Fichier versionné + 1 bloc/instrument (reco)
**Notes:** Versionné = traçable/itérable (point recherche #1).

---

## Confidence (D-48)

| Option | Description | Selected |
|--------|-------------|----------|
| Règle déterministe | Mapping code depuis score + confluences + news_risk | ✓ |
| Jugement agent | Agent exprime confiance qualitative | |
| Retirer le champ en P1 | Ne pas persister confidence | |

**User's choice:** Règle déterministe (reco)

---

## Univers session→instruments (D-49)

| Option | Description | Selected |
|--------|-------------|----------|
| Config versionnée | Fichier sessions.ts ∩ instruments.active | ✓ |
| Table DB session_instruments | Table mapping éditable en SQL | |
| Tags sur instruments | Colonne sessions text[] sur instruments | |

**User's choice:** Config versionnée (reco)

---

## Multi-TP & allocation (D-50)

| Option | Description | Selected |
|--------|-------------|----------|
| Agent propose, code borne | Agent 1–3 TP + alloc_pct ; code borne, recalcule rr ; R:R bord conservateur | ✓ |
| Fixe 2 TP 50/50 | Règle code, formule ATR/S-R | |

**User's choice:** Agent propose, code borne (reco)

---

## Traçabilité de version (D-51)

| Option | Description | Selected |
|--------|-------------|----------|
| Colonnes dédiées sur analyses | model, prompt_version, schema_version, run_id | ✓ |
| Tout dans le payload jsonb | Champs dans payload, non indexables | |

**User's choice:** Colonnes dédiées sur analyses (reco)

---

## Golden tests scoring (D-52)

| Option | Description | Selected |
|--------|-------------|----------|
| packages/core + fixtures | Scoring dans core (pur, réutilisable), golden snapshot→score/risk/confidence | ✓ |
| Dans apps/jobs | Scoring avec les jobs | |

**User's choice:** packages/core + fixtures (reco)

---

## Claude's Discretion

- Colonnes/index exacts des migrations `analyses`/`trade_setups` (suivre §4 + conventions P3).
- Format du `run_id`, structure interne de `packages/core/scoring`, ergonomie du fichier `sessions.ts`.

## Deferred Ideas

- outcome-eval / prediction_outcomes / calibration / backtests → Phase 6.
- Dashboard opportunités → Phase 5.
- Retry auto agent sur rejet → reconsidérer selon taux de rejet mesuré.
- confidence en jugement agent → réévaluer si signal.
- Clé API Anthropic / analyses live → post-pivot.
