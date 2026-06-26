# SCALE-06 — Rapport d'audit DB chiffré (D-10)

**Date :** 2026-06-26
**Projet Supabase :** `csotpitrjxryjkadyiml` (cloud PARTAGÉ — compute non dédiée)
**Contexte de volume :** seed ~10k `source='demo'` (Phase 18) — support du volume réaliste de l'audit (D-05).
**Milestone :** v3.0 — clôture de la preuve de scalabilité (conception Phase 17/0017/0021 + AUDIT ici, **pas** de load-test, hors scope REQUIREMENTS L.81).

---

## ⚠️ STATUT DE MESURE — LECTURE OBLIGATOIRE

> **Canal d'exécution requis : MCP Supabase (`mcp__supabase__execute_sql` + `mcp__supabase__get_advisors`).**
>
> Le plan 21-05 (`<mcp_tools>`) prévoit explicitement : *« si les outils MCP ne sont pas
> accessibles, se rabattre sur la documentation de la méthodologie »*.
>
> **Dans le contexte d'exécution de cet exécuteur séquentiel, le canal MCP Supabase n'est
> PAS accessible** (outils `mcp__supabase__*` absents du schéma d'outils ; HTTP inline bloqué ;
> ni `psql`, ni paquet `pg`, ni chaîne de connexion Postgres directe disponibles). Aucune
> requête live n'a donc pu être exécutée par l'exécuteur.
>
> **Décision (honnêteté > complétude, T-21-16 « pas de faux verdict PASS ») :** ce document
> est livré comme **harnais d'audit prêt-à-exécuter** — chaque requête cible D-07 est consignée
> avec son SQL EXACT, le critère de lecture du plan, et le **plan ATTENDU PAR CONCEPTION**
> (déduit des index/policies des migrations 0017/0020/0021). Les cellules de mesure réelle sont
> marquées **`[À MESURER — canal MCP]`**. Aucune valeur n'est fabriquée.
>
> **VERDICT D-06 actuel : `PENDING-MEASUREMENT`.** Le verdict PASS/FAIL ne sera émis qu'après
> exécution du catalogue ci-dessous via le canal MCP (par l'orchestrateur ou une session
> outillée). Voir `.planning/todos/pending/` pour l'item de solde.

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

| Table | Lignes `source='demo'` attendues | Mesuré |
|---|---|---|
| `profiles` | ~10 000 | `[À MESURER — canal MCP]` |
| `trade_setups` | volume seed | `[À MESURER — canal MCP]` |
| `payments` | volume seed | `[À MESURER — canal MCP]` |
| `subscriptions` | volume seed | `[À MESURER — canal MCP]` |
| `analyses` | volume seed | `[À MESURER — canal MCP]` |

> Si `profiles source='demo'` ≪ 10k : relancer `pnpm --filter jobs seed` (purge idempotente
> `source='demo'` → re-seed) AVANT toute mesure, puis re-vérifier.

### 2.2 `pg_stat_statements`
```sql
select 1 from pg_extension where extname = 'pg_stat_statements';
```
- Statut : `[À VÉRIFIER — canal MCP]`.
- **Si présent** : capturer le top requêtes (`mean_exec_time`, `calls`) en §6 (signal complémentaire).
- **Si absent (fallback A3)** : audit sur EXPLAIN + advisors uniquement (suffisant pour le verdict D-06).

---

## 3. Baseline advisors (référence du delta D-06.2)

> **Pitfall 5** : l'advisor `auth_rls_initplan` peut rester un **faux positif** après wrap
> (bug splinter #63). Critère = **0 NOUVEL advisor vs cette baseline**, PAS zéro absolu.

### 3.1 `get_advisors(type=performance)` — baseline
```
[À CAPTURER — canal MCP : mcp__supabase__get_advisors type=performance]
Attendu (cohérent STATE Phase 17/20) : 0 auth_rls_initplan (wrap 0017/0021 tenu).
Lister INTÉGRALEMENT chaque advisor {name, level, facing, table/objet}.
```

### 3.2 `get_advisors(type=security)` — baseline
```
[À CAPTURER — canal MCP : mcp__supabase__get_advisors type=security]
Faux positifs/EXPECTED connus (STATE) :
  - ERROR security_definer_view = pattern_stats (préexistant 0014).
  - WARN *_security_definer_function_executable sur helpers get_mrr / is_superadmin /
    has_active_subscription (pattern accepté, gate 0017/0020).
Lister INTÉGRALEMENT pour servir de référence au delta.
```

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
- **Plan mesuré :** `[À MESURER — canal MCP]`
- **Médiane (N=5, run froid jeté) :** `[À MESURER]` ms · **seuil ×3 :** `[À CALCULER]` ms · Buffers : `[À MESURER]`

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
- **Plan mesuré :** `[À MESURER — canal MCP]` · **InitPlan présent O/N :** `[À MESURER]`

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
- **Plan mesuré :** `[À MESURER — canal MCP]` · **InitPlan présent O/N :** `[À MESURER]`

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
- **Plan mesuré :** `[À MESURER — canal MCP]` · **Médiane :** `[À MESURER]` ms
- Note STATE : funnel ~6.6 ms au seed 1028 (D-20-02-A) — re-mesurer à ~10k.

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

**État : `PENDING-MEASUREMENT`** (canal MCP non accessible à l'exécuteur séquentiel — voir bandeau §⚠️).

Le verdict final sera **PASS** si et seulement si, après exécution du catalogue §4 :
1. **Index Scan** (jamais `Seq Scan` chaud) sur Q1–Q5 (paginations keyset) — D-06.1.
2. **InitPlan 1×** présent sur Q6 et Q7 (RLS wrappées) — preuve « non réévaluée par ligne ».
3. **0 nouvel advisor** perf/sécu vs baseline §3 (delta §5) — D-06.2.
4. Médianes N=5 bornées (chaque requête sous son seuil ×3) — D-06.3.

Sinon **FAIL** avec la liste explicite des régressions (Seq Scan chaud, SubPlan par ligne,
nouvel advisor non justifié, ou dépassement de seuil). **Aucun contournement de RLS** pour
« faire passer » l'audit (T-21-15 ; `rls-unchanged.test.ts` reste vert).

### Décisions couvertes
- **D-05** : seed ~10k `source='demo'` = support du volume réaliste (§2.1).
- **D-06** : verdict triple (Index Scan + InitPlan 1× + 0 nouvel advisor + temps bornés) — §7.
- **D-07** : requêtes clés auditées = paginations keyset (Q1–Q5) + RPC KPI gated (Q8–Q11) + policies RLS wrappées (Q6–Q7).
- **D-08** : les 6 RPC de la migration 0022 sont **HORS audit** (check ciblé reporté au solde de la dette).
- **D-10** : audit documenté en rapport chiffré versionné (ce fichier).

---

*Audit harness produit en mode méthodologie (fallback `<mcp_tools>` du plan 21-05). Exécution
mesurée à compléter via le canal MCP Supabase. Honnêteté préservée (T-21-16) : aucune mesure
fabriquée, verdict PENDING tant que non mesuré.*
