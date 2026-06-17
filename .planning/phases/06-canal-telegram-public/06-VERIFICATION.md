---
phase: 06-canal-telegram-public
verified: 2026-06-17T00:00:00Z
status: human_needed
score: 3/4 must-haves verified (code); 1/4 en attente UAT live
overrides_applied: 0
human_verification:
  - test: "Envoi réel sur le canal Telegram public (UAT-06-01)"
    expected: "Message FR+AR posté sur le canal, disclaimer FR+AR present, win rate si N>=30, aucun niveau entry/SL/TP, re-run = 0 doublon, token absent de job_runs.stats"
    why_human: "Requiert bot token + canal public + bot admin — secrets hors-code non provisionnables en session. Détail complet dans 06-HUMAN-UAT.md."
---

# Phase 6 : Canal Telegram public — Rapport de vérification

**Phase Goal :** Job grammY publication-only qui poste automatiquement sur un canal Telegram public les résultats journaliers des trades clos + le win rate permanent mesuré, de façon idempotente (table `telegram_posts`) et tracée (`job_runs`). Couvre TG-01, TG-02, TG-03, étend LEGAL-01.

**Vérifié :** 2026-06-17
**Status :** human_needed (code complet — UAT envoi réel en attente)
**Re-vérification :** Non — vérification initiale

---

## Résumé de la décision

Le code livré est substantiel, correctement câblé et golden-testé sans réseau (7 tests mock, 408 tests suite totale). L'unique item bloquant est l'envoi réel sur le canal Telegram, qui requiert des secrets hors-code (bot token, canal public, bot admin). Ce gate est documenté en `06-HUMAN-UAT.md` (UAT-06-01) et constitue exactement le même pattern que le gate navigateur différé de la Phase 5.

---

## Vérité observables

| # | Vérité | Status | Evidence |
|---|--------|--------|----------|
| 1 | TG-02 / LEGAL-01 : `formatMessage` produit un message bilingue FR+AR avec disclaimer, seuil N≥30 via `applyThreshold`, sans niveaux entry/SL/TP | VERIFIE | `packages/core/src/telegram/format.ts` L1-200 — fonction pure, 11 golden tests, type `FormatTrade` limité à `symbol/direction/outcome/realized_r`, `DISCLAIMER_FR/AR` constants présentes, `applyThreshold` importé |
| 2 | TG-03 : `telegram_posts(UNIQUE dedupe_key)` + `insertPost onConflict ignoreDuplicates` + `getPostedKeys` | VERIFIE | `supabase/migrations/0015_telegram_posts.sql` L38-51 — `dedupe_key text NOT NULL UNIQUE`, RLS active 0 policy write ; `packages/supabase/src/repositories/telegramPosts.ts` — `upsert([row], { onConflict: 'dedupe_key', ignoreDuplicates: true })` |
| 3 | TG-01 / TG-03 : job `telegram-publish` idempotent, RECAP_HOUR_UTC=21, vendredi, notable R>=2.0, token jamais loggé, enregistré dans `dispatch.ts` | VERIFIE | `apps/jobs/src/jobs/telegram-publish.ts` + `apps/jobs/src/telegram/bot.ts` — env-throw token, pRetry 3, `bot.api.sendMessage` sans `bot.start()`, retour JSON sans token ; `dispatch.ts` L55 `'telegram-publish': telegramPublish` |
| 4 | TG-01 envoi réel sur le canal Telegram public | EN ATTENTE UAT | Requiert secrets hors-code (bot token + canal + admin) — gate UAT-06-01 dans `06-HUMAN-UAT.md`. Code testé mock (7/7 verts). |

**Score :** 3/4 vérités confirmées en code. 1/4 en attente UAT live (non un gap code).

---

## Artifacts requis

