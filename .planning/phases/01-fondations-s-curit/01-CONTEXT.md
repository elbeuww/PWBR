# Phase 1: Fondations & Sécurité - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning
**Mode:** mvp (Walking Skeleton — premier slice end-to-end d'un projet neuf)

<domain>
## Phase Boundary

Poser le socle technique du projet en une tranche verticale minimale (walking skeleton) qui PROUVE l'architecture de bout en bout :

- **Auth** : un utilisateur peut créer un compte, se connecter (Supabase Auth), sa session persiste entre rechargements (AUTH-01).
- **Sécurité RLS** : toutes les tables créées ont une RLS active ; les données de marché sont en lecture pour les authentifiés ; la clé `service_role` est isolée aux jobs et jamais exposée au frontend (AUTH-02, AUTH-03).
- **Conventions temporelles** : bougie clôturée (exclut la bougie en cours), UTC, et convention daily cross-asset codées comme constantes partagées dans `packages/core` (DATA-05).
- **Runner de jobs + monitoring** : un entrypoint de job déterministe exécutable hors agent Claude (Windows Task Scheduler), chaque exécution écrit une entrée `job_runs` (JOB-03, JOB-04).
- **Modèle d'exécution des Routines Claude** : vérifié et documenté (à investiguer en recherche — research flag).

**Hors périmètre Phase 1** (appartient à des phases ultérieures) : ingestion réelle des données (Phase 2), moteur d'indicateurs (Phase 3), analyse IA/scoring (Phase 4), dashboard (Phase 5+), journal/sizing (Phases 7-8). On crée le socle, pas les features.

</domain>

<decisions>
## Implementation Decisions

### Authentification (AUTH-01)
- **D-01:** Méthode = **email + mot de passe seul**. Pas de magic link ni OAuth en Phase 1 (réduit la surface de setup pour un usage perso/démo).
- **D-02:** Confirmation email **désactivée** au démarrage (friction inutile en solo). À réactiver avant l'ouverture communauté (v2).
- **D-03:** Auth via `@supabase/ssr 0.12.0` (cookies httpOnly, App Router/RSC) — pas `auth-helpers` (déprécié). Session persistée côté cookies serveur.

### Schéma & RLS initial (AUTH-02, walking skeleton)
- **D-04:** Périmètre schéma = **minimum walking skeleton**. Tables créées en Phase 1 : `profiles`, `job_runs`, `instruments` (table marché "seed"). Le reste du schéma d'ARCHITECTURE.md arrive phase par phase.
- **D-05:** RLS active sur **toutes** les tables créées (vérifiable via `get_advisors`). Pattern : données de marché (`instruments`) = lecture pour authentifiés ; `profiles` = chacun lit/écrit le sien (`user_id = auth.uid()`) ; `job_runs` = lecture authentifiés (écriture réservée `service_role`).
- **D-06:** Table `profiles` = champs minimaux `id` (= `auth.uid()`), `email`, `created_at`. **Trigger Postgres** sur `auth.users` insert → crée automatiquement la ligne `profiles`. Champs `capital`/`risk_percent`/`account_type` reportés en Phase 7 (RISK-03).

### Isolation service_role (AUTH-03)
- **D-07:** Le client `service_role` vit exclusivement dans `packages/supabase` (module marqué server-only) et n'est importable que par `apps/jobs`. Garde-fou = règle ESLint **`no-restricted-imports`** interdisant tout import du module service_role depuis `apps/web` (lint anti-import). Le bundle frontend n'utilise que la clé `anon`.

### Architecture du runner de jobs (JOB-03, JOB-04)
- **D-08:** Runner **agnostique dès le départ** : un entrypoint `tsx` unique dans `apps/jobs` (dispatcher), appelable indifféremment par une Routine Claude, Windows Task Scheduler (via `.cmd`), ou croner. Chaque run écrit une entrée `job_runs` (statut, timing, erreur) — JOB-04. Rend la robustesse "PC potentiellement éteint" native.

### Conventions temporelles (DATA-05)
- **D-09:** Convention daily = **natif par source**. OANDA daily aligné 17:00 NY (convention FX réelle), Binance/crypto aligné 00:00 UTC (24/7). Conservé tel quel, documenté comme constantes par source dans `packages/core`. (Pas de daily canonique unique forcé — préserve la sémantique réelle des marchés.)
- **D-10:** Stockage **UTC** systématique + convention de **bougie clôturée** (exclut la bougie en cours, anti look-ahead) codées comme constantes partagées dans `packages/core`. luxon pour la logique sessions/DST.

### Monorepo & secrets
- **D-11:** Packages créés en Phase 1 = **strict skeleton** : `apps/web`, `apps/jobs`, `packages/core` (constantes temps), `packages/supabase` (client typé + repositories + types générés). `packages/data-sources` et `packages/indicators` créés à leur phase (pas de coquilles vides).
- **D-12:** Secrets via **`.env` local + `.env.example` commité**. `.env` racine jobs contient `service_role` (non commité) ; `.env.local` web contient seulement la clé `anon`. `.env.example` commité = contrat. Task Scheduler/croner lisent le `.env` via tsx ; la Routine Claude injecte les secrets via son env cloud. Pas de secret manager externe en Phase 1.

### Stratégie de tests (Phase 1)
- **D-13:** Tests **ciblés socle critique**, pas de cible 80% imposée sur le scaffolding : (1) golden-values Vitest sur les constantes temps (`packages/core`), (2) test d'intégration RLS prouvant qu'un user ne lit pas le `profiles`/`job_runs` d'un autre, (3) 1 E2E Playwright auth (signup → login → session persiste). L'infra de test est posée ici, la cible 80% s'applique au code métier testable des phases suivantes.

### Claude's Discretion
- Structure interne exacte des packages (arborescence fichiers, noms de modules).
- Forme précise des constantes temporelles (enums, objets de config par source) dans `packages/core`.
- Détails de la config ESLint `no-restricted-imports` (patterns de chemins).
- Choix du déclencheur Task Scheduler (`.cmd` wrapper) et structure du dispatcher de jobs.
- Schéma SQL précis des 3 tables (types de colonnes, index) dans le respect des décisions ci-dessus.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & schéma
- `ARCHITECTURE.md` (racine) — architecture détaillée : flux de données, schéma Supabase complet, moteur de scoring, JSON de sortie, cron des routines, boucle d'apprentissage, stack verrouillée. **Source de vérité du schéma** — les 3 tables de Phase 1 doivent en être un sous-ensemble cohérent.
- `.planning/research/ARCHITECTURE.md` — synthèse architecture issue de la recherche projet.

### Stack & contraintes
- `CLAUDE.md` (racine) — stack verrouillée (versions exactes : Next.js 15, `@supabase/ssr 0.12.0`, `@supabase/supabase-js 2.108.0`, Zod 4, luxon, pnpm, Vitest, Playwright), conventions, "What NOT to Use".
- `.planning/PROJECT.md` — contraintes projet (sécurité démo/testnet, service_role réservé aux jobs, RLS stricte, robustesse routines PC-éteint).
- `.planning/REQUIREMENTS.md` — exigences AUTH-01/02/03, DATA-05, JOB-03, JOB-04 (texte complet).
- `.planning/ROADMAP.md` §Phase 1 — goal et success criteria de la phase.

### Recherche à mener (research flag)
- Doc officielle des **Routines / scheduled agents Claude Code** — modèle d'exécution réel (cloud, quota ~15 runs/j Max, injection des secrets via env de routine, MCP cloud-hosted). Dépendance externe la plus incertaine (confidence MEDIUM). À documenter avant tout code d'analyse.
- Docs Supabase : `@supabase/ssr` (auth cookies App Router), `supabase gen types typescript`, RLS policies, trigger `on auth.users`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Aucun code applicatif existant — projet greenfield. Seuls les docs de planification (`.planning/`) et la config projet existent.

### Established Patterns
- MCP Supabase déjà connecté (utilisable pour `apply_migration`, `list_tables`, `get_advisors`, `generate_typescript_types`).
- Stack et versions figées dans `CLAUDE.md` — ne pas dévier (ex. rester sur Next 15, pas 16 ; `@supabase/ssr` pas `auth-helpers`).

### Integration Points
- `packages/supabase` = unique frontière producteur (jobs, service_role) / consommateur (web, anon). C'est là que vivent client typé + repositories + types générés.
- `packages/core` = constantes partagées (temps/sessions) consommées par jobs et futures phases (indicateurs, moteur).

</code_context>

<specifics>
## Specific Ideas

- Le walking skeleton doit prouver la chaîne complète : `signup → login → session persistée → lecture d'une ligne d'une table protégée (instruments seed) affichée dans l'UI → un job déterministe écrit une entrée job_runs`. C'est le critère de "socle qui tient debout".
- Déploiement Phase 1 = dev local (`next dev`) contre le projet Supabase cloud existant (MCP connecté). Vercel/CI reportés (voir Deferred).

</specifics>

<deferred>
## Deferred Ideas

- **Confirmation email + magic link / OAuth Google** — réactiver/ajouter avant l'ouverture communauté (v2).
- **Secret manager externe (Doppler/1Password CLI)** — envisageable si l'équipe grandit ; surdimensionné pour usage solo en Phase 1.
- **Déploiement Vercel + CI GitHub Actions (lint/typecheck/Vitest sur PR)** — à poser quand le code métier justifie une CI ; hors socle minimal.
- **Champs profil étendus (capital, risk_percent, account_type demo/live)** — Phase 7 (RISK-03).
- **Reste du schéma Supabase** (candles, news, macro, analyses, trade_setups, journal) — créés à leur phase respective (2, 3, 4, 8).
- **Cible de couverture 80% sur tout le code** — s'applique au code métier testable des phases suivantes, pas au scaffolding d'infra.

</deferred>

---

*Phase: 01-fondations-s-curit*
*Context gathered: 2026-06-09*
