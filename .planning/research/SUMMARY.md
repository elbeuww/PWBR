# Project Research Summary

**Project:** NEXA — Plateforme d'Analyse de Trading « Vétéran »
**Domain:** Plateforme SaaS publique de signaux de trading (MENA, trilingue AR-RTL/EN/FR)
**Researched:** 2026-06-20
**Confidence:** HIGH
**Milestone:** v2.1 — Mise en vie : identité NEXA, moteur live & track record

## Executive Summary

v2.1 est un milestone d'**activation**, pas de construction. Les trois axes (design NEXA, routines d'analyse, backtest/track record) reposent tous sur de l'infrastructure déjà livrée en v2.0/v1.0. Le reskin est un **swap de tokens CSS + reconstruction interprétative** du mock `Nexa - Landing.html`, sans nouvelle dépendance runtime. Les routines sont essentiellement une **configuration dashboard Claude Code** (Environments + fenêtres planifiées) qui lève la dette v1.0 P4 (« configurer routines + 1 run réel »), sans clé API. Le backtest est un **nouveau package TypeScript pur** (`packages/backtest`) consommant `replayOutcome` + `packages/indicators` déjà golden-testés.

La contrainte unificatrice est l'**honnêteté du % affiché**. Trois invariants non négociables : (1) une migration de **discrimination de source** (backtest vs live) AVANT tout INSERT de backtest ; (2) une **provenance** (`backtest | live`) obligatoire, typée TS, sur chaque % rendu, avec N visible ; (3) le test `no-perf-claims` étendu à tous les nouveaux composants NEXA. Toute violation = exposition légale (promesse de gain implicite / % non mesuré).

Le risque principal n'est pas technique mais **d'ordonnancement** : seeder le backtest dans `pattern_stats` (migration 0014, qui ne dérive que des outcomes réels) sans colonne `source` provoque un double-comptage backtest↔live silencieux et rend la bascule backtest→réel impossible. La migration de source doit précéder le moteur de backtest.

## Key Findings

### Recommended Stack

**ZERO nouvelle dépendance runtime requise** pour les trois axes. Détail dans `STACK.md`.

**Core technologies (réutilisées, pas ajoutées) :**
- **CSS + vanilla TS (~120 LOC)** : tout le mock (marquee, rings/gauges SVG `stroke-dasharray`, globe « 3D » en gradients+blur, scroll-reveal via `IntersectionObserver`, count-up via `rAF`, tilt/parallaxe via `mousemove`) — pas de three.js/WebGL/GSAP. Tout `prefers-reduced-motion`-aware.
- **`next/font/local`** : self-host des 5 familles (Archivo, Chakra Petch, Space Grotesk, JetBrains Mono, Noto Sans Arabic) exposées en CSS vars → Tailwind v4 `@theme`.
- **Tailwind v4 `@theme` + `data-theme`/`data-brand` + next-themes** : multi-thème OKLCH volt/green orthogonal au light/dark existant, RTL en propriétés logiques uniquement.
- **Claude Code Remote routine + dispatcher `tsx` existant** : aucune dep, aucune clé API ; secrets via Environments ; DB via `supabase-js` (MCP cloud indisponible en Remote).
- **TS pur dans `packages/backtest`** : réutilise `replayOutcome` (first-touch) + détecteurs de structure `packages/indicators` ; seul calcul non trivial = intervalle de Wilson écrit main (~15 LOC, golden-testé).

**Liste « NE PAS ajouter » (explicite) :** GSAP, three.js, react-fast-marquee, simple-statistics/jstat, SDK Anthropic / clé API, node-cron. `motion` 12.x = seul ajout optionnel justifiable, **à différer** jusqu'à preuve de sprawl reveal/stagger.

### Expected Features

Détail dans `FEATURES.md`.

**Must have (table stakes) :**
- Design system tokenisé (primitive→semantic→component) appliqué uniformément à toutes les route groups, sans CSS bespoke par page.
- Bascule de thème no-flash RTL-safe (réutilise le ThemeToggle v2.0 P2).
- Routine d'analyse planifiée produisant des setups via `persist.ts`, idempotente, monitorée (`job_runs` + flag `stale`).
- % affiché **toujours** accompagné de sa provenance + N (jamais un % nu).

