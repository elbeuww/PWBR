# Phase 1: Fondations & Sécurité - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 01-fondations-s-curit
**Areas discussed:** Flow d'authentification, Périmètre schéma + RLS initial, Architecture du runner de jobs, Convention daily cross-asset, Structure monorepo, Gestion des secrets, Stratégie de tests, Table profiles

---

## Flow d'authentification (AUTH-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Email + mot de passe seul | Le plus simple, suffisant outil perso/démo, confirmation email désactivée au début | ✓ |
| Email + magic link | Pas de mdp, dépend de la délivrabilité email Supabase | |
| Email/mdp + OAuth Google | Bouton Google, nécessite config OAuth Google Cloud dès P1 | |

**User's choice:** Email + mot de passe seul
**Notes:** Confirmation email réactivable avant communauté.

---

## Périmètre schéma + RLS initial (AUTH-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimum walking skeleton | profiles + job_runs + 1 table marché seed (instruments) + RLS | ✓ |
| Fondations + marché complet | instruments + candles + job_runs + profils sans analyses/setups/journal | |
| Schéma complet d'un coup | Toutes les tables d'ARCHITECTURE.md + RLS dès maintenant | |

**User's choice:** Minimum walking skeleton
**Notes:** Reste du schéma phase par phase.

---

## Architecture du runner de jobs (JOB-03/04)

| Option | Description | Selected |
|--------|-------------|----------|
| Runner agnostique dès le départ | Entrypoint tsx unique appelable par Routine / Task Scheduler / croner, écrit job_runs | ✓ |
| Coupler aux Routines Claude d'abord | Brancher sur Routines, abstraire plus tard | |

**User's choice:** Runner agnostique dès le départ
**Notes:** Robustesse PC-éteint native.

---

## Convention daily cross-asset (DATA-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Daily natif par source | OANDA 17:00 NY, Binance 00:00 UTC, constantes par source dans core | ✓ |
| Daily canonique unique 00:00 UTC | Forcer clôture daily 00:00 UTC pour tous | |

**User's choice:** Daily natif par source
**Notes:** Préserve la sémantique réelle des marchés ; stockage UTC + bougie clôturée.

---

## Structure monorepo pnpm

| Option | Description | Selected |
|--------|-------------|----------|
| Strict skeleton | apps/web + apps/jobs + packages/core + packages/supabase | ✓ |
| Tous les stubs d'emblée | Ajouter data-sources et indicators vides maintenant | |

**User's choice:** Strict skeleton
**Notes:** Évite les coquilles vides ; data-sources/indicators créés à leur phase.

---

## Gestion des secrets

| Option | Description | Selected |
|--------|-------------|----------|
| .env local + .env.example | .env jobs (service_role), .env.local web (anon), .env.example commité contrat | ✓ |
| Secret manager dès P1 | Doppler/1Password CLI dès la Phase 1 | |

**User's choice:** .env local + .env.example
**Notes:** Routine Claude injecte via env cloud ; secret manager surdimensionné en solo.

---

## Stratégie de tests (Phase 1)

| Option | Description | Selected |
|--------|-------------|----------|
| Ciblé socle critique | Golden-values constantes temps + intégration RLS + 1 E2E auth, sans viser 80% sur scaffolding | ✓ |
| 80% strict dès P1 | Cible 80% sur tout le code y compris glue/config | |
| RLS + E2E seulement | Sécurité uniquement, golden-values reportées à Phase 3 | |

**User's choice:** Ciblé socle critique
**Notes:** Infra test posée ; cible 80% sur code métier des phases suivantes.

---

## Table profiles (Phase 1)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal + trigger auto | id/email/created_at, trigger Postgres on auth.users insert, RLS propre profil | ✓ |
| Minimal sans trigger | Mêmes champs, création côté app après signup | |
| Profil étendu dès P1 | Inclure capital, risk_percent, account_type | |

**User's choice:** Minimal + trigger auto
**Notes:** capital/risk%/account_type reportés en Phase 7 (RISK-03).

---

## Claude's Discretion

- Structure interne exacte des packages.
- Forme des constantes temporelles dans packages/core.
- Détails config ESLint no-restricted-imports.
- Déclencheur Task Scheduler (.cmd) + structure du dispatcher.
- Schéma SQL précis des 3 tables.

## Deferred Ideas

- Confirmation email + magic link / OAuth Google → v2 (ouverture communauté).
- Secret manager externe → si l'équipe grandit.
- Déploiement Vercel + CI GitHub Actions → quand le code métier le justifie.
- Champs profil étendus (capital, risk_percent, account_type) → Phase 7.
- Reste du schéma Supabase → Phases 2/3/4/8.
- Cible 80% globale → code métier des phases suivantes.
