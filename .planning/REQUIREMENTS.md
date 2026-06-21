# Requirements: NEXA — Milestone v2.1 « Mise en vie »

**Defined:** 2026-06-21
**Core Value:** Produire, pour chaque opportunité, une analyse fiable et explicable (score /100 + risque + plan de trade), vulgarisée — avec un **% de réussite toujours mesuré, jamais inventé**. v2.1 : donner à la plateforme son **identité visuelle réelle**, **activer le moteur** en routines sans API, et rendre le **track record affichable dès J1**.

## v1 Requirements

Requirements de ce milestone. Chacun est mappé à une phase de la roadmap (voir Traceability).

### Identité de marque (BRAND)

- [x] **BRAND-01**: La marque affichée partout est « NEXA » (mark + wordmark) ; toute trace de « MERA » / « Make Everybody Rich Again » est retirée du code et du contenu.
- [ ] **BRAND-02**: Une baseline trilingue conforme (descripteur « Nouvelle Ère · Alliance d'Échange ») est affichée, **sans aucune promesse de gain**.
- [ ] **BRAND-03**: Un logo NEXA (mark + favicon + variantes clair/sombre + image OG) est intégré au header, au footer et aux métadonnées.
- [x] **BRAND-04**: Aucune promesse de gain ni pourcentage non mesuré n'apparaît dans les surfaces reskinées (test automatisé `no-perf-claims` étendu aux composants NEXA).

### Design system (DESIGN)

- [x] **DESIGN-01**: Des tokens OKLCH en couches (primitive→semantic→component) basés sur la palette NEXA (cyber green `#03d87f`, royal purple `#63279b`) vivent dans `globals.css` (`@theme`/`:root`/`.dark`).
- [x] **DESIGN-02**: Les 5 familles de polices (Archivo, Chakra Petch, Space Grotesk, JetBrains Mono, Noto Sans Arabic) sont self-hostées via `next/font/local` et exposées en CSS vars.
- [x] **DESIGN-03**: Le thème clair/sombre est sans flash (script pré-paint), aucun FOUC, RTL-safe.
- [x] **DESIGN-04**: Le RTL arabe est préservé sur tout le reskin (propriétés logiques uniquement, vérifié sur chaque surface).
- [x] **DESIGN-05**: Une bibliothèque de composants NEXA tokenisée existe (boutons, cards, nav, eyebrow, gauges/rings de score, marquee, stats de confiance) — pas de CSS bespoke par page.

### Reskin des surfaces (UI)

- [ ] **UI-01**: La vitrine publique (accueil, tarifs, méthodologie, légal, paiement-bientot) est au design NEXA, trilingue AR/EN/FR.
- [ ] **UI-02**: Le hero animé complet (globe + cartes flottantes + data-rain + tilt/parallaxe) est livré, `prefers-reduced-motion` respecté, sans % nu ni promesse de gain.
- [ ] **UI-03**: L'espace membre (liste signaux + détail trade + chart lightweight-charts) est au design NEXA, gating RLS préservé.
- [ ] **UI-04**: L'Académie (index + article + cours/leçon) est au design NEXA, RTL et fallback FR préservés.
- [ ] **UI-05**: L'auth (login/signup) et l'espace compte/abonnement sont au design NEXA.
- [ ] **UI-06**: Le back-office `/admin` est au design NEXA (peut rester plus sobre que le public).
- [ ] **UI-07**: L'`ExpiryBanner` (alerte J-3/J-1, dette WIRING-01/PAY-05) est câblé dans l'espace membre/compte.

### Routines d'analyse — moteur live sans API (ROUTINE)

- [ ] **ROUTINE-01**: Un Environment Claude Code est configuré avec les secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) et l'accès réseau `*.supabase.co` confirmé.
- [ ] **ROUTINE-02**: Des routines Remote planifiées couvrent les fenêtres **day** (ouverture de session + clôture H1/H4) et **swing** (pré-clôture daily), alignées sur `apps/jobs/config/sessions.ts`.
- [ ] **ROUTINE-03**: Un run réel de bout en bout `snapshot → analyze (vétéran) → persist` produit ≥1 setup persisté via `persist.ts` (frontière de confiance intacte, score recalculé en code).
- [ ] **ROUTINE-04**: Les runs sont idempotents et monitorés (`job_runs` + flag `stale` visible sur `/admin/sante`), sans dépasser le budget de quota (~15 runs/j partagé).
- [ ] **ROUTINE-05**: Les jobs accèdent à la DB via `supabase-js` uniquement (pas de MCP cloud), sans aucune clé API Anthropic.

### Backtest du catalogue de patterns (BACKTEST)

