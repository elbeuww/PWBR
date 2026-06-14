---
phase: 02-vitrine-publique-trilingue-gate-l-gal
verified: 2026-06-14T00:00:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Revue visuelle RTL arabe, bascule dark/light"
    expected: "La mise en page est bien miroir en arabe (RTL), les prix ne s'inversent pas (balise <bdi> active), le toggle passe correctement du mode clair au mode sombre sans flash visible."
    why_human: "Rendu visuel/RTL non vérifiable par grep ou assertions statiques — nécessite un dev server avec /ar ouvert."
  - test: "Revue juridique externe et sign-off (LEGAL-02)"
    expected: "Un juriste externe coche toutes les cases de docs/legal/LEGAL-REVIEW.md (statut crypto Algérie/MENA, périmètre éducatif, textes faisant foi FR+AR/EN) et appose sa signature datée. Ensuite LEGAL_REVIEW_DONE=true est posé en prod."
    why_human: "Gate non-code — hors portée du code. Bloque P4 (premier encaissement), PAS la livraison P2. Le code livre l'artefact et le helper prêt à l'emploi."
---

# Phase 02 : Vitrine Publique Trilingue — Rapport de Vérification

**Phase Goal :** Donner au visiteur une vitrine convaincante et légalement défendable dans sa langue, et franchir la porte juridique non-code requise avant tout encaissement.
**Vérifié :** 2026-06-14
**Statut :** human_needed
**Re-vérification :** Non — vérification initiale.

## Atteinte de l'Objectif

### Vérités Observables

| # | Vérité | Statut | Preuve |
|---|--------|--------|--------|
| 1 | Un visiteur voit une page d'accueil dans sa langue : hero bénéfice-first + CTA vers /tarifs + méthode + aperçu tarifs, SANS aucune promesse de gain ni chiffre de perf (D-08 — proof slot MASQUÉ) | ✓ VERIFIED | `apps/web/src/app/[locale]/(marketing)/page.tsx` — `SHOW_PROOF = false` ligne 18, hero title "Décidez avec discipline." en fr.json ligne 47, zéro `%` dans namespace `home` vérifié |
| 2 | Un visiteur voit la page tarifs (9$/mois Standard + 3$/7j Découverte, une seule fois, mention USDT TRC-20) et peut démarrer le parcours d'abonnement (funnel → /paiement-bientot) | ✓ VERIFIED | `tarifs/page.tsx` : 2 cartes Card avec `<bdi>`, mention USDT TRC-20 dans fr.json `plan1Usdt` / `plan2Usdt`. `actions.ts` ligne 53 : `redirect({ href: '/paiement-bientot', locale })` après signup réussi. |
| 3 | Disclaimers (contenu éducatif, pas de conseil, aucune promesse de gain, risque de perte total) présents sur la vitrine, dans les 3 langues | ✓ VERIFIED | `Disclaimer.tsx` RSC (sans 'use client'), rendu par `Footer.tsx` dans `layout.tsx` ligne 60 (`<Footer />`). Namespace `disclaimer.footer` à parité stricte fr/en/ar vérifié manuellement et par `messages-parity-legal.test.ts`. |
| 4 | Le gate légal est livré côté serveur : isLegalReviewDone() retourne false par défaut, artefact docs/legal/LEGAL-REVIEW.md versionné avec checklist + sign-off — gate CODE livré | ✓ VERIFIED | `legal-gate.ts` : `import 'server-only'` ligne 1, comparaison stricte `=== 'true'` ligne 20. `docs/legal/LEGAL-REVIEW.md` contient « LEGAL-02 », « Sign-off », « crypto Algérie ». `legal-gate.test.ts` couvre les 3 cas (absent, valeur ≠ 'true', valeur === 'true'). `.env.example` : `LEGAL_REVIEW_DONE=false`. |
| 5 | Revue juridique externe signée (LEGAL-02, gate non-code) | ? HUMAN | La signature d'un juriste externe est hors portée du code. L'artefact est en place (voir vérité 4). Bloque P4, pas P2. |

**Score :** 4/5 vérités vérifiées en code (la 5ème est un gate manuel explicitement documenté comme tel).

---

### Artefacts Requis

