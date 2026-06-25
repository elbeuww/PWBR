# Phase 18: Seed de données réalistes à l'échelle - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Peupler la DB de ~10k données **FK-cohérentes, déterministes, idempotentes et labellisées** (`backtest`/`démo`) pour rendre les dashboards (Phases 19-20) et l'audit de scalabilité (Phase 21) démontrables et mesurables — **sans fabriquer aucun chiffre de performance** (VITR-03). Script `seed.ts` via `@faker-js/faker` (devDep) exécuté en `tsx`, `faker.seed()` déterministe, locales fr/en/ar.

Couvre SEED-01 (seed idempotent FK-cohérent ~10k via faker déterministe), SEED-02 (labellisation + zéro % fabriqué), SEED-03 (re-test RLS depuis client anon à l'échelle).

Arête dure : seed **AVANT** dashboards (P19-20) ET audit (P21). Dépend de Phase 17 (RLS/index/matviews en place).

**Hors périmètre (cadré ailleurs) :**
- Audit chiffré `EXPLAIN ANALYZE` / `get_advisors` / `pg_stat_statements` à ~10k = **SCALE-06 → Phase 21**.
- E2E Playwright complet des flux + isolation RLS prouvée par parcours navigateur = **Phase 21** (ici : preuve RLS ciblée par test d'intégration).
- Moteur de backtest réel (`packages/backtest`, `replayOutcome`, win-rate par pattern, Wilson) = **Phase 13** (reportée). Le seed produit des outcomes bruts, pas un moteur de backtest.
- Branchement des vraies API / signaux / paiement réel = reporté (données seedées d'abord).

</domain>

<decisions>
## Implementation Decisions

### Labellisation des données seedées (SEED-02)
- **D-01:** Ajouter une **mini-migration `0018`** introduisant une colonne `source` (valeurs `demo`/`backtest` vs `live`) sur les tables seedées concernées (au minimum `trade_setups`, `prediction_outcomes`, et la dimension utilisateur/`profiles` — périmètre exact des tables à colonner = researcher). Avance le **strict minimum** de la discrimination de source de Phase 13 (reportée) sans tirer son moteur de backtest. Rationale : SEED-02 est un critère de succès dur qu'un **scan/test doit prouver** → une colonne explicite est requêtable et testable, contrairement à une convention implicite. Future-proof pour le vrai branchement (`source='live'`).
  - Écarté : cohorte démo conventionnelle sans schéma (fragile à prouver/nettoyer) ; avancer **toute** la source-discrimination P13 (hors périmètre P18).

### Non-fabrication des chiffres de performance (SEED-02 / VITR-03)
- **D-02:** Seeder **uniquement des outcomes bruts** (win/loss/timeout + R multiple par trade) de façon déterministe ; **aucun win-rate / % stocké en dur**. Tous les % (`pattern_stats`, track record, calibration) restent **calculés** par la DB/le code à partir des outcomes bruts. Respecte littéralement VITR-03 : un test/scan `no-perf-claims` ne doit trouver aucun % de performance fabriqué.

### Forme de la population & MRR (SEED-01, ADASH-02)
- **D-03:** Distribution **orientée démo** : davantage d'abonnés actifs (~35-40% payants actifs) pour des dashboards visuellement remplis et démonstratifs (ratios exacts = researcher). **Important :** le MRR reste **mesuré** (compté sur les abonnements/paiements seedés réels), jamais inventé — VITR-03 ne concerne que les % de performance, pas les comptes de population. Churn/expiration doivent rester visibles pour que les KPIs (mix de plans, churn) aient du sens.
- **D-04:** Pricing seedé confirmé = **9 $/mois standard + 3 $/15j découverte** (USDT), conforme à PROJECT.md et à la vitrine déjà livrée. Base du MRR superadmin.
- **D-05:** Seeder une **cohorte d'affiliés avec commissions** (jusqu'à 20 % récurrent), FK-cohérentes avec les paiements/abonnements, pour rendre le dashboard affilié (P19) et le mix superadmin (P20) démontrables — sinon ces vues sont vides.

### Idempotence / re-run (SEED-01)
- **D-06:** Mécanique = **truncate de la cohorte démo + reseed**. En début de script : supprimer toutes les lignes `WHERE source='demo'` (dans l'**ordre FK inverse**), puis réinsérer depuis `faker.seed()` déterministe. Garantit N stable (pas d'accumulation) et ne touche **jamais** d'éventuelles données `source='live'`. La colonne `source` (D-01) rend le ciblage du nettoyage sûr et explicite.
  - Écarté : upsert sur IDs déterministes (plus complexe sur les graphes FK + lignes orphelines si le volume change entre runs).

### Preuve d'isolation RLS à l'échelle (SEED-03)
- **D-07:** Forme de la preuve = **test d'intégration Vitest avec le client Supabase ANON** (clé publique, jamais service_role). Asserte au minimum : un non-abonné lit **0 ligne** de signaux ; un user A ne voit pas les données d'un user B (isolation cross-user) sur les données seedées à l'échelle. Ciblé sur SEED-03, complémentaire (non redondant) avec l'E2E Playwright de Phase 21.

### Claude's Discretion
- Périmètre exact des tables recevant la colonne `source` (au-delà du minimum trade_setups/prediction_outcomes/profiles), ordre précis des colonnes/FK du nettoyage, ratios numériques exacts de la distribution démo, volumes de candles/snapshots/`telegram_posts`/`job_runs` à seeder, fenêtre temporelle des paiements pour matérialiser le churn, répartition des locales fr/en/ar et noms MENA → laissés au researcher/planner tant que les FK restent cohérentes et la labellisation prouvable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Périmètre & critères de succès
- `.planning/ROADMAP.md` §"Phase 18" — Goal, Success Criteria 1-3, Notes (Pitfall #5, faker devDep via tsx, pricing 9$/3$ à confirmer → confirmé D-04).
- `.planning/REQUIREMENTS.md` — SEED-01/02/03 (libellés verrouillés), VITR-03 (% toujours mesuré jamais inventé), ADASH-02 (MRR mesuré sur seed), SCALE-06 (audit → Phase 21).
- `.planning/PROJECT.md` — pricing officiel (9$/mois standard, 3$/15j découverte, USDT TRC-20), palier affiliation max 20% récurrent.

### Risques techniques (recherche)
- `.planning/research/PITFALLS.md` §"Pitfall #5" — seed non FK-cohérent / sous-dimensionné → audit faussement vert (sous-tend SEED-01 + D-06).
- `.planning/research/ARCHITECTURE.md` — décisions d'architecture DB/Supabase v3.0.

### Schéma & RLS existants (à lire avant de seeder / colonner)
- `supabase/migrations/0006_analyses_trade_setups.sql` — `analyses` / `trade_setups` (cible colonne `source` D-01 + cœur du seed signaux).
- `supabase/migrations/0014_prediction_outcomes_pattern_stats.sql` — `prediction_outcomes` + vue `pattern_stats` (outcomes bruts D-02 ; cible colonne `source` D-01) — **note : pas de colonne source aujourd'hui**.
- `supabase/migrations/0012_payments.sql` — `payments` (source MRR, D-03/D-04).
- `supabase/migrations/0009_subscriptions_gating.sql` + `0010_has_active_subscription_null_expiry.sql` — `subscriptions` + `has_active_subscription()` (MRR/churn + RLS à re-tester D-07).
- `supabase/migrations/0008_profiles_role.sql` — `profiles.role` + `is_superadmin()` (cohorte users, rôles).
- `supabase/migrations/0016_affiliation.sql` — tables d'affiliation (cohorte affiliés + commissions D-05).
- `supabase/migrations/0003_data_ingestion_tables.sql` — `instruments` / `candles` (FK des signaux ; `source_symbol` ≠ la colonne `source` de D-01).
- `supabase/migrations/0017_scalable_foundation.sql` — index keyset + matview MRR + wrappers `(select …)` à alimenter de façon réaliste.

### Contexte phase antérieure
- `.planning/phases/17-fondation-db-scalable-perf-avant-charge/17-CONTEXT.md` — matview MRR (dépend payments/subscriptions), index keyset, Broadcast ; arête « seed après P17 ».

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Migrations SQL versionnées = source de vérité unique (pas d'ORM). Dernière appliquée : `0017` → la migration de cette phase est **`0018`**.
- Client Supabase typé (`packages/supabase/database.types.ts`) + repositories typés : à régénérer (`generate_typescript_types`) après la migration `0018` ajoutant `source`.
- Fonctions SQL `has_active_subscription()` / `is_superadmin()` (0008-0010) : réutilisées pour valider MRR/gating et le test RLS D-07.
- Pattern « migration LIVE via MCP Supabase + gen-types + get_advisors » rodé sur 0011/0012/0014/0017.

### Established Patterns
- RLS stricte : fetch RLS jamais migré vers le client ; **service_role réservé aux jobs**, jamais côté pages. Le test RLS D-07 doit utiliser le client **anon**.
- Frontière producteur-unique `persist.ts` pour l'écriture IA — le seed écrit hors de cette frontière (devDep/tsx, données démo), ne pas la perturber.
- Vitest = framework de test du projet (cible 80%) ; `@faker-js/faker` à ajouter en **devDep**, exécution `tsx`.

### Integration Points
- Données seedées consommées par les listes keyset des dashboards (P19/20) et la matview MRR / KPIs superadmin (P20).
- Audit de scalabilité P21 (SCALE-06) consomme directement le volume ~10k produit ici.
- La colonne `source` (D-01) est le point d'ancrage du futur branchement réel (`source='live'`).

</code_context>

<specifics>
## Specific Ideas

- Colonne `source` = avance volontairement le **strict minimum** de la Phase 13 (reportée) ; ne pas confondre avec `instruments.source_symbol` (0003) qui est un symbole technique de fournisseur, sans rapport.
- Distribution « orientée démo » assumée comme choix de **démonstration** : dashboards remplis, MRR/affiliés visibles — mais chaque chiffre reste **compté** sur des lignes seedées réelles, jamais hardcodé.
- Critère de vérification concret par décision : scan `no-perf-claims` vert (D-02) ; re-run → N stable (D-06) ; test Vitest anon : non-abonné=0 signal + isolation cross-user (D-07).

</specifics>

<deferred>
## Deferred Ideas

- **Moteur de backtest réel** (`packages/backtest`, `replayOutcome`, win-rate par pattern, intervalle de Wilson, catalogue figé) → **Phase 13** (reportée). Ici on seede seulement des outcomes bruts.
- **Discrimination de source complète** (table `backtest_outcomes`, vue `pattern_stats` discriminée) → **Phase 13**. P18 n'avance que la colonne `source`.
- **Audit chiffré de scalabilité** (`EXPLAIN ANALYZE` + `get_advisors` + `pg_stat_statements` à ~10k) → **Phase 21** (SCALE-06).
- **E2E Playwright complet + isolation RLS par parcours navigateur** → **Phase 21**.
- **Câblage curseur (keyset) des requêtes de liste** et **définition des matviews KPI restantes** (churn, funnel, mix) → **Phases 19/20**.

None bloquant — discussion restée dans le périmètre de la phase.

</deferred>

---

*Phase: 18-seed-de-donn-es-r-alistes-l-chelle*
*Context gathered: 2026-06-25*
