---
phase: 11
slug: composants-nexa-reskin-transversal-rebranding
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-21
validated: 2026-06-21
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (unit/guardrail) + @playwright/test 1.60 (E2E) |
| **Config file** | `vitest.config.ts` (racine — glob inclut `apps/web/test/**` + `apps/web/src/**`) + `apps/web/playwright.config.ts` |
| **Quick run command** | `npx vitest run <fragment>` (ex: `npx vitest run no-perf-claims`) |
| **Full suite command** | `npx vitest run && pnpm --filter web exec playwright test` |
| **Estimated runtime** | ~120 seconds (unit fast ; E2E dominant) |

> **⚠️ Correction (audit 2026-06-21)** : `pnpm --filter web test …` ne lance RIEN — le package `web` n'a pas de script `test`, le filtre est interprété comme un pattern de nom de test par le vitest racine (exit 0 silencieux). Utiliser `npx vitest run` depuis la racine.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run no-perf-claims`
- **After every plan wave:** Run `npx vitest run` (vitest full)
- **Before `/gsd:verify-work`:** Full suite (vitest + playwright) must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Requirement | Plan | Invariant gardé | Guardrail (text-scan) | Commande | Statut |
|-------------|------|-----------------|-----------------------|----------|--------|
| DESIGN-01/05 | 11-01..04 | Tokens OKLCH en couches, zéro HEX marque obsolète dans le sémantique | `apps/web/src/styles/__tests__/design-tokens.test.ts` | `npx vitest run design-tokens` | ✅ green |
| BRAND-01 | 11-02, 11-05 | Zéro `MERA` / slogan dans `src/**` + `messages/*` | `apps/web/test/no-mera-brand.test.ts` | `npx vitest run no-mera-brand` | ✅ green |
| BRAND-04 | 11-02, 11-04, 11-07 | Zéro `%`/promesse de gain (marketing + namespaces composant) | `apps/web/test/no-perf-claims.test.ts` | `npx vitest run no-perf-claims` | ✅ green |
| DESIGN-04 (nexa/hero) | 11-04, 11-07 | Props logiques RTL dans `nexa/`+`hero/`+fondation | `apps/web/src/styles/__tests__/rtl-logical-props.test.ts` | `npx vitest run rtl-logical-props` | ✅ green |
| **DESIGN-04 / WR-02** | 11-03, 11-08 | **Props logiques RTL dans `components/ui/alert.tsx`** (ExpiryBanner surface AR) — pas de `right-`/`pl-`/`pr-`/`text-left` | `rtl-logical-props.test.ts` (étendu — audit 06-21) | `npx vitest run rtl-logical-props` | ✅ green |
| **DESIGN-05 / WR-01** | 11-06 | **Flip-safe : zéro HEX direction (#15803D/#B91C1C/#22C55E/#EF4444) dans `components/signals/`** | `apps/web/src/components/signals/__tests__/no-hardcoded-signal-hex.test.ts` (nouveau — audit 06-21) | `npx vitest run no-hardcoded-signal-hex` | ✅ green |
| MEMB-04 / D-10 | 11-06 | Contenu IA rendu verbatim + zéro `dangerouslySetInnerHTML` (anti-XSS) | `apps/web/src/components/signals/__tests__/SignalDetail.test.tsx` | `npx vitest run SignalDetail` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*WR-01/WR-02 : corrigés en code au commit `c34ae9d` mais NON verrouillés par test ; les 2 guards ci-dessus (audit 2026-06-21) ferment ce trou anti-régression. Le reste (rendu visuel, reduced-motion, theme-flip MutationObserver, E2E live-Supabase) est irréductiblement manuel — voir §Manual-Only.*

---

## Wave 0 Requirements

- [x] Étendre `apps/web/test/no-perf-claims.test.ts` — couverture composant (hero, marquee, scoreRing, baseline, confidenceStat) en plus des namespaces marketing (BRAND-04) — **fait**
- [x] Préserver les 5 spec files E2E existants (`i18n`, `affiliation-attribution`, `gating`, `auth`, `academie`) — présents dans `apps/web/e2e/`
- [x] Aucun framework à installer — vitest + playwright déjà en place
- [x] **Audit 2026-06-21** : verrouiller WR-02 (RTL `alert.tsx`) via extension `rtl-logical-props.test.ts` — **fait**
- [x] **Audit 2026-06-21** : verrouiller WR-01 (flip-safe HEX direction `signals/`) via nouveau `no-hardcoded-signal-hex.test.ts` — **fait**

*Tous les invariants machine-assertables sont désormais gardés ; seules les vérités visuelles/OS-level/E2E-live restent manuelles.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rendu visuel hero animé (globe filaire, data-rain, cartes) | UI-02 | Fidélité visuelle subjective non assertable en unit | Charger `(marketing)/page.tsx` dans les 3 locales, vérifier composition + fond ink fixe |
| `prefers-reduced-motion` ⇒ composition 100% statique | UI-02 / DESIGN-05 | Préférence OS difficile à simuler de façon stable | Activer reduced-motion OS, recharger : zéro animation, composition préservée |
| Cohérence dégradé green→purple du mark SVG (#03d87f/#63279b) | BRAND-03 | Inspection visuelle des hex exacts | Vérifier mark + favicon + OG en clair/sombre |
| RTL AR — propriétés logiques sur composants reskinés | DESIGN-04 (préservé) | Inspection layout miroir | Locale `ar`, vérifier `dir=rtl` + pas de débordement |

---

## Validation Sign-Off

- [x] Tout invariant machine-assertable a un guard `<automated>` ; le reste est manual-only documenté
- [x] Continuité d'échantillonnage : pas de 3 tâches consécutives sans verify automatisé
- [x] Wave 0 couvre toutes les références MISSING (no-perf-claims étendu + WR-01/WR-02 verrouillés)
- [x] Aucun flag watch-mode
- [x] Latence de feedback < 120s (les 7 guards text-scan : ~0.2s)
- [x] `nyquist_compliant: true` posé dans le frontmatter

**Approval:** validated (2026-06-21)

---

## Validation Audit 2026-06-21

| Metric | Count |
|--------|-------|
| Gaps found | 2 |
| Resolved (automated) | 2 |
| Escalated | 0 |

**Gap-1 (WR-02 / DESIGN-04)** — `rtl-logical-props.test.ts` ne scannait pas `components/ui/alert.tsx` (où vivait WR-02). Étendu : `alert.tsx` ajouté au scan + regex élargi à `text-left`/`text-right`. GREEN.

**Gap-2 (WR-01 / DESIGN-05)** — Aucun guard ne verrouillait l'absence de HEX direction dans `components/signals/`. Créé `no-hardcoded-signal-hex.test.ts` (scan #15803D/#B91C1C/#22C55E/#EF4444). GREEN.

> Cause racine : le commit `c34ae9d` a corrigé les invariants flip-safe/RTL **en code** sans ajouter de test — régression silencieuse possible. Les 2 guards ferment le trou.
> Note infra : commande VALIDATION corrigée (`pnpm --filter web test` → `npx vitest run`, le 1ᵉʳ ne lançait rien).
