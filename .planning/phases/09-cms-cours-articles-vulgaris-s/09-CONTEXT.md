# Phase 9: CMS cours & articles vulgarisés - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Construire **l'Académie** : le contenu éducatif gratuit (articles + cours) qui nourrit le funnel, crédibilise la plateforme et — surtout — **rend les signaux exploitables** (un visiteur/abonné apprend à utiliser sa plateforme de trading et à exécuter un signal).

**Recadrage majeur acté pendant la discussion :** PAS de CMS éditeur. Le contenu est **rédigé par l'agent Claude** et **publié en autonomie** via des fichiers MDX versionnés (commit → deploy). Il n'y a aucune interface superadmin de création/édition/publication.

La phase livre **le système Académie + 3-5 articles/cours de preuve** (bout-en-bout). La production des ~30 articles initiaux (×3 langues) puis ~10/semaine est une **opération de contenu continue APRÈS la phase**, hors périmètre du build.
</domain>

<decisions>
## Implementation Decisions

### Périmètre & modèle de publication
- **D-01:** **CMS-02 retiré.** Aucune UI superadmin de création/édition/publication. Le contenu est rédigé par l'agent Claude et publié en autonomie. **CMS-01 (lecture vitrine trilingue) reste le cœur de la phase.** ROADMAP/REQUIREMENTS mis à jour en conséquence.
- **D-02:** Stockage = **fichiers MDX dans le repo** (ex. `content/academie/…`), versionnés git. Pas de table DB, pas de RLS contenu, pas de script d'import. Publication = commit + deploy Vercel.
- **D-03:** La phase livre le **système** (routes, rendu MDX, composants pédago, filtres, cours, trilingue) **+ 3-5 articles/cours réels de preuve**. Les ~30 initiaux + ~10/semaine = production de contenu continue, autonome, après la phase.

