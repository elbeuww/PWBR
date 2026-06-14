# Research Summary — Milestone v2.0 (Plateforme publique payante MENA)

**Synthesized:** 2026-06-14
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, PROJECT.md
**Confidence:** HIGH (argent/RLS/on-chain) · MEDIUM (légal MENA, scheduling cloud)

> Le cœur analytique (P1-4 : moteur de scoring + setups en base, 261/261 tests) est **livré**. Cette synthèse cadre UNIQUEMENT la nouvelle couche produit v2.0.

## Executive Summary

v2.0 est exclusivement une **couche produit** : rendre les setups accessibles à un public MENA non technique, les vendre en USDT, construire la machine d'acquisition. Le chemin minimal pour encaisser est court et précis : **vitrine + gating + paiement USDT MVP (hash → TronGrid → activation) + disclaimer validé par juriste**. Tout le reste (affiliation, Telegram, track record réel, CMS, processeur crypto automatisé) est itératif et n'est PAS un prérequis pour encaisser.

Trois domaines de risque sans lien entre eux :
1. **Argent on-chain** — cinq vecteurs d'erreur distincts dans la vérif TRC-20 (faux token, decimals 6 vs 18, réorg, rejeu hash, format adresse hex/base58) dont chacun donne un accès gratuit ou refuse de vrais paiements.
2. **Sécurité du revenu** — gating UI sans RLS expose la totalité du contenu payant via l'anon-client public.
3. **Légal non-code** — vendre des signaux à une audience MENA (Algérie : cryptos légalement interdites) sans revue juridique préalable est un bloquant structurel.

## Key Findings

