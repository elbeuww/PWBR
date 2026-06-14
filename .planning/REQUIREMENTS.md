# Requirements — Milestone v2.0 : Plateforme publique d'analyse & signaux (MENA)

**Created:** 2026-06-14
**Core Value:** Produire, pour chaque opportunité, une analyse fiable et explicable — vulgarisée pour un public non technique — avec un % de réussite TOUJOURS mesuré, jamais inventé : c'est le socle de confiance qui fait payer l'abonnement.

> Prérequis livré (milestone v1.0, P1-4) : moteur analytique déterministe + setups scorés persistés en base (`trade_setups`, `analyses`, `snapshots`). v2.0 = couche produit autour de ces setups.
>
> Périmètre v2.0 = Waves 1-4. L'automatisation (processeur crypto auto, migration clé API Anthropic, payout on-chain auto) est reportée en v2.1 (voir Future Requirements).

## v2.0 Requirements

### I18N — Internationalisation trilingue (transverse, Wave 1)
- [ ] **I18N-01**: L'utilisateur navigue vitrine + espace membre en arabe, anglais ou français ; la langue est dans l'URL (`/[locale]/…`) et persiste entre les pages.
- [ ] **I18N-02**: La mise en page bascule en RTL pour l'arabe (propriétés logiques Tailwind v4), les éléments intrinsèquement LTR (prix, symboles, nombres) restant corrects.
- [ ] **I18N-03**: Les chaînes d'interface sont externalisées (next-intl) — aucune chaîne en dur dans les composants.
- [ ] **I18N-04**: Dates, nombres et devises s'affichent selon la locale active.

### ACCESS — Rôles & gating (Wave 1)
- [ ] **ACCESS-01**: Un visiteur non authentifié voit la vitrine publique mais ne peut pas atteindre l'espace membre (signaux).
- [ ] **ACCESS-02**: Un utilisateur authentifié SANS abonnement actif est bloqué hors des signaux — UI ET RLS : un appel direct au client Supabase ne retourne aucun setup.
- [ ] **ACCESS-03**: Les rôles (member / affiliate / superadmin) sont portés par `profiles.role` (jamais le JWT) ; chaque rôle n'accède qu'à ses surfaces.
- [ ] **ACCESS-04**: L'accès aux signaux est conditionné par un abonnement actif via RLS (`has_active_subscription()`), prouvé par des tests cross-user/cross-role.

### VITR — Vitrine publique & funnel (Wave 2)
- [ ] **VITR-01**: Un visiteur voit une page d'accueil présentant le produit, le % de réussite mesuré et un appel à l'abonnement, dans sa langue.
- [ ] **VITR-02**: Un visiteur voit la page tarifs (9 $/mois + offre découverte 3 $/15 j) et démarre le parcours d'abonnement.
- [ ] **VITR-03**: La vitrine n'affiche aucune promesse de gain et présente les disclaimers légaux.

### MEMB — Espace membre signaux (Wave 2)
- [ ] **MEMB-01**: Un abonné voit la liste des signaux actifs triés par score décroissant ; chaque carte montre actif, direction, score, risque, R:R, fraîcheur.
- [ ] **MEMB-02**: Un abonné filtre les signaux par actif, classe d'actif, style (day/swing) et niveau de risque.
- [ ] **MEMB-03**: Un abonné ouvre le détail d'un trade avec un graphique chandeliers (lightweight-charts) où entrée, SL et TP sont tracés.
- [ ] **MEMB-04**: Le détail affiche une explication simple d'abord, puis l'analyse approfondie dépliable (décomposition du score + raisons technique/fondamentale/news + scénario d'invalidation).
- [ ] **MEMB-05**: La liste se met à jour en temps réel (Supabase Realtime) à la publication de nouveaux signaux.

### PAY — Paiement USDT & abonnement (Wave 2)
- [ ] **PAY-01**: Un utilisateur voit l'adresse de réception USDT TRC-20 et le montant exact dû pour l'offre choisie.
- [ ] **PAY-02**: Un utilisateur soumet le hash de transaction (+ screenshot optionnel) ; le système le vérifie on-chain via TronGrid (contrat USDT officiel, montant, destinataire, confirmations).
- [ ] **PAY-03**: Un paiement valide active automatiquement l'abonnement (période + date d'expiration) sans intervention manuelle.
- [ ] **PAY-04**: Un hash déjà utilisé (replay), un mauvais montant/token/destinataire ou un paiement non confirmé est rejeté et tracé ; les cas ambigus (sur/sous-paiement) tombent dans une file de validation superadmin.
- [ ] **PAY-05**: L'abonnement expire automatiquement en fin de période ; l'utilisateur est informé et perd l'accès aux signaux.
- [ ] **PAY-06**: L'offre découverte (3 $/15 j) est utilisable une seule fois par utilisateur puis bascule sur le tarif standard.

