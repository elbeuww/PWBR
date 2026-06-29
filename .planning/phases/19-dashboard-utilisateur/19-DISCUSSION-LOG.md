# Phase 19: Dashboard utilisateur - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-26
**Phase:** 19-dashboard-utilisateur
**Areas discussed:** Navigation, Sémantique suivis/historique, UX watchlist, Composition vue d'ensemble, Affiliation, Paramètres

> Note d'amorçage : la commande a été invoquée sur la phase 18, déjà terminée/exécutée (CONTEXT/research/plans/verification existants). Coquille confirmée par l'utilisateur → discussion redirigée sur la **phase 19** (prochaine phase non démarrée).

---

## Navigation & structure du groupe `(dash)`

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar + bottom-nav mobile | Sidebar persistante desktop + bottom-nav mobile, scalable à 6 onglets, RTL-safe | ✓ |
| Onglets horizontaux haut | Tabs en haut, sature au-delà de 4-5, scroll horizontal pénible AR/mobile | |
| Overview + sections liées | Une page hub liant vers routes dédiées, pas de vrai shell | |

| Option | Description | Selected |
|--------|-------------|----------|
| Shell (dash) monte composants existants | Nouveau shell + gate requireUser, réutilise composants, zéro réimpl | ✓ |
| Migrer les routes sous (dash) | Déplacement physique + redirections 301, touche beaucoup de routes/E2E | |
| (dash) = liens vers routes existantes | Orchestration/liens seulement, UX dashboard faible | |

**User's choice:** Sidebar + bottom-nav mobile ; Shell `(dash)` monte composants existants.
**Notes:** Claude a noté que `(dash)` gated `requireUser` (pas `requireActiveSub`) → l'affichage non-actif tranché ensuite dans l'overview.

---

## Sémantique suivis/historique + Déclencheur watchlist

| Option | Description | Selected |
|--------|-------------|----------|
| Watchlist active → clôturés | Source unique user_followed_setups joint trade_setups, filtré par statut | ✓ |
| Watchlist + archive globale | Historique = archive globale non perso, deux sources | |
| Watchlist + journal consultés | Historique = view-log à créer, plus lourd | |

| Option | Description | Selected |
|--------|-------------|----------|
| Étoile sur carte + détail | Toggle optimiste sur SignalCard ET détail, le plus découvrable | ✓ |
| Bouton 'Suivre' détail seul | Action uniquement dans le détail, moins découvrable | |
| Étoile sur carte seule | Toggle liste seule, pas d'action depuis le détail | |

**User's choice:** Watchlist active → clôturés ; Étoile sur carte + détail.

---

## Composition vue d'ensemble + Cas non-abonné

| Option | Description | Selected |
|--------|-------------|----------|
| Abo en tête → signaux → raccourcis | Abonnement + ExpiryBanner d'abord (rétention = business) | ✓ |
| Signaux en tête → abo → raccourcis | Produit d'abord, facturation ensuite | |
| Grille KPI perso → flux | Bandeau cartes KPI en tête, risque surcharge mobile | |

| Option | Description | Selected |
|--------|-------------|----------|
| Même shell + upsell | Cartes verrouillées + CTA, RLS 0 ligne | (reframé) |
| Overview minimal | Statut abo + CTA seul, onglets masqués | |
| Redirection /tarifs | Redirige non-abonné, incohérent avec UDASH-01 | |

**User's choice:** Abo en tête → signaux → raccourcis. **Recadrage majeur sur le cas non-abonné :** « il n'y a pas de compte gratuit, on enlève ça ». 3 dashboards distincts : user / affilié / admin.
**Notes:** Conséquence actée → `requireUser` sert au cas **abonné expiré** (renouvellement, UDASH-04), pas à un compte gratuit. État « renouvelle pour réaccéder » plutôt qu'upsell gratuit.

---

## Affiliation + Paramètres

| Option | Description | Selected |
|--------|-------------|----------|
| Carte résumé → dashboard affilié | Carte résumé si affilié + lien vers dashboard affilié dédié | ✓ |
| Onglet affiliation complet dans (dash) | Onglet plein, contredit '3 dashboards séparés' | |
| Rien dans user-dash | Affiliation 100% dédiée, juste un lien nav | |

| Option (multi) | Description | Selected |
|--------|-------------|----------|
| Compte (email, mot de passe) | Email + changement mdp via Supabase auth | ✓ |
| Langue & préférences | Sélecteur AR/EN/FR, pas de toggle thème (dark forcé) | ✓ |
| Notifications | Préférences notif — pas d'infra delivery en place | ✓ (UI seule) |
| Lien abonnement & déconnexion | Raccourci gestion abo + bouton déconnexion | ✓ |

**User's choice:** Carte résumé → dashboard affilié dédié ; Paramètres = Compte + Langue + Notifications (UI) + lien abonnement + déconnexion. **Idée additionnelle :** « proposer d'inviter des amis et arriver à 10 → 2 mois gratuits ».
**Notes:** L'idée parrainage qualifiée comme nouvelle capacité (≠ affiliation) → déférée. Notifications limitées à l'UI de préférences (pas de delivery).

---

## Claude's Discretion

- Redirection des anciennes routes vs conservation (shell `(dash)`).
- Implémentation exacte du helper curseur keyset (aucun en code).
- Choix libs `react-table`/`react-virtual`/`nuqs` (absentes) vs réutilisation du pattern URL-state custom existant — à trancher en recherche/plan.

## Deferred Ideas

- **Programme de parrainage à récompense** (10 invités = 2 mois gratuits) — nouvelle capacité distincte de l'affiliation. Déférée à sa propre phase/requirement. Décision utilisateur : « Déférer → phase dédiée ».
- **Infra de delivery des notifications** (email/push) — hors scope Phase 19 (UI préférences seulement).
