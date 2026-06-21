---
phase: 11
slug: composants-nexa-reskin-transversal-rebranding
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-21
---

# Phase 11 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Reskin NEXA transversal + rebranding (MERA→NEXA). 100 % in-repo, aucun package installé.
> Register authored at plan time (8 plans, blocs `<threat_model>` STRIDE) → mode **vérification de mitigations** (pas de scan de menaces nouvelles).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| build CSS → runtime | Tokens CSS = contenu de build statique ; aucune entrée utilisateur ne traverse. | Tokens de thème (non sensible) |
| copy i18n → rendu UI | La copy traverse i18n→écran ; % nu / promesse de gain = exposition légale (guardrail). | Texte i18n (légal) |
| code source → build livré | La marque MERA/slogan ne doit pas franchir vers le build livré. | Identité de marque |
| serveur (fetch RLS) → composant client | `currentPeriodEnd` / signaux fetchés serveur sous RLS ; le reskin ne migre jamais ce fetch au client. | Données membre (RLS-gated) |
| token CSS résolu → API JS lwc | `getComputedStyle` lit des tokens de build, pas d'input utilisateur, vers le chart. | Couleur authored |
| pointer events client → CSS | Le tilt hero lit des events pointer, écrit des CSS vars ; aucun fetch, aucune donnée sensible. | Coordonnées pointeur (éphémère) |
| metadata build → head HTML | `ImageResponse` (next/og) = build statique theme-aware, pas d'input utilisateur. | OG/icônes authored |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-11-01 | Tampering | globals.css token layers | accept | Édition de tokens CSS statiques ; aucun input dynamique ne traverse build→runtime. | closed |
| T-11-01-LIT | Tampering | flip `.dark` cassé par littéral HEX | mitigate | `var()`-only enforced ; grep HEX/amber sur SignalDetail = 0 (WR-01 corrigé en `c34ae9d`). | closed |
| T-11-FLIP | Tampering | couleurs ne flippant pas en `.dark` | mitigate | Tokens component-layer flip-safe restaurés (`c34ae9d`) ; SignalDetail via `var(--signal-bullish/bearish)`. | closed |
| T-11-LEGAL | Information Disclosure (légal) | copy / title / OG / baseline | mitigate | `no-perf-claims.test.ts` vert (% nu / promesse bloqués en CI). | closed |
| T-11-PERF | Information Disclosure (légal) | ConfidenceStat / FloatingCards / vitrine / score | mitigate | `no-perf-claims` vert ; ScoreRing via `RISK_STROKE` (jamais % nu). | closed |
| T-11-BRAND | Brand integrity | code + messages livrés | mitigate | `no-mera-brand.test.ts` vert (MERA/slogan bloqués sur `apps/web/src` + messages). | closed |
| T-11-RTL | Tampering (layout RTL) | composants reskinés | mitigate | `rtl-logical-props.test.ts` vert ; RTL restauré (`c34ae9d`, WR-02). | closed |
| T-11-RLS | Information Disclosure | signaux/page.tsx + [id]/page.tsx, ExpiryBanner, abonnement | mitigate | `createClient` serveur conservé ; 0 `createBrowserClient`/fetch migré au client (Anti-Pattern 3). | closed |
| T-11-XSS (svg) | Tampering | Logo / ScoreRing SVG | mitigate | SVG statique authored ; aucun `dangerouslySetInnerHTML` en prod (présent seulement dans le test qui en asserte l'absence). | closed |
| T-11-XSS (chart) | Tampering | lwc `applyOptions` | accept | Couleurs lues depuis tokens authored via `getComputedStyle().getPropertyValue()` ; aucune entrée dynamique injectée. | closed |
| T-11-SCORE | Visual integrity | ScoreRing | mitigate | `RISK_STROKE` = tokens de risque only (`muted`/`risk-moderate`/`signal-bearish`) ; couleur=risque, colorblind-safe (green=gagnant impossible). | closed |
| T-11-OG-XSS | Tampering | opengraph-image / icon | mitigate | `ImageResponse` (next/og) construit depuis contenu authored statique ; aucune entrée dynamique. | closed |
| T-11-DISC | Legal | surfaces reskinées | mitigate | `<Disclaimer />` préservé (7 fichiers app) ; pas de fuite de contenu membre via reskin. | closed |
| T-11-E2E | Security regression | data-testid gating/auth | mitigate | 5 specs E2E préservées (`academie`, `affiliation-attribution`, `auth`, `gating`, `i18n`) ; rejouées au gate 11-08. | closed |
| T-11-RM | Accessibility | hero animations | mitigate | Double-garde reduced-motion : CSS `@media (prefers-reduced-motion: no-preference)` (DataRain/WireframeGlobe) + JS `matchMedia` AVANT listener (HeroTilt.tsx:32). | closed |
| T-11-LIB | Tampering | hero deps | mitigate | CSS + vanilla TS only ; grep `three`/`gsap`/`framer-motion` = 0. | closed |
| T-11-SC | Tampering | npm/pip/cargo installs | mitigate | Aucun changement `package.json` dans les commits phase 11 (deps fonts/MDX viennent des phases 09/10). | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-11-01 | T-11-01 | Édition de tokens CSS statiques en couche de build ; aucune entrée utilisateur ne traverse la frontière build→runtime. Risque négligeable. | Borhane (fondateur) | 2026-06-21 |
| AR-11-02 | T-11-XSS (chart) | lwc `applyOptions` reçoit uniquement des valeurs de couleur lues depuis des tokens authored via `getComputedStyle` ; aucune donnée dynamique/utilisateur n'est injectée dans le chart. | Borhane (fondateur) | 2026-06-21 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-21 | 17 | 17 | 0 | Claude (gsd:secure-phase, vérification orchestrateur) |

**Méthode :** registre authored au plan-time (8 blocs `<threat_model>` STRIDE), mode vérification de mitigations. Preuves : 3 gardes CI vertes (`no-perf-claims`, `no-mera-brand`, `rtl-logical-props` — 10 tests), greps d'acceptance (HEX SignalDetail=0, `dangerouslySetInnerHTML` prod=0, `three/gsap/framer-motion`=0, `createBrowserClient` signaux=0), inspection code (RISK_STROKE, getComputedStyle, Disclaimer, double-garde reduced-motion), diff `package.json` phase 11 vide.

*Note : l'agent gsd-security-auditor a atteint la limite de session ; la vérification a été conduite directement par l'orchestrateur avec les mêmes contrôles déterministes.*

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-21
