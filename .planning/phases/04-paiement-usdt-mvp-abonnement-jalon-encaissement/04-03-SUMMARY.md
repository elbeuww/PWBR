---
phase: 04-paiement-usdt-mvp-abonnement-jalon-encaissement
plan: 03
subsystem: ui
tags: [shadcn, radix-ui, react-hook-form, next-intl, i18n, tailwind-v4, sonner, qr]

# Dependency graph
requires:
  - phase: 02-vitrine-publique
    provides: "shadcn init (components.json radix-nova), tokens marque globals.css, namespaces fr/en/ar, garde lint:i18n"
  - phase: 03-espace-membre-signaux
    provides: "namespaces signals/signalDetail/glossary, pattern parite i18n recursive, QueryProvider"
provides:
  - "8 blocs shadcn (table, form, textarea, sonner, tabs, alert, alert-dialog, progress) sous apps/web/src/components/ui/"
  - "form.tsx ecrit main (react-hook-form 7 + @hookform/resolvers 5) — absent du registry nova standalone"
  - "namespace i18n payment (53 cles x3, parite recursive stricte fr/en/ar)"
  - "namespace i18n admin (mono-FR, back-office)"
  - "pricing etendu D-12 (discoveryConsumed/earlyUpgrade)"
  - "test messages-parity-payment.test.ts (garde CI parite recursive + no-perf)"
affects: [04-05-paiement, 04-06-admin-expiry]

# Tech tracking
tech-stack:
  added: [react-hook-form@7, "@hookform/resolvers@5", sonner@2]
  patterns:
    - "form.tsx ecrit main quand le bloc shadcn est absent du registry nova standalone (precedent D-02-01-D)"
    - "i18n-ignore en bout de ligne pour neutraliser un faux positif du detecteur regex maison sur une annotation de type CVA"
    - "test de parite par-namespace (un fichier par namespace, recursif sur sous-cles)"

key-files:
  created:
    - apps/web/src/components/ui/table.tsx
    - apps/web/src/components/ui/form.tsx
    - apps/web/src/components/ui/textarea.tsx
    - apps/web/src/components/ui/sonner.tsx
    - apps/web/src/components/ui/tabs.tsx
    - apps/web/src/components/ui/alert.tsx
    - apps/web/src/components/ui/alert-dialog.tsx
    - apps/web/src/components/ui/progress.tsx
    - apps/web/src/messages/__tests__/messages-parity-payment.test.ts
  modified:
    - apps/web/src/messages/fr.json
    - apps/web/src/messages/en.json
    - apps/web/src/messages/ar.json
    - apps/web/package.json

key-decisions:
  - "D-04-03-A : form.tsx ecrit main (registry nova ne le fournit pas en standalone, confirme D-02-01-D) ; react-hook-form/@hookform/resolvers = deps standard shadcn (registry officiel, vetting non requis), distinctes du seul paquet vette = QR lib."
  - "D-04-03-B : namespace admin mono-FR (back-office (admin) hors [locale], UI-SPEC Producer-boundary/D-09) — non soumis a la parite 3 langues ; les tests de parite sont par-namespace donc admin FR-only ne casse rien."
  - "D-04-03-C : Rule 1 faux positif lint:i18n — `& VariantProps<...>` (annotation type CVA generee par le CLI sur la ligne 26 d'alert.tsx) lu comme texte JSX par le detecteur regex ; neutralise via `// i18n-ignore` (mecanisme prevu par le script), pas de reecriture du composant."

patterns-established:
  - "Pattern parite i18n : un test __tests__/messages-parity-<ns>.test.ts par namespace, flatten recursif, garde no-perf VITR-03."
  - "Pattern shadcn manquant : ecrire le bloc main au style projet (radix-ui umbrella, cn, data-slot) plutot que changer de registry."

requirements-completed: []  # AUCUN marque complet — plan PARTIEL bloque au checkpoint QR (Task 1). PAY-01/04/05/06 + ADMIN-01/02 restent ouverts (consommes par Plans 05/06).

# Metrics
duration: ~22min
completed: 2026-06-15
---

# Phase 4 Plan 03: Couche presentation paiement (i18n + shadcn) — PARTIEL Summary

