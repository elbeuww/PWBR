---
phase: 9
slug: cms-cours-articles-vulgaris-s
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 09-RESEARCH.md §Validation Architecture. Per-task IDs populated by the planner.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `4.1.8` (unit) + Playwright `@playwright/test 1.60.0` (E2E) |
| **Config file** | racine workspace (`vitest`/`playwright` existants, cf. STACK) |
| **Quick run command** | `pnpm --filter web test -- academie/<unit>` |
| **Full suite command** | `pnpm --filter web test` + `pnpm --filter web e2e -- academie` |
| **Estimated runtime** | ~30 s (unit) ; E2E en Vercel preview |

---

## Sampling Rate

- **After every task commit:** `pnpm --filter web test -- academie/<unit>` (Vitest ciblé)
- **After every plan wave:** `pnpm --filter web test` (suite unit complète)
- **Before `/gsd:verify-work`:** suite unit verte + **E2E exécuté en Vercel preview** (le rendu MDX ne se valide pas en `next build` local — Pitfall `!`/webpack)
- **Max feedback latency:** ~30 s (unit)

---

## Per-Task Verification Map

> Task IDs assigned by the planner. Each row below is a requirement→behavior anchor the planner
> must bind to a concrete `{N}-PP-TT` task with an `<automated>` verify (or a Wave 0 dependency).

| Req | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|-----|----------|------------|-----------|-------------------|-------------|--------|
| CMS-01 | Résolution `(slug, locale)` retourne le bon fichier | — | unit | `pnpm --filter web test -- academie/content` | ❌ W0 | ⬜ pending |
| CMS-01 | Filtres : valeur hors-enum ignorée (whitelist Zod) | T-09-01 | unit | `pnpm --filter web test -- academie/searchParams` | ❌ W0 | ⬜ pending |
| CMS-01 | Temps de lecture déterministe (golden values fr/en/ar) | — | unit | `pnpm --filter web test -- academie/reading-time` | ❌ W0 | ⬜ pending |
| CMS-01 | TOC slugs == id rendus (accents/arabe) | — | unit | `pnpm --filter web test -- academie/toc` | ❌ W0 | ⬜ pending |
| CMS-01 / D-14 | Locale manquante → fallback FR + bandeau, jamais 404 | — | unit | `pnpm --filter web test -- academie/content` | ❌ W0 | ⬜ pending |
| CMS-01 | Frontmatter invalide → erreur de frontière (Zod) | T-09-02 | unit | `pnpm --filter web test -- academie/frontmatter` | ❌ W0 | ⬜ pending |
| CMS-02 / D-07 | Dérivation cours : ordre leçons + prev/next | — | unit | `pnpm --filter web test -- academie/course-model` | ❌ W0 | ⬜ pending |
| CMS-01 | Lecture article + nav cours rendus | — | e2e | `pnpm --filter web e2e -- academie` | ❌ W0 (preview) | ⬜ pending |
| LEGAL-01 | `<Disclaimer/>` présent sur 100% des contenus | — | e2e | `pnpm --filter web e2e -- academie` | ❌ W0 (preview) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/lib/academie/content.test.ts` — résolution `(slug, locale)` + fallback FR D-14
- [ ] `apps/web/src/lib/academie/searchParams.test.ts` — whitelist Zod (calque `signals/searchParams.ts`)
- [ ] `apps/web/src/lib/academie/reading-time.test.ts` — golden values fr/en/ar
- [ ] `apps/web/src/lib/academie/toc.test.ts` — cohérence slugs (accents/arabe)
- [ ] `apps/web/src/lib/academie/frontmatter.test.ts` — schéma Zod de frontière
- [ ] `apps/web/src/lib/academie/course-model.test.ts` — ordre leçons + prev/next
- [ ] E2E Playwright Académie (exécuté en Vercel preview)
- [ ] 3-5 fixtures MDX réelles (×3 langues) = contenu de preuve (D-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rendu MDX réel (composants pédago, prose, RTL arabe) | CMS-01 | `next build` local non-viable (chemin `!` casse webpack ; dev tourne en turbopack) | Déployer en Vercel preview, ouvrir `/{fr,en,ar}/academie` + un article + une leçon, vérifier callouts/étapes/encadré trade/disclaimer et bascule RTL |
| Bascule RTL arabe + éléments LTR (`<bdi>` prix/R:R) | I18N-02 (acquis P1) | Vérification visuelle | En preview, `/ar/academie/<slug>` : flux RTL, nombres/symboles LTR corrects |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (unit)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
