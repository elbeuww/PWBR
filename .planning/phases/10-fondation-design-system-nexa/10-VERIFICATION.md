---
phase: 10-fondation-design-system-nexa
verified: 2026-06-21T00:00:00Z
status: human_needed
score: 4/4 must-haves verified (automatisé) — 1 vérification runtime requiert un dev server
overrides_applied: 0
human_verification:
  - test: "Vérifier l'absence de flash visible (FOUC) lors du rechargement avec un thème stocké"
    expected: "En posant localStorage.theme='dark' puis en rechargeant /fr/login, /en/login et /ar/login, le <html> porte la classe 'dark' dès le premier paint — aucune frame blanche (claire) visible"
    why_human: "no-flash.spec.ts requiert pnpm --filter web dev démarré sur :3000. Le plan 10-01 a explicitement différé le GREEN runtime au merge de la wave ; le test Playwright est écrit et syntaxiquement correct mais n'a pas été exécuté contre un serveur réel dans cette phase."
---

# Phase 10 : Fondation Design System NEXA — Rapport de Vérification

**Phase Goal :** Poser le socle de design tokenisé (couleurs OKLCH NEXA, polices, thèmes) sur lequel tout le reskin s'appuiera, avec garantie no-flash et RTL préservé — jamais à retrofitter.
**Vérifié :** 2026-06-21
**Statut :** human_needed
**Re-vérification :** Non — vérification initiale.

---

## Analyse de l'objectif

Les 4 Success Criteria du ROADMAP.md ont été tracés vers des artefacts concrets dans le code source. L'analyse part de l'objectif et remonte vers la preuve de code — pas des claims SUMMARY.

---

## Vérités observables

| # | Vérité | Statut | Preuve code |
|---|--------|--------|-------------|
| 1 | Le thème stocké (clair/sombre) s'affiche sans flash visible en fr/en/ar | ? UNCERTAIN | `no-flash.spec.ts` écrit et correct (L35-43) — GREEN différé, serveur dev requis |
| 2 | Les couleurs NEXA (cyber green / royal purple) sont exposées via tokens OKLCH 3 couches depuis `globals.css` | VERIFIED | 19 occurrences `oklch(`, `--nexa-green-500` défini L39, structure `@theme`/`:root .dark`/`@theme inline` vérifiée |
| 3 | Les 5 familles self-hostées sont servies sans CDN, exposées en CSS vars | VERIFIED | 10 .woff2 présents, 0 `import next/font/google` dans fonts.ts, 5 exports `localFont` avec `variable:` L21-64 |
| 4 | En arabe, la mise en page reste correctement miroir (propriétés logiques) | VERIFIED | 0 classe physique dans globals.css + layout.tsx ; `ms-6`/`ms-auto` (logiques) sur L60/64 de layout.tsx ; `:lang(ar)` → `var(--font-arabic)` L161 |