| Artefact | Description attendue | Statut | Détail |
|----------|----------------------|--------|--------|
| `apps/web/src/lib/legal-gate.ts` | helper server-only isLegalReviewDone(), défaut false | ✓ VERIFIED | Existe, contient `import 'server-only'`, comparaison stricte `=== 'true'` |
| `apps/web/src/components/Disclaimer.tsx` | RSC transverse, namespace disclaimer, réutilisable | ✓ VERIFIED | Existe, `getTranslations`, pas de 'use client', classes logiques uniquement |
| `apps/web/src/components/Footer.tsx` | footer global : nav légale localisée + Disclaimer | ✓ VERIFIED | Existe, RSC, importe Disclaimer, liens via `@/i18n/navigation`, 4 docs légaux mappés |
| `apps/web/src/app/[locale]/(marketing)/legal/[doc]/page.tsx` | pages légales placeholder, allowlist DOCS + generateStaticParams + notFound | ✓ VERIFIED | Existe, `DOCS = ['cgu', 'risques', 'confidentialite', 'mentions']`, `notFound()` avant tout rendu si doc hors allowlist, `generateStaticParams` présent, zéro `dangerouslySetInnerHTML` |
| `docs/legal/LEGAL-REVIEW.md` | checklist gate non-code, sign-off daté | ✓ VERIFIED | Existe, contient statut NON VALIDÉ, checklist complète, section Sign-off |
| `apps/web/src/app/[locale]/(marketing)/page.tsx` | home RSC trilingue, sections D-05, proof slot masqué (D-08) | ✓ VERIFIED | Existe, `setRequestLocale` présent, `SHOW_PROOF = false`, CTA → /tarifs, `getTranslations('home')` |
| `apps/web/src/app/[locale]/(marketing)/tarifs/page.tsx` | 2 cartes tarifs (9$/mois + 3$/7j), mention USDT TRC-20, CTA signup | ✓ VERIFIED | Existe, 2 cartes shadcn, `<bdi>` sur prix, plans 1 et 2 distincts, CTA mène à /signup |
| `apps/web/src/app/[locale]/(marketing)/paiement-bientot/page.tsx` | écran post-signup honnête, aucune adresse USDT, aucun flux | ✓ VERIFIED | Existe, `setRequestLocale`, `getTranslations('paiement')`, aucun terme adresse/wallet/qr/hash |
| `apps/web/test/no-perf-claims.test.ts` | garde anti-allégation de perf, scan messages home/pricing/paiement | ✓ VERIFIED | Existe, scanne les 3 namespaces, sanity test avec « 90% », exception `take-profits` documentée |
| `apps/web/src/components/ThemeProvider.tsx` | wrapper next-themes class strategy | ✓ VERIFIED | Existe, 'use client', ré-exporte NextThemesProvider |
| `apps/web/src/components/ThemeToggle.tsx` | bouton bascule thème accessible RTL | ✓ VERIFIED | Existe, useTheme(), min-h-11 min-w-11, aria-label traduit, Sun/Moon lucide-react |
| `apps/web/src/lib/fonts.ts` | next/font/local IBM Plex Sans Arabic + Inter, variables CSS | ✓ VERIFIED | Existe, `Inter` (next/font/google), `localFont` (IBM Plex), variables `--font-inter` et `--font-ibm-plex-arabic` |
| `apps/web/src/styles/globals.css` | tokens 2 thèmes + @custom-variant dark + :lang(ar), zéro Noto Sans Arabic | ✓ VERIFIED | `@custom-variant dark` ligne 9, `var(--font-ibm-plex-arabic)` ligne 19, `:lang(ar)` ligne 108, zéro « Noto Sans Arabic » |
| `apps/web/src/components/ui/` (button, card, badge, ...) | primitives shadcn disponibles | ✓ VERIFIED | 8 fichiers : badge.tsx, button.tsx, card.tsx, dialog.tsx, dropdown-menu.tsx, input.tsx, label.tsx, separator.tsx |
| Polices woff2 self-hostées | IBMPlexSansArabic-Regular.woff2 + IBMPlexSansArabic-SemiBold.woff2 | ✓ VERIFIED | 2 fichiers présents dans `apps/web/src/fonts/` |
| `apps/web/.env.example` | LEGAL_REVIEW_DONE=false documenté | ✓ VERIFIED | Contient `LEGAL_REVIEW_DONE=false` avec commentaire gate LEGAL-02 |

---

### Vérification des Liens Clés (Wiring)

