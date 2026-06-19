# Phase 8: Superadmin consolidé (signaux, santé, affiliés) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 8-Superadmin consolidé (signaux, santé, affiliés)
**Areas discussed:** Shell/nav back-office, Vue Signaux publiés, Vue Santé jobs/données, Pilotage payouts affiliés

---

## Shell / navigation back-office

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar + dashboard KPI | Sidebar persistante (Membres / File / Affiliation / Payouts / Signaux / Santé) + page d'accueil /admin avec cartes KPI | ✓ |
| Sidebar seule | Sidebar persistante, /admin redirige vers Membres | |
| Topnav horizontale | Barre de navigation horizontale en haut, sans sidebar | |

**User's choice:** Sidebar + dashboard KPI
**Notes:** Vue d'ensemble immédiate souhaitée à l'entrée du back-office.

---

## Vue Signaux publiés

| Option | Description | Selected |
|--------|-------------|----------|
| Setups + statut Telegram + filtres | Liste chrono trade_setups, colonne statut publication Telegram, filtres instrument/statut, lien détail | ✓ |
| Setups + statut Telegram (sans filtres) | Liste chrono avec statut publication mais sans filtres | |
| Setups seuls | trade_setups récents uniquement, sans croisé Telegram | |

**User's choice:** Setups + statut Telegram + filtres
**Notes:** Couvre pleinement la partie "signaux" d'ADMIN-04. Lecture seule (pas d'édition admin).

---

## Vue Santé jobs/données

| Option | Description | Selected |
|--------|-------------|----------|
| Feux + tableau runs | Feux vert/orange/rouge par source (fraîcheur candles/news/macro, seuils stale) + tableau derniers job_runs | ✓ |
| Tableau brut | Tableaux job_runs + freshness sans code couleur | |
| Synthèse globale | Un seul indicateur global OK/stale + détail au clic | |

**User's choice:** Feux + tableau runs
**Notes:** Lecture opérationnelle rapide. Alerting automatique déféré.

---

## Pilotage payouts affiliés

| Option | Description | Selected |
|--------|-------------|----------|
| Enrichir : marquer payé + réf tx + historique | Marquer commission 'payée' avec référence de transaction + historique des payouts | ✓ |
| Enrichir + export CSV | Idem + export CSV des payouts | |
| Intégration au shell seulement | Pas d'enrichissement, juste rattacher la page existante | |

**User's choice:** Enrichir : marquer payé + réf tx + historique
**Notes:** Page payouts déjà créée en phase 7 ; phase 8 complète le workflow manuel d'ADMIN-03. Export CSV écarté (préférence historique in-app).

## Claude's Discretion

- Style visuel sidebar/dashboard (shadcn/ui FR mono-langue), cohérent avec l'UI back-office existante.
- Seuils exacts orange vs rouge pour la fraîcheur (à dériver de la logique `stale` existante).
- Question DB ouverte volontairement : marquage 'payé' + réf tx nécessite-t-il une migration (colonne statut payout / table `payouts` ou champ `commissions`) — à trancher en research/plan. Numéro de migration : prochaine libre après 0015 (0013 RÉSERVÉE P4).

## Deferred Ideas

- Alerting/notifications automatiques sur stale ou job en échec — future phase ops.
- Paiement on-chain automatisé des payouts — hors scope.
- Édition/modération des signaux depuis l'admin — lecture seule en phase 8.
- Export CSV des payouts — écarté, réenvisageable plus tard.
