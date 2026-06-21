# Phase 10: Fondation design system NEXA - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Poser le **socle tokenisé** du design system NEXA — couleurs OKLCH en couches, polices self-hostées, thèmes — sur lequel le reskin transversal (Phase 11) s'appuiera. No-flash + RTL sont posés **en fondation, jamais à retrofitter**.

**Requirements verrouillés (ROADMAP) :** DESIGN-01 (tokens OKLCH en couches primitive→semantic→component, palette NEXA), DESIGN-02 (5 polices self-hostées en CSS vars), DESIGN-03 (thème clair/sombre sans flash, RTL-safe), DESIGN-04 (RTL arabe préservé, propriétés logiques uniquement).

**Dans le périmètre :** `globals.css` (architecture des tokens OKLCH), `lib/fonts.ts` (5 familles), self-host des `.woff2`, garantie no-flash (réutilise next-themes), correction RTL des surfaces touchées par la fondation.

**Hors périmètre (→ Phase 11) :** bibliothèque de composants NEXA, reskin de chaque route group, rebranding MERA→NEXA (mark/wordmark/favicon/OG), hero animé. Phase 10 pose les **valeurs et le plumbing**, pas les composants ni le layout.

</domain>

<decisions>
## Implementation Decisions

### Polices (DESIGN-02)
- **D-01 — Police arabe : REMPLACEMENT.** Noto Sans Arabic **remplace** IBM Plex Sans Arabic. Une seule famille arabe self-hostée via `next/font/local`, exposée en `--font-arabic`. Retirer les `.woff2` IBM Plex actuels (`src/fonts/IBMPlexSansArabic-*.woff2`) une fois la migration faite. Rationale : cohérence visuelle NEXA, moins de poids, un seul token arabe à maintenir.
- **D-02 — Mapping famille→rôle (4 latines) :**
  - **Archivo** → display / titres / wordmark (H1–H2, marque).
  - **Space Grotesk** → corps / UI (texte courant, labels, boutons).
  - **JetBrains Mono** → chiffres / données tabulaires (prix, SL/TP, R:R, score /100) — alignement mono pour les valeurs numériques du trading.
  - **Chakra Petch** → accents techniques (badges, labels cyber, stats).
  - **Noto Sans Arabic** → script arabe (cf. D-01).
- **D-03 — Inter retiré.** Les 5 familles NEXA couvrent latin + arabe ; Inter (`next/font/google`) est supprimé du setup. Chaque famille exposée en CSS var, self-hostée, zéro appel CDN au runtime (esprit DESIGN-02/03 conservé).

### Couleurs & tokens (DESIGN-01)
- **D-04 — Bascule couleur DÈS la Phase 10.** Phase 10 pose les **primitives OKLCH NEXA** (cyber green `#03d87f`, royal purple `#63279b`) **ET** remappe le sémantique (`--primary`, `--accent`, `--ring`…) sur vert/violet — sortie du bleu institutionnel `#1E5FBF` v2.0. Justifié par le **critère de succès #2** (« les textes et accents rendent déjà les couleurs NEXA »). Phase 11 = structure/composants/layout, **pas** un nouveau changement de couleur.
- **D-05 — Vert marque ≠ vert signal trading (tokens distincts).** Le cyber green NEXA (brand / CTA / accent) et les verts/rouges de **signal trading** (bullish/bearish, win/loss) sont des **tokens séparés**, à teintes et usages distincts (brand green vif vs bullish green plus sobre). Le vert-marque ne sert **jamais** d'encodage directionnel. Lève l'ambiguïté avec la convention v2.0 (D-04 v2.0 : « vert/rouge réservés au trading »). Cette séparation doit être documentée dans la couche de tokens pour le reskin Phase 11.

