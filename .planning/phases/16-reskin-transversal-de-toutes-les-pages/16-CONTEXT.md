# Phase 16: Reskin transversal de toutes les pages - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Repeindre **toutes les surfaces existantes** de la plateforme (vitrine accueil/tarifs/méthodologie/légal, auth login/signup, compte/abonnement, espace membre liste signaux + détail trade + chart, paiement/funnel, Académie index/article/cours-leçon, back-office `/admin`) sur le **DS v3 dark néon figé** (Phase 15), **d'un seul passage**.

**On clarifie le *comment* du reskin ; aucune nouvelle capacité produit.** Les dashboards complets (utilisateur/superadmin) sont hors scope → Phases 19-20. Le reskin = **swap de tokens + primitifs du DS v3**, jamais migration du fetch RLS vers le client.

**Garde-fous transverses préservés intégralement :** gating RLS (jamais service_role côté pages, isolation anti-IDOR), i18n trilingue AR-RTL/EN/FR (propriétés logiques), `<Disclaimer />` sur chaque page concernée, no-perf-claims (% toujours mesuré + N + provenance), no-mera-brand, `data-testid`/rôles ARIA des specs E2E (Phase 21), no-FOUC (`forcedTheme="dark"`).

**Requirements :** RESKIN-01, RESKIN-02, RESKIN-03, RESKIN-04, RESKIN-05, RESKIN-06.

</domain>

<decisions>
## Implementation Decisions

### Landing — réconciliation volt→green (RESKIN-01)
- **D-01:** La landing (`NexaLanding.tsx`) passe en **green-only** : `data-theme="green"` en dur, **suppression du toggle Green/Volt** (`.nxl-theme-toggle`, lignes ~84-87). Cohérent avec la décision Phase 15 D-01 (VOLT écarté, ne PAS rediscuter) et le retrait du `ThemeToggle` global. Une seule identité couleur partout.
- **D-02:** Conséquence : le `data-theme="volt"` par défaut (ligne 58) et toute la logique de bascule de thème dans `NexaLandingEffects.tsx` (lecture/persistance du thème, listeners des boutons toggle ~lignes 29-36) deviennent des **orphelins à nettoyer**. Le bloc CSS `.nxl[data-theme="volt"]` du fichier de styles landing est également résiduel (à retirer ou neutraliser). Découpage exact = discrétion implémentation, mais le `data-theme="green"` doit rester la **seule** branche vivante.
- **D-03:** Les valeurs `.nxl[data-theme="green"]` restent la source visuelle de la landing et demeurent **cohérentes** avec `:root` (promues verbatim en Phase 15, D-02). On ne re-décide pas la palette ; on supprime juste la branche volt.

### Intensité néon par tier (RESKIN-01..06)
- **D-04:** **Modèle à 3 tiers d'intensité néon :**
  - **Tier 1 — Vitrine (plein néon)** : accueil/landing, tarifs, méthodologie, légal. Glow, gradients, aura/halo, data-rain — traitement vitrine riche.
  - **Tier 2 — App (intermédiaire)** : espace membre (liste signaux + détail + chart), compte/abonnement, auth (login/signup), paiement/funnel, Académie. Accents néon + **glow discret sur cartes/CTA**, **pas d'aura ni de data-rain lourds**. **Lisibilité d'abord** sur les surfaces denses.
  - **Tier 3 — Admin (sobre)** : `/admin`. Tokens DS v3 + composants + bordures néon minimales, **zéro effet** (hero/animations). Conforme à Phase 11 D-18 (ne PAS rediscuter).
- **D-05:** Les surfaces denses en données (liste signaux, détail trade, tables admin) privilégient la lisibilité : pas d'effet néon lourd qui parasite la lecture.