**8 blocs shadcn + form react-hook-form/zod et namespaces i18n payment (parite recursive fr/en/ar) + admin (FR) livres ; installation de la lib QR STOPPEE au checkpoint de legitimite de paquet (phase argent, bundle client).**

> STATUT : **PARTIEL — bloque au checkpoint Task 1 (vetting lib QR).** Tasks 2 et 3 (deterministes, aucune dependance non vettee) executees et committees. Task 1 = `checkpoint:human-verify` `gate="blocking-human"` → NON auto-approuvable → `pnpm add` de la lib QR NON execute.

## Performance

- **Duration:** ~22 min
- **Tasks:** 2 / 3 executees (Task 1 = checkpoint bloquant, non franchi)
- **Files modified:** 13 (9 crees, 4 modifies)

## Accomplishments
- 8 blocs shadcn ajoutes via CLI officiel radix-nova (7) + form.tsx ecrit main (1) ; existants intacts ; root layout.tsx inchange (Pitfall 7).
- Namespace `payment` member-facing : 53 cles x3 langues a parite RECURSIVE stricte (polling.steps.*, errors.*, hash.*, screenshot.*, status.*, expiredGated.*) ; copy canonique = 04-UI-SPEC Copywriting Contract ; ICU plural sur expiryBanner.
- Namespace `admin` mono-FR (membres + file de validation + dialogs reject/revoke/adjust).
- `pricing` etendu D-12 (offre decouverte consommee / early upgrade).
- Garde CI : `messages-parity-payment.test.ts` (parite recursive + no-perf VITR-03) 4/4 verts.

## Task Commits

1. **Task 2: 8 blocs shadcn + form** - `d5b38c8` (feat)
2. **Task 3: i18n payment/admin/pricing** - `1fc7b9e` (feat)
3. **Task 1: vetting + install lib QR** - **NON EXECUTE (checkpoint blocking-human)**

## Files Created/Modified
- `apps/web/src/components/ui/{table,textarea,sonner,tabs,alert,alert-dialog,progress}.tsx` - blocs shadcn officiels radix-nova.
- `apps/web/src/components/ui/form.tsx` - Form/FormField/FormItem/FormLabel/FormControl/FormDescription/FormMessage (react-hook-form + Controller), ecrit main.
- `apps/web/src/messages/{fr,en,ar}.json` - namespace payment (parite recursive) + pricing D-12 ; admin FR dans fr.json uniquement.
- `apps/web/src/messages/__tests__/messages-parity-payment.test.ts` - garde parite recursive + no-perf.
- `apps/web/package.json` - ajout sonner, react-hook-form, @hookform/resolvers.

## Decisions Made
- **D-04-03-A** : form.tsx ecrit main (absent registry nova standalone, D-02-01-D). react-hook-form + @hookform/resolvers = deps standard shadcn (registry officiel → vetting NON requis, UI-SPEC Registry Safety). Le SEUL paquet necessitant vetting argent reste la lib QR (Task 1).
- **D-04-03-B** : namespace admin mono-FR (back-office hors [locale], D-09). Tests de parite par-namespace → admin FR-only conforme.
- **D-04-03-C** : voir Deviations (faux positif lint:i18n).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Faux positif lint:i18n sur annotation de type CVA**
- **Found during:** Task 2 (blocs shadcn)
- **Issue:** Le CLI shadcn a genere dans `alert.tsx` l'annotation `}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {`. Le detecteur regex maison (`scripts/check-i18n-hardcoded.mjs`) splitte par `>` et lit le segment ` & VariantProps` comme texte JSX visible (le `&` n'est pas dans sa liste de ponctuation-code), faisant echouer `lint:i18n`.
- **Fix:** Ajout de `// i18n-ignore` en bout de ligne (mecanisme prevu par le script pour les faux positifs), sans reecrire le composant. Precedent D-02-01-F (externalisation labels shadcn).
- **Files modified:** apps/web/src/components/ui/alert.tsx
- **Verification:** `pnpm lint:i18n` exit 0 ; `pnpm typecheck` vert.
- **Committed in:** d5b38c8 (Task 2 commit)

