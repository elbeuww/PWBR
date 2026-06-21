---
phase: 10
slug: fondation-design-system-nexa
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 10-RESEARCH.md §Validation Architecture (Nyquist enabled, no config override).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `4.1.8` (unit / CSS-text asserts) + Playwright `@playwright/test 1.60.0` (E2E / visual) — locked stack |
| **Config file** | `apps/web` workspace (vitest + playwright config) — Wave 0 adds any missing config |
| **Quick run command** | `pnpm --filter web test` (Vitest) |
| **Full suite command** | `pnpm --filter web test && pnpm --filter web exec playwright test` |
| **Estimated runtime** | ~30 seconds (unit fast; Playwright no-flash/no-CDN/RTL adds the bulk) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test` (Vitest CSS/font asserts — fast)
- **After every plan wave:** Run full suite (Vitest + Playwright: no-flash + no-CDN + RTL)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| DESIGN-01 | `globals.css` contains layered OKLCH tokens; semantic `--primary` resolves to green primitive; no stale brand HEX in semantic layer | unit (CSS text assert) | `pnpm --filter web test design-tokens` — assert `oklch(` present, `--nexa-green-500` defined, no `#1E5FBF`/`#03d87f` literals in semantic layer | ❌ W0 | ⬜ pending |
| DESIGN-02 | 5 `--font-*` vars exposed; weights self-hosted as `.woff2`; **zero** runtime CDN font request | unit + E2E | unit: assert `lib/fonts.ts` exports 5 families w/ `--font-*`; E2E: `pnpm --filter web exec playwright test no-cdn-fonts` — `page.on('request')` asserts no `fonts.googleapis.com`/`fonts.gstatic.com` | ❌ W0 | ⬜ pending |
| DESIGN-03 | Stored theme renders with no flash in fr/en/ar | E2E visual | `playwright test no-flash` — set `localStorage.theme='dark'`, reload, assert `<html class="dark">` present before first paint, no light-frame | ❌ W0 | ⬜ pending |
| DESIGN-04 | AR layout mirrored; no physical properties in foundation/base layer | unit (lint) + E2E | unit: regex scan touched files for `\b(ml-|mr-|left-|right-|pl-|pr-)\b` → fail if found in base; E2E: AR route asserts header actions on logical `end` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/design-tokens.test.ts` — DESIGN-01 (OKLCH presence, primitive→semantic layer structure, no stale brand HEX)
- [ ] `tests/fonts.test.ts` — DESIGN-02 (5 `--font-*` vars exported, self-hosted `.woff2` present in `src/fonts/`)
- [ ] `tests/no-cdn-fonts.spec.ts` — DESIGN-02 (Playwright request interception: zero Google Fonts calls at runtime)
- [ ] `tests/no-flash.spec.ts` — DESIGN-03 (stored-theme first-paint, fr/en/ar)
- [ ] `tests/rtl-logical-props.test.ts` — DESIGN-04 (physical-property lint on foundation-touched files)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Perceptual quality of OKLCH tonal scale (brand green / royal purple) in light & dark | DESIGN-01 | Aesthetic/perceptual judgment — automated check confirms token presence, not visual harmony | Open dashboard in light then dark, fr/en/ar; confirm cyber-green accents + royal-purple read as NEXA, no muddy/clipped tones |
| Arabic typographic feel (Noto Sans Arabic replacing IBM Plex) | DESIGN-02/04 | Script legibility/line-height is a human read | Load `/ar` route, confirm Arabic renders in Noto Sans Arabic with comfortable line-height, mirrored layout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 test files above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
