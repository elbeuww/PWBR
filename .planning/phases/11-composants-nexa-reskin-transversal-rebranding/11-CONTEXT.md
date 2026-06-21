# Phase 11: Composants NEXA, reskin transversal & rebranding - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Donner à toute la plateforme son identité NEXA via une bibliothèque de composants **tokenisée** (réutilisant les tokens/polices/thèmes posés en Phase 10), reskiner **chaque route group** (vitrine, espace membre, Académie, auth/compte, admin), achever le rebranding **MERA/« Vétéran Trading » → NEXA**, livrer le **hero animé** et câbler/tokeniser l'**ExpiryBanner** — le tout trilingue (AR-RTL/EN/FR), en **préservant** le gating RLS, le `<Disclaimer />` et les `data-testid`/rôles ARIA E2E, **sans jamais réintroduire la moindre promesse de gain ni % non mesuré**.

**Périmètre figé (ROADMAP).** On clarifie le *comment* du reskin ; aucune nouvelle capacité produit. La Phase 11 = **structure / composants / layout / identité** — PAS un nouveau changement de palette (la bascule couleur green/purple a déjà été faite en Phase 10).

</domain>

<decisions>
## Implementation Decisions

### Hero animé (UI-02) — greenfield (hero actuel statique)
- **D-01:** Cartes flottantes = **setups anonymisés éducatifs** : instrument + direction + score /100 + niveau de risque (ex. `EUR/USD · Long · Score 82 · Risque modéré`). **Zéro %**, aucun chiffre de gain.
- **D-02:** Globe = **filaire (wireframe) rotatif** green/purple, rotation lente CSS.
- **D-03:** Data-rain = **subtil, fond lointain** (faible densité/opacité, derrière le contenu).
- **D-04:** Ambiance = **fond sombre fixe (ink)** même en thème clair — le hero reste une vitrine cyber quel que soit le thème.
- **D-05:** Contrainte technique (verrouillée projet) : **CSS + vanilla TS uniquement**. GSAP / three.js / WebGL **interdits**. `motion` autorisé seulement en dernier recours. `prefers-reduced-motion` ⇒ **composition 100% statique** (pas d'animation, mais composition visuelle préservée).

### Identité visuelle / logo (BRAND-03) — greenfield (aucun asset livré)
- **D-06:** Mark = **emblème hexagonal « N »** (hexagone = structure/réseau/alliance, lettre N intégrée).
- **D-07:** Wordmark = **Archivo bold, tracking large**, majuscules (police display déjà self-hostée `--font-archivo`).
- **D-08:** Couleur du mark = **dégradé green→purple**.
- **D-09:** Favicon = **mark seul (hexagone N)**, optimisé 16-32px.
- **D-10:** Production = **SVG propre redessiné** aux hex de marque exacts **`#03d87f` (green) / `#63279b` (purple)** ; variantes **clair/sombre** + **image OG**. (Les jpg `branding/logo-concepts/*` sont des références conceptuelles à palette dérivée fausse — ne PAS les utiliser tels quels.)

### Score & confiance (DESIGN-05)
- **D-11:** Score /100 = **anneau radial (ring)**, chiffre au centre — lisible en liste comme en détail.
- **D-12:** Couleur du score = **niveau de RISQUE**, jamais « vert = gagnant » : échelle faible→modéré→élevé en neutre→amber→bear. Respecte la règle D-05 de Phase 10 (brand green hue 155 ≠ signal de direction ; signaux dans namespace `--signal-*` séparé).
- **D-13:** Stats de confiance = **win-rate mesuré + N visible + provenance (backtest/réel)**, via la source unique `applyThreshold` (`@app/core`). **Jamais un % nu.** Cohérent avec phases 13/14.
- **D-14:** Marquee = **instruments couverts + sessions de marché** (forex/crypto/métaux ; Londres/NY/Tokyo). Neutre, informatif.

### Baseline & voix de marque (BRAND-02)
- **D-15:** Baseline = **descripteur NEXA « Nouvelle Ère · Alliance d'Échange »** (expansion de l'acronyme), décliné FR/EN/AR. Sans promesse de gain.
- **D-16:** Placement = **header (sous/à côté du wordmark) + hero**.
- **D-17:** Ton = **sobre & crédible (« vétéran »)** : expertise calme, pédagogue, zéro hype. Aligné positionnement légal/éducatif.

