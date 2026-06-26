# Requirements: NEXA — Milestone v3.0 « Plateforme complète sous identité dark néon NEXA »

**Defined:** 2026-06-22
**Core Value:** Produire, pour chaque opportunité, une analyse fiable et explicable (score /100 + risque + plan de trade), vulgarisée — avec un **% de réussite toujours mesuré, jamais inventé**. v3.0 : unifier la plateforme sous l'**identité dark néon** de la landing, livrer des **dashboards utilisateur & superadmin** complets, et la rendre **scalable à 10k+ utilisateurs** — sur **données seedées** (branchement API/paiement/signaux réel reporté).

## v1 Requirements

Requirements de ce milestone. Chacun est mappé à une phase de la roadmap (voir Traceability).

### Design system dark néon unique (THEME)

- [x] **THEME-01**: Le visiteur voit toute la plateforme dans un **thème dark néon unique** cohérent (tokens sémantiques promus depuis la landing `.nxl`), sans option de thème clair.
- [x] **THEME-02**: Les composants UI partagés (boutons, cartes, badges, inputs, tables, dialogs, nav) héritent du DS dark via les tokens sémantiques — pas de CSS bespoke par page, **aucune collision d'utilitaires Tailwind** (ex. `ring`/glow).
- [x] **THEME-03**: Le thème néon par défaut (**green ou volt** — à trancher en phase design) est figé pour toute la plateforme.
- [x] **THEME-04**: Le RTL arabe et l'absence de flash (no-FOUC, `forcedTheme="dark"`, propriétés logiques) sont préservés sous le thème unique.
- [x] **THEME-05**: Le contraste respecte **WCAG AA** sur les surfaces dark, y compris translucides.

### Reskin transversal des pages existantes (RESKIN)

- [x] **RESKIN-01**: La vitrine publique (accueil, tarifs, méthodologie, légal) est au DS dark néon, trilingue AR/EN/FR.
- [x] **RESKIN-02**: L'auth (login/signup) et l'espace compte/abonnement sont au DS dark néon.
- [x] **RESKIN-03**: L'espace membre (liste signaux + détail trade + chart lightweight-charts) est au DS dark néon, gating RLS préservé.
- [x] **RESKIN-04**: L'Académie (index + article + cours/leçon) est au DS dark néon, RTL et fallback FR préservés.
- [x] **RESKIN-05**: Le back-office `/admin` est au DS dark néon.
- [x] **RESKIN-06**: Les pages de paiement/funnel (paiement, paiement-bientot) sont au DS dark néon.

### Dashboard utilisateur (UDASH)

- [x] **UDASH-01**: Le membre accède à un dashboard `(dash)` avec une **vue d'ensemble** (état d'abonnement, derniers signaux, raccourcis).
- [x] **UDASH-02**: Le membre consulte ses **signaux suivis et son historique**, paginés (keyset).
- [ ] **UDASH-03**: Le membre **ajoute/retire un signal à sa watchlist** (`user_followed_setups`, écriture scopée à son propre compte, anti-IDOR).
- [x] **UDASH-04**: Le membre **gère son abonnement** (statut, expiration, alerte J-3/J-1 via `ExpiryBanner`).
- [x] **UDASH-05**: Le membre voit son **tableau d'affiliation** (abonnés ramenés, revenus mesurés) intégré au dashboard.
- [ ] **UDASH-06**: Le membre accède à ses **paramètres de compte**.

### Dashboard superadmin (ADASH)

