# Phase 4: Paiement USDT MVP & abonnement — JALON ENCAISSEMENT - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 4-Paiement USDT MVP & abonnement — JALON ENCAISSEMENT
**Areas discussed:** Parcours paiement & attente, Cas ambigus & matching payeur, Cycle de vie & expiration, Vue membres superadmin

---

## Parcours paiement & attente (PAY-01/02/03)

### Attente pendant la vérif on-chain
| Option | Description | Selected |
|--------|-------------|----------|
| Polling live in-app | « Vérification en cours… » avec étapes, activation visible dès confirmation | ✓ |
| Asynchrone différé | « On vérifie, ton accès s'ouvre dès confirmation » — libère la page | |
| Hybride | Polling court (~2 min) puis bascule différé | |

### Screenshot de transaction
| Option | Description | Selected |
|--------|-------------|----------|
| Optionnel, pour litiges | Facultatif ; preuve pour la file superadmin, hors vérif auto | ✓ |
| Pas du tout au MVP | Le hash on-chain suffit | |
| Obligatoire | Toujours demandé | |

### Échec de vérification
| Option | Description | Selected |
|--------|-------------|----------|
| Raison claire + re-soumettre | Message précis + correction/re-soumission, chaque tentative tracée | ✓ |
| Message générique + support | « Paiement non validé, contacte le support » | |
| Direct en file superadmin | Tout échec en validation manuelle | |

### Adresse de réception
| Option | Description | Selected |
|--------|-------------|----------|
| Une adresse partagée | Cold wallet, watcher read-only, clés jamais en code/DB ; hash+montant distinguent | ✓ |
| Adresses dérivées par user | HD wallet, matching parfait mais infra clés lourde | |

**User's choice:** Toutes les options recommandées.
**Notes:** UX rassurante prioritaire pour un public crypto-novice ; sécurité clés (cold wallet) réaffirmée.

---

## Cas ambigus & matching payeur (PAY-04 / ADMIN-02)

### Sous-paiement
| Option | Description | Selected |
|--------|-------------|----------|
| File superadmin | Décision manuelle (complément/prorata/remboursement) | ✓ |
| Rejet auto | « Montant insuffisant » sans activation | |
| Activer au prorata | Durée réduite proportionnelle | |

### Sur-paiement
| Option | Description | Selected |
|--------|-------------|----------|
| Activer + surplus ignoré | Période normale, excédent noté non remboursé auto | ✓ |
| Activer + créditer l'excédent | Prolonge la durée du surplus | |
| File superadmin | Toute sur-paiement en manuel | |

### Matching payeur
| Option | Description | Selected |
|--------|-------------|----------|
| Montant unique par facture | Centimes uniques (9.01…) → identification déterministe | ✓ |
| Hash soumis + montant nominal | UNIQUE(tx_hash) global, dépend de l'user | |

### File de validation superadmin
| Option | Description | Selected |
|--------|-------------|----------|
| Activer/Rejeter + ajuster | Actions binaires + ajustement durée/plan | ✓ |
| Activer/Rejeter seulement | Deux actions + motif | |
| Lecture seule | Résolution via vue membres | |

**User's choice:** Toutes les options recommandées.
**Notes:** Robustesse privilégiée (file plutôt qu'auto-rejet) ; montant unique = garde-fou déterministe complétant le hash.

---

## Cycle de vie & expiration (PAY-05 / PAY-06)

### Rappel avant expiration
| Option | Description | Selected |
|--------|-------------|----------|
| Bandeau in-app seul | J-3/J-1 dans l'espace membre, aucune infra email | ✓ |
| Bandeau in-app + email | Plus efficace, nécessite provider email | |
| Email seul | Dépend d'infra email | |

### Expiration
| Option | Description | Selected |
|--------|-------------|----------|
| Coupe nette | Accès coupé à current_period_end (RLS déjà > now()) | ✓ |
| Période de grâce X jours | Accès maintenu quelques jours | |

### Renouvellement
| Option | Description | Selected |
|--------|-------------|----------|
| Même parcours paiement | Nouveau hash → prolonge current_period_end | ✓ |
| Auto-renew | Hors scope MVP (crypto manuel) | |

### Offre découverte one-shot
| Option | Description | Selected |
|--------|-------------|----------|
| One-shot + upgrade anticipé | Une fois, puis standard ; upgrade discovery→standard possible sans remboursement | ✓ |
| One-shot strict | Une fois, pas d'upgrade anticipé | |
| Cumulables | Empilables (déconseillé) | |

**User's choice:** Toutes les options recommandées.
**Notes:** Pas d'email assumé (budget) ; coupe nette s'appuie sur la RLS existante.

---

## Vue membres superadmin (ADMIN-01)

### Périmètre
| Option | Description | Selected |
|--------|-------------|----------|
| Lecture + actions manuelles | Liste + état ET activer/prolonger/révoquer | ✓ |
| Lecture seule | Voir seulement | |
| Lecture + lien vers la file | Renvoi pour agir | |

### Actions manuelles (multi-sélection)
| Option | Description | Selected |
|--------|-------------|----------|
| Activer / prolonger | Créditer une période à la main | ✓ |
| Révoquer / suspendre | Couper un accès (fraude/remboursement) | ✓ |
| Changer de plan | discovery↔standard | ✓ |

### Filtres / colonnes
| Option | Description | Selected |
|--------|-------------|----------|
| Statut + recherche email + plan/expiry | Filtre actif/inactif/expiré, recherche email, colonnes plan/expiry/dernier paiement | ✓ |
| Minimal | Liste + statut | |
| Riche | + historique inline | |

### Emplacement
| Option | Description | Selected |
|--------|-------------|----------|
| Route group (admin) existant | Hors [locale], 404 non-superadmin (P1 D-09) | ✓ |
| Sous [locale] traduit | Admin dans l'arbre i18n (à éviter) | |

**User's choice:** Options recommandées + free-text « restaurer password » ajouté aux actions.
**Notes:** « Restaurer password » (reset mot de passe membre par le superadmin) = gestion de compte/auth, hors ADMIN-01 strict → capté en Deferred (non intégré à P4 après choix « prêt pour le contexte »).

---

## Claude's Discretion

- Schéma table `payments` (migration 0012) + policies RLS (insert pending user, transitions service_role, UNIQUE(tx_hash) global).
- Client TronGrid (fetch + Zod maison) : lecture TX TRC-20, normalisation destinataire hex↔base58, only_confirmed:true, montant BigInt ×10⁶.
- Variables `.env` : adresse réception USDT, contrat USDT officiel, clé/endpoint TronGrid (jamais de clé privée).
- Mécanique de l'offset de montant unique (plage, réservation, libération).
- Job `subscription-expiry` (Windows Task Scheduler + idempotence job_runs).
- Découpage composants UI + extension namespace messages (`payment`).
- Stratégie polling (intervalle/timeout, react-query) + repli différé éventuel.

## Deferred Ideas

- Reset mot de passe membre par superadmin (auth, hors ADMIN-01) — non intégré P4.
- Auto-renew / paiement récurrent (impossible USDT manuel).
- Watcher push on-chain généralisé sans soumission de hash (PAY-AUTO, Wave 5).
- Infra email (rappels/reçus) — post-MVP.
- Période de grâce après expiration.
- Remboursement auto des sur-paiements / crédit de durée.
- Adresses USDT dérivées par user (HD wallet).
