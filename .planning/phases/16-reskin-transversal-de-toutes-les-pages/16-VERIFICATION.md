---
phase: 16-reskin-transversal-de-toutes-les-pages
verified: 2026-06-23T12:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Vérifier visuellement que la landing affiche bien la palette green DS v3 (sans toggle volt)"
    expected: "Page d'accueil dark vert néon, aucun bouton de bascule de thème visible"
    why_human: "La logique toggle est supprimée mais le rendu final dépend du CSS live — impossible à prouver par grep seul"
  - test: "Vérifier que les pastilles de fraîcheur (feux verts/amber/rouge) de /admin et /admin/sante s'affichent colorées"
    expected: "Dot vert = couleur --signal-bullish, dot amber = --risk-moderate, dot rouge = bg-destructive — toutes affichées"
    why_human: "La syntaxe bg-[var(--token)] est maintenant correcte, mais le rendu dépend de la résolution CSS en runtime"
  - test: "Vérifier la police des titres <h1> sur /abonnement, /signaux et /signaux/[id]"
    expected: "Les titres s'affichent avec la police display (Archivo), cohérente avec les autres pages"
    why_human: "font-heading est utilisé sur ces 3 pages mais --font-heading n'est pas déclaré dans globals.css — risque de fallback silencieux sur Space Grotesk au lieu d'Archivo"
  - test: "Vérifier que le data-rain est visible (subtil) sur /login et /signup, absent sur /dashboard, /abonnement, /signaux"
    expected: "Voile ambiant très subtil sur les pages auth seulement — zéro sur les surfaces denses"
    why_human: "Wiring vérifié par grep mais le rendu visuel du composant DataRain dépend du canvas/DOM en runtime"
  - test: "Vérifier que le glow sur la carte vedette de /tarifs et sur les SignalCards s'affiche"
    expected: "Halo box-shadow vert néon discret sur la carte Standard + les cartes signaux"
    why_human: "glowClass() produit une classe shadow-[…] arbitraire Tailwind v4 — le rendu visuel dépend de la compilation CSS"
---

# Phase 16 : Reskin transversal de toutes les pages — Rapport de vérification

