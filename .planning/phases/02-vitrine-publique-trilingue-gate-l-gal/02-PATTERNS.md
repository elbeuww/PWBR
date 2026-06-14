# Phase 2 : Vitrine publique trilingue & gate légal - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 18 (créés/modifiés)
**Analogs found:** 16 / 18 (2 sans analog direct : ThemeProvider/ThemeToggle next-themes, LEGAL-REVIEW.md)

> Source patterns extraits du socle Phase 1 (lus 2026-06-14) : `[locale]/layout.tsx`, `(marketing)/tarifs/page.tsx`, `(auth)/signup/page.tsx`, `components/LanguageSwitcher.tsx`, `styles/globals.css`, `lib/auth/gate.ts`, `i18n/{routing,navigation}.ts`, `messages/fr.json`, `scripts/check-i18n-hardcoded.mjs`, `lib/supabase/server.ts`.
>
> **Invariants P1 à NE PAS régresser** (s'appliquent à TOUS les nouveaux fichiers) :
> - Toute chaîne user-facing → clé `messages/*.json` (`getTranslations`/`useTranslations`). CI `lint:i18n` bloque. Marque exclue via `// i18n-ignore`.
> - RTL : propriétés logiques `ms/me/ps/pe/start/end`, `text-start`. JAMAIS `ml/mr/pl/pr/left/right/text-left`.
> - `setRequestLocale(locale)` en tête de chaque page RSC (garde le SSG, Pitfall 3).
> - Navigation localisée via `../i18n/navigation` (`Link`/`redirect`), jamais `next/navigation` brut.
> - Un SEUL `<html lang dir>` : `[locale]/layout.tsx` (Pitfall 7) — pas de re-déclaration.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/[locale]/(marketing)/page.tsx` | page (RSC) | request-response (statique SSG) | `(marketing)/tarifs/page.tsx` | exact |
| `app/[locale]/(marketing)/tarifs/page.tsx` (étoffé) | page (RSC) | request-response (statique SSG) | `(marketing)/tarifs/page.tsx` (lui-même) | exact |
| `app/[locale]/(marketing)/paiement-bientot/page.tsx` | page (RSC) | request-response (statique) | `(marketing)/tarifs/page.tsx` | exact |
| `app/[locale]/(marketing)/legal/[doc]/page.tsx` | page (RSC, route dynamique) | request-response + allowlist param | `(marketing)/tarifs/page.tsx` + `gate.ts` (validation param) | role-match |
| `app/[locale]/layout.tsx` (modifié) | layout (RSC) | request-response (shell) | `[locale]/layout.tsx` (lui-même) | exact |
| `components/Disclaimer.tsx` | component (RSC) | transform (i18n→markup) | `(marketing)/tarifs/page.tsx` (getTranslations RSC) | role-match |
| `components/Footer.tsx` | component (RSC) | transform | `[locale]/layout.tsx` (header) | role-match |
| `components/ThemeProvider.tsx` | provider (client) | event-driven (toggle) | aucun (next-themes nouveau) | no-analog |
| `components/ThemeToggle.tsx` | component (client) | event-driven | `components/LanguageSwitcher.tsx` | role-match |
| `components/ui/*` (shadcn copiés) | component | request-response | aucun (génération CLI) | n/a (registre officiel) |
| `lib/fonts.ts` | config (util) | build-time | `lib/supabase/server.ts` (module config exporté) | partial |
| `lib/legal-gate.ts` | util (server) | config-read | `lib/auth/gate.ts` | role-match |
| `messages/{fr,en,ar}.json` (étendus) | config (i18n data) | data | `messages/fr.json` (lui-même) | exact |
| `styles/globals.css` (modifié) | config (styles) | build-time | `styles/globals.css` (lui-même) | exact |
| `docs/legal/LEGAL-REVIEW.md` | doc (artefact gate) | n/a (non-code) | aucun | no-analog (format fourni RESEARCH §Gate) |
| `.env.example` (modifié) | config | config-flag | — | n/a |

---

## Pattern Assignments

### `app/[locale]/(marketing)/page.tsx` — HOME (VITR-01) — NOUVEAU (page RSC, statique)

**Analog :** `apps/web/src/app/[locale]/(marketing)/tarifs/page.tsx`

**Signature page RSC + setRequestLocale + getTranslations** (tarifs lignes 9-17) — copier tel quel, changer le namespace :
```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server'

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)            // garde le SSG (Pitfall 3)
  const t = await getTranslations('home')
  // ...
}
```

**Navigation localisée du CTA** — utiliser `Link` de `i18n/navigation` (cf. signup ligne 7) :
```tsx
import { Link } from '../../../i18n/navigation'   // PAS next/link
// <Link href="/tarifs">{t('heroCta')}</Link>      // href SANS préfixe locale (auto)
```

**Conteneur + classes logiques RTL** (tarifs ligne 19 ; étendre au layout home RESEARCH §Code Examples) :
```tsx
<main className="mx-auto max-w-screen-xl px-4 py-16 text-start md:px-6 lg:px-8">
```

**Proof slot MASQUÉ (D-08)** — constante locale, AUCUN nombre rendu (RESEARCH Pattern 4) :
```tsx
const SHOW_PROOF = false   // P5 activera le track record mesuré
{SHOW_PROOF && null /* ProofSection — zéro chiffre en P2 */}
```
> ⛔ Aucun `%` dans `messages.home`. Test `no-perf-claims` scannera. Sections D-05 : hero → comment-ça-marche → (proof masqué) → aperçu tarifs.

---

### `app/[locale]/(marketing)/tarifs/page.tsx` — PRICING (VITR-02) — ÉTOFFÉ

**Analog :** lui-même (placeholder existant, lignes 7-23) — conserver la structure, enrichir le contenu.

**Pattern conservé** : `setRequestLocale` + `getTranslations('pricing')` + `<main className="mx-auto … text-start">`.

**À ajouter (D-10/D-11/D-12)** : 2 cartes (shadcn `card` + `badge` + `button`), prix `9 $/mois` et `3 $/7 j (une seule fois)`, sous-texte « payable en USDT (TRC-20) », CTA `<Link href="/signup">`. Prix dans `<bdi>` + `Intl.NumberFormat` (UI-SPEC §Typography, anti-inversion RTL).

**Étendre le namespace `pricing`** (actuel = `{title, body}`, messages/fr.json lignes 25-28) :
```jsonc
"pricing": {
  "title": "Tarifs",
  "plan1Price": "9 $ / mois",
  "plan1Usdt": "payable en USDT (TRC-20)",
  "plan2Price": "3 $ / 7 jours",
  "plan2Note": "offre découverte, utilisable une seule fois",
  "cta": "S'abonner"
}
```

---

### `app/[locale]/(marketing)/paiement-bientot/page.tsx` — POST-SIGNUP (D-09) — NOUVEAU

**Analog :** `(marketing)/tarifs/page.tsx` (même squelette page RSC statique).

Page statique simple : heading « Paiement disponible très bientôt » + body (copy UI-SPEC §Copywriting). ⛔ AUCUNE adresse USDT, AUCUN QR, AUCUN flux. Namespace `paiement` (ou sous-clé `pricing`). Copier signature page + `setRequestLocale` + `getTranslations` à l'identique de tarifs.

---

### `app/[locale]/(marketing)/legal/[doc]/page.tsx` — LÉGAL (LEGAL-01, D-14/D-15) — NOUVEAU

**Analog (squelette page) :** `(marketing)/tarifs/page.tsx` · **Analog (validation param + notFound) :** `lib/auth/gate.ts` (allowlist stricte).

**Allowlist du param `[doc]` + génération statique** (sécurité V5, anti-param arbitraire — RESEARCH §Code Examples & §Security) :
```tsx
import { notFound } from 'next/navigation'
const DOCS = ['cgu', 'risques', 'confidentialite', 'mentions'] as const   // D-14

