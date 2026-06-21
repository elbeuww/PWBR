---
phase: 12-routines-d-analyse-claude-planifi-es-sans-api
plan: 03
subsystem: routines-environment
tags: [routines, claude-remote, environment, network, egress, smoke-test, ROUTINE-01]
requires:
  - "docs/routines-claude.md (runbook réseau Custom — plan 02)"
  - "apps/jobs/src/jobs/heartbeat.ts (sonde la plus légère touchant Supabase)"
  - "apps/jobs/src/runJob.ts (getServiceClient → 1er appel HTTPS *.supabase.co)"
provides:
  - "Cloud Environment `nexa-jobs` opérationnel (Network Custom + *.supabase.co + secrets) — dashboard-only, hors git"
  - "Egress *.supabase.co PROUVÉ depuis Remote (heartbeat success, 0 erreur réseau) — gate ROUTINE-01 franchi"
  - "docs/routines-claude.md : section « Résultat run de fumée » consignée (date + mode réseau Custom + egress confirmé)"
affects:
  - "Plan 05 (activation routines + run réel) réutilise cet Environment validé"
  - "Plan 06 (élargissement asia/london) réutilise le même Environment (aucune nouvelle config réseau)"
tech-stack:
  added: []
  patterns:
    - "Config cloud dashboard-only (Environment/secrets/network hors git) ; runbook = seule trace versionnée"
    - "Egress prouvé par run de fumée AVANT scheduling (least-privilege Custom, pas Full)"
key-files:
  created: []
  modified:
    - "docs/routines-claude.md (ajout « Résultat run de fumée » daté 2026-06-21)"
decisions:
  - "D-12-03-A : Environment `nexa-jobs` créé au dashboard (claude.ai/code/routines) — Network access = Custom + `*.supabase.co` + package managers par défaut ; secrets SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en env vars (pas de secrets store, accès édition restreint, P-SECRET). Dashboard-only, D-12-09."
  - "D-12-03-B (gate ROUTINE-01 vert) : mode réseau effectif = Custom (PAS de fallback Full). Run one-off heartbeat = job_runs.status='success', 0 erreur 403/host_not_allowed/fetch failed, vérifié REST HTTP 200 sur projet csotpitrjxryjkadyiml. Egress *.supabase.co confirmé."
  - "D-12-03-C (P-MCP renforcé) : le connecteur MCP Supabase attaché au smoke test pointait vers un AUTRE projet (agencyhub, sans job_runs) — l'agent l'a ignoré et a écrit via supabase-js (D-43). Confirme le connecteur inutile+dangereux → à RETIRER des routines réelles (plans 05/06), ROUTINE-05."
metrics:
  duration: "~human-gated (config dashboard + 1 run cloud)"
  completed: 2026-06-21
---

# Phase 12 Plan 03 : Environment Remote + run de fumée egress — Summary

Gate #1 de la phase (ROUTINE-01) franchi. L'Environment cloud `nexa-jobs` (Network Custom + `*.supabase.co` + secrets) est opérationnel, et un run de fumée `heartbeat` a **prouvé l'egress** vers Supabase depuis le runtime Remote : `job_runs.status='success'`, aucune erreur réseau. Les routines planifiées (plans 05/06) peuvent désormais s'appuyer sur une base réseau vérifiée.

## What Was Built

Aucun code (plan de configuration cloud + vérification). Actions :

- **Task 1 (checkpoint:human-action — Environment)** — Cloud Environment `nexa-jobs` créé au dashboard `claude.ai/code/routines` : Network access = `Custom`, allowlist `*.supabase.co` + package managers par défaut cochés ; variables d'Environment `SUPABASE_URL` (`https://csotpitrjxryjkadyiml.supabase.co`) + `SUPABASE_SERVICE_ROLE_KEY` (jamais committée ni affichée). Config dashboard-only (hors git).
- **Task 2 (checkpoint:human-verify — run de fumée)** — Run cloud one-off (routine « Smoke test », trigger Once) exécutant `corepack enable` → `pnpm install` (660 paquets) → `pnpm --filter jobs exec tsx src/dispatch.ts heartbeat`. Résultat **tout vert** ; `docs/routines-claude.md` mis à jour avec la section « Résultat run de fumée » (date + mode réseau Custom + egress confirmé).

## Tasks Completed

| Task | Name | Type | Résultat |
| ---- | ---- | ---- | -------- |
| 1 | Créer Environment Custom (secrets + réseau *.supabase.co) | checkpoint:human-action | Environment `nexa-jobs` opérationnel (dashboard, hors git) |
| 2 | Run de fumée egress (gate ROUTINE-01) | checkpoint:human-verify | heartbeat success, 0 erreur réseau, doc mis à jour |

## Deviations from Plan

Aucune déviation fonctionnelle. Le mode réseau `Custom` a fonctionné du premier coup → le fallback `Full` (prévu en A2 si bug #30112) n'a pas été nécessaire. Observation imprévue mais bénéfique : un connecteur MCP Supabase parasite (projet `agencyhub`) était attaché ; l'agent l'a correctement contourné via `supabase-js` (renforce ROUTINE-05, consigné D-12-03-C — connecteur à retirer en plans 05/06).

## Threat Mitigations Applied

- **T-12-07 (Information Disclosure — SERVICE_ROLE_KEY)** — secret saisi en env var d'Environment uniquement, accès édition restreint, jamais committé/recopié/affiché (rapport du run confirme « SERVICE_ROLE_KEY jamais affiché »).
- **T-12-08 (DoS — egress 403)** — mitigé : Network Custom `*.supabase.co` validé par run de fumée vert (0 `host_not_allowed`). Least-privilege conservé (pas de Full).
- **T-12-09 (EoP — connecteur MCP Supabase)** — l'écriture est passée par `supabase-js` (D-43), pas par le MCP ; connecteur parasite identifié et marqué pour suppression (plans 05/06).

## Verification

- Rapport du run cloud : (1) job terminé sans erreur (exit 0) ; (2) erreur réseau = NON ; (3) `job_runs` (heartbeat) = `status='success'`.
- Détail `job_runs` : started `2026-06-21T22:48:50.952+00:00`, finished `2026-06-21T22:48:52.477+00:00`, projet `csotpitrjxryjkadyiml`, vérifié REST HTTP 200.
- `docs/routines-claude.md` : section « Résultat run de fumée (gate ROUTINE-01) — ✅ CONFIRMÉ le 2026-06-21 » présente (mode Custom, egress confirmé, secrets non exposés).

## Self-Check: PASSED

- Environment `nexa-jobs` (Custom + *.supabase.co + 2 secrets) : CONFIRMÉ (dashboard)
- Run de fumée heartbeat : status='success', 0 erreur réseau : CONFIRMÉ
- docs/routines-claude.md « Résultat run de fumée » : FOUND (daté 2026-06-21)
- Aucun secret exposé ; aucun fichier source modifié
