# Plateforme d'Analyse de Trading "Vétéran"

## What This Is

**Plateforme publique par abonnement (9 $/mois, payé en USDT)** donnant accès à un outil d'analyse des marchés et à des **signaux de trade complets** : point d'entrée, take-profits, stop-loss, marge/levier suggéré si souhaité, score /100, niveau de risque — avec, pour chaque trade, **toute l'analyse (chartique + fondamentale + news) qui justifie le signal**, expliquée d'abord simplement, puis en profondeur pour qui veut comprendre le pourquoi.

Chaque signal affiche un **pourcentage de réussite visible** : au lancement, le taux mesuré par backtest maison du pattern détecté ; avec le temps, le track record réel de la plateforme.

**Audience cible** : Algérie d'abord, Afrique du Nord et Moyen-Orient ensuite — un public **non technique**. Tout est vulgarisé, rien n'est jargonneux. **Trilingue : arabe (RTL), anglais, français.**

**Le produit (penser comme une société d'une cinquantaine de personnes — construire tous les outils dont elle aurait besoin)** :
- **Vitrine publique** : présentation, % de réussite affiché, cours/articles gratuits qui partent de zéro (« c'est quoi un portefeuille ? »…), funnel d'abonnement.
- **Espace membre (payant)** : signaux + analyses détaillées + outil d'analyse du marché.
- **Paiement crypto** : abonnement réglé en USDT vers un portefeuille de la plateforme ; détection automatique des paiements on-chain et association paiement → compte (activation/expiration d'abonnement sans intervention manuelle).
- **Affiliation à paliers** (stratégie influenceurs) : codes promo pour tracer les abonnés ramenés, dashboard affilié (abonnés, revenus, paiements), commissions payées en crypto. Palier maximum : **20 % récurrent des abonnements ramenés** (ex. 1 000 abonnés × 9 $ → 1 800 $/mois).
- **Dashboard superadmin** : vue claire des membres (actifs/inactifs, état de paiement), des affiliés et de leurs performances, des signaux publiés, de la santé des jobs/données.
- **Canal Telegram public** : résultats journaliers des trades partagés + **% de trades gagnants visible en permanence** (canal d'acquisition).

L'IA se comporte comme un trader vétéran (50 ans d'expérience). L'analyse chartique s'appuie sur un catalogue de patterns dont le taux de réussite est **mesuré par backtest maison — jamais affirmé sans mesure**.

## Core Value

Produire, pour chaque opportunité, une analyse fiable et explicable — score /100 + niveau de risque + plan de trade (entrée/SL/TP/R:R/levier) — vulgarisée pour un public non technique. Si tout le reste échoue, **la qualité et la traçabilité de l'analyse d'un trade** doit fonctionner : le % de réussite affiché est toujours mesuré, jamais inventé — c'est le socle de confiance qui fait payer l'abonnement.

## Current Milestone: v3.0 — Plateforme complète sous identité dark néon NEXA

**Goal :** Faire de NEXA une plateforme pleinement fonctionnelle et scalable (dizaines de milliers d'utilisateurs), unifiée sous l'identité **dark néon** de la landing, avec **dashboards utilisateur et superadmin** complets, construite sur **données seedées** (branchement des vraies API/signaux/paiement reporté).

**Target features :**
- **Design system v3 « dark néon unique »** : promotion de l'identité de la landing (composants `.nxl`, thème volt/green OKLCH) en design system **global**, thème **dark unique**, en remplacement du DS NEXA light/dark institutionnel des phases 10-11. Polices conservées (Archivo / Chakra Petch / Space Grotesk / JetBrains Mono / Noto Sans Arabic).
- **Reskin de TOUTES les pages existantes** sur ce nouveau DS (vitrine, légal, auth, espace membre signaux/détail, paiement, compte/abonnement, académie/CMS, admin).
- **Dashboard utilisateur** complet (vue d'ensemble, signaux suivis, abonnement, affiliation).
- **Dashboard superadmin** complet/refondu (pilotage signaux, santé système, affiliés, paiements, utilisateurs).
- **Tests fonctionnels E2E** des flux principaux.
- **Robustesse & scalabilité DB pour 10k+ users** : audit approfondi (indexes ciblés + EXPLAIN sur requêtes clés, RLS perf via helpers security-definer, pagination/curseurs, Supabase advisors, pooler/pgBouncer, limites Realtime). PAS de test de charge réel dans ce milestone.

**Key context :**
- **v2.1 mis en pause** : phases 12 (routines d'analyse Claude), 13 (backtest catalogue), 14 (track record prod) **reportées** — elles dépendent des données réelles (« on ajustera les API demain »).
- L'identité dark néon **remplace assumément** le DS NEXA light/dark des phases 10-11 (refonte produit voulue par le fondateur, 2026-06-22).
- **Données seedées** réalistes ; aucun branchement API/paiement/signaux réels dans ce milestone.
- **Scalabilité = conception + audit DB** (pas de test de charge réel).
- Contraintes conservées : RLS stricte · % TOUJOURS mesuré jamais inventé (VITR-03) · aucune promesse de gain · i18n fr/en/ar + RTL · garde no-mera-brand.
- **Hors scope** : moteur live (phase 12), LEGAL-02 (sign-off juriste), vérifs live différées v2.0.

## Paused Milestone: v2.1 — Mise en vie : identité NEXA, moteur live & track record (phases 10-11 livrées, 12-14 reportées)

**Goal :** Donner à la plateforme son identité visuelle réelle (design **NEXA** sur toute l'app), activer le moteur d'analyse en **routines Claude planifiées sans clé API** (day + swing, timing choisi par le moteur), et rendre le **track record affichable dès le lancement** (backtest du catalogue de patterns + boucle d'outcomes en prod).

**Target features :**
- **Identité & design system NEXA** reconstruit depuis le HTML de référence (`Nexa - Landing.html`) — tokens, thèmes `volt`/`green` OKLCH, polices (Archivo / Chakra Petch / Space Grotesk / JetBrains Mono / Noto Sans Arabic), hero/scène, animations, marquee, gauges de score — appliqué à **toute la plateforme** (vitrine, espace membre signaux/détail, académie, auth, admin). Trilingue AR-RTL/EN/FR conservé.
- **Rebranding MERA → NEXA** (*New Era Exchange Alliance* → « Nouvelle Ère · Alliance d'Échange ») + baseline conforme **sans promesse de gain** (slogan « Make Everybody Rich Again » écarté).
- **Routines d'analyse Claude Code** (Remote, sans clé API, forfait Max ~15 runs/j partagés) : `snapshot → analyze (vétéran) → persist`, déclenchées aux **moments opportuns day & swing** (le moteur choisit), idempotentes + monitoring `job_runs`, secrets via Environments.
- **Moteur de backtest du catalogue de patterns** → seed `pattern_stats` → **% mesuré affiché dès J1** (avant historique réel), avec N visible et seuil N≥30.
- **Boucle outcome-tracker en prod** : résolution hit_tp/hit_sl/flat, bascule progressive backtest → track record réel, calibration.

**Key context :**
- Design **reconstruit** (assets `landing.css`/`landing.js` non fournis) → fidélité interprétative à l'intention du HTML.
- **Pas de clé API Anthropic** : intelligence via agent Claude Code planifié ; le backend ne fait que lire/écrire Supabase via le SDK.
- Track record : **infra livrée en v2.0 P5** (`replayOutcome`, `prediction_outcomes`, `pattern_stats`, job `outcome-tracker`, bloc public seuil N≥30) ; le neuf = **backtest** + mise en prod de la boucle.
- **Hors scope de ce milestone** (restent au backlog) : PAY-AUTO (processeur crypto auto), AFF-AUTO (payouts auto), LEGAL-02 (sign-off juriste), WIRING-01 (ExpiryBanner) sauf si trivial au passage.

## Shipped Milestone: v2.0 — Plateforme publique d'analyse & signaux (MENA) — livré 2026-06-20

**Statut :** ✅ Livré (9 phases, 37 plans). Vérification automatisée 100 % verte (Vitest 566 ✓, typecheck 0 erreur) ; P01 + P09 live-vérifiés (E2E 32 ✓). Items live restants (P02-P08, dépendances externes) + dette explicite (WIRING-01, LEGAL-02) → `STATE.md → Deferred Items`. **Prochain milestone candidat : W5 automatisation** (PAY-AUTO processeur crypto + webhooks, ENGINE-API clé Anthropic, AFF-AUTO).

**Goal (atteint):** Transformer le moteur analytique livré (P1-4) en plateforme publique payante (9 $/mois USDT) — vitrine trilingue, espace membre signaux, paiement crypto on-chain, affiliation, superadmin, contenu éducatif, Telegram — avec un % de réussite mesuré (jamais inventé).

**Target features:**
- Vitrine publique trilingue AR(RTL)/EN/FR + funnel d'abonnement
- Espace membre gated par abonnement : liste des signaux triés/filtrés + détail trade (chart + explication simple/approfondie)
- Paiement USDT TRC-20 (MVP : soumission TX hash + vérif on-chain TronGrid → activation auto + file de validation superadmin) + renouvellement/expiration auto ; offre découverte 3 $/15 j
- Affiliation à paliers (codes promo, dashboard affilié, commissions crypto, max 20 % récurrent)
- Dashboard superadmin (membres/paiements/affiliés/signaux/santé jobs)
- CMS articles/cours gratuits vulgarisés
- Bot/canal Telegram public (résultats journaliers + win rate permanent)
- Boucle track record : catalogue de patterns + backtest mesuré → % de réussite affiché ; prediction_outcomes + calibration
- Disclaimers + revue légale (conseil non agréé + statut crypto MENA/Algérie) AVANT le 1er encaissement
- i18n trilingue (transverse)

**Prérequis livré (v1.0, P1-4) :** moteur analytique déterministe + frontière de persistance des setups scorés. Numérotation des phases reset à 1 pour v2.0 ; roadmap v1.0 archivée (`.planning/archive/v1.0-moteur-analytique/`, voir `MILESTONES.md`).

## Requirements

### Validated

- [x] **Fondations & sécurité (Phase 1, 2026-06-12)** : monorepo pnpm + auth Supabase SSR (signup→login→session, E2E 5/5), RLS active 3 tables avec isolation cross-user prouvée (6/6), double barrière service_role (lint + server-only), constantes temps anti look-ahead (16/16 golden values), runner de jobs `job_runs` + dispatcher Windows Task Scheduler exécuté hors agent (exit 0, ligne cloud vérifiée). Requirements AUTH-01/02/03, DATA-05, JOB-03/04.
- [x] **Ingestion fiable des données (Phase 2, 2026-06-13)** : 4 tables RLS (candles/news/macro_series/economic_calendar) + 12 instruments seedés + vue `v_data_freshness` (horaires de cotation NY-DST), 5 clients data-sources (Binance mainnet public, OANDA démo, Finnhub, Marketaux, FRED, FairEconomy) avec parsers Zod golden-testés, 4 jobs idempotents gap-fill avec isolation des pannes. 88/88 tests, idempotence prouvée contre le cloud. Requirements DATA-01/02/03/04/06/07. Reste UAT humain : clés API + premier run live (02-HUMAN-UAT.md).
- [x] **Moteur d'analyse déterministe (Phase 3, 2026-06-13)** : indicateurs golden-testés (RSI/MACD/EMA/ATR/Bollinger) + détection de structure de marché maison (swings, BOS/CHoCH, S/R, POC volume), snapshots technique/fondamental/news par instrument/style. Requirements TECH-01..04, FUND-01..03.
- [x] **Moteur IA « vétéran » & scoring (Phase 4, 2026-06-14, code livré 261/261 tests)** : setups JSON structurés, frontière de confiance unique `persist.ts` (Zod + garde-fous déterministes + scoring /100 décomposable + immuabilité/expiry), prompt versionné sha256, anti-injection. Migrations 0006/0007 appliquées. Requirements SCORE-01..05, JOB-01/02. **Ops restant (reporté) :** configurer les routines planifiées Claude + 1 run réel.

- [x] **Socle transverse i18n/RTL & rôles/gating (v2.0 Phase 1, 2026-06-14)** : next-intl 4.13 (locales fr/en/ar, `localePrefix:'always'`, ar→`dir=rtl`, un seul `<html lang dir>`), Tailwind v4 RTL natif (propriétés logiques, pas de tailwindcss-rtl), middleware composé (handleI18n muté par updateSession, `getUser()`), primitive d'accès `gate.ts` (requireUser/requireActiveSub/requireRole, returnTo same-origin anti open-redirect), `profiles.role` hors JWT + barrière RLS `has_active_subscription()`/`is_superadmin()` (migrations 0008/0009/0010 live) — non-abonné lit 0 ligne (prouvé 4/4). 5 BLOCKER + 6 WARNING de revue corrigés. 265/265 tests ; E2E (18 specs) authorés, exécution runtime → 01-HUMAN-UAT.md. Requirements I18N-01..04, ACCESS-01..04.
- [x] **Vitrine publique trilingue & gate légal (v2.0 Phase 2, 2026-06-14, code livré 280/280 tests)** : design system de marque (shadcn/ui v4 CSS-first, 2 thèmes bleus, ThemeToggle no-flash RTL-safe, polices Inter + IBM Plex Sans Arabic self-hostées), pages marketing trilingues (accueil bénéfice-first + proof slot masqué D-08, tarifs 9$/mois + 3$/7j USDT TRC-20, funnel honnête signup→/paiement-bientot D-09), couche conformité (Disclaimer RSC + Footer globaux toutes pages, pages légales placeholder allowlist+notFound), gate légal non-code (`legal-gate.ts` server-only default-deny `LEGAL_REVIEW_DONE` + artefact `docs/legal/LEGAL-REVIEW.md`). VITR-03 garanti (zéro % / promesse de gain, test no-perf-claims). Code review 0 blocker (WR-01/WR-02 corrigés). Requirements VITR-01/02/03, LEGAL-01/02 (code). **Restant UAT humain (02-HUMAN-UAT.md) :** revue visuelle RTL/thème + sign-off juriste externe (gate LEGAL-02 bloquant P4, pas P2).
- [x] **Espace membre signaux gated RLS (v2.0 Phase 3, 2026-06-15, code livré 294/294 tests)** : liste membre gated (page RSC anon-client + RLS `has_active_subscription()`, SignalCard/FilterBar filtres URL cumulables, tri score/fraîcheur/R:R), détail trade (route `[id]` anti-IDOR, CandleChart lightweight-charts v5 lecture seule entrée/SL/TP no-SSR, explication simple→approfondie **contenu IA VERBATIM** 0 dangerouslySetInnerHTML, repli D-11 « facteurs contributifs » car score breakdown non persisté, glossaire), temps réel Supabase (migration 0011 live : replica identity FULL + publication ; badge N nouveaux, retrait live, repli silencieux), RLS `candles` **alignée** sur les abonnés actifs (0011). Code review 2 Critical + 4 Warning corrigés ; sécurité 9/9 menaces CLOSED (03-SECURITY.md, ASVS L1). Requirements MEMB-01..05. **Restant UAT humain (03-HUMAN-UAT.md) :** rendu canvas/couleurs + comportements Realtime live + E2E Playwright (env Supabase + next dev) + anti-IDOR signal expiré.

- [x] **L'Académie — CMS cours & articles vulgarisés (v2.0 Phase 9, 2026-06-19, code livré)** : surface de lecture publique trilingue (fr/en/ar, RTL arabe) alimentée par fichiers MDX versionnés (commit → deploy, **pas d'UI superadmin** — D-01/CMS-02 révisé). Socle pur testé (frontmatter Zod, searchParams whitelist, reading-time, TOC), couche fichiers `content.ts` (scan fs/gray-matter, résolution `(slug, locale)` + fallback FR D-14, garde anti path-traversal `^[a-z0-9-]+$` confinée `path.resolve`) + `course-model` (cours/leçons dérivés sans DB), 9 composants pédago + mapping `MDX_COMPONENTS`, 3 routes RSC (index filtré + article/page-cours + leçon) via `compileMDX(fs.readFile)` EXCLUSIF (contourne le `!` du chemin), sitemap hreflang, namespace i18n `academy` (parité stricte 46 clés), funnel D-08 (nav + home + lien détail signal), 11 fixtures MDX de preuve. `<Disclaimer />` injecté par chaque page (LEGAL-01). Code review : sécurité SAFE, BLOCKER CR-01 (parse→safeParse, jamais 500) + WR-01 (ownership leçon/cours) corrigés. 566/566 tests, tsc académie 0-erreur. Requirements CMS-01, CMS-02, LEGAL-01. **Restant UAT humain (09-HUMAN-UAT.md) :** rendu MDX/RTL/fallback + E2E en Vercel preview (le `next build` local est non-viable — chemin `!`).

- [x] **Paiement USDT MVP & abonnement — JALON ENCAISSEMENT (v2.0 Phase 4, 2026-06-17)** : adresse TRON atomique BigInt (zéro float), vérif on-chain TronGrid (contrat officiel `.env`, decimals 6, `only_confirmed`), anti-replay `UNIQUE(tx_hash)` global + ordre anti-TOCTOU (arme avant lecture réseau), réservation offset, RPC d'activation idempotente, QR maison zéro-dépendance, job `subscription-expiry`, back-office membres + file ambigus. Requirements PAY-01..06, ADMIN-01/02. **Restant (deferred) :** round-trip testnet réel + **WIRING-01** (ExpiryBanner non câblé, PAY-05) + gate LEGAL-02.
- [x] **Track record mesuré & % affiché (v2.0 Phase 5, 2026-06-17)** : `replayOutcome` first-touch golden-testé (hit_tp/hit_sl/flat + R), migration 0014 `prediction_outcomes` + vue `pattern_stats` (première lecture anon, get_advisors PASS), job `outcome-tracker` idempotent, bloc public % TOUJOURS mesuré (N visible, seuil N≥30 « échantillon insuffisant ») vitrine + miroir membre + méthodologie trilingue. Requirements TRACK-01..03.
- [x] **Canal Telegram public (v2.0 Phase 6, 2026-06-18)** : `formatMessage` pur bilingue FR+AR (anti-injection HTML, anti-leak entry/SL/TP, isolats bidi), migration 0015 `telegram_posts` (UNIQUE dedupe), job grammY publication-only idempotent (`job_runs`). Requirements TG-01..03, LEGAL-01.
- [x] **Affiliation à paliers (v2.0 Phase 7, 2026-06-18)** : migration 0016 (tables + RLS + RPC commission/payout + vue no-PII), grille paliers + commission BigInt pure golden-testée (miroir SQL), capture `?ref` (cookie 30j) → attribution figée au signup (best-effort), candidature trilingue + dashboard affilié no-PII, back-office payouts manuel. Requirements AFF-01..05.
- [x] **Superadmin consolidé (v2.0 Phase 8, 2026-06-19)** : `/admin` KPI + `/admin/signaux` (× telegram_posts, filtres URL) + `/admin/sante` (feux fraîcheur + job_runs) + `/admin/affiliation` (perfs + payouts), 404 discret non-superadmin (T-04-ADMIN-ELEV, **live-vérifié** gating E2E). Requirements ADMIN-03/04.

- [x] **Composants NEXA, reskin transversal & rebranding (v2.1 Phase 11, 2026-06-21)** : tokens component-layer 3 couches (`--accent-brand` purple + `--risk-moderate` amber), bibliothèque NEXA tokenisée (Eyebrow, ScoreRing `role=meter` couleur=risque, Marquee RTL-aware, ConfidenceStat via `applyThreshold`, Logo SVG marque), recoloration résiduelle vers tokens flip-safe (CandleChart `MutationObserver`+`applyOptions`, SignalCard/SignalDetail `--signal-*`, ExpiryBanner/alert tokenisés), rebranding MERA→NEXA complet (header/footer/metadata, grep=0) + baseline trilingue + assets `next/og` (favicon/apple-icon/OG), hero animé greenfield CSS+vanilla TS (globe/cartes/data-rain/tilt, double-gardé `prefers-reduced-motion`, zéro three/gsap), reskin transversal toutes surfaces (vitrine/académie/auth/compte/admin) + **WIRING-01 clos** (ExpiryBanner câblé sur `/abonnement`, fetch RLS serveur). Garde-fous text-scan (no-perf-claims, no-mera-brand, rtl-logical-props). Suite unit 582/4-skip/0-fail, tsc 0-erreur, code review 0 blocker (WR-01/WR-02 invariants flip-safe+RTL corrigés). Requirements DESIGN-05, BRAND-01..04, UI-01..07. **Restant UAT humain (11-HUMAN-UAT.md) :** rendu multi-locale/RTL + E2E Playwright + reduced-motion + theme-flip CandleChart.

### Active — milestone en cours (v2.1 : identité NEXA, moteur live & track record)

> Requirements détaillés (REQ-IDs) dans `.planning/REQUIREMENTS.md`. Trois axes : design NEXA toute l'app · routines d'analyse Claude sans API · backtest + track record en prod.

### Backlog — différé après v2.1

> Reporté au-delà du milestone en cours (automatisation paiement/affiliation + dette de clôture).

- [x] **WIRING-01** (résolu Phase 11, 2026-06-21) : `ExpiryBanner` (alerte J-3/J-1) câblé sur `/abonnement` via fetch RLS serveur (`current_period_end`). Dette PAY-05 close.
- [ ] **LEGAL-02** : revue juridique externe signée (gate non-code) avant le 1er encaissement réel.
- [ ] **PAY-AUTO** : processeur crypto (NOWPayments/Cryptomus) — adresse unique par facture + webhooks (remplace la soumission de hash manuelle).
- [ ] **AFF-AUTO** : automatisation des payouts d'affiliation.
- [ ] Vérifs live différées P02-P08 + UAT P02/P03 (voir `STATE.md → Deferred Items`) à exécuter sur Vercel preview / données seedées.

### Out of Scope

- Stripe / paiement par carte — remplacé par paiement crypto USDT (décision 2026-06-13)
- Trajectoire « outil perso + capital 500 $ » — **abandonnée le 2026-06-13** (la plateforme reste utilisable par le fondateur pour ses trades perso, mais ce n'est plus l'objectif produit)
- Communauté sociale (profils, follows, commentaires, leaderboard) — v2
- Exécution automatique des trades (passage d'ordres) — hors scope (aide à la décision, pas de bot d'exécution)
- Scalping temps réel M1/M5 (websockets) — après moteur prouvé
- Actions/equities — à revalider après le lancement du cœur (source de données à trancher)

## Context

- **Fondateur** : Borhane, développeur (Next.js + Supabase). Niveau trading intermédiaire.
- **Audience** : MENA (Algérie → Moyen-Orient), non technique, acquise via influenceurs + Telegram. L'USDT y est le moyen de paiement crypto dominant (généralement via P2P).
- **Forfait Claude Max** disponible → routines/agents planifiés sans coût par token (à réévaluer pour une plateforme publique : fiabilité 24/7).
- **MCP Supabase connecté.** Architecture détaillée : `ARCHITECTURE.md` (à réviser post-pivot pour les briques plateforme).
- **Principe clé inchangé** : les indicateurs sont calculés en code (déterministe) — Claude raisonne, n'invente pas les chiffres. Le % de réussite vient du backtest, jamais d'une affirmation.

## Constraints

- **Tech stack** : Next.js 15 + Supabase (Postgres/Auth/Realtime/RLS).
- **Budget** : coût quasi nul jusqu'au lancement — sources de données gratuites, pas de clé API Anthropic tant que les routines Max suffisent.
- **Données** : OANDA (forex/métaux/énergie), Binance (crypto), Finnhub/Marketaux (news), FRED (macro), FairEconomy (calendrier éco). Tiers gratuits → rate limits gérés.
- **Sécurité** : clés en `.env` non commitées, service_role réservé aux jobs, RLS stricte ; portefeuille crypto de la plateforme = clés jamais dans le code ni la DB (cold wallet pour les fonds, watcher en lecture seule).
- **Légal — ATTENTION RENFORCÉE POST-PIVOT** : vendre des signaux à un public non averti = exposition réglementaire réelle (conseil en investissement non agréé). Positionnement strictement éducatif + disclaimers systématiques. ⚠️ La réglementation crypto en Algérie (interdiction légale des crypto-monnaies) et dans certains pays ciblés est un risque structurel à traiter (structure juridique, juridiction d'exploitation) **avant d'encaisser le premier abonnement**.
- **Robustesse routines** : PC potentiellement éteint → jobs idempotents + monitoring `job_runs` + Windows Task Scheduler en backup. Pour une plateforme publique payante, la fiabilité des publications devra être garantie (à trancher : migration vers clé API/infra cloud au lancement).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Forfait Max + routines planifiées (pas de clé API) tant que viable | Coût zéro, backend ne fait que lire Supabase | — Pending |
| Marchés : crypto + forex + or/argent/pétrole | Sources gratuites, 24/7 crypto, audience crypto-friendly | — Pending |
| Styles Day + Swing d'abord, scalping plus tard | Même moteur ; scalping = temps réel coûteux | — Pending |
| Indicateurs calculés en code, Claude raisonne seulement | Évite l'hallucination de chiffres | — Pending |
| Stack Next.js + Supabase | Compétences fondateur, MCP connecté | — Pending |
| **2026-06-13 — PIVOT PRODUIT** : plateforme publique payante (9 $/mois) d'analyses + signaux, vitrine + espace membre, audience MENA non technique, trilingue AR/EN/FR | Passage direct au produit ; l'outil perso n'est plus l'objectif | — Pending |
| **2026-06-13** — Paiement exclusivement en USDT vers portefeuille crypto, détection on-chain des paiements, commissions affiliés en crypto | Audience MENA : carte bancaire inadaptée, USDT dominant ; pas de Stripe | — Pending |
| **2026-06-13** — Affiliation à paliers basée sur les abonnés actifs ramenés (code promo), palier max 20 % récurrent | Acquisition par influenceurs, alignement long terme | — Pending |
| **2026-06-13** — % de réussite affiché = taux des patterns backtestés d'abord, track record réel ensuite | Honnêteté produit : jamais un chiffre non mesuré | — Pending |
| % de réussite des patterns = mesuré par notre backtest, jamais affirmé | Honnêteté produit + risque légal | — Pending |
| Revue légale obligatoire AVANT d'encaisser le premier abonnement (conseil non agréé + statut crypto dans les pays cibles, dont l'Algérie) | Exposition réglementaire réelle | — Pending |
| **2026-06-13** — Paiement en deux étages : MVP = soumission TX hash (+ screenshot) vérifiée via TronGrid + file superadmin ; ensuite processeur crypto automatisé | Démarrer immédiatement sans dépendre d'un tiers, automatiser ensuite | — Pending |
| **2026-06-13** — Moteur : routines Claude Max pendant la construction, migration clé API Anthropic au lancement payant | Coût zéro avant revenus, fiabilité 24/7 quand des abonnés paient | — Pending |
| **2026-06-13** — Lancement payant direct (influenceurs déjà engagés) + offre découverte 3 $/15 jours | Pas d'attente de track record ; l'offre d'essai abaisse la barrière ; le Telegram public accumule le track record en parallèle | — Pending |
| Phases 1-2 (fondations, ingestion) inchangées par le pivot ; roadmap aval (phases 3+) à réviser | Le cœur analytique sert les deux visions ; ne pas geler l'exécution | — Pending |
| **2026-06-20** — Marque officielle = **NEXA** (*New Era Exchange Alliance* → « Nouvelle Ère · Alliance d'Échange »). Slogan « Make Everybody Rich Again » du mock écarté | Une promesse de gain explicite contredit la contrainte légale dure « aucune promesse de gain » avant encaissement | — v2.1 |
| **2026-06-20** — Design system **reconstruit** depuis le HTML de référence (assets css/js non fournis) | Fidélité interprétative à l'intention ; pas de source CSS/JS à porter | — v2.1 |
| **2026-06-20** — Moteur d'analyse activé via **routines Claude Code planifiées sans clé API** (forfait Max, le moteur choisit les moments day/swing) | Coût zéro avant revenus ; lève la dette « configurer routines + 1 run réel » de v1.0 P4 | — v2.1 |
| **2026-06-20** — % affiché dès J1 = **backtest maison du catalogue de patterns** seedant `pattern_stats`, puis bascule sur le track record réel | Honnêteté produit : un % mesuré dès le lancement sans attendre N≥30 issues réelles | — v2.1 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-22 — démarrage du milestone **v3.0 « Plateforme complète sous identité dark néon NEXA »** (design system dark unique · reskin toutes pages · dashboards utilisateur & superadmin · tests E2E · scalabilité DB 10k+ users, sur données seedées). v2.1 mis en pause (phases 10-11 livrées, 12-14 reportées car dépendantes des données réelles). Requirements + roadmap en cours de définition.*

*Précédent : 2026-06-20 — démarrage du milestone **v2.1 « Mise en vie : identité NEXA, moteur live & track record »** (3 axes : design NEXA toute l'app · routines d'analyse Claude sans API · backtest + track record en prod). Phases 10-11 livrées ; 12-14 reportées à la reprise du moteur live.*

*Précédent : 2026-06-20 après clôture du milestone v2.0 « Plateforme publique ». Les 9 phases sont livrées et réconciliées dans « Validated » (P1-P9 v2.0 + cœur v1.0 P1-4). Vérification automatisée 100 % verte (Vitest 566 ✓, typecheck 0) ; P01 + P09 live-vérifiés (E2E 32 ✓, bug i18n localeDetection corrigé au passage). Items live différés (P02-P08 + UAT P02/P03) et dette explicite (WIRING-01, LEGAL-02) consignés dans `STATE.md → Deferred Items`. Roadmap collapsée ; détail v2.0 archivé `.planning/milestones/v2.0-ROADMAP.md`. Prochain milestone candidat : W5 automatisation.*
