# Roadmap — Milestone v2.0 : Plateforme publique d'analyse & signaux (MENA)

**Created:** 2026-06-14
**Granularity:** fine
**Mode:** interactive (MVP vertical — chaque phase livre de la valeur observable)
**Coverage:** 41/41 requirements v2.0 mappés (Waves 1-4 ; W5 automatisation hors scope)

> Prérequis livré (milestone v1.0, P1-4, 261/261 tests) : moteur analytique déterministe + setups scorés persistés (`trade_setups`, `analyses`, `snapshots`), RLS, jobs idempotents, frontière producteur-unique. **Ce cœur n'est PAS re-roadmappé.** v2.0 = couche produit autour de ces setups.
>
> Numérotation reset à Phase 1 (milestone v1.0 archivé dans `.planning/archive/v1.0-moteur-analytique/`).

## Ordre directeur (arêtes critiques issues de la recherche)

i18n/RTL+rôles avant toute UI publique · RLS signaux avant exposition espace membre · subscriptions avant affiliation · paiement MVP avant tout processeur auto (hors scope) · track record (outcomes) avant Telegram & avant le % affiché · affiliation après abonnements actifs · revue juridique signée avant le 1er encaissement.

## Phases

- [ ] **Phase 1: Socle transverse — i18n/RTL & rôles/gating** - Locale `[locale]`, RTL natif, `profiles.role` hors JWT, primitive de gating partagée (UI + RLS)
- [ ] **Phase 2: Vitrine publique trilingue & gate légal** - Accueil/tarifs/disclaimers dans 3 langues + revue juridique signée avant encaissement
- [ ] **Phase 3: Espace membre signaux (gated RLS)** - Liste triée/filtrée + détail trade (chart + explication simple/approfondie), temps réel, prouvé inaccessible aux non-abonnés
- [ ] **Phase 4: Paiement USDT MVP & abonnement — JALON ENCAISSEMENT** - Adresse USDT TRC-20 → soumission hash → vérif TronGrid → activation/expiry auto + file de validation superadmin
- [ ] **Phase 5: Track record mesuré & % affiché** - Rejeu des setups expirés → `prediction_outcomes`/`pattern_stats` → % TOUJOURS mesuré (jamais inventé)
- [ ] **Phase 6: Canal Telegram public** - Publication idempotente des résultats journaliers + win rate permanent
- [ ] **Phase 7: Affiliation à paliers** - Codes promo, capture `?ref`, dashboard affilié sans PII, commissions idempotentes max 20 % sur abonnés actifs
- [ ] **Phase 8: Superadmin consolidé (signaux, santé, affiliés)** - Vue signaux publiés + santé jobs/données + gestion des affiliés et payouts manuels
- [ ] **Phase 9: CMS cours & articles vulgarisés** - Articles MDX trilingues créés/édités/publiés par le superadmin, lus sur la vitrine

## Phase Details

### Phase 1: Socle transverse — i18n/RTL & rôles/gating
**Goal**: Poser, AVANT toute UI publique, l'internationalisation `[locale]`+RTL et la primitive d'accès (rôle hors JWT + gating défense-en-profondeur) que toutes les phases suivantes réutilisent.
**Depends on**: Cœur v1.0 livré (auth Supabase SSR, RLS sur `trade_setups`/`analyses`)
**Requirements**: I18N-01, I18N-02, I18N-03, I18N-04, ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04
**Success Criteria** (what must be TRUE):
  1. L'utilisateur navigue vitrine + espace membre en AR/EN/FR ; la langue est dans l'URL `/[locale]/…` et persiste entre les pages ; aucune chaîne d'interface n'est en dur (next-intl).
  2. En arabe la mise en page bascule en RTL via propriétés logiques (`ms-*`/`me-*`, `start/end`), tandis que prix, symboles, nombres et dates restent corrects et formatés selon la locale (`<bdi>`/`Intl`).
  3. Le rôle (member/affiliate/superadmin) est porté par `profiles.role`, lu serveur après `getUser()` — jamais dans le JWT ; un token périmé/forgé ne confère aucun privilège.
  4. Un visiteur non authentifié atteint la vitrine mais est redirigé hors des signaux ; un utilisateur authentifié sans abonnement actif ne lit AUCUN setup, prouvé par un test anon-client direct (UI ET RLS `has_active_subscription()`).
**Plans**: TBD
**UI hint**: yes