**Score :** 4/4 vérités prouvées dans le code source (la vérité #1 a une implémentation correcte mais le run runtime n'a pas été effectué dans cette session de vérification).

---

## Artefacts requis

| Artefact | Attendu | Statut | Détail |
|----------|---------|--------|--------|
| `apps/web/src/styles/__tests__/design-tokens.test.ts` | Garde DESIGN-01 (OKLCH, --nexa-green-500, interdiction HEX marque) | VERIFIED | 4 assertions substantielles, scanne globals.css réel |
| `apps/web/src/styles/__tests__/fonts.test.ts` | Garde DESIGN-02 (5 --font-*, 10 .woff2, absence Inter/IBM) | VERIFIED | 5 assertions + liste exhaustive EXPECTED_WOFF2 |
| `apps/web/src/styles/__tests__/rtl-logical-props.test.ts` | Garde DESIGN-04 (scan regex classes physiques) | VERIFIED | Regex `/\b(ml-|mr-|pl-|pr-|left-|right-)/`, 2 fichiers fondation scannés |
| `apps/web/tests/no-cdn-fonts.spec.ts` | Garde runtime DESIGN-02 (interception requêtes Google Fonts) | VERIFIED (fichier) / UNCERTAIN (run) | Implémentation `page.on('request')` correcte ; run différé (serveur dev) |
| `apps/web/tests/no-flash.spec.ts` | Garde runtime DESIGN-03 (thème stocké → classe dark au premier paint) | VERIFIED (fichier) / UNCERTAIN (run) | `addInitScript` + assertion `html.dark` correcte ; run différé (serveur dev) |
| `apps/web/src/lib/fonts.ts` | 5 exports `localFont` avec `variable:` NEXA | VERIFIED | 5 exports `localFont`, `import localFont from 'next/font/local'`, 0 `next/font/google` |
| `apps/web/src/fonts/*.woff2` (×10) | 10 fichiers .woff2 versionnés | VERIFIED | Glob : 10 fichiers présents, 0 IBMPlexSansArabic-* |
| `apps/web/src/styles/globals.css` | Système OKLCH 3 couches | VERIFIED | `@theme` (primitives L30-60), `:root`/`.dark` (sémantique L104-153), `@theme inline` (component L67-91) |
| `apps/web/src/app/[locale]/layout.tsx` | 5 familles injectées sur `<body>`, RTL logique | VERIFIED | L52 : `.map(f => f.variable).join(' ')`, L49 : `dir={locale === 'ar' ? 'rtl' : 'ltr'}` |
| `vitest.config.ts` | Glob élargi incluant `apps/web/tests/**/*.test.ts` | VERIFIED | L48 : entrée ajoutée, 6 entrées existantes préservées, `globals: false` intact |

---

## Vérification des liaisons clés (Key Links)

| De | Vers | Via | Statut | Détail |
|----|------|-----|--------|--------|
| `layout.tsx` | `lib/fonts.ts` | import L23 + destructuration | WIRED | `import { archivo, spaceGrotesk, jetbrainsMono, chakraPetch, notoArabic } from '../../lib/fonts'` |
| `layout.tsx` | `globals.css` | import L24 | WIRED | `import '../../styles/globals.css'` |
| `lib/fonts.ts` | `src/fonts/*.woff2` | path relatif dans `localFont.src[]` | WIRED | Chemins `../fonts/Archivo-Regular.woff2` etc., fichiers présents sur disque |
| `globals.css @theme inline` | `globals.css :root` primitives | `var(--nexa-*)` | WIRED | `@theme inline` = 100 % `var()`, aucune valeur littérale oklch/HEX (assertion 4 design-tokens.test.ts) |
| `globals.css :lang(ar)` | `@theme --font-arabic` | `var(--font-arabic)` | WIRED | L161 : `font-family: var(--font-arabic)` résout via `@theme --font-arabic: var(--font-noto-arabic)` |
| `body` | `--font-sans` / Space Grotesk | `var(--font-sans)` via `@theme inline` | WIRED | L176 : `font-family: var(--font-sans), system-ui` ; `@theme inline L68` : `--font-sans: var(--font-space-grotesk)` |

---

## Trace de flux de données (Level 4)

Pour les artefacts qui rendent des valeurs dynamiques (tokens CSS, polices) :

| Artefact | Variable/token | Source | Produit des vraies données | Statut |
|----------|---------------|--------|---------------------------|--------|
| `globals.css` | `--primary` | `var(--nexa-green-500)` → `oklch(0.7754 0.1896 155.45)` | Oui — valeur OKLCH réelle, non hardcodée en HEX statique | FLOWING |
| `globals.css .dark` | `--background` | `var(--nexa-ink)` → `oklch(0.1663 0.0262 269.37)` | Oui | FLOWING |
| `layout.tsx body` | `f.variable` | `localFont()` retourne le nom de variable CSS | Oui — next/font/local injecte la CSS var au runtime | FLOWING |
| `fonts.ts notoArabic` | `--font-noto-arabic` | `../fonts/NotoSansArabic-Regular.woff2` (48 KB, subset arabic) | Oui — fichier binaire .woff2 présent | FLOWING |

---

## Vérifications comportementales (Spot-checks)

Seuls les checks statiques sont applicables sans dev server.

| Comportement | Vérification | Résultat | Statut |
|-------------|--------------|----------|--------|
| Aucun HEX de marque dans globals.css | grep `#1E5FBF\|#03d87f\|#63279b` | 0 occurrences | PASS |
| Pas de `next/font/google` dans fonts.ts | grep `next/font/google` | 0 occurrences (commentaire documentation != import) | PASS |
| 10 .woff2 présents, 0 IBM Plex Arabic | Glob `src/fonts/*.woff2` | 10 fichiers exacts, liste conforme | PASS |
| Pas de classe physique dans fondation | grep `\bml-\|\bmr-\|\bpl-\|\bpr-` sur globals.css + layout.tsx | 0 occurrences | PASS |
| Classes logiques utilisées dans layout | grep `ms-\|me-` sur layout.tsx | `ms-6`, `ms-auto` trouvés L60/64 | PASS |
| 19 occurrences `oklch(` dans globals.css | grep count | 19 | PASS |
| `@theme inline` = 100 % var() | Lecture directe L67-91 | Confirmé, aucune valeur littérale | PASS |

**Step 7b : SKIPPED** — run Playwright requiert serveur dev sur :3000. Remplacé par checks statiques ci-dessus.

---

## Anti-patterns trouvés

| Fichier | Ligne | Pattern | Sévérité | Impact |
|---------|-------|---------|----------|--------|
| — | — | — | — | Aucun trouvé |

Scan complet effectué sur : `globals.css`, `fonts.ts`, `layout.tsx`, les 5 fichiers test. Aucun `TBD/FIXME/XXX` non référencé, aucun `return null` / retour vide, aucun stub détecté.

**Note** : `globals.css .dark` L139 contient `oklch(0.95 0.01 260)` — valeur littérale dans la couche sémantique (`:root`/`.dark`), PAS dans `@theme inline`. Ce n'est pas un anti-pattern : seule la couche `@theme inline` doit être 100 % `var()` (Pitfall 3). La couche sémantique peut contenir des valeurs, et les assertions design-tokens.test.ts ne l'interdisent pas. NON bloquant.

---

## Couverture des exigences

| Exigence | Plan source | Description | Statut | Preuve |
|----------|------------|-------------|--------|--------|
| DESIGN-01 | 10-01, 10-03 | tokens OKLCH en 3 couches (primitive→semantic→component) | SATISFIED | `globals.css` : `@theme` (primitives), `:root/.dark` (sémantique), `@theme inline` (component) ; 4/4 assertions design-tokens.test.ts GREEN |
| DESIGN-02 | 10-01, 10-02 | 5 familles self-hostées .woff2, zéro CDN runtime | SATISFIED (statique) + NEEDS HUMAN (runtime CDN check) | 10 .woff2 présents, `next/font/google` absent, `no-cdn-fonts.spec.ts` correct ; run runtime GREEN confirmé en 10-02 mais non re-run dans cette vérification |
| DESIGN-03 | 10-01, 10-03 | thème stocké sans flash (fr/en/ar) | NEEDS HUMAN | `no-flash.spec.ts` correct, next-themes + `suppressHydrationWarning` en place ; run runtime requis |
| DESIGN-04 | 10-01, 10-03 | RTL miroir via propriétés logiques | SATISFIED | 0 classe physique dans fondation, `dir=rtl` sur html, `:lang(ar)` → font-arabic ; `rtl-logical-props.test.ts` GREEN |

---

## Vérification humaine requise

### 1. Absence de flash thème (DESIGN-03 — runtime)

**Test :** Démarrer `pnpm --filter web dev`, ouvrir DevTools → Application → Local Storage, poser `theme = dark`, puis recharger `/fr/login`, `/en/login` et `/ar/login` en observant la Timeline de rendu (ou en filmant/screenshot au 1er paint).

**Attendu :** La classe `dark` est présente sur `<html>` dès le premier frame peint — aucune frame blanche (claire) visible avant le thème sombre. Vérifier les 3 locales.

**Pourquoi humain :** `no-flash.spec.ts` nécessite un serveur dev sur `:3000`. Le plan 10-01 a délibérément différé ce run au merge de la wave. La spec Playwright est écrite correctement (`addInitScript` + assertion `html.dark`) mais le verifier ne peut pas démarrer le serveur de développement.

---

## Résumé des gaps

Aucun gap bloquant. La phase livré l'intégralité du socle design attendu :
- Système OKLCH 3 couches opérationnel dans `globals.css`
- 5 polices NEXA self-hostées, 0 CDN
- RTL préservé via propriétés logiques
- 5 tests Wave-0 écrits et substantiels (gardes de non-régression pour Phase 11)

L'unique item en attente (DESIGN-03 runtime) est une vérification live intentionnellement différée par le plan 10-01, non une lacune d'implémentation. L'implémentation (next-themes, `suppressHydrationWarning`, script pré-paint) est en place.

---

_Vérifié : 2026-06-21_
_Vérificateur : Claude (gsd-verifier)_
