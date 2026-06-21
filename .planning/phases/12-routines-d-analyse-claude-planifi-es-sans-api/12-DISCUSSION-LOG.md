# Phase 12: Routines d'analyse Claude planifiées (sans API) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 12-routines-d-analyse-claude-planifi-es-sans-api
**Areas discussed:** Rollout initial, Run vide (0 setup), Priorité quota, Alerte défaillance, Mécanique routines (CLI/dashboard), Seuil de publication, Idempotence multi-instruments, Stats job_runs, Prompt vétéran

---

## Rollout initial

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal puis élargir | 1 day (newyork) + 1 swing (eod-swing), valider 1 run réel, puis élargir aux 4 | ✓ |
| 1 run manuel d'abord | Aucun scheduling tant qu'un run manuel n'a pas produit + fait inspecter un setup | |
| Les 4 d'emblée | asia + london + newyork + eod-swing tout de suite | |

**User's choice:** Minimal puis élargir
**Notes:** Dé-risque ROUTINE-03 avant de tout brancher ; cohérent avec la priorité quota NY + eod-swing.

---

## Run vide (0 setup)

| Option | Description | Selected |
|--------|-------------|----------|
| Succès normal | job_runs=success, {setups:0}, monitoring = "a tourné dans la fenêtre" | ✓ |
| Succès tracé | Succès + flag no-setup pour suivre la fréquence | |
| Anomalie si répété | Anomalie après N runs vides consécutifs | |

**User's choice:** Succès normal
**Notes:** Évite les faux `stale`. Nuance code notée : `persist()` throw si `written===0 && rejected>0` (à confirmer en planification).

---

## Priorité quota

| Option | Description | Selected |
|--------|-------------|----------|
| NY + eod-swing | Prioriser newyork + eod-swing ; asia/london sacrifiables | ✓ |
| Toutes égales | Aucune priorité (4 ≤ 15) | |
| Day > swing | Privilégier les fenêtres day | |

**User's choice:** NY + eod-swing
**Notes:** Règle de dégradation ; pression quota faible en pratique (4 fenêtres ≪ ~15/j).

---

## Alerte défaillance

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard passif | Flag stale sur /admin/sante uniquement | ✓ |
| + Alerte Telegram | Notifier superadmin via bot Telegram existant | |
| + Alerte email | Notification email (à câbler) | |

**User's choice:** Dashboard passif
**Notes:** Alerte active différée comme amélioration future (infra Telegram déjà disponible).

---

## Mécanique routines (CLI vs dashboard) — question libre de l'utilisateur

**Questions posées :** comment configurer les routines dans l'app Claude ; est-ce possible d'en créer depuis un terminal.

**Résolution (vérif. autoritative agent claude-code-guide) :**
- `/schedule` (CLI) crée la même routine cloud Remote que le dashboard, scriptable/headless.
- Config fine de l'Environment (secrets + network allowlist custom) = dashboard-only → workflow hybride.
- Réseau "Trusted" par défaut couvre `*.supabase.co` → Open Question A1 résolue.
- `Cron*`/recurring tasks = session-scoped (expirent ~7 j) → inadaptées ; utiliser Remote routines.
- Quota Remote ~15/j (Max) ; divergence "partagé vs dédié" à confirmer, sans impact pratique.

---

## Seuil de publication

| Option | Description | Selected |
|--------|-------------|----------|
| Barre existante | Garde-fous code (R:R≥1.2 + cohérence + structure) + discipline prompt, pas de plancher de score | ✓ |
| + Plancher de score | opportunity_score minimum (ex. ≥50) | |
| Tier watchlist | Tout publier, étiqueter les scores faibles | |

**User's choice:** Barre existante
**Notes:** = frontière de confiance D-43 déjà verrouillée ; pas de nouvelle logique en P12.

---

## Idempotence multi-instruments

| Option | Description | Selected |
|--------|-------------|----------|
| Design existant | Isolation par instrument + idempotence session_day, run partiel acceptable | ✓ |
| + Reprise partielle | Checkpoint des instruments traités | |

**User's choice:** Design existant
**Notes:** Flag stale + fenêtre suivante couvrent un run partiel ; pas de logique de reprise.

---

## Stats job_runs

| Option | Description | Selected |
|--------|-------------|----------|
| Existantes | {written, rejected, reasons[]} + durée | ✓ |
| Enrichies | + instruments scannés, produits vs persistés, par instrument | |

**User's choice:** Existantes
**Notes:** Suffisant pour ROUTINE-04 ; l'ANALYZE est agent-native, hors persist.

---

## Prompt vétéran live

| Option | Description | Selected |
|--------|-------------|----------|
| Revue puis fige | Revue fondateur rapide de veteran.md avant go-live, puis fige (versionné) | ✓ |
| Figer tel quel | Garder v1.0.0 sans revue | |
| Refonte | Retravailler le prompt en profondeur | |

**User's choice:** Revue puis fige
**Notes:** C'est l'intelligence produit ; tout ajustement bumpe juste le prompt_version (semver+sha256, D-51).

---

## Claude's Discretion

- Structure exacte des crons UTC (esquissée dans `sessions.ts`).
- Résolution day = "ouverture + clôture H1/H4" vs run unique par fenêtre.
- Format précis d'export `RUN_ID` / `PROMPT_VERSION` à l'ANALYZE.
- Contrat exact d'affichage `stale` côté `/admin/sante`.

## Deferred Ideas

- Plancher d'opportunity_score (calibration future, lié Phases 13/14).
- Tier "watchlist" pour scores faibles.
- Reprise de run partiel (checkpoint).
- Stats enrichies par instrument.
- Alerte active (Telegram/email) sur routine ratée.
- Clé API Anthropic + infra 24/7 (ENGINE-API, v2).
