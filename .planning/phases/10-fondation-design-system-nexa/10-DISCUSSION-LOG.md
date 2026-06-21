# Phase 10: Fondation design system NEXA - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 10-Fondation design system NEXA
**Areas discussed:** Police arabe, Rôles des 5 polices, Périmètre couleur, Vert marque vs trading, Axe marque du thème

---

## Police arabe

| Option | Description | Selected |
|--------|-------------|----------|
| Remplacer (reco) | Une seule famille arabe (Noto Sans Arabic), self-hostée. Cohérence NEXA, moins de poids, un seul `--font-arabic`. Retrait des `.woff2` IBM Plex. | ✓ |
| Coexister | Garder IBM Plex Sans Arabic ET ajouter Noto Sans Arabic. Plus de poids, 2 familles arabes à gérer. | |
| You decide | Trancher selon cohérence + poids de chargement. | |

**User's choice:** Remplacer
**Notes:** Noto Sans Arabic devient l'unique police arabe ; IBM Plex Sans Arabic retiré après migration.

---

## Rôles des 5 polices

| Option | Description | Selected |
|--------|-------------|----------|
| Archivo display (reco) | Archivo = titres/display & wordmark · Space Grotesk = corps/UI · JetBrains Mono = chiffres/données · Chakra Petch = accents techniques. Inter retiré. | ✓ |
| Chakra display | Chakra Petch = titres/display · Archivo = corps/UI · Space Grotesk = secondaire · JetBrains Mono = données. Inter retiré. | |
| You decide | Mapping selon identité cyber/trading + statut Inter. | |

**User's choice:** Archivo display
**Notes:** Inter supprimé du setup ; les 5 familles NEXA couvrent latin + arabe.

---

## Périmètre couleur

| Option | Description | Selected |
|--------|-------------|----------|
| Basculer maintenant (reco) | Phase 10 pose primitives OKLCH NEXA ET remappe le sémantique (primary/accent/ring) sur vert/violet. Conforme au critère #2. Phase 11 = structure, pas couleur. | ✓ |
| Primitives seules | Phase 10 = primitives OKLCH seules ; sémantique reste bleu jusqu'au reskin Phase 11. | |
| You decide | Trancher selon dépendance fondation→reskin + critère #2. | |

**User's choice:** Basculer maintenant
**Notes:** Sortie du bleu `#1E5FBF` v2.0 dès la Phase 10.

---

## Vert marque vs trading

| Option | Description | Selected |
|--------|-------------|----------|
| Tokens distincts (reco) | Cyber green NEXA (brand/CTA/accent) et verts/rouges de signal trading = tokens séparés, teintes/usages distincts, documenté. Vert-marque jamais un encodage directionnel. | ✓ |
| Vert = marque, signaux réencodés | Le vert appartient à la marque ; signaux trading basculent sur d'autres encodages (flèches, libellés, bleu/orange). | |
| You decide | Définir la séparation vert-marque vs vert-signal dans l'archi des tokens. | |

**User's choice:** Tokens distincts
**Notes:** Lève l'ambiguïté avec la convention v2.0 (D-04 v2.0 : vert/rouge réservés au trading). Séparation à documenter dans la couche de tokens.

---

## Axe marque du thème

| Option | Description | Selected |
|--------|-------------|----------|
| Mono-marque (reco) | NEXA seul : thème = light/dark uniquement, next-themes conservé tel quel, no-flash déjà résolu. « × marque » = wording. | ✓ |
| Infra multi-marque | Axe marque séparé (data-attribute) en plus de light/dark. Complexifie tokens + script no-flash. | |
| You decide | Trancher selon besoins réels vs complexité. | |

**User's choice:** Mono-marque
**Notes:** Aucune dimension marque supplémentaire ; next-themes inchangé.

---

## Claude's Discretion

- Valeurs OKLCH exactes + échelle tonale (granularité 50–950 vs stops ciblés).
- Statut de `--destructive` (neutre v2.0 → à reconsidérer maintenant que les signaux sont des tokens dédiés).
- Weights self-hostés par famille.
- Découpage concret des couches primitive→semantic→component dans Tailwind v4 CSS-first.

## Deferred Ideas

- Infra de thème multi-marque / variantes de skin — écartée (mono-marque) ; ré-ouvrir comme phase dédiée si besoin.
- Composants NEXA, reskin des surfaces, rebranding MERA→NEXA, hero animé — cadrés en Phase 11.
