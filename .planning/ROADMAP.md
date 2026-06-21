# Roadmap — Plateforme d'Analyse de Trading "Vétéran"

## Milestones

- ✅ **v1.0 — Moteur analytique déterministe** — Phases 1-4 (livré 2026-06-14, archivé `.planning/archive/v1.0-moteur-analytique/`)
- ✅ **v2.0 — MVP plateforme publique (MENA, trilingue)** — Phases 1-9 (livré 2026-06-20)
- 🚧 **v2.1 — Mise en vie : identité NEXA, moteur live & track record** — Phases 10-14 (en cours, démarré 2026-06-21)

## Phases

<details>
<summary>✅ v2.0 MVP plateforme publique (Phases 1-9) — SHIPPED 2026-06-20</summary>

- [x] Phase 1 : Socle transverse — i18n/RTL & rôles/gating (4/4 plans) — completed 2026-06-14
- [x] Phase 2 : Vitrine publique trilingue & gate légal (3/3 plans) — completed 2026-06-16
- [x] Phase 3 : Espace membre signaux (gated RLS) (3/3 plans) — completed 2026-06-16
- [x] Phase 4 : Paiement USDT MVP & abonnement — JALON ENCAISSEMENT (6/6 plans) — completed 2026-06-17
- [x] Phase 5 : Track record mesuré & % affiché (3/3 plans) — completed 2026-06-17
- [x] Phase 6 : Canal Telegram public (3/3 plans) — completed 2026-06-18
- [x] Phase 7 : Affiliation à paliers (6/6 plans) — completed 2026-06-18
- [x] Phase 8 : Superadmin consolidé (signaux, santé, affiliés) (4/4 plans) — completed 2026-06-19
- [x] Phase 9 : CMS cours & articles vulgarisés (5/5 plans) — completed 2026-06-20

Détail complet archivé : `.planning/milestones/v2.0-ROADMAP.md`.

</details>

### v2.1 — Mise en vie (Phases 10-14)

- [x] **Phase 10: Fondation design system NEXA** — Tokens OKLCH en couches + 5 polices self-hostées + thème no-flash RTL-safe (axe design, fondation). (completed 2026-06-21)
- [ ] **Phase 11: Composants NEXA, reskin transversal & rebranding** — Bibliothèque tokenisée + reskin de toutes les surfaces + MERA→NEXA + hero animé, sans promesse de gain.
- [ ] **Phase 12: Routines d'analyse Claude planifiées (sans API)** — Environment + fenêtres Remote day/swing + 1 run réel snapshot→analyze→persist, monitoré.
- [ ] **Phase 13: Backtest du catalogue de patterns (source-discrimination + moteur)** — Migration `source` AVANT seed + catalogue figé + `packages/backtest` réutilisant `replayOutcome` + Wilson golden-testé.
- [ ] **Phase 14: Track record affiché & boucle outcomes en prod** — Provenance backtest/réel + N visible + bascule N≥30 + outcome-tracker en prod.

## Phase Details

### Phase 10: Fondation design system NEXA
**Goal** : Poser le socle de design tokenisé (couleurs OKLCH NEXA, polices, thèmes) sur lequel tout le reskin s'appuiera, avec garantie no-flash et RTL préservé — jamais à retrofitter.
**Depends on** : v2.0 livré (globals.css, ThemeToggle, i18n/RTL, fonts.ts existants).
**Requirements** : DESIGN-01, DESIGN-02, DESIGN-03, DESIGN-04
**Success Criteria** (what must be TRUE) :
  1. Au rechargement d'une page, le thème stocké (clair/sombre × marque) s'affiche sans aucun flash visible, dans les locales fr/en/ar.
  2. Les textes et accents rendent les couleurs de la palette NEXA (cyber green / royal purple) via des tokens OKLCH en couches (primitive→semantic→component) lus depuis `globals.css`.
  3. Les 5 familles de polices (Archivo, Chakra Petch, Space Grotesk, JetBrains Mono, Noto Sans Arabic) sont servies en self-host (aucun appel CDN au runtime) et exposées en CSS vars.
  4. En arabe, la mise en page reste correctement miroir (propriétés logiques uniquement) sur les surfaces touchées par la fondation.