| De | Vers | Via | Statut | Détail |
|----|------|-----|--------|--------|
| `layout.tsx` | `Footer.tsx` | import + rendu après {children} | ✓ WIRED | Ligne 21 : `import { Footer }` ; ligne 60 : `<Footer />` dans ThemeProvider > NextIntlClientProvider > après {children} |
| `Footer.tsx` | `Disclaimer.tsx` | import + rendu RSC | ✓ WIRED | Ligne 19 : `import { Disclaimer }` ; ligne 44 : `<Disclaimer />` |
| `Footer.tsx` | `legal/[doc]/page.tsx` | Link i18n/navigation vers /legal/{doc} | ✓ WIRED | `@/i18n/navigation` utilisé, DOCS mappés via `.map((doc) => <Link href={\`/legal/\${doc}\`}>`) |
| `tarifs/page.tsx` | `/signup` (actions.ts) | CTA Button > Link href="/signup" | ✓ WIRED | Ligne 53 (carte 1) + ligne 75 (carte 2) : `<Link href="/signup">` |
| `actions.ts` (signUp) | `/paiement-bientot` | redirect après signup réussi | ✓ WIRED | Ligne 53 : `redirect({ href: '/paiement-bientot', locale })` — invariant P1 `getUser()` non touché, aucune occurrence de `getSession` dans le diff auth |
| `layout.tsx` | `ThemeProvider.tsx` | wrapper autour de NextIntlClientProvider | ✓ WIRED | Ligne 19 : import ThemeProvider ; ligne 50 : `<ThemeProvider attribute="class" defaultTheme="light" enableSystem>` |
| `layout.tsx` | `lib/fonts.ts` | className body variables de police | ✓ WIRED | Ligne 22 : `import { inter, ibmPlexArabic }` ; ligne 49 : `className={\`\${inter.variable} \${ibmPlexArabic.variable}\`}` |

---

### Trace de Flux de Données (Niveau 4)

| Artefact | Variable de données | Source | Données réelles | Statut |
|----------|---------------------|--------|-----------------|--------|
| `Disclaimer.tsx` | `t('footer')` | namespace `disclaimer` — fr/en/ar.json | Texte i18n statique (correct — contenu éducatif figé) | ✓ FLOWING |
| `tarifs/page.tsx` | `t('plan1Price')`, `t('plan2Price')` | namespace `pricing` — fr/en/ar.json | « 9 $ / mois » / « 3 $ / 7 jours » (données de produit fixes, pas DB — correct pour P2) | ✓ FLOWING |
| `home/page.tsx` | `t('heroTitle')`, `SHOW_PROOF` | namespace `home` — fr/en/ar.json | Textes marketing sans chiffre de perf ; proof slot = `false` | ✓ FLOWING |

---

### Vérifications Comportementales (Spot-Checks Statiques)

| Comportement | Vérification | Résultat | Statut |
|---|---|---|---|
| Invariant P1 getUser() jamais getSession() | `grep getSession` dans tous les fichiers src | Zéro occurrence de `getSession` dans actions.ts ; seul `getUser()` référencé dans les commentaires et middleware | ✓ PASS |
| legal-gate.ts default-deny strict | `grep "=== 'true'"` dans legal-gate.ts | 1 occurrence — comparaison stricte confirmée | ✓ PASS |
| Allowlist legal + notFound() | grep `notFound` dans legal/[doc]/page.tsx | `DOCS.includes()` vérifié AVANT tout rendu, puis `notFound()` | ✓ PASS |
| Zéro classe physique RTL dans nouveaux composants | grep `ml-\|mr-\|pl-\|pr-\|text-left\|text-right` sur Disclaimer.tsx, Footer.tsx, home page.tsx, tarifs page.tsx, paiement-bientot page.tsx | Zéro résultat | ✓ PASS |
| Zéro vert/rouge décoratif (D-04) | grep `text-green\|bg-green\|text-red\|bg-red` sur pages marketing | Zéro résultat | ✓ PASS |
| Zéro dangerouslySetInnerHTML | grep `dangerouslySetInnerHTML` sur pages marketing | Zéro résultat | ✓ PASS |
| Zéro %/garanti/profit dans messages marketing | grep sur fr/en/ar.json namespaces home/pricing/paiement | Seul occurrence : « take-profits » dans heroLede — filtré explicitement par `stripAllowed()` dans no-perf-claims.test.ts | ✓ PASS |
| Versions exactes épinglées (pas de ^) | grep next-themes/lucide-react/@fontsource dans package.json | `"next-themes": "0.4.6"`, `"lucide-react": "1.18.0"`, `"@fontsource/ibm-plex-sans-arabic": "5.2.9"` — versions exactes | ✓ PASS |
| suppressHydrationWarning sur html | grep dans layout.tsx | Ligne 47 : `suppressHydrationWarning` présent | ✓ PASS |
| hasLocale/notFound invariant P1 | grep dans layout.tsx | `hasLocale` ligne 37, `notFound()` ligne 38 — inchangés | ✓ PASS |
| Un seul <html dans layout.tsx | grep `<html` | 1 occurrence à la ligne 44 | ✓ PASS |

---

### Exécution des Probes

Step 7c : SKIPPED — aucun probe script déclaré pour cette phase (`scripts/*/tests/probe-*.sh` inexistant). Les vérifications comportementales couvrent les comportements clés par grep statique.

---

### Couverture des Exigences