### TRACK — Track record & % mesuré (Wave 3)
- [ ] **TRACK-01**: Le système rejoue les setups expirés depuis leur snapshot/candles et enregistre le résultat (hit_tp / hit_sl / realized_r) dans `prediction_outcomes`, indépendamment de toute exécution utilisateur.
- [ ] **TRACK-02**: Le système calcule le taux de réussite par pattern (backtest) et le track record réel agrégé de la plateforme.
- [ ] **TRACK-03**: Vitrine et espace membre affichent un % de réussite TOUJOURS mesuré, avec méthode et taille d'échantillon ; « échantillon insuffisant, N trades » tant que N est trop faible.

### TG — Canal Telegram public (Wave 3)
- [ ] **TG-01**: Un job publie automatiquement sur le canal Telegram public les résultats journaliers des trades.
- [ ] **TG-02**: Les publications affichent le win rate permanent à jour.
- [ ] **TG-03**: Les publications sont idempotentes (aucun double post) et tracées.

### AFF — Affiliation à paliers (Wave 4)
- [ ] **AFF-01**: Un affilié dispose d'un code promo ; un visiteur arrivant avec `?ref=` est attribué à cet affilié à l'inscription.
- [ ] **AFF-02**: Un affilié voit son dashboard : abonnés actifs ramenés, revenus générés, commissions dues/payées — sans PII des filleuls.
- [ ] **AFF-03**: Le système calcule les commissions récurrentes (palier max 20 %) sur les abonnés ACTIFS uniquement, de façon idempotente par période.
- [ ] **AFF-04**: Le superadmin marque les commissions payées (payout manuel en crypto) ; l'état se reflète dans le dashboard affilié.
- [ ] **AFF-05**: L'auto-parrainage et les abonnés expirés ne génèrent aucune commission.

### ADMIN — Dashboard superadmin (Waves 2→4)
- [ ] **ADMIN-01**: Le superadmin voit les membres (actifs/inactifs, état d'abonnement et de paiement).
- [ ] **ADMIN-02**: Le superadmin traite la file de validation manuelle des paiements ambigus (activer / rejeter).
- [ ] **ADMIN-03**: Le superadmin voit les affiliés et leurs performances et gère les payouts de commissions.
- [ ] **ADMIN-04**: Le superadmin voit les signaux publiés et la santé des jobs/données (`job_runs`, freshness).

### CMS — Cours & articles vulgarisés (Wave 4)
- [ ] **CMS-01**: Un visiteur lit des articles/cours gratuits vulgarisés sur la vitrine, dans sa langue.
- [ ] **CMS-02**: Le superadmin crée / édite / publie des articles (MDX rendu RSC).

### LEGAL — Conformité & disclaimers (Wave 2, gate de lancement)
- [ ] **LEGAL-01**: Des disclaimers « contenu éducatif, pas un conseil en investissement, aucune promesse de gain » sont présents sur la vitrine, l'espace membre et les posts Telegram.
- [ ] **LEGAL-02**: Une revue juridique (conseil non agréé + statut crypto Algérie/MENA) est complétée et tracée AVANT d'encaisser le premier abonnement en production (gate non-code).

## Future Requirements (v2.1 — Automatisation, Wave 5 reportée)

- **PAY-AUTO**: Processeur crypto automatisé (Cryptomus : adresse unique par facture, webhooks signés sur corps brut, idempotence).
- **ENGINE-API**: Migration du moteur Max → clé API Anthropic (`@anthropic-ai/sdk`) pour fiabilité 24/7 + scheduling cloud (GitHub Actions / Railway / pg_cron à trancher).
- **AFF-AUTO**: Payout des commissions on-chain automatisé (TronWeb, job isolé, secret manager).

## Out of Scope (décisions pivot 2026-06-13)

- Stripe / paiement par carte — remplacé par USDT.
- Communauté sociale (profils, follows, commentaires, leaderboard) — v3.
- Exécution automatique des trades (passage d'ordres).
- Scalping temps réel M1/M5 (websockets).
- Actions / equities (source de données à trancher après lancement).
- Auto-traduction du raisonnement IA en arabe — le contenu généré FR/EN est affiché tel quel dans l'UI arabe au MVP (hypothèse documentée).
- Paiement multi-chaînes (BTC/ETH/…) — TRC-20 uniquement.

## Traceability

*(rempli par le roadmapper — chaque REQ-ID mappé à exactement une phase.)*
