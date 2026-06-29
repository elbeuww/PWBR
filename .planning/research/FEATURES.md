# Feature Research — Milestone v3.0 « Plateforme complète sous identité dark néon NEXA »

**Domain:** Dashboards SaaS — espace membre (trading-signals par abonnement) + back-office/superadmin analytics (MENA, non-technique, trilingue fr/en/ar + RTL)
**Researched:** 2026-06-22
**Confidence:** HIGH (existant codebase + tables/RLS lus directement). MEDIUM sur les conventions de marché dashboards (patterns standards recoupés, non sourcés URL).
**Scope:** Données seedées, aucun branchement API/paiement/signaux réel dans ce milestone.

---

## Contexte existant (NE PAS dupliquer)

Surfaces déjà bâties (v2.0/v2.1) à intégrer/refondre, pas réécrire :

| Surface existante | État | Implication v3.0 |
|---|---|---|
| `/[locale]/dashboard` | **Stub** (liste `instruments` seule, hors `(member)`, auth simple) | À **remplacer** par le vrai dashboard utilisateur. C'est le squelette à étoffer. |
| `(member)/signaux` + `[id]` | Livré (liste filtrée RLS + détail chart) | Le dashboard **renvoie vers** ces pages, ne les ré-implémente pas. |
| `(account)/abonnement` | Livré (ExpiryBanner câblé, `current_period_end`) | Devient un **onglet** du dashboard utilisateur. |
| `[locale]/affiliation` + `/dashboard` | Livré (candidature + dashboard affilié no-PII via vue `affiliate_dashboard`) | Devient un **onglet** du dashboard utilisateur. |
| `(admin)/` page | KPI minimal (3 cartes : membres actifs, file ambigus, santé feu) | À **refondre/étoffer** en vrai cockpit superadmin. |
| `(admin)/signaux`, `/sante`, `/membres`, `/file`, `/affiliation`, `/affiliation/payouts`, `/affiliation/affilies` | Livrés (sobres, mono-FR) | À **reskin dark néon** + consolider en navigation cohérente + enrichir métriques. |

**Tables/vues mobilisables (RLS déjà en place) :** `subscriptions`, `payments`, `trade_setups`, `analyses`, `prediction_outcomes`, `pattern_stats` (vue), `v_data_freshness` (vue), `job_runs`, `affiliates`, `affiliate_codes`, `affiliate_applications`, `referrals`, `commissions`, `payouts`, `affiliate_dashboard` (vue no-PII), `profiles`, `instruments`, `telegram_posts`.

**Contrainte transverse dure (gouverne tout chiffre affiché) :**
- **VITR-03 — « % TOUJOURS mesuré, jamais inventé »** : tout pourcentage de performance vient de `pattern_stats` avec **provenance** (`backtest`/`réel`) + **N** visible. Sur des **données seedées**, un win-rate seedé DOIT être labellisé `backtest`/`démo` et porter son N — jamais présenté comme track record réel. Garde automatisée `no-perf-claims` existante.
- **Aucune promesse de gain.** Pas de « combien tu aurais gagné », pas de P&L projeté, pas d'equity simulé présenté comme réel.
- **Public non technique MENA, trilingue fr/en/ar + RTL** : vulgarisation, propriétés logiques CSS uniquement, `<bdi>`/`Intl.NumberFormat` sur les nombres/montants.

---