**Should have (différenciateurs) :**
- Scène hero animée (globe + cartes flottantes + data-rain) — différenciateur visuel fort, mais statique d'abord puis animé.
- Sélection « moment opportun » day/swing alignée candle-close × ouverture de session (déterministe, data-not-code).
- Backtest seedant un % mesuré **dès J1**, puis bascule par bucket vers le track record réel quand N_réel ≥ 30.

**Defer (v2+) :**
- `motion` pour orchestration d'animations avancées.
- Calibration fine / courbes par bucket de score au-delà du strict nécessaire.

**Anti-features (à NE PAS reproduire du mock) :** le « 73 % » hardcodé et le slogan « Make Everybody Rich Again » — % non mesuré + promesse de gain.

### Architecture Approach

Détail dans `ARCHITECTURE.md`. v2.1 s'intègre sans toucher aux frontières existantes.

**Major components :**
1. **Tokens design** — restent dans `apps/web/src/styles/globals.css` (`@theme`/`:root`/`.dark`), pas de package partagé ; `volt`/`green` = second axe via `data-brand` composant avec next-themes `.dark` ; scripts no-flash pré-paint pour les deux axes ; CandleChart (lwc v5) recoloré par l'API JS lisant les CSS vars.
2. **Routine d'analyse** — l'étape ANALYZE est **agent-native, PAS un job** : l'agent raisonne et écrit `run-artifacts/<run_id>/<symbol>_<style>.json` ; `persist.ts` (via `runArtifacts.ts`, regex `RUN_ID_RE`, path-traversal guardé) reste la **frontière d'écriture IA unique** (D-43). Axe 2 = config Environments + Remote schedules + lever la dette P4. Ne PAS créer `analyze.ts` dans `dispatch.ts` (exigerait une clé API).
3. **Backtest** — **nouveau `packages/backtest`** (hors `packages/indicators` pour préserver sa pureté golden-testée) ; nouvelle table `backtest_outcomes` (migration 0017) ; `pattern_stats` gagne une discrimination `source` distinguant backtest et `prediction_outcomes` live (D-05, producteur unique).

### Critical Pitfalls

Top 5 sur 13, détail dans `PITFALLS.md`.

