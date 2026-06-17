# Phase 7: Affiliation à paliers - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 7-Affiliation à paliers
**Areas discussed:** Barème de commission, Code promo & format, Attribution du ?ref, Dashboard affilié (no-PII)

---

## Barème de commission

| Option | Description | Selected |
|--------|-------------|----------|
| Progressif par paliers | Taux qui monte avec le nb de filleuls, plafond 20 % | ✓ |
| Fixe 20 % | Tout le monde à 20 % dès le 1er filleul | |
| Fixe < 20 % | Taux unique plus bas, 20 % = plafond légal | |

**User's choice (structure du taux) :** Progressif par paliers.

| Option | Description | Selected |
|--------|-------------|----------|
| Montant payé réel (amount_atomic) | % du USDT réellement encaissé | ✓ |
| Prix nominal du plan | % du prix catalogue 9 $/3 $ | |

**User's choice (base) :** Montant payé réel `amount_atomic`.

| Option | Description | Selected |
|--------|-------------|----------|
| Standard seulement | Pas de commission sur le 3 $ découverte | |
| Découverte + standard | Commission dès le 3 $ découverte | ✓ |

**User's choice (offre découverte) :** Découverte + standard commissionnent.

| Option | Description | Selected |
|--------|-------------|----------|
| Mois calendaire (UNIQUE period) | period = 'YYYY-MM', 1 commission/filleul/mois | ✓ (reco, après abandon de « hebdo ») |
| Période d'abo du filleul | Calée sur current_period_end de chaque filleul | |

**User's choice (période) :** D'abord répondu « hebdo » (freeform), puis « on oublie ça, on calcule selon tes recommandations » → **mois calendaire** retenu.

**Notes :** Grille de paliers définie par le fondateur (objectif : récompenser le volume d'audience, 20 % réservé aux 50k+). 8 paliers validés : 1–99 → 8 % · 100–500 → 12 % · 501–1 000 → 14 % · 1 001–5 000 → 15 % · 5 001–10 000 → 16 % · 10 001–25 000 → 17 % · 25 001–50 000 → 18 % · 50 000+ → 20 %. **Le palier est compté sur les INSCRITS via le code** (audience), pas sur les abonnés actifs ; le montant reste % × revenu des actifs. Fondateur : « on compte les inscrits ; pas de compte sans payer » → flag posé dans CONTEXT pour que le planner définisse précisément « inscrit » (profil attribué au signup) vs abonné actif.

---

## Code promo & format

| Option | Description | Selected |
|--------|-------------|----------|
| Vanity choisi par l'affilié | Code mémorisable (ex. BORHANE), unique, format borné | ✓ |
| Auto-généré aléatoire | Slug court aléatoire, zéro collision | |
| Hybride | Auto par défaut, vanity sur demande modérée | |

**User's choice (génération) :** Vanity choisi par l'affilié.

| Option | Description | Selected |
|--------|-------------|----------|
| Superadmin attribue rôle + code | Promotion 'affiliate' + code via back-office | ✓ |
| Self-serve | N'importe quel membre s'auto-déclare affilié | |

**User's choice (onboarding) :** Superadmin attribue rôle + code.

**Notes :** Précisé ensuite en programme **sur candidature** — voir Attribution du ?ref ci-dessous.

---

## Attribution du ?ref

| Option | Description | Selected |
|--------|-------------|----------|
| 30 jours | Fenêtre cookie standard | ✓ |
| 90 jours | Fenêtre longue | |
| 7 jours / session | Fenêtre courte | |

**User's choice (fenêtre cookie) :** 30 jours (après explication de ce qu'est `?ref=` — le fondateur n'avait pas compris le terme au départ).

| Option | Description | Selected |
|--------|-------------|----------|
| Last-touch | Le dernier ?ref= gagne | ✓ |
| First-touch | Le premier ?ref= est figé | |

**User's choice (multi-ref) :** Last-touch.

| Option | Description | Selected |
|--------|-------------|----------|
| Exclusion au calcul | Le job ignore referral.user_id = affiliate.user_id | ✓ |
| Blocage à l'inscription | Refus d'attribution si compte = affilié | |

**User's choice (auto-parrainage AFF-05) :** Exclusion au calcul (inviolable).

| Option | Description | Selected |
|--------|-------------|----------|
| Oui, formulaire + file de revue | Candidature (réseaux/abonnés/interactions) → file (admin) → approbation manuelle | ✓ |
| MVP : création directe superadmin | Recrutement hors-plateforme, superadmin crée le compte | |

**User's choice (candidature dans P7) :** Oui, formulaire de candidature + file de revue superadmin.

**Notes :** Le fondateur décrit un **programme sur candidature** : quiconque a le lien du programme partage ses réseaux sociaux, canal Telegram, page Facebook, nombre d'abonnés et niveau d'interactions ; le superadmin **vérifie manuellement** (pas d'auto-évaluation) avant d'attribuer rôle + code. L'auto-évaluation des conditions est explicitement différée.

---

## Dashboard affilié (no-PII)

| Option | Description | Selected |
|--------|-------------|----------|
| Agrégats seuls (compteurs) | Aucune ligne par filleul, totaux uniquement | ✓ |
| Lignes pseudonymisées | #1234 · plan · actif depuis | |

**User's choice (filleuls no-PII) :** Agrégats seuls.

| Option | Description | Selected |
|--------|-------------|----------|
| Set complet | Abonnés actifs + total inscrits + revenus + commissions + taux/palier | ✓ |
| Minimal | Abonnés actifs + commissions seulement | |

**User's choice (métriques) :** Set complet.

| Option | Description | Selected |
|--------|-------------|----------|
| tx_hash + date + montant | Traçabilité on-chain du payout | ✓ |
| Statut + date seulement | Bascule due → payée sans hash | |

**User's choice (payout AFF-04) :** tx_hash + date + montant.

---

## Claude's Discretion

- Schéma exact des tables (migration 0016 ; 0013 absente — à ne pas réutiliser), noms/colonnes.
- RLS isolation affilié (miroir payments/subscriptions), écritures service_role/RPC.
- Job mensuel de calcul de commission (idempotent, job_runs, Windows Task Scheduler).
- Définition opérationnelle d'« inscrit » (compteur referrals vs abonnés actifs).
- Format/longueur/normalisation du code vanity.
- Implémentation de la capture cookie ?ref dans le middleware P1.
- Requêtes d'agrégation no-PII du dashboard.
- Découpage UI (candidature, portail affilié, file de revue admin, vue payout) + namespace i18n `affiliate`.

## Deferred Ideas

- Moteur d'éligibilité auto-évalué (vérif auto des seuils réseaux sociaux) → manuel au MVP.
- Payout on-chain automatisé (AFF-AUTO) → Wave 5, hors roadmap v2.0.
- Lignes pseudonymisées par filleul → écarté au profit des agrégats.
- Blocage auto-parrainage à l'inscription → optionnel (garde-fou au calcul suffit).
- Gestion consolidée des affiliés / performances superadmin (ADMIN-03/04) → Phase 8.
