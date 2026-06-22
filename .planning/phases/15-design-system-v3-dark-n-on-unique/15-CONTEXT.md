# Phase 15: Design system v3 « dark néon unique » - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

> **Provenance.** Ce CONTEXT.md consolide les décisions tranchées pendant `/gsd-ui-phase 15` (contrat `15-UI-SPEC.md`, approuvé 6/6) + la résolution du research flag SUMMARY.md. Il REMPLACE le passage par `/gsd-ultraplan-phase` prévu pour cette phase : le motif du flag (green vs volt + matrice de contraste AA sur surfaces translucides) est déjà résolu ci-dessous. Planification en local via `/gsd-plan-phase 15`.

<domain>
## Phase Boundary

Promouvoir l'identité dark néon de la landing (`.nxl[data-theme="green"]`) en **design system global et unique** — un seul thème dark, **sans option claire, sans toggle** — en migrant la **couche sémantique** des tokens, pour que toute la suite (reskin, dashboards) s'appuie sur une base figée jamais à retrofitter.

**Arête dure (ROADMAP) :** le DS doit être figé **AVANT** tout reskin, sinon double passage. Migration = **promotion sémantique** des valeurs green vers `:root`, suppression de `.dark` + du toggle, `forcedTheme="dark"`. Les **primitives (couche 1)** et les **noms shadcn (couche 3)** restent intacts. **RTL/i18n orthogonaux — non touchés.** Aucune nouvelle capacité produit ; pas de nouveaux écrans.

**Requirements :** THEME-01, THEME-02, THEME-03, THEME-04, THEME-05.

</domain>

<decisions>
## Implementation Decisions

### Thème unique figé (THEME-03) — décision produit tranchée
- **D-01:** Le thème néon unique est **GREEN** (décision utilisateur verrouillée, 2026-06-22). VOLT est écarté. Ne PAS rediscuter.
- **D-02:** Valeurs figées en `:root` (promues verbatim depuis `.nxl[data-theme="green"]` de `nexa-landing.css`) :
  - Background `#070b08` (dominant 60%), surface `#0f1611` (30%), **primary `oklch(0.84 0.18 150)`** cyber green (accent 10%), destructive `oklch(0.68 0.2 24)`.
  - Radius `0.625rem`.