### Phase 2: Vitrine publique trilingue & gate légal
**Goal**: Donner au visiteur une vitrine convaincante et légalement défendable dans sa langue, et franchir la porte juridique non-code requise avant tout encaissement.
**Depends on**: Phase 1 (locale/RTL/strings)
**Requirements**: VITR-01, VITR-02, VITR-03, LEGAL-01, LEGAL-02
**Success Criteria** (what must be TRUE):
  1. Un visiteur voit une page d'accueil dans sa langue présentant le produit, le % de réussite mesuré et un appel clair à l'abonnement, sans aucune promesse de gain.
  2. Un visiteur voit la page tarifs (9 $/mois + offre découverte 3 $/15 j) et peut démarrer le parcours d'abonnement.
  3. Des disclaimers « contenu éducatif, pas de conseil personnalisé, aucune promesse de gain, risque de perte total » rédigés par un juriste sont présents sur la vitrine.
  4. Une revue juridique (conseil non agréé + statut crypto Algérie/MENA) est complétée et tracée — gate non-code bloquant le 1er encaissement (Phase 4) en production.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Espace membre signaux (gated RLS)
**Goal**: Exposer le produit payant — les setups scorés du cœur — à un public non technique, derrière une barrière de données prouvée, AVANT que le paiement ne crée des abonnés.
**Depends on**: Phase 1 (gating RLS `has_active_subscription()`)
**Requirements**: MEMB-01, MEMB-02, MEMB-03, MEMB-04, MEMB-05
**Success Criteria** (what must be TRUE):
  1. Un abonné voit la liste des signaux actifs triés par score décroissant ; chaque carte montre actif, direction, score, risque, R:R et fraîcheur.
  2. Un abonné filtre les signaux par actif, classe d'actif, style (day/swing) et niveau de risque.
  3. Un abonné ouvre le détail d'un trade avec un graphique chandeliers (lightweight-charts) où entrée, SL et TP sont tracés, suivi d'une explication simple puis de l'analyse approfondie dépliable (décomposition du score + raisons technique/fondamentale/news + scénario d'invalidation).
  4. La liste se met à jour en temps réel (Supabase Realtime) à la publication de nouveaux signaux.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Paiement USDT MVP & abonnement — JALON ENCAISSEMENT