### Stack (ajouts v2.0 uniquement — cœur verrouillé)
- **`next-intl 4.13.0`** — seule lib i18n conçue pour Next 15 App Router (RSC + routing localisé + pluriels arabes ICU).
- **`grammy 1.43.0`** — Telegram publication-only (`sendMessage` depuis job tsx), TS natif ESM, 10× plus téléchargé que telegraf.
- **`next-mdx-remote 6.0.0`** — rendu MDX RSC pour CMS stocké en DB Supabase.
- **`@anthropic-ai/sdk 0.104.1`** — migration moteur Max → API (contrat JSON §3 inchangé, seule l'invocation change, compatible Zod 4).
- **Clients REST maison** : TronGrid (lecture TX) + Cryptomus (webhook étage 2) — pattern data-sources existant, aucun paquet npm.
- **RTL** : propriétés logiques natives Tailwind v4 (`ms-*`/`me-*`, `rtl:`). `tailwindcss-rtl` abandonné 2022, incompatible v4.
- **Affiliation / superadmin** : 100 % Supabase + Next.js existants, aucune lib nouvelle.
- **À éviter (vérifié non maintenu)** : `tailwindcss-rtl`, `@nowpaymentsio/nowpayments-api-js` (2022), `cryptomus@0.0.0` (vide), `node-telegram-bot-api@1.1.0` (identité douteuse), next-i18next sur App Router.

### Architecture
- Segment `[locale]` enveloppe tout le front public/membre ; `(admin)` **hors** `[locale]` (back-office mono-langue, réduit la surface de traduction).
- Middleware chaîné : next-intl locale → capture `?ref` → `updateSession()` (ordre sensible).
- **Défense en profondeur** : layout gate = UX ; RLS `has_active_subscription()` (security definer) = barrière données. Les deux, jamais l'un sans l'autre.
- Frontière producteur préservée : l'utilisateur n'écrit QUE `payments(pending)` déclaratif (RLS `with check user_id=auth.uid() and status='pending'`) ; seul le serveur (service_role + TronGrid + `tx_hash UNIQUE`) transitionne vers `verified` et active l'abonnement.
- `profiles.role` (migration 0008), lu après `getUser()`, **jamais dans le JWT** (évite désync token/DB). Deux dimensions orthogonales : abonnement actif (accès signaux) vs rôle (affiliate/superadmin).
- 5 nouveaux jobs dans JOB_REGISTRY : `payment-watcher`, `subscription-expiry`, `commission-calc`, `outcome-tracker`, `telegram-publish`.
- Migrations 0008-0012 : role, subscriptions/payments, affiliates/referrals/commissions, articles, prediction_outcomes/pattern_stats/telegram_posts.

### Pitfalls critiques (top 8, priorisés argent → revenu → légal)
1. **Faux token USDT TRC-20** → vérifier le contrat officiel exact `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` (en `.env`), jamais un screenshot.
2. **Decimals 6 (pas 18)** → BigInt atomique ×10^6, zéro float sur de l'argent.
3. **Réorg / TX non solidifiée** → `only_confirmed:true` (endpoint `walletsolidity`) + `payment-watcher`.
4. **Rejeu hash** → `UNIQUE(tx_hash)` **GLOBAL** en DB (pas par user).
5. **Gating UI sans RLS** → `has_active_subscription()` sur `trade_setups`/`analyses` ; tester non-abonné → 0 ligne.
6. **Légal avant 1er cash** → revue juriste signée (conseil non agréé + crypto Algérie = bloquant structurel).
7. **Rôle dans JWT** → `profiles.role` + `getUser()` + RLS `is_superadmin()` security definer.
8. **Commission non idempotente / PII filleul** → `UNIQUE(affiliate_id, referral_id, period)`, table `referrals` sans colonne email.

## Roadmap Implications — 5 waves

1. **Wave 1 — Socle transverse** : i18n `[locale]` + RTL natif Tailwind v4 + `profiles.role` + `lib/auth/gate.ts`. Doit précéder toute UI publique (refactor RTL global sinon) et tout segment gated (primitive de rôle partagée).
2. **Wave 2 — Chemin cash** : migrations subscriptions/payments + RLS signaux + vitrine + espace membre + paiement USDT MVP (TronGrid, Route Handler nodejs, activation auto) + jobs expiry + superadmin minimal + disclaimers juriste. **Jalon : 1er abonnement encaissable.** Bloquant légal parallèle (hors code). Wave à plus haute densité de risque (tout l'argent).
3. **Wave 3 — Track record & preuve** : `outcome-tracker` (setups expirés → candles → `prediction_outcomes`/`pattern_stats`) + % mesuré sur vitrine + `telegram-publish` (grammY). Parallélisable avec W2, placé après par priorité.
4. **Wave 4 — Acquisition & ops** : affiliation (tables + capture `?ref` + dashboard affilié + `commission-calc` idempotent + payout manuel) + CMS articles (`next-mdx-remote`) + superadmin enrichi. Dépend de W2 (abonnements actifs pour compter les referrals).
5. **Wave 5 — Automatisation** : processeur Cryptomus (webhook nodejs, signature MD5 corps brut) + migration moteur Max → `@anthropic-ai/sdk` + scheduling cloud + payout on-chain (TronWeb, job isolé, secret manager).

**Arêtes critiques :** i18n avant toute UI · RLS signaux avant exposition espace membre · subscriptions avant affiliation · outcomes avant Telegram & % vitrine · paiement MVP avant processeur.

## Research Flags (recherche de phase recommandée)
- **W2 (TronGrid)** : endpoint `walletsolidity`, parsing logs TRC-20, normalisation hex↔base58. Doc TS peu dense.
- **W3 (outcome-tracker)** : critère de succès d'un setup non tranché (TP1 ? TP2 ? fenêtre temporelle ?) — décision produit avant implémentation.
- **W5 (Cryptomus webhook)** : validation sandbox ; doc MEDIUM confidence.
- **W5 (scheduling cloud)** : choix d'infra (GitHub Actions vs Railway vs Supabase pg_cron) non tranché.

**Patterns standards (pas de recherche)** : W1 next-intl (doc complète), W2 gating RSC+RLS (pattern journal privé P1 déjà au repo), W3 grammY `sendMessage`, W4 affiliation Supabase (jobs idempotents déjà livrés).

## Gaps / Hypothèses
- Revue juridique = bloquant non-code, gate de lancement W2 en prod.
- Critère de succès d'un setup (W3) à trancher en planning.
- Scheduling cloud (W5) non tranché.
- Cold wallet opérationnel = prérequis hors code de W2.
- Traductions arabes du raisonnement IA : contenu généré FR/EN affiché tel quel dans l'UI arabe au MVP (hypothèse documentée, acceptable).
