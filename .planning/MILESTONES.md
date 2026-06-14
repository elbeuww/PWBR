# Milestones

Historique des milestones livrés du projet.

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
