# Pitfalls Research — v3.0 (DS dark néon unique · dashboards user/superadmin · scalabilité Supabase 10k+ sur données seedées)

**Domain:** Plateforme SaaS Next.js 15 (App Router/RSC) + Supabase (RLS multi-tenant, Realtime) — ajout d'une refonte design system « dark unique », dashboards user/superadmin, et durcissement scalabilité 10k+ users sur données seedées.
**Researched:** 2026-06-22
**Confidence:** HIGH (Supabase/Postgres officiel + code landing existant inspecté) ; MEDIUM sur seuils chiffrés de bascule (dépendent de la taille de compute Supabase non profilée).

> Ce milestone AJOUTE du neuf à un système livré (v2.0/v2.1 : RLS stricte prouvée, next-intl fr/en/ar RTL, Tailwind v4 logical-props, DS landing scopé `.nxl`, gardes text-scan no-perf-claims/no-mera-brand/rtl-logical-props/lint:i18n). Les pièges ci-dessous sont des **risques d'intégration** — régression de l'existant, pas erreurs from-scratch.

---

## Critical Pitfalls

### Pitfall 1: Dé-scopage de `.nxl` qui casse globalement à la promotion en DS dark unique

**What goes wrong:**
Le DS de la landing vit aujourd'hui **entièrement préfixé `.nxl`** (`nexa-landing.css` : `.nxl { … }`, `.nxl[data-theme="green"|"volt"]`, `.nxl .btn`, etc. — vérifié, l'en-tête du fichier dit littéralement « TOUT est scopé sous `.nxl` pour ne JAMAIS fuiter »). Promouvoir cette identité en DS global = retirer le préfixe et/ou monter les tokens dans `:root`. Un retrait mécanique des `.nxl` fait déborder les variables `--bg/--text/--primary/--surface` sur toute l'app et écraser les tokens institutionnels light/dark des phases 10-11, cassant chaque page reskinée simultanément. Pire : les deux systèmes de tokens coexistent un temps (DS institutionnel `--accent-brand`/`--risk-moderate` + DS `.nxl`) → cascade imprévisible, dernière règle gagnante.

**Why it happens:**
On traite « promouvoir » comme un find/replace `.nxl ` → ``. Mais `.nxl` portait à la fois le **scope** ET le **thème par défaut** (les deux thèmes sont `.nxl[data-theme=…]`). Sans `.nxl`, plus de sélecteur de thème → tokens nus.

**How to avoid:**
- Migrer les tokens vers `:root` (ou `html[data-theme]`) de façon **explicite**, pas par suppression du préfixe. Choisir UN thème par défaut (green ou volt) promu en `:root`, l'autre reste opt-in `data-theme`.
- **Supprimer le DS light/dark institutionnel dans la même phase** (pas après) : ne jamais laisser les deux jeux de tokens vivre ensemble. Grep `--accent-brand|--risk-moderate` résiduel = 0 = critère de done.
- Une feuille « reset/tokens » unique, importée une fois, ordre déterministe.

**Warning signs:**
Couleurs qui « clignotent » selon l'ordre de montage des composants ; une page correcte en isolation mais cassée intégrée ; `color-mix(in oklch, var(--bg)…)` rendu transparent (var manquante → fallback).

**Phase to address:** Phase « Design system v3 (fondation tokens) » — AVANT tout reskin de page.

---

### Pitfall 2: Régression de contraste/accessibilité en passant en dark unique