**Goal**: Encaisser un premier abonnement de façon sûre et automatique en USDT TRC-20, et faire vivre l'abonnement (activation, expiration) — c'est LE jalon « 1er abonnement encaissable ». Densité de risque maximale (tout l'argent).
**Depends on**: Phase 3 (signaux gated à débloquer), Phase 2 (gate légal signé)
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, ADMIN-01, ADMIN-02
**Success Criteria** (what must be TRUE):
  1. Un utilisateur voit l'adresse de réception USDT TRC-20 (réseau affiché en grand + QR + copie 1-tap) et le montant atomique exact dû pour l'offre choisie.
  2. À la soumission d'un hash, le système vérifie on-chain via TronGrid que le `Transfer` provient EXACTEMENT du contrat USDT officiel (`.env`, jamais saisi), avec montant en decimals 6 (BigInt atomique ×10^6, zéro float), destinataire normalisé hex↔base58 et `only_confirmed:true` (anti-réorg) ; un paiement valide active l'abonnement (période + expiration) sans intervention manuelle.
  3. Un hash déjà utilisé est rejeté par `UNIQUE(tx_hash)` GLOBAL (le même hash ne crédite jamais deux comptes) ; faux token, mauvais montant/destinataire ou TX non confirmée sont rejetés et tracés ; les cas ambigus (sur/sous-paiement) tombent dans la file de validation superadmin que celui-ci traite (activer/rejeter). L'utilisateur ne peut écrire QUE `payments(pending)` ; seul le service_role transitionne vers `verified`/`active`.
  4. L'abonnement expire automatiquement en fin de période (job `subscription-expiry`), l'utilisateur est informé et perd l'accès aux signaux ; l'offre découverte 3 $/15 j est utilisable une seule fois par utilisateur puis bascule sur le tarif standard.
  5. Le superadmin voit les membres (actifs/inactifs, état d'abonnement et de paiement).
**Plans**: TBD
**UI hint**: yes

### Phase 5: Track record mesuré & % affiché
**Goal**: Produire le chiffre qui fonde la confiance — un % de réussite TOUJOURS mesuré (jamais inventé) — à partir des setups expirés rejoués contre les candles réelles.
**Depends on**: Phase 4 (abonnés à servir), Phase 3 (surface d'affichage membre), Phase 2 (surface vitrine)
**Requirements**: TRACK-01, TRACK-02, TRACK-03
**Success Criteria** (what must be TRUE):
  1. Le job `outcome-tracker` rejoue chaque setup expiré depuis son snapshot/candles et enregistre le résultat (hit_tp / hit_sl / realized_r) dans `prediction_outcomes`, idempotent par `setup_id`, indépendamment de toute exécution utilisateur, en réutilisant les constantes anti look-ahead du cœur.
  2. Le système calcule le taux de réussite par pattern (backtest) ET le track record réel agrégé de la plateforme, en les distinguant clairement.
  3. Vitrine et espace membre affichent un % TOUJOURS mesuré avec méthode et taille d'échantillon ; sous le seuil minimal, ils affichent « échantillon insuffisant, N trades » plutôt qu'un pourcentage.
**Plans**: TBD
**UI hint**: yes

### Phase 6: Canal Telegram public
**Goal**: Alimenter la machine d'acquisition en publiant automatiquement les résultats journaliers et un win rate permanent sur le canal Telegram public.
**Depends on**: Phase 5 (outcomes + win rate mesurés à publier)
**Requirements**: TG-01, TG-02, TG-03
**Success Criteria** (what must be TRUE):
  1. Un job (grammY, publication-only) publie automatiquement sur le canal Telegram public les résultats journaliers des trades.
  2. Chaque publication affiche le win rate permanent à jour (issu du track record mesuré, Phase 5).
  3. Les publications sont idempotentes (aucun double post, contrainte sur `telegram_posts`) et tracées dans `job_runs`.
**Plans**: TBD

### Phase 7: Affiliation à paliers
**Goal**: Activer l'acquisition par influenceurs avec une affiliation idempotente, sans fraude ni fuite de PII, calculée uniquement sur les abonnés actifs.
**Depends on**: Phase 4 (abonnements actifs requis pour commissionner)
**Requirements**: AFF-01, AFF-02, AFF-03, AFF-04, AFF-05
**Success Criteria** (what must be TRUE):
  1. Un affilié dispose d'un code promo ; un visiteur arrivant avec `?ref=` est attribué à cet affilié à l'inscription (capture middleware dans l'ordre locale → ref → session).
  2. Un affilié voit son dashboard (abonnés actifs ramenés, revenus générés, commissions dues/payées) sans aucune PII des filleuls ; un affilié ne voit jamais les referrals d'un autre (isolation RLS prouvée).
  3. Les commissions récurrentes (palier max 20 %) sont calculées sur les abonnés ACTIFS sur la période uniquement, de façon idempotente (`UNIQUE(affiliate_id, referral_id, period)`, re-run = même total) ; auto-parrainage et abonnés expirés ne génèrent aucune commission.
  4. Le superadmin marque les commissions payées (payout manuel en crypto) et l'état se reflète dans le dashboard affilié.
**Plans**: TBD
**UI hint**: yes

### Phase 8: Superadmin consolidé (signaux, santé, affiliés)
**Goal**: Compléter le back-office avec la visibilité opérationnelle (signaux publiés, santé jobs/données) et le pilotage des affiliés/payouts.
**Depends on**: Phase 7 (affiliés à gérer), Phase 4 (admin minimal posé)
**Requirements**: ADMIN-03, ADMIN-04
**Success Criteria** (what must be TRUE):
  1. Le superadmin voit les affiliés et leurs performances et gère les payouts de commissions.
  2. Le superadmin voit les signaux publiés et la santé des jobs/données (`job_runs`, `v_data_freshness`, flag `stale`).
**Plans**: TBD
**UI hint**: yes

### Phase 9: CMS cours & articles vulgarisés
**Goal**: Construire le contenu éducatif gratuit (de la base) qui nourrit le funnel et la crédibilité, géré par le superadmin et lu sur la vitrine.
**Depends on**: Phase 1 (locale/RTL), Phase 2 (vitrine)
**Requirements**: CMS-01, CMS-02
**Success Criteria** (what must be TRUE):
  1. Un visiteur lit des articles/cours gratuits vulgarisés sur la vitrine, dans sa langue (contenu DB par `(slug, locale)`, rendu MDX RSC).
  2. Le superadmin crée, édite et publie des articles.
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Socle transverse i18n/rôles | 0/? | Not started | - |
| 2. Vitrine & gate légal | 0/? | Not started | - |
| 3. Espace membre signaux | 0/? | Not started | - |
| 4. Paiement USDT (encaissement) | 0/? | Not started | - |
| 5. Track record & % mesuré | 0/? | Not started | - |
| 6. Telegram public | 0/? | Not started | - |
| 7. Affiliation à paliers | 0/? | Not started | - |
| 8. Superadmin consolidé | 0/? | Not started | - |
| 9. CMS cours & articles | 0/? | Not started | - |

## Coverage Map

| Requirement | Phase |
|-------------|-------|
| I18N-01..04 | Phase 1 |
| ACCESS-01..04 | Phase 1 |
| VITR-01..03 | Phase 2 |
| LEGAL-01, LEGAL-02 | Phase 2 |
| MEMB-01..05 | Phase 3 |
| PAY-01..06 | Phase 4 |
| ADMIN-01, ADMIN-02 | Phase 4 |
| TRACK-01..03 | Phase 5 |
| TG-01..03 | Phase 6 |
| AFF-01..05 | Phase 7 |
| ADMIN-03, ADMIN-04 | Phase 8 |
| CMS-01, CMS-02 | Phase 9 |

**Total: 41/41 v2.0 requirements mapped, 0 orphans, 0 duplicates.**

---
*Roadmap v2.0 — 9 phases, granularité fine, MVP vertical. Jalon d'encaissement = Phase 4. W5 (automatisation : PAY-AUTO/ENGINE-API/AFF-AUTO) reportée hors de cette roadmap.*