export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }))
}

export default async function LegalPage({
  params,
}: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params
  if (!DOCS.includes(doc as (typeof DOCS)[number])) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('legal')
  // titre = t(`${doc}.title`) ; corps = t('reviewPending') (D-15 placeholder)
}
```
> ⛔ D-15 : corps = placeholder « ⚠️ Texte en cours de revue juridique. » UNIQUEMENT. L'IA n'invente PAS de CGU/risques faisant foi. Conteneur prose : `max-w-prose px-4 py-12 text-start`.

---

### `app/[locale]/layout.tsx` — SHELL (modifié)

**Analog :** lui-même (lignes 12-52) — extension chirurgicale, ne pas régresser le `<html lang dir>` ni `hasLocale`/`notFound`.

**Pattern existant conservé** (lignes 30-40) :
```tsx
const { locale } = await params
if (!hasLocale(routing.locales, locale)) notFound()
setRequestLocale(locale)
const messages = await getMessages()
return (
  <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>   {/* + suppressHydrationWarning P2 */}
    <body>
      <NextIntlClientProvider messages={messages}>
        {/* header existant */}
        {children}
      </NextIntlClientProvider>
    </body>
  </html>
)
```

**Greffes P2** (RESEARCH Pattern 1) :
1. `suppressHydrationWarning` sur `<html>` (no-flash next-themes).
2. `<body className={`${inter.variable} ${ibmPlexArabic.variable}`}>` (fonts via `lib/fonts.ts`).
3. Envelopper avec `<ThemeProvider attribute="class" defaultTheme="light" enableSystem>` (à l'intérieur de body, autour de NextIntlClientProvider).
4. Header existant (lignes 41-46) : ajouter `<ThemeToggle />` à côté du `<LanguageSwitcher />` (déjà ancré `ms-auto`).
5. Après `{children}` : `<Footer />` (qui contient `<Disclaimer />`).

> ⚠️ Le nom de marque ligne 42 garde `{/* i18n-ignore: marque */}`.

---

### `components/Disclaimer.tsx` — TRANSVERSE (D-13, LEGAL-01) — NOUVEAU (RSC)

**Analog :** pattern `getTranslations` RSC de `tarifs/page.tsx` (server component sans `'use client'`).

```tsx
import { getTranslations } from 'next-intl/server'

