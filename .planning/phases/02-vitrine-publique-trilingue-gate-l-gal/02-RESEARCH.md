# Phase 2 : Vitrine publique trilingue & gate légal — Research

**Researched:** 2026-06-14
**Domain:** Vitrine marketing Next.js 15 App Router · i18n trilingue (next-intl 4.13) · RTL arabe · design system Tailwind v4 CSS-first + shadcn/ui · gate juridique non-code (artefact versionné + flag lu par P4)
**Confidence:** HIGH (stack verrouillée et lue dans le repo ; next-intl/Tailwind v4/next-themes recoupés docs + repo ; le seul point MEDIUM = mécanisme exact du flag `legal_review_done`, tranché ci-dessous avec recommandation)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 .. D-16 — verbatim CONTEXT.md)

**Identité visuelle & design system (reporté de P1)**
- **D-01 :** Ton de marque = finance sérieuse & crédible (institutionnel, sobre, inspire confiance/discipline). Cible MENA intermédiaire méfiante des arnaques.
- **D-02 :** Toggle dark/light (les deux thèmes, bascule utilisateur). Tokens couleur définis pour les deux modes ET validés en RTL (arabe).
- **D-03 :** Police arabe self-hostée via `next/font/local` (ex. IBM Plex Sans Arabic ou Noto Sans Arabic, fichiers dans le repo). Zéro CDN au runtime. Résout IN-01.
- **D-04 :** Palette = bleu de marque + vert/rouge réservés à la sémantique de trading. Le vert/rouge ne sert JAMAIS à la déco. (En P2 : aucun widget trading → vert/rouge ABSENTS.)

**Page d'accueil (VITR-01)**
- **D-05 :** Structure = parcours de conversion complet : hero → « Comment ça marche » → preuve → aperçu tarifs → disclaimers en pied.
- **D-06 :** Pitch = bénéfice d'abord en hero (« décidez avec discipline : chaque opportunité notée /100, niveau de risque, plan entrée/SL/TP clair »), méthode détaillée en section (« IA vétéran combinant technique + fondamental + news »).
- **D-07 :** CTA principal du hero = « S'abonner / Voir les tarifs » → `/[locale]/tarifs`.
- **D-08 :** ⛔ Aucune allégation de performance sur la home en P2. Section % masquée jusqu'à Phase 5. Construire la structure pour accueillir le slot plus tard, sans afficher de chiffre. Aucun pourcentage inventé (« 90% » écarté).

**Funnel d'abonnement (VITR-02 — paiement réel = P4)**
- **D-09 :** Funnel P2 = tarifs → signup → écran honnête « paiement disponible très bientôt ». Pas de flux de paiement, pas d'adresse USDT factice.
- **D-10 :** Prix = USD + mention « payable en USDT (TRC-20) ».
- **D-11 :** ⚠️ Offre = `9 $/mois` OU `3 $/7 jours` (découverte, utilisable une seule fois). REMPLACE le `3 $/15 j` de REQUIREMENTS/ROADMAP (incohérence doc à corriger). Enforcement « une seule fois » = P4 (PAY-06) ; P2 affiche seulement.
- **D-12 :** Tarifs publics (visibles par tout visiteur) ; création de compte requise seulement au clic « s'abonner ».

**Disclaimers & gate juridique (VITR-03, LEGAL-01, LEGAL-02)**
- **D-13 :** Placement disclaimers = disclaimer court permanent en footer global (toutes pages) + pages légales dédiées. Composant `<Disclaimer>` réutilisable transverse (vitrine + espace membre P3 + Telegram P6).
- **D-14 :** Pages légales = bundle complet : CGU/Conditions + Avertissement sur les risques + Politique de confidentialité + Mentions légales. Le juriste tranchera la liste définitive.
- **D-15 :** Rédaction = texte légal définitif vient du juriste (source FR) → traduction professionnelle AR/EN. Le code pose la structure i18n ; jusqu'à réception, placeholders « en cours de revue juridique ». ⛔ L'IA n'invente PAS de texte légal faisant foi.
- **D-16 :** Gate LEGAL-02 (non-code) = double mécanisme : (1) artefact versionné `LEGAL-REVIEW.md` avec checklist (conseil non agréé, statut crypto Algérie/MENA, disclaimers validés, sign-off daté) ; (2) flag (env ou config DB, ex. `legal_review_done`, défaut = non validé) que le code paiement P4 vérifie avant le 1ᵉʳ encaissement en prod. P2 pose le flag + l'artefact ; P4 consomme le flag.

