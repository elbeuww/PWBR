---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-06-13T14:35:26.465Z"
progress:
  total_phases: 9
  completed_phases: 2
  total_plans: 11
  completed_plans: 10
  percent: 91
  note: "Phase 03 : 3/4 plans (03-01, 03-02, 03-03 complete ; 03-04 next)"
---

# Project State

**Project:** Plateforme d'Analyse de Trading "Vétéran"
**Last updated:** 2026-06-13

## Project Reference

**Core value:** Produire, pour chaque opportunité, une analyse fiable et explicable — score /100 + niveau de risque + plan de trade (entrée/SL/TP/R:R) — qui aide à décider avec discipline.
**Current focus:** Phase 03 — moteur-d-analyse-d-terministe
**Mode:** mvp (Vertical MVP)
**Granularity:** fine (9 phases)

## Current Position

Phase: 03 (moteur-d-analyse-d-terministe) — EXECUTING
Plan: 4 of 4 (03-01 + 03-02 + 03-03 COMPLETE, next 03-04)
**Phase:** 3
**Plan:** 03-03 complete
**Status:** Executing Phase 03

**Progress:** [█████████░] 91%

```
Phase 1  [ ] Fondations & Sécurité          ← next
Phase 2  [ ] Ingestion fiable des données
Phase 3  [ ] Moteur d'analyse déterministe
Phase 4  [ ] Moteur IA "vétéran" & scoring
Phase 5  [ ] Dashboard des opportunités
Phase 6  [ ] Détail trade & charting
Phase 7  [ ] Risque & dimensionnement
Phase 8  [ ] Journal & boucle de feedback
Phase 9  [ ] Backtest & calibration
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 2/9 |
| Plans complete | 10 (Phase 01 + 02-01..02-04 + 03-01 + 03-02 + 03-03) |
| Requirements covered | DATA-06 + Phase 01 + DATA-01/02/05 + DATA-03 + DATA-04 + DATA-07 + TECH-04 + FUND-01/02/03 + TECH-01/02/03 (03-03 : slice vertical TECH-01..04 assemblé) |

## Accumulated Context

### Decisions

- Forfait Claude Max + routines planifiées (pas de clé API) en Phase 1 ; backend Next.js lit seulement Supabase.
- Marchés : crypto + forex + or/argent/pétrole (pas d'actions). Styles Day + Swing en MVP, scalping en v2.
- Indicateurs/R:R/sizing/outcomes calculés en code déterministe ; Claude raisonne uniquement.
- Single-writer / backend read-only ; Supabase = unique frontière producteur/consommateur (rend la v2 streaming additive).
- Démarrage compte démo/testnet obligatoire avant capital réel.
- D-07 : ESLint no-restricted-imports posée avant création du module service_role (plan 02) — barrière lint-time préventive dans apps/web.
- D-09 : DAILY_ANCHOR.oanda = { zone: America/New_York, hour: 17 } / binance = { zone: UTC, hour: 0 } — convention daily cross-asset verrouillée dans packages/core.
- D-10 : lastClosedCandleStart via floor(epoch/tf)-1 — borne haute exclusive, anti look-ahead garanti (DATA-05 satisfait).
- D-11 : Strict skeleton 4 packages — apps/web, apps/jobs, packages/core, packages/supabase déclarés ; data-sources/indicators en phases ultérieures.
- D-12 : .env.example commité sans secret (4 clés vides), .gitignore exclut .env/.env.local.
- D-13 : Vitest + Playwright configurés racine ; golden values DATA-05 vertes (16/16).
- D-14 (2026-06-12) : **Vision élargie v1.1** — abonnement 9 $/mois, Telegram public (1 signal/j) + privé (résumé abonnés), actions ajoutées, scalping confirmé (en dernier). Phases 1-9 inchangées ; extension en phases 10-13 (voir ROADMAP « Scope Update » + REQUIREMENTS v1.1 : DIST/MON/STOCK/PATT/RT).
- D-15 : % de réussite des patterns chartiques = mesuré par notre backtest (PATT-02), jamais affirmé sans données. Revue légale AMF/MiFID II obligatoire avant d'encaisser le premier abonnement.
- D-16 (2026-06-12) : Turbopack obligatoire pour apps/web (`next dev/build --turbopack`) — webpack interdit le `!` du chemin projet. `turbopack.root` + `outputFileTracingRoot` fixés (package-lock.json parasite dans le HOME). `packages/supabase` en moduleResolution Bundler (imports relatifs sans `.js` — Turbopack ne résout pas l'aliasing NodeNext dans les packages workspace).
- D-17 (2026-06-12) : MCP Supabase projet (`.mcp.json`, OAuth) opérationnel — migrations via `apply_migration`, types via `generate_typescript_types`, gate sécurité via `get_advisors` (0 alerte après migration 0002 revoke execute). Emails de test = `@gmail.com` uniques (Supabase Auth rejette example.com), cleanup via SQL service.
- D-18 (2026-06-12) : Client service_role lazy dans runJob.ts (instancié à l'exécution, pas à l'import) — permet la compatibilité Vitest/dotenv sans modifier packages/supabase/service-client.ts. Mock server-only via __mocks__/ + alias vitest.config.ts.
- D-19 (2026-06-12) : Aucune Routine Claude planifiée en Phase 1 — ingestion déterministe via Windows Task Scheduler (run-job.cmd). Routines Remote (cloud Anthropic, ~15 runs/j quota partagé Max) = Phase 4 uniquement (analyse IA).
- D-20 (2026-06-13, plan 02-01) : onConflict miroir des index uniques SQL (candles_uniq/news_uniq/macro_series_uniq/economic_calendar_uniq) — garantie idempotence DATA-06 au niveau DB.
- D-21 (2026-06-13, plan 02-01) : Env loading dans tests packages/ : process.loadEnvFile (Node natif) + getters lazy pour contourner le hoist ESM Vitest. Chemin 3 niveaux depuis packages/supabase/__tests__.
- D-22 (2026-06-13, plan 02-02) : Alias Vitest @app/* déclarés dans vitest.config.ts resolve.alias — obligatoire, Vite ne lit pas tsconfig paths automatiquement. Pattern à reproduire pour tout nouveau package workspace.
- D-23 (2026-06-13, plan 02-02) : computeGapFillWindow exporté depuis market-ingest.ts pour tests unitaires sans réseau — séparer la logique de borne du job = pattern de testabilité pour les autres jobs d'ingestion.
- D-24 (2026-06-13, plan 02-03) : parseFinnhubNews laisse instrument_ids=[] — le job (plan 04) injecte le mapping catégorie→instruments. Sentiment Finnhub free = null (free tier ne retourne pas sentiment crypto/forex).
- D-25 (2026-06-13, plan 02-03) : FairEconomy cache in-process 24h (singleton par process, reset au restart) — acceptable pour le job cron quotidien. Pour cache multi-process : stocker en DB (hors scope plan 03).
- D-26 (2026-06-13, plan 02-04) : vendor.d.ts dans apps/jobs/src/ = déclaration ambiante finnhub dans le scope compilateur jobs — pattern à reproduire pour tout SDK npm sans types natifs.
- D-27 (2026-06-13, plan 02-04) : vi.mock top-level (hoisted) obligatoire pour mocker les imports ESM statiques des jobs — vi.mock dynamique dans les fonctions de test n'affecte pas les modules déjà résolus.
- D-28 (2026-06-13, plan 02-04) : fallback Marketaux dans newsIngest déclenché sur erreur Finnhub (catch), pas sur 0 résultats — garantit que Finnhub est toujours tenté en premier.
- D-30 (2026-06-13, plan 03-01) : Frontière `snapshots` = table horizontale écrite par 3 moteurs verticaux (technical/fundamental/news), référencée par `content_hash` (= raw_indicators_ref, D-41) en aval ; `getSnapshotByHash` exposé pour la Phase 4. `asset_drivers` = data-not-code (D-38), 13 lignes seedées (or↔DXY/REAL_YIELDS, JPY↔RATE_DIFF, crypto↔RISK_SENTIMENT/DXY). RLS select-only dès 0005, AUCUNE write policy (service_role bypass, D-05). idempotence snapshots_uniq prouvée par test golden DB.
- D-42 (2026-06-13, plan 03-02) : swings pinés N=2 (fenêtre 2N+1=5), k=1.0×ATR — candidats RESEARCH validés par golden tests sur cas vérifiés à la main (D-32). Constantes nommées SWING_N/SWING_K dans swings.ts.
- D-43 (2026-06-13, plan 03-02) : `trendDirection` (HH/LL) déduit le sens AVANT cassure ; tendance flat ⇒ la cassure définit BOS par défaut, CHoCH seulement si tendance opposée établie (raffine D-33, confirmation toujours sur clôture du corps, jamais mèche).
- D-44 (2026-06-13, plan 03-02) : hash de contenu = sha256 sur JSON canonique (clés triées récursivement + précision fixe 6 décimales via toFixed). Gèle le bruit flottant cross-plateforme (D-41/Pitfall 3). node:crypto builtin, jamais de hash maison.
- D-45 (2026-06-13, plan 03-02) : wrappers exposent valeur at(-1) (null si historique insuffisant) ET série complète. La série permet le pin de longueur anti-warmup dans les golden tests et le calcul percentile/slope en aval. Type lib jamais exposé (MacdValue/BollingerValue propres). @app/indicators câblé dans tsconfig.base paths + vitest alias.
- D-46 (2026-06-13, plan 03-03) : technical-engine = premier slice vertical complet. buildTechnicalSnapshot (pure, D-23) séparée du harness IO pour testabilité offline. trend = close vs EMA200 (repli EMA50) + bande neutre 0.1% ; slope = MACD−signal ; volume_state = volume récent (1/4 final) vs antérieur ; POC ajouté comme key_level dédié portant volume_source (D-35). Gap EMA200 → partial:true + missing['ema200'] (Pitfall 2, jamais zéro silencieux). Zod §3 validé AVANT upsert (T-03-10). @app/indicators ajouté en dep workspace + path mapping apps/jobs.

### Open todos / risques à lever

- ~~**Phase 1 (research flag):** vérifier le modèle d'exécution réel des Routines Claude Code~~ — RÉSOLU : documenté dans `docs/routines-claude.md` (D-19). Fallback .cmd implémenté.
- **Phase 1:** verrouiller la convention daily cross-asset (OANDA 17:00 NY vs Binance 00:00 UTC) + convention de bougie clôturée (anti look-ahead).
- ~~**Phase 3 (research flag):** concevoir et tester la détection de structure de marché maison (HH/HL, BOS/CHoCH, swings, POC) — absente des libs.~~ — RÉSOLU plan 03-02 : structure maison golden-testée (swings D-32, BOS/CHoCH corps D-33, S/R D-34, POC+flag D-35), 37/37 verts.
- **Phase 4 (research flag):** point à plus haut risque — robustesse prompt vétéran, taux de rejet Zod, méthode de scoring. À itérer.
- **Phase 9 (research flag):** méthode de calibration (isotonic/Platt) et seuil d'échantillon minimal.
- **Phase 12 (research flag, v1.1):** source de données actions — Finnhub free n'offre plus les candles actions ; évaluer Alpha Vantage / Twelve Data / Polygon (tiers gratuits + rate limits).
- **Phase 11 (porte légale, v1.1):** revue « conseil en investissement » AMF/MiFID II avant d'encaisser le premier abonnement (vendre des signaux à des tiers ≠ outil perso).
- **Bloquants v2 (hors roadmap actuelle):** calibration prouvée + revue juridique MiFID II/AMF + licences de redistribution des données.

### Blockers

Aucun.

## Session Continuity

**Last session:** 2026-06-13T14:34:35Z

**Next action:** Plan 03-04 — fundamental-engine + news-engine (dupliquer le pattern engine de 03-03).

**Notes pour la session suivante:** Plan 03-03 COMPLETE. `technical-engine` livré en TDD : fonction pure buildTechnicalSnapshot (read candles clôturées D-10 → @app/indicators wrappers+structure → §3 → Zod → hash D-41 → upsertSnapshot), harness isolé per-instrument×style (D-36 day=H4/H1, swing=D/H4), partial:true sur gap EMA200, volume_source real/proxy par broker (D-35). Enregistré dans dispatch JOB_REGISTRY ('technical-engine') → runJob écrit job_runs. 7/7 golden tests verts ; suite complète 135/135 ; tsc apps/jobs clean. Déviation Rule 3 : @app/indicators ajouté en dep workspace + path mapping apps/jobs. Pour 03-04 : dupliquer le harness, lire macro_series/getAssetDrivers (FUND) et news/economic_calendar (NEWS), produire fundamental_context/news_context via les schémas Zod déjà définis dans @app/indicators.

---
*State initialized: 2026-06-09*