**What goes wrong:**
Les pages institutionnelles ont été conçues/testées en light. En dark néon (`--bg: #070b08`, accents OKLCH très saturés `oklch(0.84 0.18 150)`), des composants reskinés perdent le ratio AA : texte `--sub`/`--mute` (déjà à 40-64 % d'opacité dans le CSS landing) sur surfaces translucides `rgba(255,255,255,0.035)`, focus rings invisibles, glow néon qui réduit la lisibilité du texte au-dessus. Le RTL arabe (Noto Sans Arabic) a des hauteurs de glyphe différentes → contraste perçu encore plus faible.

**Why it happens:**
Le néon est superbe en hero/marketing mais agressif en surfaces denses (tableaux admin, listes de signaux). Les opacités `--mute: …/0.4` passent sous 4.5:1 sur fond sombre.

**How to avoid:**
- Tokens de texte sémantiques à **contraste garanti** (`--text-primary` ≥ 4.5:1, `--text-secondary` ≥ 4.5:1, `--text-disabled` ≥ 3:1) mesurés sur `--bg` ET `--surface-solid`.
- Audit contraste automatisé (axe-core/Playwright) sur pages denses (dashboard, tables) en dark, pas seulement la landing.
- Focus-visible **toujours** sur token néon plein (`--primary`), jamais sur surface translucide.

**Warning signs:**
Texte secondaire « qui disparaît » sur les cartes ; reviewers qui zooment ; échec axe-core color-contrast.

**Phase to address:** Phase « Design system v3 » (tokens + audit a11y) ; re-vérifié à chaque phase de reskin.

---

### Pitfall 3: Collisions d'utilitaires Tailwind (`ring`, etc.) entre DS néon et classes globales

**What goes wrong:**
Collision déjà rencontrée dans ce projet sur `ring`. En Tailwind v4, l'utilitaire `ring`/`ring-*`/`shadow` et les box-shadows custom du néon (`box-shadow: 0 0 22px var(--glow)`) se marchent dessus : une carte qui définit son glow via une classe utilitaire le perd dès qu'un `ring-1` focus s'applique (même propriété `box-shadow`). Idem `outline` vs glow. Au reskin transversal, on multiplie ces superpositions sur des centaines de composants.

**Why it happens:**
`ring` et les ombres néon écrivent toutes `box-shadow`. Tailwind v4 compose les ombres via custom properties (`--tw-ring-shadow`, `--tw-shadow`) ; un glow posé en CSS brut hors de ce mécanisme l'écrase ou est écrasé selon spécificité/ordre `@layer`.

**How to avoid:**
- Exprimer le glow néon **via le système Tailwind v4** (`@theme` / `--tw-shadow` ou un utilitaire custom `shadow-glow`) pour qu'il compose avec `ring`, au lieu d'un `box-shadow` brut concurrent.
- Convention : focus = `ring` (token néon), élévation = `shadow-glow` ; ne jamais mélanger les deux mécanismes sur le même élément sans les composer.
- Respecter `@layer` Tailwind (base/components/utilities) pour une cascade déterministe.

**Warning signs:**
Glow qui disparaît au focus clavier ; ombre doublée/incohérente ; `!important` ajoutés pour « forcer » l'ombre (signal de collision).

**Phase to address:** Phase « Design system v3 » (conventions utilitaires + 1-2 reskins pilotes pour valider).

---

### Pitfall 4: Flash de thème (FOUC) au passage en dark unique + RTL

**What goes wrong:**
La landing gère déjà un toggle no-flash. En promouvant le DS global, si le thème dark n'est pas appliqué **avant le premier paint** (statique ou script bloquant `<head>`), flash blanc/light au chargement sur chaque page — régression vs ThemeToggle no-flash existant. Combiné au RTL (`dir=rtl` posé tard), double flash : couleurs + direction.

**Why it happens:**
RSC + hydratation : un thème géré côté client s'applique après hydratation. Dark unique devrait être **statique** (plus de toggle light/dark) → l'erreur est de garder une logique JS de thème devenue inutile.

**How to avoid:**
- Dark unique = poser `color-scheme: dark` + tokens en `:root` **statiquement** (pas de JS). Plus de toggle light/dark → plus de classe runtime à attendre.
- `dir`/`lang` déjà résolus serveur (un seul `<html lang dir>` — acquis v2.0). Ne pas régresser.
- Conserver le toggle **green/volt** seulement si voulu, via script inline pré-paint.

**Warning signs:**
Flash blanc sur navigation/refresh ; Lighthouse « avoid large layout shifts » ; thème correct seulement après ~100 ms.

**Phase to address:** Phase « Design system v3 » (stratégie thème statique) ; vérifié en E2E.

---

### Pitfall 5: RLS lente à l'échelle — `auth.uid()` non wrappé + colonnes de policy non indexées

**What goes wrong:**
Les policies existantes (`has_active_subscription()`, `is_superadmin()`, `auth.uid() = user_id`) sont fonctionnellement prouvées (non-abonné lit 0 ligne) mais **pas profilées en perf**. À 10k users + grosses tables (candles, signaux, prediction_outcomes), deux pièges : (1) `auth.uid()`/fonctions appelées **par ligne** au lieu d'une fois par requête ; (2) colonnes de policy (`user_id`, `instrument_id`, FK tenant) **sans index** → seq scan + ré-évaluation par ligne. Supabase documente jusqu'à **100×** en indexant la colonne de policy, et l'`initPlan` caching via `(select auth.uid())`.

**Why it happens:**
Une policy correcte sémantiquement passe les tests fonctionnels sans révéler le coût. Le coût n'apparaît qu'avec volume + `EXPLAIN ANALYZE`.

**How to avoid:**
- **Wrapper systématiquement** : `(select auth.uid())`, `(select is_superadmin())`, `(select has_active_subscription())` → initPlan caché par statement (valide car le résultat ne dépend pas de la ligne).
- **Indexer toute colonne de policy** : `user_id`, FK tenant, colonnes filtrées.
- Helpers `SECURITY DEFINER` + `STABLE` pour checks complexes (abonnement, rôle) → planner cache le résultat.
- Réécrire `auth.uid() IN (select … where x = table.col)` en `table.col IN (select … where user_id = (select auth.uid()))`.
- `EXPLAIN ANALYZE` sur requêtes clés (liste signaux gated, dashboard) + `get_advisors` (lint perf Supabase) = critère de done.

**Warning signs:**
`get_advisors` signale « auth_rls_initplan » ou policy sans index ; `EXPLAIN` montre Seq Scan + Filter répété ; latence dashboard ∝ nombre de lignes.

**Phase to address:** Phase « Scalabilité DB / audit RLS » — mais **chaque** phase ajoutant table/policy indexe + wrappe dès l'écriture.

---

### Pitfall 6: Fuite cross-tenant via la vue superadmin mal gatée (service_role / anon mal choisi)

**What goes wrong:**
Le dashboard superadmin doit voir TOUS les membres/affiliés/paiements → tentation d'utiliser le **service_role key** (bypass RLS total) côté serveur. Si la route admin n'est pas gatée par `requireRole('superadmin')` AVANT toute requête service_role, OU si une query service_role fuit dans un composant atteignable par un user normal, fuite cross-tenant massive (tout le `auth` schema, toutes les données). À l'inverse, client anon + RLS pour l'admin exige des policies superadmin sur chaque table — un oubli = page vide ou données partielles trompeuses. Le projet a déjà `gate.ts`/`is_superadmin()` ; le risque est de les contourner pour « simplifier » une nouvelle vue admin.

**Why it happens:**
service_role « marche tout de suite » (pas de policy à écrire) → raccourci tentant. Audit 2025 : la moitié des apps Supabase auditées exposaient service_role atteignable côté client.

**How to avoid:**
- **Défaut : client anon + RLS** même pour l'admin, via policies `(select is_superadmin())`. L'admin lit à travers RLS, pas à côté.
- service_role **uniquement** dans jobs serveur isolés (barrière double `server-only` + lint déjà en place — ne pas régresser). Jamais dans un RSC/route atteignable sans `requireRole` en première ligne.
- Toute nouvelle route `/admin/*` : `requireRole('superadmin')` en premier statement, 404 discret sinon (pattern T-04-ADMIN-ELEV déjà live-vérifié — réutiliser).
- Test E2E : user non-admin sur chaque nouvelle route admin → 404, 0 donnée.

**Warning signs:**
`createClient(…, SERVICE_ROLE_KEY)` dans un fichier non `server-only` ; route admin sans `requireRole` en tête ; lint service_role désactivé « temporairement ».

**Phase to address:** Phase « Dashboard superadmin » (gating + choix client) ; sécurité re-vérifiée avant clôture.

---

### Pitfall 7: N+1 / over-fetching RSC dans les dashboards

**What goes wrong:**
Les dashboards (user : vue d'ensemble, signaux suivis, abonnement, affiliation ; superadmin : membres, affiliés, paiements, signaux, santé) agrègent plusieurs sources. En RSC, tentation d'une requête par carte/section ou d'une boucle (pour chaque affilié → query ses commissions) = N+1. Sous RLS, chaque requête re-paie le coût de policy. Over-fetching : `select('*')` qui ramène colonnes lourdes/PII inutiles vers le client.

**Why it happens:**
RSC rend trivial le `await query()` par composant ; pas de batching par défaut. Chaque composant « se sert » indépendamment.

**How to avoid:**
- Agréger côté DB : vues / RPC `SECURITY DEFINER` retournant l'agrégat du dashboard en **une** requête (le projet a déjà des vues no-PII pour l'affiliation — étendre le pattern).
- `select` explicite des colonnes (jamais `*` vers le client) ; respecter les vues no-PII existantes.
- Paralléliser les fetchs indépendants (`Promise.all`) plutôt qu'en cascade.

**Warning signs:**
Logs Postgres : N requêtes quasi-identiques/page ; rendu dashboard ∝ nombre de lignes ; payload RSC volumineux.

**Phase to address:** Phases « Dashboard utilisateur » et « Dashboard superadmin ».

---

### Pitfall 8: Realtime qui sature — `postgres_changes` + RLS à l'échelle

**What goes wrong:**
L'espace membre utilise déjà Realtime (migration 0011 : replica identity FULL + publication, badge « N nouveaux signaux »). À 10k abonnés connectés, `postgres_changes` (1) **vérifie la RLS pour chaque change × chaque subscriber** sur un thread unique ordonné → goulot ; (2) `REPLICA IDENTITY FULL` alourdit le WAL (toute la ligne loggée). Une table à fort débit d'inserts surcharge le traitement WAL Realtime ; quotas « messages/s » et « peak connections » dépassés → projet throttlé/suspendu.

**Why it happens:**
Realtime via `postgres_changes` était parfait pour la démo (peu d'users). Il ne scale pas linéairement : filtrage RLS par message coûteux et mono-thread.

**How to avoid:**
- Pour le fan-out à grande échelle, préférer **Broadcast** (canal serveur poussant un message léger « nouveaux signaux ») plutôt que `postgres_changes` par client. Supabase recommande explicitement Broadcast > Postgres Changes à l'échelle.
- Garder `postgres_changes` seulement sur tables faible débit ; ne pas le brancher sur candles/haute fréquence.
- Limiter `REPLICA IDENTITY FULL` aux tables strictement nécessaires.
- Surveiller « Private Channel Subscription RLS Execution Time » + quotas Realtime.

**Warning signs:**
Déconnexions Realtime sous charge ; latence du badge qui grimpe ; alertes quota Supabase ; WAL qui gonfle.

**Phase to address:** Phase « Scalabilité DB » (audit Realtime + bascule Broadcast si nécessaire) ; tout nouveau Realtime des dashboards évalue Broadcast d'abord.

---

### Pitfall 9: Migrations bloquantes — `CREATE INDEX` (non concurrent) et `ALTER TABLE` lockants

**What goes wrong:**
L'audit scalabilité va **ajouter des index** sur colonnes de policy/tri (Pitfall 5). Un `CREATE INDEX` normal prend un **ACCESS EXCLUSIVE lock** = bloque lectures ET écritures pendant tout le build → dashboard gelé sur grosse table. De même certains `ALTER TABLE` (changement de type, contrainte validée immédiatement) lockent. Sur données seedées massives, ces locks sont visibles.

**Why it happens:**
Les migrations Supabase CLI s'exécutent dans une transaction par défaut ; `CREATE INDEX` y est implicite et lockant. On ne pense au lock qu'une fois la table grosse.

**How to avoid:**
- **`CREATE INDEX CONCURRENTLY`** pour tout index sur table volumineuse → SHARE UPDATE EXCLUSIVE, lectures/écritures continuent. **Mais : ne peut PAS tourner dans une transaction** → migration dédiée hors transaction.
- Gérer l'échec : un `CREATE INDEX CONCURRENTLY` qui échoue laisse un **index INVALID** à `DROP` puis recréer (pas de rollback propre).
- `ADD COLUMN` : default constant OK (Postgres ≥ 11 = métadonnée, non lockant) ; éviter default volatil. Contraintes en deux temps (`NOT VALID` puis `VALIDATE CONSTRAINT`).
- Prévoir ~1.5× la taille finale de l'index en disque avant un build concurrent.

**Warning signs:**
Requêtes en attente sur `ACCESS EXCLUSIVE` (pg lock waits) ; migration qui « hang » ; index `INVALID` dans `pg_index`.

**Phase to address:** Phase « Scalabilité DB » (toutes les migrations d'index/colonnes en mode non bloquant) ; convention pour toute migration future.

---

### Pitfall 10: Pagination OFFSET qui dégénère sur les listes longues

**What goes wrong:**
Listes de signaux/membres/paiements paginées en `LIMIT/OFFSET` (ou `.range()` Supabase = offset). Dégradation linéaire : page 1000 trie+jette 99 900 lignes (5 s+). `count: 'exact'` (fréquent pour « X résultats ») force un scan complet à chaque page. Correctness : insertions/suppressions entre deux pages décalent les lignes (doublons/sauts).

**Why it happens:**
`.range(start, end)` est l'API par défaut Supabase, parfaite à petite échelle. Le coût apparaît en pages profondes / grandes tables.

**How to avoid:**
- **Keyset/cursor pagination** : `WHERE (sort_field, id) > (last_value, last_id) ORDER BY sort_field, id LIMIT n` → temps constant, index scan. À privilégier pour infinite scroll / feeds.
- OFFSET seulement si saut à une page numérotée est requis (back-office) ET table bornée.
- `count: 'estimated'`/`'planned'` plutôt que `'exact'` quand un total approximatif suffit.
- Index composite sur `(sort_field, id)`.

**Warning signs:**
Latence ∝ numéro de page ; `EXPLAIN` : lignes scannées >> page size ; doublons/sauts en scroll.

**Phase to address:** Phases « Dashboards » (listes paginées) + « Scalabilité DB » (audit pagination).

---

### Pitfall 11: Connexions épuisées — pooler/Supavisor mal configuré côté RSC/serverless

**What goes wrong:**
Next.js en serverless (Vercel) ouvre beaucoup de connexions courtes. En connexion directe (port 5432) au lieu du **pooler transaction (Supavisor, 6543)**, on épuise vite la limite (« Max client connections reached »), surtout avec les jobs service_role concurrents. Piège associé : le pooler transaction **ne supporte pas les prepared statements** → erreurs avec certains clients/ORM SQL direct.

**Why it happens:**
supabase-js passe par PostgREST (HTTP, pas connexion directe) → souvent OK. Le risque vient des **jobs/scripts** (tsx) et de tout accès SQL direct (migrations, RPC lourdes) qui ouvrent des connexions réelles.

**How to avoid:**
- Accès applicatif via supabase-js/PostgREST (déjà le cas) — pas de connexion directe par requête.
- Jobs/scripts SQL : **pooler transaction (6543)** ; `prepare: false` si client SQL direct.
- Borner la concurrence des jobs (le projet utilise déjà `p-limit` côté data-sources — même discipline pour les accès DB).

**Warning signs:**
« Max client connections reached » ; « prepared statement does not exist » ; pics de connexions corrélés aux runs de jobs.

**Phase to address:** Phase « Scalabilité DB » (chaînes de connexion + bornage concurrence jobs).

---

### Pitfall 12: Seed massif incohérent (intégrité référentielle, RLS, réalisme)

**What goes wrong:**
Tout ce milestone repose sur **données seedées réalistes** (aucune API réelle). Pièges : (1) FK incohérentes (signal → instrument inexistant, paiement → user supprimé) → erreurs / dashboards vides ; (2) seed en **service_role** qui ignore la RLS → on ne teste jamais que les policies cachent/montrent correctement à 10k échelle ; (3) `created_at` tous identiques → keyset et tris invérifiables, Realtime/track record irréalistes ; (4) volumes trop faibles → les pièges perf (RLS, OFFSET, index) **restent invisibles** et le milestone « scalabilité » ne prouve rien ; (5) garde-fou produit : `pattern_stats`/% seedés respectent VITR-03 (jamais de % inventé non mesuré, seuil N≥30).

**Why it happens:**
Le seed est traité comme remplissage cosmétique, pas comme jeu de validation de scalabilité.

**How to avoid:**
- Seed **idempotent** (upsert sur clés naturelles — discipline déjà présente sur candles) + ordre topologique des FK.
- Volumes **représentatifs de 10k+ users** (assez de lignes pour révéler les pièges perf, sinon audit = faux positif).
- Distributions réalistes : `created_at` étalés, statuts variés (abonnés actifs/expirés/affiliés) pour tester tri/pagination/Realtime.
- Vérifier la RLS **après** seed depuis un client anon par rôle (un user voit ses lignes, pas celles des autres ; superadmin voit l'agrégat) — pas seulement depuis service_role.
- `% mesuré` du seed : N visible, jamais affirmé sans mesure (gardes no-perf-claims existantes).

**Warning signs:**
Dashboards vides/peu peuplés ; FK violations au seed ; perf « bonne » qui s'effondre dès les vraies données ; tri/pagination qui « marche » parce que tout est identique.

**Phase to address:** Phase « Seed de données » (en amont des dashboards + scalabilité — sinon rien à mesurer).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| service_role pour les dashboards admin (au lieu de RLS `is_superadmin()`) | Pas de policy à écrire, livre vite | Fuite cross-tenant si la route fuit ; bypass total de la défense en profondeur | **Jamais** pour une route atteignable ; uniquement jobs serveur isolés |
| `CREATE INDEX` non concurrent en migration | Migration simple, en transaction | Lock ACCESS EXCLUSIVE = downtime dashboard sur grosse table | OK sur tables petites/seed-only avant mise en charge |
| Pagination `.range()` (OFFSET) partout | API Supabase native, trivial | Dégénère en pages profondes ; correctness cassée sur tables mouvantes | OK back-office borné avec saut de page requis |
| Retrait mécanique du préfixe `.nxl` | « Promotion rapide » du DS | Débordement global des tokens, cascade imprévisible, deux DS coexistants | Jamais — migrer les tokens explicitement vers `:root` |
| Garder le JS de toggle de thème en dark unique | Réutilise l'existant | FOUC + complexité inutile (thème désormais statique) | Seulement si on garde la variante green/volt opt-in |
| `count: 'exact'` sur chaque liste paginée | Affiche « X résultats » | Scan complet par page sur grosse table | OK si total réellement nécessaire ET table bornée |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase RLS + nouvelles tables dashboard | Policy correcte mais colonne non indexée + `auth.uid()` non wrappé | `(select auth.uid())` + index sur colonne de policy dès la migration |
| Supabase Realtime (existant 0011) étendu aux dashboards | `postgres_changes` par client à 10k connexions | Broadcast (message serveur léger) ; `postgres_changes` réservé tables faible débit |
| Supabase migrations (CLI, en transaction) | `CREATE INDEX CONCURRENTLY` dans une migration transactionnelle → échoue | Migration dédiée hors transaction ; nettoyer les index INVALID |
| Tailwind v4 + glow néon | `box-shadow` brut en collision avec `ring`/`shadow` | Glow via système Tailwind (`shadow-glow`) pour composer avec `ring` |
| next-intl RTL (acquis) + reskin dark | Propriétés physiques (`left/right/margin-left`) réintroduites au reskin | Propriétés logiques (`inset-inline`, `margin-inline`) — garde `rtl-logical-props` existante |
| Supabase pooler (Supavisor) + jobs tsx | Connexion directe 5432 / prepared statements en transaction mode | Pooler transaction 6543, `prepare:false`, concurrence bornée (`p-limit`) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `auth.uid()` non wrappé en RLS | Latence ∝ nombre de lignes | `(select auth.uid())` + helpers STABLE | Tables > ~10k lignes |
| Colonne de policy non indexée | Seq scan + Filter répété (`EXPLAIN`) | Index sur user_id/FK tenant | Tables > ~10k lignes (jusqu'à 100× plus lent) |
| Pagination OFFSET profonde | Page N lente ∝ N | Keyset/cursor `(sort, id) > (…)` | Pages profondes / tables > ~100k lignes |
| `postgres_changes` Realtime fan-out | Déconnexions, latence badge, quota | Broadcast ; tables faible débit seulement | Milliers de subscribers / tables haut débit |
| N+1 RSC dashboard | N requêtes quasi-identiques/page | Vue/RPC agrégée, `Promise.all` | Dès que listes/agrégats croissent |
| `count:'exact'` par page | Chaque page scanne tout | `count:'estimated'` | Grosses tables |
| Connexions directes épuisées | « Max client connections » | Pooler transaction + bornage jobs | Pics serverless + jobs concurrents |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| service_role atteignable côté client/route non gatée | Fuite totale (toutes données + auth schema, cross-tenant) | service_role server-only isolé ; `requireRole` en 1ère ligne des routes admin |
| Vue superadmin sans policy `is_superadmin()` ni `requireRole` | Données cross-user exposées ou page admin trompeusement partielle | RLS `(select is_superadmin())` + gate route (réutiliser pattern T-04 live-vérifié) |
| Seed en service_role sans re-test anon | RLS jamais validée à l'échelle → fuite latente non détectée | Vérifier visibilité par rôle depuis client anon après seed |
| RLS « désactivée temporairement » pour debugger la perf | Fenêtre d'exposition | Profiler avec `EXPLAIN`/advisors, jamais en désactivant RLS |
| Realtime sur table sans policy couvrant le filtre d'abonnement | Push de lignes non autorisées | RLS sur chaque table exposée + policy couvrant le filtre |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Contraste néon insuffisant en surfaces denses | Texte secondaire illisible (tables admin, listes) | Tokens texte sémantiques ≥ 4.5:1 mesurés sur bg ET surface |
| FOUC light→dark à chaque navigation | Flash désagréable, perçu « cassé » | Dark statique en `:root` + `color-scheme: dark`, pas de JS |
| RTL régressé au reskin | Mise en page arabe cassée (signaux, dashboards) | Propriétés logiques partout (garde rtl-logical-props) |
| Glow qui disparaît au focus clavier | Focus invisible = a11y cassée | `ring` token néon dédié au focus, distinct du glow d'élévation |
| Dashboard vide à cause du seed incohérent | Produit semble buggé en démo | Seed FK-cohérent + volumes réalistes |

## "Looks Done But Isn't" Checklist

- [ ] **Promotion DS dark unique :** souvent il reste des tokens institutionnels light/dark — vérifier grep `--accent-brand|--risk-moderate` = 0, et que `.nxl` n'existe plus comme scope (tokens en `:root`).
- [ ] **RLS nouvelles tables :** souvent `auth.uid()` non wrappé / colonne non indexée — vérifier `get_advisors` (perf) PASS + `EXPLAIN ANALYZE` sur requêtes dashboard.
- [ ] **Route admin :** souvent `requireRole` absent en tête / service_role atteignable — vérifier E2E user non-admin → 404, 0 donnée.
- [ ] **Migrations d'index :** souvent non concurrentes — vérifier `CREATE INDEX CONCURRENTLY` hors transaction, aucun index `INVALID`.
- [ ] **Pagination :** souvent OFFSET partout — vérifier keyset sur feeds/longues listes, index `(sort, id)`.
- [ ] **Realtime étendu :** souvent `postgres_changes` au lieu de Broadcast — vérifier le mécanisme et les quotas.
- [ ] **Contraste dark :** souvent testé sur landing seulement — vérifier axe-core sur dashboards denses + RTL.
- [ ] **No-flash thème :** souvent JS résiduel — vérifier aucun FOUC au refresh/navigation.
- [ ] **Seed :** souvent volumes faibles / FK incohérentes — vérifier volumes 10k-représentatifs + visibilité RLS par rôle depuis anon.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Tokens DS débordés globalement | MEDIUM | Re-scoper les tokens en `:root` explicite, supprimer le 2e jeu, re-tester pages pilotes |
| RLS lente en prod | LOW-MEDIUM | Wrapper `(select …)`, ajouter index `CONCURRENTLY`, re-`EXPLAIN` |
| Fuite cross-tenant admin | HIGH | Auditer toutes routes service_role, ajouter `requireRole`+RLS, rotation clé si exposée, revue complète |
| Index INVALID après CONCURRENTLY échoué | LOW | `DROP INDEX` invalide, relancer `CONCURRENTLY` |
| OFFSET trop lent | LOW | Migrer la liste vers keyset, ajouter index composite |
| Realtime saturé | MEDIUM | Basculer `postgres_changes` → Broadcast, retirer REPLICA IDENTITY FULL superflu |
| Seed incohérent | LOW | Re-seed idempotent avec ordre FK + volumes corrects |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Dé-scopage `.nxl` / 2 DS coexistants | Design System v3 (fondation tokens) | grep tokens institutionnels = 0 ; `.nxl` scope supprimé ; pages pilotes OK |
| Contraste dark a11y | Design System v3 + re-check à chaque reskin | axe-core color-contrast PASS sur dashboards + RTL |
| Collision Tailwind `ring`/glow | Design System v3 (conventions) | Focus visible + glow coexistent sur composant pilote |
| FOUC thème dark | Design System v3 | E2E : aucun flash au refresh/navigation |
| RLS perf (wrap + index) | Scalabilité DB ; appliqué dès création table | `get_advisors` PASS + `EXPLAIN ANALYZE` |
| Fuite cross-tenant admin | Dashboard superadmin | E2E user non-admin → 404, 0 donnée |
| N+1 / over-fetch RSC | Dashboards (user + superadmin) | Logs : 1 requête agrégée/section ; `select` explicite |
| Realtime saturé | Scalabilité DB | Mécanisme Broadcast vérifié ; quotas surveillés |
| Migrations bloquantes | Scalabilité DB (+ convention globale) | `CREATE INDEX CONCURRENTLY` ; 0 index INVALID |
| Pagination OFFSET | Dashboards + Scalabilité DB | Keyset sur feeds ; index `(sort,id)` |
| Pooler/connexions | Scalabilité DB | Chaîne 6543 ; concurrence jobs bornée |
| Seed massif incohérent | Seed (amont des dashboards + scalabilité) | FK cohérentes + volumes 10k + RLS testée anon |

## Sources

- [Supabase — RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — `(select auth.uid())` initPlan, index colonnes de policy 100×, security definer STABLE — **HIGH**
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — service_role bypass, multi-tenant — **HIGH**
- [Supabase — Realtime Limits](https://supabase.com/docs/guides/realtime/limits) + [Benchmarks](https://supabase.com/docs/guides/realtime/benchmarks) + [Reports](https://supabase.com/docs/guides/realtime/reports) — quotas, RLS par message, Broadcast vs Postgres Changes — **HIGH**
- [Supabase — Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI) + [Supavisor 1.0](https://supabase.com/blog/supavisor-postgres-connection-pooler) — modes pooler, prepared statements, limites connexions — **HIGH**
- [PostgreSQL — CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html) + [Bytebase CONCURRENTLY guide](https://www.bytebase.com/blog/postgres-create-index-concurrently/) — ACCESS EXCLUSIVE vs SHARE UPDATE EXCLUSIVE, hors transaction, index INVALID — **HIGH**
- [Keyset vs OFFSET pagination (Stacksync)](https://www.stacksync.com/blog/keyset-cursors-postgres-pagination-fast-accurate-scalable) + [SupaExplorer cursor pagination](https://supaexplorer.com/best-practices/supabase-postgres/data-pagination/) — dégénérescence OFFSET, keyset constant-time — **MEDIUM** (recoupé multi-sources)
- [MakerKit — Supabase RLS multi-tenant production](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — fuite cross-tenant, service_role exposé — **MEDIUM**
- Code projet inspecté : `apps/web/src/components/landing/nexa-landing.css` (scope `.nxl`, thèmes green/volt OKLCH, opacités `--mute/--sub`) ; `.planning/PROJECT.md` (RLS prouvée, gardes existantes, migration 0011 Realtime, pattern T-04 admin) — **HIGH** (source projet)

---
*Pitfalls research for: ajout refonte DS dark + dashboards + scalabilité 10k sur plateforme Next.js 15 / Supabase RLS existante*
*Researched: 2026-06-22*