- [ ] **BACKTEST-01**: Une migration ajoute la discrimination de **source** (`backtest` vs `live`) — table `backtest_outcomes` + colonne/vue `pattern_stats` — **avant** tout seed de backtest (anti double-comptage).
- [ ] **BACKTEST-02**: Un **catalogue de patterns** est figé (patterns nommés → détecteurs de `packages/indicators`) avant l'écriture du moteur.
- [ ] **BACKTEST-03**: `packages/backtest` rejoue le catalogue sur l'historique de candles via `replayOutcome` (first-touch, anti look-ahead réutilisé tel quel) et agrège un win-rate mesuré par pattern.
- [ ] **BACKTEST-04**: La significativité statistique (intervalle de Wilson) est golden-testée ; aucun pattern sous le seuil n'est présenté comme un % mesuré.

### Track record affiché (TRACK)

- [ ] **TRACK-04**: Chaque pourcentage affiché porte sa **provenance** (`backtest` ou `réel`) et son **N** visible — jamais un % nu.
- [ ] **TRACK-05**: La bascule par bucket backtest→réel s'opère quand N_réel ≥ 30 ; en dessous, le % backtest est labellisé ou « échantillon insuffisant » est affiché.
- [ ] **TRACK-06**: Le job `outcome-tracker` tourne en prod et résout les issues réelles (hit_tp/hit_sl/flat), alimentant le track record réel.

## v2 Requirements

Reconnus mais différés au-delà de v2.1.

### Automatisation (AUTO)

- **PAY-AUTO**: Processeur crypto (NOWPayments/Cryptomus) — adresse unique par facture + webhooks (remplace la soumission de hash manuelle).
- **AFF-AUTO**: Automatisation des payouts d'affiliation.
- **ENGINE-API**: Migration vers clé API Anthropic + infra 24/7 (fiabilité au lancement payant, au-delà du quota Max).

### Calibration avancée (CALIB)

- **CALIB-01**: Courbes de calibration par bucket de score (au-delà du % mesuré simple).
- **CALIB-02**: Orchestration d'animations avancée via `motion` (si le CSS/vanilla atteint ses limites).

## Out of Scope

| Feature | Reason |
|---------|--------|
| % « 73 % » hardcodé du mock | Anti-feature : pourcentage non mesuré = exposition légale. Tout % vient de `pattern_stats`. |
| Slogan « Make Everybody Rich Again » | Anti-feature : promesse de gain explicite, contraire à la contrainte légale dure. |
| 2e univers de marque « volt/green » du mock | Remplacé par l'identité NEXA réelle (green + purple). |
| Clé API Anthropic en v2.1 | Hors scope ; le moteur tourne via routines Claude Code (forfait Max). → v2 (ENGINE-API). |
| LEGAL-02 (sign-off juriste) | Gate non-code, dépendance externe ; bloque le 1er encaissement, pas ce milestone. |
| PAY-AUTO / AFF-AUTO | Automatisation paiement/affiliation → v2. |
| Lib lourde d'animation/3D (GSAP, three.js, WebGL) | CSS + vanilla TS suffisent (recherche STACK) ; `motion` autorisé en secours seulement. |
| Actions/equities, scalping M1 temps réel | Inchangé : après le cœur prouvé. |

## Traceability

Chaque requirement → exactement une phase. Phases 10-14 (numérotation continue après v2.0).

| Requirement | Phase | Status |
|-------------|-------|--------|
| DESIGN-01 | Phase 10 | Complete |
| DESIGN-02 | Phase 10 | Complete |
| DESIGN-03 | Phase 10 | Complete |
| DESIGN-04 | Phase 10 | Complete |
| DESIGN-05 | Phase 11 | Complete |
| BRAND-01 | Phase 11 | Complete |
| BRAND-02 | Phase 11 | Pending |
| BRAND-03 | Phase 11 | Pending |
| BRAND-04 | Phase 11 | Complete |
| UI-01 | Phase 11 | Pending |
| UI-02 | Phase 11 | Pending |
| UI-03 | Phase 11 | Pending |
| UI-04 | Phase 11 | Pending |
| UI-05 | Phase 11 | Pending |
| UI-06 | Phase 11 | Pending |
| UI-07 | Phase 11 | Pending |
| ROUTINE-01 | Phase 12 | Pending |
| ROUTINE-02 | Phase 12 | Pending |
| ROUTINE-03 | Phase 12 | Pending |
| ROUTINE-04 | Phase 12 | Pending |
| ROUTINE-05 | Phase 12 | Pending |
| BACKTEST-01 | Phase 13 | Pending |
| BACKTEST-02 | Phase 13 | Pending |
| BACKTEST-03 | Phase 13 | Pending |
| BACKTEST-04 | Phase 13 | Pending |
| TRACK-04 | Phase 14 | Pending |
| TRACK-05 | Phase 14 | Pending |
| TRACK-06 | Phase 14 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28 ✓
- Unmapped: 0 ✓

Répartition : Phase 10 = 4 (DESIGN-01..04) · Phase 11 = 12 (DESIGN-05 + BRAND-01..04 + UI-01..07) · Phase 12 = 5 (ROUTINE-01..05) · Phase 13 = 4 (BACKTEST-01..04) · Phase 14 = 3 (TRACK-04..06).

---
*Requirements defined: 2026-06-21*
*Last updated: 2026-06-21 — roadmap créée, 28/28 requirements mappés aux Phases 10-14.*
