---
phase: 02
slug: vitrine-publique-trilingue-gate-l-gal
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-14
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source : RESEARCH §Validation Architecture. Surface réduite (pages publiques lecture seule, zéro écriture métier, zéro paiement).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (unit) + Playwright 1.60.0 (E2E) — déjà câblés en P1 |
| **Config file** | racine workspace (`vitest`, `playwright`) ; check statique `scripts/check-i18n-hardcoded.mjs` |
| **Quick run command** | `pnpm --filter web exec tsc -b --noEmit && pnpm lint:i18n` |
| **Full suite command** | `pnpm test && pnpm test:e2e` |
| **Estimated runtime** | quick ~20-30 s ; full ~plusieurs min (E2E) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web exec tsc -b --noEmit && pnpm lint:i18n` (rapide, < 30s)
- **After every plan wave:** Run `pnpm test` (Vitest unit + parité messages + legal-gate)
- **Before `/gsd:verify-work`:** suite E2E Playwright verte + revue visuelle RTL arabe (Manual-UAT, dev server requis)
- **Max feedback latency:** 30 s (quick) / boucle wave sur la suite unit

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | VITR-01 | T-02-SC | Install autorisée après vérif registres (AR-01-SC) | manual | N/A (checkpoint:human-verify) | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | VITR-01 | T-02-01 | shadcn init n'écrase pas :lang(ar) | static/type | `pnpm --filter web exec tsc -b --noEmit` | ✅ | ⬜ pending |
| 02-01-03 | 01 | 1 | VITR-01 | T-02-02 | Toggle thème no-flash, RTL-safe | type/static | `tsc -b --noEmit && pnpm lint:i18n` | ✅ | ⬜ pending |
| 02-02-01 | 02 | 2 | LEGAL-02 | T-02-05 | `LEGAL_REVIEW_DONE` défaut false, server-only | unit | `vitest run legal-gate.test.ts legal-artifact.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | LEGAL-01, VITR-03 | T-02-04/06 | `[doc]` allowlist + notFound() ; placeholders, aucun texte IA faisant foi | unit/type | `tsc -b --noEmit && vitest run messages-parity-legal.test.ts && pnpm lint:i18n` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | LEGAL-01 | T-02-07 | Disclaimer/Footer global toutes pages ; pas de dangerouslySetInnerHTML | type/static | `tsc -b --noEmit && pnpm lint:i18n` | ✅ | ⬜ pending |
| 02-03-01 | 03 | 3 | VITR-02 | T-02-10 | Funnel → « paiement bientôt », zéro adresse USDT | type/static | `tsc -b --noEmit && pnpm lint:i18n` | ✅ | ⬜ pending |
| 02-03-02 | 03 | 3 | VITR-01 | T-02-09 | Home rend hero+CTA, proof slot MASQUÉ (D-08) | type/static | `tsc -b --noEmit && pnpm lint:i18n` | ✅ | ⬜ pending |
| 02-03-03 | 03 | 3 | VITR-03 | T-02-11 | Aucune allégation de perf dans les messages | unit | `vitest run no-perf-claims.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Stubs de test à créer avant/au début de l'implémentation des tâches correspondantes :

- [ ] `no-perf-claims.test.ts` — scanne `messages/*.json` (home/pricing) pour `%`/« garanti »/« profit » → fail si trouvé (VITR-03 / D-08)
- [ ] `messages-parity.test.ts` (ou `-legal`) — étend le contrôle de parité de clés P1 aux nouveaux namespaces `home`/`legal`/`disclaimer`/`pricing`/`paiement`/`theme` (LEGAL-01)
- [ ] `legal-gate.test.ts` — `isLegalReviewDone()` retourne false par défaut (env absente)
- [ ] `legal-artifact.test.ts` — `docs/legal/LEGAL-REVIEW.md` existe + contient la checklist (fs.existsSync + grep)
- [ ] (E2E, phase gate) `home.spec.ts`, `pricing.spec.ts`, `funnel.spec.ts`, `disclaimer.spec.ts`, `theme-toggle.spec.ts` — VITR-01/02/03, D-02
- [ ] (recommandé) Script CI grep RTL — bloque les classes physiques `ml/mr/pl/pr/left/right` (Pitfall B)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Légitimité des paquets npm avant install | VITR-01 (T-02-SC) | slopcheck indisponible (AR-01-SC) ; jugement humain sur registres | Vérifier next-themes 0.4.6 / lucide-react 1.18.0 / @fontsource/ibm-plex-sans-arabic 5.2.9 sur npmjs.com (repos officiels, zéro postinstall), puis approuver |
| Revue visuelle RTL arabe, 2 thèmes | VITR-01, D-02 | Rendu visuel/RTL non capturable en assertion statique | Dev server, `/ar`, basculer dark/light, vérifier miroir RTL + prix non inversés (`<bdi>`) |
| Revue juridique (juriste externe) | LEGAL-02 | Humain externe, hors code — bloque l'encaissement P4, PAS la livraison P2 | Sign-off daté dans `docs/legal/LEGAL-REVIEW.md`, puis bascule manuelle `LEGAL_REVIEW_DONE=true` en prod avant 1er encaissement |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (checkpoint 02-01-01 = manual gate documenté)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (stubs listés ci-dessus)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (quick)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-14
