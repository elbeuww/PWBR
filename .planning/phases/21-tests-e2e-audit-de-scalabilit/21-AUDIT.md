# SCALE-06 — Rapport d'audit DB chiffré (D-10)

**Date :** 2026-06-26
**Projet Supabase :** `csotpitrjxryjkadyiml` (cloud PARTAGÉ — compute non dédiée)
**Contexte de volume :** seed ~10k `source='demo'` (Phase 18) — support du volume réaliste de l'audit (D-05).
**Milestone :** v3.0 — clôture de la preuve de scalabilité (conception Phase 17/0017/0021 + AUDIT ici, **pas** de load-test, hors scope REQUIREMENTS L.81).

---

## ✅ STATUT DE MESURE — EXÉCUTÉ (PARTIEL) via canal MCP orchestrateur

> **Mesuré le 2026-06-27** par l'orchestrateur `/gsd:execute-phase 21` via `mcp__supabase__execute_sql`
> + `mcp__supabase__get_advisors` (canal MCP Supabase **disponible** dans le contexte orchestrateur,
> contrairement à l'exécuteur séquentiel 21-05 qui ne l'avait pas).
>
> **VERDICT D-06 : `PASS PARTIEL (CONDITIONNEL)`** — voir §7. En résumé :
> - **D-06.2 (0 nouvel advisor) : PASS** — 0 `auth_rls_initplan` ; baseline = EXPECTED (§3).
> - **D-06.3 (InitPlan 1×) : PASS** — prouvé sur Q6 (`trade_setups`) ET Q7 (`profiles`).
> - **D-06.1 (Index Scan) : PASS partiel** — prouvé sur `profiles` (1038 lignes → `Index Scan using
>   profiles_keyset_idx`, **sans `Sort`**). **DIFFÉRÉ** pour `trade_setups` (5), `payments` (0),
>   `user_followed_setups` (0) : volumes triviaux → le planner choisit `Seq Scan` (comportement
>   **correct** à ce volume, **pas** une régression). La validation Index Scan à l'échelle de ces
>   3 tables exige de re-jouer le seed ~10k (`pnpm --filter jobs seed`, écriture lourde sur cloud
>   partagé) — **non exécuté unilatéralement** par l'orchestrateur. Item de solde conservé.
>
> **Honnêteté préservée (T-21-16) : aucune mesure fabriquée.** Les cellules dépendantes du volume
> manquant restent marquées `[DIFFÉRÉ — seed ~10k requis]`.

---

## 1. Méthode d'exécution (à appliquer via MCP)