| Artifact | Description attendue | Status | Details |
|----------|---------------------|--------|---------|
| `packages/core/src/telegram/format.ts` | Formateur pur bilingue FR+AR, disclaimer LEGAL-01, seuil via @app/core | VERIFIE | 201 lignes, fonction pure, 0 I/O, type FormatTrade sans niveaux premium |
| `packages/core/src/telegram/format.test.ts` | 11 golden tests (seuil, disclaimer, D-03, D-10, bidi, cap 4096, injection HTML) | VERIFIE | Tests Vitest couvrant tous les garde-fous de la spec |
| `supabase/migrations/0015_telegram_posts.sql` | Table + UNIQUE dedupe_key + RLS active | VERIFIE | `dedupe_key text NOT NULL UNIQUE`, `alter table enable row level security`, 0 policy write |
| `packages/supabase/src/repositories/telegramPosts.ts` | `insertPost` + `getPostedKeys` idempotents | VERIFIE | `upsert onConflict dedupe_key ignoreDuplicates`, `Set<string>` retourné |
| `apps/jobs/src/telegram/bot.ts` | grammY publication-only, env-throw, pRetry | VERIFIE | `getBot()`, `getChannelId()`, `sendPost()` — jamais `bot.start()`, token lu process.env uniquement |
| `apps/jobs/src/jobs/telegram-publish.ts` | Job idempotent, RECAP_HOUR_UTC=21, notable>=2.0R, token exclu du JSON | VERIFIE | 247 lignes, 2 niveaux idempotence, JSON retourné `{posted, skipped, sample_sufficient, n}` sans token |
| `apps/jobs/src/jobs/__tests__/telegram-publish.test.ts` | 7 tests mock grammy sans réseau | VERIFIE | Mock `vi.mock('grammy')` + store en mémoire, couvre TG-01/02/03/D-02/D-10/D-11/T-06-TOKEN |
| `apps/jobs/src/dispatch.ts` | `telegram-publish` enregistré dans JOB_REGISTRY | VERIFIE | L55 `'telegram-publish': telegramPublish` |

---

## Vérification des liens clés (wiring)

| De | Vers | Via | Status | Details |
|----|------|-----|--------|---------|
| `telegram-publish.ts` | `@app/core` (formatMessage, applyThreshold) | import L34 | CABLAGE OK | `import { applyThreshold, formatMessage } from '@app/core'` |
| `telegram-publish.ts` | `@app/supabase` (getPatternStats, insertPost, getPostedKeys) | import L36 | CABLAGE OK | `import { getPatternStats, insertPost, getPostedKeys } from '@app/supabase'` |
| `telegram-publish.ts` | `bot.ts` (getBot, getChannelId, sendPost) | import L38 | CABLAGE OK | `import { getBot, getChannelId, sendPost } from '../telegram/bot'` |
| `@app/core` index | `formatMessage`, `escapeHtml`, types FormatTrade | barrel L37-38 | CABLAGE OK | Exports explicites dans `packages/core/src/index.ts` |
| `@app/supabase` index | `insertPost`, `getPostedKeys`, TelegramPost* types | barrel L88-90, L61-63 | CABLAGE OK | Exports explicites dans `packages/supabase/src/index.ts` |
| `dispatch.ts` | `telegramPublish` | import + JOB_REGISTRY L30,55 | CABLAGE OK | Enregistrement nommé `'telegram-publish'` |
| `apps/jobs` | `apps/web` | — | GRAPH PROPRE | 0 import trouvé (grep vide sur pattern `from 'apps/web'`) |

---

## Trace de flux données (Level 4)

| Artifact | Variable données | Source | Données réelles | Status |
|----------|-----------------|--------|-----------------|--------|
| `telegram-publish.ts` | `winRate` (StatRow) | `getPatternStats(client)` → vue `pattern_stats` DB | SELECT depuis vue live (migration 0014) | FLUX OK |
| `telegram-publish.ts` | `trades` (ResolvedTrade[]) | `prediction_outcomes` JOIN `trade_setups` + `instruments` | SELECT avec filtre `resolved_at >= windowStart` | FLUX OK |
| `telegram-publish.ts` | `posted` (Set<string>) | `getPostedKeys(client)` → table `telegram_posts` | SELECT `dedupe_key` | FLUX OK |
| `formatMessage` | `winRate` → `applyThreshold` | `StatRow` passé en paramètre | Transitive — même source `pattern_stats` | FLUX OK |

---

## Vérification comportementale (spot-checks)

