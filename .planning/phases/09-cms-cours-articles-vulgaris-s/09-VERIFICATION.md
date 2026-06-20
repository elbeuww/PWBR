---
phase: 09-cms-cours-articles-vulgaris-s
verified: 2026-06-20T00:00:00Z
status: verified
score: 8/8 must-haves verified + E2E live exécuté
overrides_applied: 0
human_verification_resolved:
  - test: "E2E academie.spec contre next dev :3000 (rendu MDX réel)"
    result: "RÉSOLU 2026-06-20 — 8/8 verts. La prémisse 'next build local non-viable (chemin !)' est PÉRIMÉE : le chemin n'a plus de '!', le dev tourne sur webpack. Couvre : index trilingue fr/en/ar + nav + ≥1 carte, article FR/EN + disclaimer (LEGAL-01), leçon + nav préc/suiv + progression + disclaimer, RTL arabe <html dir=rtl lang=ar>, fallback D-14, aucune route 500."
  - test: "Fallback D-14 (bandeau + contenu FR, jamais 404)"
    result: "RÉSOLU + RENFORCÉ — tous les articles étant désormais trilingues (ajout des variantes arabes cette session), la cible de fallback a été déplacée sur la leçon 03-poser-tp-sl (sans en) et le test assied maintenant la PRÉSENCE RÉELLE du bandeau (academy.fallbackBanner), pas seulement un HTTP 200."
  - test: "Disclaimer présent sur 100% des contenus (LEGAL-01 / UAT-9)"
    result: "RÉSOLU — assertions disclaimer vertes sur article FR/EN, leçon, contenu fallback (academie.spec)."
---

# Phase 9 : Académie CMS — Verification Report