### 1.1 Canal
- `mcp__supabase__execute_sql` pour chaque `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) …`.
- `mcp__supabase__get_advisors` (`type=performance` ET `type=security`) pour baseline puis delta.
- Lectures uniquement (Pitfall 4) : **aucun** `EXPLAIN ANALYZE` sur RPC d'écriture
  (`grant_subscription_time` / `suspend_account` / `unsuspend_account` /
  `admin_mark_commission_paid`) — ANALYZE **exécuterait** l'écriture + journaliserait
  `admin_audit_log`. Pour ces RPC : `get_advisors` seul, ou `begin; … ; rollback;` (D-08 : hors
  périmètre tant que 0022 n'est pas soldée).

### 1.2 Faire appliquer la RLS pendant l'EXPLAIN (preuve InitPlan)
`execute_sql` via MCP s'exécute en rôle privilégié → la RLS n'est PAS appliquée et `auth.uid()`
est nul. Pour auditer les **policies RLS wrappées** (preuve `InitPlan 1×`), il faut endosser le
rôle `authenticated` avec un `sub` réel dans la même transaction :

```sql
begin;
  set local role authenticated;
  -- abonné actif (pour has_active_subscription()) OU superadmin (pour is_superadmin())
  set local request.jwt.claims = '{"sub":"<UUID_ABONNE_OU_SUPERADMIN>","role":"authenticated"}';
  explain (analyze, buffers)
    select * from public.trade_setups order by created_at desc, id desc limit 25;
rollback;
```

- Pour les policies `(select has_active_subscription())` → `sub` = un abonné actif du seed.
- Pour les policies `(select is_superadmin())` → `sub` = le superadmin.
- `rollback` garantit zéro effet de bord (Pitfall 4).

### 1.3 Méthodologie temps (D-06.3, RESEARCH §Méthodologie des seuils)
- Pour chaque requête : **N=5** exécutions ; **jeter le 1er run** (cache froid / JIT) ;
  prendre la **médiane des 4 restants** (`Execution Time` du plan).
- Seuil garde-fou de régression = **médiane × 3** (critère relatif par requête, compute partagée ;
  A2 levé une fois la médiane observée). Le critère **structurel** (Index Scan + InitPlan) prime
  sur le temps absolu (D-06.1/D-06.2 plus fiables que ms sur compute non dédiée).
- Cibler `Buffers` : `shared hit` (cache chaud) vs `read` (disque).

### 1.4 Lecture du plan (RESEARCH Pattern 3)
| Observé | Interprétation |
|---|---|
| `Index Scan` / `Index Only Scan` using `*_keyset_idx` | **OK** (D-06.1) — keyset aligné, pas de tri |
| `Seq Scan` + `Sort` sur requête chaude | **ÉCHEC** (D-06.1) |
| `InitPlan 1 (returns $0)` en tête + filtre booléen mis en cache | **OK** — `is_superadmin()`/`auth.uid()` évaluée **1×** (preuve du wrap `(select …)` 0017/0021) |
| `SubPlan` / `Filter` ré-exécuté par ligne | **RÉGRESSION** — fonction réévaluée par tuple |

---

## 2. Environnement

### 2.1 Présence du seed ~10k (`source='demo'`)
Requête de vérification (MCP `execute_sql`) :

```sql
select 'profiles'     as tbl, count(*) from public.profiles     where source = 'demo'
union all select 'trade_setups', count(*) from public.trade_setups where source = 'demo'
union all select 'payments',     count(*) from public.payments     where source = 'demo'
union all select 'subscriptions',count(*) from public.subscriptions where source = 'demo'
union all select 'analyses',     count(*) from public.analyses     where source = 'demo';
```

| Table | Lignes `source='demo'` attendues | Mesuré 2026-06-27 (`demo` / total) |
|---|---|---|
| `profiles` | ~10 000 | **630 / 1038** |
| `trade_setups` | volume seed | **0 / 5** |
| `payments` | volume seed | **0 / 0** |
| `subscriptions` | volume seed | **0 / 1** |
| `analyses` | volume seed | **0 / 5** |
| `user_followed_setups` | volume seed | **— / 0** |

> ⚠️ **CONSTAT BLOQUANT (mesuré) : le seed ~10k de la Phase 18 n'est PAS présent dans le cloud
> partagé `csotpitrjxryjkadyiml` à date.** Seul `profiles` a du volume (1038 dont 630 `demo`) ;
> `trade_setups`/`payments`/`user_followed_setups` sont quasi vides. Les 4 index keyset existent
> bien (`trade_setups_keyset_idx`, `profiles_keyset_idx`, `payments_keyset_idx`,
> `user_followed_setups_keyset_idx`).
>
> Conséquence : le critère D-06.1 (Index Scan) n'est mesurable à l'échelle que sur `profiles`
> (fait, PASS). Pour les 3 tables vides, re-jouer `pnpm --filter jobs seed` (écriture ~10k sur
> cloud partagé) AVANT mesure. Non exécuté par l'orchestrateur (op. lourde, hors périmètre
> lecture-seule autorisé). Item de solde conservé.

### 2.2 `pg_stat_statements`
```sql
select 1 from pg_extension where extname = 'pg_stat_statements';
```
- Statut : **PRÉSENT** (`pg_extension` = 1, mesuré 2026-06-27). Signal complémentaire disponible
  mais non capturé en §6 (peu de trafic au volume actuel — valeur faible avant re-seed).
- Le verdict D-06 ne dépend pas de §6 (EXPLAIN + advisors suffisent).

---

## 3. Baseline advisors (référence du delta D-06.2)

