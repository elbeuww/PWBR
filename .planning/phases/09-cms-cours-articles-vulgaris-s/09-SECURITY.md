---
phase: 9
slug: cms-cours-articles-vulgaris-s
status: verified
threats_total: 10
threats_closed: 10
threats_open: 0
asvs_level: 2
register_authored_at_plan_time: true
created: 2026-06-19
---

# Phase 9 — Sécurité (Académie : CMS cours/articles vulgarisés)

> Contrat de sécurité par phase : registre des menaces, risques acceptés, traçabilité d'audit.
> Vérification = chaque mitigation déclarée doit être PRÉSENTE dans le code implémenté (preuve file:line). Le registre est figé au moment du plan (`register_authored_at_plan_time: true`) — pas de scan de nouvelles vulnérabilités.

---

## Frontières de Confiance (Trust Boundaries)

| Frontière | Description | Données traversantes |
|-----------|-------------|----------------------|
| URL → RSC (route params) | `slug`, `course`, `lesson`, `locale` issus de l'URL publique | Identifiants non fiables → garde T-09-PATH avant tout `fs` |
| URL → RSC (query params) | Filtres `theme`/`niveau`/`plateforme` en query string | Chaînes non fiables → whitelist Zod (T-09-01) |
| Fichier MDX → render RSC | Frontmatter YAML + corps MDX du dépôt | Donnée typée non fiable → `FrontmatterSchema` + allowlist composants (T-09-02, T-09-XSS) |
| Contenu dépôt → SEO | Locales réellement présentes par slug | hreflang annoncé = locales réelles uniquement (T-09-SEO) |

Surface 100% publique (groupe `(marketing)`) : aucune auth, aucun RLS, aucun accès fichier hors `content/academie/`. Confirmé par les Threat Flags des SUMMARY 01–04 (« Aucun nouveau »).

---

## Registre des Menaces (vérifié contre le code)

