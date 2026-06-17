# 06-03 SUMMARY — Job telegram-publish (TG-01/TG-03)

**Plan:** 06-03 · **Wave:** 2 · **Status:** code-complete (Task 4 → UAT) · **Date:** 2026-06-17

## Objectif livré
Job `telegram-publish` publication-only, idempotent et tracé : sélectionne les trades fraîchement résolus, décide du format (récap / notable / win-rate), formate bilingue FR+AR via `formatMessage` (06-01), envoie via grammY, insère `telegram_posts` (06-02). Le « fil de l'eau » MENA.

## Tâches
- **Task 1 (checkpoint vetting, orchestrateur)** — grammy@1.43.0 vetté (npm : repo officiel grammyjs, pas de postinstall réseau) + installé épinglé exact. Commit `e124467`.
- **Task 2 (auto, executor)** — `bot.ts` (getBot/getChannelId/sendPost, env-throw, pRetry, parse_mode HTML, jamais bot.start) + `telegram-publish.ts` (clone outcome-tracker) + `dispatch.ts` + `.env.example` (racine + apps/jobs). Commit `219b299`.
- **Task 3 (auto TDD, executor)** — `telegram-publish.test.ts` : 7 tests (mock client store + `vi.mock('grammy')`). Commit `561dec4`.
- **Task 4 (checkpoint:human-verify BLOCKING) → DIFFÉRÉ EN UAT** — envoi réel sur le canal, exige secrets hors-code (bot/canal Telegram). Consigné dans `06-HUMAN-UAT.md` (UAT-06-01). Précédent : UAT navigateur P5.

## Vérifications (auto)
- `npx vitest run apps/jobs/.../telegram-publish.test.ts` → 7/7 verts.
- `npx vitest run` (suite complète) → **408/408 verts** (54 fichiers).
- `pnpm typecheck` → exit 0, 0 nouvelle erreur.

## Comportements couverts (tests)
- TG-03 idempotence : 2e run consécutif → posted=0, `sendMessage` NON rappelé.
- TG-03 clés distinctes : `recap:<jour>` ≠ `notable:<setup_id>` ≠ `winrate:<jour>`.
- TG-01 jour vide (D-10) : run récap sans trade → 1 post « Aucun trade » + win rate.
- TG-01 notable gate (D-02) : `realized_r=2.5` → post notable ; `1.2` → aucun.
- TG-02 seuil (D-11) : N=12 → « échantillon insuffisant » ; N=142 → « % ».
- Secret : token absent du Json de retour.

## Garde-fous (threat model)
- **T-06-TOKEN** : token lu depuis `apps/jobs/.env` uniquement, jamais loggé ni dans `job_runs.stats`.
- **T-06-LEAK** : SELECT = symbol+direction+outcome+realized_r ; AUCUN entry/sl/tp (D-03) — vérifié (seule mention = commentaire d'interdiction).
- **T-06-DUP** : getPostedKeys (niveau 1) + insertPost onConflict dedupe_key (niveau 2).
- **T-06-LISTENER** : `new Bot(token)` sans bot.start() — aucun listener entrant.
- **T-06-403** (accept, ops) : bot admin requis avant 1er run — couvert par l'UAT.
- **T-06-SC** : grammy épinglé 1.43.0, vetté.

## Déviation
- `p-retry@8.0.0` (verrouillé CLAUDE.md, déjà au lockfile) déclaré dans apps/jobs/package.json (import manquant) — install `--offline`, zéro réseau.

## key-files.created
- `apps/jobs/src/telegram/bot.ts`
- `apps/jobs/src/jobs/telegram-publish.ts`
- `apps/jobs/src/jobs/__tests__/telegram-publish.test.ts`

## key-files.modified
- `apps/jobs/src/dispatch.ts` (registry), `apps/jobs/package.json` (grammy + p-retry), `.env.example`, `apps/jobs/.env.example`

## Commits
- `e124467` chore(06-03): vetting + install grammy@1.43.0
- `219b299` feat(06-03): job telegram-publish + client grammY publication-only
- `561dec4` test(06-03): idempotence + cadence + seuil (mock grammy)

## Self-Check: PASSED (code) — UAT-06-01 en attente
Job livré, testé sans réseau, idempotent, tracé. Envoi réel = gate UAT humain (`06-HUMAN-UAT.md`).
