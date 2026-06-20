# Milestones

Historique des milestones livrés du projet.

---

## v2.0 — MVP plateforme publique (2026-06-14 → 2026-06-20)

**Statut :** Livré. Couche produit publique (MENA, trilingue fr/en/ar) construite autour du cœur analytique v1.0.

**Stats :** 9 phases, 37 plans, 52 tasks. Vérification automatisée 100 % verte (Vitest 566 ✓, typecheck 0 erreur) ; P01 et P09 live-vérifiés (E2E 32 ✓).

**Key accomplishments (un par phase) :**

- **P1 — Socle transverse** : barrière de données RLS non contournable (`profiles.role` hors JWT + table `subscriptions` réelle + `has_active_subscription()` security definer conditionnant la lecture de `trade_setups`/`analyses`), i18n/RTL natif fr/en/ar, primitive de gating partagée UI + RLS. **Live-vérifié.**
- **P2 — Vitrine & gate légal** : accueil/tarifs/disclaimers trilingues, funnel home→tarifs→signup→paiement-bientot (D-09), gate non-code `LEGAL_REVIEW_DONE` prêt pour l'encaissement.
- **P3 — Espace membre signaux** : liste `/signaux` (filtres/tri URL-sync, RLS anon) + détail `/signaux/[id]` (chart lightweight-charts v5, explication 2 niveaux, contenu IA verbatim), Realtime, isolation abonné/non-abonné prouvée.
- **P4 — Paiement USDT MVP** : adresse TRON atomique BigInt, anti-replay `UNIQUE(tx_hash)` global, réservation offset, RPC d'activation idempotente, back-office membres. *(Encaissement réel = ops restant ; gap WIRING-01 + gate LEGAL-02 tracés.)*
- **P5 — Track record mesuré** : `replayOutcome` golden-testé (hit_tp/hit_sl/flat + R), vue `pattern_stats` (première lecture anon), % TOUJOURS mesuré avec N visible et seuil N≥30, bloc vitrine + miroir membre + méthodologie.
- **P6 — Canal Telegram public** : `formatMessage` pur bilingue (anti-injection HTML, anti-leak entry/SL/TP, isolats bidi), job d'envoi grammy, seuil partagé avec la vitrine.
- **P7 — Affiliation à paliers** : capture `?ref` → attribution figée au signup (best-effort), commission BigInt par paliers (miroir SQL), dashboard affilié no-PII, back-office payouts manuel.
- **P8 — Superadmin consolidé** : `/admin` KPI + `/admin/signaux` + `/admin/sante` + `/admin/affiliation`, 404 discret pour non-superadmin (T-04-ADMIN-ELEV, **live-vérifié** via gating E2E).
- **P9 — Académie CMS** : contenu éducatif MDX trilingue (`compileMDX` + allowlist composants anti-XSS), fallback FR D-14, funnel D-08, sitemap hreflang. **Live-vérifié** (academie.spec 8/8).

**Correctifs de clôture (2026-06-20) :** bug i18n réel corrigé (`localeDetection` → `/` partait sur `/en` au lieu de `/fr`) ; tests E2E auth/gating alignés sur D-09 ; fallback D-14 rendu réellement testé (unit + E2E).

**Known deferred items at close:** 13 (voir STATE.md → Deferred Items). Vérifs live P02-P08 + UAT P02/P03 reportées (dépendances externes : juriste, testnet on-chain, bot Telegram, données superadmin/realtime seedées, service_role). Dette explicite : **WIRING-01** (ExpiryBanner non câblé, PAY-05) et **LEGAL-02** (sign-off juriste, bloque le 1er encaissement).

**Artefacts archivés :** `.planning/milestones/v2.0-ROADMAP.md` + `v2.0-REQUIREMENTS.md`.

---

## v1.0 — Moteur analytique déterministe (2026-06-09 → 2026-06-14)

**Statut :** Livré (cœur), clôturé au pivot produit du 2026-06-13.

**Ce qui a été construit (Phases 1-4, code en repo) :**

- **Phase 1 — Fondations & Sécurité** (2026-06-12) : monorepo pnpm, auth Supabase SSR, RLS active sur toutes les tables, isolation `service_role`, constantes temporelles anti look-ahead, runner `job_runs` + Windows Task Scheduler. (AUTH-01/02/03, DATA-05, JOB-03/04)
- **Phase 2 — Ingestion fiable des données** (2026-06-13) : 4 tables RLS (candles/news/macro/calendrier), 12 instruments, 6 clients data-sources (Binance, OANDA démo, Finnhub, Marketaux, FRED, FairEconomy) parsers Zod golden-testés, jobs idempotents tolérants aux pannes. 88/88 tests. (DATA-01..07)
- **Phase 3 — Moteur d'analyse déterministe** (2026-06-13) : indicateurs golden-testés + détection de structure de marché maison (swings, BOS/CHoCH, S/R, POC), snapshots technique/fondamental/news par instrument/style. (TECH-01..04, FUND-01..03)
- **Phase 4 — Moteur IA « vétéran » & scoring** (2026-06-14, code livré 261/261 tests) : routine d'analyse produisant des setups JSON, frontière de confiance unique `persist.ts` (Zod + garde-fous déterministes + scoring /100 + immuabilité), prompt versionné sha256, anti-injection. Migrations 0006/0007 appliquées. **Ops restant (non livré) :** configurer les routines planifiées Claude + 1 run réel — reporté.

**Superseded par le pivot (2026-06-13) — jamais construit :**

- Phases 5-9 de la roadmap v1.0 (dashboard perso, sizing capital 500 $, journal privé, backtest/calibration en mode « outil perso »). Les besoins utiles (consommation des signaux, track record mesuré) sont **reframés** dans le milestone v2.0.
- Trajectoire « outil personnel + capital réel 500 $ » abandonnée.

**Artefacts archivés :** `.planning/archive/v1.0-moteur-analytique/` (phases, ROADMAP, REQUIREMENTS, research).

**Décision de clôture :** le pivot produit (plateforme publique payante MENA) rend la roadmap aval v1.0 obsolète. Le cœur analytique (P1-4) est conservé et alimente v2.0. Numérotation des phases reset à 1 pour v2.0.

---