**Plans** : 3 plans (3 vagues : 10-01 gate les tests Wave-0, 10-02 polices, 10-03 tokens)
- [x] 10-01-PLAN.md — Wave-0 : 5 tests de validation (design-tokens/fonts/rtl-logical + no-cdn/no-flash) + résolution du CONFIG GAP Vitest (DESIGN-01..04)
- [x] 10-02-PLAN.md — Migration polices : 5 familles NEXA self-hostées via next/font/local, suppression Inter + IBM Plex (DESIGN-02)
- [x] 10-03-PLAN.md — Migration tokens : globals.css en 3 couches OKLCH NEXA (primitive→semantic→component), repointage polices, RTL/no-flash préservés (DESIGN-01/03/04)
**UI hint** : yes
**Notes** : Axe design (parallélisable contre Phases 12-13). Adresse Pitfalls P8 (RTL) et P13 (FOUC) en fondation. Aucune nouvelle dépendance runtime (CSS + `next/font/local`). Décision figée : Noto Sans Arabic REMPLACE IBM Plex Sans Arabic (D-01).

### Phase 11: Composants NEXA, reskin transversal & rebranding
**Goal** : Donner à toute la plateforme son identité NEXA via une bibliothèque de composants tokenisée, reskiner chaque route group, et achever le rebranding MERA→NEXA — sans réintroduire la moindre promesse de gain.
**Depends on** : Phase 10 (tokens + polices + thèmes posés).
**Requirements** : DESIGN-05, BRAND-01, BRAND-02, BRAND-03, BRAND-04, UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07
**Success Criteria** (what must be TRUE) :
  1. La vitrine publique, l'espace membre (liste + détail trade + chart), l'Académie, l'auth/compte et l'admin sont tous au design NEXA, trilingues AR-RTL/EN/FR, le gating RLS et le `<Disclaimer />` préservés sur chaque page.
  2. La marque affichée partout est « NEXA » (mark + wordmark + favicon + OG + logo header/footer) ; plus aucune trace de « MERA » / « Make Everybody Rich Again » dans le code ou le contenu.
  3. Le hero animé complet (globe + cartes flottantes + data-rain + tilt/parallaxe) est livré et respecte `prefers-reduced-motion`, sans pourcentage nu ni promesse de gain.
  4. Le test `no-perf-claims` couvre les composants NEXA (hero, marquee, gauges) : aucun composant reskiné ne rend de % non mesuré ni de baseline de gain.
  5. L'`ExpiryBanner` (alerte J-3/J-1) est câblé et visible dans l'espace membre/compte (dette WIRING-01/PAY-05 levée au passage).
**Plans** : 8 plans (6 vagues)
- [x] 11-01-PLAN.md — Tokens-résidus : purple accent + amber risque en 3 couches (DESIGN-05)
- [ ] 11-02-PLAN.md — Wave-0 garde-fous : no-perf-claims composant + no-mera-brand + rtl-scan étendu (BRAND-04/BRAND-01/DESIGN-04)
- [ ] 11-03-PLAN.md — Recoloration résiduelle : CandleChart (lwc) + SignalCard + ExpiryBanner tokenisé (UI-03/UI-07)
- [ ] 11-04-PLAN.md — Bibliothèque NEXA : Eyebrow, ScoreRing, Marquee, ConfidenceStat, Logo (DESIGN-05/BRAND-03)
- [ ] 11-05-PLAN.md — Rebranding + assets : Logo header/footer + metadata/OG/icon + MERA→NEXA + baseline (BRAND-01/02/03)
- [ ] 11-06-PLAN.md — Reskin membre : liste + détail trade + ScoreRing, RLS préservé (UI-03)
- [ ] 11-07-PLAN.md — Hero animé CSS/vanilla TS : globe + cartes + data-rain + tilt, reduced-motion (UI-02)
- [ ] 11-08-PLAN.md — Reskin transversal (vitrine/académie/auth/compte/admin) + ExpiryBanner abonnement + gate E2E (UI-01/04/05/06/07)
**UI hint** : yes
**Notes** : Axe design (parallélisable contre Phases 12-13). Adresse Pitfall P7 (promesse de gain visuelle). Reskin = swap de tokens + nouveaux primitifs NEXA, jamais migration du fetch RLS vers le client (Anti-Pattern 3). CandleChart recoloré via l'API JS lwc (Anti-Pattern 5). Conserver `data-testid`/rôles ARIA des spec files E2E. **Divergence ROADMAP « 6 spec files » tranchée : 5 specs existent (i18n, affiliation-attribution, gating, auth, academie) — la note « 6 » est une coquille ; les 5 sont préservés, aucune 6e créée (plan 11-08).**