### Thème (DESIGN-03)
- **D-06 — Mono-marque.** « Thème clair/sombre × marque » (critère #1) = NEXA **mono-marque** : le thème est **light/dark uniquement**. `next-themes` (class strategy + script pré-paint no-flash) est **conservé tel quel**, aucune dimension « marque » supplémentaire à construire, pas d'extension du script no-flash. Décision orientée simplicité/robustesse (produit mono-marque NEXA).

### Claude's Discretion
- Valeurs OKLCH exactes des primitives + **échelle tonale** (granularité 50–950 vs stops ciblés), conversion HEX→OKLCH des couleurs de marque.
- Statut de `--destructive` (resté neutre/gris en v2.0 par D-04 ; à reconsidérer maintenant que les signaux sont des tokens dédiés — cf. D-05).
- Weights à self-host par famille (arbitrage poids de bundle vs hiérarchie typographique).
- Découpage concret des couches primitive→semantic→component dans `@theme` / `@theme inline` / `:root` / `.dark` (Tailwind v4 CSS-first).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spécification de phase & requirements
- `.planning/ROADMAP.md` §« Phase 10 : Fondation design system NEXA » — goal, 4 success criteria, dépendances, note « Noto Sans Arabic remplace ou coexiste » (tranchée ici : remplace).
- `.planning/REQUIREMENTS.md` (DESIGN-01..04, lignes 19–22) — définitions + valeurs de palette NEXA (cyber green `#03d87f`, royal purple `#63279b`).
- `CLAUDE.md` (racine projet) — stack verrouillée : Tailwind v4 CSS-first (aucun `tailwind.config`), Next.js 15, `next/font/local`. Aucune nouvelle dépendance runtime.

### Code existant à faire évoluer (fondation v2.0)
- `apps/web/src/styles/globals.css` — structure de tokens actuelle à migrer : HEX→OKLCH en couches ; `@theme` (fonts), `@theme inline` (mapping `--color-*` shadcn), `:root`/`.dark` (valeurs), `@custom-variant dark`, sélecteur `:lang(ar)`.
- `apps/web/src/lib/fonts.ts` — setup polices actuel (Inter + IBM Plex Arabic) à remplacer par les 5 familles NEXA self-hostées.
- `apps/web/src/components/ThemeProvider.tsx` + `apps/web/src/components/ThemeToggle.tsx` — wrapper next-themes (no-flash pré-paint) à **conserver** (D-06).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **next-themes (ThemeProvider/ThemeToggle)** : no-flash SSR déjà résolu (script pré-paint + `suppressHydrationWarning` sur `<html>`). Réutilisé tel quel pour DESIGN-03 — ne pas reconstruire.
- **Plomberie de tokens `globals.css`** : le bloc `@theme inline` mappe déjà les tokens shadcn (`--color-primary`, `--color-foreground`…) sur des variables de marque (`--primary`, `--foreground`). La bascule NEXA = changer les valeurs sous-jacentes + ajouter la couche primitive, sans toucher les noms sémantiques consommés par les composants.
- **Pattern self-host `next/font`** : `next/font/local` (arabe) + build-time self-host. Étendre aux 5 familles, supprimer la voie `next/font/google` (Inter).

### Established Patterns
- **Tailwind v4 CSS-first** : tout vit dans `globals.css` (`@theme`/`@theme inline`/`:root`/`.dark`), **aucun `tailwind.config`**. `@custom-variant dark (&:where(.dark, .dark *))` pilote la bascule.
- **Police arabe via `:lang(ar)`** : `font-family: var(--font-arabic); line-height: 1.6`. Le RTL vient de `<html dir="rtl">` (`[locale]/layout`) + propriétés logiques — pas de la police.
- **DESIGN-04 (RTL props logiques)** : convention déjà en place (margin/padding/inset logiques). La fondation doit rester en propriétés logiques uniquement.

### Integration Points
- `apps/web/src/app/[locale]/layout.tsx` (RSC) : pose `<html dir>` + `suppressHydrationWarning`, monte `ThemeProvider`, applique les variables de police au `<body>`. C'est le point d'injection des `--font-*` des 5 familles.
- `body { font-family: var(--font-latin), system-ui, sans-serif }` dans `@layer base` : à repointer sur la nouvelle police de corps (Space Grotesk).

</code_context>

<specifics>
## Specific Ideas

- Identité NEXA « cyber/trading » : cyber green `#03d87f` + royal purple `#63279b`. Typographie à connotation technique (Chakra Petch en accents, JetBrains Mono pour les valeurs chiffrées du plan de trade).
- Les valeurs numériques de trading (entrée, SL, TP, R:R, score /100) doivent rendre en mono (JetBrains Mono) pour l'alignement et la lisibilité tabulaire.

</specifics>

<deferred>
## Deferred Ideas

- **Infra de thème multi-marque / variantes de skin** — écartée (D-06, mono-marque). Si un besoin multi-skin émerge plus tard, ré-ouvrir comme phase dédiée (axe marque séparé + extension du script no-flash).
- **Composants NEXA, reskin des surfaces, rebranding MERA→NEXA, hero animé** — hors fondation, déjà cadrés en **Phase 11**.

*None hors de ces reports — la discussion est restée dans le périmètre fondation.*

</deferred>

---

*Phase: 10-Fondation design system NEXA*
*Context gathered: 2026-06-21*