| Exigence | Plan source | Description | Statut | Preuve |
|----------|-------------|-------------|--------|--------|
| VITR-01 | 02-01, 02-03 | Page d'accueil trilingue, présentation produit, CTA | ✓ SATISFIED | `(marketing)/page.tsx` : hero, méthode, aperçu tarifs, CTA → /tarifs, 3 langues |
| VITR-02 | 02-03 | Page tarifs (9$/mois + 3$/7j, usage unique, USDT TRC-20) + parcours abonnement | ✓ SATISFIED | `tarifs/page.tsx` + `paiement-bientot/page.tsx` + redirect dans `actions.ts` |
| VITR-03 | 02-02, 02-03 | Zéro promesse de gain, disclaimers présents sur vitrine 3 langues | ✓ SATISFIED | `Disclaimer.tsx` en footer global, test `no-perf-claims.test.ts`, zéro % dans messages marketing |
| LEGAL-01 | 02-02 | Disclaimers éducatifs présents sur vitrine + membre + Telegram | ✓ SATISFIED | `Disclaimer.tsx` RSC réutilisable dans Footer global — P3 et P6 pourront l'importer directement |
| LEGAL-02 | 02-02 | Revue juridique complétée et tracée avant encaissement | ? HUMAN | Artefact `docs/legal/LEGAL-REVIEW.md` versionné (statut NON VALIDÉ attendu). Helper `isLegalReviewDone()` prêt pour P4. La signature juriste externe est le gate humain restant. |

---

### Anti-Patterns Détectés

| Fichier | Ligne | Motif | Sévérité | Impact |
|---------|-------|-------|----------|--------|
| Aucun | — | — | — | Zéro marqueur TBD/FIXME/XXX dans les fichiers créés par cette phase |

---

### Parité des Messages (Vérification Manuelle)

Namespaces vérifiés en fr/en/ar :

- `theme` : 3 clés (toggleLabel, light, dark) — parité confirmée
- `pricing` : 9 clés (title, plan1Title, plan1Price, plan1Usdt, plan2Title, plan2Price, plan2Note, plan2Usdt, plan2Badge, cta) — parité confirmée
- `paiement` : 2 clés (title, body) — parité confirmée
- `home` : 9 clés (heroTitle, heroLede, heroCta, methodTitle, methodBody, marketsTitle, marketsBody, pricingTeaserTitle, pricingTeaserBody, pricingTeaserCta) — parité confirmée
- `disclaimer` : 1 clé (footer) — parité confirmée
- `legal` : structure imbriquée (reviewPending, navTitle, cgu.title, cgu.navLabel, risques.title, risques.navLabel, confidentialite.title, confidentialite.navLabel, mentions.title, mentions.navLabel) — parité confirmée

---

### Vérification Humaine Requise

#### 1. Rendu visuel RTL arabe + bascule de thème

**Test :** Démarrer le dev server (`pnpm dev`), ouvrir `/ar`, basculer dark/light via le toggle, parcourir la home → tarifs → signup → paiement-bientot.
**Attendu :** Mise en page miroir RTL en arabe (liens à droite, texte à droite) ; prix « 9 $ / شهر » et « 3 $ / 7 أيام » non inversés (balise `<bdi>` active) ; bascule dark/light sans flash (no-FOUC) ; footer avec disclaimer arabe visible sur toutes les pages.
**Pourquoi humain :** Rendu visuel, comportement pré-paint du script next-themes, et propriétés CSS RTL non capturables par des assertions statiques ou grep.

#### 2. Revue juridique externe et sign-off (LEGAL-02 — gate non-code)

**Test :** Fournir `docs/legal/LEGAL-REVIEW.md` à un juriste externe. Vérifier que toutes les cases de la checklist sont cochées, puis apposer la signature datée dans la section « Sign-off ». Seulement après cela : poser `LEGAL_REVIEW_DONE=true` en production (jamais en dev/CI).
**Attendu :** Statut passe de « NON VALIDÉ » à validé avec date et nom du juriste. La variable d'environnement active le gate P4 pour le premier encaissement.
**Pourquoi humain :** Gate non-code impliquant un juriste externe — hors portée de tout outil automatisé. Bloque P4, PAS la livraison de code de P2.

---

### Résumé des Gaps

Aucun gap bloquant. Toutes les exigences code sont satisfaites.

Les 2 items en vérification humaine sont :
1. Un contrôle visuel/UX (rendu RTL + no-FOUC) — classique fin de phase
2. Le gate LEGAL-02 (revue juriste externe) — explicitement documenté comme gate manuel dans le PLAN et le CONTEXT, et qui bloque P4 (pas P2)

---

_Vérifié : 2026-06-14_
_Vérificateur : Claude (gsd-verifier)_