- **D-03:** Migration = **promotion sémantique**, PAS copie mécanique du sélecteur `.nxl` (adresse Pitfall #1 : dé-scopage `.nxl` mécanique → débordement global des tokens). On copie les *valeurs* green dans la couche sémantique `:root`, on ne déplace pas le bloc `.nxl`.

### Gel du thème / no-FOUC (THEME-01)
- **D-04:** Dans `apps/web/src/app/[locale]/layout.tsx` : retirer `defaultTheme="light"` et `enableSystem`, poser **`forcedTheme="dark"`**. Aucun chemin n'expose plus de bascule claire.
- **D-05:** **Supprimer `ThemeToggle`** (composant + usages). Purger le namespace i18n `theme` dans `messages/{fr,en,ar}.json` en **parité stricte trilingue** (pas de clé orpheline).
- **D-06:** Le sélecteur `.dark` **reste présent** (observé par `CandleChart` ~ligne 167 pour le mapping lightweight-charts et par `sonner`), MAIS `:root` porte désormais les valeurs gelées → plus de chemin clair, plus de FOUC. Le no-FOUC est le **résultat attendu**, pas un état d'erreur.

### Tokens sémantiques & collisions Tailwind (THEME-02)
- **D-07:** Tous les composants UI partagés (boutons, cartes, badges, inputs, tables, dialogs, nav) rendent via la **couche component** (`var()` uniquement, jamais de littéral). Cibles de nettoyage identifiées (CSS bespoke / collisions à éliminer) :
  - `ring-[#2563EB]` hardcodé dans `ThemeToggle.tsx` (supprimé via D-05) **et** `LanguageSwitcher.tsx`.
  - Utilitaires palette bruts : `text-amber-700`, `text-emerald-700 dark:…`, `bg-red-500/10` dans `(admin)/*`, `affiliation/dashboard`, `TrackRecordView`.
- **D-08:** Le scan de preuve (success criterion #2) doit prouver **zéro CSS bespoke par page** et **aucune collision d'utilitaire Tailwind** (ex. `ring`/glow) sur les surfaces de fondation touchées.

### Contraste & surfaces translucides (THEME-05) — research flag résolu
- **D-09:** GREEN passe WCAG **AA+** : primary/fond **11.39:1**, texte/fond **18.93:1**, atténué/fond **6.76:1**. Un test de contraste doit verrouiller ces seuils.
- **D-10:** Sur surfaces **translucides** (overlays, cartes glow), le contraste se mesure sur la **couleur compositée** (fond + couche translucide aplatie), pas sur la valeur du token seule.

### Typographie (rappel UI-SPEC — pas une nouvelle décision)
- **D-11:** Weights UI = **2** (400 + 600), comptés sur la famille texte **Space Grotesk** uniquement. **Archivo** = famille **display indépendante** (`--font-display`), hors comptage UI ; le `--display-weight: 800` de la landing est un **faux-gras synthétique** sur la face 600 (aucun fichier 800 chargé — vérifié `apps/web/src/lib/fonts.ts`). JetBrains Mono (chiffres trading), Noto Sans Arabic (AR) = familles fonctionnelles distinctes.

### RTL (THEME-04)
- **D-12:** En arabe, mise en page miroir via **propriétés logiques uniquement** (ps/pe/ms/me/text-start), inchangée par le gel du thème. Orthogonal — ne pas modifier la logique RTL existante.

### Claude's Discretion
- Découpage exact en plans/tâches de la migration (un seul plan « promotion + freeze » vs plans séparés freeze / nettoyage collisions / test contraste).
- Forme du test de contraste (script Node vs test Vitest sur table de valeurs) tant qu'il prouve les seuils D-09 sur surfaces opaques ET compositées D-10.
- Stratégie de scan THEME-02 (grep CI vs test) tant qu'elle prouve zéro bespoke / zéro collision.

</decisions>

<specifics>
## Specific Ideas

- Design system : shadcn preset **`radix-nova`** déjà initialisé (`apps/web/components.json` — baseColor neutral, cssVariables, lucide, rsc). 20 composants `ui/` déjà vendored localement, aucun registre tiers (`registries: {}`).
- Caractère visé : premium / sobre / « vétéran », cohérent avec le brand token NEXA (`--nexa-green-500`, hue 155). C'est ce qui a fait écarter VOLT (acid lime « degen »).
- Migration minimale : l'app globale (`.dark` dans `globals.css`) est **déjà** en green → la promotion vers `:root` est un transfert de valeurs, pas une re-décision de palette.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contrat de design de CETTE phase (PRIMAIRE)
- `.planning/phases/15-design-system-v3-dark-n-on-unique/15-UI-SPEC.md` — contrat visuel/interaction approuvé (6/6) : tokens GREEN figés, 60/30/10, liste accent reserved-for, budget typo, registry safety. **Source de vérité du design pour cette phase.**

### Périmètre & exigences
- `.planning/ROADMAP.md` (section « Phase 15 ») — Goal, 5 Success Criteria, requirement IDs, Notes (arête dure DS-avant-reskin, Pitfall #1).
- `.planning/REQUIREMENTS.md` — libellés exacts THEME-01..05.
- `.planning/research/SUMMARY.md` §Research Flags — flag d'origine (green vs volt + matrice contraste AA translucide) **résolu** par D-01/D-09/D-10.
- `.planning/PROJECT.md` — contraintes transverses (trilingue MENA, anti-features dont l'univers « volt » écarté).

### Fondation design verrouillée (Phases 10-11 — NE PAS rediscuter)
- `.planning/phases/10-fondation-design-system-nexa/10-CONTEXT.md` — décisions design figées (couches de tokens, namespace `--signal-*` distinct de `--primary`).
- `.planning/phases/11-composants-nexa-reskin-transversal-rebranding/11-CONTEXT.md` — patterns reskin, token flip, RTL, % mesuré.
- `apps/web/src/styles/globals.css` — **source de vérité des tokens** (3 couches : primitive `--nexa-*` → sémantique `:root`/`.dark` → component `@theme inline`). Cible de la promotion `:root`.
- `apps/web/src/styles/nexa-landing.css` — bloc `.nxl[data-theme="green"]` : **valeurs source** à promouvoir.
- `apps/web/src/lib/fonts.ts` — polices self-hostées + CSS vars (preuve weights 400/600, pas de 800).
- `apps/web/src/app/[locale]/layout.tsx` — `ThemeProvider`/`forcedTheme` à modifier.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- shadcn `radix-nova` initialisé, 20 composants `ui/` vendored — base à brancher sur les tokens promus, **aucun nouveau bloc à ajouter** cette phase.
- `.dark` + `:root` existants dans `globals.css` (couche sémantique) — `.dark` déjà en green, donc la promotion vers `:root` est un transfert direct.

### Established Patterns
- **Token flip** : seule la couche sémantique bascule ; les composants référencent la couche component uniquement (jamais de littéral) — Phase 10.
- **RTL** : un seul `<html lang dir>` dans `[locale]/layout.tsx`, propriétés logiques (DESIGN-04) — orthogonal au gel du thème.
- **i18n** : `messages/{fr,en,ar}.json` + next-intl (`localePrefix:'always'`) — purge du namespace `theme` en parité stricte (D-05).

### Integration Points
- `apps/web/src/app/[locale]/layout.tsx` — `ThemeProvider` : `forcedTheme="dark"`, retrait `defaultTheme`/`enableSystem` (D-04).
- `apps/web/src/components/.../ThemeToggle.tsx` — **à supprimer** (composant + import header).
- `apps/web/src/components/.../LanguageSwitcher.tsx` — retirer `ring-[#2563EB]` hardcodé → token focus.
- `CandleChart.tsx` (~ligne 167) + `sonner` — observent `.dark` ; le sélecteur reste présent (D-06), mapping lightweight-charts inchangé.
- `(admin)/*`, `affiliation/dashboard`, `TrackRecordView` — utilitaires palette bruts à tokeniser (D-07).

</code_context>

<deferred>
## Deferred Ideas

None — la phase reste strictement dans le périmètre fondation (gel + promotion sémantique + nettoyage collisions + preuves contraste/scan). Le **reskin transversal** des écrans qui s'appuie sur cette fondation reste géré par les phases reskin v3 en aval (non dans le scope Phase 15).

</deferred>

---

*Phase: 15-design-system-v3-dark-n-on-unique*
*Context gathered: 2026-06-22 (consolidé depuis ui-phase + research flag ; ultraplan court-circuité par décision utilisateur)*
