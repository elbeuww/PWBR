---
phase: 12-routines-d-analyse-claude-planifi-es-sans-api
plan: 02
subsystem: routines-runbook
tags: [docs, routines, claude-remote, runbook, go-live, network, secrets]
requires:
  - "apps/jobs/config/sessions.ts (crons UTC source de vérité)"
  - "apps/jobs/src/jobs/persist.ts (contrat RUN_ID + WR-04)"
  - "apps/jobs/src/jobs/runArtifacts.ts (no_artifacts sur dir vide)"
provides:
  - "docs/routines-claude.md = runbook go-live reproductible (réseau Custom, secrets, MCP off, single-run, RUN_ID, crons alignés)"
  - ".gitignore couvre run-artifacts/ (A3 confirmé closed)"
affects:
  - "Plan 03 (config Environment + smoke run egress) consomme ce runbook"
tech-stack:
  added: []
  patterns:
    - "Doc-only : config cloud hors git, runbook = seule trace versionnée"
key-files:
  created: []
  modified:
    - "docs/routines-claude.md (réécriture §1/§4/§6/§7 + ajout §8)"
decisions:
  - "D-12-02-A : §4 réseau Custom + *.supabase.co OBLIGATOIRE (corrige D-12-10), Trusten ne couvre pas Supabase (403 host_not_allowed) ; Full en fallback documenté (A2)"
  - "D-12-02-B : §6 crons placeholder remplacés par les crons UTC de sessions.ts (newyork 30 12, eod-swing 00 21 = rollout #1)"
  - "D-12-02-C : §8 single-run handoff (clone frais perd run-artifacts/) + RUN_ID strict + sémantique calme (0 artefact => pas de persist, no_artifacts != erreur ; all-rejected throw WR-04)"
  - "D-12-02-D : .gitignore A3 CLOSED — run-artifacts/ déjà présent ligne 38, 0 artefact tracké, aucune édition (surgical)"
metrics:
  duration: "~10min"
  completed: 2026-06-21
---

# Phase 12 Plan 02 : Runbook go-live des routines Claude Remote — Summary

Runbook `docs/routines-claude.md` corrigé et complété pour être la trace versionnée reproductible de l'activation des routines Remote : réseau Custom obligatoire (`*.supabase.co`), single-run handoff, RUN_ID strict, sémantique marché-calme, P-SECRET, P-MCP, crons alignés sur `sessions.ts` ; `.gitignore` confirmé couvrant `run-artifacts/`.

## What Was Built

- **§1/en-tête** — Statut passé à « Phase 12, go-live » ; rollout #1 = `newyork` + `eod-swing` documenté ; le doc déclaré seule trace versionnée (config cloud hors git).
- **§4 réseau (P-NET, corrige D-12-10)** — Le profil Trusted N'INCLUT PAS `*.supabase.co` (liste vérifiée = api.anthropic.com, github, package managers, ubuntu) → `403 x-deny-reason: host_not_allowed`. Procédure REQUISE : Network = `Custom` + `*.supabase.co` + package managers par défaut ; fallback `Full` (A2 / issue #30112). Gate ROUTINE-01 (run de fumée egress).
- **§6 horaires** — Placeholders (22:30/09:15/00:15) remplacés par un tableau de crons UTC alignés sur `apps/jobs/config/sessions.ts` : `newyork 30 12 * * 1-5`, `eod-swing 00 21 * * 1-5` (rollout #1) ; `asia 00 23 * * 0-4`, `london 00 07 * * 1-5` (élargissement). Min interval 1h, saisir en UTC, sessions.ts = source de vérité.
- **§7 runbook go-live** — Ancien « TODO Phase 4 » converti en checklist exécutable : Custom REQUIS, run de fumée gate ROUTINE-01, P-MCP, création routines via `/schedule`, run réel gate ROUTINE-03.
- **§8 nouveau** — Séquence single-run (ingest→engines→combine→ANALYZE agent-native→persist dans UN SEUL run cloud) ; RUN_ID strict `<session>-<YYYYMMDD>T<HHmm>Z` + exemple `newyork-20260622T1730Z` ; sémantique calme D-12-02 (0 artefact → pas d'appel persist, `no_artifacts` ≠ erreur ; all-rejected throw WR-04) ; P-MCP (retirer connecteur Supabase) ; P-SECRET (SERVICE_ROLE_KEY visible aux éditeurs, jamais commit/log).
- **.gitignore** — Confirmé : `run-artifacts/` présent ligne 38, 0 artefact tracké, aucune édition (A3 closed).

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Corriger les 3 sections stale (réseau, horaires, A1) | eb14a9b | docs/routines-claude.md |
| 2 | §8 single-run, RUN_ID, P-SECRET, P-MCP, sémantique calme | 50c57b9 | docs/routines-claude.md |
| 3 | Confirmer .gitignore couvre run-artifacts/ (A3) | (verification-only, no edit) | .gitignore |

## Deviations from Plan

None — plan exécuté exactement comme écrit. Task 3 était une vérification (A3 déjà closed) : aucune édition de `.gitignore` nécessaire, donc pas de commit pour cette tâche (conforme à l'instruction « aucune édition nécessaire si l'entrée est présente »).

## Threat Mitigations Applied

- **T-12-04 (P-SECRET)** — §8.5 impose restriction d'accès Environment, jamais commit, jamais log de SERVICE_ROLE_KEY.
- **T-12-05 (P-MCP)** — §8.4 retire tout connecteur Supabase MCP ; écriture seulement via supabase-js service_role (ROUTINE-05).
- **T-12-06 (P-NET)** — §4 Network Custom minimal `*.supabase.co` + defaults (moindre privilège), `Full` seulement en fallback documenté.

## Verification

- `grep -v '^#' docs/routines-claude.md | grep -c 'supabase.co'` = 4 (≥1 OK).
- Chaînes stale « sans configuration spéciale a priori » = 0, « à confirmer si nécessaire — A1 » = 0.
- Crons `30 12` / `00 21` présents ; diagramme invariant §4 préservé.
- `grep -v '^#' … | grep -cE 'RUN_ID|single-run|host_not_allowed|SERVICE_ROLE'` = 14 ; exemple RUN_ID, no_artifacts, P-SECRET, P-MCP présents.
- `grep -c '^run-artifacts/$' .gitignore` = 1 ; `git ls-files run-artifacts/` vide ; `git diff .gitignore` vide.

## Self-Check: PASSED

- docs/routines-claude.md : FOUND (modifié, 2 commits)
- Commit eb14a9b : FOUND
- Commit 50c57b9 : FOUND
- .gitignore run-artifacts/ : FOUND (ligne 38)
