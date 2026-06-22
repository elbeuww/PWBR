# Roadmap — Plateforme d'Analyse de Trading "Vétéran"

## Milestones

- ✅ **v1.0 — Moteur analytique déterministe** — Phases 1-4 (livré 2026-06-14, archivé `.planning/archive/v1.0-moteur-analytique/`)
- ✅ **v2.0 — MVP plateforme publique (MENA, trilingue)** — Phases 1-9 (livré 2026-06-20)
- ⏸️ **v2.1 — Mise en vie : identité NEXA, moteur live & track record** — Phases 10-14 (EN PAUSE — phases 10-11 livrées ; 12-14 reportées, dépendent des données réelles)
- 🚧 **v3.0 — Plateforme complète sous identité dark néon NEXA** — Phases 15-21 (en cours, démarré 2026-06-22 — sur données seedées)

## Phases

<details>
<summary>✅ v2.0 MVP plateforme publique (Phases 1-9) — SHIPPED 2026-06-20</summary>

- [x] Phase 1 : Socle transverse — i18n/RTL & rôles/gating (4/4 plans) — completed 2026-06-14
- [x] Phase 2 : Vitrine publique trilingue & gate légal (3/3 plans) — completed 2026-06-16
- [x] Phase 3 : Espace membre signaux (gated RLS) (3/3 plans) — completed 2026-06-16
- [x] Phase 4 : Paiement USDT MVP & abonnement — JALON ENCAISSEMENT (6/6 plans) — completed 2026-06-17
- [x] Phase 5 : Track record mesuré & % affiché (3/3 plans) — completed 2026-06-17
- [x] Phase 6 : Canal Telegram public (3/3 plans) — completed 2026-06-18
- [x] Phase 7 : Affiliation à paliers (6/6 plans) — completed 2026-06-18
- [x] Phase 8 : Superadmin consolidé (signaux, santé, affiliés) (4/4 plans) — completed 2026-06-19
- [x] Phase 9 : CMS cours & articles vulgarisés (5/5 plans) — completed 2026-06-20

Détail complet archivé : `.planning/milestones/v2.0-ROADMAP.md`.

</details>

### v2.1 — Mise en vie (Phases 10-14) ⏸️ EN PAUSE (12-14 reportées)

- [x] **Phase 10: Fondation design system NEXA** — Tokens OKLCH en couches + 5 polices self-hostées + thème no-flash RTL-safe (axe design, fondation). (completed 2026-06-21)
- [x] **Phase 11: Composants NEXA, reskin transversal & rebranding** — Bibliothèque tokenisée + reskin de toutes les surfaces + MERA→NEXA + hero animé, sans promesse de gain. (completed 2026-06-21)
- [ ] **Phase 12: Routines d'analyse Claude planifiées (sans API)** ⏸️ — Environment + fenêtres Remote day/swing + 1 run réel snapshot→analyze→persist, monitoré. (REPORTÉE — dépend des données réelles)
- [ ] **Phase 13: Backtest du catalogue de patterns (source-discrimination + moteur)** ⏸️ — Migration `source` AVANT seed + catalogue figé + `packages/backtest` réutilisant `replayOutcome` + Wilson golden-testé. (REPORTÉE)
- [ ] **Phase 14: Track record affiché & boucle outcomes en prod** ⏸️ — Provenance backtest/réel + N visible + bascule N≥30 + outcome-tracker en prod. (REPORTÉE)

### v3.0 — Plateforme complète sous identité dark néon NEXA (Phases 15-21)

- [ ] **Phase 15: Design system v3 « dark néon unique »** — Promotion de la couche sémantique `.nxl` (landing) en DS global dark unique, `forcedTheme="dark"`, retrait du toggle clair, décision green vs volt, contraste WCAG AA, no-FOUC + RTL préservés. (THEME)
- [ ] **Phase 16: Reskin transversal de toutes les pages** — Vitrine, légal, auth, compte/abonnement, espace membre signaux/détail+chart, paiement/funnel, Académie, admin repeints sur le DS v3, RLS/i18n/disclaimers/no-perf-claims/no-mera-brand préservés. (RESKIN)
- [ ] **Phase 17: Fondation DB scalable (perf avant charge)** — Migration `0017` : wrap RLS `(select …)` + index sur colonnes de policy, index composites keyset alignés `ORDER BY`, infra matviews KPIs (unique index + wrapper `is_superadmin()`), Broadcast vs `postgres_changes`, migrations non bloquantes `CONCURRENTLY`. (SCALE perf)
- [ ] **Phase 18: Seed de données réalistes à l'échelle** — `seed.ts` faker déterministe, idempotent, FK-cohérent (~10k users + signaux/paiements/affiliés/outcomes), labels `backtest`/`démo` (aucun chiffre de perf fabriqué), RLS re-testée depuis client anon. (SEED)
- [ ] **Phase 19: Dashboard utilisateur** — Groupe `(dash)` : vue d'ensemble, signaux suivis/historique keyset, watchlist `user_followed_setups` (revue IDOR), abonnement + ExpiryBanner, affiliation intégrée, paramètres — démontrable sur données seedées. (UDASH)
- [ ] **Phase 20: Dashboard superadmin (cockpit 4 axes)** — Acquisition/Revenus(MRR mesuré)/Ops/Conformité, tables virtualisées filtrables/paginées, gating `is_superadmin()` (404 discret), matviews phase 17, jamais service_role côté pages. (ADASH)
- [ ] **Phase 21: Tests E2E + audit de scalabilité** — Playwright des flux principaux + isolation RLS/gating prouvée, audit DB `EXPLAIN ANALYZE` + `get_advisors` + `pg_stat_statements` sur les requêtes clés à ~10k (validation keyset/index/matviews). (E2E + SCALE-06)

