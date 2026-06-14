# Phase 2: Vitrine publique trilingue & gate légal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 2-Vitrine publique trilingue & gate légal
**Areas discussed:** Identité visuelle & design system, Page d'accueil (structure & preuve %), Funnel d'abonnement, Gate juridique & disclaimers

---

## Identité visuelle & design system

### Ton de marque
| Option | Description | Selected |
|--------|-------------|----------|
| Finance sérieuse & crédible | Institutionnel, sobre, inspire confiance | ✓ |
| Fintech moderne épurée | Clean, espace blanc, accent vif | |
| Crypto dynamique | Sombre, néons, gradients | |

### Thème
| Option | Description | Selected |
|--------|-------------|----------|
| Dark par défaut | Cohérent charts/dashboards | |
| Light par défaut | Classique marketing | |
| Toggle dark/light | Les deux, bascule utilisateur | ✓ |

### Police arabe (IN-01)
| Option | Description | Selected |
|--------|-------------|----------|
| Self-host via next/font local | Zéro CDN runtime, perf + confidentialité | ✓ |
| Google Fonts via next/font | Auto-hébergé au build | |
| Police système arabe | Zéro poids, rendu inégal | |

### Palette
| Option | Description | Selected |
|--------|-------------|----------|
| Bleu confiance + vert/rouge sémantiques | Vert/rouge réservés aux trades | ✓ |
| Emerald/teal | Risque chevauchement vert sémantique | |
| Tu décides | Discrétion Claude | |

**Notes :** Vert/rouge strictement sémantiques (long/short, résultats), jamais décoratifs.

---

## Page d'accueil (structure & preuve %)

### Structure
| Option | Description | Selected |
|--------|-------------|----------|
| Parcours complet | Hero + Comment ça marche + Preuve + Aperçu tarifs + Disclaimers | ✓ |
| Landing courte | Hero + Preuve + CTA minimal | |
| Tu décides | Discrétion Claude | |

### Pitch
| Option | Description | Selected |
|--------|-------------|----------|
| Bénéfice d'abord | Orienté résultat utilisateur | |
| Méthode d'abord | Orienté crédibilité/expertise | |
| Les deux (bénéfice hero + méthode section) | Combiné | ✓ |

### Affichage du % avant track record (P5)
| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder honnête + méthodo | Aucun chiffre inventé | |
| Métriques réelles factuelles | Nb analyses, marchés, R:R | |
| Masquer la section % jusqu'à P5 | Aucune mention perf | ✓ |
| Maintenir le 90% affiché | ⚠️ Non recommandé | |

**User's choice (1er passage) :** « on peut mettre des pourcentages de trade réussi par jour atteignant les 90%, on changera quand on aura le track record. »
**Intervention Claude (pushback) :** écarté — conflit frontal avec la valeur cœur (% TOUJOURS mesuré jamais inventé), VITR-03 (aucune promesse de gain), et LEGAL-01/02 (publicité trompeuse, risque juridique/réputationnel personnel, surtout MENA/crypto). Effet boomerang en P5 si le réel < 90%.
**User's choice (après pushback) :** **Masquer la section % jusqu'à P5.**

### CTA hero
| Option | Description | Selected |
|--------|-------------|----------|
| S'abonner / Voir les tarifs | Conversion directe | ✓ |
| Créer un compte gratuit | Capture lead d'abord | |
| Tu décides | Discrétion Claude | |

---

## Funnel d'abonnement

### Profondeur du funnel (paiement = P4)
| Option | Description | Selected |
|--------|-------------|----------|
| Tarifs → signup → écran 'bientôt' | Arrêt propre, sans fausse promesse | ✓ |
| Tarifs → signup seulement | Pas de suite | |
| Stub surface paiement P4 | Anticipe P4, risque code à jeter | |

### Affichage des prix
| Option | Description | Selected |
|--------|-------------|----------|
| USD + mention 'payable en USDT' | Clarifie le moyen de paiement | ✓ |
| USD uniquement | Moyen révélé plus tard | |
| USD + équivalent DZD indicatif | Taux à maintenir | |

**Notes :** Le fondateur met à jour l'offre : **9 $/mois OU 3 $/7 j (découverte, une seule fois)** — remplace `3 $/15 j` des docs. Incohérence REQUIREMENTS/ROADMAP à corriger.

### Point de bascule auth
| Option | Description | Selected |
|--------|-------------|----------|
| Tarifs publics, compte au clic 's'abonner' | Maximise visibilité offre | ✓ |
| Compte requis pour voir les tarifs | Friction, tension VITR-02 | |
| Tu décides | Discrétion Claude | |

---

## Gate juridique & disclaimers

### Placement disclaimers
| Option | Description | Selected |
|--------|-------------|----------|
| Footer global + pages dédiées | Présence transverse + détail | ✓ |
| Footer global seulement | Léger, insuffisant | |
| Modal signup + footer | Trace l'acceptation | |

### Pages légales
| Option | Description | Selected |
|--------|-------------|----------|
| Bundle complet | CGU + Risques + Confidentialité + Mentions | ✓ |
| Minimal | Risques + CGU | |
| Tu décides | Discrétion Claude | |

### Rédaction & traduction
| Option | Description | Selected |
|--------|-------------|----------|
| Juriste (source) → trad pro, placeholders | L'IA n'invente pas de texte faisant foi | ✓ |
| Claude rédige un jet, juriste valide | Risqué | |
| Modèle standard adapté | À valider juriste | |

### Mécanisme du gate LEGAL-02
| Option | Description | Selected |
|--------|-------------|----------|
| Artefact tracé + flag lu par P4 | LEGAL-REVIEW.md + flag enforcement | ✓ |
| Artefact documentaire seul | Gate humain sans verrou technique | |
| Flag technique seul | Sans document détaillé | |

---

## Claude's Discretion

- Choix exact des polices (arabe + latines), tokens couleur/typo des deux thèmes, composants shadcn à étoffer.
- Architecture des pages sous `[locale]/(marketing)`, structure des namespaces messages (`home`, `legal`).
- Forme du flag `legal_review_done` (env vs config DB) et emplacement de `LEGAL-REVIEW.md`.
- Métriques réelles factuelles optionnelles sur la home (si elle paraît creuse sans le % masqué).

## Deferred Ideas

- Affichage du % de réussite mesuré → Phase 5.
- Flux de paiement réel + adresse USDT + vérif on-chain → Phase 4.
- Équivalent prix DZD/local → non retenu (taux à maintenir).
- Métriques réelles factuelles sur la home → optionnel au planning.
- Consentement cookies / bannière RGPD-like → à évaluer plus tard.
- **Action docs :** corriger `3 $/15 j` → `3 $/7 j one-time` dans REQUIREMENTS.md + ROADMAP.md.