### Phase 12: Routines d'analyse Claude planifiées (sans API)
**Goal** : Activer le moteur en production via des routines Claude Code Remote planifiées (day + swing) qui produisent de vrais setups par `snapshot → analyze → persist`, sans clé API, idempotentes et monitorées — levant la dette v1.0 P4.
**Depends on** : Cœur v1.0 (combine-engine, persist.ts, sessions.ts) — indépendant des Phases 10-11.
**Requirements** : ROUTINE-01, ROUTINE-02, ROUTINE-03, ROUTINE-04, ROUTINE-05
**Success Criteria** (what must be TRUE) :
  1. Un Environment Claude Code injecte `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` et l'accès réseau `*.supabase.co` est confirmé depuis le runtime Remote.
  2. Des routines planifiées couvrent les fenêtres day (ouverture de session + clôture H1/H4) et swing (pré-clôture daily), alignées sur `apps/jobs/config/sessions.ts`.
  3. Un run réel de bout en bout produit ≥1 setup persisté via `persist.ts` (frontière de confiance intacte : Zod + guardrails + score recalculé en code, jamais le score de l'agent).
  4. Les runs sont idempotents, tracés dans `job_runs`, avec le flag `stale` visible sur `/admin/sante`, en restant sous le budget de quota (~15 runs/j partagé).
  5. Tout accès DB des jobs passe par `supabase-js` (jamais le MCP cloud) et aucune clé API Anthropic n'est utilisée.
**Plans** : TBD
**Notes** : Axe routine (parallélisable contre l'axe design). Config-first : Environments + schedules vivent HORS git (dashboard). Pas de job `analyze.ts` (Anti-Pattern 1) — ANALYZE reste agent-native ; `persist.ts` demeure la seule frontière d'écriture IA. Research flag : valider Open Question A1 (réseau `*.supabase.co` Remote) AVANT de planifier. Adresse Pitfalls P10 (hallucination), P11 (quota), P12 (MCP absent en Remote).

### Phase 13: Backtest du catalogue de patterns (source-discrimination + moteur)
**Goal** : Mesurer un win-rate par pattern via un backtest honnête, en posant d'abord la discrimination de source (anti double-comptage) et en figeant le catalogue, puis en réutilisant `replayOutcome` pour produire un % statistiquement significatif.
**Depends on** : Cœur v1.0 (`replayOutcome`, `packages/indicators`, `pattern_stats` 0014). Migration source = prérequis dur du moteur.
**Requirements** : BACKTEST-01, BACKTEST-02, BACKTEST-03, BACKTEST-04
**Success Criteria** (what must be TRUE) :
  1. Une migration ajoute la discrimination de source (`backtest` vs `live`) — table `backtest_outcomes` + colonne/vue `pattern_stats` — AVANT tout seed ; un re-run du seed laisse N stable (pas d'accumulation).
  2. Le catalogue de patterns (patterns nommés → détecteurs de `packages/indicators`) est figé et documenté AVANT l'écriture du moteur.
  3. `packages/backtest` rejoue le catalogue sur l'historique de candles via `replayOutcome` (first-touch, anti look-ahead réutilisé tel quel) et agrège un win-rate mesuré par pattern.
  4. L'intervalle de Wilson est golden-testé ; aucun pattern sous le seuil de significativité n'est présenté comme un % mesuré.
**Plans** : TBD
**Notes** : Axe backtest. **Ordre dur** : migration source (BACKTEST-01) → catalogue figé (BACKTEST-02) → moteur (BACKTEST-03) → significativité (BACKTEST-04). Inverser corrompt `pattern_stats` (double-comptage silencieux). `packages/backtest` séparé de `packages/indicators` (préserver sa pureté). Aucune écriture dans `trade_setups`/`prediction_outcomes` (Anti-Pattern 2). Research flag : le catalogue = décision fondateur (Borhane) à figer avant le code. Adresse Pitfalls P2, P3, P5, P6.

### Phase 14: Track record affiché & boucle outcomes en prod
**Goal** : Afficher dès J1 un % de réussite toujours mesuré, étiqueté par provenance avec son N, et faire tourner la boucle outcome-tracker en prod pour basculer progressivement du backtest vers le track record réel.
**Depends on** : Phase 12 (routine produisant des signaux réels) ET Phase 13 (backtest seedant `pattern_stats`). Surfaces d'affichage reskinées en Phase 11.
**Requirements** : TRACK-04, TRACK-05, TRACK-06
**Success Criteria** (what must be TRUE) :
  1. Chaque pourcentage affiché porte sa provenance (`backtest` ou `réel`) et son N visible — jamais un % nu (test étendu interdisant un `winRatePct` rendu sans nœud de provenance).
  2. La bascule par bucket backtest→réel s'opère quand N_réel ≥ 30 ; en dessous, le % backtest est labellisé ou « échantillon insuffisant » est affiché — sans saut numérique silencieux.
  3. Le job `outcome-tracker` tourne en prod et résout les issues réelles (hit_tp/hit_sl/flat), alimentant le track record réel.
**Plans** : TBD
**UI hint** : yes
**Notes** : Tout chemin de rendu d'un % passe par `applyThreshold` (`@app/core`, source unique). Adresse Pitfalls P1 (% sans label), P4 (N<30 affiché), P9 (bascule silencieuse). La bascule est un changement de filtre de provenance, jamais une réécriture de chiffres.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Socle transverse i18n/rôles | v2.0 | 4/4 | Complete | 2026-06-14 |
| 2. Vitrine & gate légal | v2.0 | 3/3 | Complete | 2026-06-16 |
| 3. Espace membre signaux | v2.0 | 3/3 | Complete | 2026-06-16 |
| 4. Paiement USDT (encaissement) | v2.0 | 6/6 | Complete | 2026-06-17 |
| 5. Track record & % mesuré | v2.0 | 3/3 | Complete | 2026-06-17 |
| 6. Telegram public | v2.0 | 3/3 | Complete | 2026-06-18 |
| 7. Affiliation à paliers | v2.0 | 6/6 | Complete | 2026-06-18 |
| 8. Superadmin consolidé | v2.0 | 4/4 | Complete | 2026-06-19 |
| 9. CMS cours & articles | v2.0 | 5/5 | Complete | 2026-06-20 |
| 10. Fondation design system NEXA | v2.1 | 3/3 | Complete   | 2026-06-21 |
| 11. Composants NEXA & reskin transversal | v2.1 | 1/8 | In Progress|  |
| 12. Routines d'analyse Claude (sans API) | v2.1 | 0/? | Not started | - |
| 13. Backtest catalogue de patterns | v2.1 | 0/? | Not started | - |
| 14. Track record affiché & boucle prod | v2.1 | 0/? | Not started | - |

**v2.0 : 9/9 phases complètes, 37/37 plans, 41/41 requirements couverts.**
**v2.1 : 0/5 phases, 28/28 requirements mappés.**

## Arêtes critiques (v2.1)

- **Axe design** : tokens/thèmes/polices (Phase 10) AVANT composants/reskin (Phase 11). No-flash + RTL = fondation, jamais retrofit.
- **Axe routine** : config Environment + accès réseau `*.supabase.co` AVANT scheduling/run (Phase 12). ANALYZE reste agent-native ; `persist.ts` = seule frontière d'écriture IA.
- **Axe backtest** : migration source (BACKTEST-01) + catalogue figé (BACKTEST-02) AVANT moteur (BACKTEST-03) et affichage (Phase 14). Inverser corrompt `pattern_stats`.
- **Track record** (Phase 14) dépend de la routine (signaux réels, Phase 12) ET du backtest (seed `pattern_stats`, Phase 13).
- **Parallélisme** : l'axe design (Phases 10-11) est parallélisable contre les axes routine+backtest (Phases 12-13) — surfaces disjointes (CSS/composants vs jobs/DB).

## Notes de clôture v2.0

- Vérification automatisée 100 % verte (Vitest 566 ✓, typecheck 0 erreur) ; P01 + P09 live-vérifiés (E2E 32 ✓).
- Items différés à la clôture (vérifs live P02-P08, UAT P02/P03) : voir `STATE.md → Deferred Items`.
- Dette explicite hors jalon : **WIRING-01** (ExpiryBanner) traité en Phase 11 (UI-07) ; **LEGAL-02** (sign-off juriste) reste hors scope v2.1.

---
*Roadmap v2.1 créée 2026-06-21 (5 phases, 10-14). Numérotation continue après v2.0. Détail v2.0 archivé `.planning/milestones/v2.0-ROADMAP.md`.*
