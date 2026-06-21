---
phase: 11
slug: composants-nexa-reskin-transversal-rebranding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (unit/guardrail) + @playwright/test 1.60 (E2E) |
| **Config file** | `apps/web/vitest.config.ts` + `apps/web/playwright.config.ts` |
| **Quick run command** | `pnpm --filter web test no-perf-claims` |
| **Full suite command** | `pnpm --filter web test && pnpm --filter web exec playwright test` |
| **Estimated runtime** | ~120 seconds (unit fast ; E2E dominant) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test no-perf-claims`
- **After every plan wave:** Run `pnpm --filter web test` (vitest full)
- **Before `/gsd:verify-work`:** Full suite (vitest + playwright) must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | DESIGN-05 / BRAND-01..04 / UI-01..07 | — | Aucun % nu, aucune promesse de gain rendue | unit + e2e | `pnpm --filter web test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Note: la carte par tâche sera remplie par le planner/executor — voir RESEARCH.md « Validation Architecture » pour les exigences Nyquist par requirement.*

---

## Wave 0 Requirements

- [ ] Étendre `apps/web/test/no-perf-claims.test.ts` — couverture composant (hero, marquee, gauges/rings) en plus des namespaces i18n actuels (BRAND-04)
- [ ] Préserver les 5 spec files E2E existants (`i18n`, `affiliation-attribution`, `gating`, `auth`, `academie`) — `data-testid` + rôles ARIA intacts
- [ ] Aucun framework à installer — vitest + playwright déjà en place

*Infrastructure existante couvre la majorité ; seul le scope de `no-perf-claims` doit être étendu.*

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (extension no-perf-claims)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
