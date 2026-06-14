# 02-SECURITY.md — Audit de mitigation des menaces

**Phase :** 02 — Vitrine publique trilingue & gate légal
**Mode :** Vérification de mitigations (register figé au plan-time, 3 blocs `threat_model`)
**ASVS Level :** 1
**block_on :** high
**Verdict :** ✅ SECURED — 12/12 menaces résolues (9 mitigate CLOSED, 3 accept CLOSED)
**Menaces ouvertes (`threats_open`) :** 0
**Commit audité :** 3cf3c67
**Date :** 2026-06-14

---

## Résumé

Register STRIDE consolidé (12 menaces uniques : 9 `mitigate`, 3 `accept`). Chaque
mitigation déclarée a été confirmée par lecture du code et grep ciblé dans les
fichiers cités au plan. Aucune mitigation absente. Les 3 menaces `accept` (T-02-03,
T-02-08, T-02-11 — régressions de résolution locale) sont consignées comme risques
acceptés ci-dessous. Aucune surface de sécurité hors register (les 3 SUMMARY
déclarent « Threat Flags : aucune »).

Aucun fichier d'implémentation modifié (audit en lecture seule).

---

## Vérification des menaces

| Threat ID | Catégorie | Disposition | Statut | Preuve (fichier:ligne) |
|-----------|-----------|-------------|--------|------------------------|
| T-02-SC | Tampering (supply chain) | mitigate | CLOSED | `apps/web/package.json:13,18,20-21,24-26` — versions exactes épinglées (next-themes `0.4.6`, lucide-react `1.18.0`, @fontsource `5.2.9`, deps shadcn `radix-ui 1.5.0`/`cva 0.7.1`/`clsx 2.1.1`/`tailwind-merge 3.6.0`). Checkpoint AR-01-SC tracé 02-01-SUMMARY (« approuvé par l'humain avant exécution, 3 paquets vérifiés npmjs, zéro postinstall »). 02-02/02-03 n'installent rien (n/a confirmé). |
| T-02-01 | Tampering (init shadcn écrase globals) | mitigate | CLOSED | `apps/web/src/styles/globals.css:108` — `:lang(ar){` survit. shadcn init committé séparément (013eccf, D-02-01-E) ; tokens marque surchargés en Task 3 ; root layout Geist restauré en pass-through (Auto-fix #3, 02-01-SUMMARY). |
| T-02-02 | Information Disclosure (hydration mismatch / FOUC) | mitigate | CLOSED | `apps/web/src/app/[locale]/layout.tsx:47` `suppressHydrationWarning` sur `<html>` ; `:50` `ThemeProvider attribute="class"` ; `ThemeProvider.tsx:12` wrapper next-themes (script pré-paint). |
| T-02-03 | Input Validation (régression résolution locale) | accept | CLOSED | Risque accepté — voir log ci-dessous. Greffe chirurgicale ; `layout.tsx:37` `hasLocale`/`:38` `notFound()` inchangés. |
| T-02-04 | Tampering / Info Disclosure (param `[doc]` arbitraire / énumération) | mitigate | CLOSED | `app/[locale]/(marketing)/legal/[doc]/page.tsx:18` allowlist `DOCS` ; `:20` `generateStaticParams` ; `:30-32` `notFound()` AVANT rendu (avant `setRequestLocale`/`getTranslations`). Mirror allowlist `Footer.tsx:23`. |
| T-02-05 | Elevation of Privilege (bypass gate légal) | mitigate | CLOSED | `lib/legal-gate.ts:1` `import 'server-only'` ; `:20` `=== 'true'` (défaut sûr false). Testé `lib/__tests__/legal-gate.test.ts:28-42` (absent/valeurs ≠ true ⇒ false ; seul `'true'` exact ⇒ true). `.env.example:2` `LEGAL_REVIEW_DONE=false`. Consommé par P4 uniquement (non appelé en P2). |
| T-02-06 | Information Disclosure (faux texte légal IA) | mitigate | CLOSED | `legal/[doc]/page.tsx:39` rend `t('reviewPending')` (placeholder « en cours de revue »), aucun corps CGU/risques. `docs/legal/LEGAL-REVIEW.md:3` statut « ⛔ NON VALIDÉ », checklist + Sign-off vierge, mention explicite « aucun texte légal faisant foi ». |
| T-02-07 | Tampering (XSS via contenu légal) | mitigate | CLOSED | Grep `dangerouslySetInnerHTML` sur `apps/web/src` = 0. Texte = clés i18n (`legal/[doc]/page.tsx:38-39`, `Disclaimer.tsx:14` `t('footer')`). Aucun MDX/HTML brut. |
| T-02-08 | Input Validation (régression résolution locale, layout modifié) | accept | CLOSED | Risque accepté — voir log. `layout.tsx` : un seul `<html>` (`:44`), `hasLocale`/`notFound` (`:37-38`) intacts ; seule la greffe slot `<Footer />` (`:60`) ajoutée. |
| T-02-09 | Info Disclosure / Conformité (allégation de perf / promesse de gain) | mitigate | CLOSED | `(marketing)/page.tsx:18` `SHOW_PROOF = false` ; `:56` slot rendu `null`. Test `apps/web/test/no-perf-claims.test.ts:37` regex `%|garanti|guaranteed|profit|rentable` scanne `home`/`pricing`/`paiement` × fr/en/ar (`:27,68-81`), sanity « 90% » non trivial (`:57-59`). |
| T-02-10 | Tampering (fausse adresse USDT / faux flux paiement) | mitigate | CLOSED | Grep `wallet/usdt+addr/0x.../T{33}/qrcode/tx_hash` sur `(marketing)` = 0. `paiement-bientot/page.tsx` purement informatif (`t('title')`/`t('body')`, zéro flux). `tarifs/page.tsx:44,66` mention `USDT (TRC-20)` sans adresse. Paiement réel = P4. |
| T-02-11 | Input Validation (régression résolution locale nouvelles pages) | accept | CLOSED | Risque accepté — voir log. Pages RSC standard sous `[locale]` (home/tarifs/paiement-bientot/legal) ; `hasLocale`/`notFound` au layout P1 inchangés. |
| T-02-12 | Spoofing / Auth (recâblage involontaire de l'auth) | mitigate | CLOSED | `(auth)/actions.ts:53` succès signup → `redirect({ href: '/paiement-bientot', locale })` via `@/i18n/navigation`. `signUp` (`:44`) appelle `supabase.auth.signUp` inchangé ; aucun `getUser`/`getSession` modifié. Grep `getSession` sur `apps/web/src` = 1 occurrence unique = commentaire de doc `lib/supabase/middleware.ts:10` (invariant P1, conforme). |

---

## Log des risques acceptés

Les 3 menaces ci-dessous sont disposées `accept` au plan. Couverture résiduelle =
greffe chirurgicale du layout P1 (frontières d'entrée `hasLocale`/`notFound`/un-seul-`<html>`
inchangées) + couverture E2E i18n héritée de la Phase 1.

| Threat ID | Catégorie | Justification de l'acceptation | Contrôle résiduel vérifié |
|-----------|-----------|-------------------------------|---------------------------|
| T-02-03 | Input Validation — régression résolution locale | Modifications limitées à la greffe layout (ThemeProvider/ThemeToggle) ; pas de changement de la logique de résolution locale. | `layout.tsx:37-38` `hasLocale`/`notFound` intacts ; couvert E2E i18n P1. |
| T-02-08 | Input Validation — régression résolution locale (slot Footer) | Greffe chirurgicale du slot `<Footer />` ; un seul `<html lang dir>` préservé. | `layout.tsx:44` un seul `<html>` ; `:37-38` frontière d'entrée intacte. |
| T-02-11 | Input Validation — régression résolution locale (nouvelles pages) | Nouvelles pages = RSC standard sous `[locale]`, ne touchent pas la résolution locale (au layout). | `hasLocale`/`notFound` au layout P1 inchangés ; pages consomment `setRequestLocale`. |

---

## Surfaces non enregistrées (Threat Flags)

Aucune.

- 02-01-SUMMARY : pas de section `## Threat Flags` (plan design system, aucune surface sécurité — auth non touchée).
- 02-02-SUMMARY `## Threat Flags` : « Aucune surface de sécurité hors threat_model » (mappe T-02-04/05/06/07).
- 02-03-SUMMARY `## Threat Flags` : « Aucune nouvelle surface hors threat_model » (mappe T-02-09/10/12).

Tous les flags des SUMMARY mappent vers des Threat IDs existants → informationnel, aucun `unregistered_flag`.

---

## Notes d'audit

- Code review déjà passé (02-REVIEW.md, 0 blocker ; 2 WARN cosmétiques CSS corrigés à fb7ab47). Cet audit est orthogonal (vérification de mitigations, pas scan net-new).
- Invariant auth `getUser`-jamais-`getSession` posé en P1 ; seule occurrence `getSession` du codebase = commentaire doc `middleware.ts:10`. Aucune régression introduite en P2.
- ASVS L1 / block_on=high : 0 menace ouverte, 0 finding HIGH+ → phase autorisée à shipper.