### Claude's Discretion (verbatim CONTEXT.md)
- Choix exact de la police arabe (IBM Plex Sans Arabic vs Noto Sans Arabic vs autre) et du couple de polices latines marque/corps.
- Définition des tokens couleur/typo Tailwind v4 (CSS-first) pour les deux thèmes, et des composants shadcn/ui à étoffer (branche Tailwind v4 + React 19).
- Architecture des pages marketing sous `[locale]/(marketing)` et structure des namespaces (`home`, `legal`, extension `pricing`).
- Forme exacte du flag `legal_review_done` (env vs ligne config DB) — à arbitrer selon ce que P4 lira le plus simplement.
- Emplacement exact de `LEGAL-REVIEW.md` (`.planning/` vs `docs/legal/`).
- Métriques réelles factuelles optionnelles sur la home (nb d'analyses, marchés couverts, R:R moyen visé) — peuvent enrichir la preuve sans allégation de perf (à proposer si la home paraît vide sans le % masqué).

### Deferred Ideas (OUT OF SCOPE — verbatim CONTEXT.md)
- Affichage du % de réussite mesuré (slot construit mais masqué) → Phase 5.
- Flux de paiement réel + adresse USDT + vérification on-chain → Phase 4 (P2 s'arrête à « paiement bientôt »).
- Équivalent prix en DZD/devise locale → non retenu (taux de change à maintenir).
- Métriques réelles factuelles sur la home → optionnel, à proposer au planning.
- Consentement cookies / bannière RGPD-like → non discuté ; à évaluer si analytics futurs.
- **Action requise (cohérence docs) :** mettre à jour `REQUIREMENTS.md` (VITR-02) et `ROADMAP.md` (Phases 2 & 4) : remplacer `3 $/15 j` par `3 $/7 j, utilisable une seule fois` (D-11).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|----|------------------------------|------------------|
| VITR-01 | Page d'accueil présentant produit + appel à l'abonnement, dans la langue du visiteur. *(Sous-clause « % mesuré » → P5, slot masqué, D-08.)* | §Architecture Patterns (home sections RSC + setRequestLocale) ; §Code Examples (home page + proof slot masqué via flag) ; namespace `home` |
| VITR-02 | Page tarifs (9 $/mois + 3 $/7 j une seule fois) + démarrage du parcours d'abonnement. | §Code Examples (pricing cards, CTA → signup→« paiement bientôt ») ; extension namespace `pricing` ; D-09/D-10/D-11/D-12 |
| VITR-03 | Aucune promesse de gain + disclaimers légaux présents. | §Pitfalls (P1 promesses de gain) ; §Code Examples (`<Disclaimer>`) ; proof slot SANS chiffre (D-08) |
| LEGAL-01 | Disclaimers « éducatif / pas un conseil / aucune promesse » sur vitrine + espace membre + Telegram. | §Architecture (composant `<Disclaimer>` transverse réutilisable) ; namespace `legal`/`disclaimer` ; footer global au `[locale]/layout` |
| LEGAL-02 | Revue juridique (conseil non agréé + crypto Algérie/MENA) complétée et tracée AVANT 1ᵉʳ encaissement prod (gate non-code). | §Gate LEGAL-02 (mécanisme tranché : `LEGAL-REVIEW.md` versionné + flag `legal_review_done` env, défaut false, lu par P4) |
</phase_requirements>

## Summary

La Phase 2 est **majoritairement du front marketing + design system**, posée sur un socle i18n/RTL/gating **déjà livré et vérifié** (Phase 1, 11/11 menaces closes). Le travail technique réel se concentre sur trois axes : (1) **initialiser le design system de marque** (tokens Tailwind v4 CSS-first deux thèmes, `next-themes`, polices self-hostées via `next/font/local`, shadcn/ui v4) — explicitement reporté de P1 ; (2) **construire les pages marketing trilingues** (home, tarifs étoffés, écran post-signup, pages légales placeholder) en réutilisant `[locale]/(marketing)`, le layout locale, le `LanguageSwitcher`, et le check CI anti-chaîne-en-dur ; (3) **poser le gate juridique non-code** : un artefact `LEGAL-REVIEW.md` versionné + un flag `legal_review_done` (défaut = non validé) que la Phase 4 lira avant d'autoriser le 1ᵉʳ encaissement.

Le risque dominant n'est **pas technique** mais **conformité** : la vitrine ne doit afficher AUCUNE allégation de performance (D-08 / VITR-03 / Pitfall 8), et le texte légal faisant foi doit venir d'un juriste, pas de l'IA (D-15). Le code pose donc des **placeholders marqués** et une **structure i18n** prête à recevoir la traduction professionnelle. Le second risque est le **RTL** : tout nouveau composant doit utiliser les propriétés logiques natives Tailwind v4 (`ms`/`me`/`ps`/`pe`/`start`/`end`) dès la première ligne — un refactor tardif serait massif (Pitfall 11 / AP4).

**Primary recommendation :** Initialiser le design system (Wave 0) AVANT toute page → puis poser pages marketing trilingues + `<Disclaimer>` global → puis pages légales placeholder → en parallèle (non-code) lancer la revue juriste et matérialiser `LEGAL-REVIEW.md` + flag `legal_review_done=false`. Aucun chiffre de performance, aucune adresse USDT, vert/rouge bannis.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rendu pages marketing (home/tarifs/légales) | Frontend Server (RSC, SSG via `setRequestLocale`) | — | Pages publiques statiques, lecture seule, zéro donnée métier → RSC statique, perf max, indexable |
| Résolution locale + RTL `dir` | Frontend Server (`[locale]/layout` + middleware next-intl) | Browser (CSS logical props) | Locale vient de l'URL (résolue serveur, déjà livré P1) ; l'inversion visuelle est CSS au navigateur |
| Toggle thème dark/light | Browser (next-themes, `class` sur `<html>`) | Frontend Server (suppressHydrationWarning + no-flash) | Préférence utilisateur persistée client ; SSR doit éviter le flash via attribut posé avant paint |
| Polices (Latin + Arabe self-hostées) | Frontend Server (`next/font/local` au layout) | CDN/Static (assets servis depuis le repo, zéro CDN runtime — D-03) | `next/font` inline les `@font-face` et self-host les fichiers → zéro requête CDN au runtime |
| Strings UI trilingues | Frontend Server (next-intl messages JSON) | — | Boutons/labels = `messages/{fr,en,ar}.json` (mécanisme distinct du contenu DB) |
| Disclaimer transverse | Frontend Server (composant `<Disclaimer>` RSC) | — | Réutilisé vitrine + espace membre (P3) + posts Telegram (P6) → composant unique source de vérité |
| Funnel signup → « paiement bientôt » | Frontend Server (réutilise wiring auth P1) + Browser (form) | — | Aucune écriture métier ; signup réutilise l'auth existant ; écran final statique |
| Gate légal (artefact + flag) | **Repo (artefact versionné) + Config (env var)** | DB (alternative écartée, voir §Gate) | Non-code : traçabilité = fichier en git ; le flag doit être lisible par P4 → env var simple > row DB |

## Standard Stack

> **Stack cœur VERROUILLÉE et installée** (CLAUDE.md §Technology Stack, package.json lu) : Next.js 15, React 19.2, next-intl 4.13.0, Tailwind 4.3.1 + @tailwindcss/postcss 4.3.1, @supabase/ssr 0.12.0, @supabase/supabase-js 2.108.0, Zod 4.4.3. **Ne PAS re-rechercher ni changer.** Ci-dessous = uniquement les ajouts P2 (design system).

### Core (ajouts P2)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next-themes` | `0.4.6` [VERIFIED: npm registry] | Toggle dark/light (D-02), `class` strategy, persistance, no-flash SSR | Standard de facto Next App Router pour le theming `class`. ~24M dl/sem. Compatible React 19 / Tailwind v4. Repo officiel `pacocoursey/next-themes`, aucun postinstall. |
| `lucide-react` | `1.18.0` [VERIFIED: npm registry] | Icônes line sobres (toggle thème, chevrons, AlertCircle form, légal) | Défaut shadcn/ui, ton institutionnel. ~85M dl/sem. ⚠️ **Major jump** : training connaît 0.x ; v1.18.0 publié 2026-06-12 — API stable (named imports), vérifier le nom exact des icônes utilisées. |

### Supporting (police arabe — Claude's Discretion D-03)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fontsource/ibm-plex-sans-arabic` | `5.2.9` [VERIFIED: npm registry] | Fichiers `.woff2` IBM Plex Sans Arabic à self-host via `next/font/local` | **Recommandé pour D-03** : récupère les fichiers de police via npm (versionnés, pas de CDN), puis les charger avec `next/font/local`. Évite le téléchargement manuel. Alternative : déposer les `.woff2` directement dans `apps/web/src/fonts/`. |
| `Inter` (latin) | via `next/font/google` (build-time self-host) OU `@fontsource-variable/inter` | Police latine institutionnelle, lisibilité des prix USD (UI-SPEC) | `next/font/google` self-host AU BUILD (zéro CDN runtime, conforme D-03 esprit). Si l'on veut zéro accès Google même au build → `@fontsource-variable/inter` (fichiers en repo). |

**Décision recommandée police arabe :** **IBM Plex Sans Arabic** (UI-SPEC le verrouille déjà : pairing visuel avec Inter, interlignage généreux pour diacritiques) via `@fontsource/ibm-plex-sans-arabic@5.2.9` → `next/font/local`. Cela **remplace** le placeholder `--font-arabic: "Noto Sans Arabic"` de `globals.css` (D-01-02-C). [CITED: 02-UI-SPEC.md §Design System]

### shadcn/ui (composants copiés — pas versionné npm)
| Choix | Détail |
|-------|--------|
| **shadcn/ui branche Tailwind v4 / React 19** | NON initialisé (UI-SPEC `shadcn_initialized: false`). Tâche planner : `npx shadcn@latest init` contre Tailwind v4 CSS-first (pas de `tailwind.config.*`, pas encore de `components.json`). Blocks P2 : `button, card, badge, dialog, form, input, label, dropdown-menu, separator` (UI-SPEC §Registry Safety, registre officiel → pas de vetting tiers). |
| **Avertissement init** | shadcn écrit `components.json` + ajoute des tokens dans `globals.css` + installe `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`. Vérifier qu'il ne casse PAS le `@theme` minimal existant ni le `:lang(ar)` de `globals.css`. **Lancer init AVANT d'écrire les tokens de marque**, puis surcharger. |

**Alternatives Considered**
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `next-themes` | Toggle maison (`localStorage` + classe) | next-themes gère le no-flash SSR + `system` + sync onglets ; un maison réintroduit le flash de thème (FOUC). Pas de raison de hand-roll. |
| `next/font/local` (police arabe) | CDN Google Fonts arabe | ⛔ Violerait D-03 (zéro CDN runtime). Exclu. |
| Inter | Geist / autre grotesque | UI-SPEC verrouille Inter (lisibilité chiffres). Discrétion mais Inter recommandé. |

**Installation :**
```bash
# apps/web — theming + icônes
pnpm --filter web add next-themes@0.4.6 lucide-react@1.18.0

# apps/web — polices self-hostées (fichiers via npm, chargés par next/font/local)
pnpm --filter web add @fontsource/ibm-plex-sans-arabic@5.2.9
pnpm --filter web add @fontsource-variable/inter   # OU next/font/google (Inter) si accès build OK

# shadcn/ui (copie de composants, installe ses deps Radix/cva/clsx/tailwind-merge)
cd apps/web && npx shadcn@latest init
npx shadcn@latest add button card badge dialog form input label dropdown-menu separator
```

**Version verification (2026-06-14, registre npm) :**
- `next-themes` 0.4.6 (modifié 2025-03-11) — stable, peu de churn (mature).
- `lucide-react` 1.18.0 (modifié 2026-06-12) — ⚠️ major récent vs training 0.x.
- `@fontsource/ibm-plex-sans-arabic` 5.2.9 — fichiers de police, pas de code exécuté.

## Package Legitimacy Audit

> slopcheck non installé dans cet environnement (pip indisponible/sandbox). Tous les paquets ci-dessous sont néanmoins **largement adoptés, à repo officiel, sans postinstall** (vérifié `npm view repository.url` + `scripts.postinstall` vide + downloads API). Conformément à AR-01-SC (Phase 1), épinglage exact des versions ; le planner DOIT poser un `checkpoint:human-verify` avant l'install (politique projet, slopcheck absent).

| Package | Registry | Age | Downloads | Source Repo | postinstall | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-------------|-----------|-------------|
| `next-themes` | npm | ~stable (2025-03) | ~24M/sem | github.com/pacocoursey/next-themes | aucun | n/a (absent) | Approved — checkpoint human-verify avant install |
| `lucide-react` | npm | actif (2026-06) | ~85M/sem | github.com/lucide-icons/lucide | aucun | n/a (absent) | Approved — checkpoint + vérifier noms d'icônes (v1 major) |
| `@fontsource/ibm-plex-sans-arabic` | npm | actif (2026-05) | famille fontsource (officiel) | github.com/fontsource/font-files | aucun | n/a (absent) | Approved — fichiers de police, pas de code |
| `@fontsource-variable/inter` | npm | actif | famille fontsource | github.com/fontsource/font-files | aucun | n/a (absent) | Approved (optionnel — sinon next/font/google) |

**Packages removed (slopcheck [SLOP]) :** aucun.
**Packages flagged [SUS] :** aucun. (slopcheck indisponible → tous traités `[ASSUMED]` côté provenance ; gate human-verify au planning.)

## Architecture Patterns

### System Architecture Diagram

```
                    Visiteur (langue navigateur / cookie NEXT_LOCALE)
                                      │
                                      ▼
                ┌──────────── middleware.ts (racine, P1, INCHANGÉ) ───────────┐
                │  handleI18n (résout locale, rewrite, cookie) → updateSession │
                └──────────────────────────────┬───────────────────────────────┘
                                                │  /[locale]/...
                                                ▼
            ┌─────────────── app/[locale]/layout.tsx (MODIFIÉ P2) ──────────────┐
            │  <html lang dir suppressHydrationWarning>                          │
            │  + next/font (Inter latin + IBM Plex Sans Arabic local)            │
            │  + ThemeProvider (next-themes, class)                              │
            │  + Header marque (logo + LanguageSwitcher + ThemeToggle)          │
            │  + NextIntlClientProvider (messages fr/en/ar)                      │
            │  {children}                                                        │
            │  + <Footer> global → <Disclaimer> (D-13, transverse)              │
            └───────────────────────────────┬───────────────────────────────────┘
                                            │
        ┌───────────────────────────────────┼────────────────────────────────────┐
        ▼                                    ▼                                     ▼
  (marketing)/page.tsx              (marketing)/tarifs/page.tsx         (marketing)/legal/[doc]/page.tsx
  HOME (VITR-01)                    PRICING (VITR-02)                   LÉGAL (LEGAL-01, D-14)
  hero → comment-ça-marche          2 cartes (9$/mois, 3$/7j)          CGU · Risques · Confidentialité · Mentions
  → PROOF (slot MASQUÉ flag D-08)   USD + « USDT (TRC-20) »            placeholder « en cours de revue juridique »
  → aperçu tarifs → footer          CTA → signup (auth au clic D-12)   (D-15, AUCUN texte faisant foi inventé)
        │                                    │
        │                                    ▼
        │                          (auth)/signup (P1, réutilisé)
        │                                    │ succès
        │                                    ▼
        └──────────────────────►  (marketing)/paiement-bientot/page.tsx (D-09)
                                   « Paiement disponible très bientôt » — AUCUNE adresse USDT, AUCUN flux

  ─────────────────────────────── GATE LÉGAL (non-code, hors flux runtime) ───────────────────────────────
  docs/legal/LEGAL-REVIEW.md (versionné, checklist + sign-off daté)  ← juriste complète (D-16.1)
  env LEGAL_REVIEW_DONE=false (défaut)                               ← P4 lira ce flag avant encaissement (D-16.2)
```

### Recommended Project Structure (greffe sur l'existant P1)
```
apps/web/src/
├── app/
│   ├── layout.tsx                         # INCHANGÉ (pass-through, P1)
│   └── [locale]/
│       ├── layout.tsx                     # MODIFIÉ : + fonts, ThemeProvider, header marque, footer Disclaimer
│       └── (marketing)/
│           ├── page.tsx                   # NOUVEAU : HOME (VITR-01) — RSC, setRequestLocale
│           ├── tarifs/page.tsx            # ÉTOFFÉ : 2 cartes prix (VITR-02)
│           ├── paiement-bientot/page.tsx  # NOUVEAU : écran post-signup (D-09)
│           └── legal/[doc]/page.tsx       # NOUVEAU : pages légales placeholder (D-14/D-15)
├── components/
│   ├── LanguageSwitcher.tsx               # EXISTANT (P1) — intégrer au header marque
│   ├── ThemeProvider.tsx                  # NOUVEAU : wrapper next-themes ('use client')
│   ├── ThemeToggle.tsx                    # NOUVEAU : bouton bascule ('use client', lucide icons)
│   ├── Disclaimer.tsx                     # NOUVEAU : composant transverse (D-13, LEGAL-01)
│   ├── Footer.tsx                         # NOUVEAU : footer global + Disclaimer + nav légale
│   └── ui/                                # NOUVEAU : composants shadcn copiés (button, card, badge…)
├── fonts/                                 # NOUVEAU : fichiers .woff2 (ou via @fontsource)
├── lib/
│   └── fonts.ts                           # NOUVEAU : next/font/local (Inter + IBM Plex Sans Arabic)
├── messages/{fr,en,ar}.json              # ÉTENDU : + namespaces home, legal, disclaimer ; pricing enrichi
└── styles/globals.css                     # MODIFIÉ : @theme tokens marque 2 thèmes + @custom-variant dark + :lang(ar)

docs/legal/
└── LEGAL-REVIEW.md                        # NOUVEAU : artefact gate (D-16.1)

.env.example                               # MODIFIÉ : + LEGAL_REVIEW_DONE=false (D-16.2)
```

### Pattern 1 : next-themes + Tailwind v4 CSS-first (toggle, no-flash)
**What :** ThemeProvider `class` strategy ; Tailwind v4 déclare le variant `dark` en CSS (pas de `tailwind.config.darkMode`).
**When :** D-02 (toggle dark/light), tokens définis pour les deux modes.
**Example :**
```css
/* globals.css — Tailwind v4 CSS-first : déclarer le variant dark (PAS de config JS) */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* tokens de marque — valeurs LIGHT (UI-SPEC §Color) */
  --color-background: #FFFFFF;
  --color-surface: #F4F6F9;
  --color-accent: #1E5FBF;
  --color-foreground: #0B1220;
  --color-muted: #5B6675;
  --color-border: #E2E7EE;
  --font-latin: var(--font-inter);          /* exposée par next/font */
  --font-arabic: var(--font-ibm-plex-arabic);
}
.dark {
  --color-background: #0B1220;
  --color-surface: #141C2B;
  --color-accent: #3B82F6;
  --color-foreground: #E6EBF2;
  --color-muted: #9AA7B8;
  --color-border: #26303F;
}
:lang(ar) { font-family: var(--font-arabic); }   /* remplace le placeholder Noto */
```
```tsx
// app/[locale]/layout.tsx — suppressHydrationWarning OBLIGATOIRE (no-flash next-themes)
<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
  <body className={`${inter.variable} ${ibmPlexArabic.variable}`}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      {/* header + NextIntlClientProvider + children + footer */}
    </ThemeProvider>
  </body>
</html>
```
[CITED: tailwindcss.com/blog/tailwindcss-v4 — @custom-variant ; next-themes README — attribute=class, suppressHydrationWarning]

### Pattern 2 : Polices self-hostées via next/font/local (D-03, zéro CDN)
**What :** Charger Inter (latin) + IBM Plex Sans Arabic (arabe) en local, exposer en variables CSS.
**When :** D-03 — zéro CDN runtime.
**Example :**
```ts
// lib/fonts.ts
import localFont from 'next/font/local'
import { Inter } from 'next/font/google'   // self-host AU BUILD (acceptable) — OU localFont sur @fontsource-variable/inter

export const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
export const ibmPlexArabic = localFont({
  src: [
    { path: '../fonts/IBMPlexSansArabic-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/IBMPlexSansArabic-SemiBold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-ibm-plex-arabic',
  display: 'swap',
})
```
> Source des `.woff2` : `node_modules/@fontsource/ibm-plex-sans-arabic/files/*.woff2` (copier dans `src/fonts/`) — versionné, pas de CDN. [CITED: nextjs.org/docs/app/building-your-application/optimizing/fonts]

### Pattern 3 : Composant `<Disclaimer>` transverse (D-13, LEGAL-01)
**What :** Un composant RSC unique, alimenté par le namespace `disclaimer`, posé au footer global + réutilisable en P3 (espace membre) et P6 (Telegram — version texte).
**When :** Toutes pages (footer) ; LEGAL-01 exige vitrine + membre + Telegram.
**Example :**
```tsx
// components/Disclaimer.tsx (RSC)
import { getTranslations } from 'next-intl/server'
export async function Disclaimer() {
  const t = await getTranslations('disclaimer')
  return <p className="text-sm text-muted ps-4 pe-4">{t('footer')}</p>  // ps/pe = RTL-safe
}
```

### Pattern 4 : Proof slot construit mais MASQUÉ (D-08)
**What :** Section « preuve » présente dans le markup de la home mais cachée jusqu'à P5 — aucun chiffre rendu.
**When :** D-08 / VITR-03 — structure prête, zéro allégation de perf.
**Example :**
```tsx
// constante locale P2 (deviendra un vrai flag/feature en P5)
const SHOW_PROOF = false   // P5 activera le track record mesuré
{SHOW_PROOF && <ProofSection />}   // n'émet AUCUN nombre tant que false
```
> ⚠️ Ne PAS rendre de `<div hidden>` contenant un faux chiffre : ne stocker AUCUN pourcentage dans le code (Pitfall 8). Le slot est une *structure de layout vide*, pas un nombre caché.

### Anti-Patterns to Avoid
- **AP4 / Pitfall 11 — i18n/RTL après coup :** poser propriétés logiques (`ms/me/ps/pe/start/end`) dès la 1ʳᵉ ligne de chaque composant. Jamais `ml/mr/pl/pr/left/right/text-left`. `grep` le nouveau code avant merge.
- **D-04 — vert/rouge décoratifs :** INTERDITS en P2 (aucun widget trading). Form-error = neutre/ambre, jamais rouge (UI-SPEC §Color).
- **D-08 — chiffre de performance inventé :** aucun `%`, aucun « 90% », même caché. Le slot est vide.
- **D-15 — texte légal inventé :** placeholders marqués « en cours de revue juridique » ; l'IA ne rédige PAS de CGU/risques faisant foi.
- **D-09 — fausse adresse USDT / faux flux paiement :** l'écran post-signup s'arrête à « bientôt ». Aucune adresse, aucun QR.
- **Chaîne en dur :** tout texte = clé `messages/*.json` (CI `lint:i18n` bloque ; nom de marque exclu via `// i18n-ignore`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toggle de thème + no-flash SSR | localStorage + classe maison | `next-themes` | Gère FOUC, `system`, sync onglets, hydration — un maison réintroduit le flash |
| Variant `dark:` Tailwind | media-query manuelle / classes conditionnelles | `@custom-variant dark` (Tailwind v4 CSS-first) | Natif v4, zéro config JS, marche avec `class` strategy de next-themes |
| RTL / inversion de layout | `tailwindcss-rtl` / `tailwindcss-logical` | Propriétés logiques natives Tailwind v4 (`ms/me/ps/pe`) | Plugins abandonnés/redondants (STACK.md). v4 inverse automatiquement selon `dir` |
| Self-host de polices | copier `@font-face` + `/public` manuel | `next/font/local` + `next/font/google` | Inline les `@font-face`, gère subsets/preload/`display`, zéro CDN runtime |
| Composants UI (button/card/badge/dialog) | composants maison | shadcn/ui (copie, branche v4) | Accessibles (Radix), themables par tokens, ton institutionnel ; déjà décidé UI-SPEC |
| Icônes | SVG maison épars | `lucide-react` | Cohérence, line-icons sobres, défaut shadcn |
| Formatage prix/nombres en arabe | concat manuelle | `Intl.NumberFormat` / next-intl ICU + `<bdi>` | Évite l'inversion RTL des montants (Pitfall 11 UX) |

**Key insight :** Quasiment tout le « plomberie » P2 (thème, RTL, polices, composants) a une solution standard verrouillée dans la stack — le code maison se limite au **contenu** (copy via messages, composition des sections, `<Disclaimer>`) et au **gate non-code**.

## Runtime State Inventory

> P2 est greenfield côté front (nouvelles pages) MAIS modifie `globals.css` (placeholder police) et introduit un **flag/artefact** que P4 lira. Inventaire ciblé sur ce qui n'est pas un simple fichier neuf.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Aucun — la vitrine est lecture seule publique, zéro écriture DB en P2 (vérifié : signup réutilise l'auth P1, pas de table métier touchée). | Aucune |
| Live service config | **Variable d'environnement `LEGAL_REVIEW_DONE`** (D-16.2) à introduire dans `.env.example` + l'environnement de prod. Ce n'est PAS dans le code — c'est de la config runtime que P4 lira. | Documenter dans `.env.example` (=false) ; poser la vraie valeur en prod après sign-off juriste |
| OS-registered state | Aucun (pas de tâche planifiée touchée en P2). | Aucune |
| Secrets/env vars | `LEGAL_REVIEW_DONE` n'est PAS un secret (booléen public-ish) → `.env` non commité OK, mais peut aussi vivre en `.env.example` à false. Aucun secret nouveau. | Aucune rotation |
| Build artifacts | `globals.css` `--font-arabic` placeholder (« Noto Sans Arabic ») **sera remplacé** par la variable `next/font/local` (IBM Plex Sans Arabic). Caches Next/Turbopack à invalider après changement de police. | Remplacer le placeholder ; rebuild |

**Le flag `legal_review_done` — état runtime clé :** après tout le code P2 mergé, l'état « la revue juridique est-elle faite ? » vit dans **l'environnement (env var) + l'artefact git**, pas dans la DB (recommandation tranchée §Gate). P4 doit lire cet état. Si P4 préfère la DB, voir l'alternative documentée.

## Common Pitfalls

### Pitfall A : Promesse de gain implicite sur la home (VITR-03 / Pitfall 8 / D-08)
**Ce qui se passe :** une section « preuve » avec un chiffre placeholder (« 90% »), un visuel « +X% ce mois », ou un copy « devenez rentable » → publicité trompeuse + viole la valeur cœur + aggrave le risque juridique de la phase.
**Pourquoi :** envie de remplir la home / pression marketing du fondateur (« 90% » proposé puis écarté, cf. CONTEXT §Specifics).
**Éviter :** proof slot **vide** (Pattern 4), aucun nombre en code. Si la home paraît creuse → métriques **factuelles** optionnelles (nb d'analyses produites, marchés couverts, R:R moyen *visé*) — JAMAIS un % de réussite (Claude's Discretion CONTEXT). Copy de transparence autorisé : « Track record en cours de mesure — publié dès un échantillon suffisant. »
**Signes :** un `%` quelque part dans `messages/*.json` (home) ; copy « garanti », « riche », « profit ».

### Pitfall B : Refactor RTL tardif (Pitfall 11 / AP4)
**Ce qui se passe :** home construite en `ml/pl/left`, puis « ajout » de l'arabe casse marges/alignements/icônes.
**Éviter :** logical props dès le départ ; `<bdi>`/`dir="ltr"` autour des prix USD dans un contexte arabe ; revue visuelle `dir=rtl` des deux thèmes (Manual-UAT).
**Signes :** classes `ml/mr/pl/pr/left/right` dans le diff ; prix « 9 $ » inversé en arabe.

### Pitfall C : Flash de thème (FOUC) au chargement
**Ce qui se passe :** sans `suppressHydrationWarning` + script next-themes, le thème light s'affiche une frame avant de passer en dark → flash désagréable, et erreur d'hydratation React.
**Éviter :** `ThemeProvider attribute="class"`, `suppressHydrationWarning` sur `<html>` (next-themes injecte un script pré-paint).
**Signes :** warning d'hydratation console ; flash visible au reload en mode dark.

### Pitfall D : shadcn init écrase le `globals.css` / `@theme` existant
**Ce qui se passe :** `npx shadcn init` ajoute ses propres tokens et peut réécrire `globals.css`, effaçant `--font-arabic`/`:lang(ar)` (P1) ou entrant en conflit avec les tokens de marque.
**Éviter :** lancer init en premier, PUIS poser les tokens de marque deux thèmes + `@custom-variant` + `:lang(ar)` par-dessus ; vérifier `tsc`/`lint:i18n` verts après. Commit séparé pour l'init.
**Signes :** police arabe disparue ; double déclaration `@theme` ; build cassé.

### Pitfall E : Texte légal faisant foi rédigé par l'IA (D-15)
**Ce qui se passe :** générer un corps de CGU/risques « pour gagner du temps » → fausse assurance de conformité, risque MENA.
**Éviter :** placeholders explicites « ⚠️ Texte en cours de revue juridique » ; structure i18n prête ; le juriste fournit le FR, traduction pro AR/EN ensuite. Disclaimer court (footer) = OK car factuel et validé par le juriste avant encaissement.
**Signes :** un corps de CGU plausible mais non sourcé d'un juriste dans `messages/legal`.

## Code Examples

### Home page (VITR-01) — RSC statique, sections D-05
```tsx
// app/[locale]/(marketing)/page.tsx
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)               // garde le SSG (Pitfall 3 P1)
  const t = await getTranslations('home')
  const SHOW_PROOF = false               // D-08 : slot masqué jusqu'à P5

  return (
    <main className="mx-auto max-w-screen-xl px-4 md:px-6 lg:px-8">
      <section className="py-12 md:py-16 text-start">       {/* hero */}
        <h1 className="text-[40px] md:text-[56px] font-semibold leading-tight">{t('heroTitle')}</h1>
        <p className="mt-4 text-base text-muted">{t('heroLede')}</p>  {/* AUCUN % — D-08 */}
        <Button asChild className="mt-6"><Link href="/tarifs">{t('heroCta')}</Link></Button>
      </section>
      <section className="py-12">{/* « Comment ça marche » — D-06 méthode */}</section>
      {SHOW_PROOF && null /* ProofSection — P5, zéro chiffre en P2 */}
      <section className="py-12">{/* aperçu tarifs → /tarifs */}</section>
    </main>
  )
}
```

### Pages légales (D-14/D-15) — route dynamique + placeholder
```tsx
// app/[locale]/(marketing)/legal/[doc]/page.tsx
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

const DOCS = ['cgu', 'risques', 'confidentialite', 'mentions'] as const   // D-14

export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }))
}

export default async function LegalPage({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params
  if (!DOCS.includes(doc as (typeof DOCS)[number])) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('legal')
  return (
    <main className="mx-auto max-w-prose px-4 py-12 text-start">
      <h1 className="text-2xl font-semibold">{t(`${doc}.title`)}</h1>
      <p className="mt-4 rounded border border-border p-4 text-muted">{t('reviewPending')}</p> {/* D-15 */}
    </main>
  )
}
```

### Gate LEGAL-02 — lecture du flag (forme env, recommandée)
```ts
// lib/legal-gate.ts — P2 le POSE (défaut false) ; P4 le CONSOMME avant encaissement
export function isLegalReviewDone(): boolean {
  return process.env.LEGAL_REVIEW_DONE === 'true'   // défaut absent/false = non validé
}
// P4 (paiement) : if (!isLegalReviewDone()) throw / refuse l'encaissement en prod.
```

## Gate LEGAL-02 — mécanisme tranché (point le moins défini)

**Recommandation : env var `LEGAL_REVIEW_DONE` (défaut `false`) + artefact `docs/legal/LEGAL-REVIEW.md` versionné.** Discrétion CONTEXT laissée au planning entre env et DB → voici l'arbitrage.

| Critère | **env var `LEGAL_REVIEW_DONE`** (recommandé) | row config DB (`app_config` / `feature_flags`) |
|---------|------------------------------------------------|--------------------------------------------------|
| Simplicité de lecture par P4 | `process.env.LEGAL_REVIEW_DONE === 'true'` (synchrone, zéro requête) | requête Supabase + RLS + helper → plus lourd |
| Traçabilité du *qui/quand* | Dans `LEGAL-REVIEW.md` (git, signé/daté) | en DB (audit possible mais hors git) |
| Risque de bypass | Faible : changer la prod = acte déploiement conscient | Modifiable via service_role / superadmin UI (surface plus large) |
| Cohérence projet | Aligné « clés/flags en `.env` » (CLAUDE.md, P1) | Introduit une table config non nécessaire en P2 |
| Couplage P2→P4 | P2 documente la var ; P4 lit. Découplé, pas de migration. | P2 devrait créer une migration (0010+) consommée par P4 |

**Verdict :** **env var** pour le flag (simple, découplé, conforme) + **`LEGAL-REVIEW.md`** comme source de traçabilité humaine. Si P4 a déjà une table de config pour d'autres raisons, basculer le flag en DB y sera trivial (le booléen est la seule chose qui compte). **P2 livre : la var à `false` dans `.env.example` + l'artefact checklist ; P2 ne débloque RIEN tout seul** (pas de paiement en P2).

**Format `docs/legal/LEGAL-REVIEW.md` (artefact D-16.1) :**
```markdown
# Revue juridique — Gate LEGAL-02 (bloque le 1ᵉʳ encaissement, Phase 4)

**Statut :** ⛔ NON VALIDÉ (défaut). Sign-off requis avant encaissement prod.

## Checklist (cf. Pitfall 8)
- [ ] Statut « conseil en investissement non agréé » évalué (signaux génériques, jamais personnalisés)
- [ ] Statut crypto Algérie (interdiction loi de finances 2018) + autres pays MENA cibles
- [ ] Juridiction d'exploitation / structure tranchée
- [ ] Périmètre « éducatif » vs « conseil » validé
- [ ] Disclaimers (vitrine + membre + Telegram) rédigés/validés par le juriste
- [ ] Textes légaux faisant foi (CGU/Risques/Confidentialité/Mentions) livrés FR + traduits AR/EN
- [ ] Aucune allégation de performance / promesse de gain dans la communication

## Sign-off
- Validé par : __________   Date : __________
- Une fois TOUTES les cases cochées + sign-off : poser `LEGAL_REVIEW_DONE=true` en prod.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js darkMode:'class'` | `@custom-variant dark (&:where(.dark,.dark *))` en CSS | Tailwind v4 (2025) | Pas de config JS ; déclaration CSS-first (le projet n'a PAS de `tailwind.config`) |
| `tailwindcss-rtl` plugin | Propriétés logiques natives (`ms/me/ps/pe`) | Tailwind v3.3+ / v4 | Aucun plugin RTL ; inversion auto selon `dir` |
| Google Fonts `<link>` CDN | `next/font` (self-host build-time) | Next 13+ | Zéro CDN runtime, preload auto (D-03) |
| `lucide-react` 0.x | `lucide-react` 1.x | 2026 | Major ; vérifier les imports nommés des icônes |

**Deprecated/outdated :**
- `tailwindcss-rtl`, `tailwindcss-logical` : abandonnés/redondants — INTERDITS (STACK.md, D-01-02-C).
- `@supabase/auth-helpers` : déprécié — déjà remplacé par `@supabase/ssr` (P1). N/A en P2.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Flag `legal_review_done` en **env var** est le bon choix vs DB (discrétion CONTEXT) | §Gate LEGAL-02 | Faible — si P4 préfère DB, bascule triviale ; le booléen seul compte. À confirmer au planning P4. |
| A2 | `LEGAL-REVIEW.md` dans `docs/legal/` (vs `.planning/`) | §Structure | Faible — emplacement cosmétique ; `docs/legal/` plus visible pour le juriste/ops. Discrétion CONTEXT. |
| A3 | IBM Plex Sans Arabic via `@fontsource/ibm-plex-sans-arabic` est la meilleure source des `.woff2` | §Stack | Faible — UI-SPEC verrouille déjà IBM Plex Sans Arabic ; fontsource est juste le moyen de récupérer les fichiers. Téléchargement manuel = alternative. |
| A4 | `lucide-react@1.18.0` (v1 major) n'introduit pas de breaking sur les icônes utilisées | §Stack | Faible-Moyen — vérifier les noms d'icônes à l'usage (named imports). shadcn init l'installe de toute façon. |
| A5 | Inter via `next/font/google` (self-host build) est acceptable vis-à-vis de D-03 (« zéro CDN au runtime ») | §Stack | Faible — `next/font/google` self-host au build, aucune requête CDN runtime. Si l'esprit D-03 exige zéro accès Google même au build → `@fontsource-variable/inter`. À confirmer si strict. |
| A6 | Le signup réutilisé (P1) suffit au funnel D-09 sans écriture métier | §Architecture | Faible — vérifié : `(auth)/signup` existe (P1) ; l'écran « paiement bientôt » est statique. |

## Open Questions

1. **Métriques factuelles sur la home (anti-vide) ?**
   - On sait : le proof slot est masqué (D-08) ; la home pourrait paraître creuse.
   - Flou : afficher ou non nb d'analyses / marchés / R:R visé (Claude's Discretion CONTEXT).
   - Recommandation : préparer le namespace `home` pour accueillir 2-3 métriques **factuelles non-perf** ; décider à la revue UI. JAMAIS un %.

2. **`@supabase/ssr` import strict pour le signup réutilisé ?**
   - On sait : invariant P1 = `getUser()` jamais `getSession()`.
   - Flou : le funnel D-09 touche-t-il l'auth au-delà du signup existant ?
   - Recommandation : ne rien recâbler ; clic « s'abonner » → route signup existante → succès → `/paiement-bientot`. Pas de gate nouveau.

3. **Inter strict zéro-Google (A5) ?**
   - Recommandation : trancher au planning ; par défaut `next/font/google` (self-host build) ; si le fondateur veut zéro Google → `@fontsource-variable/inter`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + pnpm workspaces | build/install | ✓ (monorepo livré) | pnpm 9.x | — |
| next-intl 4.13 | i18n (P1) | ✓ installé | 4.13.0 | — |
| Tailwind 4.3.1 + postcss | styling | ✓ installé | 4.3.1 | — |
| next-themes | toggle thème (D-02) | ✗ à installer | 0.4.6 | aucun (no-flash maison déconseillé) |
| lucide-react | icônes | ✗ à installer | 1.18.0 | SVG inline (comme P1 LanguageSwitcher) si besoin de zéro install |
| shadcn/ui (CLI) | composants UI | ✗ à init | — | composants maison Radix (plus de travail) |
| Fichiers police arabe `.woff2` | D-03 self-host | ✗ à récupérer | via @fontsource | téléchargement manuel IBM Plex / Noto |
| Juriste (revue légale) | LEGAL-02 gate | ✗ humain externe | — | **AUCUN — bloquant non-code de l'encaissement P4** |

**Missing dependencies with no fallback :**
- **Revue juridique (juriste).** Externe, hors code. Bloque le 1ᵉʳ encaissement (P4), PAS la livraison du code P2. P2 livre l'artefact + flag à `false` ; le déblocage est manuel après sign-off.

**Missing dependencies with fallback :**
- `lucide-react` → SVG inline (pattern P1) ; `shadcn` → composants Radix maison ; police via npm ou téléchargement manuel.

## Validation Architecture

> nyquist_validation : clé absente de la config → traité comme **activé** (inclus).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (unit) + Playwright 1.60.0 (E2E) — déjà câblés (P1) |
| Config file | racine workspace (`vitest`, `playwright`) ; check statique `scripts/check-i18n-hardcoded.mjs` |
| Quick run command | `pnpm --filter web exec tsc -b --noEmit && pnpm lint:i18n` |
| Full suite command | `pnpm test && pnpm test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| VITR-01 | Home rend hero + CTA + sections dans la locale ; AUCUN `%` | e2e | `playwright test home.spec.ts` | ❌ Wave 0 |
| VITR-01 | Proof slot masqué (aucun chiffre rendu) | e2e/unit | assert absence de texte `%`/perf | ❌ Wave 0 |
| VITR-02 | Tarifs affichent 9$/mois + 3$/7j + « USDT (TRC-20) » ; CTA → signup | e2e | `playwright test pricing.spec.ts` | ❌ Wave 0 |
| VITR-02 | Funnel : clic s'abonner (visiteur) → signup → « paiement bientôt » | e2e | `playwright test funnel.spec.ts` | ❌ Wave 0 |
| VITR-03 | Aucune promesse de gain : grep messages home/pricing sans `%`/« garanti » | unit/static | `vitest no-perf-claims.test.ts` (scanne messages) | ❌ Wave 0 |
| VITR-03 / LEGAL-01 | `<Disclaimer>` présent au footer de toutes les pages, 3 locales | e2e | `playwright test disclaimer.spec.ts` | ❌ Wave 0 |
| LEGAL-01 | Disclaimer rendu dans les 3 langues (clés `disclaimer` à parité) | unit | `vitest messages-parity.test.ts` (étend le check P1) | ❌ Wave 0 |
| LEGAL-02 | `isLegalReviewDone()` retourne false par défaut (env absente) | unit | `vitest legal-gate.test.ts` | ❌ Wave 0 |
| LEGAL-02 | `docs/legal/LEGAL-REVIEW.md` existe et contient la checklist | static | `vitest legal-artifact.test.ts` (fs.existsSync + grep) | ❌ Wave 0 |
| I18N-03 (régression) | Aucune chaîne en dur dans le nouveau code | static | `pnpm lint:i18n` | ✅ (P1) |
| D-02 (thème) | Toggle bascule `.dark` sur `<html>` sans flash | e2e | `playwright test theme-toggle.spec.ts` | ❌ Wave 0 |
| D-04 / RTL | Pas de classes `ml/mr/pl/pr/left/right` dans le nouveau code | static | grep CI (étendre `check-i18n-hardcoded` ou script dédié) | ❌ Wave 0 (recommandé) |

### Sampling Rate
- **Per task commit :** `tsc -b --noEmit` + `pnpm lint:i18n` (rapide, < 30s).
- **Per wave merge :** `pnpm test` (Vitest unit + parité messages + legal-gate).
- **Phase gate :** suite E2E Playwright verte + revue visuelle RTL arabe (Manual-UAT, dev server requis) avant `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `home.spec.ts`, `pricing.spec.ts`, `funnel.spec.ts`, `disclaimer.spec.ts`, `theme-toggle.spec.ts` (Playwright) — couvrent VITR-01/02/03, D-02.
- [ ] `no-perf-claims.test.ts` — scanne `messages/*.json` (home/pricing) pour `%`/« garanti »/« profit » → fail si trouvé (VITR-03/D-08).
- [ ] `messages-parity.test.ts` — étend le contrôle de parité de clés aux nouveaux namespaces `home`/`legal`/`disclaimer` (LEGAL-01).
- [ ] `legal-gate.test.ts` + `legal-artifact.test.ts` — flag défaut false + présence/format `LEGAL-REVIEW.md` (LEGAL-02).
- [ ] Script CI grep RTL (classes physiques interdites) — recommandé, prévient Pitfall B.
- [ ] Revue visuelle RTL arabe deux thèmes = **Manual-UAT** (skip explicite côté CI, comme I18N-04 en P1).

## Security Domain

> `security_enforcement` : non explicitement `false` → inclus. P2 ASVS L1 (cohérent P1). Surface réduite : pages publiques lecture seule, zéro écriture métier, zéro paiement.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | non (P2) | Signup réutilise l'auth P1 ; aucun nouveau flux auth |
| V3 Session Management | non (P2) | Invariant P1 préservé (`getUser()`), non touché |
| V4 Access Control | partiel | Pages marketing = publiques (anon) par design ; ne PAS gater. Aucune régression sur les segments gated P1. |
| V5 Input Validation | oui | Form signup (réutilisé) ; route légale `[doc]` validée par allowlist `DOCS` + `notFound()` (anti-paramètre arbitraire) |
| V6 Cryptography | non | Aucune crypto en P2 (paiement = P4) |
| V14 Config | oui | `LEGAL_REVIEW_DONE` défaut false ; pas de secret nouveau ; épinglage exact des versions (AR-01-SC) |

### Known Threat Patterns for {Next.js 15 marketing + i18n}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Param `[doc]` légal arbitraire (path/enumeration) | Tampering / Info Disclosure | Allowlist `DOCS` + `generateStaticParams` + `notFound()` |
| Locale arbitraire dans l'URL | Input Validation / DoS | `hasLocale()` déjà en place (P1, T-01-05) — non régresser |
| Chaîne en dur (fuite de copy non traduite / contournement i18n) | Info Disclosure | `lint:i18n` CI (P1, T-01-10) — étendre aux nouveaux namespaces |
| Supply-chain (next-themes, lucide, fontsource, shadcn deps) | Tampering | Épinglage exact ; checkpoint human-verify avant install (slopcheck absent) ; paquets à repo officiel sans postinstall |
| XSS via contenu légal | Tampering | Texte = clés i18n (pas de `dangerouslySetInnerHTML`) ; pas de MDB/MDX en P2 |
| Allégation de performance (risque légal/réputation) | — (conformité) | proof slot vide (D-08) ; test `no-perf-claims` ; revue juriste (gate LEGAL-02) |

## Project Constraints (from CLAUDE.md)

- **Stack verrouillée :** Next.js **15** (PAS 16) ; Tailwind **v4 CSS-first** (pas de `tailwind.config.*`) ; Zod **v4** ; `@supabase/ssr 0.12` avec **`getUser()` jamais `getSession()`**.
- **shadcn/ui :** branche compatible **Tailwind v4 + React 19** uniquement.
- **i18n :** toute chaîne via next-intl (CI `lint:i18n` bloque les régressions) ; nom de marque exclu via `// i18n-ignore`.
- **RTL :** propriétés logiques natives Tailwind v4 ; INTERDIT `tailwindcss-rtl`/`tailwindcss-logical`.
- **Sécurité :** clés/flags en `.env` non commitées ; aucun secret hardcodé ; RLS stricte non régressée.
- **Légal :** contenu éducatif, disclaimers explicites, aucune promesse de gain.
- **Recherche d'abord :** réutiliser l'existant (libs battle-tested) avant de hand-roll.
- **Langue :** toutes les sorties user-facing en **français**.

## Sources

### Primary (HIGH confidence)
- Repo lu (2026-06-14) : `apps/web/src/app/[locale]/layout.tsx`, `styles/globals.css`, `i18n/{routing,request}.ts`, `messages/fr.json`, `app/layout.tsx`, `apps/web/package.json`, `(marketing)/tarifs/page.tsx`, `scripts/check-i18n-hardcoded.mjs`, racine `package.json` scripts.
- `.planning/phases/02-.../02-CONTEXT.md` (D-01..D-16) + `02-UI-SPEC.md` (design contract approuvé).
- `.planning/REQUIREMENTS.md` (VITR-01/02/03, LEGAL-01/02), `.planning/STATE.md`, `01-SECURITY.md` (invariants gating/RLS/i18n P1).
- `.planning/research/{STACK,ARCHITECTURE,PITFALLS}.md` v2.0 (next-intl 4.13, RTL natif v4, anti-patterns AP1-6, Pitfall 8/11).
- npm registry (2026-06-14) : `next-themes` 0.4.6, `lucide-react` 1.18.0, `@fontsource/ibm-plex-sans-arabic` 5.2.9, `@fontsource-variable/inter` (repos officiels, postinstall vide, downloads vérifiés).

### Secondary (MEDIUM confidence)
- [tailwindcss.com/blog/tailwindcss-v4](https://tailwindcss.com/blog/tailwindcss-v4) — `@custom-variant`, logical properties (recoupé recherche v2.0).
- next-themes README (pacocoursey) — `attribute="class"`, `suppressHydrationWarning`, no-flash.
- [nextjs.org/docs — Font Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) — `next/font/local`, self-host.
- WebSearch (2026) next-themes + Tailwind v4 `@custom-variant` class strategy — pattern confirmé multi-sources.

### Tertiary (LOW confidence)
- Choix env vs DB pour `legal_review_done` : raisonnement projet (pas de source externe) → A1, à confirmer au planning P4.

## Metadata

**Confidence breakdown :**
- Standard stack (theming/fonts/shadcn) : HIGH — versions npm vérifiées, repos officiels, patterns recoupés docs + repo existant.
- Architecture (pages marketing, réutilisation P1) : HIGH — fichiers P1 lus, structure `(marketing)` confirmée.
- Gate LEGAL-02 (flag mécanisme) : MEDIUM — discrétion projet ; recommandation env var argumentée, alternative DB documentée.
- Pitfalls/sécurité : HIGH — héritage recherche v2.0 + SECURITY P1.

**Research date :** 2026-06-14
**Valid until :** 2026-07-14 (stack stable ; vérifier `lucide-react` minor si install plus tard que ~2 semaines).