export async function Disclaimer() {
  const t = await getTranslations('disclaimer')
  return <p className="text-sm text-muted ps-4 pe-4">{t('footer')}</p>   // ps/pe RTL-safe
}
```
> Composant unique réutilisé P3 (espace membre) + P6 (Telegram). Namespace `disclaimer` à parité fr/en/ar. Copy UI-SPEC §Copywriting (footer disclaimer permanent).

---

### `components/Footer.tsx` — FOOTER GLOBAL — NOUVEAU (RSC)

**Analog :** `[locale]/layout.tsx` header (lignes 41-46) — même approche : conteneur flex, classes logiques, `bg-secondary`.

Footer global : nav légale (`<Link href="/legal/cgu">` etc. via `i18n/navigation`) + `<Disclaimer />`. Toutes chaînes via `getTranslations('legal'/'common')`. RTL : `ps/pe/ms/me`.

---

### `components/ThemeToggle.tsx` — NOUVEAU (client component)

**Analog :** `components/LanguageSwitcher.tsx` (lignes 1-2, 64-173) — même contrat a11y/RTL/touch.

**Pattern à copier de LanguageSwitcher :**
- `'use client'` en tête (ligne 1).
- Bouton : `min-h-11 min-w-11` (touch ≥44px), `aria-label={t(...)}`, `focus-visible:ring-2` (ligne 168).
- `useTranslations('theme')` pour le label accessible.
- Icônes : LanguageSwitcher utilise **SVG inline** (lignes 25-62) car lucide était absent ; en P2 `lucide-react` est installé → utiliser `Sun`/`Moon` named imports (RESEARCH : vérifier noms d'icônes v1.x).

**Logique theme** (next-themes, nouveau) :
```tsx
import { useTheme } from 'next-themes'
const { theme, setTheme } = useTheme()
// onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
```

---

### `components/ThemeProvider.tsx` — NOUVEAU (client wrapper) — NO ANALOG

Wrapper minimal next-themes (`'use client'`), pas d'analog P1 :
```tsx
'use client'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

---

### `lib/fonts.ts` — POLICES (D-03) — NOUVEAU

**Analog (forme module config exporté) :** `lib/supabase/server.ts` (module lib qui exporte une fonction/const de config).

`next/font/local` (IBM Plex Sans Arabic) + `next/font/google` ou `@fontsource-variable/inter` (Inter), exposés en variables CSS `--font-inter` / `--font-ibm-plex-arabic` (RESEARCH Pattern 2). Fichiers `.woff2` depuis `@fontsource/ibm-plex-sans-arabic/files/` copiés dans `apps/web/src/fonts/`.

---

### `lib/legal-gate.ts` — GATE LEGAL-02 (D-16.2) — NOUVEAU