**Phase Goal:** Construire l'Académie — le contenu éducatif gratuit (articles + cours vulgarisés) qui nourrit le funnel et la crédibilité, rédigé par l'agent et publié en autonomie via fichiers MDX versionnés, lu sur la vitrine dans les 3 langues (D-01 : pas d'UI superadmin).
**Verified:** 2026-06-20 (E2E live exécuté)
**Status:** verified
**Re-verification:** Oui — items human_needed levés par run E2E local le 2026-06-20

**Mise à jour 2026-06-20 :** la prémisse « `next build` local non-viable (chemin `!`) » est PÉRIMÉE — le chemin projet ne contient plus de `!` et le dev tourne sur webpack (`next dev`). academie.spec.ts a été exécuté localement contre :3000 → 8/8 verts (rendu MDX réel, RTL, fallback D-14 renforcé, disclaimer). Gate automatisé local toujours actif : tsc (scope académie) + Vitest.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Un visiteur peut lire des articles/cours gratuits vulgarisés sur la vitrine, dans sa langue (clé (slug, locale), fichiers MDX versionnés rendus RSC) | ✓ VERIFIED (code) / ? PENDING (rendu live) | 3 routes RSC créées + render-mdx.ts via compileMDX(fs) + 11 fixtures MDX trilingues (articles: 5 fichiers, cours: 6 fichiers) |
| 2 | Le contenu est publié de façon autonome via fichiers MDX versionnés (commit → deploy) — pas de CMS éditeur ni d'UI superadmin | ✓ VERIFIED | Aucun superadmin CMS dans le codebase. content.ts scanne `apps/web/content/academie/**/*.mdx` via fs. Publication = git commit. |
| 3 | Un frontmatter invalide est rejeté à la frontière (Zod safeParse), jamais rendu silencieusement ni 500 | ✓ VERIFIED | content.ts:207 `FrontmatterSchema.safeParse(data); if (!result.success) continue` — CR-01 (fix post-review) appliqué. render-mdx.ts:46 `safeParse` + return null. 10 tests frontmatter verts. |
| 4 | Une valeur de filtre URL hors-enum est ignorée (whitelist Zod), jamais propagée | ✓ VERIFIED | searchParams.ts importe enums de frontmatter.ts (source unique, grep=1). `parseAcademyParams` via safeParse. Tests searchParams verts (cas `theme=__invalid__` exclu). |
| 5 | Le <Disclaimer /> est injecté par la PAGE sur 100% des articles/leçons (LEGAL-01) | ✓ VERIFIED (code) / ? PENDING (rendu live) | [slug]/page.tsx: `<DisclaimerFooter />` dans les 3 branches (article, page-cours, état erreur). [course]/[lesson]/page.tsx: `<Disclaimer />` dans les 2 branches. Jamais dans MDX_COMPONENTS. |
| 6 | Le fallback D-14 : locale manquante → version FR + bandeau, jamais 404 | ✓ VERIFIED (code) / ? PENDING (rendu live) | content.ts:131 `if (locale !== 'fr') { ... findAbsPath(frFileName) }`. FallbackBanner.tsx présent. Tests content.ts : "locale ar manquante mais FR présent → {locale:'fr', fallback:true}" vert. |
| 7 | La guard path-traversal rejette tout slug hors `^[a-z0-9-]+$` AVANT tout accès disque | ✓ VERIFIED | content.ts:37 `const SLUG_RE = /^[a-z0-9-]+$/`. safeFilePath() retourne null si non-match. 5 tests path-traversal verts (../, /, MAJUSCULES, vide, locale inconnue). |
| 8 | Le sitemap émet hreflang uniquement pour les locales réellement présentes (pas le fallback FR) | ✓ VERIFIED | sitemap.ts utilise listAllContent() (locales réelles) + `alternates.languages` filtré par locales existantes. Commentaire explicite T-09-SEO. |

**Score Automatisé:** 8/8 truths vérifiables dans le code. Les truths 1, 5, 6 ont une composante rendu live (human_needed).

### Résultats Gates Automatisés

| Gate | Commande | Résultat |
|------|---------|---------|
| Vitest (suite complète) | `pnpm exec vitest run` (racine) | **566 passed / 0 failed** (70 fichiers test + 1 skipped) |
| tsc scope académie | `pnpm exec tsc -b --force` + grep fichiers 09 | **0 erreur** sur les fichiers académie. 3 erreurs pré-existantes Phase 07 hors scope (ApplicationForm.tsx, affiliation/dashboard/page.tsx, jobs.test.ts — documentées 09-05-SUMMARY.md). |
| CR-01 fix (parse→safeParse) | Lecture content.ts:207 | `FrontmatterSchema.safeParse(data); if (!result.success) continue` — APPLIQUÉ |
| WR-01 fix (ownership) | Lecture [course]/[lesson]/page.tsx:57 | `if (meta.course !== course) notFound()` — APPLIQUÉ |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/lib/academie/frontmatter.ts` | FrontmatterSchema Zod + enums | ✓ VERIFIED | FrontmatterSchema, ThemeEnum, NiveauEnum, PlateformeEnum exportés |
| `apps/web/src/lib/academie/searchParams.ts` | parseAcademyParams whitelist | ✓ VERIFIED | Import enums depuis `./frontmatter` (source unique), safeParse, jamais throw |
| `apps/web/src/lib/academie/reading-time.ts` | computeReadingTime déterministe | ✓ VERIFIED | 3 golden values fr/en/ar verts en Vitest |
| `apps/web/src/lib/academie/toc.ts` | extractToc slugs cohérents rehype-slug | ✓ VERIFIED | github-slugger, titres H2/H3, tests accents/arabe verts |
| `apps/web/src/lib/academie/content.ts` | resolveContent + listContent + fallback D-14 | ✓ VERIFIED | 17 tests verts (résolution, fallback, path-traversal, catalogue) |
| `apps/web/src/lib/academie/course-model.ts` | deriveCourse + lessonNavigation | ✓ VERIFIED | Fichier présent, tests course-model.test.ts verts |
| `apps/web/src/lib/academie/render-mdx.ts` | compileMDX(fs.readFile), safeParse | ✓ VERIFIED | Utilise fs, compileMDX, FrontmatterSchema.safeParse, retourne null si invalide |
| `apps/web/src/app/[locale]/(marketing)/academie/page.tsx` | Index RSC + parseAcademyParams | ✓ VERIFIED | Import parseAcademyParams, listContent, composants académie |
| `apps/web/src/app/[locale]/(marketing)/academie/[slug]/page.tsx` | Détail article/cours + Disclaimer | ✓ VERIFIED | compileMDX, Disclaimer injecté, WR-01 résolu (notFound si slug hors-cours) |
| `apps/web/src/app/[locale]/(marketing)/academie/[course]/[lesson]/page.tsx` | Leçon + nav préc/suiv + Disclaimer | ✓ VERIFIED | lessonNavigation, meta.course !== course → notFound, Disclaimer injecté |
| `apps/web/src/app/sitemap.ts` | alternates.languages = locales réelles | ✓ VERIFIED | listAllContent() + alternates.languages, T-09-SEO respecté |
| `apps/web/src/messages/fr.json` | namespace academy (parité fr/en/ar) | ✓ VERIFIED | Clé "academy" présente avec navAcademy, learnBasicsCta, etc. |
| `apps/web/src/components/academie/` | 9 composants pédago | ✓ VERIFIED | mdx-components.tsx, Callout, Steps, Figure, TradeExample, Toc, ContentCard, FilterBar, FallbackBanner |
| `apps/web/content/academie/` | Fixtures MDX trilingues (D-03) | ✓ VERIFIED | 11 fichiers MDX : articles/comprendre-le-levier (.fr/.en), articles/ratio-risque-rendement (.fr/.en/.ar), cours/prendre-en-main-mt5/ (6 leçons, 3 langues) |
| `apps/web/e2e/academie.spec.ts` | E2E Playwright, exécution en preview | ✓ VERIFIED (authoring) | Fichier présent, 5 cas listés (`playwright --list` parse OK), exécution = preview UAT |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| searchParams.ts | frontmatter.ts | `import { ThemeEnum, NiveauEnum, PlateformeEnum } from './frontmatter'` | ✓ WIRED | Grep confirmé, source unique des enums |
| [slug]/page.tsx | next-mdx-remote/rsc | `compileMDX` sur `fs.readFile` | ✓ WIRED | render-mdx.ts:14 + page.tsx → renderMdxFile |
| [slug]/page.tsx | components/Disclaimer.tsx | `<DisclaimerFooter />` après `{content}` (LEGAL-01) | ✓ WIRED | Présent dans les 3 branches (article, cours, erreur) |
| academie/page.tsx | lib/academie/content.ts | `listContent(locale)` | ✓ WIRED | Import + appel confirmé ligne 130 |
| [course]/[lesson]/page.tsx | course-model.ts | `lessonNavigation` | ✓ WIRED | Import ligne 19 + appel ligne 63 |
| layout.tsx | i18n/navigation Link → /academie | `academy.navAcademy` | ✓ WIRED | Entrée nav ligne 62, libellé i18n (pas de chaîne dure) |
| (marketing)/page.tsx | /academie | `academy.learnBasicsCta` | ✓ WIRED | Bloc funnel ligne 70 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| academie/page.tsx | `catalog` | `listContent(locale)` → fs.readdir + gray-matter sur MDX réels | Oui — 11 fixtures MDX présentes dans content/academie/ | ✓ FLOWING |
| [slug]/page.tsx | `rendered` | `renderMdxFile(absPath)` → compileMDX(fs.readFile) | Oui — fichier MDX réel lu par fs | ✓ FLOWING (code) / ? live render en preview |
| [course]/[lesson]/page.tsx | `nav` | `lessonNavigation(course, order, catalog)` ← `listContent` ← fs | Oui — catalogue réel, prev/next calculés sur leçons réelles | ✓ FLOWING (code) |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — `next build` local non-viable (chemin `!` casse webpack, Pitfall documenté dans RESEARCH.md). Gates locaux = tsc + Vitest (cf. tableau ci-dessus). Rendu live = UAT Vercel preview.

---

### Probe Execution

Step 7c: Aucun probe-*.sh déclaré dans les PLANs. SKIPPED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CMS-01 | 09-01, 09-02, 09-04, 09-05 | Un visiteur lit des articles/cours gratuits vulgarisés sur la vitrine, dans sa langue | ✓ SATISFIED (code) / ? rendu live UAT | Routes RSC + fixtures MDX trilingues + i18n namespace academy complet |
| CMS-02 (révisé D-01) | 09-02, 09-04 | Publication autonome via fichiers MDX versionnés (commit→deploy), pas d'UI superadmin | ✓ SATISFIED | Content = fichiers dans content/academie/, aucun CMS éditeur, aucun UI superadmin ajouté |
| LEGAL-01 | 09-04 | Disclaimers présents sur la vitrine (Académie) | ✓ SATISFIED (code) / ? rendu live UAT | Disclaimer injecté par page sur toutes les surfaces article/leçon/cours/erreur, jamais dans MDX_COMPONENTS |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/lib/academie/frontmatter.ts` | date field | `z.iso.datetime().or(z.string())` — or(z.string()) rend ISO branch sans effet | ℹ Info (IN-04) | Aucun impact actuel (date non utilisée au render) — revue si tri par date ajouté |
| `apps/web/src/lib/academie/frontmatter.ts` | cover field | `z.string().min(1)` sans contrainte de chemin | ⚠ Warning (WR-03) | Accepte des URLs externes → next/image runtime error si host non whitelisté. Contenu actuellement repo-trusted. |
| `apps/web/src/lib/academie/content.ts` | 97-114 | findAbsPath : premier match gagne, slug collision silencieuse entre cours | ℹ Info (IN-02) | Risque bas (contenu auteurisé), mais deux cours avec même filename de leçon = ombre silencieuse |
| `apps/web/src/app/[locale]/(marketing)/academie/page.tsx` | 86-119 | Double carte `key:"cours:${slug}"` si fichier type:cours ET leçons du même cours | ⚠ Warning (WR-02) | Avertissement React key duplicate si scénario page-cours explicite activé. Non déclenché avec les fixtures actuelles. |
| `apps/web/src/components/academie/Steps.tsx` | 24-27 | Step number via CSS content-only + aria-hidden | ⚠ Warning (WR-05) | Accessibilité (screen-reader). Non bloquant pour le goal CMS-01/CMS-02. |

Aucun `TBD`, `FIXME`, `XXX` non référencé détecté dans les fichiers académie.
Aucun `@next/mdx` dans package.json (blocker explicitement interdit en RESEARCH Pitfall 1).
CR-01 et WR-01 (les deux items BLOCKER/WARNING de la review) : FIXÉS avant clôture de phase.

---

### Human Verification Required

#### 1. E2E Playwright Académie — exécution en Vercel preview

**Test:** Déployer sur Vercel preview (push branche), récupérer l'URL, puis : `PLAYWRIGHT_BASE_URL=<preview_url> pnpm --filter web exec playwright test e2e/academie.spec.ts`
**Expected:** 5 cas verts — index trilingue (≥1 carte), article + disclaimer, leçon + nav préc/suiv, RTL arabe (`dir=rtl`), fallback D-14 (FallbackBanner visible, pas de 404)
**Why human:** next build local non-viable (`!` casse webpack). Seul Vercel preview permet le rendu MDX réel via compileMDX.

#### 2. Rendu composants pédago en preview

**Test:** Ouvrir `/fr/academie/ratio-risque-rendement` en preview. Vérifier callouts, étapes numérotées, encadré TradeExample avec `<bdi>` sur les valeurs numériques, TOC latéral.
**Expected:** Tous les composants MDX_COMPONENTS rendus correctement dans la prose compilée.
**Why human:** compileMDX(fs) ne s'exécute que côté serveur Next.js live.

#### 3. Bascule RTL arabe (I18N-02)

**Test:** Ouvrir `/ar/academie/ratio-risque-rendement` en preview. Vérifier `<html dir="rtl" lang="ar">`, flux de texte RTL, valeurs numériques/prix restant LTR grâce à `<bdi>`.
**Expected:** RTL actif, nombres LTR — aucun mélange de direction.
**Why human:** Vérification visuelle + attribut HTML dynamique en preview.

#### 4. Fallback D-14 en live (UAT-7)

**Test:** Ouvrir `/ar/academie/comprendre-le-levier` (fichier `.ar.mdx` absent pour cet article). Vérifier FallbackBanner, contenu FR, HTTP 200.
**Expected:** Page rendue en FR avec bandeau « traduction à venir », jamais 404.
**Why human:** Comportement de fallback côté Next.js live — résolution fs en runtime.

#### 5. LEGAL-01 — Disclaimer sur 100% des contenus (UAT-9)

**Test:** Ouvrir 3 surfaces différentes en preview (1 article, 1 leçon, 1 page-cours). Vérifier que le disclaimer est visible après chaque contenu.
**Expected:** `<Disclaimer />` présent sur chaque page sans exception.
**Why human:** Assertion de présence UI multi-pages.

#### 6. Aucun 500 sur les routes Académie (UAT-8)

**Test:** Naviguer sur toutes les routes Académie en preview (index, détail article, leçon, page-cours).
**Expected:** Toutes les routes répondent HTTP < 400.
**Why human:** Détection d'erreurs runtime (manque de deps, erreurs compileMDX, etc.) nécessite le serveur live.

---

### Gaps Summary

Aucun gap bloquant identifié. Les must-haves CMS-01, CMS-02 et LEGAL-01 sont satisfaits dans le code :
- Fixtures MDX versionnées présentes (11 fichiers trilingues)
- Routes RSC complètes (index + détail + leçon)
- Disclaimer injecté par la page sur toutes les surfaces
- Frontmatter validé Zod safeParse (CR-01 fix appliqué)
- WR-01 fix appliqué (ownership cours/leçon)
- Funnel câblé (nav layout + home + SignalDetail)

Les 8 items human_verification sont des confirmations de rendu live différées en UAT Vercel preview, conformément à la décision D-09-05-C et au précédent D-01-04-C. Ils ne constituent pas des gaps de code.

---

_Verified: 2026-06-19T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