| Threat ID | Catégorie | Composant | Disposition | Mitigation vérifiée (preuve) | Statut |
|-----------|-----------|-----------|-------------|------------------------------|--------|
| T-09-PATH | Tampering / Info Disclosure | `content.ts` + routes détail | mitigate (HIGHEST) | `SLUG_RE = /^[a-z0-9-]+$/` (`content.ts:37`) ; `safeFilePath` rejette slug hors-regex ET locale ∉ `routing.locales` AVANT tout `fs` (`content.ts:71-73`) ; confinement `path.resolve(CONTENT_ROOT, fileName)` + `startsWith(CONTENT_ROOT + path.sep)` (`content.ts:81-82`) ; `resolveContent` appelle `safeFilePath` et retourne `null` avant `findAbsPath` (`content.ts:124-125`) ; aucune concat de slug brut. Routes : `[slug]/page.tsx:50` et `[course]/[lesson]/page.tsx:35-36` délèguent à `resolveContent`, jamais de chemin construit côté route. | closed |
| T-09-01 | Tampering | `searchParams.ts` + `FilterBar.tsx` | mitigate | Schéma `z.array(ThemeEnum/NiveauEnum/PlateformeEnum)` (`searchParams.ts:14-18`) ; `pickEnumArray` valide chaque candidat par `enumSchema.safeParse`, écarte les hors-enum, ne throw jamais (`searchParams.ts:35-45`) ; `parseAcademyParams` filtre axe par axe (`searchParams.ts:52-58`). FilterBar n'écrit que des options d'enum codées en dur (`FilterBar.tsx:26-34`, toggle `FilterBar.tsx:50-60`). Enums importés de `frontmatter.ts` (source unique). | closed |
| T-09-02 | Tampering | `frontmatter.ts` / `content.ts` / `render-mdx.ts` | mitigate | `FrontmatterSchema` (`frontmatter.ts:27-39`). CR-01 confirmé : index utilise `FrontmatterSchema.safeParse(data)` + `if (!result.success) continue` — fichier invalide exclu du catalogue, jamais 500 sur l'index (`content.ts:207-209`). Render détail : `FrontmatterSchema.safeParse(frontmatter)` + `if (!parsed.success) return null` (`render-mdx.ts:46-47`), l'appelant rend un état d'erreur (`[slug]/page.tsx:55-66`, `[course]/[lesson]/page.tsx:39-52`) — jamais `parse()` throwant. | closed |
| T-09-SC | Tampering (chaîne d'appro) | `apps/web/package.json` | mitigate | Chaîne MDX épinglée exact : `next-mdx-remote 6.0.0`, `@mdx-js/mdx 3.1.1`, `gray-matter 4.0.3`, `remark-gfm 4.0.1`, `rehype-slug 6.0.0`, `github-slugger 2.0.0`, `reading-time 1.5.0` (`package.json:17,24,30,32-34`). Aucun `@next/mdx` (grep négatif sur package.json + SUMMARY 09-01:72,101 « 0 @next/mdx »). `pnpm-lock.yaml` commité (SUMMARY 09-01). Checkpoint humain approuvé (SUMMARY 09-01 §Threats Mitigés). Note : `@mdx-js/react "^3"` porte un caret (peer de next-mdx-remote), versions résolues figées par le lockfile. | closed |
| T-09-MDX | Tampering | fixtures MDX | accept | Aucun upload/MDX utilisateur compilé : le contenu vient exclusivement du dépôt revu en PR. Voir Journal des Risques Acceptés. Confirmé : `renderMdxFile` ne lit que `fs.readFile(absPath)` sous `CONTENT_ROOT` (`render-mdx.ts:35`). | closed |
| T-09-XSS | Tampering | `compileMDX` / `mdx-components.tsx` | accept | Allowlist FIXE `MDX_COMPONENTS = { Callout, Steps, Step, Figure, TradeExample, h2 }` (`mdx-components.tsx:34-41`) — aucun `dangerouslySetInnerHTML`, aucun passthrough raw-HTML, aucun composant générique. `compileMDX` reçoit cette allowlist (`render-mdx.ts:38-44`) ; pas de `rehype-raw` dans `rehypePlugins` (seul `rehypeSlug`, `render-mdx.ts:42`). Aucune compilation de MDX utilisateur. Voir Journal des Risques Acceptés. | closed |
| T-09-A11Y | Conformité a11y | `Callout.tsx` | mitigate | Distinction attention/astuce par ICÔNE + LIBELLÉ i18n, jamais par la seule couleur (D-04) : `Icon = AlertTriangle | Lightbulb` (`Callout.tsx:27`) + `label = t('calloutAttention'|'calloutAstuce')` (`Callout.tsx:29`) rendus côte à côte (`Callout.tsx:33-36`). Pas de couleur sémantique vert/rouge. | closed |
| T-09-LEGAL | Repudiation (légal) | injection `<Disclaimer />` | mitigate | `<Disclaimer />` rendu par la PAGE après `{content}`, hors mapping MDX (`mdx-components.tsx:6-8` le note explicitement). Article : `DisclaimerFooter` (`[slug]/page.tsx:36-43`) injecté dans l'état d'erreur (`:63`), l'article (`:123`) et la page-cours (`:221-223`). Leçon : Disclaimer dans l'état d'erreur (`[course]/[lesson]/page.tsx:47-49`) ET le rendu normal (`:119-121`). Non-contournable même si un MDX l'omet. E2E délégué à Vercel preview (UAT, contrainte `!`). | closed |
| T-09-SEO | Info Disclosure (SEO) | `sitemap.ts` | mitigate | `listAllContent()` énumère les locales RÉELLEMENT présentes, jamais les fallbacks (`content.ts:234-250`, filtre `routing.locales` `:241`). `sitemap.ts:39-41` construit `alternates.languages` à partir de `item.locales` uniquement — le fallback FR servi sous `/ar` n'est PAS déclaré `hreflang="ar"`. Canonique = FR si présent sinon 1ʳᵉ locale réelle (`sitemap.ts:43-44`). | closed |
| T-09-I18N | Tampering | nav / liens funnel | mitigate | `createNavigation(routing)` expose `Link/redirect/usePathname/useRouter` localisés (`i18n/navigation.ts:10-11`). Liens via ce `Link` (`[slug]/page.tsx:21,60,206`, `[course]/[lesson]/page.tsx:16,44,99,109`) — préservent la locale, pas de chaîne en dur. FilterBar utilise `useRouter/usePathname` de `../../i18n/navigation` (`FilterBar.tsx:22`), pas `next/navigation` pour l'écriture. Libellés via `useTranslations('academy')` / `getTranslations('academy')`. | closed |

*Statut : open · closed*
*Disposition : mitigate (implémentation requise) · accept (risque documenté) · transfer (tiers)*

### Correctifs de justesse confirmés (soutiennent T-09-02 / intégrité routage)

- **CR-01** (BLOCKER, corrigé) : `content.ts` utilise `safeParse` + `continue` à l'index (`content.ts:207-209`). PRÉSENT.
- **WR-01** (WARNING, corrigé) : garde d'appartenance leçon→cours `if (meta.course !== course) notFound()` (`[course]/[lesson]/page.tsx:57`). PRÉSENT — empêche qu'une leçon soit servie 200 sous n'importe quel slug de cours.

---

## Journal des Risques Acceptés

| Risk ID | Réf menace | Justification | Accepté par | Date |
|---------|------------|---------------|-------------|------|
| AR-09-01 | T-09-MDX | Le MDX provient EXCLUSIVEMENT du dépôt, revu en PR. Aucun upload ni compilation de contenu utilisateur. `renderMdxFile` ne lit que des fichiers confinés sous `CONTENT_ROOT` (`render-mdx.ts:35`, garde T-09-PATH amont). Surface d'injection = commit reviewé. | Fondateur (PR review) | 2026-06-19 |
| AR-09-02 | T-09-XSS | Pas de passthrough raw-HTML : allowlist fixe `MDX_COMPONENTS` (`mdx-components.tsx:34-41`), aucun `dangerouslySetInnerHTML`, pas de `rehype-raw`. MDX non-utilisateur (cf. AR-09-01). Le risque XSS résiduel est borné au contenu repo reviewé. | Fondateur (PR review) | 2026-06-19 |

*Les risques acceptés ne réapparaissent pas dans les audits futurs.*

---

## Drapeaux Non-Enregistrés (Unregistered Flags)

Aucun. Les SUMMARY 09-01 à 09-04 déclarent tous « Aucun nouveau » en `## Threat Flags` (la surface reste celle du `<threat_model>` du plan ; aucun nouvel endpoint réseau, aucune auth, aucun accès fichier hors `content/academie/`). SUMMARY 09-05 est le plan de validation (sans surface nouvelle).

---

## Traçabilité de l'Audit Sécurité

| Date audit | Menaces total | Closed | Open | Exécuté par |
|------------|---------------|--------|------|-------------|
| 2026-06-19 | 10 | 10 | 0 | gsd-security-auditor (Claude Opus 4.8) |

Méthode : vérification mitigation-par-mitigation contre le code implémenté (ASVS niveau 2, `block_on: high`). 8 `mitigate` confirmés par preuve file:line ; 2 `accept` (T-09-MDX, T-09-XSS) documentés au Journal des Risques Acceptés + absence de passthrough HTML confirmée dans le code. CR-01 et WR-01 vérifiés présents. Aucun drapeau non-enregistré.

---

## Validation (Sign-Off)

- [x] Toutes les menaces ont une disposition (mitigate / accept / transfer)
- [x] Risques acceptés documentés au Journal des Risques Acceptés
- [x] `threats_open: 0` confirmé
- [x] `status: verified` posé en frontmatter

**Approbation :** verified 2026-06-19
