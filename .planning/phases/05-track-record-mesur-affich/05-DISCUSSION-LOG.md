# Phase 5: Track record mesuré & % affiché - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 5-Track record mesuré & % affiché
**Areas discussed:** Définition d'un « hit », « Pattern » du win rate, Seuil & métriques affichées, Méthode & transparence

---

## Zone 1 — Définition d'un « hit »

### Résultat d'un trade (multi-TP)
| Option | Description | Selected |
|--------|-------------|----------|
| Binaire TP1-avant-SL + R au TP1 | Win = TP1 avant SL ; realized_r jusqu'à TP1. Win rate public clair. | ✓ |
| Simulation TP partiels + break-even | alloc_pct + SL→BE après TP1 ; realized_r net. Plus fidèle, plus complexe. | |
| Les deux (binaire + R pondéré) | Win rate simple public + R/expectancy en profondeur. Double coût. | |

### Trade « flat » (ni TP ni SL à valid_until)
| Option | Description | Selected |
|--------|-------------|----------|
| Selon R réalisé à la clôture | Valorisé au close de valid_until (gain/perte partiel). Réaliste. | ✓ |
| Neutre / exclu du win rate | Exclu du numérateur, compté dans N. | |
| Loss | N'a pas atteint l'objectif = échec. | |

### Granularité de candle
| Option | Description | Selected |
|--------|-------------|----------|
| H1 pour tous les styles | TF la plus fine en base, exact ~99 %. | ✓ |
| TF d'analyse du setup | H1 day / H4 swing. Plus grossier en swing. | |

### Cas ambigu (TP+SL même bougie)
| Option | Description | Selected |
|--------|-------------|----------|
| Conservateur : SL d'abord | Suppose le pire. | |
| Optimiste : TP d'abord | Suppose le meilleur. | (choix initial, raffiné) |
| Indéterminé : exclu + loggué | 3e catégorie. | |
| **Règle de distance (le plus proche d'abord)** | Synthèse : niveau le plus proche de l'entrée touché en premier. | ✓ |

**User's choice :** Règle « le niveau le plus proche de l'entrée est touché en premier ».
**Notes :** Le fondateur a d'abord choisi « optimiste : TP d'abord », justifié par un vrai fait métier : le multi-TP n'est pas systématique, il sert à sécuriser quand l'objectif est loin → TP1 proche de l'entrée → réalistement touché avant le SL. J'ai signalé le conflit avec la valeur cœur « jamais gonflé » et proposé la règle de distance, qui encode son raisonnement (multi-TP = gain) tout en restant défendable (SL plus proche → perte). Validé. Long échange pédagogique sur « pourquoi des bougies » (replay d'historique = relecture des candles stockées, pas de temps réel rétroactif) et sur l'idée du fondateur de découper en 5 min (juste sur le principe mais données M5 absentes en base → reporté).

---

## Zone 2 — « Pattern » du win rate

### Catégories de découpage
| Option | Description | Selected |
|--------|-------------|----------|
| Par actif / classe d'actif | instrument_id / classe. | ✓ |
| Par style (day/swing) | colonne style. | ✓ |
| Par tranche de score | opportunity_score (80-100 vs 60-80). | ✓ |
| Par niveau de risque | risk_level. | ✓ |

### Réel agrégé vs par pattern
| Option | Description | Selected |
|--------|-------------|----------|
| Réel = tous publiés ; catégories = même découpé | Un seul pipeline, honnête. | ✓ |
| Réel = publiés ; backtest = historique élargi | 2 pipelines, plus riche. | |
| Tu décides | — | |

### Où afficher le détail par catégorie
| Option | Description | Selected |
|--------|-------------|----------|
| Vitrine = global ; membre = détail | Exclusivité abonné. | |
| Tout sur vitrine ET membre | Public partout. | |
| Par catégorie = interne d'abord | Démarrage minimal. | |

**User's choice :** Détail par catégorie **sur la vitrine** (public).
**Notes :** Précision structurante du fondateur : pas de palier gratuit, accès payant uniquement, un non-payant n'a pas de compte ; « je ne stocke pas de données dont je n'ai pas besoin ». Donc la seule surface publique pertinente = la vitrine, et le détail y va. (Le premier rendu en 3 questions groupées a été rejeté → questions reposées une par une.)

---

## Zone 3 — Seuil & métriques affichées

### Seuil N minimal
| Option | Description | Selected |
|--------|-------------|----------|
| 30 trades | Seuil statistique classique. | ✓ |
| 20 trades | Affiche plus tôt, moins robuste. | |
| 50 trades | Plus prudent, beaucoup de « insuffisant ». | |

### Métriques affichées
| Option | Description | Selected |
|--------|-------------|----------|
| Win rate + R moyen | Honnête, parlant. | |
| Win rate seul | Simple mais incomplet. | |
| Win rate + R moyen + expectancy | Le plus complet/pro. | ✓ |

### Période
| Option | Description | Selected |
|--------|-------------|----------|
| Depuis le début (all-time) | Simple, échantillon grossit. | |
| All-time + fenêtre glissante 90 j | Historique + forme récente. | ✓ |
| Tu décides | — | |

**User's choice :** 30 trades ; win rate + R moyen + expectancy ; all-time + 90 j.
**Notes :** Seuil de 30 vaut pour le global ET chaque catégorie.

---

## Zone 4 — Méthode & transparence

### Profondeur d'exposition de la méthode
| Option | Description | Selected |
|--------|-------------|----------|
| Tooltip court + page méthodologie dédiée | Transparence max, argument anti-arnaque. | ✓ |
| Tooltip court seulement | Plus léger. | |
| Page méthodologie seulement | Demande un clic. | |

**User's choice :** Tooltip court + page méthodologie dédiée.
**Notes :** N (taille d'échantillon) toujours affiché. Comme tout vient de trades réels publiés (pas de backtest synthétique), tout est « mesuré sur trades réels » — renforce l'anti-arnaque.

---

## Claude's Discretion

- Cadence/déclenchement du job `outcome-tracker` (idempotent + tracé `job_runs`).
- Schéma exact `prediction_outcomes` / `pattern_stats` (table vs vue), RLS lecture publique des agrégats.
- Format d'affichage RTL/arabe des nombres/% (`<bdi>`/`Intl`, hérité P1).

## Deferred Ideas

- Ingestion bougies M5 (5 min) pour replay first-touch ultra-précis — reporté (nouveau job + volume + backfill).
- Backtest moteur sur historique non publié — reporté (MVP = trades réels publiés).
- Simulation TP partiels complète (alloc_pct + break-even, equity curve) — reporté (MVP = binaire TP1-avant-SL).
- Publication Telegram du win rate — Phase 6 (TG-02).