## Phase Details

### Phase 10: Fondation design system NEXA
**Goal** : Poser le socle de design tokenisé (couleurs OKLCH NEXA, polices, thèmes) sur lequel tout le reskin s'appuiera, avec garantie no-flash et RTL préservé — jamais à retrofitter.
**Depends on** : v2.0 livré (globals.css, ThemeToggle, i18n/RTL, fonts.ts existants).
**Requirements** : DESIGN-01, DESIGN-02, DESIGN-03, DESIGN-04
**Success Criteria** (what must be TRUE) :
  1. Au rechargement d'une page, le thème stocké (clair/sombre × marque) s'affiche sans aucun flash visible, dans les locales fr/en/ar.
  2. Les textes et accents rendent les couleurs de la palette NEXA (cyber green / royal purple) via des tokens OKLCH en couches (primitive→semantic→component) lus depuis `globals.css`.
  3. Les 5 familles de polices (Archivo, Chakra Petch, Space Grotesk, JetBrains Mono, Noto Sans Arabic) sont servies en self-host (aucun appel CDN au runtime) et exposées en CSS vars.
  4. En arabe, la mise en page reste correctement miroir (propriétés logiques uniquement) sur les surfaces touchées par la fondation.
**Plans** : 3 plans (3 vagues : 10-01 gate les tests Wave-0, 10-02 polices, 10-03 tokens)
- [x] 10-01-PLAN.md — Wave-0 : 5 tests de validation (design-tokens/fonts/rtl-logical + no-cdn/no-flash) + résolution du CONFIG GAP Vitest (DESIGN-01..04)
- [x] 10-02-PLAN.md — Migration polices : 5 familles NEXA self-hostées via next/font/local, suppression Inter + IBM Plex (DESIGN-02)
- [x] 10-03-PLAN.md — Migration tokens : globals.css en 3 couches OKLCH NEXA (primitive→semantic→component), repointage polices, RTL/no-flash préservés (DESIGN-01/03/04)
**UI hint** : yes
**Notes** : Axe design (parallélisable contre Phases 12-13). Adresse Pitfalls P8 (RTL) et P13 (FOUC) en fondation. Aucune nouvelle dépendance runtime (CSS + `next/font/local`). Décision figée : Noto Sans Arabic REMPLACE IBM Plex Sans Arabic (D-01).

### Phase 11: Composants NEXA, reskin transversal & rebranding
**Goal** : Donner à toute la plateforme son identité NEXA via une bibliothèque de composants tokenisée, reskiner chaque route group, et achever le rebranding MERA→NEXA — sans réintroduire la moindre promesse de gain.
**Depends on** : Phase 10 (tokens + polices + thèmes posés).
**Requirements** : DESIGN-05, BRAND-01, BRAND-02, BRAND-03, BRAND-04, UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07
**Success Criteria** (what must be TRUE) :
  1. La vitrine publique, l'espace membre (liste + détail trade + chart), l'Académie, l'auth/compte et l'admin sont tous au design NEXA, trilingues AR-RTL/EN/FR, le gating RLS et le `<Disclaimer />` préservés sur chaque page.
  2. La marque affichée partout est « NEXA » (mark + wordmark + favicon + OG + logo header/footer) ; plus aucune trace de « MERA » / « Make Everybody Rich Again » dans le code ou le contenu.
  3. Le hero animé complet (globe + cartes flottantes + data-rain + tilt/parallaxe) est livré et respecte `prefers-reduced-motion`, sans pourcentage nu ni promesse de gain.
  4. Le test `no-perf-claims` couvre les composants NEXA (hero, marquee, gauges) : aucun composant reskiné ne rend de % non mesuré ni de baseline de gain.
  5. L'`ExpiryBanner` (alerte J-3/J-1) est câblé et visible dans l'espace membre/compte (dette WIRING-01/PAY-05 levée au passage).
