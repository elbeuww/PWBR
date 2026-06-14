# Phase 3: Espace membre signaux (gated RLS) - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Exposer le **produit payant** — les setups scorés du cœur v1.0 (`trade_setups` / `analyses`) — à un **public non technique**, derrière la barrière RLS déjà prouvée en Phase 1, AVANT que le paiement (Phase 4) ne crée des abonnés.

1. **Liste des signaux** — grille de cartes triées par score décroissant, filtrable (actif, classe d'actif, style, risque), temps réel (MEMB-01, MEMB-02, MEMB-05).
2. **Détail d'un trade** — chart chandeliers (entrée/SL/TP tracés) + explication simple d'abord, analyse approfondie dépliable ensuite, vulgarisée (MEMB-03, MEMB-04).

**Couvre :** MEMB-01, MEMB-02, MEMB-03, MEMB-04, MEMB-05.

**Hors scope (autres phases) :**
- Flux de paiement réel / écriture des abonnements (P4) — P3 lit des signaux derrière le gate déjà posé ; personne n'a d'abonnement actif tant que P4 n'est pas livré (la surface est construite et prouvée gated).
- Calcul/affichage du **% de réussite mesuré** et de l'historique des trades passés (P5 — track record). La liste P3 = signaux **actifs uniquement**.
- Posts Telegram (P6), affiliation (P7), back-office superadmin (P8).
- Le moteur d'analyse / la production des setups (cœur v1.0, déjà livré) — P3 ne fait que **lire** via RLS.
</domain>

<decisions>
## Implementation Decisions

### Liste & cartes (MEMB-01)
- **D-01 :** Format = **grille de cartes responsives** (1 colonne mobile / 2-3 desktop). Pas de composant Card étoffé encore → à construire au-dessus du design system de marque livré en P2.
- **D-02 :** La liste membre affiche **uniquement les signaux `status = 'active'`**. Les `expired`/`invalidated` sont exclus (l'historique chiffré + le track record arrivent en P5). C'est la lecture la plus claire de « quoi trader maintenant » (critère de succès 1 = « signaux actifs »).
- **D-03 :** Le **score /100** = **chiffre + libellé qualitatif de conviction + couleur NEUTRE de marque** (ex. « 82/100 · Forte conviction »). ⛔ Le vert/rouge reste **réservé à la sémantique trading** (direction long/short, résultats) — jamais pour le score ni la déco (cohérence D-04 de P2).
- **D-04 :** **Fraîcheur** = **âge relatif** (« il y a 2 h », via `Intl`/luxon, encadré `<bdi>`) **+ échéance** `valid_until` (« valable jusqu'à … » ou compte à rebours léger).
- Chaque carte montre : **actif, direction (long/short colorée), score, niveau de risque, R:R, fraîcheur** (MEMB-01).

### Filtres & tri (MEMB-02)
- **D-05 :** Barre de filtres **mixte** — **chips toggle** pour `style` (day/swing) et `niveau de risque` (peu d'options, tactile/RTL-friendly) + **champ recherche / déroulant** pour l'`actif` et la `classe d'actif` (beaucoup d'instruments).
- **D-06 :** Filtres **cumulables (ET logique)** — ex. Crypto + Swing + risque Faible se combinent.
- **D-07 :** État filtres + tri **persisté dans l'URL (query params)** — rechargeable, partageable, retour navigateur OK, **lisible côté serveur (RSC)** — cohérent avec la lecture serveur Supabase déjà en place.
- **D-08 :** Tris = **score décroissant par défaut** (MEMB-01, critère 1) + options **« plus récents » (fraîcheur)** et **« meilleur R:R »**.

### Détail trade — vulgarisation & chart (MEMB-03, MEMB-04)
- **D-09 :** **Niveau 1 « explication simple »** = `veteran_note` (déjà rédigé en langage humain par l'IA) **+ plan résumé** (direction, entrée/SL/TP, R:R, niveau de risque). **Niveau 2 « analyse approfondie » dépliable** = raisons `technical_reasons` / `fundamental_reasons` / `news_catalysts` + **décomposition du score** + **scénario d'invalidation** (`invalidation`) + `upcoming_risk_events`.
- **D-10 :** **Jargon technique** (RSI/MACD/BOS/ATR…) = le contenu IA (FR/EN) s'affiche **TEL QUEL** (hypothèse v2.0 verrouillée : raisonnement non altéré, non re-traduit) **+ aide additive** (infobulles « ? » ou glossaire vulgarisé). ⛔ Ne JAMAIS reformuler le contenu faisant foi.
- **D-11 :** **Décomposition du score** = **barres par dimension** (technique / fondamental / news / structure) via `recharts` — **SI les composantes sont persistées**. ⚠️ **FLAG RECHERCHE** : confirmer la source des composantes (`analyses.snapshot`, `payload` §3, ou un breakdown dans `packages/core/scoring`). **Repli si indisponible** : « **facteurs contributifs** » (liste dérivée des raisons technique/fondamentale/news, sans chiffres par dimension).
- **D-12 :** **Chart chandeliers** (lightweight-charts v5) = **lecture seule** (pas de zoom/pan/crosshair), **timeframe de l'analyse**, ~100-150 bougies d'historique, **lignes entrée / SL / TP (1-3 TP) tracées et légendées**, vert/rouge sémantiques. ⚠️ **FLAG RECHERCHE** : source des candles (table `candles`) et **accès RLS en lecture** pour un abonné authentifié.

### Temps réel (MEMB-05)
- **D-13 :** À la publication d'un nouveau signal (liste ouverte) → **badge discret « N nouveaux signaux — afficher »** en haut (non intrusif, évite tout reflow pendant la lecture) ; le clic insère.
- **D-14 :** Le temps réel écoute **INSERT (nouveaux `active`) ET les transitions de statut** `active → expired/invalidated` → le signal **disparaît en direct** (cohérent avec D-02 « seulement active »).
- **D-15 :** **Portée = liste seulement au MVP.** La page détail est un instantané au chargement.
- **D-16 :** **Repli silencieux** si Realtime indisponible (connexion perdue, quota Supabase) — la liste reste correcte via le **chargement serveur initial + une revalidation/refetch périodique légère**. Le temps réel est un **bonus, pas une dépendance dure**.

### Navigation, états, volume, conformité
- **D-17 :** Détail = **route dédiée** `/[locale]/(member)/signaux/[id]` (RSC, deep-link partageable, recharge/retour OK, chart rendu proprement). Cohérent avec l'état dans l'URL (D-07).
- **D-18 :** **États soignés (les trois)** : **vide** explicite et rassurant (« Aucun signal actif en ce moment — les analyses sont publiées à chaque session »), **skeletons** au chargement, **erreur** claire + réessayer. Essentiel : la liste sera **souvent peu remplie** (immuabilité = 1 setup actif par clé instrument×style×session, dépend du cycle des jobs IA).
- **D-19 :** **Volume = tout afficher avec un plafond de sécurité** (~100) côté requête. Pas de pagination ni scroll infini au MVP (volume naturellement borné par l'immuabilité).
- **D-20 :** **Disclaimer membre (LEGAL-01)** = footer transverse (déjà en place, composant réutilisable de P2) **+ bandeau dédié** court et visible (« contenu éducatif, pas un conseil personnalisé, risque de perte ») sur la surface signaux (liste / détail — la surface qui présente des plans de trade). Plus défendable légalement.

### Claude's Discretion
- Wiring exact de Supabase Realtime (channel, filtres `postgres_changes` sur `trade_setups`, interaction avec la RLS).
- Découpage exact des composants (`SignalCard`, `FilterBar`, `SignalList`, `SignalDetail`, wrapper `CandleChart`, `ScoreBreakdown`, glossaire/tooltip).
- Format précis des nombres/prix **par actif** (décimales selon l'instrument) via `Intl` + `<bdi>`.
- Mécanique du glossaire/infobulles (composant tooltip shadcn vs page/section glossaire dédiée).
- Stratégie de revalidation (intervalle de refetch, `@tanstack/react-query` `staleTime` combiné au Realtime).
- Choix d'étendre le namespace de messages `signals` existant vs en ajouter (ex. `signalDetail`).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Exigences & roadmap du milestone
- `.planning/ROADMAP.md` § Phase 3 — Goal + 4 Success Criteria (couvre MEMB-01..05).
- `.planning/REQUIREMENTS.md` § MEMB — libellés exacts MEMB-01..05.
- `.planning/STATE.md` § Accumulated Context — décisions héritées du milestone.

### Contexte des phases antérieures (à lire impérativement)
- `.planning/phases/01-socle-transverse-i18n-rtl-r-les-gating/01-CONTEXT.md` — gating verrouillé : `requireActiveSub` (D-07/D-08 P1), RLS `has_active_subscription()` sur `trade_setups`/`analyses`, lecture front via anon-client. i18n (`localePrefix:'always'`, `[fr,en,ar]`), RTL natif Tailwind v4.
- `.planning/phases/01-socle-transverse-i18n-rtl-r-les-gating/01-SECURITY.md` — gate RLS + `gate.ts` déjà vérifié ; **ne pas régresser**.
- `.planning/phases/02-vitrine-publique-trilingue-gate-l-gal/02-CONTEXT.md` — design system : toggle dark/light, **vert/rouge strictement sémantiques** (D-04 P2), polices self-hostées, `Disclaimer` transverse réutilisable (D-13 P2), shadcn/ui branche v4.
- `.planning/phases/02-vitrine-publique-trilingue-gate-l-gal/02-SECURITY.md` — disclaimers / conformité (LEGAL-01).

### Données & contrat (cœur v1.0 réutilisé)
- `supabase/migrations/0006_analyses_trade_setups.sql` — schéma `trade_setups` (`opportunity_score`, `risk_level`, `direction`, `risk_reward`, `entry_price`, `stop_loss`, `take_profits`, `confidence`, `status`, `valid_until`, `style`, `session`) + `analyses` + **RLS lecture `authenticated`** + index `trade_setups_score_idx` (score desc) déjà présent.
- `supabase/migrations/0009_subscriptions_gating.sql` + `supabase/migrations/0010_has_active_subscription_null_expiry.sql` — `has_active_subscription()` (RLS gating à respecter).
- `packages/core/src/schemas/output.ts` — **contrat §3** : ce que la page détail peut afficher (`veteran_note`, `technical_reasons`, `fundamental_reasons`, `news_catalysts`, `upcoming_risk_events`, `invalidation`, `entry`, `take_profits`). ⚠️ Le score et le R:R sont produits par le code (pas dans ce contrat) → présents sur `trade_setups`.
- `packages/supabase/src/repositories/tradeSetups.ts` — repo **WRITE-only (service_role)** ; le front **lit via anon-client + RLS**, JAMAIS ce repo (frontière producteur-unique).
- `supabase/migrations/0005_snapshots.sql` + `supabase/migrations/0007_snapshots_kind_combined.sql` — `snapshots` (candles potentielles pour le chart — vérifier RLS).
- `packages/supabase/src/repositories/candles.ts` — source OHLCV candidate pour le chart (vérifier accès RLS en lecture abonné).

### Recherche v2.0 (stack & pièges)
- `.planning/research/STACK.md` — lightweight-charts 5.x (API `addSeries(SeriesType, …)` v5, **pas** les tutos v4), recharts (graphes analytiques), `@tanstack/react-query`, Supabase Realtime.
- `.planning/research/ARCHITECTURE.md` — segment `[locale]`, route group `(member)` gated, frontière producteur-unique.
- `.planning/research/PITFALLS.md` — gating UI sans RLS (#5), promesses de gain / conformité.

### ⚠️ Flags recherche à trancher AVANT planning
1. **Source des composantes du score (D-11)** : `analyses.snapshot` vs `packages/core/scoring` vs `payload` §3. Détermine barres par dimension OU repli « facteurs contributifs ».
2. **RLS lecture des candles (D-12)** : la table `candles`/`snapshots` est-elle lisible par un abonné authentifié pour alimenter le chart ? Sinon prévoir une vue/policy.
3. **Faisabilité Supabase Realtime sous RLS `has_active_subscription()` (D-14)** : les events `postgres_changes` respectent-ils la RLS ; comment écouter les UPDATE de statut.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`apps/web/src/app/[locale]/(member)/signaux/page.tsx`** — placeholder P1 (namespace `signals`) à remplacer par la liste réelle.
- **`apps/web/src/app/[locale]/(member)/layout.tsx`** — `requireActiveSub()` déjà en place : le gate UX est posé, P3 ajoute juste le contenu lu via anon-client + RLS.
- **`Disclaimer` (P2)** — composant transverse à greffer sur la surface membre (D-20, LEGAL-01).
- **Design system P2** (tokens 2 thèmes, shadcn/ui v4, polices) — base des cartes/filtres/détail.
- **Namespace `signals`** (présent dans `apps/web/src/messages/{fr,en,ar}.json`) à étendre (liste, filtres, détail, glossaire).

### Established Patterns
- **Frontière producteur-unique** : le front **lit seulement** (anon-client + RLS select-only) ; aucune écriture front sur `trade_setups`/`analyses`. Ne jamais importer le repo service_role dans `apps/web`.
- **i18n verrouillé P1** : tout texte via next-intl (le check CI `check-i18n-hardcoded.mjs` bloque les régressions). Prix/nombres/dates via `<bdi>`/`Intl`.
- **RTL natif Tailwind v4** : propriétés logiques `ms-*`/`me-*`/`start`/`end`. Le chart (canvas) reste LTR ; encadrer les valeurs numériques.
- **@supabase/ssr `getUser()`** (jamais `getSession()`) côté serveur — maintenir.

### Integration Points
- Nouvelle route détail `[locale]/(member)/signaux/[id]/page.tsx` (RSC) sous le layout gated existant (D-17).
- Lecture serveur des `trade_setups` (tri/filtre par query params D-07/D-08) via le client serveur Supabase ; hydratation client + Realtime + react-query pour le live (D-13/D-14/D-16).
- Le chart (lightweight-charts) est client-only (canvas) → composant client dans la page détail RSC.
</code_context>

<specifics>
## Specific Ideas

- Cible = **public non technique** : la vulgarisation prime (explication simple d'abord, jargon assisté par glossaire/infobulles, score chiffré + libellé parlant). Cœur de la valeur produit.
- **Vert/rouge strictement sémantiques** (direction long/short) — jamais score ni déco, en continuité avec la vitrine P2.
- L'espace membre est **volontairement souvent peu rempli** (immuabilité : 1 setup actif par clé) → l'état vide doit rassurer, pas inquiéter (« analyses publiées à chaque session »).
- Le temps réel est un **confort** (badge discret), pas un spectacle : ne pas déranger la lecture en cours.
</specifics>

<deferred>
## Deferred Ideas

- **Historique des signaux passés + % de réussite chiffré** → **Phase 5** (track record mesuré). P3 = signaux actifs uniquement.
- **Détail en temps réel** (notifier en direct un signal ouvert qui s'invalide) → écarté du MVP (D-15, portée liste seulement) ; ré-évaluable.
- **Notifications push / email** à la publication → au-delà du temps réel in-app ; future phase / hors scope.
- **Pagination / scroll infini** → seulement si le volume explose (peu probable, borné par l'immuabilité).
- **Accessibilité avancée du chart** (résumé textuel structuré pour lecteurs d'écran) → partiellement couvert par le plan résumé textuel (D-09) ; approfondir si un objectif a11y formel est fixé.

None déféré au-delà : la discussion est restée dans le périmètre de la phase.
</deferred>

---

*Phase: 3-Espace membre signaux (gated RLS)*
*Context gathered: 2026-06-14*
</content>
</invoke>