**Phase Goal:** Repeindre toutes les surfaces existantes de la plateforme sur le DS v3 dark néon figé, d'un seul passage, en préservant intégralement le gating RLS, l'i18n/RTL, les disclaimers et les garde-fous textuels.
**Verified:** 2026-06-23T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Vitrine publique (accueil, tarifs, méthodologie, légal) au DS dark néon, trilingue AR-RTL/EN/FR, Disclaimer et no-perf-claims préservés | VERIFIED | `data-theme="green"` figé dans NexaLanding.tsx:59 ; `<Disclaimer />` dans tarifs+méthodologie+académie ; glowClass Tier 1 sur tarifs ; volt-orphan-free GREEN ; no-perf-claims GREEN |
| 2 | Auth (login/signup), compte/abonnement, espace membre (liste signaux + détail trade + chart lwc) et pages paiement/funnel au DS dark néon, gating RLS et isolation anti-IDOR inchangés (fetch RLS jamais migré vers le client) | VERIFIED | createClient() anon + RLS bytes-identiques dans signaux/page.tsx + signaux/[id]/page.tsx ; rls-unchanged gate GREEN (3/3) ; aucun admin-service importé hors (admin)/** ; lwc-recolor-intact GREEN (3/3) ; glowClass sur login/signup/SignalCard/signaux/[id] header |
| 3 | Académie (index + article + cours/leçon) et back-office /admin au DS dark néon, RTL et fallback FR préservés sur l'Académie | VERIFIED | FallbackBanner présent dans [slug]/page.tsx (3 occurrences) ; glowClass sur ContentCard ; DOT_CLASS admin = bg-[var(--signal-bullish)]/bg-[var(--risk-moderate)] (sante:67-68, admin/page:56-57) ; aucune propriété physique dans admin (ml-2→ms-2, text-right→text-end) |
| 4 | Scan prouve qu'aucune page ne réintroduit de % non mesuré ni de marque MERA, et que CandleChart est recoloré via l'API JS lwc (pas de CSS bespoke) | VERIFIED | no-perf-claims GREEN (5/5) ; no-mera-brand GREEN ; lwc-recolor-intact affirme getComputedStyle/applyOptions/MutationObserver intacts dans CandleChart.tsx ; zéro candle color littérale |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/styles/__tests__/theme-scan.test.ts` | Étendu avec surfaces wave-2 (FOUNDATION_FILES) + FORBIDDEN_PALETTE résiduel | VERIFIED | 14 entrées dans FOUNDATION_FILES (9 Phase 15 + 5 Phase 16) ; text-red-600/bg-emerald-500/bg-amber-500 ajoutés à FORBIDDEN_PALETTE |
| `apps/web/src/styles/__tests__/rls-unchanged.test.ts` | Scan structurel : pas de service_role/admin-service sur pages non-admin | VERIFIED | Fichier présent, substantiel (120 lignes), allowlist des 2 Server Actions, stripComments(), GREEN (3/3) |
| `apps/web/src/styles/__tests__/lwc-recolor-intact.test.ts` | Affirme getComputedStyle/applyOptions/MutationObserver + zéro couleur littérale | VERIFIED | Fichier présent (80 lignes), assertions exactes, GREEN (3/3) |
| `apps/web/src/styles/__tests__/volt-orphan-free.test.ts` | Zéro orphelin volt sous apps/web/src (hors fichiers de test) | VERIFIED | Scan en place ; data-theme="volt"/nxl-theme-toggle/nexa-landing-theme absents du code applicatif (les 9 occurrences grep sont dans le fichier de test lui-même) |
| `apps/web/src/components/ui/glow.tsx` | Primitive Tier-2 box-shadow var(--glow), jamais ring-* | VERIFIED | Fichier présent (62 lignes) ; GLOW_SHADOW = 3 recettes box-shadow var(--glow) uniquement ; export glowClass() + Glow composant |
| `apps/web/src/components/ui/data-rain.tsx` | Primitive ambiante tokenisée, reduced-motion double-gardé, signal-bullish/bearish | VERIFIED | Fichier présent (81 lignes) ; CSS dans globals.css via color-mix(var(--signal-bullish)/--signal-bearish) ; prefers-reduced-motion en CSS (globals.css:244,299,364,426) ET JS guard (reduced=true → pas de durée d'animation) |
| `apps/web/src/components/landing/NexaLanding.tsx` | data-theme="green" figé, toggle supprimé | VERIFIED | Ligne 59 = `data-theme="green"` ; aucun nxl-theme-toggle dans l'arbre applicatif |
| `apps/web/src/app/(admin)/page.tsx` | DOT_CLASS bg-[var(--signal-bullish)] / bg-[var(--risk-moderate)] | VERIFIED | Lignes 55-58 : syntaxe var() correcte — fix CR-01 appliqué (commit 60d3d0e) |
| `apps/web/src/app/(admin)/sante/page.tsx` | DOT_CLASS bg-[var(--signal-bullish)] / bg-[var(--risk-moderate)] | VERIFIED | Lignes 66-70 : syntaxe var() correcte — fix CR-01 appliqué (commit 60d3d0e) |
| `apps/web/src/components/academie/FallbackBanner.tsx` | FR fallback banner préservée, tokenisée | VERIFIED | Importée dans [slug]/page.tsx (3 points d'injection intacts) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| NexaLanding.tsx | nexa-landing.css branche green | data-theme="green" | WIRED | Ligne 59 : `<div className="nxl" data-theme="green">` |
| tarifs/page.tsx | glowClass() + Disclaimer | import + render | WIRED | Import glowClass (ligne 27) ; render Disclaimer (ligne 90) ; glowClass sur carte vedette (ligne 46) + CTA (ligne 58) |
| login/signup pages | DataRain + glowClass | import + render | WIRED | DataRain importé et rendu sur login (l.12, l.30) et signup (l.12, l.27) ; glowClass sur submit button |
| signaux/page.tsx | lib/supabase/server createClient + fetchActiveSignals | RLS server-side | WIRED | Lignes 17-41 : createClient() + fetchActiveSignals() côté serveur, inchangés |
| signaux/[id]/page.tsx | createClient() anti-IDOR + CandleChart | RLS server-side + lwc API | WIRED | createClient() ligne 117 ; glowClass sur card header (l.176) ; CandleChart non touché |
| ContentCard.tsx | glowClass() | import + className | WIRED | Import ligne 21 ; `glowClass('soft')` dans className (ligne 60) |
| SignalCard.tsx | glowClass() | import + className | WIRED | Import ligne 18 ; `glowClass('soft')` dans className (ligne 80) |
| (admin)/sante/page.tsx | globals.css --signal-bullish/--risk-moderate | bg-[var(--token)] | WIRED | DOT_CLASS utilise la forme var() correcte — fix CR-01 confirmé |
| academie/[slug]/page.tsx | FallbackBanner | import + render conditionnel | WIRED | 3 points d'injection conditionnels (lignes 92, 177 + leçon 71) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| signaux/page.tsx | signaux (data from fetchActiveSignals) | lib/supabase/server createClient + RLS | Oui — requête DB réelle via anon+RLS | FLOWING |
| signaux/[id]/page.tsx | tradeSetup | createClient() + from('trade_setups') | Oui — requête DB réelle | FLOWING |
| (admin)/page.tsx | DashboardKpis | createAdminServiceClient() + from('subscriptions')/'payments'/'v_data_freshness' | Oui — requêtes DB réelles | FLOWING |
| DataRain (login/signup) | Décoratif (RAIN_POOL constant) | Module local (pas de fetch) | Statique intentionnel (ambiant) | FLOWING |
| glow.tsx | Pas de data | Style CSS uniquement | N/A | N/A |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED pour le rendu visuel (requiert un navigateur). Les vérifications programmatiques (grep, lecture de fichiers) ont confirmé le wiring. Les checks visuels sont routés vers Human Verification Required.

---

### Probe Execution

Step 7c: Aucun probe-*.sh déclaré pour la Phase 16 (reskin CSS/markup only). Les gates fonctionnent via les tests Vitest (rls-unchanged, lwc-recolor-intact, volt-orphan-free, theme-scan) dont les résultats sont documentés dans les SUMMARYs.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RESKIN-01 | 16-02-PLAN | Vitrine publique (accueil, tarifs, méthodologie, légal) au DS dark néon, trilingue | SATISFIED | landing green-only + tarifs/méthodologie/légal tokenisés Tier 1 |
| RESKIN-02 | 16-03-PLAN | Auth (login/signup) + compte/abonnement au DS dark néon | SATISFIED | login/signup avec glowClass+DataRain ; abonnement avec filet --primary ; rls-unchanged GREEN |
| RESKIN-03 | 16-03-PLAN | Espace membre (signaux + détail + chart lwc) au DS dark néon, gating RLS préservé | SATISFIED | SignalCard/signaux/[id] tokenisés ; fetch bytes-identique ; CandleChart verbatim |
| RESKIN-04 | 16-04-PLAN | Académie (index + article + cours/leçon) au DS dark néon, RTL + fallback FR préservés | SATISFIED | ContentCard glowClass ; FallbackBanner intact ; propriétés logiques |
| RESKIN-05 | 16-04-PLAN | Back-office /admin au DS dark néon | SATISFIED | DOT_CLASS tokenisés sante+admin/page ; membres/affilies logiques ; Tier 3 sober zéro effet |
| RESKIN-06 | 16-03-PLAN | Pages paiement/funnel au DS dark néon | SATISFIED | paiement-bientot + affiliation + dashboard : filet --primary Tier 2 |

**Couverture :** 6/6 requirements RESKIN vérifiés.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/app/(admin)/affiliation/page.tsx` | 101 | `bg-[--risk-moderate]` (sans var()) | Warning | Pre-existing Phase 15 — hors scope Phase 16 |
| `apps/web/src/app/(admin)/affiliation/payouts/page.tsx` | 130 | `bg-[--risk-moderate]` (sans var()) | Warning | Pre-existing Phase 15 — hors scope Phase 16 |
| `apps/web/src/app/(admin)/file/page.tsx` | 121 | `bg-[--risk-moderate]` (sans var()) | Warning | Pre-existing Phase 15 — hors scope Phase 16 |
| `apps/web/src/app/(admin)/signaux/page.tsx` | 197 | `bg-[--signal-bullish]` (sans var()) | Warning | Pre-existing Phase 15 — hors scope Phase 16 |
| `apps/web/src/app/[locale]/affiliation/dashboard/page.tsx` | 203 | `text-[--risk-moderate]` (sans var()) | Warning | Pre-existing Phase 15 — hors scope Phase 16 |
| `apps/web/src/app/[locale]/(account)/abonnement/page.tsx` | 59 | `font-heading` (--font-heading non déclaré) | Warning | WR-04 du code review — police h1 tombe sur Space Grotesk au lieu d'Archivo |
| `apps/web/src/app/[locale]/(member)/signaux/page.tsx` | 47 | `font-heading` (--font-heading non déclaré) | Warning | WR-04 — même défaut |
| `apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx` | 180 | `font-heading` (--font-heading non déclaré) | Warning | WR-04 — même défaut |
| `apps/web/src/components/ui/data-rain.tsx` | 55-61 | `innerHTML` avec string concatenation | Warning | WR-01 du code review — latent XSS surface si pool devient paramétrique (pas exploitable aujourd'hui) |

**Note :** Aucun BLOCKER. Le fix CR-01 (commit 60d3d0e) a correctement résolu le seul BLOCKER identifié par le code review sur les deux fichiers Phase 16 (`(admin)/page.tsx` + `sante/page.tsx`). Les patterns `bg-[--token]` restants sont tous dans des fichiers pre-existing non touchés par Phase 16 (identifiés explicitement comme tech debt hors scope dans la consigne de vérification).

---

### Human Verification Required

#### 1. Rendu visuel de la landing green-only

**Test:** Ouvrir la page d'accueil en navigateur — vérifier l'identité dark green néon et l'absence de tout bouton de bascule de thème.
**Expected:** Fond sombre, accent vert néon (--primary), aucun toggle Green/Volt visible.
**Why human:** Suppression du toggle vérifiée par grep mais le rendu CSS live ne peut pas être prouvé programmatiquement.

#### 2. Affichage des pastilles de fraîcheur admin

**Test:** Se connecter en superadmin, ouvrir /admin et /admin/sante — vérifier que les feux de fraîcheur s'affichent en couleur (vert/amber/rouge).
**Expected:** Pastille verte = vert néon (--signal-bullish), amber = orange (--risk-moderate), rouge = rouge (--destructive). Les pastilles ne sont PAS grisées/sans couleur.
**Why human:** La syntaxe `bg-[var(--token)]` est correcte dans le code, mais la résolution des custom properties dépend du runtime CSS.

#### 3. Cohérence de la police des titres h1

**Test:** Comparer la typographie du h1 sur /tarifs (font-display) vs /abonnement et /signaux (font-heading non déclaré).
**Expected:** Idéalement, tous les h1 devraient afficher la même police (Archivo). Si font-heading → Space Grotesk (fallback), c'est une incohérence visuelle.
**Why human:** WR-04 identifié par le code review — --font-heading absent de globals.css → fallback silencieux impossible à différencier par grep.

#### 4. Data-rain et glow sur les surfaces cibles

**Test:** Vérifier la présence du voile ambiant sur /login et /signup, et son absence sur /dashboard, /abonnement, /signaux. Vérifier le halo sur la carte vedette de /tarifs et sur les SignalCards.
**Expected:** Voile très subtil (opacity=0.18) sur auth seulement. Halo box-shadow vert néon sur tarifs/SignalCard/login CTA.
**Why human:** Wiring confirmé par grep mais le rendu visuel dépend du canvas DOM (DataRain) et de la compilation Tailwind v4 arbitrary shadow (glowClass).

#### 5. RTL arabe — propriétés logiques effectives

**Test:** Basculer la locale sur /ar, vérifier que les pages reskinées (tarifs, académie, signaux) s'affichent correctement en RTL.
**Expected:** Texte aligné à droite, marges logiques (ps/pe) inversées correctement en RTL.
**Why human:** Les propriétés logiques sont vérifiées par grep mais le comportement RTL réel dépend du navigateur avec `dir="rtl"`.

---

### Gaps Summary

Aucun gap bloquant. Les 4 truths observables sont VERIFIED. Le CR-01 (seul BLOCKER du code review) a été résolu dans le commit 60d3d0e. Les anti-patterns restants sont soit pre-existing tech debt hors scope Phase 16, soit des WARNINGs cosmétiques (WR-01 à WR-04).

**Éléments ouverts non bloquants :**
- **WR-04 font-heading** : 3 pages utilisent `font-heading` au lieu de `font-display` sur leurs h1 — la police tombe silencieusement sur Space Grotesk (body). Corriger en remplaçant `font-heading` par `font-display` sur abonnement/page.tsx, signaux/page.tsx et signaux/[id]/page.tsx.
- **WR-01 innerHTML** : data-rain.tsx utilise innerHTML pour injecter les colonnes — acceptable aujourd'hui (RAIN_POOL est constant), mais à refactorer en createElement() si le pool devient paramétrique.
- **Tech debt pre-existing** : 5 fichiers Phase 15 portent encore `bg-[--token]` sans var() — à corriger dans une prochaine phase de nettoyage.

---

_Verified: 2026-06-23T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