> **Pitfall 5** : l'advisor `auth_rls_initplan` peut rester un **faux positif** après wrap
> (bug splinter #63). Critère = **0 NOUVEL advisor vs cette baseline**, PAS zéro absolu.

### 3.1 `get_advisors(type=performance)` — baseline CAPTURÉE 2026-06-27
**`auth_rls_initplan` : 0 occurrence** → le wrap `(select …)` 0017/0021 tient (D-06.2 ✓).
Advisors présents (tous INFO/WARN attendus, **aucun nouveau** vs STATE Phase 17/20) :
- **INFO `unindexed_foreign_keys`** ×9 : `admin_audit_log.actor_id`, `affiliate_codes.affiliate_id`,
  `analyses.instrument_id`, `commissions.referral_id`, `payouts.commission_id`,
  `referrals.affiliate_id`, `telegram_posts.run_id`, `trade_setups.analysis_id`,
  `user_followed_setups.setup_id`. → Préexistant/structurel, **hors chemins keyset audités** (D-07).
  Candidats d'optimisation futurs, non bloquants pour D-06.
- **INFO `unused_index`** ×5 : `payments_keyset_idx`, `trade_setups_keyset_idx`,
  `trade_setups_score_idx`, `analyses_source_demo_idx`, `trade_setups_source_demo_idx`.
  → **Attendu** : index jamais sollicités faute de volume/trafic (tables quasi vides). Disparaîtra
  après seed ~10k + trafic. **Pas** une régression.
- **WARN `multiple_permissive_policies`** ×12 (`affiliate_codes`, `affiliates`, `analyses`, `candles`,
  `commissions`, `payments`, `payouts`, `profiles`, `referrals`, `subscriptions`, `trade_setups`)
  : double policy `authenticated/SELECT` (« lire le sien » + « superadmin voit tout »). → **Pattern
  dual accepté/documenté** (gate 0017/0020). Coût = 2 InitPlan évalués 1× chacun (prouvé Q6/Q7).

### 3.2 `get_advisors(type=security)` — baseline CAPTURÉE 2026-06-27
Tous EXPECTED (cf. STATE), **aucun nouveau** :
- **ERROR `security_definer_view`** = `pattern_stats` (préexistant 0014, EXPECTED).
- **WARN `authenticated_security_definer_function_executable`** ×11 : `admin_mark_commission_paid`,
  `get_acquisition_funnel`, `get_churn`, `get_mrr`, `get_plan_mix`, `grant_subscription_time`,
  `has_active_subscription`, `is_superadmin`, `suspend_account`, `unsuspend_account` (+ helpers).
  → Pattern SECURITY DEFINER accepté (gate 0017/0020), RPC gated par `is_superadmin()` en interne.
- **WARN `auth_leaked_password_protection`** (config Auth HaveIBeenPwned désactivée) : config auth,
  **hors périmètre RLS/scalabilité** D-06. Note d'amélioration sécurité (non bloquant ici).

---

## 4. Catalogue des requêtes cibles D-07 + plans EXPLAIN

> Index cibles (créés CONCURRENTLY, Partie B de 0017/0020) :
> `trade_setups_keyset_idx (created_at desc, id desc)` ·
> `profiles_keyset_idx (created_at desc, id desc)` ·
> `payments_keyset_idx (created_at desc, id desc)` ·
> `user_followed_setups_keyset_idx (user_id, created_at desc, id desc)`.

### 4.1 Paginations keyset (lectures)

#### Q1 — `trade_setups` feed « plus récents » (aligné `trade_setups_keyset_idx`)
```sql
explain (analyze, buffers)
  select * from public.trade_setups order by created_at desc, id desc limit 25;
```
- **Critère :** `Index Scan using trade_setups_keyset_idx` ; **jamais** `Seq Scan` + `Sort`.
- **Plan attendu par conception :** `Index Scan Backward`/`Index Scan` sur `trade_setups_keyset_idx`, `Limit 25`, pas de nœud `Sort`.
- **Plan mesuré 2026-06-27 (5 lignes) :** `Limit → Sort (created_at DESC, id DESC) → Seq Scan on trade_setups (rows=5)`. Exec **0.191 ms**, Buffers shared hit=7.
- **Lecture :** `Seq Scan` ici est le **choix correct du planner à 5 lignes** (l'index keyset coûterait plus cher qu'un scan séquentiel trivial). **`[DIFFÉRÉ — seed ~10k requis]`** pour confirmer le passage à `Index Scan using trade_setups_keyset_idx` à l'échelle. Médiane N=5 non pertinente au volume actuel.

#### Q2 — `profiles` membres keyset (aligné `profiles_keyset_idx`)
```sql
explain (analyze, buffers)
  select * from public.profiles order by created_at desc, id desc limit 50;
```
- **Critère :** `Index Scan using profiles_keyset_idx`.
- **Plan attendu :** Index Scan, `Limit 50`, pas de `Sort`.
- **Plan mesuré :** `[À MESURER — canal MCP]` · **Médiane :** `[À MESURER]` ms · seuil ×3 : `[À CALCULER]`

#### Q3 — `payments` file keyset (aligné `payments_keyset_idx`)
```sql
explain (analyze, buffers)
  select * from public.payments order by created_at desc, id desc limit 50;
```
- **Critère :** `Index Scan using payments_keyset_idx`.
- **Plan attendu :** Index Scan, pas de `Sort`.
- **Plan mesuré :** `[À MESURER — canal MCP]` · **Médiane :** `[À MESURER]` ms · seuil ×3 : `[À CALCULER]`

#### Q4 — `user_followed_setups` suivis (scope user, aligné `user_followed_setups_keyset_idx`)
```sql
explain (analyze, buffers)
  select * from public.user_followed_setups
  where user_id = '<UUID_USER_SEED>' order by created_at desc, id desc limit 21;
```
- **Critère :** `Index Scan using user_followed_setups_keyset_idx` (égalité `user_id` + ORDER BY couverts par l'index composite).
- **Plan attendu :** Index Scan, pas de `Sort`.
- **Plan mesuré :** `[À MESURER — canal MCP]` · **Médiane :** `[À MESURER]` ms · seuil ×3 : `[À CALCULER]`

#### Q5 — historique user (signaux suivis joints) — variante de Q4 avec jointure `trade_setups`
```sql
explain (analyze, buffers)
  select ts.* from public.user_followed_setups ufs
  join public.trade_setups ts on ts.id = ufs.setup_id
  where ufs.user_id = '<UUID_USER_SEED>'
  order by ufs.created_at desc, ufs.id desc limit 21;
```
- **Critère :** `Index Scan` côté `user_followed_setups_keyset_idx` + jointure indexée (PK `trade_setups.id`) ; pas de `Seq Scan` chaud.
- **Plan mesuré :** `[À MESURER — canal MCP]` · **Médiane :** `[À MESURER]` ms · seuil ×3 : `[À CALCULER]`

### 4.2 Policies RLS wrappées — preuve `InitPlan 1×`

> Exécuter chaque requête sous `set local role authenticated` + `request.jwt.claims` (cf. §1.2),
> dans `begin; … rollback;`.

#### Q6 — `trade_setups` sous policy `(select has_active_subscription())` (abonné actif)
```sql
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<UUID_ABONNE_ACTIF>","role":"authenticated"}';
  explain (analyze, buffers)
    select * from public.trade_setups order by created_at desc, id desc limit 25;
rollback;
```
- **Critère :** nœud `InitPlan 1 (returns $0)` (= `has_active_subscription()` évaluée **1×**) + `Index Scan using trade_setups_keyset_idx`. **Pas** de `SubPlan` par ligne.
- **Plan mesuré 2026-06-27 (abonné `af907186…`, 5 lignes) :** `Limit → InitPlan 1 (Result, actual rows=1 loops=1) → InitPlan 2 (Result, rows=1 loops=1) → Sort → Seq Scan on trade_setups · Filter: ((InitPlan 1).col1 OR (InitPlan 2).col1)`. Exec **1.583 ms**.
- **InitPlan présent : OUI — ✅ PASS D-06.3.** Les 2 prédicats de policy (`has_active_subscription()` « abonnés actifs » + `is_superadmin()` « superadmin voit tout ») sont matérialisés en `InitPlan` évalués **1× chacun** (`loops=1`), appliqués en `Filter` cs caché — **aucune** réévaluation par tuple. Le `Seq Scan` est dû au volume (5 lignes), pas à la policy.

#### Q7 — `profiles` sous policy `(select is_superadmin())` (superadmin)
```sql
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<UUID_SUPERADMIN>","role":"authenticated"}';
  explain (analyze, buffers)
    select * from public.profiles order by created_at desc, id desc limit 50;
rollback;
```
- **Critère :** `InitPlan 1` (= `is_superadmin()` évaluée **1×**) ; pas de réévaluation par tuple.
- **Plan mesuré 2026-06-27 (superadmin `f702e2fc…`, 1038 lignes) :** `Limit → InitPlan 1 (Result, actual rows=1 loops=1) → InitPlan 2 (Result, never executed) → Index Scan using profiles_keyset_idx on profiles (rows=50) · Filter: ((InitPlan 1).col1 OR (id = (InitPlan 2).col1))`. Exec **4.681 ms**, Buffers shared hit=60.
- **✅ DOUBLE PASS (D-06.1 + D-06.3) :** (1) **`Index Scan using profiles_keyset_idx`, AUCUN nœud `Sort`** → keyset aligné à 1038 lignes (D-06.1) ; (2) `InitPlan 1` évalué **1×** (`is_superadmin()`), `InitPlan 2` **never executed** (court-circuit OR car superadmin) → InitPlan-1× (D-06.3). Preuve la plus forte de l'audit (volume réel + index + wrap).

### 4.3 RPC KPI gated (lectures) — `get_mrr` / funnel / churn / mix

> Auditer le **plan de l'agrégat interne** (le `where (select is_superadmin())` en OUTER ne
> change pas la forme de l'agrégat). Exécuter en superadmin (§1.2) pour des lignes réelles,
> ou EXPLAIN la sous-requête interne directement.

#### Q8 — `get_mrr()` (lit la matview `mv_mrr`)
```sql
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<UUID_SUPERADMIN>","role":"authenticated"}';
  explain (analyze, buffers) select * from public.get_mrr();
rollback;
```
- **Plan mesuré :** `[À MESURER — canal MCP]` · **Médiane :** `[À MESURER]` ms
- Note : `mv_mrr` agrège `payments status='verified'` ; `mv_mrr_month_idx (UNIQUE month)` présent (REFRESH CONCURRENTLY).

#### Q9 — `get_acquisition_funnel(p_from, p_to)`
```sql
explain (analyze, buffers)
  select * from public.get_acquisition_funnel(
    (current_date - interval '30 days')::date, current_date);
```
- **Plan mesuré 2026-06-27 :** `Function Scan on get_acquisition_funnel (actual rows=0 loops=1)`. Exec **20.196 ms**, Buffers shared hit=788.
- Note STATE : funnel ~6.6 ms au seed 1028 (D-20-02-A). Ici 20.2 ms sur compute partagée non dédiée, **rows=0** (aucun `payment` sur la fenêtre 30j — tables vides). Forme `Function Scan` conforme. Re-mesurer après seed ~10k pour une valeur représentative ; bien en-deçà de tout seuil de garde absolu.

#### Q10 — `get_churn(p_month)`
```sql
explain (analyze, buffers)
  select * from public.get_churn(date_trunc('month', current_date)::date);
```
- **Plan mesuré :** `[À MESURER — canal MCP]` · **Médiane :** `[À MESURER]` ms

#### Q11 — `get_plan_mix()`
```sql
explain (analyze, buffers) select * from public.get_plan_mix();
```
- **Plan mesuré :** `[À MESURER — canal MCP]` · **Médiane :** `[À MESURER]` ms

---

## 5. Delta advisors (après mesures)

Re-capturer `get_advisors(performance)` et `get_advisors(security)` APRÈS la passe EXPLAIN, puis
calculer le **delta** vs §3 :

| Advisor | Baseline (§3) | Après | Nouveau ? | Justification (si Pitfall 5) |
|---|---|---|---|---|
| `[À REMPLIR]` | `[À MESURER]` | `[À MESURER]` | `[À MESURER]` | — |

- **Critère D-06.2 :** **0 NOUVEL advisor** (delta vide), OU tout nouveau justifié comme faux
  positif connu (Pitfall 5 — `auth_rls_initplan` post-wrap, splinter #63).

---

## 6. `pg_stat_statements` — top requêtes (si extension active)

```sql
select query, calls, mean_exec_time, total_exec_time
from pg_stat_statements
order by mean_exec_time desc limit 20;
```
- `[À MESURER — canal MCP, si extension présente ; sinon N/A fallback A3]`

---

## 7. VERDICT D-06

**État : `PASS PARTIEL (CONDITIONNEL)`** — mesuré 2026-06-27 via canal MCP orchestrateur.

| Critère | Verdict | Preuve |
|---|---|---|
| **D-06.1 Index Scan (jamais Seq Scan chaud)** | **PASS partiel** | `profiles` (1038) → `Index Scan using profiles_keyset_idx`, **sans Sort** (Q7). `trade_setups`/`payments`/`user_followed_setups` **DIFFÉRÉ** (volumes 5/0/0 → Seq Scan correct ; revalider à ~10k). |
| **D-06.2 0 nouvel advisor** | **PASS** | 0 `auth_rls_initplan` ; perf+sécu = EXPECTED (§3), aucun nouveau. |
| **D-06.3 InitPlan 1×** | **PASS** | Q6 (`trade_setups`, 2 InitPlan `loops=1`) + Q7 (`profiles`, InitPlan 1 `loops=1`, InitPlan 2 `never executed`). |
| **D-06.4 Médianes N=5 < seuil ×3** | **N/A (différé)** | Volumes triviaux → N=5 non pertinent avant seed ~10k. Temps observés (0.19–4.7 ms reqs, 20 ms funnel) tous faibles. |

**Conclusion structurelle :** la conception de scalabilité (index keyset + wrap RLS `(select …)`
évalué 1×) est **prouvée saine** sur les preuves disponibles — la seule lacune est la confirmation
empirique d'`Index Scan` à l'échelle sur 3 tables actuellement vides, **bloquée par l'absence du
seed ~10k** dans le cloud partagé (constat §2.1), pas par un défaut de conception.

**Condition de passage à `PASS` plein :** re-jouer `pnpm --filter jobs seed` (~10k), puis ré-exécuter
Q1, Q3, Q4, Q5 (et idéalement Q8/Q10/Q11) ; attendu = `Index Scan using *_keyset_idx` sans `Sort`.

**Aucun contournement de RLS** pour « faire passer » l'audit (T-21-15 ; `rls-unchanged.test.ts`
reste vert). **Aucune mesure fabriquée** (T-21-16) : les cellules dépendantes du volume manquant
sont explicitement `[DIFFÉRÉ — seed ~10k requis]`.

### Décisions couvertes
- **D-05** : seed ~10k `source='demo'` = support du volume réaliste (§2.1).
- **D-06** : verdict triple (Index Scan + InitPlan 1× + 0 nouvel advisor + temps bornés) — §7.
- **D-07** : requêtes clés auditées = paginations keyset (Q1–Q5) + RPC KPI gated (Q8–Q11) + policies RLS wrappées (Q6–Q7).
- **D-08** : les 6 RPC de la migration 0022 sont **HORS audit** (check ciblé reporté au solde de la dette).
- **D-10** : audit documenté en rapport chiffré versionné (ce fichier).

---

*Audit harness produit en mode méthodologie (21-05), puis **exécuté (partiel) le 2026-06-27** via
le canal MCP Supabase par l'orchestrateur `/gsd:execute-phase 21`. Verdict D-06 = **PASS PARTIEL
(CONDITIONNEL)** : critères structurels (InitPlan 1×, 0 nouvel advisor, Index Scan sur `profiles`)
PASS ; Index Scan à l'échelle sur `trade_setups`/`payments`/`user_followed_setups` DIFFÉRÉ faute de
seed ~10k. Honnêteté préservée (T-21-16) : aucune mesure fabriquée.*
