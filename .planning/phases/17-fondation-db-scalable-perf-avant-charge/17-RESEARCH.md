# Phase 17 : Fondation DB scalable (perf avant charge) — Recherche

**Researched:** 2026-06-24
**Domain:** Durcissement Postgres/Supabase (RLS perf, index keyset, matviews KPI, migrations non bloquantes `CONCURRENTLY`, Realtime→Broadcast) sur Next.js 15 + Supabase, par conception (pas de load-test).
**Confidence:** HIGH (mécaniques SQL/Supabase vérifiées sur docs officielles + migrations du repo inspectées) ; MEDIUM uniquement sur les *seuils chiffrés* (reportés Phase 21, post-seed).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (SCALE-01) :** Optimiser **TOUTES** les policies RLS existantes dans `0017` — wrap `(select auth.uid())` / `(select has_active_subscription())` / `(select is_superadmin())` + index sur les colonnes de policy. Tables : `trade_setups`, `candles`, `payments`, `subscriptions`, `profiles`, `prediction_outcomes`, tables d'affiliation. **Critère d'arrêt : `get_advisors` ne signale plus AUCUNE policy réévaluée par ligne (vert complet).**
- **D-02 (SCALE-03) :** Poser l'**infra/pattern réutilisable** (matview + **unique index** → `REFRESH CONCURRENTLY` + **wrapper `is_superadmin()`** car les matviews n'ont pas de RLS), prouvé sur **1 matview de référence : le MRR** (dépend de `payments`/`subscriptions`). **Ne PAS** construire toutes les matviews KPI maintenant.
- **D-03 (SCALE-02) :** Phase 17 crée **uniquement les index composites alignés `ORDER BY`** (signaux, utilisateurs, paiements), prêts pour le keyset. **Vérification : `EXPLAIN` montre un index scan (pas de seq scan + tri).** Le câblage curseur = Phase 19/20.
- **D-04 (SCALE-05) :** **Migrer MAINTENANT** le flux Realtime existant (badge « N nouveaux signaux », migration `0011` : `REPLICA IDENTITY FULL` + publication + `postgres_changes` sur `trade_setups`) vers **Broadcast**. Devient l'implémentation de référence Broadcast. Réévaluer si `REPLICA IDENTITY FULL` reste nécessaire une fois sur Broadcast.
- **D-05 (SCALE-04) :** Appliquer `0017` **LIVE via le MCP Supabase** (JAMAIS `db push`), modèle 0011/0012/0014 : `CREATE INDEX CONCURRENTLY` en **statements séparés hors transaction**, après **checkpoint humain**, puis `generate_typescript_types` → `database.types.ts` → `get_advisors`. Gérer l'état **INVALID** d'un index concurrent échoué (DROP + recréation).

### Claude's Discretion
- Mécanique SQL précise du wrap RLS, ordre des colonnes de chaque index composite, nom/définition exacte de la matview MRR, canal privé vs topic léger pour Broadcast → laissés au researcher/planner.

### Deferred Ideas (OUT OF SCOPE)
- **Audit chiffré de scalabilité** (`EXPLAIN ANALYZE` + `get_advisors` + `pg_stat_statements` à ~10k) → **Phase 21 (SCALE-06)**, exige le seed.
- **Câblage curseur (keyset) des requêtes de liste** → **Phase 19/20** (UI dashboards).
- **Définition des matviews KPI restantes** (churn, funnel, mix de plans) → **Phase 20 (ADASH)**.
- **Confirmation des seuils chiffrés** OFFSET→keyset et `postgres_changes`→Broadcast → **Phase 21** (post-seed).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCALE-01 | Policies RLS optimisées (wrap `(select …)`) + indexées sur colonnes de policy (gain >100×) | §RLS wrap mechanics + §Inventaire policies par table (colonnes à indexer + déjà couvertes) |
| SCALE-02 | Listes longues (signaux/users/paiements) en keyset avec index composites alignés `ORDER BY` | §Index composites keyset (ordering exact par liste + vérif EXPLAIN) |
| SCALE-03 | KPIs superadmin sur matviews (unique index, `REFRESH CONCURRENTLY`) gated `is_superadmin()` | §Matview MRR de référence (définition + unique index + wrapper SECURITY DEFINER + refresh) |
| SCALE-04 | Migrations non bloquantes (`CREATE INDEX CONCURRENTLY`, gestion INVALID) | §Exécution CONCURRENTLY via MCP (execute_sql per-statement) + détection/recovery INVALID |
| SCALE-05 | Flux temps réel fort volume en Broadcast plutôt que `postgres_changes` | §Realtime→Broadcast (trigger `realtime.broadcast_changes` + RLS auth + réécriture client badge) |
</phase_requirements>

## Summary

Cette phase est **100 % de l'ingénierie Postgres/Supabase**, pas de nouvelle dépendance npm. Tout l'outillage existe déjà dans le repo : helpers `is_superadmin()` / `has_active_subscription()` (`SECURITY DEFINER STABLE search_path=public`, migrations 0008-0010), pattern « migration LIVE via MCP `apply_migration` + édition manuelle de `database.types.ts` + `get_advisors` au gate » (rodé sur 0011/0012/0014/0016, projet **non `link`é** localement → `db push`/`gen types --linked` impossibles par design).

