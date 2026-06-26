# Phase 20: Dashboard superadmin (cockpit 4 axes) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-26
**Phase:** 20-dashboard-superadmin-cockpit-4-axes
**Areas discussed:** Accès data (service_role→RLS), Structure cockpit 4 axes, KPIs & matviews, Actions superadmin, Conformité

---

## Triage de périmètre (liste d'actions ajoutée par l'utilisateur)

L'utilisateur a ajouté en texte libre : voir users, offrir jours/mois gratuits, suspendre comptes, voir affiliés, créer liens affiliés, créer promotions, gérer prix & offres.

| Item | Verdict | Selected |
|------|---------|----------|
| Voir utilisateurs / voir affiliés | 🟢 Dans P20 (ADASH-04/05, lecture) | ✓ |
| Offrir jours/mois gratuits | 🟡 Dans P20 (nouvelle écriture admin) | ✓ |
| Suspendre comptes | 🟡 Dans P20 (nouvelle colonne + write) | ✓ |
| Créer des liens affiliés (admin) | 🔴 Différé (au-delà ADASH-05) | |
| Créer des promotions | 🔴 Différé (aucun système, phase dédiée) | |
| Gérer prix & offres (dynamique) | 🔴 Différé (prix = constantes code, phase dédiée) | |

**User's choice:** « 1 » → OK tel quel (garder 🟢+🟡, différer les 🔴).

---

## Accès data (service_role → anon + RLS)

| Question | Option retenue |
|----------|----------------|
| Lectures admin | **Tout en anon + RLS superadmin** (retirer createAdminServiceClient ; tables via policy superadmin, KPIs via wrappers gated) |
| Tables sans policy superadmin | **Migration 0021 : policies superadmin par table** |
| Écritures admin | **RPC SECURITY DEFINER gated is_superadmin()** (calque payout 0016) |
| Audit | **Table admin_audit_log dédiée** (écrite dans le RPC) |

**Notes:** Alternatives écartées : hybride service_role server-only (viole « jamais service_role côté page ») ; wrappers RPC pour lignes brutes (trop lourd pour tables filtrables) ; policies RLS write (éparpille audit/logique).

---

## Structure cockpit 4 axes

| Question | Option retenue |
|----------|----------------|
| Architecture | **Home cockpit 4 sections + drill-down** (enrichir (admin)/page) |
| Sidebar | **Groupée par les 4 axes** |
| Ordre en proue | **Revenus → Ops → Acquisition → Conformité** |
| Style reskin | **Tier App sobre + feux sémantiques** (pas de néon) |

**Notes:** Alternatives écartées : 4 pages d'axe pleines ; liste plate enrichie ; ordre Ops-first ; néon accentué sur KPIs.

---

## KPIs & matviews

| Question | Option retenue |
|----------|----------------|
| Pattern KPIs agrégés | **Hybride** (matview si coûteux sinon RPC gated à la volée ; réutilise mv_mrr) |
| Funnel acquisition | **Inscription → 1er paiement → renouvellement** (segmentable source/affilié) |
| Churn | **Taux mensuel** : expirés-non-renouvelés / actifs début mois |
| Labellisation | **Chaque KPI = valeur mesurée + N + période + source** (MRR = « cash encaissé/mois », test no-perf étendu admin) |

**Notes:** Alternatives écartées : tout en matviews (refresh à gérer, PC éteint) ; tout à la volée ; funnel canal-affilié-seul ; comptage brut churn ; labels allégés.

---

## Actions superadmin (gestion users + affiliés/paiements)

| Question | Option retenue |
|----------|----------------|
| Tables 10k | **Keyset serveur cursor.ts, zéro dépendance** (conflit roadmap react-virtual vs P19 tranché en faveur de P19) |
| Filtres users | **État abo + source + recherche email/id** |
| Offrir gratuit | **Dialog presets (7j/1mois/3mois/custom) + RPC + audit** |
| Suspendre | **Colonne profiles.suspended + raison, blocage réel gate+RLS, réversible, RPC + audit** |

**Notes:** Alternatives écartées : @tanstack/react-virtual+react-table (rompt zéro-dépendance P19) ; filtre état-abo seul ; date custom brute ; flag UI sans blocage réel (gate UX seul interdit).

---

## Conformité (ADASH-06)

| Question | Option retenue |
|----------|----------------|
| Panneau Conformité | **Statut + version artefact + date** (read-only via legal-gate.ts) |

**Notes:** Alternative écartée : feu vert/rouge simple sans détail version/date.

---

## Claude's Discretion

- Découpage exact migration 0021 (tables déjà couvertes P17 vs manquantes).
- Quels KPIs en matview vs à la volée (via EXPLAIN ANALYZE sur seed ~10k).
- Signatures/nommage des RPC SECURITY DEFINER + schéma admin_audit_log.
- Redirection des anciennes URLs admin si sidebar réorganisée.
- Branchement Realtime (Broadcast P17) sur le cockpit — optionnel.

## Deferred Ideas

- Créer des promotions (moteur promo/coupon) — phase dédiée.
- Gérer prix & offres dynamiquement (pricing engine) — phase dédiée.
- Création de liens/codes affiliés par l'admin — différé (au-delà ADASH-05).
