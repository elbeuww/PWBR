# Stack Research — v2.0 Plateforme publique (couche produit)

**Domain:** Plateforme SaaS par abonnement (signaux trading) — paiement crypto, i18n trilingue RTL, Telegram, CMS, affiliation
**Researched:** 2026-06-14
**Confidence:** HIGH (versions npm vérifiées 2026-06-14 ; patterns d'intégration recoupés docs officielles)

> **Périmètre :** UNIQUEMENT les briques neuves de la couche produit v2.0. La stack cœur (Next.js 15, Supabase, Tailwind v4, shadcn/ui, react-query 5, Zod 4, luxon, lightweight-charts 5, recharts 3, monorepo pnpm) est **verrouillée et livrée** — voir CLAUDE.md §Technology Stack. Ne PAS re-rechercher ni remplacer.

---

## Synthèse des ajouts (TL;DR)

| Brique v2.0 | Décision | Lib / Version | Nouvelle dépendance ? |
|-------------|----------|---------------|------------------------|
| 1a. Paiement USDT MVP (vérif TX hash) | **TronGrid REST direct** (fetch + Zod), pas de SDK | aucune lib (client maison) | Non — réutilise le pattern data-sources |
| 1a. Conversion adresse TRON hex↔base58 | `tron-format-address` | `0.1.12` | Oui (micro, optionnel) |
| 1b. Processeur crypto auto (étage 2) | **Cryptomus** (REST + webhook HMAC), client maison | aucune lib (client maison) | Non |
| 2. i18n trilingue AR(RTL)/EN/FR | **next-intl** | `4.13.0` | Oui |
| 2. RTL avec Tailwind v4 | **Propriétés logiques natives** (ms-*/me-*, `rtl:`) + `dir` attr | aucune lib | Non |
| 3. Bot/canal Telegram | **grammY** | `1.43.0` (+ `@grammyjs/runner 2.0.3` si long-polling) | Oui |
| 4. CMS articles/cours | **Table Supabase + MDX serialisé** | `next-mdx-remote 6.0.0` (+ `gray-matter 4.0.3` si fichiers) | Oui (léger) |
| 5. Affiliation / superadmin | **100 % Supabase + Next.js existant** | aucune | Non |
| 6. Fiabilité 24/7 (moteur IA) | **@anthropic-ai/sdk** + scheduler cloud | `@anthropic-ai/sdk 0.104.1` | Oui |

---

## 1. Paiement crypto USDT TRC-20 on-chain

### Étage 1 (MVP) — Vérification d'un TX hash soumis par l'utilisateur

**Décision : appeler TronGrid en REST direct (`fetch` + parsing Zod), PAS TronWeb.**

| Option | Verdict | Pourquoi |
|--------|---------|----------|
| **TronGrid REST direct** | ✅ **Retenu** | Vérifier UN hash = 1 appel `gettransactioninfobyid`. TronWeb (`6.3.0`, 2.5 Mo, expose signature de TX, gestion de clés privées) est surdimensionné et porte une **surface de risque** (clés) inutile en lecture seule. Le projet a déjà 6 clients data-sources fetch+Zod golden-testés — même pattern, cohérence totale, zéro nouvelle dépendance. |
| TronWeb `6.3.0` | ❌ Évité MVP | Maintenu (publié 2026-04-22) mais lourd ; utile seulement si on signe/broadcast des TX (paiement de commissions affiliés on-chain — voir étage 2). |

**Endpoint clé (mainnet `https://api.trongrid.io`) :**
- `POST /walletsolidity/gettransactioninfobyid` avec `{ value: "<txid>", only_confirmed: true }` → renvoie les `log[]` (events) du contrat TRC-20.
- Parser l'event `Transfer(address,address,uint256)` : `topics[1]`=from, `topics[2]`=to, `data`=montant (decimals USDT = 6). Vérifier `to == wallet plateforme`, `montant >= dû`, statut `SUCCESS`.
- Confirmations : `only_confirmed: true` ne renvoie que les TX au-delà de la fenêtre de solidification (~19 blocs / ~1 min). C'est la garantie anti-réorg recommandée pour activer un abonnement.
- Contrat USDT TRC-20 à whitelister : `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`.

**Sécurité / garde-fous (frontière de confiance, comme `persist.ts`) :**
- Adresse plateforme et contrat USDT en `.env` / config, **jamais** saisis par l'utilisateur.
- Idempotence : `UNIQUE` sur `tx_hash` en DB (un hash ne crédite qu'une fois — anti-rejeu). Même discipline upsert que l'ingestion.
- Anti double-usage : refuser un hash déjà associé à un autre compte.
- File de validation superadmin pour les cas tordus (montant partiel, mauvais réseau, confirmations insuffisantes).
- Clé API TronGrid gratuite recommandée (header `TRON-PRO-API-KEY`) pour relever le rate limit ; `p-retry` + `p-limit` déjà dans la stack.

**Lib utilitaire optionnelle :** `tron-format-address 0.1.12` (hex↔base58) pour normaliser les adresses extraites des topics (format hex `41…`) vers base58 (`T…`) avant comparaison. Léger, sans dépendance. Alternative : conversion maison (~20 lignes).

### Étage 2 — Processeur crypto automatisé

**Décision : Cryptomus (client REST maison fetch+Zod), avec NOWPayments en alternative.**

| Critère | **Cryptomus** ✅ | NOWPayments |
|---------|------------------|-------------|
| Adresse unique par facture | Oui (modèle invoice/static wallet) | Oui (deposit address temporaire — appartient à NOWPayments) |
| Webhook signature | **MD5 du `base64(json)` + payment API key** | HMAC-SHA512 (payload trié par clé avant hash — piège classique) |
| SDK npm officiel maintenu | ❌ Aucun fiable (`cryptomus@0.0.0` = vide/squat ; SDK Go tiers existe) | ❌ `@nowpaymentsio/nowpayments-api-js@1.0.5` **abandonné (2022)** |
| API-first / MENA-friendly | Oui (orienté API, accepte USDT TRC-20) | Oui mais orienté hosted checkout |

> **Aucun SDK npm n'est fiable des deux côtés** → dans les deux cas, **client REST maison** (cohérent avec OANDA/Marketaux/FRED déjà faits maison). Cryptomus retenu pour son modèle invoice + USDT TRC-20 natif, audience MENA.

**Vérification de signature webhook (CRITIQUE — argent) :**
- Cryptomus : `md5( base64( json_payload_brut ) + PAYMENT_API_KEY )` comparé au champ `sign` reçu. **Comparer sur le corps brut**, pas sur l'objet re-sérialisé (l'ordre des clés casserait le hash).
- Implémenter dans une **Route Handler Next.js** (`app/api/webhooks/cryptomus/route.ts`) avec `export const runtime = 'nodejs'` (besoin de `crypto` Node + corps brut via `await req.text()`), jamais Edge.
- Idempotence sur `order_id` / `uuid` de paiement (rejeu webhook = no-op).
- Whitelist d'IP source du provider en complément de la signature.

**Commissions affiliés en crypto (paiement sortant) :** hors MVP. Si automatisé plus tard, c'est le seul cas qui justifie **TronWeb `6.3.0`** (signer/broadcast une TX) — à isoler dans un job, clé privée en cold/secret manager **jamais en DB ni en code** (contrainte PROJECT.md). Recommandation : commencer en **paiement manuel** (le superadmin paie, trace en DB).

---

## 2. i18n trilingue AR(RTL) / EN / FR — Next.js 15 App Router

**Décision : next-intl `4.13.0`.**

| Option | Verdict | Pourquoi |
|--------|---------|----------|
| **next-intl** | ✅ **Retenu** | Conçu **pour l'App Router** (RSC + Client Components), routing localisé natif (`/ar`, `/en`, `/fr`), middleware de détection, formatage ICU (pluriels arabes), `setRequestLocale` pour le rendu statique. peerDep `next: ^15 \|\| ^16` ✓ React 19 ✓. Maintenu activement (publié 2026-06-05). Standard de facto App Router. |
| next-i18next `16.0.7` | ❌ | Construit autour du **Pages Router** / `getServerSideProps`. Sur App Router c'est de la rame (wrappers i18next manuels). Inutilement complexe ici. |
| react-i18next nu | ❌ | Pas de routing localisé ni d'intégration RSC — il faut tout recâbler. |

**Intégration Next 15 :**
- Routing : `[locale]` segment + `middleware.ts` next-intl pour redirection/détection. Locales `['ar','en','fr']`, défaut au choix produit (probablement `ar` pour MENA).
- RSC : messages chargés serveur via `getMessages()` ; composants client via `<NextIntlClientProvider>`.
- Rendu statique vitrine : `setRequestLocale(locale)` dans chaque page/layout pour garder le SSG.
- Messages JSON par namespace (`vitrine`, `signaux`, `legal`…) pour ne pas tout charger.

**RTL avec Tailwind v4 — AUCUN plugin nécessaire.**
- Tailwind v4 supporte nativement les **propriétés logiques** : utiliser `ms-*`/`me-*` (margin), `ps-*`/`pe-*` (padding), `start-*`/`end-*` (inset), `text-start`/`text-end` au lieu de `ml/mr/pl/pr/left/right/text-left`. Elles s'inversent automatiquement selon `dir`.
- Mettre `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>` dans le layout racine `[locale]`.
- Variants `rtl:` / `ltr:` disponibles pour les exceptions ponctuelles (icônes directionnelles, flèches).
- ⚠️ **NE PAS** installer `tailwindcss-rtl` (`0.9.0`, **abandonné 2022**, incompatible config CSS-first de Tailwind v4) ni `tailwindcss-logical` (redondant — v4 l'intègre).
- Police arabe : ajouter une font arabe (ex. via `next/font`) et la mapper sur `:lang(ar)`.

---

## 3. Bot / canal Telegram (publication automatisée)

**Décision : grammY `1.43.0`.**

| Option | Downloads/sem | Verdict | Pourquoi |
|--------|---------------|---------|----------|
| **grammY** | **~3.83 M** | ✅ **Retenu** | TS natif (types Bot API à jour), **ESM + CJS**, API moderne, plugins (sessions, runner, menus), excellente doc, très maintenu (2026-05-16). Aligné sur les jobs ESM/tsx existants. |
| telegraf | ~0.38 M | ❌ | Historique, maintenance ralentie, types moins frais. grammY est son successeur de facto. |
| node-telegram-bot-api | ~0.27 M | ❌ | Le package npm a été **repris/réécrit récemment** (v`1.1.0`, desc « modern TypeScript rewrite ») — historiquement c'était l'API callback `0.6x`. Identité/continuité douteuses → éviter pour un usage prod. |

**Usage pour ce projet (publication, pas de bot interactif) :**
- Cas principal = **poster dans un canal** (résultats journaliers + win rate). Pas besoin de recevoir des updates → un simple `bot.api.sendMessage(CHANNEL_ID, …)` suffit, appelable depuis un **job tsx** existant. Pas de webhook ni de long-polling nécessaire pour ça.
- `@grammyjs/runner 2.0.3` UNIQUEMENT si on ajoute plus tard un bot interactif en long-polling (commandes utilisateur). Pas requis MVP.
- Token bot en `.env` (jamais commité). Rate limit Telegram : ~1 msg/s par canal — `p-limit` déjà dispo.
- Formatage : `parse_mode: 'HTML'` ou MarkdownV2 ; attention à l'échappement (MarkdownV2 est strict).

---

## 4. CMS articles / cours vulgarisés

**Décision : Table Supabase pour le contenu + `next-mdx-remote 6.0.0` pour le rendu. Éviter tout headless CMS externe.**

| Option | Verdict | Pourquoi |
|--------|---------|----------|
| **Supabase table + MDX sérialisé** | ✅ **Retenu** | Une table `articles` (slug, locale, title, body_mdx, status, published_at). Édition via le **dashboard superadmin déjà à construire** (textarea MDX + preview). Contenu **trilingue** → la colonne `locale` colle au besoin i18n. RLS : public lit `status='published'`, superadmin écrit. Rendu serveur via `next-mdx-remote/rsc` (compatible RSC). Zéro infra/coût supplémentaire, une seule source de vérité (Postgres). |
| MDX fichiers (`@next/mdx` + `gray-matter`) | ⚠️ Alternative | Bon si le contenu est versionné en Git et écrit par des devs. Mais ici contenu **non technique, trilingue, édité par le fondateur/équipe** sans redéploiement → la DB est meilleure. `gray-matter 4.0.3` (stable, frozen) seulement si on garde le front-matter fichier. |
| Headless CMS (Sanity, Strapi, Payload…) | ❌ Évité | Sur-ingénierie + coût/hébergement + 2e source de vérité + 2e système d'auth. Le superadmin Supabase couvre le besoin. |

**Notes :** `next-mdx-remote 6.0.0` (publié 2026-02) supporte RSC. Sanitiser/limiter les composants MDX autorisés (le contenu vient de la DB → traiter comme entrée semi-fiable, pas de composants arbitraires côté éditeur multi-utilisateur). Pour de la prose simple, Markdown pur (`react-markdown`) suffirait — n'introduire MDX que si on veut des composants riches (charts, encarts).

---

## 5. Affiliation / superadmin

**Décision : 100 % Supabase + Next.js existant. AUCUNE nouvelle librairie.**

- **Modèle de données** (nouvelles tables) : `affiliates` (user_id, code promo unique, palier, taux), `referrals` (affiliate_id, referred_user_id, subscribed_at), `commissions` (referral_id, period, amount_usdt, status, paid_at). Tout en migrations SQL Supabase (source de vérité unique, comme le cœur).
- **Calcul des commissions** = job déterministe tsx (récurrent, 20 % max des abos actifs ramenés) → même runner `job_runs` déjà livré. Idempotent par `(affiliate_id, period)`.
- **Tracking code promo** : capter `?ref=CODE` → cookie → attacher à l'inscription. Pur Next.js (middleware/route handler).
- **Superadmin** : routes Next.js gated par rôle (claim `role=admin` dans Supabase Auth / table `profiles.role`), RLS stricte. Tables shadcn/ui (déjà dispo) pour les vues membres/affiliés/paiements/santé jobs. react-query (déjà dispo) pour les listes.
- **RLS** : un affilié ne voit que SES referrals/commissions ; superadmin voit tout (policy `role='admin'`). Tests RLS Playwright comme déjà fait pour le journal privé.

Rien à ajouter — le stack existant (Supabase RLS + jobs + shadcn + react-query) couvre intégralement.

---

## 6. Fiabilité 24/7 — Migration routines Max → API Anthropic

**Décision : `@anthropic-ai/sdk 0.104.1` + scheduler cloud (infra non tranchée ici).**

- **SDK** : `@anthropic-ai/sdk 0.104.1` (publié 2026-06-09, très actif). peerDep `zod ^3.25 || ^4` → **compatible Zod 4** de la stack ✓. ESM/CJS ✓. À appeler depuis `apps/jobs` (la routine d'analyse `persist.ts` reste la frontière de confiance — le SDK ne change que la **source du raisonnement**, plus l'agent Max).
- **Pattern** : remplacer l'appel agent par `client.messages.create({ model, system: prompt_versionné_sha256, messages, … })`. Le prompt versionné + garde-fous Zod + scoring déterministe sont **déjà livrés** → migration = changer l'invocation, pas le contrat JSON §3. Activer `prompt caching` (system prompt stable) pour réduire le coût.
- **Clé** `ANTHROPIC_API_KEY` en `.env`/secret manager (jamais commitée). Modèle : choisir un modèle Claude courant au moment du lancement (à fixer lors de l'implémentation, pas figé ici).
- **Scheduling cloud (à noter, choix d'infra reporté)** : options crédibles — GitHub Actions cron (déjà utilisé en CI, gratuit, simple), Supabase Edge Functions + `pg_cron`/`pg_net`, ou un petit worker (Railway/Fly/Render) avec `croner 10.0.1` (déjà dans la stack). **Aucun verrou requis maintenant** ; Windows Task Scheduler reste le backup d'ingestion déterministe. Jobs déjà idempotents → migration cloud sans risque de double-exécution.
- **Coût** : passage de « 0 token » (Max) à facturation API → à budgéter au lancement payant (cohérent avec la décision PROJECT.md 2026-06-13).

---

## Installation

```bash
# apps/web — i18n
pnpm --filter web add next-intl@4.13.0

# apps/web ou package partagé — rendu CMS (si MDX retenu)
pnpm --filter web add next-mdx-remote@6.0.0
pnpm --filter web add gray-matter@4.0.3   # seulement si contenu en fichiers

# apps/jobs — Telegram + moteur IA
pnpm --filter jobs add grammy@1.43.0
pnpm --filter jobs add @anthropic-ai/sdk@0.104.1
pnpm --filter jobs add @grammyjs/runner@2.0.3   # seulement si bot interactif long-polling

# packages/data-sources (ou payments) — utilitaire TRON optionnel
pnpm --filter @repo/data-sources add tron-format-address@0.1.12

# TronGrid + Cryptomus = clients fetch+Zod MAISON (aucun paquet npm)
# RTL = natif Tailwind v4 (aucun paquet)
# Affiliation/superadmin = Supabase + Next.js existants (aucun paquet)
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| TronGrid REST maison | TronWeb `6.3.0` | Uniquement pour **signer/broadcast** des TX (payer les commissions affiliés on-chain automatiquement). Pas pour de la lecture. |
| Cryptomus (client maison) | NOWPayments (client maison) | Si on veut un hosted checkout clé en main / branding spécifique. Vérif signature HMAC-SHA512 avec payload trié. |
| next-intl `4.13.0` | next-i18next `16.0.7` | Seulement si on migrait vers Pages Router (on ne le fera pas). |
| RTL natif Tailwind v4 | — | Aucun plugin RTL nécessaire ni recommandé sur v4. |
| grammY `1.43.0` | telegraf `4.16.3` | Si une lib tierce impose telegraf. Sinon grammY supérieur. |
| Supabase + MDX (DB) | `@next/mdx` fichiers + `gray-matter` | Si contenu versionné en Git, écrit par devs, peu fréquent. |
| @anthropic-ai/sdk | (rester agent Max) | Tant qu'aucun abonné payant / fiabilité 24/7 non critique. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `tailwindcss-rtl` `0.9.0` | **Abandonné 2022**, incompatible Tailwind v4 (config CSS-first) | Propriétés logiques natives v4 (`ms-*`, `pe-*`, `start-*`, `rtl:`) |
| `tailwindcss-logical` | Redondant — Tailwind v4 intègre les logical properties | Natif v4 |
| `@nowpaymentsio/nowpayments-api-js` `1.0.5` | **Abandonné 2022**, types obsolètes | Client REST maison (NOWPayments ou Cryptomus) |
| `cryptomus` `0.0.0` (npm) | Package **vide / squat** | Client REST maison Cryptomus |
| `node-telegram-bot-api` `1.1.0` | Package **repris/réécrit**, continuité d'identité douteuse, API callback historique | grammY |
| `next-i18next` sur App Router | Pensé pour Pages Router/`getServerSideProps` | next-intl |
| Headless CMS externe (Sanity/Strapi/Payload) | Sur-ingénierie, coût, 2e source de vérité + 2e auth | Table Supabase + superadmin |
| TronWeb pour vérifier un hash | 2.5 Mo + surface de risque clés privées pour de la lecture seule | TronGrid REST direct |
| ORM (Drizzle/Prisma) pour affiliation | Dédouble la source de vérité schéma (migrations SQL Supabase) | Client Supabase typé + repositories (déjà en place) |
| Webhook crypto en Edge runtime | Besoin du corps brut + `crypto` Node pour vérifier la signature | Route Handler `runtime='nodejs'` |

---

## Stack Patterns by Variant

**Si lancement immédiat (étage 1 paiement) :**
- TronGrid REST maison + file superadmin. Pas de dépendance tierce de paiement.
- Telegram = `sendMessage` depuis un job tsx (pas de runner).

**Si automatisation paiement (étage 2) :**
- Ajouter client Cryptomus maison + Route Handler webhook `nodejs` + vérif signature MD5.
- Adresse unique par facture, idempotence sur `order_id`.

**Si commissions affiliés payées on-chain automatiquement (plus tard) :**
- Introduire TronWeb `6.3.0` dans un job isolé, clé privée en secret manager.

**Si bot Telegram devient interactif (v2+) :**
- Ajouter `@grammyjs/runner` (long-polling) ou webhook grammY via Route Handler.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| next-intl `4.13.0` | Next 15 & 16, React 19 | peerDep `next: ^12..^16`, `react: ^19` ✓ App Router natif |
| @anthropic-ai/sdk `0.104.1` | Zod 4 (stack) | peerDep `zod ^3.25 \|\| ^4` ✓ — pas de conflit avec Zod 4 verrouillé |
| grammY `1.43.0` | jobs ESM/tsx | ESM + CJS ✓ |
| next-mdx-remote `6.0.0` | Next 15 RSC | import `next-mdx-remote/rsc` pour Server Components |
| Tailwind v4.3 | RTL natif | Propriétés logiques + variants `rtl:`/`ltr:` — aucun plugin |
| tron-format-address `0.1.12` | — | Micro-lib, zéro dépendance |

---

## Sources

- npm registry (vérifié 2026-06-14) — versions `latest` + dates : tronweb 6.3.0 (2026-04-22), next-intl 4.13.0 (2026-06-05, peerDep next ^15||^16 / react ^19), grammy 1.43.0 (2026-05-16), telegraf 4.16.3, node-telegram-bot-api 1.1.0 (repris), @anthropic-ai/sdk 0.104.1 (2026-06-09, peerDep zod ^3.25||^4), next-mdx-remote 6.0.0 (2026-02), gray-matter 4.0.3, tailwindcss-rtl 0.9.0 (stale 2022), @nowpaymentsio/nowpayments-api-js 1.0.5 (stale 2022), cryptomus 0.0.0 (vide), tron-format-address 0.1.12, @grammyjs/runner 2.0.3 — **HIGH**
- npm downloads API (last-week, 2026-06-14) — grammy 3.83M >> telegraf 0.38M >> node-telegram-bot-api 0.27M — **HIGH**
- [TronGrid / TRON dev docs — gettransactioninfobyid, TRC-20 events](https://developers.tron.network/docs/trc20-contract-interaction) — vérif TX (events Transfer, only_confirmed, decimals 6) — **HIGH**
- [TRON exchange/wallet integration guide](https://developers.tron.network/docs/exchangewallet-integrate-with-the-tron-network) — confirmations / solidification — **MEDIUM**
- [Cryptomus webhook docs](https://doc.cryptomus.com/merchant-api/payments/webhook) — signature MD5(base64(json)+key) — **MEDIUM** (recoupé doc officielle)
- [NOWPayments vs Cryptomus 2026](https://nowpayments.io/blog/nowpayments-vs-cryptomus) + [comparatif](https://slashdot.org/software/comparison/Cryptomus-vs-NOWPayments/) — modèles adresse/webhook — **MEDIUM**
- [Tailwind CSS v4 — logical properties / RTL](https://tailwindcss.com/blog/tailwindcss-v4) + [Flowbite RTL](https://flowbite.com/docs/customize/rtl/) — RTL natif sans plugin — **HIGH**
- CLAUDE.md §Technology Stack + PROJECT.md (contraintes pivot, sécurité clés) — **HIGH** (source projet)

---
*Stack research for: v2.0 plateforme publique (paiement crypto, i18n RTL, Telegram, CMS, affiliation, fiabilité 24/7)*
*Researched: 2026-06-14*