**Plans** : 8 plans (6 vagues)
- [x] 11-01-PLAN.md — Tokens-résidus : purple accent + amber risque en 3 couches (DESIGN-05)
- [x] 11-02-PLAN.md — Wave-0 garde-fous : no-perf-claims composant + no-mera-brand + rtl-scan étendu (BRAND-04/BRAND-01/DESIGN-04)
- [x] 11-03-PLAN.md — Recoloration résiduelle : CandleChart (lwc) + SignalCard + ExpiryBanner tokenisé (UI-03/UI-07)
- [x] 11-04-PLAN.md — Bibliothèque NEXA : Eyebrow, ScoreRing, Marquee, ConfidenceStat, Logo (DESIGN-05/BRAND-03)
- [x] 11-05-PLAN.md — Rebranding + assets : Logo header/footer + metadata/OG/icon + MERA→NEXA + baseline (BRAND-01/02/03)
- [x] 11-06-PLAN.md — Reskin membre : liste + détail trade + ScoreRing, RLS préservé (UI-03)
- [x] 11-07-PLAN.md — Hero animé CSS/vanilla TS : globe + cartes + data-rain + tilt, reduced-motion (UI-02)
- [x] 11-08-PLAN.md — Reskin transversal (vitrine/académie/auth/compte/admin) + ExpiryBanner abonnement + gate E2E (UI-01/04/05/06/07)
**UI hint** : yes
**Notes** : Axe design (parallélisable contre Phases 12-13). Adresse Pitfall P7 (promesse de gain visuelle). Reskin = swap de tokens + nouveaux primitifs NEXA, jamais migration du fetch RLS vers le client (Anti-Pattern 3). CandleChart recoloré via l'API JS lwc (Anti-Pattern 5). Conserver `data-testid`/rôles ARIA des spec files E2E. **Divergence ROADMAP « 6 spec files » tranchée : 5 specs existent (i18n, affiliation-attribution, gating, auth, academie) — la note « 6 » est une coquille ; les 5 sont préservés, aucune 6e créée (plan 11-08).**

