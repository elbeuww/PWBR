# Phase 11: Composants NEXA, reskin transversal & rebranding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 11-composants-nexa-reskin-transversal-rebranding
**Areas discussed:** Hero animé (UI-02), Identité visuelle/logo (BRAND-03), Score & confiance (DESIGN-05), Baseline & voix de marque (BRAND-02) + reskin admin (UI-06)

---

## Hero animé (UI-02)

### Cartes flottantes
| Option | Description | Selected |
|--------|-------------|----------|
| Setups anonymisés éducatifs | Instrument + direction + score /100 + risque, zéro % | ✓ |
| Tickers de marché | Symboles + prix défilants, décoratif | |
| Concepts pédagogiques | Piliers méthodo (technique/fondamental/news/R:R) | |

### Globe
| Option | Description | Selected |
|--------|-------------|----------|
| Filaire (wireframe) rotatif | Maillage green/purple, rotation CSS | ✓ |
| Pointillé (dots) | Points lumineux = sessions de marché | |
| Arc/grille de données | Pas de globe littéral | |

### Data-rain
| Option | Description | Selected |
|--------|-------------|----------|
| Subtil, fond lointain | Faible densité/opacité | ✓ |
| Marqué, effet terminal | Plus dense/visible | |
| Aucun data-rain | Globe + cartes + tilt | |

### Ambiance
| Option | Description | Selected |
|--------|-------------|----------|
| Fond sombre fixe (ink) | Cyber même en thème clair | ✓ |
| Suit le thème | Clair en light, sombre en dark | |

**Notes :** Fallback `prefers-reduced-motion` = composition 100% statique. Contrainte projet : CSS + vanilla TS uniquement (GSAP/three.js/WebGL interdits).

---

## Identité visuelle / logo (BRAND-03)

### Mark
| Option | Description | Selected |
|--------|-------------|----------|
| Emblème hexagonal « N » | Hexagone = structure/réseau, N intégré | ✓ |
| Monogramme N pur | Lettre N seule, minimal | |
| Marque abstraite | Symbole géométrique sans N | |

### Wordmark
| Option | Description | Selected |
|--------|-------------|----------|
| Archivo bold, tracking large | Display self-hostée, majuscules | ✓ |
| Archivo + lettre accentuée | X/A en green/purple | |
| Monospace (JetBrains) | Vibe terminal | |

### Couleur mark
| Option | Description | Selected |
|--------|-------------|----------|
| Dégradé green→purple | Gradient des 2 couleurs de marque | ✓ |
| Bicolore à plat | Zones nettes, sans gradient | |
| Monochrome adaptatif | Une couleur selon thème | |

### Favicon
| Option | Description | Selected |
|--------|-------------|----------|
| Mark seul (hexagone N) | Optimisé 16-32px | ✓ |
| Lettre N seule | Sans hexagone | |

**Notes :** Production = SVG redessiné aux hex exacts #03d87f / #63279b, variantes clair/sombre + OG. Concepts jpg = référence visuelle seulement (palette dérivée fausse).

---

## Score & confiance (DESIGN-05)

### Visualisation du score
| Option | Description | Selected |
|--------|-------------|----------|
| Anneau radial (ring) | Cercle de progression, chiffre centré | ✓ |
| Jauge demi-cercle | Compteur type cadran | |
| Barre + chiffre | Barre horizontale | |

### Couleur du score
| Option | Description | Selected |
|--------|-------------|----------|
| Couleur = niveau de RISQUE | neutre→amber→bear, respecte D-05 | ✓ |
| Monochrome + label risque | Score violet, risque en texte | |
| Couleur = valeur du score | Dégradé gris→green (écarté : suggère gain) | |

### Stats de confiance
| Option | Description | Selected |
|--------|-------------|----------|
| Win-rate mesuré + N + provenance | via applyThreshold, jamais % nu | ✓ |
| Échantillon + confiance texte | Sans % | |
| Tu décides | — | |

### Marquee
| Option | Description | Selected |
|--------|-------------|----------|
| Instruments + sessions | Marchés suivis + Londres/NY/Tokyo | ✓ |
| Principes méthodo | Mots-clés éducatifs | |
| Mix instruments + disclaimer | Instruments + rappel intercalé | |

**Notes :** Cohérent avec la source unique applyThreshold (phases 13/14). Brand green hue 155 ≠ signal de direction (namespace --signal-* séparé).

---

## Baseline, voix de marque (BRAND-02) & admin (UI-06)

### Baseline
| Option | Description | Selected |
|--------|-------------|----------|
| Descripteur NEXA | « Nouvelle Ère · Alliance d'Échange » | ✓ |
| Tagline éducative claire | « L'analyse de trading, expliquée. » | |
| Les deux | Descripteur + tagline | |

### Placement
| Option | Description | Selected |
|--------|-------------|----------|
| Header + hero | Sous le wordmark + hero | ✓ |
| Hero + footer | Header épuré | |
| Hero uniquement | — | |

### Ton
| Option | Description | Selected |
|--------|-------------|----------|
| Sobre & crédible (vétéran) | Expertise calme, zéro hype | ✓ |
| Énergique & moderne | Dynamique 'nouvelle ère' | |
| Chaleureux & accessible | Très vulgarisé | |

### Reskin admin
| Option | Description | Selected |
|--------|-------------|----------|
| Sobre (tokens + composants) | Sans hero/anim, conforme roadmap | ✓ |
| Aligné sur le public | Aussi soigné | |
| Minimal (tokens seuls) | Structure inchangée | |

**Notes :** Baseline déclinée FR/EN/AR sans promesse de gain ; rédaction sans slop.

---

## Claude's Discretion

- Fallback reduced-motion exact du hero (composition statique).
- Nav header/footer, états vides/chargement (skeletons), micro-interactions — dans le périmètre reskin.
- Mapping technique couleurs NEXA → CandleChart (getComputedStyle ou table tokens→hex, via API JS lwc).
- « Étendre primitif shadcn » vs « créer composant NEXA » par élément DESIGN-05.
- Traductions FR/EN/AR exactes de la baseline.

## Deferred Ideas

None — discussion restée dans le périmètre. ⚠ Divergence ROADMAP signalée : « 6 spec files E2E » annoncés mais 5 présents dans `apps/web/e2e/`.