**Analog :** `lib/auth/gate.ts` (helper server `import 'server-only'` + lecture d'état + fonctions exportées).

```ts
// P2 POSE (défaut false) ; P4 CONSOMME avant encaissement
export function isLegalReviewDone(): boolean {
  return process.env.LEGAL_REVIEW_DONE === 'true'   // défaut absent/false = non validé
}
```
> Verdict RESEARCH §Gate : env var (pas DB). Test `legal-gate.test.ts` : false par défaut. `.env.example` += `LEGAL_REVIEW_DONE=false`.

---

### `messages/{fr,en,ar}.json` — ÉTENDUS

**Analog :** `messages/fr.json` (structure namespace plat existante, lignes 1-45).

Ajouter namespaces : `home`, `legal`, `disclaimer`, `paiement` ; enrichir `pricing`. **Parité de clés stricte fr/en/ar** (test `messages-parity`). FR = source ; AR/EN traduction pro. Légal = placeholders D-15. ⛔ Aucun `%`/« garanti »/« profit » dans `home`/`pricing` (test `no-perf-claims`).

---

### `styles/globals.css` — MODIFIÉ

**Analog :** lui-même (lignes 1-18) — conserver `@import "tailwindcss"`, `--font-arabic`, `:lang(ar)`.

**Transformation** (RESEARCH Pattern 1) :
1. Ajouter `@custom-variant dark (&:where(.dark, .dark *));` (Tailwind v4 CSS-first, pas de config JS).
2. Étendre `@theme` avec tokens de marque LIGHT (UI-SPEC §Color : `--color-background/surface/accent/foreground/muted/border`).
3. Bloc `.dark { … }` avec valeurs dark (UI-SPEC §Color).
4. **Remplacer** `--font-arabic: "Noto Sans Arabic"…` (ligne 8) par `var(--font-ibm-plex-arabic)` exposé par `lib/fonts.ts`. `:lang(ar)` (lignes 16-18) conservé.
> ⚠️ Pitfall D : `shadcn init` écrit aussi dans globals.css → lancer init EN PREMIER, poser les tokens marque PAR-DESSUS, vérifier `:lang(ar)` survit + commit séparé.

---

## Shared Patterns

### i18n (toutes pages + composants)
**Source :** `tarifs/page.tsx` (RSC : `getTranslations`), `LanguageSwitcher.tsx` ligne 65 (client : `useTranslations`).
**Apply to :** TOUS les fichiers .tsx P2.
```tsx
// RSC :  const t = await getTranslations('namespace')
// client: const t = useTranslations('namespace')
```
CI `scripts/check-i18n-hardcoded.mjs` scanne `app/` + `components/` et échoue (exit 1) sur texte littéral JSX. Échappatoire marque : `// i18n-ignore`.

### Navigation localisée
**Source :** `i18n/navigation.ts` (lignes 10-11), consommée par `signup/page.tsx` ligne 7, `gate.ts` ligne 21.
**Apply to :** tout lien/redirect des pages marketing.
```tsx
import { Link, redirect } from '../../../i18n/navigation'   // jamais next/link ni next/navigation pour les liens locale
```

### RTL logical props (anti Pitfall B / AP4)
**Source :** `LanguageSwitcher.tsx` (`ms-auto`, `end-0`, `text-start`, ligne 183/200) ; `tarifs/page.tsx` `text-start`.
**Apply to :** chaque nouveau composant dès la 1ʳᵉ ligne.
Autorisé : `ms/me/ps/pe/start/end/text-start`. INTERDIT : `ml/mr/pl/pr/left/right/text-left`. Prix → `<bdi>` + `Intl.NumberFormat`.

### SSG guard
**Source :** toutes pages P1 — `setRequestLocale(locale)` après `await params`.
**Apply to :** chaque `page.tsx` RSC. Sans lui → rendu dynamique forcé (Pitfall 3).

### Touch + focus a11y
**Source :** `LanguageSwitcher.tsx` ligne 168 (`min-h-11 min-w-11 … focus-visible:ring-2`).
**Apply to :** ThemeToggle, CTA, liens nav, cartes pricing. Cible tappable ≥44px (UI-SPEC §Spacing).

### Server-only helpers
**Source :** `gate.ts` ligne 1 (`import 'server-only'`), `lib/supabase/server.ts`.
**Apply to :** `lib/legal-gate.ts` (lecture env serveur).

---

## No Analog Found

| File | Role | Data Flow | Reason / Source de référence |
|------|------|-----------|------------------------------|
| `components/ThemeProvider.tsx` | provider client | event-driven | next-themes nouveau en P2 — pas de provider client P1. Réf : RESEARCH §Pattern 1 + next-themes README. |
| `docs/legal/LEGAL-REVIEW.md` | artefact gate (non-code) | n/a | Aucun artefact légal P1. Format complet fourni : RESEARCH §Gate LEGAL-02 (checklist + sign-off). |
| `components/ui/*` (shadcn) | UI primitives | request-response | Générés par `npx shadcn add` (registre officiel) — pas à coder à la main. UI-SPEC §Registry Safety. |
| `lib/fonts.ts` (partiel) | config build | build-time | Pattern `next/font/local` nouveau (P1 n'avait pas de polices self-hostées). Réf : RESEARCH §Pattern 2. |

---

## Metadata

**Analog search scope :** `apps/web/src/app/[locale]/`, `apps/web/src/components/`, `apps/web/src/lib/`, `apps/web/src/i18n/`, `apps/web/src/messages/`, `apps/web/src/styles/`, `scripts/`.
**Files scanned (Phase 1 lus) :** 11.
**Pattern extraction date :** 2026-06-14