### Phase 12: Routines d'analyse Claude planifiées (sans API) ⏸️ REPORTÉE
**Goal** : Activer le moteur en production via des routines Claude Code Remote planifiées (day + swing) qui produisent de vrais setups par `snapshot → analyze → persist`, sans clé API, idempotentes et monitorées — levant la dette v1.0 P4.
**Depends on** : Cœur v1.0 (combine-engine, persist.ts, sessions.ts) — indépendant des Phases 10-11.
**Requirements** : ROUTINE-01, ROUTINE-02, ROUTINE-03, ROUTINE-04, ROUTINE-05
**Success Criteria** (what must be TRUE) :
  1. Un Environment Claude Code injecte `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` et l'accès réseau `*.supabase.co` est confirmé depuis le runtime Remote.
  2. Des routines planifiées couvrent les fenêtres day (ouverture de session + clôture H1/H4) et swing (pré-clôture daily), alignées sur `apps/jobs/config/sessions.ts`.
  3. Un run réel de bout en bout produit ≥1 setup persisté via `persist.ts` (frontière de confiance intacte : Zod + guardrails + score recalculé en code, jamais le score de l'agent).
  4. Les runs sont idempotents, tracés dans `job_runs`, avec le flag `stale` visible sur `/admin/sante`, en restant sous le budget de quota (~15 runs/j partagé).
  5. Tout accès DB des jobs passe par `supabase-js` (jamais le MCP cloud) et aucune clé API Anthropic n'est utilisée.
**Plans** : 6 plans (4 vagues)
- [x] 12-01-PLAN.md — Wave-0 : tests validation (persist true-empty/all-rejected, idempotence run-level, static-check no-MCP) (ROUTINE-03/04/05)
- [x] 12-02-PLAN.md — Runbook : corriger docs/routines-claude.md (réseau Custom *.supabase.co obligatoire, single-run, P-SECRET/P-MCP, RUN_ID) + vérif .gitignore (ROUTINE-01/02/05)
- [x] 12-03-PLAN.md — Environment Custom + secrets + allowlist *.supabase.co + run de fumée egress (gate ROUTINE-01) (ROUTINE-01/05)
- [x] 12-04-PLAN.md — Revue fondateur du prompt vétéran avant go-live (D-12-08) (ROUTINE-03)
- [ ] 12-05-PLAN.md — Routines newyork + eod-swing + 1 run réel ≥1 setup persisté (D-43) + monitoring/idempotence (ROUTINE-02/03/04)
- [ ] 12-06-PLAN.md — Élargissement asia + london après validation du minimal (D-12-01) (ROUTINE-02/04)
**Notes** : Axe routine. **REPORTÉE en v3.0** (dépend des données réelles). Config-first : Environments + schedules vivent HORS git (dashboard). Pas de job `analyze.ts` (Anti-Pattern 1) — ANALYZE reste agent-native ; `persist.ts` demeure la seule frontière d'écriture IA. Research flag : valider Open Question A1 (réseau `*.supabase.co` Remote) AVANT de planifier. Adresse Pitfalls P10 (hallucination), P11 (quota), P12 (MCP absent en Remote).

### Phase 13: Backtest du catalogue de patterns (source-discrimination + moteur) ⏸️ REPORTÉE
**Goal** : Mesurer un win-rate par pattern via un backtest honnête, en posant d'abord la discrimination de source (anti double-comptage) et en figeant le catalogue, puis en réutilisant `replayOutcome` pour produire un % statistiquement significatif.
**Depends on** : Cœur v1.0 (`replayOutcome`, `packages/indicators`, `pattern_stats` 0014). Migration source = prérequis dur du moteur.
**Requirements** : BACKTEST-01, BACKTEST-02, BACKTEST-03, BACKTEST-04
**Success Criteria** (what must be TRUE) :
  1. Une migration ajoute la discrimination de source (`backtest` vs `live`) — table `backtest_outcomes` + colonne/vue `pattern_stats` — AVANT tout seed ; un re-run du seed laisse N stable (pas d'accumulation).
  2. Le catalogue de patterns (patterns nommés → détecteurs de `packages/indicators`) est figé et documenté AVANT l'écriture du moteur.
  3. `packages/backtest` rejoue le catalogue sur l'historique de candles via `replayOutcome` (first-touch, anti look-ahead réutilisé tel quel) et agrège un win-rate mesuré par pattern.
  4. L'intervalle de Wilson est golden-testé ; aucun pattern sous le seuil de significativité n'est présenté comme un % mesuré.
**Plans** : TBD
**Notes** : Axe backtest. **REPORTÉE en v3.0** (dépend des données réelles). **Ordre dur** : migration source (BACKTEST-01) → catalogue figé (BACKTEST-02) → moteur (BACKTEST-03) → significativité (BACKTEST-04). Inverser corrompt `pattern_stats` (double-comptage silencieux). `packages/backtest` séparé de `packages/indicators` (préserver sa pureté). Aucune écriture dans `trade_setups`/`prediction_outcomes` (Anti-Pattern 2). Research flag : le catalogue = décision fondateur (Borhane) à figer avant le code. Adresse Pitfalls P2, P3, P5, P6.

### Phase 14: Track record affiché & boucle outcomes en prod ⏸️ REPORTÉE
**Goal** : Afficher dès J1 un % de réussite toujours mesuré, étiqueté par provenance avec son N, et faire tourner la boucle outcome-tracker en prod pour basculer progressivement du backtest vers le track record réel.
**Depends on** : Phase 12 (routine produisant des signaux réels) ET Phase 13 (backtest seedant `pattern_stats`). Surfaces d'affichage reskinées en Phase 11.
**Requirements** : TRACK-04, TRACK-05, TRACK-06
**Success Criteria** (what must be TRUE) :
  1. Chaque pourcentage affiché porte sa provenance (`backtest` ou `réel`) et son N visible — jamais un % nu (test étendu interdisant un `winRatePct` rendu sans nœud de provenance).
  2. La bascule par bucket backtest→réel s'opère quand N_réel ≥ 30 ; en dessous, le % backtest est labellisé ou « échantillon insuffisant » est affiché — sans saut numérique silencieux.
  3. Le job `outcome-tracker` tourne en prod et résout les issues réelles (hit_tp/hit_sl/flat), alimentant le track record réel.
**Plans** : TBD
**UI hint** : yes
**Notes** : **REPORTÉE en v3.0** (dépend des données réelles). Tout chemin de rendu d'un % passe par `applyThreshold` (`@app/core`, source unique). Adresse Pitfalls P1 (% sans label), P4 (N<30 affiché), P9 (bascule silencieuse). La bascule est un changement de filtre de provenance, jamais une réécriture de chiffres.

### Phase 15: Design system v3 « dark néon unique »
**Goal** : Promouvoir l'identité dark néon de la landing (`.nxl`) en design system **global et unique** — un seul thème dark, sans option claire — en migrant la couche sémantique des tokens, pour que toute la suite (reskin, dashboards) s'appuie sur une base figée jamais à retrofitter.
**Depends on** : v2.1 Phases 10-11 (tokens NEXA en couches, polices self-hostées, `.nxl` landing). Première phase v3.0.
**Requirements** : THEME-01, THEME-02, THEME-03, THEME-04, THEME-05
**Success Criteria** (what must be TRUE) :
  1. Au chargement de n'importe quelle page (fr/en/ar), la plateforme s'affiche dans un thème dark néon unique, sans flash (no-FOUC, `forcedTheme="dark"`), et aucun chemin n'expose plus de bascule vers un thème clair.
  2. Les composants UI partagés (boutons, cartes, badges, inputs, tables, dialogs, nav) rendent leurs couleurs via les tokens sémantiques promus depuis `.nxl` — un scan prouve l'absence de CSS bespoke par page et d'aucune collision d'utilitaires Tailwind (ex. `ring`/glow).
  3. Le thème néon par défaut (green ou volt — décision produit tranchée et documentée dans cette phase) est figé en `:root` pour toute la plateforme.
  4. En arabe, la mise en page reste correctement miroir (propriétés logiques uniquement) sous le thème unique, sur les surfaces touchées par la fondation.
  5. Un test de contraste prouve WCAG AA sur les surfaces dark, y compris les surfaces translucides (overlays, cartes glow).
**Plans** : 3 plans (2 vagues)
- [x] 15-01-PLAN.md — Wave-0 gardes : test contraste WCAG AA (opaque + surfaces translucides compositées) + scan bespoke/collision Tailwind, verrouillés AVANT migration (THEME-02/THEME-05)
- [x] 15-02-PLAN.md — Promotion + gel : GREEN figé en `:root`, `.dark` réconcilié aux mêmes valeurs (forced `.dark` ne flippe plus vers navy), `forcedTheme="dark"`, suppression ThemeToggle, purge namespace i18n `theme` (THEME-01/THEME-03/THEME-04)
- [ ] 15-03-PLAN.md — Tokenisation résiduelle : `ring-[#2563EB]` → `ring-ring` (LanguageSwitcher) + utilitaires palette bruts → tokens sémantiques sur 8 surfaces admin/affiliation/track-record (THEME-02)
**UI hint** : yes
**Notes** : Arête dure : DS figé AVANT tout reskin (sinon double passage). Migration = **promotion sémantique** : copier les valeurs GREEN `.nxl[data-theme="green"]` dans `:root` (D-02/D-03, jamais de copie mécanique du sélecteur `.nxl` — Pitfall #1) ; le sélecteur `.dark` **reste présent** (D-06, observé par CandleChart + sonner) mais réconcilié aux mêmes valeurs GREEN que `:root` ; suppression du **toggle** + `forcedTheme="dark"`. Primitives (couche 1) et noms shadcn (couche 3) intacts ; RTL/i18n orthogonaux non touchés (purge du seul namespace `theme`). Research flag résolu : GREEN tranché (D-01) + matrice de contraste AA translucide compositée (D-09/D-10). Parallélisme : 15-02 (globals/layout/messages) // 15-03 (LanguageSwitcher + admin/affiliation/track-record), fichiers disjoints.

### Phase 16: Reskin transversal de toutes les pages
**Goal** : Repeindre toutes les surfaces existantes de la plateforme sur le DS v3 dark néon figé, d'un seul passage, en préservant intégralement le gating RLS, l'i18n/RTL, les disclaimers et les garde-fous textuels.
**Depends on** : Phase 15 (DS v3 figé). Arête dure.
**Requirements** : RESKIN-01, RESKIN-02, RESKIN-03, RESKIN-04, RESKIN-05, RESKIN-06
**Success Criteria** (what must be TRUE) :
  1. La vitrine publique (accueil, tarifs, méthodologie, légal) est au DS dark néon, trilingue AR-RTL/EN/FR, `<Disclaimer />` et no-perf-claims préservés.
  2. L'auth (login/signup), le compte/abonnement, l'espace membre (liste signaux + détail trade + chart lightweight-charts) et les pages de paiement/funnel sont au DS dark néon, le gating RLS et l'isolation anti-IDOR inchangés (fetch RLS jamais migré vers le client).
  3. L'Académie (index + article + cours/leçon) et le back-office `/admin` sont au DS dark néon, RTL et fallback FR préservés sur l'Académie.
  4. Un scan prouve qu'aucune page ne réintroduit de % non mesuré ni de marque « MERA » (no-perf-claims + no-mera-brand verts), et que le CandleChart est recoloré via l'API JS lwc (pas de CSS bespoke).
**Plans** : TBD
**UI hint** : yes
**Notes** : Reskin = swap de tokens + primitifs du DS v3, jamais migration du fetch RLS vers le client (Anti-Pattern). CandleChart recoloré via l'API JS lwc. Conserver `data-testid`/rôles ARIA pour les specs E2E (phase 21). Patterns établis (recherche légère).

### Phase 17: Fondation DB scalable (perf avant charge)
**Goal** : Durcir la couche données pour 10k+ utilisateurs AVANT d'exposer des vues lourdes à l'échelle — corriger la dette de perf RLS, poser les index keyset, l'infra matviews KPIs et les migrations non bloquantes — par conception (pas de load-test).
**Depends on** : v2.0 (RLS `has_active_subscription()`/`is_superadmin()`, tables existantes). Indépendant du reskin (phases 15-16) ; doit précéder seed + dashboards.
**Requirements** : SCALE-01, SCALE-02, SCALE-03, SCALE-04, SCALE-05
**Success Criteria** (what must be TRUE) :
  1. Les policies RLS clés sont réécrites en wrap `(select auth.uid())` / `(select has_active_subscription())` et les colonnes de policy sont indexées ; `get_advisors` ne signale plus de policy en clair réévaluée par ligne.
  2. Des index composites alignés `ORDER BY` existent pour les listes longues (signaux, utilisateurs, paiements), prêts pour une pagination par curseur (keyset) — vérifiable par un `EXPLAIN` montrant un index scan (pas de seq scan + tri).
  3. L'infra de matviews KPIs superadmin est posée avec **unique index** (`REFRESH CONCURRENTLY` possible) et un **wrapper `is_superadmin()`** (les matviews n'ayant pas de RLS), sans aucune exposition cross-tenant.
  4. Les migrations à l'échelle sont non bloquantes (`CREATE INDEX CONCURRENTLY` hors transaction, gestion de l'état INVALID) et les flux temps réel à fort volume utilisent **Broadcast** plutôt que `postgres_changes`.
**Plans** : TBD
**Notes** : Arête dure : perf DB AVANT exposition à l'échelle (fix RLS/index = gain >100×, le plus rentable). Migration `0017`. Adresse Pitfalls #2 (perf RLS) et #4 (Realtime saturation / migration bloquante). SCALE-06 (audit chiffré) est en phase 21, une fois le seed en place. Research flag : seuils OFFSET→keyset et `postgres_changes`→Broadcast à confirmer par `EXPLAIN ANALYZE` post-seed.

### Phase 18: Seed de données réalistes à l'échelle
**Goal** : Peupler la DB de données ~10k FK-cohérentes, déterministes et idempotentes, labellisées `backtest`/`démo`, pour rendre dashboards et audit démontrables/mesurables — sans fabriquer aucun chiffre de performance.
**Depends on** : Phase 17 (RLS/index/matviews en place — re-tester la RLS à l'échelle a du sens une fois optimisée). Arête dure : seed AVANT dashboards ET audit.
**Requirements** : SEED-01, SEED-02, SEED-03
**Success Criteria** (what must be TRUE) :
  1. Un script `seed.ts` (faker `faker.seed()` déterministe, locales fr/en/ar) peuple la DB avec ~10k utilisateurs + signaux/paiements/affiliés/outcomes **FK-cohérents** ; un re-run est idempotent (N stable, pas d'accumulation).
  2. Toutes les données seedées sont labellisées (`backtest`/`démo`) et respectent « % toujours mesuré, jamais inventé » (VITR-03) : aucun chiffre de performance fabriqué — un scan/test le prouve.
  3. La RLS est re-testée **depuis un client anon** (pas service_role) sur les données seedées : non-abonné lit 0 ligne de signaux, isolation cross-user prouvée à l'échelle.
**Plans** : TBD
**Notes** : Adresse Pitfall #5 (seed non FK-cohérent / sous-dimensionné → audit faussement vert). `@faker-js/faker` en devDep, via `tsx`. Prix MRR seedé = 9 $ standard / 3 $ découverte (PROJECT.md) à confirmer pour la cohérence du MRR superadmin. Pas d'API/paiement réel.

### Phase 19: Dashboard utilisateur
**Goal** : Livrer le groupe de routes `(dash)` membre complet — vue d'ensemble, signaux suivis/historique, watchlist, abonnement, affiliation intégrée, paramètres — sur le DS v3 et données seedées, en agrégeant les surfaces déjà livrées sans les réimplémenter.
**Depends on** : Phase 16 (DS reskiné), Phase 17 (keyset/index), Phase 18 (données seedées à afficher).
**Requirements** : UDASH-01, UDASH-02, UDASH-03, UDASH-04, UDASH-05, UDASH-06
**Success Criteria** (what must be TRUE) :
  1. Le membre accède à un dashboard `(dash)` (gate `requireUser`) avec une vue d'ensemble démontrable sur données seedées : état d'abonnement, derniers signaux, raccourcis.
  2. Le membre consulte ses signaux suivis et son historique paginés par curseur (keyset), et ajoute/retire un signal de sa watchlist (`user_followed_setups`, écriture scopée à `auth.uid()`, anti-IDOR — non-propriétaire ne peut écrire 0 ligne d'autrui).
  3. Le membre gère son abonnement (statut, expiration, alerte J-3/J-1 via `ExpiryBanner`) et voit son tableau d'affiliation intégré (abonnés ramenés, revenus **mesurés** sur seed, aucun chiffre inventé).
  4. Le membre accède à ses paramètres de compte ; toutes les listes restent gated par la RLS, jamais par le gate UX seul.
**Plans** : TBD
**UI hint** : yes
**Notes** : `/dashboard` actuel = stub (liste `instruments`) → remplacer. Onglets membre = agrégation de surfaces existantes (signaux, abonnement, affiliation) — ne pas réimplémenter. Watchlist = **seule écriture front membre** du milestone (1re policy insert/delete scopée `auth.uid()` → revue IDOR). Stack : react-table/react-virtual/nuqs, keyset. Anti-feature : pas d'equity curve/P&L/ROI (chiffre non mesuré + promesse implicite, VITR-03).

### Phase 20: Dashboard superadmin (cockpit 4 axes)
**Goal** : Refondre les pages `/admin` en cockpit superadmin complet (Acquisition, Revenus, Ops, Conformité) avec tables virtualisées et KPIs mesurés sur données seedées, sous gating `is_superadmin()` strict et sans aucune fuite cross-tenant.
**Depends on** : Phase 16 (DS reskiné), Phase 17 (matviews KPIs + wrapper `is_superadmin()`), Phase 18 (données seedées). Consomme directement les matviews de la phase 17.
**Requirements** : ADASH-01, ADASH-02, ADASH-03, ADASH-04, ADASH-05, ADASH-06, ADASH-07
**Success Criteria** (what must be TRUE) :
  1. Le superadmin voit un cockpit d'acquisition (funnel inscriptions, performance affiliés) et de revenus (MRR, churn, mix de plans) — chiffres **mesurés** sur données seedées, jamais inventés (test no-perf-claims côté admin préservé).
  2. Le superadmin voit la santé opérationnelle (jobs `job_runs`, fraîcheur `v_data_freshness`, file de paiements) et l'état de conformité (gate `LEGAL_REVIEW_DONE`).
  3. Le superadmin gère les utilisateurs (table virtualisée filtrable/paginée par curseur, état d'abonnement) et les paiements/affiliés (files, payouts manuels).
  4. Toutes les pages superadmin sont gated `is_superadmin()` (404 discret pour un non-superadmin), avec un client anon + RLS — jamais de service_role côté pages, aucune fuite cross-tenant via les matviews.
**Plans** : TBD
**UI hint** : yes
**Notes** : Les 6 pages `/admin` existent en germe → enrichir + reskin, pas recréer. Adresse Pitfall #3 (fuite cross-tenant admin : route sans `is_superadmin()` en 1ʳᵉ ligne, ou matview sans wrapper). Tables virtualisées (react-virtual) pour 10k lignes. Anti-feature : pas d'édition manuelle des % ni de création/édition de signaux côté admin (casserait `persist.ts`, frontière producteur-unique).

### Phase 21: Tests E2E + audit de scalabilité
**Goal** : Valider les flux principaux par des tests E2E et prouver la tenue à l'échelle de la DB par un audit chiffré sur données seedées ~10k — une fois tout l'assemblage en place (clôture du milestone).
**Depends on** : Phases 19 et 20 (dashboards en place), Phase 18 (seed ~10k), Phase 17 (index/matviews à auditer).
**Requirements** : E2E-01, E2E-02, SCALE-06
**Success Criteria** (what must be TRUE) :
  1. Des specs Playwright couvrent les flux principaux : auth, navigation membre, dashboard utilisateur, gestion d'abonnement, gating admin.
  2. Les tests RLS/gating prouvent l'isolation : non-abonné → 0 ligne de signaux, non-superadmin → 404 discret, isolation cross-user.
  3. Un audit DB (`EXPLAIN ANALYZE` + `get_advisors` + `pg_stat_statements`) sur les requêtes clés à ~10k valide les index/keyset/matviews : index scans (pas de seq scan + tri), advisors verts, pas de policy RLS réévaluée par ligne.
**Plans** : TBD
**UI hint** : yes
**Notes** : Clôture v3.0. Pas de test de charge réel (k6/artillery hors scope) — la scalabilité = conception (phase 17) + audit chiffré (ici). Research flag : seuils chiffrés de bascule à mesurer une fois le seed en place (compute Supabase non profilé).

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Socle transverse i18n/rôles | v2.0 | 4/4 | Complete | 2026-06-14 |
| 2. Vitrine & gate légal | v2.0 | 3/3 | Complete | 2026-06-16 |
| 3. Espace membre signaux | v2.0 | 3/3 | Complete | 2026-06-16 |
| 4. Paiement USDT (encaissement) | v2.0 | 6/6 | Complete | 2026-06-17 |
| 5. Track record & % mesuré | v2.0 | 3/3 | Complete | 2026-06-17 |
| 6. Telegram public | v2.0 | 3/3 | Complete | 2026-06-18 |
| 7. Affiliation à paliers | v2.0 | 6/6 | Complete | 2026-06-18 |
| 8. Superadmin consolidé | v2.0 | 4/4 | Complete | 2026-06-19 |
| 9. CMS cours & articles | v2.0 | 5/5 | Complete | 2026-06-20 |
| 10. Fondation design system NEXA | v2.1 | 3/3 | Complete | 2026-06-21 |
| 11. Composants NEXA & reskin transversal | v2.1 | 8/8 | Complete | 2026-06-21 |
| 12. Routines d'analyse Claude (sans API) | v2.1 | 4/6 | ⏸️ Paused | - |
| 13. Backtest catalogue de patterns | v2.1 | 0/? | ⏸️ Paused | - |
| 14. Track record affiché & boucle prod | v2.1 | 0/? | ⏸️ Paused | - |
| 15. Design system v3 « dark néon unique » | v3.0 | 2/3 | In Progress|  |
| 16. Reskin transversal de toutes les pages | v3.0 | 0/? | Not started | - |
| 17. Fondation DB scalable | v3.0 | 0/? | Not started | - |
| 18. Seed de données réalistes à l'échelle | v3.0 | 0/? | Not started | - |
| 19. Dashboard utilisateur | v3.0 | 0/? | Not started | - |
| 20. Dashboard superadmin (cockpit 4 axes) | v3.0 | 0/? | Not started | - |
| 21. Tests E2E + audit de scalabilité | v3.0 | 0/? | Not started | - |

**v2.0 : 9/9 phases complètes, 37/37 plans, 41/41 requirements couverts.**
**v2.1 : 2/5 phases livrées (10-11), 12-14 en pause ; 28/28 requirements mappés.**
**v3.0 : 0/7 phases (15-21), 35/35 requirements v1 mappés (THEME 5 · RESKIN 6 · SCALE 6 · SEED 3 · UDASH 6 · ADASH 7 · E2E 2 ; SCALE-06 audité en phase 21).**

## Arêtes critiques (v3.0)

Build order strict (arêtes dures), conforme à `research/SUMMARY.md` :

1. **DS v3 figé (Phase 15) AVANT reskin (Phase 16)** — repeindre sur un DS non figé = double travail ; migrer la couche sémantique, pas un copier-coller de `.nxl`.
2. **Fondation DB scalable (Phase 17) AVANT exposition à l'échelle** — le fix RLS `(select …)` + index est le gain le plus rentable (>100×) et doit exister avant que les dashboards tapent la DB.
3. **Seed massif (Phase 18) AVANT dashboards (19-20) ET audit (21)** — sans données ~10k FK-cohérentes, ni démonstration ni mesure fiable ; seed après la fondation DB (re-tester la RLS optimisée à l'échelle).
4. **Dashboards (19-20) AVANT E2E + audit (21)** — l'audit valide l'ensemble assemblé sur données seedées.
5. **Parallélisme** : l'axe design (15-16) et l'axe DB (17-18) sont partiellement parallélisables (surfaces disjointes : CSS/composants vs RLS/migrations/seed) ; ils convergent aux dashboards (19-20).

**Garde-fous transverses préservés** : RLS stricte (jamais service_role côté pages) · % TOUJOURS mesuré jamais inventé (VITR-03, no-perf-claims) · aucune promesse de gain · i18n fr/en/ar + RTL (propriétés logiques) · no-mera-brand · données SEEDÉES uniquement (aucun branchement API/paiement/signaux réel).

## Notes de clôture v2.0

- Vérification automatisée 100 % verte (Vitest 566 ✓, typecheck 0 erreur) ; P01 + P09 live-vérifiés (E2E 32 ✓).
- Items différés à la clôture (vérifs live P02-P08, UAT P02/P03) : voir `STATE.md → Deferred Items`.
- Dette explicite hors jalon : **WIRING-01** (ExpiryBanner) traité en Phase 11 (UI-07) ; **LEGAL-02** (sign-off juriste) reste hors scope v2.1/v3.0.

---
*Roadmap v3.0 créée 2026-06-22 (7 phases, 15-21). Numérotation continue après v2.1 (phase 14). Dérivée des requirements v1 v3.0 (THEME/RESKIN/SCALE/SEED/UDASH/ADASH/E2E) sur données seedées. v2.1 phases 12-14 mises en pause (dépendent des données réelles).*
*Précédent : Roadmap v2.1 créée 2026-06-21 (5 phases, 10-14). Détail v2.0 archivé `.planning/milestones/v2.0-ROADMAP.md`.*
