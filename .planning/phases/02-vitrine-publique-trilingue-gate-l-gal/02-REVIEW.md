---
phase: 02-vitrine-publique-trilingue-gate-l-gal
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - apps/web/src/app/[locale]/(auth)/actions.ts
  - apps/web/src/app/[locale]/(marketing)/legal/[doc]/page.tsx
  - apps/web/src/app/[locale]/(marketing)/page.tsx
  - apps/web/src/app/[locale]/(marketing)/paiement-bientot/page.tsx
  - apps/web/src/app/[locale]/(marketing)/tarifs/page.tsx
  - apps/web/src/app/[locale]/layout.tsx
  - apps/web/src/components/Disclaimer.tsx
  - apps/web/src/components/Footer.tsx
  - apps/web/src/components/ThemeProvider.tsx
  - apps/web/src/components/ThemeToggle.tsx
  - apps/web/src/lib/fonts.ts
  - apps/web/src/lib/legal-gate.ts
  - apps/web/src/styles/globals.css
  - apps/web/src/messages/fr.json
  - apps/web/src/messages/en.json
  - apps/web/src/messages/ar.json
findings:
  critical: 0
  warning: 6
  info: 4
  total: 10
status: issues_found
---

# Phase 2 : Rapport de revue de code

**Reviewed:** 2026-06-14
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Vitrine publique trilingue (FR/EN/AR) Next.js 15 + Supabase. Les invariants de
sécurité majeurs tiennent : le gate légal est `import 'server-only'` + default-deny
strict (`=== 'true'`), la page légale `[doc]` applique une allowlist + `notFound()`
avant tout rendu (anti path-traversal), aucun `dangerouslySetInnerHTML`, l'auth
utilise bien `getUser()` côté serveur (gate.ts) et le redirect de succès signup vers
`/paiement-bientot` n'a pas recâblé l'auth. Aucun secret/adresse wallet en dur.
Copywriting conforme VITR-03 (zéro % / promesse de gain). **Aucun BLOCKER.**

Les défauts trouvés sont des bugs de rendu (tokens de couleur invalides / morts qui
cassent la lisibilité et le dark mode), des couleurs hex magiques hardcodées qui
contournent le design system de tokens, et une incohérence dans `safeReturnTo`.
Plusieurs touchent directement l'invariant RTL/dark-mode et la lisibilité du
disclaimer légal (qui doit rester visible — exigence LEGAL-01).

## Warnings

### WR-01: Token `text-muted` invalide casse la lisibilité du disclaimer légal

**File:** `apps/web/src/components/Disclaimer.tsx:14`, `apps/web/src/app/[locale]/(marketing)/legal/[doc]/page.tsx:39`, `apps/web/src/components/Footer.tsx:36`
**Issue:** `text-muted` résout vers `--color-muted` qui, dans `globals.css:40`, mappe
une couleur de **fond** gris très clair (`#F4F6F9` en light). Appliquée comme couleur
de **texte**, elle produit un texte gris quasi-invisible sur fond blanc (`#FFFFFF`),
contraste largement sous le seuil WCAG. Le bon token texte est `text-muted-foreground`
(`#5B6675`), déjà utilisé partout ailleurs (page.tsx, tarifs, paiement-bientot). Le
disclaimer (LEGAL-01) DOIT rester lisible — c'est l'exigence centrale de la phase.
**Fix:**
```tsx
// Disclaimer.tsx
return <p className="text-sm text-muted-foreground ps-4 pe-4">{t('footer')}</p>
// legal/[doc]/page.tsx
<p className="mt-6 text-muted-foreground">{t('reviewPending')}</p>
// Footer.tsx — remplacer text-muted par text-muted-foreground sur le Link
```

### WR-02: Classe `bg-surface` morte — fond du footer non rendu

**File:** `apps/web/src/components/Footer.tsx:29`
**Issue:** `bg-surface` référence un token `--color-surface` qui **n'existe pas** dans
`globals.css` (le bloc `@theme inline` ne définit pas `--color-surface`). Tailwind v4
n'émet aucune règle → le footer n'a pas la « surface secondaire de marque » documentée
dans le commentaire. Le token réel pour cette surface est `secondary`/`card`
(`#F4F6F9`).
**Fix:**
```tsx
<footer className="bg-secondary px-4 py-8 md:px-6">
```
(ou ajouter `--color-surface: var(--secondary);` dans `@theme inline` si le nom doit être conservé.)

### WR-03: Couleur hex `#2563EB` hardcodée dans le focus ring (contourne les tokens + dark mode)

**File:** `apps/web/src/components/ThemeToggle.tsx:43`, `apps/web/src/components/LanguageSwitcher.tsx:168,200`
**Issue:** `focus-visible:ring-[#2563EB]` est une couleur magique en dur. Le design
system définit `--ring` = `#1E5FBF` (light) / `#3B82F6` (dark). Le ring hardcodé (a)
diverge visuellement de tous les autres focus rings du projet qui utilisent le token,
et (b) ne s'adapte pas au dark mode. Viole la règle « no hardcoded values (use
constants or config) ».
**Fix:**
```tsx
// utiliser le token de ring du design system
focus-visible:ring-2 focus-visible:ring-ring
```

