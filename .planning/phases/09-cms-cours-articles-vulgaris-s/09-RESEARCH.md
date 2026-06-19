# Phase 9 : l'Académie (CMS lecture vitrine trilingue) — Research

**Researched:** 2026-06-19
**Domain:** Rendu MDX RSC sous Next 15 App Router, contenu fichier versionné trilingue (fr/en/ar RTL), SEO multilingue
**Confidence:** HIGH (stack vérifiée npm + contraintes build lues dans le code réel ; recommandation MDX appuyée sur l'architecture loader-vs-runtime confirmée)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 :** CMS-02 retiré. AUCUNE UI superadmin de création/édition/publication. Contenu rédigé par l'agent Claude, publié en autonomie. CMS-01 (lecture vitrine trilingue) = cœur de la phase.
- **D-02 :** Stockage = fichiers MDX dans le repo (ex. `content/academie/…`), versionnés git. Pas de table DB, pas de RLS contenu, pas de script d'import. Publication = commit + deploy Vercel.
- **D-03 :** La phase livre le **système** (routes, rendu MDX, composants pédago, filtres, cours, trilingue) **+ 3-5 articles/cours réels de preuve**. ~30 initiaux + ~10/sem = production continue APRÈS la phase.
- **D-04 :** Deux types — **Articles** (concepts autonomes) et **Cours** (séries ordonnées de leçons).
- **D-05 :** 3 axes filtrables : **thème** / **niveau** (débutant/intermédiaire) / **plateforme** (MT4/MT5/autre).
- **D-06 :** Page « Académie » unique sous `/[locale]/academie`, filtres thème/niveau/plateforme. Cours = cartes-parcours, articles = cartes simples.
- **D-07 :** Page détail par slug. Cours = liste ordonnée des leçons ; leçon = page détail avec nav préc./suiv. + progression.
- **D-08 :** Liens funnel : (a) bloc « Apprenez les bases » sur la home marketing, (b) lien contextuel depuis l'espace membre signaux, (c) entrée permanente dans la nav principale vitrine.
- **D-09 :** Markdown + composants pédago maison : callouts (⚠/💡), étapes numérotées, captures légendées, encadré « exemple de trade » (entrée/SL/TP/R:R), **disclaimer éducatif auto-injecté en pied** (LEGAL-01).
- **D-10 :** Image de couverture (en-tête + vignette index), temps de lecture auto, sommaire (TOC) ancré, nav leçon préc./suiv.
- **D-11 :** Frontmatter : titre, résumé, thème, niveau, plateforme (opt.), date publication, image couverture ; leçon : référence du cours + ordre.
- **D-12 :** Clé `(slug, locale)`. Convention de nommage à trancher en planif. 3 langues fr/en/ar, RTL arabe acquis (P1).
- **D-13 :** Publication systématiquement dans les 3 langues d'un coup (cas nominal).
- **D-14 :** Fallback de sécurité : locale manquante → afficher la version FR + bandeau « traduction à venir ». Ne jamais 404 un contenu existant ailleurs.

### Claude's Discretion
- **Lib de rendu MDX** : `@next/mdx` (build-time) vs `next-mdx-remote/rsc` — à trancher selon besoin de lister dynamiquement par locale + injecter des composants maison. **Contrainte connue : build = webpack (transpilePackages @app/*), PAS turbopack** ; runtime local non-viable → vérif en env propre (Vercel preview / clone sans `!`).
- Mécanique des filtres (RSC searchParams vs client), génération sitemap + hreflang trilingues, calcul du temps de lecture, extraction du sommaire.

### Deferred Ideas (OUT OF SCOPE)
- CMS éditeur / WYSIWYG superadmin (retiré explicitement).
- Recherche plein-texte dans l'Académie (future phase).
- Quiz / exercices / certificats de fin de cours.
- Commentaires / interactions communautaires (chantier social).
- Génération SEO/métadonnées assistée par IA.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMS-01 | Un visiteur lit des articles/cours gratuits vulgarisés sur la vitrine, dans sa langue | Rendu RSC `next-mdx-remote/rsc` clé `(slug, locale)` + routes `[locale]/(marketing)/academie/*` (§Standard Stack, §Architecture). Fallback FR D-14 (§Pattern 4). |
| CMS-02 (révisé D-01) | Contenu rédigé par l'agent et publié en autonomie via MDX versionné (commit → deploy), rendu RSC. Pas d'UI superadmin | Contenu = fichiers `content/academie/**`, lus par `fs` au render RSC (§Architecture, §Don't Hand-Roll). Aucune table DB, aucun admin. |
| LEGAL-01 | Disclaimers éducatifs partout | `<Disclaimer />` (RSC existant) auto-injecté en pied de chaque article/leçon via le mapping de composants MDX maison (§Pattern 2). |
</phase_requirements>

## Summary

La phase livre des **surfaces de lecture publiques en lecture seule** rendues en RSC à partir de fichiers **MDX versionnés** (clé `(slug, locale)`), avec composants pédago maison, filtres 3 axes, cours/leçons ordonnés, TOC, temps de lecture, et SEO trilingue (sitemap + hreflang). Aucune base de données, aucune UI d'admin (D-01/D-02).

**La question centrale (`@next/mdx` build-time vs `next-mdx-remote/rsc`) se tranche sur une seule contrainte décisive et déjà présente dans le code :** le chemin absolu du projet contient un `!` (`Potatos WILL BECOME RICH !`), et webpack réserve `!` comme **séparateur de loaders** dans les request strings. `@next/mdx` enregistre une **règle de loader webpack** sur `.mdx` → tout chemin MDX traverse la chaîne de loaders webpack → collision quasi-certaine avec le `!`. `next-mdx-remote/rsc` **n'enregistre aucun loader** : il lit le fichier avec `fs` et compile le MDX **à l'exécution du composant serveur** via `@mdx-js/mdx` (pas de passage par la résolution de modules webpack). Il **contourne entièrement** le piège `!`, et au passage `@next/mdx` ne sait pas non plus lister dynamiquement par locale ni parser le frontmatter pour l'index sans rendre tout le corps.

**Primary recommendation :** utiliser **`next-mdx-remote` v6.0.0 (entrée `next-mdx-remote/rsc`, fonction `compileMDX`)** + `gray-matter` pour le frontmatter de l'index, plugins rehype/remark pour TOC/slug/reading-time. Contenu sous `apps/web/content/academie/`. Filtres via **searchParams RSC** (pattern signaux D-03 réutilisé). Sitemap + hreflang via `app/sitemap.ts` (`MetadataRoute.Sitemap.alternates.languages`). Vérification runtime **en env propre Vercel preview** (le runtime local est non-viable, cf. contrainte projet).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stockage du contenu | Repo / fichiers (git) | CDN Vercel (build output) | D-02 : pas de DB. Fichiers MDX = source de vérité versionnée. |
| Compilation MDX → React | Frontend Server (RSC) | — | `compileMDX` s'exécute dans le composant serveur au render ; aucun loader webpack. |
| Listing index + frontmatter | Frontend Server (RSC) | — | Lecture `fs` + `gray-matter` (parse frontmatter SANS rendre le corps). |
| Filtres thème/niveau/plateforme | Frontend Server (RSC via searchParams) | Browser (chips toggle client) | URL = source de vérité (pattern signaux). Re-render RSC, pas de fetch client. |
| TOC / temps de lecture | Frontend Server (RSC, plugins) | — | rehype-slug + remark-reading-time s'exécutent à la compilation MDX serveur. |
| Modèle cours/leçon | Frontend Server (dérivé du frontmatter) | — | Tri/prev-next dérivés des champs `course`+`order` au scan fichiers. |
| SEO sitemap/hreflang | Frontend Server (metadata route) | CDN | `app/sitemap.ts` énumère `(slug × locale)` au build. |
| Disclaimer LEGAL-01 | Frontend Server (RSC) | — | `<Disclaimer />` injecté via mapping composants MDX. |

## Standard Stack

> Tout s'ajoute à `apps/web` (le workspace web). Aucune dépendance de registre shadcn nouvelle (UI-SPEC §Registry Safety). Les composants `ui/*` requis sont déjà installés.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next-mdx-remote` (entrée `/rsc`) | `6.0.0` [VERIFIED: npm registry — publié 2026-02-12] | Compiler du MDX lu depuis disque DANS un RSC, injecter des composants maison, parser le frontmatter | Seule approche qui **n'enregistre aucun loader webpack** → contourne le piège `!`. `compileMDX({source, components, options:{parseFrontmatter, mdxOptions:{remarkPlugins, rehypePlugins}}})`. peerDep `react>=16` seulement. |
| `@mdx-js/mdx` | `3.1.1` [VERIFIED: npm registry — 2025-08-29] | Moteur de compilation MDX (dépendance transitive de next-mdx-remote, à épingler) | Le compilateur MDX de référence v3 (ESM). Tiré par next-mdx-remote v6. |
| `@mdx-js/react` | `3.x` [VERIFIED: npm registry] | Provider de composants pour MDX (dépendance transitive) | Tiré par next-mdx-remote v6 ; pas d'usage direct requis (composants passés en prop `components`). |
| `gray-matter` | `4.0.3` [VERIFIED: npm registry — stale (2023-07) mais format figé] | Parser le frontmatter YAML **sans compiler le corps** — pour l'index/listing et le scan cours | Standard de facto. Permet de lister 30+ fichiers par locale en lisant seulement l'en-tête. **AVERTISSEMENT maintenance : dernière publi 2023 ; OK car parsing YAML stable, périmètre figé.** CJS — voir Pitfall 5. |
| `rehype-slug` | `6.0.0` [VERIFIED: npm registry — 2023-11] | Ajoute des `id` aux titres (ancres TOC) | Standard rehype, ESM. Indispensable pour les ancres du sommaire (D-10). |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `remark-gfm` | `4.0.1` [VERIFIED: npm registry — 2025-02] | GFM (tables, listes de tâches, ~~strike~~) dans le contenu pédago | Si le contenu utilise des tables Markdown / autolinks. ESM. |
| `remark-reading-time` | `2.1.0` [VERIFIED: npm registry — 2026-03] | Calcul du temps de lecture, exposé dans le frontmatter compilé | Option A (plugin). ESM, maintenu récemment. Injecte `data.estimatedReadingTime` dans le vfile. |
| `reading-time` | `1.5.0` [VERIFIED: npm registry — stale 2022] | Calcul du temps de lecture en code maison déterministe | Option B (recommandée, voir §Open Questions Q4) : appel direct sur le corps brut au scan, plus simple à tester (golden values). CJS — voir Pitfall 5. |
| `github-slugger` | `2.0.0` [VERIFIED: npm registry — 2023-09] | Slugger déterministe pour construire la liste du TOC en cohérence avec rehype-slug | Si extraction manuelle des titres pour le composant TOC (même algo que rehype-slug). ESM. |
| `rehype-autolink-headings` | `7.1.0` [VERIFIED: npm registry — 2023-11] | Liens d'ancrage cliquables sur les titres | Optionnel (confort), ESM. À évaluer vs TOC latéral suffisant. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `next-mdx-remote/rsc` | `@next/mdx` (build-time, file-routing) | **À ÉVITER ici.** Enregistre un loader webpack sur `.mdx` → collision avec le `!` du chemin. Ne liste pas dynamiquement par locale ; pas de parse frontmatter pour l'index sans rendre le corps ; couplage routing fichier ↔ URL incompatible avec la clé `(slug, locale)` et le fallback D-14. |
| `next-mdx-remote/rsc` | `next-mdx-remote-client` (fork ipikuka) | Fork actif avec API plus riche ; mais ajoute une dépendance moins « blessed ». Tenir en réserve si v6 pose un blocage RSC réel en preview. |
| `gray-matter` | `vfile-matter` (déjà transitif via next-mdx-remote) | `vfile-matter` parse le frontmatter pendant la compilation ; mais pour l'**index** on veut le frontmatter SANS compiler 30 corps → `gray-matter` reste plus direct et testable. |
| `remark-reading-time` (plugin) | `reading-time` (appel direct) | Plugin = couplé au pipeline MDX ; appel direct = déterministe, testable en isolation, indépendant du render. Préférer l'appel direct (Q4). |

**Installation :**
```bash
pnpm --filter web add next-mdx-remote@6.0.0 @mdx-js/mdx@3.1.1 @mdx-js/react@3 gray-matter@4.0.3 rehype-slug@6.0.0 remark-gfm@4.0.1 github-slugger@2.0.0 reading-time@1.5.0
# remark-reading-time / rehype-autolink-headings : seulement si l'option plugin est retenue (Q4)
```

**Version verification :** toutes les versions ci-dessus vérifiées via `npm view <pkg> version time.modified` le 2026-06-19. `@next/mdx` n'est PAS installé (recommandation = ne pas l'utiliser). Note : `@next/mdx` npm `latest` = 16.2.9 (branche Next 16) ; il existe une ligne `@next/mdx@15.5.x` alignée Next 15 — mais non retenue.

## Package Legitimacy Audit

> slopcheck 0.6.1 exécuté le 2026-06-19 : `slopcheck install <9 pkgs>` → **scanned 9 packages, 9 OK** (le post-scan `npm install` a échoué côté Windows à cause du `!` dans le chemin — le scan de légitimicité lui s'est terminé avec succès AVANT, verdict valide).

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `next-mdx-remote` | npm | ~5 ans (v6 2026-02) | github.com/hashicorp/next-mdx-remote | OK | Approved |
| `@mdx-js/mdx` | npm | mature | github.com/mdx-js/mdx | OK | Approved |
| `@mdx-js/react` | npm | mature | github.com/mdx-js/mdx | OK | Approved |
| `gray-matter` | npm | mature (2023) | github.com/jonschlinkert/gray-matter | OK | Approved (stale — format figé) |
| `rehype-slug` | npm | mature | github.com/rehypejs/rehype-slug | OK | Approved |
| `remark-gfm` | npm | mature | github.com/remarkjs/remark-gfm | OK | Approved |
| `reading-time` | npm | mature (2022) | github.com/ngryman/reading-time | OK | Approved (stale) |
| `github-slugger` | npm | mature | github.com/Flet/github-slugger | OK | Approved |
| `rehype-autolink-headings` | npm | mature | github.com/rehypejs/rehype-autolink-headings | OK | Approved (optionnel) |

**Packages retirés (SLOP) :** aucun.
**Packages suspects (SUS) :** aucun.

## Architecture Patterns

### System Architecture Diagram

```
                  COMMIT MDX (agent Claude)              git push → deploy Vercel
                          │
                          ▼
        apps/web/content/academie/
        ├── articles/{slug}.{locale}.mdx   ← frontmatter + corps MDX
        └── cours/{course}/{order}-{lesson}.{locale}.mdx
                          │
   ┌──────────────────────┼───────────────────────────────────────┐
   │ INDEX  /[locale]/academie                                     │
   │   fs.readdir + gray-matter (frontmatter SEUL, pas de corps)   │
   │        │                                                      │
   │        ▼  parseAcademyParams(searchParams) [Zod whitelist]    │
   │   filtre thème/niveau/plateforme  → tri  → cartes RSC         │
   └──────────────────────┬───────────────────────────────────────┘
                          │ clic slug
   ┌──────────────────────▼───────────────────────────────────────┐
   │ DÉTAIL  /[locale]/academie/[slug]  (ou /[course]/[lesson])    │
   │   1. résoudre (slug, locale) → chemin fichier                 │
   │   2. locale manquante & FR existe → fallback FR + bandeau D-14│
   │   3. fs.readFile(file)                                        │
   │   4. compileMDX({ source, components: MDX_COMPONENTS,         │
   │        options:{ parseFrontmatter:true,                       │
   │          mdxOptions:{ remarkPlugins:[gfm],                    │
   │            rehypePlugins:[rehypeSlug] }}})  ← AUCUN loader     │
   │   5. rendu RSC : TOC + corps + composants pédago + Disclaimer │
   └───────────────────────────────────────────────────────────────┘

   SEO : app/sitemap.ts  →  pour chaque (slug × {fr,en,ar})
         entry.alternates.languages → xhtml:link hreflang
```

Le point clé : **étape 4 ne touche jamais la résolution de modules webpack/turbopack** — `compileMDX` reçoit une *string* lue par `fs`, pas un `import`. C'est ce qui neutralise le `!` du chemin.

### Recommended Project Structure
```
apps/web/
├── content/
│   └── academie/
│       ├── articles/
│       │   ├── ratio-risque-rendement.fr.mdx
│       │   ├── ratio-risque-rendement.en.mdx
│       │   └── ratio-risque-rendement.ar.mdx
│       └── cours/
│           └── prendre-en-main-mt5/
│               ├── 01-installer.fr.mdx        # frontmatter: course, order
│               ├── 01-installer.en.mdx
│               └── 01-installer.ar.mdx
└── src/
    ├── app/[locale]/(marketing)/academie/
    │   ├── page.tsx                 # index (liste + filtres searchParams)
    │   ├── [slug]/page.tsx          # article OU page-cours (discriminé par frontmatter type)
    │   └── [course]/[lesson]/page.tsx  # leçon (nav préc./suiv.)
    ├── lib/academie/
    │   ├── content.ts               # fs scan, gray-matter, résolution (slug,locale)+fallback D-14
    │   ├── searchParams.ts          # Zod whitelist thème/niveau/plateforme (calque signaux)
    │   ├── reading-time.ts          # calcul déterministe (testé golden values)
    │   ├── toc.ts                   # extraction titres → ancres (github-slugger)
    │   └── frontmatter.ts           # schéma Zod du frontmatter (D-11)
    └── components/academie/
        ├── mdx-components.tsx       # mapping composants pédago + Disclaimer
        ├── Callout.tsx              # ⚠/💡 (border-s-4, RTL-safe)
        ├── Steps.tsx                # étapes numérotées
        ├── Figure.tsx               # capture légendée
        ├── TradeExample.tsx         # encadré entrée/SL/TP/R:R (<bdi>)
        ├── Toc.tsx                  # sommaire sticky desktop
        ├── ContentCard.tsx          # carte article / carte-parcours
        └── FilterBar.tsx            # chips toggle (client) — calque signaux/FilterBar
```

> **Localisation du dossier `content/` :** sous `apps/web/` (et non racine repo) pour que les chemins relatifs `fs` soient stables au build Vercel (cwd = `apps/web`). Le contenu n'est PAS importé comme module → pas besoin de l'inclure dans `transpilePackages`.

### Pattern 1 : Rendu d'un article RSC via compileMDX (contourne le `!`)
**What :** lire le fichier, compiler en RSC, injecter composants maison + frontmatter typé.
**When to use :** page détail article et leçon.
```typescript
// Source: next-mdx-remote/rsc README (hashicorp) + @mdx-js/mdx v3 [CITED: github.com/hashicorp/next-mdx-remote]
import { compileMDX } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import { promises as fs } from 'node:fs'
import { MDX_COMPONENTS } from '@/components/academie/mdx-components'
import { FrontmatterSchema } from '@/lib/academie/frontmatter'

const file = await fs.readFile(absolutePathFor(slug, locale), 'utf8') // fs, PAS import
const { content, frontmatter } = await compileMDX<Record<string, unknown>>({
  source: file,
  components: MDX_COMPONENTS,        // ⚠/💡, Steps, TradeExample, Figure injectés
  options: {
    parseFrontmatter: true,
    mdxOptions: { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug] },
  },
})
const meta = FrontmatterSchema.parse(frontmatter) // Zod, frontière de données (D-11)
// rendu : <Toc/> + {content} + <Disclaimer/>
```

### Pattern 2 : Composants pédago + Disclaimer auto-injecté
**What :** mapping passé à `compileMDX` ; le Disclaimer n'est PAS dans le MDX, il est rendu par la page après `{content}`.
```typescript
// mdx-components.tsx — composants MDX maison (D-09). PAS de couleur sémantique vert/rouge (UI-SPEC).
export const MDX_COMPONENTS = {
  Callout,       // <Callout variant="attention|astuce"> — icône lucide + libellé i18n
  Steps,         // <Steps> ol stylé, compteur bg-secondary
  Figure,        // <Figure src caption> next/image + figcaption
  TradeExample,  // entrée/SL/TP/R:R, valeurs enveloppées <bdi> (anti-inversion RTL)
  h2: HeadingWithAnchor, // réutilise les id rehype-slug
}
// La page (RSC) rend <Disclaimer/> APRÈS {content} → injection garantie sur 100% des contenus (LEGAL-01)
```
**Pourquoi pas le Disclaimer dans le MDX :** si on comptait sur l'auteur pour l'ajouter, un fichier pourrait l'oublier → faille LEGAL-01. L'injection par la page le rend **non-contournable**.

### Pattern 3 : Index — frontmatter seul, sans compiler les corps
**What :** lister 30+ fichiers par locale rapidement.
```typescript
// content.ts
import matter from 'gray-matter'
const raw = await fs.readFile(file, 'utf8')
const { data } = matter(raw)   // frontmatter SEUL — ne compile pas le MDX
// → construire le catalogue {slug, locale, type, theme, niveau, plateforme, titre, resume, cover}
```
**When to use :** index + filtres + dérivation des cours (regrouper par `course`, trier par `order`).

### Pattern 4 : Fallback FR D-14 (jamais 404)
```typescript
// content.ts — résolution (slug, locale)
function resolveContent(slug, locale) {
  if (exists(slug, locale)) return { file: pathFor(slug, locale), fallback: false }
  if (locale !== 'fr' && exists(slug, 'fr')) return { file: pathFor(slug, 'fr'), fallback: true } // bandeau D-14
  return null // → notFound() SEULEMENT si le slug n'existe dans AUCUNE langue
}
```
**Interaction avec hreflang (Q3) :** le sitemap n'émet d'`alternate` que pour les `(slug, locale)` **réellement présents**. Le contenu servi en fallback FR sous `/ar/...` ne doit PAS être annoncé comme `hreflang="ar"` (sinon Google indexe du FR comme arabe). Le fallback est un filet UX runtime, **pas** une alternative SEO.

### Pattern 5 : Filtres via searchParams RSC (calque signaux D-03)
**What :** URL = source de vérité. Page RSC lit `searchParams`, `parseAcademyParams` (Zod whitelist par enum, valeur hors-enum ignorée), filtre le catalogue en mémoire. `FilterBar` client (chips) met à jour l'URL via `useRouter`/`usePathname` de `@/i18n/navigation` (préserve la locale).
**Why :** réutilise exactement le pattern éprouvé `signals/searchParams.ts` + `signals/FilterBar.tsx`. Pas de fetch client, pas d'état, RSC re-render. Multi-select par axe (D-05) → `theme=a&theme=b` géré en `string[]`.

### Anti-Patterns to Avoid
- **`@next/mdx` avec ce chemin projet :** enregistre un loader webpack `.mdx` → collision `!`. Ne pas l'utiliser.
- **Importer le MDX comme module (`import Post from './x.mdx'`) :** repasse par webpack/turbopack → ramène le piège `!` et casse la clé `(slug,locale)` dynamique. Toujours `fs.readFile` + `compileMDX`.
- **Disclaimer écrit dans chaque MDX :** risque d'oubli = faille LEGAL-01. Injecter par la page.
- **Couleur vert/rouge dans les callouts/encadrés :** interdit (UI-SPEC §Color, réservé trading). Distinction par icône + libellé i18n.
- **Chaînes UI en dur dans les composants MDX :** namespace `academy` next-intl obligatoire (I18N-03, `lint:i18n`). Le CORPS du contenu est en langue du fichier ; les LIBELLÉS de chrome (callout, « Sommaire », nav) sont i18n.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Compiler MDX en RSC | Parser MDX maison | `next-mdx-remote/rsc` `compileMDX` | Parsing MDX = AST complexe (JSX + markdown). Battle-tested. |
| Parser frontmatter | Split YAML manuel | `gray-matter` | Gère délimiteurs, YAML, edge cases. |
| Ancres de titres | Regex sur HTML | `rehype-slug` (+ `github-slugger` pour le TOC) | Slugs unicode/RTL/dédup cohérents avec les `id` rendus. |
| Tables / GFM | Regex markdown | `remark-gfm` | Spec GFM complète. |

**Key insight :** le SEUL endroit où du code maison est plus sûr est le **temps de lecture** (déterministe, testable en golden values — voir Q4) et la **dérivation du modèle cours** (regroupement/tri sur frontmatter — logique métier propre au projet, pas de lib). Tout le reste = libs.

## Common Pitfalls

### Pitfall 1 : Le `!` du chemin casse tout passage par webpack
**What goes wrong :** chemin `…/Potatos WILL BECOME RICH !/…`. webpack interprète `!` comme séparateur de loaders → « Module not found » / inline-loader errors dès qu'un `.mdx` passe par la résolution de modules.
**Why :** syntaxe historique des inline loaders webpack (`loader!resource`).
**How to avoid :** `compileMDX` lit par `fs` (string en mémoire), aucun module MDX résolu par webpack → immunisé. NE PAS ajouter de loader `.mdx` ni d'`import *.mdx`.
**Warning signs :** toute config qui ajoute une `rule.test = /\.mdx$/` dans `webpack(config)`.

### Pitfall 2 : Runtime local non-viable — vérifier en env propre
**What goes wrong :** `pnpm --filter web dev` tourne sous turbopack (qui ne résout pas toujours les exports `@app/*` proprement) ; `next build` (webpack) échoue localement à cause du `!`. → On ne peut PAS valider le rendu MDX en local de façon fiable.
**How to avoid :** vérification runtime du rendu Académie **en Vercel preview** (ou clone du repo dans un chemin SANS `!`). Le plan DOIT inclure un checkpoint « vérif rendu en preview », pas « build local vert ».
**Warning signs :** un plan qui pose comme critère d'acceptation un `next build` local réussi.

### Pitfall 3 : ESM/CJS mix (plugins remark/rehype ESM-only)
**What goes wrong :** les plugins `rehype-*`/`remark-*` v récentes sont **ESM pure**. `gray-matter` et `reading-time` sont **CJS**. `apps/web` est `"type":"module"` → imports ESM OK ; les CJS s'importent par défaut import.
**How to avoid :** `import matter from 'gray-matter'` / `import readingTime from 'reading-time'` (default import). Plugins rehype/remark : import ESM standard. Pas de `require()`. La compilation se fait côté serveur (RSC) → aucun souci bundle client.
**Warning signs :** `ERR_REQUIRE_ESM`, ou `matter is not a function`.

### Pitfall 4 : RTL — inversion des valeurs numériques dans « exemple de trade »
**What goes wrong :** prix/SL/TP rendus en page arabe peuvent s'inverser visuellement (bidi).
**How to avoid :** envelopper chaque valeur dans `<bdi>` (précédent dashboard affilié D-02-03-A, cf. UI-SPEC §2). Filets logiques `border-s-4`, jamais `border-l`.
**Warning signs :** « 1.2345 » affiché « 5432.1 » en `dir=rtl`.

### Pitfall 5 : Slugs TOC désynchronisés des `id` rendus
**What goes wrong :** si le composant `<Toc>` calcule les ancres avec un algo différent de `rehype-slug`, les liens TOC pointent dans le vide.
**How to avoid :** utiliser `github-slugger` (même algo que rehype-slug) pour générer la liste du TOC, OU extraire les `id` réellement émis. Tester sur titres avec accents/arabe.
**Warning signs :** clic TOC → pas de scroll, ancre `#undefined`.

### Pitfall 6 : Parité i18n des libellés de chrome MDX
**What goes wrong :** un libellé de callout ou « Sommaire » en dur → échec `lint:i18n` (I18N-03), parité fr/en/ar cassée.
**How to avoid :** tous les libellés via namespace `academy`. Le corps MDX est dans la langue du fichier (normal) ; le CHROME (callout, TOC, nav, bandeau fallback) est i18n. `// i18n-ignore` uniquement pour le nom de marque.

## Code Examples

### Schéma frontmatter Zod (D-11) — frontière de données
```typescript
// lib/academie/frontmatter.ts
import { z } from 'zod'
export const ThemeEnum = z.enum(['usage-plateforme','bases-trading','gestion-risque','analyse-technique','comprendre-signaux'])
export const NiveauEnum = z.enum(['debutant','intermediaire'])
export const PlateformeEnum = z.enum(['mt4','mt5','autre'])
export const FrontmatterSchema = z.object({
  type: z.enum(['article','cours','lecon']),
  titre: z.string().min(1),
  resume: z.string().min(1),
  theme: ThemeEnum,
  niveau: NiveauEnum,
  plateforme: PlateformeEnum.optional(),
  date: z.iso.datetime().or(z.string()),  // date de publication
  cover: z.string().min(1),                // image de couverture
  // leçon : référence cours + ordre
  course: z.string().optional(),
  order: z.number().int().positive().optional(),
})
export type Frontmatter = z.infer<typeof FrontmatterSchema>
```

### Sitemap trilingue + hreflang (Q3)
```typescript
// app/sitemap.ts  [CITED: nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap]
import type { MetadataRoute } from 'next'
import { listAllContent } from '@/lib/academie/content'
const BASE = 'https://<domaine>'
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const items = await listAllContent() // {slug, locales:['fr','en','ar'], path}
  return items.map((it) => ({
    url: `${BASE}/fr/academie/${it.slug}`,
    lastModified: it.date,
    alternates: {
      languages: Object.fromEntries(
        it.locales.map((l) => [l, `${BASE}/${l}/academie/${it.slug}`]) // seulement locales RÉELLES (cf. Pattern 4)
      ),
    },
  }))
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-mdx-remote` `serialize`+`<MDXRemote>` (pages router, 2 étapes, Suspense) | `next-mdx-remote/rsc` `compileMDX` (1 étape, async RSC, pas de Suspense) | v4+ (entrée `/rsc`), stable en v6 | Compilation dans le RSC, plus simple, pas de sérialisation client. |
| Sitemap XML écrit à la main | `app/sitemap.ts` `MetadataRoute.Sitemap` + `alternates.languages` | Next 13.3+ (alternates : 13.4) | hreflang `xhtml:link` générés automatiquement. |

**Deprecated/outdated :**
- `@next/mdx` build-time pour du contenu dynamique multi-locale : techniquement vivant mais inadapté ici (file-routing rigide, loader webpack).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `next-mdx-remote/rsc` v6 compile en RSC sans Suspense et accepte `mdxOptions` plugins | Pattern 1 | Si l'API a changé en v6, ajuster les options ; vérifié sur README hashicorp v6 mais non exécuté (runtime local non-viable). À CONFIRMER en preview. |
| A2 | Le `!` casse `@next/mdx` mais PAS `compileMDX` (fs) | Summary, Pitfall 1 | Si un autre maillon (next/image sur covers, ou un plugin) repasse par webpack avec un chemin contenant `!`, collision possible. À CONFIRMER en preview. |
| A3 | Convention de nommage `{slug}.{locale}.mdx` (vs `{slug}/{locale}.mdx`) | Project Structure | Choix de planif (D-12). `{slug}.{locale}.mdx` recommandé (scan glob plus simple, moins de dossiers) mais non tranché. |
| A4 | Domaine du sitemap `https://<domaine>` | Sitemap | Placeholder — la valeur réelle vient de la config Vercel / env. |

## Open Questions

1. **Convention de nommage fichier (D-12).** Recommandation : `{slug}.{locale}.mdx` pour articles, `cours/{course}/{order}-{lesson}.{locale}.mdx` pour leçons. À valider en planif.
2. **searchParams vs client pour les filtres.** Recommandation : searchParams RSC (Pattern 5), `FilterBar` client uniquement pour piloter l'URL. Confirmé aligné sur le précédent signaux.
3. **hreflang × fallback FR (D-14).** Résolu : n'annoncer hreflang QUE les locales réellement présentes ; le fallback FR est UX runtime, pas SEO (Pattern 4).
4. **Temps de lecture : plugin vs maison.** Recommandation : **maison** (`reading-time` appelé sur le corps brut au scan, dans `lib/academie/reading-time.ts`), testable en golden values, indépendant du pipeline MDX. Le plugin `remark-reading-time` reste un fallback.
5. **Modèle cours/leçon sans DB.** Résolu : dérivé du frontmatter (`type:'cours'` = page parcours regroupant les `type:'lecon'` avec même `course`, triés par `order`) ; prev/next = voisins dans la liste triée ; progression = `order/total`. Pas de persistance de progression utilisateur (hors périmètre, pas de DB).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node `fs` | Lecture MDX au render RSC | ✓ (runtime Node) | — | — |
| npm registry (pnpm add) | Install libs MDX | ✓ | — | — |
| Vercel preview env | Vérif runtime (local non-viable, `!`) | ✓ (déploiement existant) | — | clone repo sans `!` |
| `next build` local | — | ✗ (casse sur `!`) | — | Vercel preview |

**Missing dependencies with no fallback :** aucune bloquante.
**Missing dependencies with fallback :** validation runtime locale → reportée sur Vercel preview (déjà la pratique projet).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.8` (unit) + Playwright `@playwright/test 1.60.0` (E2E) |
| Config file | racine workspace (`vitest`/`playwright` existants, cf. STACK) |
| Quick run command | `pnpm --filter web test -- <file>` (Vitest) |
| Full suite command | `pnpm --filter web test` + `pnpm --filter web e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMS-01 | Résolution `(slug, locale)` retourne le bon fichier | unit | `pnpm --filter web test -- academie/content` | ❌ Wave 0 |
| CMS-01 | Filtres : valeur hors-enum ignorée (Zod whitelist) | unit | `pnpm --filter web test -- academie/searchParams` | ❌ Wave 0 |
| CMS-01 | Temps de lecture déterministe (golden values fr/en/ar) | unit | `pnpm --filter web test -- academie/reading-time` | ❌ Wave 0 |
| CMS-01 | TOC slugs == id rendus (accents/arabe) | unit | `pnpm --filter web test -- academie/toc` | ❌ Wave 0 |
| CMS-01/D-14 | Locale manquante → fallback FR + bandeau, jamais 404 | unit | `pnpm --filter web test -- academie/content` | ❌ Wave 0 |
| CMS-01 | Frontmatter invalide → erreur de frontière (Zod) | unit | `pnpm --filter web test -- academie/frontmatter` | ❌ Wave 0 |
| CMS-02/D-07 | Dérivation cours : ordre leçons + prev/next | unit | `pnpm --filter web test -- academie/course-model` | ❌ Wave 0 |
| CMS-01 | Lecture article + nav cours rendus, disclaimer présent | e2e | `pnpm --filter web e2e -- academie` | ❌ Wave 0 (en preview) |
| LEGAL-01 | `<Disclaimer/>` présent sur 100% des contenus | e2e | `pnpm --filter web e2e -- academie` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit :** `pnpm --filter web test -- academie/<unit>` (Vitest ciblé)
- **Per wave merge :** `pnpm --filter web test` (suite unit complète)
- **Phase gate :** suite unit verte + **E2E exécuté en Vercel preview** (le rendu MDX ne se valide pas en build local — Pitfall 2) avant `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `apps/web/src/lib/academie/content.test.ts` — résolution (slug,locale) + fallback D-14
- [ ] `apps/web/src/lib/academie/searchParams.test.ts` — whitelist Zod (calque signaux)
- [ ] `apps/web/src/lib/academie/reading-time.test.ts` — golden values
- [ ] `apps/web/src/lib/academie/toc.test.ts` — cohérence slugs
- [ ] `apps/web/src/lib/academie/frontmatter.test.ts` — schéma Zod
- [ ] `apps/web/src/lib/academie/course-model.test.ts` — ordre + prev/next
- [ ] E2E Playwright Académie (exécuté en preview)
- [ ] 3-5 fixtures MDX réelles (×3 langues) = contenu de preuve D-03

## Security Domain

> `security_enforcement` non désactivé → section incluse. Surface = lecture seule publique, contenu repo (pas d'input utilisateur stocké).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | non | Surface publique, aucune auth dans l'Académie. |
| V3 Session Management | non | — |
| V4 Access Control | non | Contenu gratuit public (pas de gating). |
| V5 Input Validation | oui | searchParams via Zod whitelist (calque signaux) ; frontmatter via Zod (frontière de données) ; path traversal sur `(slug, locale)`. |
| V6 Cryptography | non | — |

### Known Threat Patterns for Next 15 RSC + MDX fichier
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `slug`/`locale` (`../../etc`) | Tampering / Info Disclosure | Valider `slug` contre une whitelist `^[a-z0-9-]+$`, `locale` contre `routing.locales` ; construire le chemin par join + vérifier qu'il reste sous `content/academie/`. JAMAIS concaténer le slug brut. |
| Injection via searchParams filtres | Tampering | Zod `safeParse` par enum, valeur hors-enum ignorée (pattern signaux T-03-05 déjà éprouvé). |
| MDX malveillant (XSS via JSX arbitraire) | Tampering | **Contenu = repo, écrit par l'agent, revu en PR** — pas d'upload utilisateur. Surface de confiance interne. Ne PAS exposer une route qui compile du MDX fourni par l'utilisateur. |
| Disclaimer manquant (conformité LEGAL-01) | Repudiation (légal) | Injection par la page RSC, non par le MDX (Pattern 2) → non-contournable ; test E2E de présence. |

## Sources

### Primary (HIGH confidence)
- npm registry (vérifié 2026-06-19 via `npm view … version time.modified`) — `next-mdx-remote 6.0.0` (2026-02-12, peerDep react>=16, exports `./rsc`), `@mdx-js/mdx 3.1.1`, `gray-matter 4.0.3` (stale 2023), `rehype-slug 6.0.0`, `remark-gfm 4.0.1`, `reading-time 1.5.0` (stale 2022), `github-slugger 2.0.0`, `remark-reading-time 2.1.0`, `rehype-autolink-headings 7.1.0`, `@next/mdx 16.2.9` latest + ligne `15.5.x` existante.
- Code projet lu : `apps/web/next.config.ts` (webpack extensionAlias, transpilePackages, turbopack dev), `apps/web/package.json` (Next 15, zod 4, type:module), `i18n/routing.ts` (fr/en/ar, localePrefix always), `i18n/request.ts`, `[locale]/layout.tsx` (html lang/dir RTL), `signals/searchParams.ts` + `signals/FilterBar.tsx` (pattern filtres), `methodologie/page.tsx` (gabarit prose), `components/Disclaimer.tsx`. — **HIGH** (source de vérité projet)
- slopcheck 0.6.1 : 9/9 packages OK (2026-06-19).
- [Next.js sitemap.xml metadata file](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap) — `alternates.languages` → hreflang. — **HIGH**

### Secondary (MEDIUM confidence)
- [github.com/hashicorp/next-mdx-remote](https://github.com/hashicorp/next-mdx-remote) — API `compileMDX` RSC, `parseFrontmatter`, `mdxOptions`. — **MEDIUM** (README, non exécuté localement)
- WebSearch « next-mdx-remote/rsc compileMDX » — `fs.readFileSync` + `compileMDX`, plugins ESM, `next.config.mjs`, async RSC sans Suspense. — **MEDIUM**

### Tertiary (LOW confidence)
- aucune assertion critique reposant sur une source unique non vérifiée.

## Metadata

**Confidence breakdown :**
- Standard stack : HIGH — versions vérifiées npm, contrainte `!` lue dans le chemin réel, recommandation MDX appuyée sur l'architecture loader-vs-fs.
- Architecture : HIGH — réutilise des patterns projet existants (searchParams signaux, prose methodologie, Disclaimer RSC).
- Pitfalls : MEDIUM-HIGH — Pitfall 1/2 (`!`) confirmés par la config webpack du projet ; A1/A2 à confirmer en Vercel preview (runtime local non-viable par conception).

**Research date :** 2026-06-19
**Valid until :** 2026-07-19 (stack stable ; surveiller next-mdx-remote vs évolutions Next 16 si migration future).