Les cinq décisions verrouillées s'appuient sur des mécaniques Postgres/Supabase **vérifiées sur docs officielles** : (1) le wrap `(select auth.uid())` force un **InitPlan** évalué une fois par requête au lieu d'une fois par ligne — c'est exactement ce que lint l'advisor `auth_rls_initplan` ; (2) keyset = index composite `(sort_col [DESC], id)` aligné sur l'`ORDER BY` → index scan sans nœud de tri ; (3) une matview n'a **pas de RLS** → on la lit via un wrapper `SECURITY DEFINER` gated `is_superadmin()`, et `REFRESH CONCURRENTLY` exige un **index UNIQUE** sur la matview ; (4) `CREATE INDEX CONCURRENTLY` est **interdit en transaction** et laisse un index `INVALID` en cas d'échec (à `DROP`+recréer) ; (5) le passage `postgres_changes`→**Broadcast** se fait via un trigger `realtime.broadcast_changes()` qui pousse sur un **canal privé** (Realtime Authorization via RLS sur `realtime.messages`), supprimant le filtrage RLS par-message-par-subscriber qui sature à 10k.

**Recommandation principale :** Découper `0017` en **un fichier SQL transactionnel** (wraps RLS + définitions de matview/wrapper/triggers/policies Broadcast — tout ce qui est DDL transactionnel) appliqué via `apply_migration`, **plus une série de statements `CREATE INDEX CONCURRENTLY` exécutés un-par-un hors transaction via `execute_sql`** (jamais `apply_migration` qui peut envelopper en tx). Gate de phase = `get_advisors(performance)` **zéro** `auth_rls_initplan` + `EXPLAIN` index scan sans tri sur 3 requêtes-listes + `REFRESH MATERIALIZED VIEW CONCURRENTLY` fonctionnel.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Wrap RLS `(select …)` + index policy | Database (Postgres RLS) | — | La RLS est la seule barrière non contournable (front en client anon) ; la perf RLS est une propriété DB pure. |
| Index composites keyset | Database (Postgres index) | API/Backend (Phase 19/20 câble le curseur) | Phase 17 = pose des index ; le `WHERE (sort,id) > (…)` vit dans les repositories plus tard. |
| Matview MRR + refresh | Database (matview + wrapper SECURITY DEFINER) | Jobs (déclencheur de refresh, Phase 18/20) | Agrégat coûteux pré-calculé en DB ; lecture gated par fonction, pas par RLS (les matviews n'en ont pas). |
| Migration CONCURRENTLY | Database (DDL hors tx via MCP) | — | Opération d'administration DB, exécutée par l'opérateur via MCP. |
| Realtime→Broadcast | Database (trigger + RLS `realtime.messages`) | Client (réécriture abonnement `RealtimeBadge`/`SignalList`) | Le fan-out passe par un trigger DB qui écrit `realtime.messages` ; le client s'abonne à un canal privé. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Postgres (Supabase) | 15+ | RLS, index, matviews, triggers Broadcast | Plateforme verrouillée ; tout le travail de cette phase est SQL natif. [CITED: CLAUDE.md stack] |
| `@supabase/supabase-js` | 2.108.0 (déjà installé) | Client Realtime (canal privé Broadcast côté front) | Déjà la dépendance Realtime du projet ; `supabase.realtime.setAuth()` + `.channel(name,{config:{private:true}})`. [VERIFIED: package.json projet] |
| Supabase MCP (`apply_migration`, `execute_sql`, `generate_typescript_types`, `get_advisors`, `list_tables`) | hosted | Application LIVE + audit | Canal d'application rodé du projet (0011/0012/0014/0016). [VERIFIED: .mcp.json `project_ref=csotpitrjxryjkadyiml`] |

### Supporting
**Aucune nouvelle dépendance npm.** Cette phase n'installe rien. Le déclencheur de `REFRESH` de la matview (cron/Edge Function/pg_cron) est une **question ouverte** (voir §Open Questions) — Phase 17 pose la fonction de refresh, pas forcément l'ordonnanceur.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `realtime.broadcast_changes` (trigger DB) | Broadcast via `supabase.channel().send()` côté serveur (Edge/RPC) | Le trigger DB est le pattern « Broadcast from Database » officiel, reste cohérent avec « DB = frontière producteur unique ». Le send serveur exigerait un point d'écriture applicatif (rompt l'invariant `persist.ts`). |
| Wrapper `SECURITY DEFINER` lisant la matview | `GRANT SELECT` direct + RLS | Les **matviews ne supportent pas la RLS** → un GRANT direct exposerait à tout `authenticated`. Le wrapper gated `is_superadmin()` est obligatoire. [VERIFIED: Postgres — matviews sans RLS] |

**Installation :** Aucune. (Travail SQL appliqué via MCP.)

## Package Legitimacy Audit