### Reskin admin (UI-06)
- **D-18:** Profondeur admin = **sobre** : design NEXA via tokens + primitifs/composants, **sans hero ni animations**. Peut rester plus dépouillé que les surfaces publiques (conforme note ROADMAP).

### Claude's Discretion
- Fallback `prefers-reduced-motion` exact du hero (composition statique — détail de rendu libre).
- Structure fine de la nav header/footer, états vides/chargement (skeletons), micro-interactions — dans le périmètre reskin, libres tant que les décisions ci-dessus et les contraintes légales/RTL/a11y sont respectées.
- Mapping technique des couleurs NEXA dans `CandleChart` (lightweight-charts ne lit pas les CSS vars — Anti-Pattern 5) : via `getComputedStyle` ou table de mapping tokens→hex, passé par l'API JS lwc. Recoloration uniquement, jamais migration du fetch RLS vers le client (Anti-Pattern 3).
- Choix « étendre un primitif shadcn existant » vs « créer un nouveau composant NEXA » pour chaque élément de DESIGN-05 (eyebrow, gauges/rings, marquee, stats de confiance).
- Quelles traductions FR/EN/AR exactes pour la baseline (rédaction par `stop-slop`/sans slop).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Périmètre & exigences de la phase
- `.planning/ROADMAP.md` (section « Phase 11 ») — Goal, 5 Success Criteria, requirement IDs, Notes (anti-patterns P3/P5/P7, conservation data-testid/ARIA).
- `.planning/REQUIREMENTS.md` — libellés exacts de DESIGN-05, BRAND-01..04, UI-01..07.
- `.planning/PROJECT.md` — contraintes légales (éducatif, disclaimers, **aucune promesse de gain**, % toujours mesuré + N + provenance, seuil N≥30), trilingue MENA, anti-features (73% mocké, slogan MERA, univers 'volt').

### Fondation design verrouillée (Phase 10 — NE PAS rediscuter)
- `.planning/phases/10-fondation-design-system-nexa/10-CONTEXT.md` — décisions design figées.
- `apps/web/src/styles/globals.css` — **source de vérité des tokens** : 3 couches (primitive `--nexa-*` → sémantique `:root`/`.dark` → component `@theme inline` noms shadcn). Les nouveaux composants référencent la **couche component** (var() uniquement, jamais de littéral). Namespace signaux `--signal-bullish`/`--signal-bearish` distinct de `--primary`.
- `apps/web/src/lib/fonts.ts` — 5 polices self-hostées + CSS vars (`--font-archivo` display/wordmark, `--font-space-grotesk` = `--font-sans` body, `--font-jetbrains-mono` chiffres trading, `--font-chakra-petch` accents, `--font-noto-arabic` ar).