**2. [Rule 2 - Missing critical] Test de parite payment ajoute**
- **Found during:** Task 3 (i18n)
- **Issue:** La parite recursive du namespace payment n'etait gardee que par le script du plan (one-shot). Les tests existants (theme/legal) gardent leurs namespaces en CI ; payment (53 cles, 3 langues, money phase) n'avait aucune garde de regression CI.
- **Fix:** Cree `messages-parity-payment.test.ts` (flatten recursif fr/en/ar + sentinelles sous-cles + garde no-perf VITR-03). Coherent avec messages-parity-legal.test.ts.
- **Files modified:** apps/web/src/messages/__tests__/messages-parity-payment.test.ts
- **Verification:** vitest 4/4 verts.
- **Committed in:** 1fc7b9e (Task 3 commit)

---

**Total deviations:** 2 auto-fixees (1 bug, 1 missing-critical). Aucun scope creep.
**Impact on plan:** Les deux corrections sont necessaires (garde CI verte + regression i18n durable).

## Issues Encountered
- Le CLI shadcn n'ajoute PAS `form` (absent du registry nova en standalone — confirme D-02-01-D). Resolu en ecrivant form.tsx main au style projet et en ajoutant ses deps standard.

## Known Stubs
Aucun stub. Les blocs sont des primitives UI sans source de donnees (cable par Plans 05/06). Les messages sont de la copy reelle (UI-SPEC), pas des placeholders.

## Checkpoint Blocker (Task 1 — lib QR)

> **B-04-03 (checkpoint human-verify, blocking-human) — NON FRANCHI.**

Le `pnpm add` de la lib QR n'a PAS ete execute. C'est l'unique nouveau paquet npm de la phase, ASSUMED (A9, slopcheck non execute), entrant dans le **bundle client d'une phase tout-l'argent** → legitimite NON auto-approuvable.

**Candidat nomme par le plan :** `qrcode` (mode `toString`/SVG) OU une micro-lib SVG pure. Aucune version epinglee tant que le vetting n'est pas fait.

**Ce que l'humain doit verifier AVANT install (acceptance UI-SPEC Registry Safety + threat T-04-SC/T-04-QR-NET) :**
1. **npmjs.com/package/<qr-lib>** : age du paquet, downloads hebdo, repo source public, derniere publication (paquet etabli et maintenu, pas un slopsquat).
2. **`npm view <qr-lib> scripts.postinstall`** : aucun postinstall (ni script lifecycle suspect).
3. **Rendu 100% OFFLINE** : la lib encode une string en SVG/canvas localement — AUCUN `fetch`/CDN/service QR distant, AUCUNE telemetrie (lecture du code/doc).
4. **Encode UNIQUEMENT l'adresse publique TRON** (pas de montant en parametre QR — le montant a offset est copie en texte).

**Resume-signal attendu :** `approved: <nom-lib>@<version>` avec le verdict de legitimite, OU signaler un paquet douteux → repli SVG QR maison (zero dependance).

**Apres approbation :** `pnpm --filter web add <qr-lib-verifiee>`, epingler la version dans `apps/web/package.json`, confirmer offline/no-telemetry, puis marquer 04-03 complet et cocher PAY-01/04/05/06 + ADMIN-01/02 le cas echeant (en realite ces requirements sont consommes/finalises par Plans 05/06).

## Next Phase Readiness
- **Prets pour Plans 05 (paiement) et 06 (admin/expiry) :** 8 blocs UI + form + namespaces i18n payment/admin.
- **Bloquant restant :** vetting + install lib QR (checkpoint B-04-03) avant le composant QR du PaymentPanel (Plan 05).
- Ne PAS marquer 04-03 complet dans STATE/ROADMAP tant que le vetting QR n'est pas franchi.

## Self-Check: PASSED
- 9 fichiers crees verifies presents (8 blocs ui/* + test parite).
- Commits d5b38c8 + 1fc7b9e presents dans git log.
- Task 1 (lib QR) volontairement non execute (checkpoint blocking-human).

---
*Phase: 04-paiement-usdt-mvp-abonnement-jalon-encaissement*
*Completed (partiel): 2026-06-15*