> Sans objet : cette phase n'installe aucun package externe. Tout est SQL natif Postgres/Supabase + le client `@supabase/supabase-js` déjà présent. Aucune surface d'install → aucun risque slopsquatting introduit par Phase 17.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌───────────────────────────────────────────────┐
                         │            MIGRATION 0017 (SCALE-01..05)        │
                         └───────────────────────────────────────────────┘

  [Partie A — fichier SQL transactionnel via apply_migration]
   ┌─ DROP/CREATE policies wrap (select auth.uid()/has_active_subscription()/is_superadmin())
   ├─ CREATE MATERIALIZED VIEW mv_mrr  (sur payments/subscriptions)
   ├─ CREATE FUNCTION get_mrr() SECURITY DEFINER  → garde is_superadmin()
   ├─ CREATE FUNCTION refresh_mv_mrr()            → REFRESH ... CONCURRENTLY
   ├─ CREATE FUNCTION broadcast_trade_setup_changes() → realtime.broadcast_changes(...)
   ├─ CREATE TRIGGER  ... AFTER INSERT/UPDATE ON trade_setups
   └─ CREATE POLICY   "broadcast read" ON realtime.messages  (Realtime Authorization)

  [Partie B — statements isolés hors transaction via execute_sql, 1 par 1]
   ┌─ CREATE UNIQUE INDEX CONCURRENTLY mv_mrr_pk ON mv_mrr (...)   ← requis pour REFRESH CONCURRENTLY
   ├─ CREATE INDEX CONCURRENTLY  <policy columns>  (user_id, etc.)
   └─ CREATE INDEX CONCURRENTLY  <keyset composites> (sort DESC, id)

                         ▼ après checkpoint humain
   generate_typescript_types → édition manuelle database.types.ts → get_advisors (gate)


  RUNTIME — flux Broadcast (remplace postgres_changes) :

   service_role INSERT trade_setups ──► TRIGGER ──► realtime.broadcast_changes('topic:new-signals', …)
                                                          │ écrit realtime.messages
                                                          ▼
   navigateur (abonné actif) : supabase.realtime.setAuth()
        .channel('topic:new-signals', { config:{ private:true } })
        .on('broadcast', {event:'INSERT'}, → newCount++)        ← RLS sur realtime.messages
        .on('broadcast', {event:'UPDATE'}, → removedIds.add)       filtre l'autorisation d'écoute
```

### Recommended Project Structure
```
supabase/migrations/
└── 0017_scalable_foundation.sql   # Partie A (transactionnelle) — wraps RLS, matview, wrapper, trigger Broadcast, policies
                                    # Partie B (CONCURRENTLY) documentée en commentaire + appliquée via execute_sql per-statement
apps/web/src/components/signals/
├── SignalList.tsx                 # réécriture : .channel('signals-active') postgres_changes → canal privé Broadcast
└── RealtimeBadge.tsx              # inchangé (props count/onReveal) — seule la source d'events change
apps/web/src/lib/supabase/
└── client.ts                      # createBrowserSupabaseClient (porte la session via cookies — déjà OK pour setAuth)
packages/supabase/
└── database.types.ts              # édité à la main après generate_typescript_types (projet non linké)
```

### Pattern 1 : Wrap RLS InitPlan
**What :** Envelopper tout appel de fonction non corrélé à la ligne dans un `(select …)` pour forcer un InitPlan évalué **une fois par requête**.
**When to use :** Toute policy référençant `auth.uid()`, `is_superadmin()`, `has_active_subscription()`.
```sql
-- Source: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv [VERIFIED]
-- AVANT (réévaluée par ligne) :
create policy "trade_setups: abonnés actifs" on public.trade_setups
  for select to authenticated using (public.has_active_subscription());
-- APRÈS (InitPlan caché, 1×/requête) :
drop policy "trade_setups: abonnés actifs" on public.trade_setups;
create policy "trade_setups: abonnés actifs" on public.trade_setups
  for select to authenticated using ((select public.has_active_subscription()));

-- Policy corrélée à la colonne → wrapper la fonction, garder la comparaison de colonne :
drop policy "payments: lire les siennes" on public.payments;
create policy "payments: lire les siennes" on public.payments
  for select to authenticated using (user_id = (select auth.uid()));
```
**Note clé (limite officielle) :** le wrap n'est valide que si le résultat **ne dépend pas des données de la ligne**. `auth.uid()`, `is_superadmin()`, `has_active_subscription()` sont tous indépendants de la ligne → valides. `user_id = (select auth.uid())` : on wrappe `auth.uid()`, PAS `user_id`.

### Pattern 2 : Index composite keyset aligné ORDER BY
**What :** `(sort_col [DESC], id)` pour qu'un `ORDER BY sort_col DESC, id DESC LIMIT n` produise un index scan **sans nœud de tri**.
```sql
-- Source: PITFALLS.md Pitfall 10 + Stacksync keyset [VERIFIED via doc + EXPLAIN au gate]
-- Le sens (ASC/DESC) de l'index DOIT matcher l'ORDER BY de la liste cible.
create index concurrently trade_setups_keyset_idx
  on public.trade_setups (created_at desc, id desc);
