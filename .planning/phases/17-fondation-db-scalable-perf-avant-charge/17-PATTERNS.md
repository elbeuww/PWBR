# Phase 17 : Fondation DB scalable (perf avant charge) — Pattern Map

**Mapped:** 2026-06-24
**Files analyzed:** 4 (1 nouvelle migration SQL multi-section, 1 réécriture composant client, 1 nouveau test, 1 édition manuelle de types)
**Analogs found:** 4 / 4 (toutes les briques ont un analog réel dans le repo — phase 100 % réutilisation de patterns existants)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0017_scalable_foundation.sql` (Partie A — transactionnel) | migration (RLS + matview + fn + trigger) | request-response / event-driven | `0016_affiliation.sql` (en-tête + RLS + vue + RPC SECURITY DEFINER) ; `0011_realtime_trade_setups.sql` (drop/recreate policy par NOM EXACT + DO-block idempotent publication) ; `0008`/`0009` (helpers SECURITY DEFINER) ; `0014` (vue agrégat gated) | exact (composite d'analogs par section) |
| `supabase/migrations/0017_*` (Partie B — `CREATE INDEX CONCURRENTLY` hors tx, via `execute_sql`) | migration (index) | batch | `0012_payments.sql` L.55-83 (3 `create index` dont composite `(status, created_at desc)`) ; `0006` L.86-87 (`trade_setups (opportunity_score desc, created_at desc)`) | role-match (existants NON concurrents et SANS `id` tiebreaker → ajouter le composite keyset) |
| `apps/web/src/components/signals/SignalList.tsx` (réécriture abonnement) | component (client) | event-driven (pub-sub) | lui-même L.73-114 (wiring `postgres_changes` actuel à remplacer par canal privé Broadcast) | exact (réécriture en place, mêmes états/handlers) |
| `apps/web/tests/mrr-gating.test.ts` (nouveau) | test (anon-client RLS/gating) | request-response | `apps/web/tests/signals-rls.spec.ts` L.48-76 (client anon nu → SELECT renvoie 0 ligne) | exact |
| `packages/supabase/database.types.ts` (édition manuelle post-migration) | config (build artifact) | n/a | en-tête `0016` L.7-11 (procédure `generate_typescript_types` → édition main + override string `*_atomic`) | exact (procédure rodée) |

> `apps/web/src/components/signals/RealtimeBadge.tsx` : **INCHANGÉ** (props `count`/`onReveal` stables — seule la SOURCE d'events change dans `SignalList`). Voir analog L.15-36.

---

## Pattern Assignments

### `0017` — Partie A §1 : Wrap RLS InitPlan (D-01, SCALE-01)

**Analog principal :** `0009_subscriptions_gating.sql` L.82-98 (drop/recreate policy par NOM EXACT) + `0012_payments.sql` L.91-105 (policy corrélée colonne) + `0008_profiles_role.sql` (helper réutilisé).

**Drop/recreate par NOM EXACT** (analog `0009` L.83-91 — un nom erroné fait échouer la migration) :
```sql
-- AVANT (réévaluée par ligne) — forme actuelle dans 0009 L.88-91 :
drop policy "trade_setups: abonnés actifs" on public.trade_setups;
create policy "trade_setups: abonnés actifs"
  on public.trade_setups
  for select to authenticated
  using (public.has_active_subscription());
-- APRÈS (InitPlan 1×/requête — wrap la fonction non corrélée) :
drop policy "trade_setups: abonnés actifs" on public.trade_setups;
create policy "trade_setups: abonnés actifs"
  on public.trade_setups
  for select to authenticated
  using ((select public.has_active_subscription()));
```

**Policy corrélée à une colonne** (analog `0012` L.97-100 — wrap SEULEMENT `auth.uid()`, garder la comparaison `user_id =`) :
```sql
-- 0012 actuel : using (user_id = auth.uid())  →  using (user_id = (select auth.uid()))
drop policy "payments: lire les siennes" on public.payments;
create policy "payments: lire les siennes"
  on public.payments
  for select to authenticated
  using (user_id = (select auth.uid()));