### WR-04: `bg-white` + `border-black/10` hardcodés cassent le dark mode du dropdown langue

**File:** `apps/web/src/components/LanguageSwitcher.tsx:183`
**Issue:** Le panneau du listbox force `bg-white` et `border-black/10`. En thème sombre,
le menu reste blanc avec texte sombre → contraste cassé et incohérence avec le reste de
l'UI tokenisée. Les tokens corrects existent : `bg-popover text-popover-foreground` et
`border-border` (déjà définis pour light + dark dans `globals.css`).
**Fix:**
```tsx
className="absolute end-0 z-10 mt-1 min-w-40 rounded-md border border-border bg-popover text-popover-foreground py-1 shadow-md"
```

### WR-05: `safeReturnTo` retourne `raw` (non décodé) au lieu de la valeur normalisée validée

**File:** `apps/web/src/lib/auth/gate.ts:50` (consommé par `actions.ts:78-81` signIn)
**Issue:** La validation décode, normalise les antislash et vérifie `decoded`, mais
`return raw` renvoie la chaîne **brute originale** — pas la valeur validée. La valeur
réellement redirigée (`nextRedirect(safe)` dans `signIn`) peut donc différer de ce qui a
été contrôlé (ex. antislash non normalisés, séquences `%xx` réinjectées). Reste
same-origin (pas d'open-redirect car le préfixe `/` simple est garanti par la check sur
`decoded`), mais l'écart valeur-validée / valeur-utilisée est un anti-pattern de
sécurité fragile : une future modif du normaliseur ne protègera pas la sortie.
**Fix:**
```ts
// retourner la valeur effectivement validée, pas l'entrée brute
return normalized
```

### WR-06: Comparaison de type fragile sur le segment `[doc]` via cast

**File:** `apps/web/src/app/[locale]/(marketing)/legal/[doc]/page.tsx:30`
**Issue:** `DOCS.includes(doc as (typeof DOCS)[number])` caste l'entrée arbitraire vers
le type littéral pour satisfaire le typage de `includes`. Fonctionnellement correct
(le runtime compare des strings), mais le cast masque le fait que `doc` est non
fiable et peut induire en erreur lors d'évolutions (ex. si quelqu'un retire la garde et
se fie au type). Préférer un type guard explicite sans cast trompeur.
**Fix:**
```ts
const isAllowedDoc = (d: string): d is (typeof DOCS)[number] =>
  (DOCS as readonly string[]).includes(d)
if (!isAllowedDoc(doc)) notFound()
```

## Info

### IN-01: Marque en dur dans le shell (`Vétéran Trading`)

**File:** `apps/web/src/app/[locale]/layout.tsx:53`
**Issue:** Chaîne `Vétéran Trading` en dur (annotée `i18n-ignore: marque`). Acceptable
pour un nom de marque, mais incohérent avec le titre du dashboard qui dit
`Veteran Trading` (sans accent) dans les messages — divergence de marque FR vs EN/AR.
**Fix:** Centraliser le nom de marque dans une constante unique partagée.

### IN-02: `SHOW_PROOF && null` est du code inerte

**File:** `apps/web/src/app/[locale]/(marketing)/page.tsx:18,56`
**Issue:** `const SHOW_PROOF = false` puis `{SHOW_PROOF && null}` ne rend jamais rien
(`null` même si `true`). C'est un placeholder volontaire (D-08) mais le motif est mort
dans les deux branches. Un commentaire `{/* proof slot — Phase 5 */}` suffirait sans
variable inutilisée.
**Fix:** Remplacer par un commentaire JSX, ou conserver la variable mais rendre le vrai
slot quand `SHOW_PROOF` (sinon la var ne sert à rien).

### IN-03: Prix arabe `9 $ / شهر` — séparateur et symbole non localisés

**File:** `apps/web/src/messages/ar.json:33,36`
**Issue:** Le commentaire de `tarifs/page.tsx` promet « prix en `<bdi>` +
`Intl.NumberFormat` (anti-inversion RTL) », mais les prix sont des **chaînes
statiques** dans les messages (`9 $ / mois`, `9 $ / شهر`). Aucun `Intl.NumberFormat`
n'est utilisé. Le `<bdi>` protège l'isolation directionnelle, donc pas de bug
d'inversion bloquant, mais l'intention documentée (formatage programmatique) n'est pas
implémentée — divergence code/commentaire.
**Fix:** Soit retirer la mention `Intl.NumberFormat` du commentaire, soit formater les
montants via `Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' })`.

### IN-04: `enableSystem` activé alors que `defaultTheme="light"` (intention ambiguë)

**File:** `apps/web/src/app/[locale]/layout.tsx:50`
**Issue:** `defaultTheme="light"` + `enableSystem` : au premier rendu sans préférence
stockée, next-themes appliquera la préférence **système** (qui prime sur le default),
pas forcément light. Si l'intention D-02 est « light par défaut », `enableSystem`
contredit `defaultTheme`. À clarifier (intentionnel ou non).
**Fix:** Si light strict voulu : retirer `enableSystem`. Sinon documenter que system prime.

---

_Reviewed: 2026-06-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