### Effets néon — primitives transverses vs landing-only (RESKIN-01..06, THEME-02)
- **D-06:** Deviennent des **primitives réutilisables tokenisées** (dispo sur le Tier 2) :
  - **Glow cartes/CTA** : halo néon discret sur cartes, boutons primaires, états focus.
  - **Data-rain** : promu en **primitive légère**, mais appliqué **uniquement** en ambient très subtil sur **surfaces calmes** (auth, états vides, en-tête vue d'ensemble membre). **JAMAIS** sur listes signaux / tables / détail trade (réconcilie avec D-04/D-05).
- **D-07:** Restent **landing-only** : **titres en gradient green** (pas de gradient sur les titres d'app — titres app = tokens plats) et **aura/halo de section** (réservé aux en-têtes de vitrine).
- **D-08:** Toute primitive référence la **couche component** des tokens (`var()` only, jamais de littéral couleur), sans CSS bespoke par page (THEME-02 préservé).

### Critère de complétude « page reskinée DS v3 » (definition of done)
- **D-09:** Une page est « reskinée DS v3 » quand, **par surface**, les 4 conditions sont vraies :
  1. **Zéro CSS bespoke / zéro littéral couleur** — tokens v3 uniquement (couche component).
  2. **Accent du tier appliqué** — glow/gradient/effets selon le tier de la surface (D-04) ; une page seulement tokenée mais fade ne suffit PAS.
  3. **Scans guard verts** — no-perf-claims + no-mera-brand.
  4. **Garde-fous préservés** — gating RLS, RTL (propriétés logiques), `<Disclaimer />`, `data-testid`/ARIA inchangés.
- **D-10:** Ce critère est la grille du verifier (combinaison mécanique + preuve d'application du tier + garde-fous), pas une revue visuelle subjective.

### Carry-forward verrouillé (NE PAS rediscuter — Phases 11 & 15)
- **D-11:** **CandleChart** recoloré via l'**API JS lightweight-charts** (lwc ne lit pas les CSS vars — Anti-Pattern 5), jamais en CSS bespoke. Couleurs bougie up/down via le namespace **`--signal-bullish`/`--signal-bearish`**, **distinct de `--primary`** (green ≠ signal de direction). Score = anneau, couleur = **risque** (jamais vert=gagnant).
- **D-12:** Aucun reskin ne migre le **fetch RLS vers le client** (Anti-Pattern 3) ni n'introduit service_role côté pages. Isolation anti-IDOR inchangée.
- **D-13:** Tout rendu de % passe par `applyThreshold` (`@app/core`) avec N + provenance ; aucun % nu, aucune promesse de gain (VITR-03).
- **D-14:** `prefers-reduced-motion` ⇒ composition statique (pas d'animation, composition visuelle préservée) — contrainte Phase 11 D-05 appliquée à toutes les primitives néon ajoutées.

### Claude's Discretion
- Découpage exact en plans/vagues (probablement par route group / tier : vitrine // app // Académie // admin, fichiers disjoints) et ordre des surfaces.
- Forme du test/scan prouvant le critère D-09 (extension des scans existants no-perf-claims/no-mera-brand + scan bespoke/littéral type THEME-02, vs nouveau test).
- Mapping technique exact des couleurs néon dans le CandleChart (getComputedStyle vs table tokens→hex) tant que via l'API lwc.
- Implémentation concrète des primitives glow/data-rain (classe utilitaire tokenée, composant, ou variante) tant que D-06/D-07/D-08 respectés.
- États vides / skeletons / micro-interactions des surfaces reskinées, dans le périmètre, libres tant que tier + garde-fous respectés.
- Détail du nettoyage des orphelins volt (D-02) tant que green reste la seule branche vivante.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Périmètre & exigences de la phase
- `.planning/ROADMAP.md` (section « Phase 16 ») — Goal, 4 Success Criteria, requirement IDs, Notes (anti-patterns reskin, CandleChart via lwc, conservation data-testid/ARIA, « patterns établis — recherche légère »).
- `.planning/REQUIREMENTS.md` — libellés exacts RESKIN-01..06 + garde-fous transverses (VITR-03 % mesuré).
- `.planning/PROJECT.md` — contraintes transverses (trilingue MENA, éducatif/disclaimers, aucune promesse de gain, RLS stricte, anti-features dont univers « volt » écarté).

### Design system v3 figé (Phase 15 — base du reskin, NE PAS rediscuter)
- `.planning/phases/15-design-system-v3-dark-n-on-unique/15-CONTEXT.md` — décisions DS v3 (D-01 green verrouillé, D-02 valeurs `:root` figées, promotion sémantique, `forcedTheme="dark"`, RTL/no-FOUC).
- `.planning/phases/15-design-system-v3-dark-n-on-unique/15-UI-SPEC.md` — **contrat visuel approuvé** : tokens GREEN figés, 60/30/10, accent reserved-for, budget typo, registry safety. **Source de vérité du design.**
- `apps/web/src/styles/globals.css` — **source de vérité des tokens** (3 couches primitive `--nexa-*` → sémantique `:root`/`.dark` → component `@theme inline`). Namespace `--signal-bullish`/`--signal-bearish` distinct de `--primary`.
- `apps/web/src/styles/nexa-landing.css` (alias `nxl.css`) — styles `.nxl` de la landing : bloc `[data-theme="green"]` (vivant) vs `[data-theme="volt"]` (à retirer, D-02).

### Patterns reskin verrouillés (Phase 11 — NE PAS rediscuter)
- `.planning/phases/11-composants-nexa-reskin-transversal-rebranding/11-CONTEXT.md` — token flip, RTL propriétés logiques, % mesuré via `applyThreshold`, admin sobre (D-18), CandleChart via API lwc, conservation data-testid/ARIA, Disclaimer source unique.
- `.planning/phases/10-fondation-design-system-nexa/10-CONTEXT.md` — couches de tokens, namespace `--signal-*` ≠ `--primary`.

### Surfaces & assets concrets (cibles du reskin)
- `apps/web/src/components/landing/NexaLanding.tsx` — landing : `data-theme="volt"` (→green, D-01), toggle à supprimer.
- `apps/web/src/components/landing/NexaLandingEffects.tsx` — logique data-rain/parallaxe + toggle thème (nettoyage orphelin volt, D-02).
- `apps/web/src/components/signals/CandleChart.tsx` — recoloration via API lwc (D-11).
- `apps/web/src/components/Disclaimer.tsx` — source unique, à préserver sur chaque page concernée.
- `apps/web/src/components/member/ExpiryBanner.tsx` — déjà câblé/tokenisé (Phase 11), surface membre/compte.
- `apps/web/src/components/ui/` — primitives shadcn vendored (déjà branchées sur tokens) — base à enrichir (glow/data-rain primitives, D-06).
- `apps/web/e2e/` — specs `i18n`, `affiliation-attribution`, `gating`, `auth`, `academie` : préserver `data-testid` + rôles ARIA.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- shadcn/ui v4 vendored (`apps/web/src/components/ui/`) déjà branché sur la couche component des tokens → hérite automatiquement du green DS v3 figé. Reskin Tier 2/3 = ajout d'accents (glow) + nettoyage des littéraux résiduels, pas re-tokenisation de zéro.
- `.nxl[data-theme="green"]` (landing) — déjà la source des valeurs `:root` (promues Phase 15) → cohérence acquise ; seule la branche volt est à retirer.
- Primitives néon de la landing (glow, data-rain) — à **extraire/généraliser** en primitives transverses tokenisées (D-06) plutôt que dupliquer.

### Established Patterns
- **Token flip** : seule la couche sémantique porte la couleur ; les composants ne référencent QUE la couche component (`var()`, jamais de littéral) — Phase 10/11.
- **RTL** : un seul `<html lang dir>` dans `apps/web/src/app/[locale]/layout.tsx` ; propriétés logiques uniquement (ps/pe/ms/me/text-start) — orthogonal au reskin.
- **i18n** : `messages/{fr,en,ar}.json` + next-intl (`localePrefix:'always'`) — aucun texte en dur introduit par le reskin.
- **% mesuré** : tout rendu de % via `applyThreshold` (`@app/core`) + N + provenance.

### Integration Points
- Route groups sous `apps/web/src/app/[locale]/` : `(marketing)` (vitrine + Académie + légal + paiement-bientot), `(auth)`, `(account)`, `(member)`, `affiliation`, `dashboard` (stub) ; `(admin)` séparé. Découpage probable des plans par tier/route group (fichiers disjoints → parallélisable).
- `apps/web/src/app/[locale]/layout.tsx` — masque nav/footer sur la home `.nxl` plein écran (logique existante à préserver après réconciliation green).
- CandleChart observe `.dark` (présent, D-06 Phase 15) — mapping lwc inchangé, recoloration via API JS.

</code_context>

<specifics>
## Specific Ideas

- Une seule identité couleur partout = **green**, y compris la landing (fin du micro-monde volt).
- Hiérarchie d'intensité claire : vitrine spectaculaire → app lisible avec accents néon → admin sobre fonctionnel.
- Glow néon comme signature transverse (cartes/CTA/focus) ; data-rain comme touche ambient rare (auth/états vides/overview), jamais sur la donnée dense.
- Le « done » est mesurable, pas subjectif : checklist par page (tokens + accent tier + scans + garde-fous).

</specifics>

<deferred>
## Deferred Ideas

None — la discussion est restée dans le périmètre reskin. Les zones non discutées séparément (états vides/skeletons, micro-interactions, ordre exact des surfaces, mapping couleur fin du CandleChart) restent **dans le périmètre reskin sous discrétion de Claude**, pas reportées. Les dashboards complets (utilisateur/superadmin) restent en Phases 19-20 (hors scope explicite).

</deferred>

---

*Phase: 16-reskin-transversal-de-toutes-les-pages*
*Context gathered: 2026-06-22*