-- Vérif : EXPLAIN doit montrer "Index Scan", PAS "Seq Scan" + "Sort".
```

### Pattern 3 : Matview + wrapper SECURITY DEFINER gated
```sql
-- Une matview N'A PAS de RLS → on ne GRANT JAMAIS SELECT direct à authenticated.
create materialized view public.mv_mrr as
  select date_trunc('month', s.current_period_end) as month,
         count(*) filter (where s.status='active' and (s.current_period_end is null or s.current_period_end > now())) as active_subs,
         coalesce(sum(p.expected_amount_atomic),0)::bigint as mrr_atomic
  from public.subscriptions s
  left join public.payments p on p.user_id = s.user_id and p.status='verified'
  group by 1;
-- UNIQUE index OBLIGATOIRE pour REFRESH CONCURRENTLY :
create unique index concurrently mv_mrr_month_idx on public.mv_mrr (month);
-- Lecture gated (les matviews n'ont pas de RLS) :
create function public.get_mrr() returns setof public.mv_mrr
  language sql security definer set search_path = public stable as $$
  select * from public.mv_mrr where (select public.is_superadmin());
$$;
revoke execute on function public.get_mrr() from public, anon;
grant execute on function public.get_mrr() to authenticated;
-- Refresh sans verrou de lecture (exige le unique index ci-dessus) :
create function public.refresh_mv_mrr() returns void
  language plpgsql security definer set search_path = public as $$
  begin refresh materialized view concurrently public.mv_mrr; end; $$;
revoke execute on function public.refresh_mv_mrr() from public, anon, authenticated;
```
> La définition MRR ci-dessus est un **squelette à valider avec le fondateur** (voir Assumptions A1) : la « source de vérité » du montant mensuel (expected vs amount réellement constaté, période, plans inclus) n'est pas verrouillée dans CONTEXT.md.

### Pattern 4 : Broadcast from Database (remplace postgres_changes)
```sql
-- Source: https://supabase.com/docs/guides/realtime/subscribing-to-database-changes [VERIFIED]
-- Trigger function (canal privé → Realtime Authorization requise) :
create or replace function public.broadcast_trade_setup_changes()
  returns trigger security definer language plpgsql
  set search_path = public as $$
begin
  perform realtime.broadcast_changes(
    'topic:new-signals',          -- topic FIXE partagé (fan-out global, pas par-record)
    tg_op, tg_op, tg_table_name, tg_table_schema, new, old
  );
  return null;
end; $$;
create trigger trg_trade_setups_broadcast
  after insert or update on public.trade_setups
  for each row execute function public.broadcast_trade_setup_changes();
-- Realtime Authorization : qui peut écouter le canal privé (RLS sur realtime.messages).
-- Restreindre aux abonnés actifs = parité avec l'ancien filtre RLS postgres_changes :
create policy "broadcast: abonnés actifs écoutent new-signals"
  on realtime.messages for select to authenticated
  using ( (select public.has_active_subscription()) );
```
```typescript
// Source: doc Supabase "subscribing-to-database-changes" [VERIFIED] — réécriture SignalList.tsx
await supabase.realtime.setAuth() // requis pour Realtime Authorization (canal privé)
const channel = supabase
  .channel('topic:new-signals', { config: { private: true } })
  .on('broadcast', { event: 'INSERT' }, () => setNewCount((c) => c + 1))
  .on('broadcast', { event: 'UPDATE' }, (payload) => {
    const next = payload.payload?.record as { id?: string; status?: string }
    if (next?.id && next.status && next.status !== 'active') {
      setRemovedIds((prev) => new Set(prev).add(next.id as string))
    }
  })
  .subscribe(/* mêmes états CHANNEL_ERROR/TIMED_OUT/CLOSED → realtimeLost */)
```
> ⚠️ La forme du payload Broadcast (`payload.payload.record` / `.old_record`) **diffère** de `postgres_changes` (`payload.new` / `payload.old`). Le mapping côté client doit être adapté — vérifier le shape réel au runtime (Assumption A4).

### Anti-Patterns to Avoid
- **`CREATE INDEX CONCURRENTLY` dans `apply_migration`** : si `apply_migration` enveloppe en transaction → `CONCURRENTLY` échoue (`25001`). Utiliser `execute_sql` par statement (voir §Exécution MCP).
- **`GRANT SELECT` direct sur la matview** : pas de RLS sur les matviews → fuite cross-rôle. Toujours wrapper.
- **Wrapper une comparaison de colonne** : `(select user_id = auth.uid())` est faux ; wrapper seulement `auth.uid()`.
- **Garder `REPLICA IDENTITY FULL` + publication `supabase_realtime` pour `trade_setups` une fois sur Broadcast** : Broadcast lit `realtime.messages`, pas le WAL postgres_changes → ces deux éléments deviennent superflus pour ce flux (voir Runtime State Inventory).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache du résultat de fonction RLS par requête | Variable de session / table de cache | `(select fn())` InitPlan | Mécanisme planner natif, zéro code. [VERIFIED: docs Supabase] |
| Pousser un event Realtime léger | File maison / polling | `realtime.broadcast_changes()` trigger | Pattern officiel « Broadcast from Database », messages auto-purgés à 3 jours. [VERIFIED: docs Supabase] |
| Refresh matview sans bloquer les lectures | DROP+CREATE / lock manuel | `REFRESH MATERIALIZED VIEW CONCURRENTLY` (+ unique index) | Natif, pas de verrou exclusif de lecture. [CITED: Postgres docs] |
| Détecter les policies non optimisées | Audit manuel | `get_advisors(performance)` lint `auth_rls_initplan` | Advisor Supabase natif = critère de done D-01. [VERIFIED: docs database-advisors] |

**Key insight :** Tout dans cette phase a une primitive Postgres/Supabase dédiée. Le seul code « maison » est la **définition métier** de la matview MRR et la **réécriture du composant client** du badge.

## Runtime State Inventory

> Phase de refactor DB (modifie RLS existante + migre un flux Realtime live). Inventaire requis.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Aucune donnée à migrer.** Les wraps RLS et index ne modifient AUCUNE ligne ; la matview MRR est dérivée (recalculable). Le projet est **non `link`é** localement → pas de seed local à resynchroniser. | none |
| Live service config | **Publication `supabase_realtime`** contient `public.trade_setups` (ajouté par 0011, idempotent). **REPLICA IDENTITY FULL** sur `trade_setups` (0011). Une fois sur Broadcast, ces deux items deviennent **superflus pour ce flux** (Broadcast lit `realtime.messages`, pas le WAL). **D-04 demande de réévaluer.** ⚠️ Vérifier LIVE via `execute_sql` qu'aucun AUTRE consommateur `postgres_changes` ne dépend de la publication avant de retirer. | API/SQL : `ALTER PUBLICATION supabase_realtime DROP TABLE public.trade_setups;` + `ALTER TABLE public.trade_setups REPLICA IDENTITY DEFAULT;` — **seulement après** confirmation qu'aucun autre flux n'en dépend (Assumption A3). |
| OS-registered state | **Aucun.** Pas de Task Scheduler / pm2 impacté par cette phase (le refresh matview n'est pas encore ordonnancé — Open Question). | none |
| Secrets/env vars | **Aucun.** Pas de nouvelle clé. Le client Realtime utilise la session cookie existante (`createBrowserSupabaseClient`). Note 2026 : Supabase déprécie les legacy keys fin 2026 (`sb_publishable_*`/`sb_secret_*`) — **hors scope P17**, à surveiller. | none |
| Build artifacts | **`packages/supabase/database.types.ts`** : régénéré via MCP `generate_typescript_types` puis **édité à la main** (projet non linké → réappliquer les alias maison + overrides `*_atomic`→string, cf. en-tête 0016). La matview/le wrapper `get_mrr()` ajoutent de nouveaux types à réintégrer. | Édition manuelle de `database.types.ts` post-migration (D-05). |

**Nothing found in category :** Stored data, OS-registered state, Secrets → confirmés vides pour le périmètre P17.

## Common Pitfalls

### Pitfall 1 : `apply_migration` enveloppe `CONCURRENTLY` en transaction → échec `25001`
**What goes wrong :** `CREATE INDEX CONCURRENTLY` lancé dans une transaction lève `CREATE INDEX CONCURRENTLY cannot run inside a transaction block`.
**Why :** `apply_migration` peut wrapper le SQL en tx (comportement à confirmer LIVE — Assumption A2). `CONCURRENTLY` est non transactionnel par nature.
**How to avoid :** Exécuter **chaque** `CREATE INDEX CONCURRENTLY` isolément via `execute_sql` (un appel = un statement, hors tx), JAMAIS groupés ni dans `apply_migration`. Mettre la partie A (DDL transactionnel) dans `apply_migration`, la partie B (index concurrents) en `execute_sql` per-statement.
**Warning signs :** Erreur `25001` ; index `INVALID` dans `pg_index`.

### Pitfall 2 : Index `INVALID` après `CONCURRENTLY` échoué
**What goes wrong :** Un `CREATE INDEX CONCURRENTLY` interrompu laisse un index **`INVALID`** (pas de rollback propre) qui consomme de l'espace, n'est pas utilisé par le planner, et **bloque la recréation du même nom**.
**How to avoid :** Détecter puis nettoyer avant de relancer :
```sql
-- Détection des index invalides :
select c.relname as index_name, t.relname as table_name
from pg_index i
join pg_class c on c.oid = i.indexrelid
join pg_class t on t.oid = i.indrelid
where not i.indisvalid and c.relnamespace = 'public'::regnamespace;
-- Nettoyage (hors tx également) :
drop index concurrently if exists <index_name>;
-- puis relancer le CREATE INDEX CONCURRENTLY.
```
**Warning signs :** `pg_index.indisvalid = false` ; `EXPLAIN` ignore l'index attendu.

### Pitfall 3 : Wrap RLS appliqué à une expression corrélée à la ligne
**What goes wrong :** Wrapper `(select user_id = auth.uid())` casse la corrélation → résultat constant/incorrect, ou l'advisor reste rouge.
**How to avoid :** Wrapper **uniquement** la fonction non corrélée (`auth.uid()`, `is_superadmin()`, `has_active_subscription()`). Garder la comparaison de colonne hors du `select`. Re-vérifier chaque policy avec `get_advisors(performance)` après application.

### Pitfall 4 : Parité Broadcast incomplète (perte du filtrage abonné + shape payload)
**What goes wrong :** (a) Oublier la policy RLS sur `realtime.messages` → un non-abonné reçoit les events (régression sécurité vs postgres_changes filtré). (b) Lire `payload.new` au lieu de `payload.payload.record` → le badge ne se met jamais à jour.
**How to avoid :** Reproduire la barrière abonné via une policy `realtime.messages` (`has_active_subscription()`) ; vérifier le shape réel du payload Broadcast au runtime ; conserver la logique INSERT(newCount++)/UPDATE(removedIds) existante de `SignalList.tsx`.
**Warning signs :** Badge muet ; un compte non-abonné voit le compteur grimper (fuite).

## Code Examples

Voir §Architecture Patterns (1–4) — tous les patterns SQL/TS y figurent avec source vérifiée.

### Exécution CONCURRENTLY via MCP (D-05)
```
1. apply_migration("0017_scalable_foundation", <SQL Partie A transactionnel>)
2. Pour chaque index concurrent (Partie B), un appel séparé :
   execute_sql("create unique index concurrently mv_mrr_month_idx on public.mv_mrr (month);")
   execute_sql("create index concurrently payments_user_id_idx on public.payments (user_id);")
   ...
   → après CHAQUE appel : vérifier indisvalid (requête Pitfall 2). Si INVALID → drop concurrently + relancer.
3. generate_typescript_types → éditer database.types.ts à la main.
4. get_advisors(performance) → DOIT être 0 auth_rls_initplan (gate D-01).
   get_advisors(security) → pas de NOUVELLE alerte (les 2 WARN security-definer helpers sont EXPECTED, cf. STATE D-01-01-D).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `postgres_changes` + REPLICA IDENTITY FULL + publication | `realtime.broadcast_changes()` trigger + canal privé | Recommandation Supabase actuelle (« Broadcast for most use cases ») | Plus de filtrage RLS par-message-par-subscriber (goulot mono-thread à 10k). |
| `auth.uid() = user_id` nu en RLS | `(select auth.uid()) = user_id` | Documenté par l'advisor `auth_rls_initplan` | Jusqu'à 100× sur tables >10k lignes. |
| OFFSET / `.range()` | Keyset `(sort,id) > (…)` + index composite | Pattern scalabilité confirmé | Temps constant vs dégénérescence linéaire en pages profondes. |

**Deprecated/outdated :**
- Pour ce flux, **REPLICA IDENTITY FULL + publication `supabase_realtime` sur `trade_setups`** deviennent superflus une fois sur Broadcast (à retirer après vérif, D-04).
- Legacy API keys Supabase : dépréciées fin 2026 (`sb_publishable_*`/`sb_secret_*`) — **hors scope P17**, noté pour suivi.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Définition MRR = `sum(payments.expected_amount_atomic) filter verified` groupé par mois sur abonnés actifs | Pattern 3 / Matview | La définition métier du MRR (expected vs amount constaté, période, plans) n'est pas verrouillée → matview de référence à re-valider avec le fondateur AVANT de figer `0017`. Impact : re-travail si la formule bouge. |
| A2 | `apply_migration` enveloppe le SQL dans une transaction (donc `CONCURRENTLY` doit passer par `execute_sql`) | Pitfall 1 / Exécution MCP | Si `apply_migration` n'enveloppe PAS, la séparation reste correcte mais sur-prudente (zéro coût). À confirmer LIVE par un test `CREATE INDEX CONCURRENTLY` via chaque chemin. |
| A3 | Aucun autre consommateur `postgres_changes` ne dépend de la publication/REPLICA IDENTITY de `trade_setups` hors le badge | Runtime State Inventory | Si un autre flux en dépend, retirer la publication casserait ce flux. Vérifier via grep client (`postgres_changes` + `trade_setups`) + `pg_publication_tables` LIVE avant retrait. |
| A4 | Le payload Broadcast expose le record sous `payload.payload.record` / `.old_record` | Pattern 4 client | Mauvais mapping → badge muet. À vérifier au runtime sur le 1er event réel. |
| A5 | Indexer `user_id` sur `payments`/`subscriptions` suffit pour les policies (FK déjà présentes mais sans index dédié sur la colonne de policy) | §Inventaire policies | Si une colonne de policy reste non indexée, l'advisor le signalera (le gate `get_advisors` rattrape). Risque faible. |

## Open Questions

1. **Ordonnancement du `REFRESH` de la matview MRR**
   - Ce qu'on sait : `refresh_mv_mrr()` est créée en P17 ; `REFRESH CONCURRENTLY` exige le unique index (posé en P17).
   - Ce qui est flou : QUI déclenche le refresh (pg_cron ? Edge Function ? job tsx ? à la lecture si stale ?). Pas tranché dans CONTEXT.md.
   - Recommandation : Phase 17 **pose la fonction** ; l'ordonnanceur est défini en Phase 20 (ADASH consomme le MRR) ou Phase 18 (seed déclenche un premier refresh). Ne PAS bloquer P17 dessus.

2. **Topic Broadcast : fixe partagé vs par-record**
   - Le badge est un **fan-out global** (« N nouveaux signaux ») → un **topic fixe** (`topic:new-signals`) est correct et plus simple qu'un topic par-record. La discrétion CONTEXT.md (« canal privé vs topic léger ») penche vers topic fixe + canal privé. Recommandation : topic fixe `new-signals`, canal privé.

3. **Liste exacte des index keyset (colonnes de tri par liste)**
   - signaux/`trade_setups` : `(created_at desc, id desc)` (feed « plus récents ») — un index `trade_setups_score_idx (opportunity_score desc, created_at desc)` existe déjà (0006) mais sans `id` en tiebreaker → ajouter le composite keyset.
   - users/`profiles` : `(created_at desc, id desc)`.
   - paiements/`payments` : `(created_at desc, id desc)` ; `payments_status_created_idx (status, created_at desc)` existe (0012) mais sans `id`.
   - À confirmer avec l'`ORDER BY` réel des listes Phase 19/20 ; P17 pose les composites les plus probables, EXPLAIN au gate valide l'absence de tri.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase MCP (`apply_migration`/`execute_sql`/`get_advisors`/`generate_typescript_types`) | D-01..D-05 | ✓ configuré | hosted (`project_ref=csotpitrjxryjkadyiml`) | aucun — canal d'application obligatoire |
| Postgres `REFRESH MATERIALIZED VIEW CONCURRENTLY` | D-02 | ✓ (Postgres 15+) | — | — |
| `realtime.broadcast_changes()` | D-04 | ✓ (Supabase Realtime actuel) | — | postgres_changes (statu quo) si indispo — mais c'est ce qu'on fuit |
| `@supabase/supabase-js` Realtime privé (`setAuth`, `config.private`) | D-04 client | ✓ 2.108.0 | installé | — |

**Missing dependencies with no fallback :** Aucune.
**Note :** Les outils MCP Supabase ne sont **pas invocables depuis l'agent researcher** (restriction `tools:` frontmatter, bug upstream) → la vérification LIVE (advisors actuels, état publication/replica identity) est **déléguée au planner/exécutant** comme étapes explicites (cf. §Validation Architecture).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (unit/intégration) + Playwright 1.60.0 (E2E) |
| Config file | `vitest.config.ts` (racine) ; pas de `playwright.config` détecté sous `apps/web` (script `test:e2e` présent) |
| Quick run command | `pnpm test` (= `vitest run`) |
| Full suite command | `pnpm test && pnpm typecheck` (`tsc -b --noEmit`) |
| Glob inclus | `packages/**/*.test.ts`, `apps/**/__tests__/**`, `apps/web/src/lib/**/*.test.ts`, `apps/web/tests/**/*.test.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCALE-01 | `get_advisors(performance)` ne signale 0 `auth_rls_initplan` | LIVE/manuel (MCP) | `get_advisors(type=performance)` via MCP au gate | ❌ Wave 0 (gate manuel D-05) |
| SCALE-01 | Non-abonné lit toujours 0 ligne après wrap (pas de régression sécurité) | E2E/intégration anon-client | réutiliser `apps/web/tests/signals-rls.spec.ts` + `gating-rls` | ✅ existant (à re-run post-migration) |
| SCALE-02 | `EXPLAIN` liste cible = Index Scan, pas Seq Scan + Sort | LIVE/manuel (MCP) | `execute_sql("EXPLAIN <requête keyset>")` au gate | ❌ Wave 0 |
| SCALE-03 | `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr` réussit (unique index présent) ; `get_mrr()` interdit hors superadmin | LIVE + unit RLS | `execute_sql` refresh + test anon-client `get_mrr()` → 0 ligne | ❌ Wave 0 |
| SCALE-04 | Aucun index `INVALID` après application | LIVE/manuel | requête `pg_index.indisvalid=false` (Pitfall 2) | ❌ Wave 0 |
| SCALE-05 | Badge se met à jour via Broadcast ; non-abonné ne reçoit pas les events | E2E (Playwright, Realtime live) | `apps/web/test:e2e` ciblant le badge | ⚠️ Manual-Only probable (Realtime live, cf. STATE P03 deferred) |

### Sampling Rate
- **Per task commit :** `pnpm test` (Vitest — rapide ; couvre les tests RLS anon-client existants).
- **Per wave merge :** `pnpm test && pnpm typecheck`.
- **Phase gate (D-05) :** `get_advisors(performance)` **0** `auth_rls_initplan` + `EXPLAIN` index scan sans tri (3 listes) + `REFRESH CONCURRENTLY` OK + 0 index INVALID + tests RLS anon-client verts.

### Wave 0 Gaps
- [ ] `apps/web/tests/mrr-gating.test.ts` — `get_mrr()` via client anon → 0 ligne (couvre SCALE-03 gating ; mirroir des tests RLS existants).
- [ ] Script de gate SQL réutilisable (commenté dans `0017`) : détection index INVALID + EXPLAIN des 3 listes (couvre SCALE-02/04, exécuté via MCP `execute_sql`).
- [ ] Validation Broadcast (SCALE-05) : **Manual-Only justifié** — exige Realtime live + session abonné (même dépendance que P03 deferred, STATE). Documenter en `HUMAN-UAT`.
- [ ] Pas de nouveau framework à installer — Vitest + Playwright déjà en place.

*(Les vérifications `get_advisors`/`EXPLAIN`/`REFRESH`/`indisvalid` ne sont pas automatisables en Vitest CI sans connexion DB ; elles sont des **gates MCP manuels** exécutés par l'opérateur — cohérent avec le modèle D-05 du projet.)*

## Security Domain

> `security_enforcement` non désactivé → section requise.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | RLS = barrière non contournable (front client anon) ; DB = frontière producteur unique. |
| V4 Access Control | **yes (cœur)** | RLS wrap `(select …)` préserve l'isolation ; matview gated `is_superadmin()` via wrapper SECURITY DEFINER ; Broadcast gated via RLS `realtime.messages`. |
| V5 Input Validation | partiel | DDL only ; pas d'entrée utilisateur nouvelle. `search_path` figé sur toutes les nouvelles fonctions (Pitfall 6 projet). |
| V6 Cryptography | no | Aucune crypto introduite. |
| V7 Errors/Logging | partiel | `get_advisors` au gate ; pas de fuite via messages d'erreur de migration. |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Régression RLS au drop/recreate de policy (un wrap mal écrit ouvre la lecture) | Elevation/Info Disclosure | Re-run tests anon-client (non-abonné→0 ligne) + `get_advisors(security)` post-migration ; NOMS EXACTS de policy (un nom erroné fait échouer la migration — pattern 0009/0011). |
| Matview lue sans garde (pas de RLS sur matviews) | Info Disclosure | Wrapper `SECURITY DEFINER` + garde `is_superadmin()` + `revoke from public,anon` + `grant authenticated` (miroir helpers 0008). |
| Broadcast écouté par un non-abonné (fuite de la primeur signaux) | Info Disclosure | Policy RLS sur `realtime.messages` répliquant `has_active_subscription()` — parité avec le filtre postgres_changes retiré. |
| `search_path` hijack sur nouvelles fonctions SECURITY DEFINER | Tampering/Elevation | `set search_path = public` figé (Pitfall 6 projet, advisor `function_search_path_mutable`). |
| Fonction de refresh appelable par un client | Tampering | `revoke execute on refresh_mv_mrr() from public, anon, authenticated` (service_role/job uniquement). |

## Sources

### Primary (HIGH confidence)
- [Supabase — RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — wrap `(select auth.uid())` InitPlan, index colonnes de policy 100×, helpers STABLE. **Vérifié 2026-06-24.**
- [Supabase — Subscribing to Database Changes / Broadcast from Database](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes) — `realtime.broadcast_changes()` trigger, canal privé, policy `realtime.messages`, client `config.private`+`setAuth`. **Fetch + extraction du SQL/JS exacts 2026-06-24.**
- [Supabase — Broadcast](https://supabase.com/docs/guides/realtime/broadcast) — Broadcast recommandé > postgres_changes à l'échelle ; messages auto-purgés 3 jours.
- [Supabase — Database Advisors (`auth_rls_initplan`)](https://supabase.com/docs/guides/database/database-advisors?lint=0003_auth_rls_initplan) — lint critère de done D-01.
- Migrations du repo inspectées : `0001/0003/0006/0008/0009/0010/0011/0012/0014/0016` (schémas, RLS, helpers, index existants, convention MCP). `apps/web/src/components/signals/SignalList.tsx` + `RealtimeBadge.tsx` (wiring postgres_changes actuel). `vitest.config.ts`, `.mcp.json`. **HIGH (source projet directe).**

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` (Pitfalls 5/8/9/10) — recoupé avec docs officielles.
- [DEV — 76 RLS policies rewritten / auth.uid() init-plan trap](https://dev.to/arvavit/76-rls-policies-rewritten-in-one-migration-the-authuid-init-plan-trap-in-supabase-4hg) — confirme l'approche « tout en une migration ».

### Tertiary (LOW confidence)
- Aucune (toutes les mécaniques verrouillées sont sourcées HIGH).

## Metadata

**Confidence breakdown :**
- Standard stack : HIGH — zéro nouvelle dépendance, primitives Postgres/Supabase natives vérifiées.
- Architecture (wrap RLS, keyset, matview, Broadcast, CONCURRENTLY) : HIGH — SQL/JS exacts extraits des docs officielles + migrations du repo.
- Pitfalls : HIGH — chaque piège a une mitigation native et un gate (`get_advisors`/`EXPLAIN`/`indisvalid`).
- Définition métier MRR + ordonnancement refresh : MEDIUM — laissés à confirmation (Assumptions A1, Open Question 1).

**Research date :** 2026-06-24
**Valid until :** ~2026-07-24 (stable ; Supabase Realtime/RLS évoluent lentement — surveiller la dépréciation legacy keys fin 2026, hors scope P17).
