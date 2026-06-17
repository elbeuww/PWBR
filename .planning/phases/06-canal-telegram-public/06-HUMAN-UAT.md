# Phase 6 — UAT humain (gate envoi réel Telegram)

> Le code, les tests (mock) et l'idempotence DB sont livrés et verts. L'envoi RÉEL
> exige des secrets hors-code (bot + canal Telegram) que Claude ne peut pas créer.
> Cet item est l'équivalent de l'UAT navigateur différé de la Phase 5.

**Status:** ⏳ en attente · **Bloque:** `phase.complete` de la Phase 6 · **Date créée:** 2026-06-17

---

## UAT-06-01 — Envoi réel sur le canal Telegram (06-03 Task 4)

**Requirement:** TG-01 / TG-03 (publication réelle + idempotence live) · **Threat:** T-06-403 (bot non-admin), T-06-TOKEN, T-06-DUP

### Pré-requis ops (hors-code, à faire par le fondateur)
1. Créer le bot via **@BotFather** (`/newbot`) → récupérer `TELEGRAM_BOT_TOKEN`.
2. Créer le **canal public** Telegram cible (MENA FR+AR).
3. Ajouter le bot comme **ADMINISTRATEUR** avec le droit **« Post Messages »** (sinon erreur 403 — Pitfall 4).
4. Récupérer `TELEGRAM_CHANNEL_ID` numérique **`-100…`** (préféré au `@username`).
5. Renseigner les 2 variables dans **`apps/jobs/.env`** (jamais committé — secrets `.env` only, CLAUDE.md).

### Procédure de vérification
6. Exécuter : `pnpm --filter jobs exec tsx src/dispatch.ts telegram-publish`
   (forcer un run récap ~21h UTC, ou seed un trade notable `realized_r ≥ 2.0` pour produire un message).
7. **Vérifier le message** posté sur le canal :
   - bloc **FR en haut** + séparateur + bloc **AR (RTL) en bas**, un seul message / une seule notification (D-05) ;
   - **disclaimer FR + AR** présent (LEGAL-01 / D-06) ;
   - **win rate** affiché (`XX% (N=…)` si N≥30, sinon « échantillon insuffisant, N=… » — D-11) ;
   - chaque trade = **actif + direction + résultat + R**, **AUCUN niveau** entrée/SL/TP (D-03) ;
   - R/ticker lisibles LTR dans le bloc arabe (isolats bidi).
8. **Idempotence live (TG-03)** : re-exécuter immédiatement → **0 doublon** (`job_runs.stats.posted = 0`).
9. **Traçabilité / secret** : `job_runs` montre une ligne `success`, et le **token n'apparaît PAS** dans `stats`.

### Resume-signal attendu
`approved` + capture/description du message (FR+AR + disclaimer + sans niveaux) + confirmation re-run = 0 doublon.

### Note scheduling (après validation envoi réel)
- Cadence prévue : **horaire**, **après** `outcome-tracker` (D-07). Récap quotidien au run **~21h UTC** (D-08), post « win rate seul » le **vendredi** (D-09).
- Backup déterministe : `run-job.cmd telegram-publish` via Windows Task Scheduler (ASCII/CRLF).