### Types & taxonomie
- **D-04:** Deux types de contenu — **Articles** (concepts autonomes : R:R, levier…) et **Cours** (séries ordonnées de leçons à suivre dans l'ordre, ex. « Prendre en main MT5 » : installer → ouvrir une position → poser TP/SL…).
- **D-05:** Classement sur **3 axes filtrables** : **thème** (usage plateforme, bases du trading, gestion du risque, analyse technique, comprendre les signaux…), **niveau** (débutant / intermédiaire), **plateforme** (MT4 / MT5 / autre broker).

### Navigation & lecture vitrine
- **D-06:** Une page **« Académie »** unique sous `/[locale]/academie` listant articles + cours, avec **filtres thème/niveau/plateforme**. Cours = cartes-parcours, articles = cartes simples.
- **D-07:** Page détail par slug. Une page de cours = liste ordonnée des leçons ; une leçon = page de détail avec **navigation préc./suiv. + progression** dans le parcours.
- **D-08:** Liens dans le funnel : (a) bloc « Apprenez les bases » sur la **home** marketing, (b) lien contextuel depuis l'**espace membre signaux** (« comment exécuter ce signal ? → cours plateforme »), (c) entrée permanente dans la **nav principale** de la vitrine.

### Anatomie du contenu
- **D-09:** **Markdown + composants pédago maison** : callouts (⚠ attention / 💡 astuce), étapes numérotées, captures d'écran légendées, encadré « exemple de trade » (entrée/SL/TP/R:R), **disclaimer éducatif auto-injecté en pied** (LEGAL-01 — contenu éducatif, pas un conseil, aucune promesse de gain).
- **D-10:** Habillage : **image de couverture** (en-tête + vignette dans l'index), **temps de lecture** calculé automatiquement, **sommaire (TOC)** ancré pour les contenus longs, **navigation leçon préc./suiv.** dans les cours.
- **D-11:** Frontmatter par fichier : titre, résumé, thème, niveau, plateforme (optionnel), date de publication, image de couverture ; pour une leçon : référence du cours + ordre.

### Trilingue & robustesse
- **D-12:** Clé `(slug, locale)`. Convention de nommage de fichier à trancher en planif (ex. `{slug}.{locale}.mdx` ou `{slug}/{locale}.mdx`). 3 langues **fr/en/ar**, **RTL arabe** déjà acquis (P1).
- **D-13:** Publication **systématiquement dans les 3 langues d'un coup** (cas nominal — l'agent rédige les 3).
- **D-14:** **Fallback de sécurité** : si une locale manque pour un article qui existe ailleurs, afficher la **version FR avec un bandeau « traduction à venir »**. Filet uniquement, pas le cas nominal. Ne jamais 404 un contenu qui existe dans une autre langue.

### Claude's Discretion
- **Lib de rendu MDX** : `@next/mdx` (build-time, fichiers) vs `next-mdx-remote/rsc` — à trancher en recherche/planif selon le besoin de lister dynamiquement par locale et d'injecter des composants maison. **Contrainte connue : build = webpack (transpilePackages @app/*), PAS turbopack** ; runtime local non-viable → vérif en env propre (Vercel preview / clone sans `!`).
- Mécanique des filtres (RSC searchParams vs client), génération sitemap + balises hreflang trilingues, calcul exact du temps de lecture et extraction du sommaire.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Périmètre & exigences
- `.planning/ROADMAP.md` §"Phase 9: CMS cours & articles vulgarisés" — goal, dépendances (P1 locale/RTL, P2 vitrine), success criteria (mis à jour : publication autonome, pas d'UI superadmin).
- `.planning/REQUIREMENTS.md` — **CMS-01** (lecture vitrine trilingue, cœur) ; **CMS-02** révisé (publication autonome par fichiers MDX, plus d'UI superadmin) ; **LEGAL-01** (disclaimers éducatifs obligatoires partout).

### i18n & vitrine
- `apps/web/src/i18n/routing.ts` — locales `fr/en/ar`, `localePrefix: 'always'`, defaultLocale `fr`, RTL arabe.
- `apps/web/src/app/[locale]/(marketing)/` — groupe vitrine où vit l'Académie (sœur de `methodologie`, `tarifs`).
- `apps/web/src/components/Disclaimer.tsx` — composant disclaimer à injecter en pied de contenu (LEGAL-01).

### Build & contraintes plateforme
- `CLAUDE.md` (racine projet) — stack verrouillée (Next 15 App Router/RSC, Tailwind v4, shadcn/ui React 19) ; lightweight-charts NON pertinent ici (pas de candles dans l'Académie).
- `apps/web/next.config.*` — `transpilePackages: ['@app/core','@app/supabase','@app/data-sources']`, build webpack. Toute config MDX (ex. `@next/mdx`) s'ajoute ici.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **shadcn/ui** (`apps/web/src/components/ui/` : Card, Badge, Progress, Table) — cartes de l'index Académie, badges thème/niveau/plateforme, barre de progression d'un cours.
- **`Disclaimer`** (`apps/web/src/components/Disclaimer.tsx`) — réutilisé tel quel pour l'auto-injection en pied d'article (LEGAL-01).
- **next-intl** `getTranslations` + `apps/web/src/i18n/routing.ts` — i18n des libellés UI (titres de sections, filtres, « temps de lecture »).

### Established Patterns
- **RSC trilingue avec RTL logique** : `<bdi>`, `text-start`, utilities logiques `ms-*`/`me-*` (cf. `[locale]/affiliation/dashboard/page.tsx`). À reprendre pour la mise en page de l'Académie.
- **Groupes de routes vitrine** : `[locale]/(marketing)/<segment>/page.tsx` rendu RSC, `params` `await`és (Next 15).
- **Build webpack obligatoire** + runtime local non-viable (chemin `!` casse webpack-dev, turbopack ne résout pas les exports `@app/*`) → vérification runtime en env propre.

### Integration Points
- **Nouveau dossier de contenu** MDX (ex. `apps/web/content/academie/` ou racine repo) — source unique des articles/cours versionnés.
- **Nouvelles routes** sous `[locale]/(marketing)/academie` : index (liste + filtres), `[slug]` (article), structure cours + leçon (nav préc./suiv.).
- **Header / nav vitrine** — ajouter l'entrée « Académie » (i18n).
- **Espace membre signaux** (`[locale]/(member)/signaux`) — ajouter le lien contextuel « comment exécuter ce signal ? ».

</code_context>

<specifics>
## Specific Ideas

**Fil directeur fort (mots du fondateur) :** le contenu = **enablement du produit**. La priorité, ce sont les **tutos pratiques d'usage plateforme** (MetaTrader MT4/MT5) — ouvrir une position, poser un TP / un SL — pour que les abonnés sachent **exécuter les signaux reçus**. Verbatim : « comme ça les gens ne seront pas face à des signaux sans savoir comment les utiliser ». Les concepts de trading « bases » viennent en complément, mais l'onboarding plateforme est le pilier.

Cadence indicative de production (hors build) : ~30 articles ×3 langues au démarrage, puis ~10/semaine.
</specifics>

<deferred>
## Deferred Ideas

- **CMS éditeur / WYSIWYG superadmin** — explicitement retiré de cette phase. À ressortir seulement si un jour la rédaction passe à un tiers non-technique.
- **Recherche plein-texte** dans l'Académie — nouvelle capacité, future phase.
- **Quiz / exercices / certificats de fin de cours** — nouvelles capacités.
- **Commentaires / interactions communautaires** sur les articles — appartient au chantier social, pas ici.
- **Génération SEO/métadonnées assistée par IA** — optimisation ultérieure.

None bloquant — la discussion est restée dans le périmètre de la phase (le seul écart, retirer CMS-02, est une décision fondateur actée en D-01).

</deferred>

---

*Phase: 9-CMS cours & articles vulgarisés*
*Context gathered: 2026-06-19*