1. **P2 — Double-comptage backtest↔live (data-integrity #1)** : `pattern_stats` (0014) somme les outcomes sans colonne `source`. → Migration de discrimination de source AVANT tout code de backtest ; récupération coûteuse une fois en prod.
2. **P1/P7 — Exposition légale** : % backtest affiché sans label de provenance = promesse implicite ; le mock porte un % nu + un slogan de gain. → Provenance typée obligatoire + N visible ; étendre `no-perf-claims` au reskin AVANT toute visibilité publique.
3. **P3/P5 — Look-ahead & first-touch divergent dans le backtest** : → réutiliser `replayOutcome` / `lastClosedCandleStart` tels quels, jamais ré-implémenter la résolution d'issue.
4. **P12 — MCP Supabase absent en routine Remote** (marche en interactif, casse en cloud) : → `supabase-js` only dans les jobs ; confirmer l'accès réseau `*.supabase.co` à la config de l'Environment.
5. **P8/P13 — RTL cassé + FOUC de thème** : propriétés CSS physiques copiées du mock cassent l'arabe ; volt/green × light/dark sans script no-flash = flash. → Propriétés logiques only ; scripts pré-paint en fondation.

## Implications for Roadmap

Structure suggérée : **5 phases** (Axe 1 design parallélisable contre Axes 2-3). Numérotation continue après v2.0 (phases ≥ 10).

### Phase A : Fondation Design System (tokens + thèmes + polices)
**Rationale :** les tokens précèdent les composants ; les scripts no-flash brand/theme doivent être posés en fondation, jamais retrofittés.
**Delivers :** tokens OKLCH primitive→semantic→component, axes `data-brand` (volt/green) × light/dark, 5 polices self-hostées, RTL en propriétés logiques.
**Avoids :** P13 (FOUC), P8 (RTL cassé).

### Phase B : Composants NEXA + Reskin transversal
**Rationale :** une fois les tokens posés, restyler shadcn + bâtir les primitifs NEXA (ScoreGauge, SignalCard, LevelsRow, TrustStat, marquee, hero).
**Delivers :** reskin de toutes les route groups (marketing/member/academy/auth/admin), rebranding MERA→NEXA, baseline conforme, hero statique→animé.
**Avoids :** P7 (gain promise / % nu) — `no-perf-claims` étendu. **Uses :** CSS+vanilla TS, `next/font/local`.

### Phase C : Routines d'analyse IA planifiées (sans API)
**Rationale :** lever la dette v1.0 P4 ; config-first.
**Delivers :** Environment (secrets service_role) + fenêtres Remote day/swing alignées sessions/candle-close, 1 run réel snapshot→analyze→persist de bout en bout, monitoring `job_runs`/stale.
**Avoids :** P12 (MCP cloud), P11 (quota ~15/j partagé), P10 (hallucination — `persist.ts` non affaibli).

### Phase D : Backtest — migration source + moteur
**Rationale :** **CRITIQUE** — migration 0017 de discrimination de source AVANT le moteur ; catalogue de patterns figé AVANT le code de détection.
**Delivers :** migration `source`/`backtest_outcomes`, `packages/backtest` réutilisant `replayOutcome` + structure detectors, intervalle de Wilson golden-testé.
**Avoids :** P2 (double-comptage), P3/P5 (look-ahead, first-touch).

### Phase E : Affichage track record — bascule provenance + mise en prod de la boucle
**Rationale :** dépend de C (outcomes réels) et D (backtest seedé).
**Delivers :** `applyThreshold` portant la provenance, TrackRecordBlock/TrustStat affichant backtest→réel par bucket (N≥30), outcome-tracker en prod.
**Avoids :** P1/P4/P9 (% nu, bascule silencieuse).

### Phase Ordering Rationale
- Tokens → composants → reskin (dépendance stricte de l'Axe 1).
- Snapshot → analyze → persist (Axe 2) ; config Remote d'abord car blocker A1.
- Migration `source` → moteur backtest → display (Axe 3) ; l'ordre inversé corrompt `pattern_stats`.
- Axe 1 est parallélisable contre Axes 2-3 (surfaces disjointes : CSS/composants vs jobs/DB).

## Research Flags

Phases nécessitant une recherche plus profonde au planning :
- **Phase C (Routines) :** Open Question A1 non résolue — confirmer l'accès réseau `*.supabase.co` depuis le runtime Anthropic Remote AVANT de planifier les sous-tâches.
- **Phase D (Backtest moteur) :** le **catalogue de patterns** = décision fondateur (Borhane) à figer (quels patterns nommés → quels détecteurs `packages/indicators`) avant d'écrire le code.

Phases à patterns standards (skip research-phase) : **A, B, E**.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Sources primaires : mock HTML, routines-claude.md, PROJECT.md, package.json. Seul MEDIUM = version exacte de `motion` (optionnel, différé). |
| Features | HIGH | Ancré sur le code réel (`persist.ts`, `outcome.ts`, vue 0014, `threshold.ts`, `sessions.ts`). |
| Architecture | HIGH | Chaque point d'intégration vérifié sur fichier source réel. |
| Pitfalls | HIGH | Pièges spécifiques au système, pas génériques ; data-integrity + légal priorisés. |

**Overall confidence:** HIGH

### Gaps to Address
- **Open Question A1 (accès réseau Remote vers `*.supabase.co`)** — blocker potentiel Phase C ; valider à la config de l'Environment.
- **Catalogue de patterns** — décision fondateur non technique ; figer avant le code Phase D.
- **Noto Sans Arabic vs IBM Plex Sans Arabic** — remplacement total ou coexistence ; décision Phase A.

## Sources

### Primary (HIGH confidence)
- `Nexa - Landing.html` (mock de référence) — effets visuels, structure, tokens implicites.
- `docs/routines-claude.md` — modèle d'exécution Remote, quota, caveats MCP/réseau.
- Code repo réel : `persist.ts`, `runArtifacts.ts`, `dispatch.ts`, migration 0014 `pattern_stats`, `replayOutcome`, `threshold.ts`, `sessions.ts`, `package.json`.
- `.planning/PROJECT.md` — contraintes, Core Value, légal.

### Secondary (MEDIUM confidence)
- WebSearch — version `motion` 12.40.0 (Context7/WebFetch bloqués dans l'environnement ; à revérifier au peer-install si adopté).

---
*Research completed: 2026-06-20*
*Ready for roadmap: yes*