### Branding (référence directionnelle — production à refaire)
- `branding/BRANDING.md` — direction de marque.
- `branding/logo-concepts/C2-emblem.jpg` — concept emblème hexagonal retenu (référence visuelle seulement ; **redessiner en SVG** aux hex `#03d87f`/`#63279b`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **shadcn/ui v4** dans `apps/web/src/components/ui/` (button, card, badge, input, label, separator, dropdown-menu, dialog, tooltip, select, collapsible, skeleton, table, textarea, tabs, progress, alert-dialog, form, alert, sonner) — base à tokeniser/étendre. **À créer (DESIGN-05)** : eyebrow, gauges/rings de score, marquee, stats de confiance.
- **`apps/web/src/components/Disclaimer.tsx`** (RSC, clé i18n `disclaimer.footer`) — source unique, importé par `Footer.tsx` (global) + chaque page Académie. **À préserver sur chaque page reskinée.**
- **`apps/web/src/components/member/ExpiryBanner.tsx`** — **existe et déjà câblé** dans `apps/web/src/app/[locale]/(member)/layout.tsx:34` (lit `current_period_end`, RLS anon-client, logique J-3/J-1 ICU `payment.expiryBanner`). UI-07 = **vérifier le câblage côté `(account)/abonnement`** + **tokeniser** (utilise `border-amber-*` en dur). Dette WIRING-01/PAY-05 plus légère que prévu côté membre.

### Established Patterns
- **Token flip** : seule la couche sémantique (`:root`/`.dark`) bascule au thème ; les composants ne référencent QUE la couche component. Thème no-flash next-themes + script pré-paint (`ThemeProvider`/`ThemeToggle`) — conservé tel quel.
- **RTL** : un seul `<html lang dir>` dans `apps/web/src/app/[locale]/layout.tsx` (`dir="rtl"` si ar). **Propriétés logiques uniquement** (ps/pe/ms/me/text-start) — DESIGN-04 préservé sur tout reskin.
- **i18n** : messages `apps/web/src/messages/{fr,en,ar}.json` ; setup next-intl `apps/web/src/i18n/{routing,navigation,request}.ts` (`localePrefix:'always'`).
- **% mesuré** : tout rendu de pourcentage passe par `applyThreshold` (`@app/core`) ; logique provenance+N dans `TrackRecordBlock`/`TrackRecordView`, `methodologie/`, `tarifs/`.

### Integration Points
- **Rebranding (BRAND-01)** — cibles réelles minimes :
  - `apps/web/src/app/[locale]/layout.tsx:56` — header **texte en dur `"Vétéran Trading"`** → wordmark/logo NEXA.
  - `apps/web/src/app/layout.tsx:11-12` — root metadata `title: 'Vétéran Trading Platform'` → NEXA (+ ajouter OG).
  - `apps/web/src/messages/fr.json:210` — `codePlaceholder: "Ex : MERA2026"` → renommer.
  - (Reste des occurrences `MERA` = `.planning/**` docs, non livrées.)
- **Hero (UI-02)** — `apps/web/src/app/[locale]/(marketing)/page.tsx` lignes 33-44 : hero statique actuel à remplacer (greenfield).
- **Logo/favicon/OG (BRAND-03)** — **aucun asset** : créer `icon.*` / `apple-icon.*` / `opengraph-image.*` / favicon dans `apps/web/src/app/**` + SVG mark dans `public/` ou inline.
- **CandleChart (UI-03)** — `apps/web/src/components/signals/CandleChart.tsx` lignes 49-53 : couleurs **hardcodées** (`UP=#15803D DOWN=#B91C1C ENTRY=#1E5FBF` ancien brand-blue v2.0 `SL/TP`). Recolorer vers tokens NEXA `--signal-*` via l'API JS lwc.
- **Test no-perf-claims (BRAND-04)** — `apps/web/test/no-perf-claims.test.ts` : scanne actuellement **uniquement** les namespaces i18n `home`/`pricing`/`paiement`. **À étendre à la couverture composant** (hero, marquee, gauges) — la couverture composant n'existe pas encore.
- **E2E** — `apps/web/e2e/` : préserver `data-testid` + rôles ARIA des specs `i18n`, `affiliation-attribution`, `gating`, `auth`, `academie`.

</code_context>

<specifics>
## Specific Ideas

- Logo : emblème hexagonal « N », dégradé green→purple, hex exacts `#03d87f`/`#63279b`, favicon = mark seul, variantes clair/sombre + OG.
- Hero : globe filaire rotatif + cartes setups anonymisés (instrument·direction·score·risque, zéro %) + data-rain subtil + **fond ink fixe** (indépendant du thème).
- Score : anneau radial, **couleur = risque** (jamais vert=gagnant), confiance = win-rate mesuré + N + provenance.
- Baseline : « Nouvelle Ère · Alliance d'Échange », header + hero, ton sobre/vétéran.
- Admin : reskin sobre (tokens + composants, sans anim).

</specifics>

<deferred>
## Deferred Ideas

None — la discussion est restée dans le périmètre de la phase. Les zones non discutées séparément (nav, états vides/chargement, détail couleurs CandleChart) restent **dans le périmètre reskin** sous la discrétion de Claude, pas reportées à d'autres phases.

**⚠ À signaler au planner/verifier :** divergence ROADMAP — la note Phase 11 dit « 6 spec files E2E » mais seuls **5** existent dans `apps/web/e2e/`. Clarifier (spec membre/signaux attendu mais absent ?) sans casser les 5 existants.

</deferred>

---

*Phase: 11-composants-nexa-reskin-transversal-rebranding*
*Context gathered: 2026-06-21*