| Comportement | Commande | Résultat | Status |
|-------------|---------|---------|--------|
| Token jamais dans JSON retourné | `grep -n "token" telegram-publish.ts` (hors commentaires) | Seules des références dans commentaires d'interdiction | PASS |
| `entry_price/stop_loss/take_profit` absents de format.ts | grep direct | 0 match | PASS |
| `bot.start()` absent de bot.ts | grep direct | 0 match (commentaire seulement) | PASS |
| Graphe propre jobs → web | grep `from 'apps/web'` dans `apps/jobs/src/` | 0 match | PASS |
| `telegram-publish` dans dispatch.ts | grep direct | L55 confirmé | PASS |
| `grammy 1.43.0` épinglé dans package.json | grep | `"grammy": "1.43.0"` | PASS |
| Envoi réel (UAT-06-01) | `pnpm --filter jobs exec tsx src/dispatch.ts telegram-publish` | Non exécutable sans secrets — gate UAT humain | SKIP (UAT) |

---

## Couverture des exigences

| Exigence | Plan source | Description | Status | Evidence |
|---------|-------------|-------------|--------|----------|
| TG-01 | 06-03 | Job publication auto résultats journaliers | CODE VERIFIE / UAT EN ATTENTE | `telegram-publish.ts` complet, 7 tests mock verts — envoi réel = UAT-06-01 |
| TG-02 | 06-01 | Win rate permanent à jour dans chaque post | SATISFAIT | `formatMessage` + `applyThreshold` partagé, golden-testé, même seuil que vitrine |
| TG-03 | 06-02 + 06-03 | Idempotence + traçabilité | SATISFAIT | UNIQUE dedupe_key DB + `onConflict ignoreDuplicates` + test idempotence mock |
| LEGAL-01 (extension) | 06-01 | Disclaimer sur posts Telegram | SATISFAIT | `DISCLAIMER_FR/AR` dans `format.ts`, golden test "toute sortie contient le disclaimer" |

---

## Anti-patterns

| Fichier | Ligne | Pattern | Sévérité | Impact |
|---------|-------|---------|----------|--------|
| Aucun | — | — | — | Aucun TBD/FIXME/XXX trouvé dans les fichiers de la phase |

---

## Vérification humaine requise

### 1. UAT-06-01 — Envoi réel sur le canal Telegram

**Test :** Suivre la procédure dans `06-HUMAN-UAT.md` :
1. Créer bot via @BotFather, récupérer `TELEGRAM_BOT_TOKEN`.
2. Créer canal public, ajouter le bot comme administrateur « Post Messages ».
3. Renseigner `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL_ID=-100…` dans `apps/jobs/.env`.
4. Exécuter : `pnpm --filter jobs exec tsx src/dispatch.ts telegram-publish`
5. Re-exécuter immédiatement pour tester l'idempotence.

**Attendu :**
- Message posté : bloc FR en haut + séparateur + bloc AR (RTL) en bas.
- Disclaimer FR + AR présent.
- Win rate si N>=30, sinon « échantillon insuffisant, N=… ».
- Aucun niveau entry/SL/TP dans le message.
- 2e run : 0 doublon posté (`job_runs.stats.posted = 0`).
- Token absent de `job_runs.stats`.

**Pourquoi humain :** Requiert bot Telegram + canal public + droits admin — secrets hors-code impossibles à provisionner en session Claude.

---

## Résumé des gaps

Aucun gap code identifié. L'unique item non résolu automatiquement est UAT-06-01 (envoi réel Telegram), classé correctement comme gate UAT humain et non comme gap code — identique au pattern navigateur/UAT de la Phase 5.

Le code delivre :
- `formatMessage` pur bilingue FR+AR (LEGAL-01, TG-02) — substantif et golden-testé.
- `telegram_posts` UNIQUE dedupe_key + repo idempotent (TG-03) — appliqué live.
- Job `telegram-publish` complet : idempotent 2 niveaux, RECAP_HOUR_UTC=21, notable>=2.0R, token exclu du JSON (TG-01/TG-03) — 7 tests mock verts.
- Graphe propre : jobs n'importent pas apps/web.
- Aucun debt marker (TBD/FIXME/XXX) dans les fichiers de la phase.

---

_Vérifié : 2026-06-17_
_Vérificateur : Claude (gsd-verifier)_
