# Phase 19: Dashboard utilisateur - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Livrer le groupe de routes `(dash)` membre complet (gate `requireUser`) — vue d'ensemble, signaux suivis/historique, watchlist, abonnement, affiliation (résumé), paramètres — sur le DS v3 et données seedées, en **agrégeant les surfaces déjà livrées sans les réimplémenter** (signaux, abonnement, affiliation existent déjà ; on les remonte dans le shell `(dash)`).

**Seule écriture front membre du milestone :** la watchlist (`user_followed_setups`) — 1re policy insert/delete scopée `auth.uid()`, sujette à revue IDOR.

**Reframe produit acté pendant la discussion :** il n'y a **pas de compte gratuit**. Tout utilisateur est un abonné payant. Le gate `requireUser` (et non `requireActiveSub`) sert uniquement à laisser entrer un abonné dont l'abonnement a **expiré** afin qu'il puisse renouveler (UDASH-04). Architecture globale = **3 dashboards distincts** : user (cette phase), affilié (route dédiée existante), admin (phase 20).

</domain>

<decisions>
## Implementation Decisions

### Navigation & structure du groupe `(dash)`
- **D-01:** Patron de navigation = **shell `(dash)` avec sidebar latérale persistante (desktop) + bottom-nav (mobile)**, listant les 6 onglets (overview, signaux suivis/historique, watchlist, abonnement, affiliation, paramètres). RTL-safe via propriétés logiques uniquement. Pas de néon sur la nav (lisibilité d'abord — DS v3 Tier App, cf. Phase 16 D-04/D-05).
- **D-02:** Agrégation = **le shell `(dash)` monte les composants existants** (`SignalList`, `RevenueTabs`, `ExpiryBanner`, etc.). **Zéro réimplémentation.** Les anciennes routes restent accessibles ou redirigent (décision de redirection laissée au planner). Le stub actuel `/dashboard` (liste `instruments`) est remplacé.

### Gating & non-abonné
- **D-03:** Gate `(dash)` = `requireUser` (auth seul). **Pas de compte gratuit** : un abonné **expiré** entre pour renouveler. Dans ce cas, l'overview montre statut « expiré » + CTA renouvellement ; les onglets signaux/watchlist affichent un état « renouvelle pour réaccéder » (la RLS renvoie 0 ligne — barrière réelle, jamais le gate UX seul). Ce n'est PAS un upsell « gratuit », c'est un état de **renouvellement**.

### Signaux suivis vs historique (UDASH-02)
- **D-04:** Modèle **source unique** : « Suivis » = ma watchlist de setups **ouverts** bookmarkés ; « Historique » = ces mêmes setups une fois **clôturés** (avec issue). Une seule donnée : `user_followed_setups` joint à `trade_setups`, filtré par statut. Scope strictement personnel. Pas de table view-log, pas d'archive globale.
- **D-05:** Pagination **keyset** (curseur) sur suivis et historique — câblage du curseur `(created_at desc, id desc)` aligné sur les index posés en Phase 17 (Partie B de `0017`). EXPLAIN attendu = index scan, pas seq+sort.

### Watchlist (UDASH-03 — seule écriture membre)
- **D-06:** Déclencheur = **icône étoile/bookmark toggle** sur chaque `SignalCard` (liste) **ET** dans le détail du trade. Toggle **optimiste** (react-query).
- **D-07:** Nouvelle table `user_followed_setups` (n'existe pas) → migration **`0020`** via MCP `apply_migration`. Policies insert/delete/select scopées `user_id = (select auth.uid())` (wrap InitPlan, Phase 17 D-01 ; colonne non wrappée — Pitfall 3). FK vers `trade_setups(id)` + `auth.users`/`profiles`. Index keyset `(user_id, created_at desc, id desc)` via `CONCURRENTLY`. **Test anti-IDOR** : client anon, un non-propriétaire écrit 0 ligne d'autrui (pattern Phase 18 D-07).

### Vue d'ensemble (UDASH-01)
- **D-08:** Hiérarchie = **abonnement + ExpiryBanner J-3/J-1 en tête** → 3-4 derniers signaux → raccourcis (watchlist, affiliation, paramètres). Aligne l'overview sur la valeur abonnement (rétention/renouvellement = le business).
- **D-09:** **Interdit : equity curve / P&L / ROI** (VITR-03 — chiffre non mesuré + promesse implicite). Tout % via `applyThreshold` + N + provenance.

### Affiliation (UDASH-05)
- **D-10:** Dans le user-dash = **carte résumé uniquement** (X abonnés ramenés, Y revenus **mesurés**), affichée **seulement si l'user est affilié**, avec lien vers le **dashboard affilié dédié** (route existante `affiliation/dashboard`, gate `requireRole('affiliate')`). Concilie « 3 dashboards séparés » + roadmap « intégré ». Pas d'onglet affiliation plein dans `(dash)`.

### Paramètres (UDASH-06)
- **D-11:** Contenu = **Compte** (email affiché, changement de mot de passe via Supabase auth) + **Langue & préférences** (sélecteur AR/EN/FR ; pas de toggle thème — `forcedTheme="dark"`) + **préférences Notifications (UI seule)** + **lien gestion abonnement** + **bouton déconnexion**.
- **D-12:** Notifications = **stockage de préférences UI uniquement** en Phase 19. L'infra d'envoi (email/push) n'existe pas → **hors scope** ; on ne livre pas de delivery, seulement l'écran de préférences.

### Claude's Discretion
- Choix de redirection des anciennes routes vs conservation (D-02) — laissé au planner.
- Encodage/décodage exact du curseur keyset (module helper à construire — n'existe pas en code).
- Décision libs : `react-table`/`react-virtual`/`nuqs` (absentes du `package.json`) vs réutilisation du pattern URL-state custom existant (`lib/signals/searchParams.ts`) — à trancher en recherche/plan.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & exigences
- `.planning/ROADMAP.md` §"Phase 19: Dashboard utilisateur" — goal, success criteria, notes (agréger sans réimplémenter, watchlist = seule écriture, anti-feature equity/ROI).
- `.planning/REQUIREMENTS.md` — UDASH-01 à UDASH-06 (texte complet des exigences).
- `.planning/PROJECT.md` — VITR-03 (% toujours mesuré), `<Disclaimer />` systématique, i18n AR/EN/FR RTL, pricing 9$/3$, affiliation 20% max.

### Décisions de phases antérieures à respecter
- `.planning/phases/16-reskin-transversal-de-toutes-les-pages/16-CONTEXT.md` — DS v3 green-only dark (D-01/D-03), Tier App lisibilité d'abord (D-04/D-05), fetch anon-client RLS jamais service_role (D-12), % via applyThreshold (D-13), score=anneau couleur=risque (D-11).
- `.planning/phases/17-fondation-db-scalable-perf-avant-charge/17-CONTEXT.md` — RLS InitPlan wrap `(select fn())` (D-01), index keyset `(created_at desc, id desc)` posés/câblage = ici (D-03), Realtime Broadcast topic `new-signals` (D-04).
- `.planning/phases/18-seed-de-donn-es-r-alistes-l-chelle/18-CONTEXT.md` — colonne `source` (`demo`/`backtest`/`live`), seed idempotent, pattern test anti-IDOR client anon (D-07). `user_followed_setups` NON seedé (à créer).

### Surfaces de code de référence (chemins exacts en code_context)
- Aucun ADR/spec externe supplémentaire — exigences entièrement capturées ci-dessus + dans les CONTEXT antérieurs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (à remonter dans le shell `(dash)`, NE PAS réimplémenter)
- `apps/web/src/app/[locale]/dashboard/page.tsx` — **stub à remplacer** (liste `instruments`).
- `apps/web/src/app/[locale]/(member)/signaux/page.tsx` + `[id]/page.tsx` — liste signaux + détail/chart. Composants `apps/web/src/components/signals/*` (`SignalList`, `FilterBar`, `CandleChart`, `SignalCard`, `ScoreRing`) ; queries `apps/web/src/lib/signals/queries.ts` + `searchParams.ts` (URL-state custom, **pas nuqs**).
- `apps/web/src/components/member/ExpiryBanner.tsx` — bandeau J-3/J-1 (`currentPeriodEnd`, ICU `payment.expiryBanner`, CTA `/tarifs`), déjà tokenisé.
- `apps/web/src/app/[locale]/(account)/abonnement/page.tsx` (+ `(account)/layout.tsx`, gate `requireUser`) — gestion abonnement.
- `apps/web/src/app/[locale]/affiliation/dashboard/page.tsx` — dashboard affilié no-PII (gate `requireRole('affiliate')`, vue `affiliate_dashboard` security_invoker, composant `RevenueTabs`, montants atomiques BigInt). À LIER depuis la carte résumé (D-10).
- `apps/web/src/components/ui/*` (shadcn vendored tokenisés : Card, Badge, Table, Progress, Tooltip, Alert, Button, Sonner).
- `@app/core` : `applyThreshold`, `formatAtomic`, `TIERS`, `affiliateRateBps`. `@app/supabase` : repos typés.

### Established Patterns (contraignent cette phase)
- **Gate helper** `apps/web/src/lib/auth/gate.ts` : `requireUser()` ← gate `(dash)`, `requireActiveSub()`, `requireRole('superadmin'|'affiliate')`, `safeReturnTo()`.
- **SQL gating fns** : `is_superadmin()` (`supabase/migrations/0008_profiles_role.sql`), `has_active_subscription()` (`0009`/`0010`, RPC-callable).
- **Migrations** : MCP `apply_migration` (jamais `db push`) ; `CONCURRENTLY` hors tx via `execute_sql` ; puis `generate_typescript_types` → édition `database.types.ts` → `get_advisors`. **Prochaine migration = `0020`** (`0019` déjà sur disque).
- **RLS = vraie barrière** : fetch via anon auth-client, jamais service_role côté page ; gate UX seul jamais suffisant.

### Integration Points / À construire (gaps)
- `(dash)` route group : **n'existe pas** (groupes actuels : `(marketing)`, `(auth)`, `(account)`, `(member)`, `affiliation`, `dashboard` stub).
- Table `user_followed_setups` + RLS + index : **entièrement neuf** (migration `0020`).
- Helper curseur **keyset** : **aucun en code** (seuls les index DB existent). À construire.
- Page « paramètres » (UDASH-06) : **n'existe pas** (seul `(account)/abonnement` existe).
- Libs `@tanstack/react-table`, `@tanstack/react-virtual`, `nuqs` : **absentes** du `apps/web/package.json` (seul `@tanstack/react-query@5.101.0` présent). Décision libs à trancher (cf. Claude's Discretion).

</code_context>

<specifics>
## Specific Ideas

- L'overview doit donner un effet « cockpit personnel » sobre : abonnement en proue, signaux ensuite, raccourcis en pied — sans aucun chiffre de performance fabriqué.
- La watchlist se vit comme un geste léger (étoile 1-clic) intégré aux surfaces signaux existantes, pas comme un module séparé lourd.
- Trois dashboards mentalement séparés (user / affilié / admin) : le user-dash ne « contient » pas l'affiliation, il y renvoie.

</specifics>

<deferred>
## Deferred Ideas

- **Programme de parrainage à récompense** (« inviter des amis → 10 invités = 2 mois gratuits ») — **nouvelle capacité distincte de l'affiliation** (qui verse 20 % récurrent en cash pour des abonnés payants). Implique : tracking des invitations, comptage vers le palier 10, octroi de crédit d'abonnement (2 mois offerts), garde-fous anti-abus, conformité promo MENA. **Déféré à sa propre phase/requirement** (post-v3.0 ou insertion roadmap dédiée). Ne pas l'amorcer en Phase 19.
- **Infra de delivery des notifications** (email/push) — Phase 19 ne livre que l'UI de préférences ; le moteur d'envoi est hors scope, à planifier séparément.

### Reviewed Todos (not folded)
None — aucun todo en attente ne correspondait à la phase 19 (`todo.match-phase 19` = 0).

</deferred>

---

*Phase: 19-dashboard-utilisateur*
*Context gathered: 2026-06-26*