## Feature Landscape — DASHBOARD UTILISATEUR (membre)

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Vue d'ensemble (overview/home)** : carte d'accueil + tuiles de raccourci (mes signaux, mon abonnement, mon affiliation) | Tout dashboard SaaS ouvre sur un hub, pas une liste brute | LOW | Remplace le stub. RSC ; lit `subscriptions` (statut/jours restants), compteurs `trade_setups` actifs. Aucun chiffre de perf inventé. |
| **Statut d'abonnement visible** : plan, état (actif/expiré), date d'expiration, CTA renouveler | Le membre paie ; il doit voir ce qu'il a et jusqu'à quand | LOW | Réutilise `(account)/abonnement` + ExpiryBanner. Lecture RLS `subscriptions` (lit les siennes). |
| **Liste des signaux récents/actifs (entrée vers `(member)/signaux`)** | Cœur de valeur du produit ; à 1 clic du hub | LOW | Lien + aperçu des N derniers `trade_setups` (gated RLS `has_active_subscription()`). Ne pas dupliquer la page liste. |
| **Historique des signaux passés (résolus)** : issue hit_tp/hit_sl/flat | « Qu'est devenu le trade ? » = confiance | MEDIUM | Jointure `trade_setups` × `prediction_outcomes`. Issue **factuelle mesurée** (TP touché / SL touché / neutre), pas un gain monétaire. |
| **Navigation par onglets cohérente** (Vue d'ensemble · Signaux · Abonnement · Affiliation · Paramètres) | Convention universelle de dashboard membre | LOW | Layout segment `(member)` ou nouveau `(dashboard)`. RTL : tabs en propriétés logiques. |
| **Paramètres compte** : email, langue, mot de passe, déconnexion | Attendu partout ; gestion de base du compte | LOW | `profiles` + Supabase auth. Sélecteur de locale = i18n existant. |
| **État vide pédagogique** (pas d'abo / pas de signaux) | Public non technique : un écran vide sans guidage = abandon | LOW | Empty states avec CTA (« Activer mon abonnement », « Comment lire un signal »). Lien académie. |
| **Disclaimer / rappel éducatif présent** | Contrainte légale dure + déjà transverse | LOW | `<Disclaimer />` RSC déjà global. Vérifier présence sur surfaces dashboard. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Vulgarisation « lis ton signal en 30s »** : chaque tuile signal traduit score/risque/R:R en langage simple + lien explication | Cœur du positionnement « vétéran qui explique ». Différencie d'un flux de signaux brut | MEDIUM | Réutilise contenu IA verbatim + glossaire existant. Pas de re-génération. |
| **Badge de provenance + N sur chaque % affiché** (`backtest` vs `réel`, échantillon) | Transforme la contrainte légale en argument de confiance unique sur le marché des signaux | LOW | Composant `ConfidenceStat`/`applyThreshold` existant (v2.1). Honnêteté = différenciateur. |
| **Signaux suivis / favoris (watchlist perso)** | Un membre veut retrouver « ses » trades suivis sans re-filtrer | MEDIUM | **Nouvelle table** `user_followed_setups (user_id, setup_id)` + RLS « lis/écris les tiens ». Première écriture front membre. |
| **Mini-tutoriel « première fois »** (onboarding non technique) | Audience MENA non technique : réduit l'abandon post-paiement | MEDIUM | Checklist d'accueil (1. lis un signal, 2. suis-en un, 3. rejoins Telegram). Pas un walkthrough lourd. |
| **Mon affiliation intégrée au dashboard** (gains dus/payés, code, lien de partage) | Membre = ambassadeur potentiel ; friction minimale à partager | LOW | Vue `affiliate_dashboard` (no-PII) déjà prête. Montant via `<bdi>`. |
| **Raccourci Telegram + résultats du jour** | Canal d'acquisition/rétention déjà bâti | LOW | Lien + dernier `telegram_posts`. |
| **Préférences de notification (in-app, langue, fuseau)** | Personnalisation attendue d'un produit mûr | MEDIUM | Colonnes `profiles` ou table `user_preferences`. Pas d'envoi réel en v3.0 (seedé). |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Courbe d'equity / P&L personnel « tes gains »** | « Voir combien j'ai gagné » paraît premium | Promesse/illusion de gain implicite + chiffre non mesuré (le membre n'exécute pas via la plateforme) → **viole VITR-03 + aucune promesse de gain** | Afficher l'**issue factuelle mesurée des signaux** (TP/SL/flat) + win-rate `pattern_stats` labellisé. Jamais un € gagné. |
| **« Performance de ton portefeuille » / ROI personnalisé** | Sentiment de tableau de bord trading « pro » | Pas de connexion broker, pas d'exécution → tout chiffre serait inventé | KPIs de **suivi** (signaux suivis, taux de signaux résolus TP), pas de rendement. |
| **Leaderboard / classement des membres** | Gamification, FOMO | Hors scope produit (PROJECT « communauté = v2 »), expose comparaison de gains = risque légal | Différer. Aucune surface sociale en v3.0. |
| **Config de stratégie / paramètres d'algo par l'utilisateur** | « Power user » veut tuner | Le moteur est déterministe et central ; exposer des leviers = support + incohérence | Filtres de lecture seuls (instrument, style, score min) — déjà existants. |
| **Temps réel sur tout (prix live streaming M1)** | « Vrai dashboard trading » | Hors scope P1/P3 (websockets), coût infra, données seedées | Supabase Realtime sur **publication de nouveaux signaux** seulement (déjà en place). |
| **Export PDF/CSV massif du journal** | Demande classique | Faible valeur en v3.0 seedé, complexité i18n/RTL d'export | Différer ; lien académie « tenir un journal ». |

---

## Feature Landscape — DASHBOARD SUPERADMIN (back-office)

> Cadre « société de ~50 personnes » : un cockpit qui couvre **Acquisition · Revenus · Opérations/Santé · Conformité**, pas seulement 3 KPI. Toutes les pages existent en germe — l'enjeu v3.0 = consolidation + enrichissement + reskin.

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Home cockpit multi-KPI** (membres actifs, MRR, file paiements, santé jobs, nouveaux 7j) | Un back-office ouvre sur une vue de pilotage, pas une carte | MEDIUM | Étend l'existant (3→~8 KPI). Head-counts cheap via service_role. MRR = Σ abos actifs × prix plan (calc seedé). |
| **Gestion utilisateurs/membres** : liste, recherche, statut abo, état paiement | Cœur opérationnel d'un SaaS | MEDIUM | `(admin)/membres` existe → ajouter recherche/pagination curseur + filtres statut. RLS superadmin déjà là. |
| **File de validation des paiements** (ambigus → activer/rejeter) | Le paiement USDT MVP est semi-manuel | MEDIUM | `(admin)/file` existe (`payments.status='ambiguous'`). Garder actions service_role (activation idempotente). |
| **Pilotage des signaux** : liste publiée, détail, statut, × telegram | Le superadmin contrôle ce qui sort | MEDIUM | `(admin)/signaux` + `[id]` existent. Enrichir avec issue/outcome + couverture instruments. |
| **Santé système** : fraîcheur données (feux), `job_runs` (succès/échec/stale), dernier run | PC potentiellement éteint = monitoring vital (contrainte projet) | MEDIUM | `(admin)/sante` + `v_data_freshness` + `job_runs` existent. Ajouter historique runs + durée + flag stale. |
| **Affiliés** : liste, perfs, file de candidatures, payouts dus/payés | Stratégie influenceurs = pilier acquisition | MEDIUM | `(admin)/affiliation/*` existe (affilies, payouts). RPC `mark_commission_paid` (service_role) déjà là. |
| **Tableau revenus/abonnements** : MRR, actifs vs expirés, churn brut, mix plans (discovery/standard) | Métrique n°1 de pilotage SaaS d'une « société » | MEDIUM | Dérivé de `subscriptions` + `payments`. **Tout calculé/mesuré** (pas de projection inventée). |
| **Navigation back-office unifiée + breadcrumbs** | 8+ pages → besoin d'une coquille cohérente | LOW | Layout `(admin)` partagé, reskin dark néon (peut rester plus sobre que public — UI-06). |
| **Garde d'accès strict (404 non-superadmin)** | Sécurité — déjà live-vérifié | — | `is_superadmin()` + layout gate **existant, ne pas régresser**. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Funnel d'acquisition** : visiteurs → inscrits → abonnés → actifs, par source (affilié/code) | Vision « société » du pipe commercial | MEDIUM | `referrals` + `affiliate_codes` + `subscriptions`. Seedé réaliste. Agrégats, pas de PII filleul. |
| **File de candidatures affiliés avec décision** (approuver/rejeter + raison) | Workflow opérationnel d'une équipe growth | MEDIUM | `affiliate_applications` (status pending→approved/rejected). Transition service_role. |
| **Calibration / qualité moteur** : win-rate par pattern, N, couverture instruments, % signaux résolus | Pilotage qualité produit (le « vétéran » est-il bon ?) | MEDIUM | `pattern_stats` + `prediction_outcomes`. **Mesuré + N visible** (cohérent VITR-03). |
| **Cohérence avec le public** : KPI superadmin = mêmes définitions que les chiffres montrés aux membres | Évite le « deux vérités » classique des back-offices | LOW | Réutiliser `has_active_subscription()` comme définition canonique d'« actif » (déjà fait dans la home admin). |
| **Vue conformité/légal** : disclaimers actifs, gate `LEGAL_REVIEW_DONE`, dernier audit | Risque réglementaire MENA = sujet board | LOW | Lecture du flag `legal-gate`. Read-only en v3.0. |
| **Audit log léger des actions admin** (qui a activé/rejeté quoi) | Traçabilité d'une org structurée | MEDIUM | **Nouvelle table** `admin_actions` (actor, action, target, ts) écrite par les server actions. Optionnel v3.0. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Édition manuelle des % / track record** depuis l'admin | « Corriger » un chiffre | Détruit l'invariant VITR-03 (% mesuré, jamais saisi à la main) | Aucune écriture de perf. Les % viennent du backtest/outcome-tracker seulement. |
| **Création/édition manuelle de signaux** depuis l'admin | « Publier un trade à la main » | Casse la frontière producteur-unique (`persist.ts` = seul chemin de confiance) | Pilotage/lecture seulement ; le moteur produit, l'admin observe. |
| **Outil d'envoi d'emails/broadcast intégré** | « CRM tout-en-un » | Surdimensionné, hors scope seedé, complexité délivrabilité | Différer ; Telegram déjà = canal. |
| **Builder de dashboards / widgets configurables** | Flexibilité « entreprise » | Sur-ingénierie massive pour une équipe naissante | Pages fixes opinionnées. |
| **Graphiques temps réel lourds (websockets partout)** | « Cockpit live » | Coût/complexité ; données seedées | RSC + refresh ; Realtime réservé aux nouveaux signaux. |
| **RBAC multi-niveaux fin** | « Société de 50 → plein de rôles » | `profiles.role` binaire (superadmin) suffit en v3.0 ; RBAC = dette inutile maintenant | Garder superadmin/membre. Étendre plus tard si besoin réel. |
| **Édition directe des montants commission/payout** hors RPC | Raccourci ops | Contourne `mark_commission_paid` (atomicité due→paid, anti double-payout) | Toujours passer par le RPC service_role existant. |

---

## Feature Dependencies

```
DASHBOARD UTILISATEUR (overview hub)
    └──requires──> Layout (dashboard) + navigation onglets
    └──requires──> subscriptions RLS (statut/expiry)            [EXISTE]
    └──aggregates──> (member)/signaux                           [EXISTE]
    └──aggregates──> (account)/abonnement + ExpiryBanner        [EXISTE]
    └──aggregates──> affiliation/dashboard (vue affiliate_dashboard) [EXISTE]

Signaux suivis (watchlist)
    └──requires──> NOUVELLE table user_followed_setups + RLS write front (user_id=auth.uid())
    └──enhances──> overview hub + historique

Historique signaux résolus
    └──requires──> trade_setups × prediction_outcomes           [EXISTENT]

DASHBOARD SUPERADMIN (cockpit)
    └──requires──> layout (admin) + gate is_superadmin()        [EXISTE]
    └──aggregates──> subscriptions/payments → MRR/churn/mix     [tables EXISTENT]
    └──aggregates──> v_data_freshness + job_runs → santé        [EXISTENT]
    └──aggregates──> affiliates/referrals/commissions/payouts/applications [EXISTENT]
    └──aggregates──> pattern_stats + prediction_outcomes → qualité moteur  [EXISTENT]
    └──enhances(opt)──> NOUVELLE table admin_actions (audit log)

Funnel acquisition (superadmin)
    └──requires──> referrals + affiliate_codes + subscriptions  [EXISTENT]

Design system dark néon unique
    └──blocks──> reskin de TOUTES les surfaces ci-dessus (DS d'abord, sinon double travail)

Données seedées réalistes
    └──blocks──> tout dashboard non-trivial (sans data, les vues sont vides → pas démontrable)
```

### Dependency Notes

- **DS dark néon avant les dashboards** : reskinner pendant la construction des dashboards évite un double passage. Le DS (composants `.nxl`, tokens OKLCH, ScoreRing/ConfidenceStat/Marquee) **existe déjà** (v2.1 Phase 11) → le promouvoir en global est un prérequis, pas une création.
- **Seed avant démonstration** : les dashboards superadmin (MRR, funnel, churn, qualité moteur) sont vides sans données réalistes seedées sur `subscriptions`, `payments`, `referrals`, `commissions`, `trade_setups`, `prediction_outcomes`, `pattern_stats`, `job_runs`. Le seed est un **bloquant transverse**.
- **Watchlist = première écriture front membre** : toutes les tables actuelles sont en lecture-seule front (write = service_role). `user_followed_setups` introduit la première policy `insert/delete` scopée `auth.uid()` → revue sécurité (IDOR, isolation cross-user) requise.
- **Définition canonique d'« actif » partagée** : `status='active' AND current_period_end > now()` (helper `has_active_subscription()`) doit être la **seule** source pour « membre actif » côté membre ET superadmin ET affiliation (déjà le cas — préserver).
- **% mesuré bloque tout widget de perf** : aucun composant de score/win-rate ne s'affiche sans provenance+N. Le seed doit produire des `pattern_stats` labellisés `backtest` avec N réaliste (≥30 pour bascule, sinon « échantillon insuffisant »).

---

## MVP Definition (périmètre v3.0)

### Launch With (cœur v3.0)

**Dashboard utilisateur :**
- [ ] Layout `(dashboard)` + navigation onglets (overview/signaux/abonnement/affiliation/paramètres) — coquille trilingue RTL
- [ ] **Vue d'ensemble** : statut abo + jours restants + raccourcis + dernier signal + lien Telegram
- [ ] **Onglet abonnement** : intégration `(account)/abonnement` + ExpiryBanner
- [ ] **Onglet affiliation** : intégration dashboard affilié no-PII existant
- [ ] **Onglet paramètres** : email/langue/mot de passe/déconnexion
- [ ] **Historique des signaux résolus** (TP/SL/flat mesuré, pas de €)
- [ ] États vides pédagogiques + disclaimers présents

**Dashboard superadmin :**
- [ ] **Home cockpit** étendu (~8 KPI : membres actifs, MRR, nouveaux 7j, file paiements, santé, affiliés actifs, candidatures en attente, % signaux résolus)
- [ ] **Revenus/abonnements** : MRR mesuré, actifs/expirés, mix plans, churn brut
- [ ] **Membres** : recherche + pagination + filtres (enrichit l'existant)
- [ ] **Santé** : feux fraîcheur + historique `job_runs` + flag stale (enrichit l'existant)
- [ ] **Affiliés** : perfs + file candidatures (décision) + payouts (enrichit l'existant)
- [ ] **Qualité moteur** : win-rate par pattern mesuré + N + couverture instruments

**Transverse :**
- [ ] Design system dark néon unique appliqué à toutes ces surfaces
- [ ] **Seed réaliste** de toutes les tables nécessaires (provenance des % = backtest/démo labellisée)

### Add After Validation (v3.x)

- [ ] **Watchlist / signaux suivis** (nouvelle table + write front) — déclencheur : demande membres
- [ ] **Préférences de notification** (table dédiée) — déclencheur : canal de notif réel branché
- [ ] **Funnel d'acquisition** détaillé par source — déclencheur : volume d'affiliés réel
- [ ] **Audit log admin** (`admin_actions`) — déclencheur : >1 personne avec accès admin

### Future Consideration (v4+)

- [ ] Export PDF/CSV du journal — défer (faible valeur seedé, complexité i18n)
- [ ] RBAC multi-rôles fin — défer (binaire suffit)
- [ ] Surfaces sociales/leaderboard — hors scope produit (communauté = v2 PROJECT)
- [ ] Notifications push/email réelles — défer (pas de canal branché en v3.0)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Vue d'ensemble dashboard utilisateur | HIGH | LOW | P1 |
| Navigation onglets + coquille (dashboard) | HIGH | LOW | P1 |
| Statut abonnement + ExpiryBanner (intégration) | HIGH | LOW | P1 |
| Onglet affiliation (intégration vue existante) | MEDIUM | LOW | P1 |
| Paramètres compte | MEDIUM | LOW | P1 |
| Historique signaux résolus (TP/SL/flat mesuré) | HIGH | MEDIUM | P1 |
| États vides pédagogiques + disclaimers | HIGH (non-tech) | LOW | P1 |
| Home cockpit superadmin ~8 KPI | HIGH | MEDIUM | P1 |
| Revenus/abonnements (MRR/churn/mix mesuré) | HIGH | MEDIUM | P1 |
| Membres (recherche/pagination/filtres) | HIGH | MEDIUM | P1 |
| Santé (feux + job_runs historique) | HIGH | MEDIUM | P1 |
| Affiliés (perfs + candidatures + payouts) | HIGH | MEDIUM | P1 |
| Qualité moteur (win-rate/N/couverture) | MEDIUM | MEDIUM | P2 |
| Funnel d'acquisition par source | MEDIUM | MEDIUM | P2 |
| Watchlist signaux suivis (write front) | MEDIUM | MEDIUM | P2 |
| Vue conformité/légal read-only | LOW | LOW | P2 |
| Audit log admin | LOW | MEDIUM | P3 |
| Préférences de notification | LOW | MEDIUM | P3 |
| Export / RBAC / social | LOW | HIGH | P3 |

**Priority key:** P1 = cœur v3.0 · P2 = ajouter si budget · P3 = différé.

---

## Spécificités prises en compte (quality gate)

| Spécificité | Traitement dans cette recherche |
|---|---|
| **% mesuré, jamais inventé** | Anti-features equity/P&L/ROI explicites ; tout % porte provenance+N ; seed labellisé `backtest`/`démo` ; édition manuelle des perfs interdite côté admin. |
| **Aucune promesse de gain** | Pas de « gains », pas de projection ; on montre l'**issue factuelle** des signaux (TP/SL/flat). |
| **Public non technique (vulgarisation)** | Tuiles « lis ton signal en 30s », onboarding, états vides guidés, glossaire réutilisé. |
| **Trilingue fr/en/ar + RTL** | Onglets/tableaux en propriétés logiques ; `<bdi>`/`Intl.NumberFormat` sur montants/compteurs (déjà le pattern admin). |
| **« Société de ~50 personnes » (superadmin)** | Cockpit 4 axes : Acquisition (funnel/affiliés) · Revenus (MRR/churn/mix) · Ops (santé jobs/données, file paiements) · Conformité (gate légal). |
| **Données seedées** | Seed = bloquant transverse ; sans lui les dashboards sont vides et non démontrables. |
| **Dépendances tables/RLS** | Tout réutilise les RLS existantes (lecture scopée + superadmin) ; seule nouveauté write = `user_followed_setups` (P2, revue sécu). |

---

## Sources

- Codebase NEXA lu directement : `apps/web/src/app/[locale]/dashboard/page.tsx` (stub), `(admin)/page.tsx` (KPI), migrations `0009` (subscriptions/gating), `0016` (affiliation complète) — **HIGH**
- Inventaire des surfaces (`Glob` pages) + inventaire migrations (tables/RLS disponibles) — **HIGH**
- `.planning/PROJECT.md` (vision « société de ~50 personnes », core value, VITR-03, hors-scope communauté) + `.planning/REQUIREMENTS.md` (v2.1, anti-features % hardcodé / promesse de gain) — **HIGH**
- Conventions de marché dashboards SaaS membre + back-office analytics (overview hub, onglets, MRR/churn/funnel, santé jobs) — **MEDIUM** (patterns standards recoupés, non sourcés URL)

---
*Feature research for: dashboards SaaS (membre + superadmin) — trading-signals MENA*
*Researched: 2026-06-22*