- [ ] **ADASH-01**: Le superadmin voit un cockpit d'**acquisition** (funnel inscriptions, performance affiliés).
- [ ] **ADASH-02**: Le superadmin voit les **revenus** (MRR, churn, mix de plans) — chiffres **mesurés** sur données seedées, jamais inventés.
- [ ] **ADASH-03**: Le superadmin voit la **santé opérationnelle** (jobs `job_runs`, fraîcheur `v_data_freshness`, file de paiements).
- [ ] **ADASH-04**: Le superadmin **gère les utilisateurs** (table virtualisée, filtrable/paginée, état d'abonnement).
- [ ] **ADASH-05**: Le superadmin **gère les paiements et affiliés** (files, payouts manuels).
- [ ] **ADASH-06**: Le superadmin voit l'**état de conformité** (gate `LEGAL_REVIEW_DONE`).
- [ ] **ADASH-07**: Toutes les pages superadmin sont **gated `is_superadmin()`** (404 discret sinon), sans aucune fuite cross-tenant (jamais service_role côté pages).

### Robustesse & scalabilité DB (SCALE)

- [x] **SCALE-01**: Les policies RLS sont optimisées (wrap `(select …)`) et **indexées sur les colonnes de policy** (gain >100× à l'échelle).
- [x] **SCALE-02**: Les listes longues (signaux, utilisateurs, paiements) utilisent une **pagination par curseur (keyset)** avec index composites alignés `ORDER BY`.
- [x] **SCALE-03**: Les KPIs superadmin s'appuient sur des **vues matérialisées** (unique index, `REFRESH CONCURRENTLY`) gated `is_superadmin()`.
- [ ] **SCALE-04**: Les migrations à l'échelle sont **non bloquantes** (`CREATE INDEX CONCURRENTLY`, gestion de l'état INVALID).
- [x] **SCALE-05**: Les flux temps réel à fort volume utilisent **Broadcast** plutôt que `postgres_changes`.
- [ ] **SCALE-06**: Un **audit DB** (`EXPLAIN ANALYZE` + `get_advisors` + `pg_stat_statements`) valide les requêtes clés sur données seedées ~10k.

### Données seedées réalistes (SEED)

- [x] **SEED-01**: Un script de **seed idempotent** peuple la DB avec des données **FK-cohérentes** (~10k utilisateurs + signaux/paiements/affiliés/outcomes), via faker déterministe.
- [x] **SEED-02**: Les données seedées sont **labellisées** (`backtest`/`démo`) et respectent « % toujours mesuré, jamais inventé » (aucun chiffre de performance fabriqué).
- [x] **SEED-03**: La RLS est **re-testée depuis un client anon** sur les données seedées (pas service_role) — isolation prouvée à l'échelle.

### Tests fonctionnels (E2E)

- [ ] **E2E-01**: Les flux principaux (auth, navigation membre, dashboard utilisateur, abonnement, gating admin) sont couverts par des tests **Playwright**.
- [ ] **E2E-02**: Les tests RLS/gating prouvent l'**isolation** (non-abonné → 0 ligne, non-superadmin → 404, cross-user).

## Reporté de v2.1 (milestone en pause — repris à la reprise du moteur live)

> Ces requirements restent ouverts ; ils dépendent des **données réelles** (branchement API/signaux), explicitement reporté pour ce milestone. Voir `.planning/ROADMAP.md` (phases 12-14 v2.1) et `STATE.md`.

- [ ] **ROUTINE-02/03/04** (partiel) : routines Claude permanentes (newyork/eod-swing) + run réel ≥1 setup + monitoring — phase 12 v2.1.
- [ ] **BACKTEST-01..04** : migration source + catalogue figé + moteur `packages/backtest` + Wilson — phase 13 v2.1.
- [ ] **TRACK-04..06** : provenance + N visible + bascule N≥30 + `outcome-tracker` en prod — phase 14 v2.1.

## Out of Scope (v3.0)

Exclusions explicites de ce milestone, avec raison.

- **Branchement des vraies API / signaux / paiement réel** — données seedées d'abord (« on ajustera les API demain »). Reporté.
- **Moteur live (routines Claude, phase 12 v2.1)** — dépend des données réelles. En pause.
- **LEGAL-02** (sign-off juriste) — gate non-code bloquant le 1er encaissement réel, pas le build.
- **Test de charge réel (k6/artillery)** — la scalabilité de ce milestone = conception + audit DB, pas de load-test.
- **Vérifications live différées v2.0** (P02-P08 UAT, paiement on-chain testnet) — hors scope.
- **PAY-AUTO / AFF-AUTO** (automatisation paiement/payouts) — backlog.
- **Communauté sociale, exécution automatique des trades, scalping M1/M5, actions/equities** — backlog produit (inchangé).

## Traceability

> Mapping REQ-ID → phase (rempli par la roadmap 2026-06-22). Couverture 100 % : 35/35 requirements v1 mappés à exactement une phase. Numérotation des phases continue après v2.1 (phase 14) → v3.0 démarre à la phase 15.

| REQ-ID | Phase | Statut |
|--------|-------|--------|
| THEME-01 | Phase 15 — Design system v3 « dark néon unique » | Complete |
| THEME-02 | Phase 15 — Design system v3 « dark néon unique » | Complete |
| THEME-03 | Phase 15 — Design system v3 « dark néon unique » | Complete |
| THEME-04 | Phase 15 — Design system v3 « dark néon unique » | Complete |
| THEME-05 | Phase 15 — Design system v3 « dark néon unique » | Complete |
| RESKIN-01 | Phase 16 — Reskin transversal de toutes les pages | Complete |
| RESKIN-02 | Phase 16 — Reskin transversal de toutes les pages | Complete |
| RESKIN-03 | Phase 16 — Reskin transversal de toutes les pages | Complete |
| RESKIN-04 | Phase 16 — Reskin transversal de toutes les pages | Complete |
| RESKIN-05 | Phase 16 — Reskin transversal de toutes les pages | Complete |
| RESKIN-06 | Phase 16 — Reskin transversal de toutes les pages | Complete |
| SCALE-01 | Phase 17 — Fondation DB scalable | Complete |
| SCALE-02 | Phase 17 — Fondation DB scalable | Complete |
| SCALE-03 | Phase 17 — Fondation DB scalable | Complete |
| SCALE-04 | Phase 17 — Fondation DB scalable | Pending |
| SCALE-05 | Phase 17 — Fondation DB scalable | Complete |
| SEED-01 | Phase 18 — Seed de données réalistes à l'échelle | Complete |
| SEED-02 | Phase 18 — Seed de données réalistes à l'échelle | Complete |
| SEED-03 | Phase 18 — Seed de données réalistes à l'échelle | Complete |
| UDASH-01 | Phase 19 — Dashboard utilisateur | Complete |
| UDASH-02 | Phase 19 — Dashboard utilisateur | Complete |
| UDASH-03 | Phase 19 — Dashboard utilisateur | Pending |
| UDASH-04 | Phase 19 — Dashboard utilisateur | Complete |
| UDASH-05 | Phase 19 — Dashboard utilisateur | Complete |
| UDASH-06 | Phase 19 — Dashboard utilisateur | Pending |
| ADASH-01 | Phase 20 — Dashboard superadmin (cockpit 4 axes) | Pending |
| ADASH-02 | Phase 20 — Dashboard superadmin (cockpit 4 axes) | Pending |
| ADASH-03 | Phase 20 — Dashboard superadmin (cockpit 4 axes) | Pending |
| ADASH-04 | Phase 20 — Dashboard superadmin (cockpit 4 axes) | Pending |
| ADASH-05 | Phase 20 — Dashboard superadmin (cockpit 4 axes) | Pending |
| ADASH-06 | Phase 20 — Dashboard superadmin (cockpit 4 axes) | Pending |
| ADASH-07 | Phase 20 — Dashboard superadmin (cockpit 4 axes) | Pending |
| E2E-01 | Phase 21 — Tests E2E + audit de scalabilité | Pending |
| E2E-02 | Phase 21 — Tests E2E + audit de scalabilité | Pending |
| SCALE-06 | Phase 21 — Tests E2E + audit de scalabilité | Pending |

**Couverture :** 35/35 requirements v1 mappés, aucun orphelin, aucun doublon.
- THEME (5) → Phase 15 · RESKIN (6) → Phase 16 · SCALE-01..05 (5) → Phase 17 · SEED (3) → Phase 18 · UDASH (6) → Phase 19 · ADASH (7) → Phase 20 · E2E (2) + SCALE-06 (1) → Phase 21.
- **Note SCALE :** SCALE-01..05 (conception perf) en Phase 17 ; SCALE-06 (audit chiffré sur seed ~10k) en Phase 21 — l'audit exige les données seedées et les dashboards en place.
