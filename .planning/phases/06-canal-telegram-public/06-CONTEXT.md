# Phase 6: Canal Telegram public - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Cette phase livre un **job `grammY` *publication-only*** qui poste automatiquement sur **un canal Telegram public** les **résultats journaliers des trades clos** et le **win rate permanent mesuré** (issu de la Phase 5), de façon **idempotente** (aucun double post, contrainte sur une table `telegram_posts`) et **tracée dans `job_runs`**.

Couvre **TG-01** (publication auto des résultats journaliers), **TG-02** (win rate permanent à jour dans chaque post), **TG-03** (idempotence + traçabilité), et étend **LEGAL-01** (disclaimer sur les posts Telegram).

**Hors scope (capacités nouvelles → autres phases ou différé) :** interaction/commandes du bot (le bot ne fait que publier), modération, mesure de TP2 / TP partiels (touche le moteur d'outcomes P5), canaux multiples par langue / version anglaise, dashboard d'analytics Telegram.

</domain>

<decisions>
## Implementation Decisions

### Contenu & format des posts
- **D-01 (TG-01) — Rythme adaptatif, mélange de 3 formats (PAS de rythme statique).** Le job choisit le format selon ce qui s'est passé :
  - **Récap journalier groupé** (format par défaut, 1×/jour) : liste les trades clos sur la fenêtre de 24h + win rate permanent.
  - **Post dédié intraday « au fil de l'eau »** : déclenché quand un trade clôture avec un **R réalisé ≥ 2.0** (trade « notable »).
  - **Post « win rate seul »** : point d'étape hebdomadaire, **le vendredi** (chiffre permanent sans détail trade-par-trade).
- **D-02 — Critère « notable » = R réalisé ≥ 2.0** (option A retenue). Le R réalisé est celui mesuré **jusqu'à TP1** par le moteur d'outcomes P5 (`realized_r`). **Le tracking de TP2 est DÉFÉRÉ** (P5 ne mesure que « TP1 atteint avant SL », binaire) — ne pas inventer un statut TP2 qui n'existe pas en base.
- **D-03 — Champs affichés par trade clos = actif + direction + résultat + R réalisé.** Ex. « EUR/USD Long — ✅ TP1 atteint, +2.3R ». **NE PAS** afficher les niveaux exacts entrée/SL/TP (ils restent la valeur du produit payant ; cohérent avec la minimisation des données). Résultat = TP1 atteint / SL touché / flat (clôture à `valid_until`).

### Langue & agencement
- **D-04 (TG-01) — Un seul canal Telegram public**, un seul `channel_id`. Pas de canaux multiples par langue au MVP.
- **D-05 — Posts bilingues FR + AR dans un message unique : bloc français en haut, séparateur, bloc arabe (RTL) en bas.** Pas d'anglais. Une seule notification par post.
- **D-06 (LEGAL-01) — Disclaimer « contenu éducatif, pas un conseil en investissement, aucune promesse de gain » présent sur chaque post, dans les deux langues.**

### Cadence & sélection
- **D-07 (TG-01) — Job de publication HORAIRE, aligné sur les bougies H1**, exécuté **après** le job `outcome-tracker` (qui calcule les outcomes ; D-03 P5 = outcomes sur bougies H1). Permet le vrai « fil de l'eau » : chaque run horaire détecte les trades notables (≥2R) fraîchement clos → post dédié immédiat.
- **D-08 — Récap quotidien groupé déclenché au run de ~21h UTC** (fin de session NY), couvrant les trades clos sur la fenêtre des ~24h écoulées. L'heure exacte = constante de config (à aligner sur les constantes anti look-ahead `packages/core/src/time/constants.ts` de P5).
- **D-09 — Le post « win rate seul » sort le vendredi** (au run approprié de la journée).

### Cas limites (fidélité au « jamais inventé / jamais gonflé »)
- **D-10 — Jour sans aucun trade clos : POSTER QUAND MÊME** un message « Aucun trade clôturé aujourd'hui » + win rate permanent (présence quotidienne constante). PAS de skip silencieux pour le récap quotidien.
- **D-11 (TG-02) — Win rate sous le seuil N≥30 : afficher « échantillon insuffisant, N trades »**, jamais de % inventé. Identique à la vitrine (P5 / D-09, seuil `threshold.ts` MIN_SAMPLE=30, **N toujours affiché**). Cohérence stricte plateforme ↔ Telegram.

### Claude's Discretion (à trancher par researcher/planner)
- **Schéma de la table `telegram_posts`** et clé d'idempotence (TG-03) : granularité de la contrainte `UNIQUE` selon le type de post — récap quotidien et post hebdo idempotents par **(type, date/jour-UTC)** ; post notable idempotent par **`setup_id`** (un trade ne génère qu'un post dédié). Arbitrer le n° de migration (dernière sur disque = 0014 ; **0013 réservé au cluster paiement P4 différé** → la nouvelle migration prend un numéro disponible non encore utilisé, à confirmer au planning).
- **Setup grammY 1.43 publication-only** : `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL_ID` en `.env` (jamais en code/DB), client minimal (envoi de message uniquement).
- **Lecture du win rate** : via la vue `pattern_stats` (agrégats, jamais `prediction_outcomes` par-setup) ; côté job = lecture service_role/anon des agrégats permanents (all-time). Décider quelle dimension/bucket = le « win rate permanent » global.
- **Sélection des trades clos** : requête sur `prediction_outcomes` + `trade_setups` (résultat, `realized_r`, fenêtre temporelle), via repo/lecture service_role hors requête user.
- **Format exact du message** (Markdown/HTML Telegram, emoji ✅/❌, séparateur FR/AR, gestion RTL arabe), gestion d'erreur/rate-limit Telegram, retry/backoff.
- **Heure UTC exacte du récap** et expression cron de la cadence horaire (scheduling Claude Code crons / Windows Task Scheduler).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Périmètre & exigences de la phase
- `.planning/ROADMAP.md` §"Phase 6: Canal Telegram public" — Goal + Success Criteria (job grammY publication-only, win rate permanent, idempotence `telegram_posts` + traçabilité `job_runs`).
- `.planning/REQUIREMENTS.md` — TG-01, TG-02, TG-03 (Wave 3) et LEGAL-01 (disclaimer sur posts Telegram).
- `.planning/phases/05-track-record-mesure/05-CONTEXT.md` — D-01 (outcome binaire TP1-avant-SL, `realized_r` jusqu'à TP1, **pas de TP partiels** = fonde le déféré TP2), D-03 (outcomes sur bougies H1), D-09 (seuil 30 « échantillon insuffisant »), D-10/D-11 (win rate + all-time).

### Source du win rate & des résultats (Phase 5, à réutiliser tel quel)
- `apps/web/src/lib/track-record/patternStats.ts` — lecture des agrégats de la vue `pattern_stats` (forme `PatternStatRow` : `n`, `win_rate`, `avg_r`, `expectancy`). Le job lira le win rate permanent de la même source.
- `apps/web/src/lib/track-record/threshold.ts` — `applyThreshold` / `MIN_SAMPLE=30` ; **N toujours exposé** (réutiliser cette logique, ne pas réinventer le seuil).
- `packages/core/src/replay/outcome.ts` — `replayOutcome` (résultat hit_tp/hit_sl/flat + `realized_r`) = la sémantique exacte du « résultat » publié.
- `packages/supabase/src/repositories/predictionOutcomes.ts` — repo des outcomes par setup (lecture des trades clos pour le récap/notable).
- `packages/core/src/time/constants.ts` — constantes anti look-ahead (aligner la fenêtre 24h et l'heure du récap).

### Patterns job (miroirs à suivre)
- `apps/jobs/src/jobs/subscription-expiry.ts` — squelette `getServiceClient` lazy + retour `Json` stats (miroir direct pour un job idempotent service_role).
- `apps/jobs/src/jobs/outcome-tracker.ts` — job idempotent par `setup_id`, dispatch, `job_runs` (le job Telegram s'exécute APRÈS lui).
- `apps/jobs/src/jobs/runJob.ts` — wrapper de traçabilité `job_runs` (TG-03).
- `apps/jobs/src/jobs/dispatch.ts` — point d'entrée d'enregistrement des jobs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`pattern_stats` (vue, migration 0014)** + `patternStats.ts` + `threshold.ts` : source unique du win rate permanent et du gating N≥30 — réutilisés tels quels par le job (cohérence vitrine ↔ Telegram garantie).
- **`replayOutcome` / `prediction_outcomes`** : fournissent résultat + `realized_r` par setup → alimentent récap, sélection des notables (≥2R) et statut TP1/SL/flat.
- **`runJob` + `job_runs`** : traçabilité TG-03 sans rien réécrire.
- **`getServiceClient` lazy** (subscription-expiry / outcome-tracker) : modèle de client service_role hors requête user à copier.

### Established Patterns
- **Frontière producteur-unique** : le job lit les agrégats (`pattern_stats`) et les outcomes via service_role/anon côté jobs ; il n'expose jamais `prediction_outcomes` par-setup publiquement (mais le canal Telegram EST public — d'où D-03 : champs limités, pas de niveaux).
- **Idempotence par contrainte DB** (cf. `UNIQUE(tx_hash)` P4, `onConflict ignoreDuplicates` outcome-tracker) : modèle à appliquer à `telegram_posts` (TG-03).
- **Secrets en `.env` jobs uniquement** (`apps/jobs/.env`), jamais en code/DB.
- **Jobs ESM/tsx, scheduling Claude crons + Windows Task Scheduler** (`.cmd` ASCII/CRLF si backup déterministe).

### Integration Points
- Nouveau job dans `apps/jobs/src/jobs/` + enregistrement dans `dispatch.ts`.
- Nouvelle table `telegram_posts` (nouvelle migration via MCP `apply_migration`, checkpoint [BLOCKING] habituel) + repo dans `packages/supabase`.
- Nouvelle dépendance `grammy 1.43` (publication-only) → vetting supply-chain au planning (gate habituel avant `pnpm add`).
- Lecture du win rate permanent = même vue `pattern_stats` que la vitrine P5.

</code_context>

<specifics>
## Specific Ideas

- « On ne reste pas sur un rythme statique » — le fondateur veut un canal **vivant** qui mélange récaps, coups d'éclat (gros R) et points d'étape, pas un format unique répété mécaniquement.
- Marché cœur ciblé par le canal = **MENA francophone + arabophone** (FR + AR), d'où le post bilingue dans un seul canal.
- Fidélité au principe cœur « jamais gonflé » réaffirmée : sous 30 trades on dit « échantillon insuffisant », on ne masque pas et on n'invente pas (D-11) ; TP2 non mesuré n'est pas publié comme s'il l'était (D-02).

</specifics>

<deferred>
## Deferred Ideas

- **Tracking de TP2 / simulation des TP partiels** — permettrait un critère « notable » plus riche et des résultats plus détaillés, mais touche le **moteur d'outcomes (Phase 5)**, pas le job Telegram. Capacité nouvelle → tâche/phase dédiée.
- **Canaux multiples par langue (dont version anglaise)** — portée internationale élargie ; reporté après le MVP mono-canal bilingue.
- **Interaction / commandes du bot** (ex. `/winrate` à la demande) — le bot P6 est strictement publication-only.
- **Lien d'acquisition / CTA vers la plateforme dans les posts, analytics Telegram** — non discuté, hors périmètre TG-01/02/03 ; à envisager plus tard.

None bloquant : la discussion est restée dans le périmètre de la phase.

</deferred>

---

*Phase: 6-canal-telegram-public*
*Context gathered: 2026-06-16*
