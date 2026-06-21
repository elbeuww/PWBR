---
phase: 12-routines-d-analyse-claude-planifi-es-sans-api
plan: 04
subsystem: routines-prompt
tags: [prompt, veteran, founder-review, go-live, versioning, anti-injection]
requires:
  - "apps/jobs/prompts/veteran.md (intelligence produit agent-native)"
  - "apps/jobs/src/jobs/persist.ts (computePromptVersion : sha256 + semver front-matter)"
provides:
  - "Revue fondateur (Borhane) du prompt vétéran effectuée AVANT go-live (D-12-08)"
  - "veteran.md v1.0.0 figé (approve-as-is) — sha256 inchangé, garde anti-injection intacte"
affects:
  - "Plan 05 (run réel) publie de vrais signaux sur ce prompt revu"
tech-stack:
  added: []
  patterns:
    - "Checkpoint:decision — revue qualité du raisonnement, pas du scoring (recalculé code D-43)"
key-files:
  created: []
  modified: []
decisions:
  - "D-12-04-A : décision fondateur = approve-as-is. veteran.md v1.0.0 figé, AUCUNE édition (sha256 inchangé). Le prompt a déjà la garde anti-injection <market_data>, la discipline confluence, et le schéma §3 — go-live immédiat."
  - "D-12-04-B : la revue ne touche PAS au scoring (opportunity_score/risk_level/confidence/rr recalculés et écrasés par le code, D-43/P-HALLUC) — seul le raisonnement était en jeu, jugé prêt."
metrics:
  duration: "~3min"
  completed: 2026-06-21
---

# Phase 12 Plan 04 : Revue fondateur du prompt vétéran — Summary

Checkpoint:decision (D-12-08) franchi. Le fondateur (Borhane) a revu `apps/jobs/prompts/veteran.md` (v1.0.0) avant que de vrais signaux partent aux membres et a décidé **approve-as-is** : prompt prêt pour go-live tel quel, aucune édition, version 1.0.0 figée.

## What Was Built

Rien de codé — checkpoint de revue qualité. Décision fondateur = **approuver v1.0.0 tel quel**. Le prompt n'est pas modifié : sha256 inchangé, `version: 1.0.0` préservée, garde anti-injection `<market_data>` intacte.

Éléments validés lors de la revue :
- **Garde anti-injection** — `<market_data>…</market_data>` traite les headlines tierces (Finnhub/Marketaux) comme DONNÉE jamais instruction ; exemple explicite de neutralisation d'un ordre injecté.
- **Frontière D-43 respectée** — le prompt documente que `opportunity_score`/`risk_level`/`confidence`/`risk_reward`/`atr_distance_sl` sont recalculés et écrasés par le code ; l'agent se concentre sur le raisonnement (direction, niveaux, narration).
- **Bornes dures** — 1 à 3 take-profits, somme `alloc_pct` = 100 exactement ; cohérence directionnelle (long : SL < entry < TP) ; rejet si structure cassée contre la direction ou confluence insuffisante.
- **Discipline confluence** — empilement structure + tendance HTF + niveau + momentum + macro + news cohérent ; « un setup médiocre se rejette ».
- **Schéma §3 + exemple** — schéma de sortie complet et exemple XAU_USD (london, day) cohérent.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Revue fondateur du prompt vétéran (D-12-08) — approve-as-is | (close-out only, no source edit) | apps/jobs/prompts/veteran.md (inchangé) |

## Deviations from Plan

None — branche `approve-as-is` du checkpoint:decision suivie exactement : aucune modification du fichier, version 1.0.0 conservée, sha256 inchangé.

## Threat Mitigations Applied

- **T-12-10 (prompt injection via <market_data>)** — garde vérifiée présente et intacte (`grep -c market_data` = 2) ; non affaiblie (aucune édition).
- **T-12-11 (score halluciné)** — déjà mitigé hors prompt (scoreSetup recalcule, D-43) ; la revue ne touche pas au scoring.

## Verification

- `grep -E '^version:\s*[0-9]+\.[0-9]+\.[0-9]+' apps/jobs/prompts/veteran.md` → `version: 1.0.0` (semver valide).
- `grep -c 'market_data' apps/jobs/prompts/veteran.md` → 2 (garde anti-injection présente).
- `npx vitest run apps/jobs/__tests__/persist.test.ts` → **29/29 verts** (computePromptVersion lit le fichier sans erreur).
- `git diff apps/jobs/prompts/veteran.md` → VIDE (approve-as-is, sha256 inchangé).

## Self-Check: PASSED

- apps/jobs/prompts/veteran.md : FOUND (inchangé, v1.0.0)
- Garde `<market_data>` : FOUND (2 occurrences)
- persist.test.ts : 29/29 PASSED
- Décision fondateur D-12-08 : approve-as-is (consignée D-12-04-A)