```

**Inventaire des NOMS EXACTS à drop/recreate** (lus dans les analogs — un nom erroné casse la migration) :
| Table | Policies (NOM EXACT, fichier:lignes) | Forme à wrapper |
|-------|--------------------------------------|-----------------|
| `trade_setups` | `"trade_setups: abonnés actifs"` (0009 L.88) | `(select has_active_subscription())` |
| `analyses` | `"analyses: abonnés actifs"` (0009 L.94) | `(select has_active_subscription())` |
| `candles` | `"candles: abonnés actifs"` (0011 L.63) | `(select has_active_subscription())` |
| `payments` | `"payments: insérer la sienne en pending"` (0012 L.92) ; `"payments: lire les siennes"` (0012 L.97) ; `"payments: superadmin voit tout"` (0012 L.102) | `(select auth.uid())` (insert+select) ; `(select is_superadmin())` |
| `subscriptions` | `"subscriptions: lire les siennes"` (0009 L.41) ; `"subscriptions: superadmin voit tout"` (0009 L.47) | `(select auth.uid())` ; `(select is_superadmin())` |
| `profiles` | `"profiles: lire le sien"` (0001 — référencé 0008 L.11) | `(select auth.uid())` |
| `prediction_outcomes` | `"prediction_outcomes: lecture authentifiés"` (0014 L.39, `using (true)` — pas de fn corrélée, rien à wrapper sauf advisor) | n/a / vérifier advisor |
| affiliation (6 tables) | `"affiliates: lire la sienne"`, `"… superadmin voit tout"`, `"affiliate_codes: lire les siens"`, `"affiliate_applications: superadmin voit tout"`, `"referrals: lire les siens"`, `"commissions: lire les siennes"`, `"payouts: lire les siens"` + variantes superadmin (0016 L.68-227) | wrap `auth.uid()` dans les sous-requêtes `where user_id = auth.uid()` et wrap `is_superadmin()` |

**Critère d'arrêt (gate D-01) :** `get_advisors(performance)` → 0 `auth_rls_initplan`.

---

### `0017` — Partie A §2 : Matview MRR + wrapper SECURITY DEFINER gated (D-02, SCALE-03)

**Analog principal :** `0008_profiles_role.sql` L.29-47 (helper `language sql stable security definer set search_path = public` + `revoke/grant`) + `0014` L.58-140 (vue agrégat) + `0016` L.236-362 (RPC SECURITY DEFINER + `revoke execute`).

**Helper de garde — calque EXACT de `is_superadmin()` (0008 L.29-47) :**
```sql
-- Lecture gated (les matviews N'ONT PAS de RLS) — wrapper obligatoire, jamais GRANT direct :
create function public.get_mrr()
  returns setof public.mv_mrr
  language sql
  stable
  security definer
  set search_path = public      -- figé (Pitfall 6 / advisor function_search_path_mutable, 0008 L.34)
as $$
  select * from public.mv_mrr where (select public.is_superadmin());
$$;
revoke execute on function public.get_mrr() from public, anon;   -- miroir 0008 L.46
grant execute on function public.get_mrr() to authenticated;     -- miroir 0008 L.47
```

**Fonction de refresh — lockée service_role (miroir `revoke` 0016 L.320/362) :**
```sql
create function public.refresh_mv_mrr()
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin refresh materialized view concurrently public.mv_mrr; end;
$$;
revoke execute on function public.refresh_mv_mrr() from public, anon, authenticated; -- service_role bypass uniquement
```

**Définition MRR :** squelette RESEARCH Pattern 3 (L.166-187) — colonnes atomiques `bigint`, agrège `payments`/`subscriptions`. ⚠️ **Assumption A1** : formule métier à valider avec le fondateur AVANT de figer (montant expected vs constaté). Note types : `*_atomic` → override `string` en TS (en-tête 0016 L.10-11).

> Le UNIQUE index requis pour `REFRESH CONCURRENTLY` va en **Partie B** (CONCURRENTLY hors tx).

---

### `0017` — Partie A §3 : Broadcast from Database (D-04, SCALE-05 — côté DB)

**Analog principal :** `0008`/`0009` (forme fonction SECURITY DEFINER `search_path` figé) + `0011_realtime_trade_setups.sql` (le flux à REMPLACER : `REPLICA IDENTITY FULL` L.37 + DO-block publication idempotent L.44-55) + `0009` L.79-80 (`has_active_subscription()` réutilisé dans la policy `realtime.messages`).

**Trigger function + policy `realtime.messages`** (RESEARCH Pattern 4, L.194-211) — la policy réplique la barrière abonné de l'ancien filtre `postgres_changes` :
```sql
create or replace function public.broadcast_trade_setup_changes()
  returns trigger security definer language plpgsql
  set search_path = public as $$   -- figé, miroir 0008 L.34
begin
  perform realtime.broadcast_changes('topic:new-signals', tg_op, tg_op,
    tg_table_name, tg_table_schema, new, old);
  return null;
end; $$;
create trigger trg_trade_setups_broadcast
  after insert or update on public.trade_setups
  for each row execute function public.broadcast_trade_setup_changes();
-- Parité sécurité : seul un abonné actif peut écouter (réplique l'ancien filtre RLS) :
create policy "broadcast: abonnés actifs écoutent new-signals"
  on realtime.messages for select to authenticated
  using ( (select public.has_active_subscription()) );  -- wrap InitPlan (cohérent §1)
```

**Réévaluation `REPLICA IDENTITY FULL` + publication (D-04)** — pattern DO-block idempotent de `0011` L.44-55 à inverser, **après** vérif LIVE qu'aucun autre consommateur n'en dépend (Assumption A3) :
```sql
-- seulement après confirmation (execute_sql sur pg_publication_tables) :
alter publication supabase_realtime drop table public.trade_setups;
alter table public.trade_setups replica identity default;
```

---

### `0017` — Partie B : Index keyset + UNIQUE matview (`CONCURRENTLY` hors tx, D-03/D-02/D-05)

**Analog principal :** `0012_payments.sql` L.55-83 (3 `create index`, dont composite `payments_status_created_idx (status, created_at desc)` L.82-83) + `0006` L.86-87 (`trade_setups_score_idx (opportunity_score desc, created_at desc)`).

**Écart à combler :** les index existants n'ont PAS `id` en tiebreaker ni `CONCURRENTLY`. Ajouter les composites keyset alignés `ORDER BY` (RESEARCH Pattern 2 L.158-160) :
```sql
-- exécutés UN PAR UN via execute_sql (JAMAIS apply_migration → Pitfall 1, erreur 25001) :
create unique index concurrently mv_mrr_month_idx on public.mv_mrr (month);          -- requis REFRESH CONCURRENTLY
create index concurrently trade_setups_keyset_idx on public.trade_setups (created_at desc, id desc);
create index concurrently profiles_keyset_idx     on public.profiles (created_at desc, id desc);
create index concurrently payments_keyset_idx      on public.payments (created_at desc, id desc);
-- index colonnes de policy (D-01) si non couverts (FK sans index dédié, Assumption A5) :
create index concurrently payments_user_id_idx      on public.payments (user_id);
create index concurrently subscriptions_user_id_idx on public.subscriptions (user_id);
```

**Détection/recovery INVALID** (Pitfall 2, RESEARCH L.271-281) après CHAQUE statement :
```sql
select c.relname from pg_index i
  join pg_class c on c.oid=i.indexrelid join pg_class t on t.oid=i.indrelid
  where not i.indisvalid and c.relnamespace='public'::regnamespace;
drop index concurrently if exists <name>;   -- puis relancer
```

**Vérification (gate D-03) :** `execute_sql("EXPLAIN <requête keyset>")` → `Index Scan`, PAS `Seq Scan` + `Sort`.

---

### `apps/web/src/components/signals/SignalList.tsx` (component, event-driven) — D-04 client

**Analog :** lui-même L.73-114 (le wiring `postgres_changes` à remplacer). **Conserver** : le client `createClient()` L.44 (porte la session pour Realtime Authorization), les états `newCount`/`removedIds`, la logique `revealNew` L.121-124, le bloc `subscribe` L.99-109 (états `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`/`SUBSCRIBED` → `realtimeLost`), le `removeChannel` cleanup L.111-113.

**Remplacer** le bloc `.channel('signals-active').on('postgres_changes', …)` par canal privé Broadcast (RESEARCH L.213-226) :
```typescript
await supabase.realtime.setAuth()  // requis pour canal privé (Realtime Authorization)
const channel = supabase
  .channel('topic:new-signals', { config: { private: true } })
  .on('broadcast', { event: 'INSERT' }, () => setNewCount((c) => c + 1))   // ⟵ remplace L.79-82
  .on('broadcast', { event: 'UPDATE' }, (payload) => {                      // ⟵ remplace L.84-98
    const next = payload.payload?.record as { id?: string; status?: string }
    if (next?.id && next.status && next.status !== 'active') {
      setRemovedIds((prev) => new Set(prev).add(next.id as string))
    }
  })
  .subscribe(/* MÊME callback états L.99-109 → realtimeLost */)
```
> ⚠️ **Shape payload DIFFÉRENT** (Pitfall 4 / A4) : Broadcast = `payload.payload.record` / `.old_record` ; `postgres_changes` = `payload.new` / `payload.old` (L.89 actuel). Vérifier au runtime sur le 1er event.

---

### `apps/web/tests/mrr-gating.test.ts` (test, anon-client RLS) — nouveau, SCALE-03

**Analog :** `apps/web/tests/signals-rls.spec.ts` L.48-76 (structure complète à mirrorer).

À copier (mêmes garde-fous) : header `test.skip(!SUPABASE_URL || !SUPABASE_ANON_KEY)` L.50-53 ; client anon NU `createClient(URL, ANON_KEY)` L.56 (JAMAIS service_role) ; `auth.signUp` → user authentifié sans privilège L.60-64 ; assert `error toBeNull` + résultat vide L.73-74. **Adaptation :** remplacer `.from('trade_setups').select…` par un appel RPC `.rpc('get_mrr')` → un non-superadmin doit recevoir 0 ligne (la garde `where (select is_superadmin())` filtre, pas une erreur).

---

## Shared Patterns

### En-tête de migration (convention MCP — CRITIQUE)
**Source :** `0016_affiliation.sql` L.1-54 (le plus complet) ; calque court `0011` L.1-32.
**Apply to :** `0017` (header).
Bloc obligatoire : « appliquée via MCP `apply_migration`, JAMAIS `db push` ; projet non `link`é → `database.types.ts` édité à la main APRÈS `generate_typescript_types` (override string `*_atomic`) » (0016 L.7-11). + section « Décisions couvertes » (D-01..D-05) + section « STRIDE » (0016 L.45-54). + ⚠️ numéro = `0017` (dernière sur disque = `0016` ; `0013` ABSENTE/réservée, NE PAS réutiliser).

### Fonction SECURITY DEFINER (forme canonique)
**Source :** `0008_profiles_role.sql` L.29-47.
**Apply to :** `get_mrr`, `refresh_mv_mrr`, `broadcast_trade_setup_changes`.
```sql
language sql|plpgsql  [stable]  security definer  set search_path = public   -- figé (Pitfall 6)
-- + revoke execute from public, anon[, authenticated] ;  grant execute to <rôle minimal> ;
```

### Drop/recreate policy par NOM EXACT
**Source :** `0009` L.83-91 + `0011` L.60-66 (commentaire « NOM EXACT lu dans 0003 l.89 — un nom erroné fait échouer la migration »).
**Apply to :** toutes les policies wrappées en §1. Lire le NOM EXACT dans la migration d'origine avant chaque drop.

### Test anon-client (jamais service_role côté front)
**Source :** `signals-rls.spec.ts` L.55-56 + commentaire sécurité L.11-17.
**Apply to :** `mrr-gating.test.ts`.

---

## No Analog Found

Aucun. Toutes les briques de Phase 17 ont un analog réel dans le repo (phase de durcissement = réutilisation de patterns existants).

| Brique sans analog DIRECT (mais pattern dérivé d'un analog proche) | Note |
|---|---|
| `materialized view` (premier du projet) | Pas de matview existante, MAIS la **vue** `pattern_stats` (0014 L.58-140) et `affiliate_dashboard` (0016 L.372-393) fournissent la forme d'agrégat ; le wrapper gated calque `is_superadmin()` (0008). Le seul élément 100 % neuf = mot-clé `materialized` + `REFRESH CONCURRENTLY` (primitive Postgres native, RESEARCH Pattern 3). |
| `realtime.broadcast_changes()` trigger (premier Broadcast du projet) | Remplace `postgres_changes` (0011) ; forme trigger/fonction calquée sur les fonctions SECURITY DEFINER existantes. Primitive Supabase native (RESEARCH Pattern 4, vérifié docs). |

---

## Metadata

**Analog search scope :** `supabase/migrations/` (0006/0008/0009/0011/0012/0014/0016), `apps/web/src/components/signals/`, `apps/web/tests/`.
**Files scanned :** 9 (4 migrations lues intégralement, 2 grep ciblés sur 0006, 3 fichiers front/test).
**Pattern extraction date :** 2026-06-24
