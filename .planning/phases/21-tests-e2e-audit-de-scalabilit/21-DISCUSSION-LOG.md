# Phase 21: Tests E2E + audit de scalabilité - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-26
**Phase:** 21-tests-e2e-audit-de-scalabilit
**Areas discussed:** Couverture E2E, Données E2E, Barre audit SCALE-06, Exécution & gate CI

---

## Couverture E2E

| Option | Description | Selected |
|--------|-------------|----------|
| Profond dashboards + smoke existant | Couverture profonde des dashboards 19+20 (neufs, UAT 20 sauté), smoke léger sur l'existant déjà couvert | ✓ |
| Parité large sur tous les flux | Étendre uniformément tous les flux, plus long, redondant | |

**User's choice:** Profond dashboards + smoke existant
**Notes:** L'effort va où est le risque — les dashboards sont les surfaces neuves non testées.

---

## Données E2E

| Option | Description | Selected |
|--------|-------------|----------|
| Comptes fixtures dédiés déterministes | Comptes par rôle/état seedés à part, reproductibles, CI-friendly ; seed ~10k réservé à l'audit | ✓ |
| Directement sur le seed ~10k | E2E contre données seedées réelles, plus réaliste mais flaky/lent | |

**User's choice:** Comptes fixtures dédiés déterministes
**Notes:** Le seed ~10k sert uniquement à SCALE-06 (volume pour EXPLAIN), pas aux assertions E2E.

---

## Barre audit SCALE-06

| Option | Description | Selected |
|--------|-------------|----------|
| Index Scan + 0 advisor + temps borné | Triple critère sur requêtes clés ; échec si Seq Scan chaud ou nouvel advisor | ✓ |
| Advisors seuls | get_advisors propre uniquement, ne prouve pas les plans EXPLAIN | |

**User's choice:** Index Scan + 0 advisor + temps borné
**Notes:** Prouve réellement la scalabilité (plans de requête), pas seulement l'absence d'alerte.

---

## Exécution & gate CI

| Option | Description | Selected |
|--------|-------------|----------|
| CI GitHub Actions bloquant PR | E2E branchés au pipeline existant (lint/typecheck/vitest), bloquant + audit documenté | ✓ |
| Local seulement pour ce jalon | E2E en local uniquement, plus rapide mais sans garde-fou automatique | |

**User's choice:** CI GitHub Actions bloquant PR
**Notes:** Garde-fou anti-régression durable. Phase done = tous flux verts + audit sans régression.

---

## Claude's Discretion

- Structure fine des specs Playwright (page objects, helpers, fixtures de login).
- Seuils précis de temps de requête (à calibrer sur les baselines du seed ~10k pendant l'audit).
- Mécanique de provisioning/teardown des comptes fixtures.

## Deferred Ideas

- **Solde des dettes post-Phase 21** (décision utilisateur « audit d'abord, dette ensuite ») :
  migration `0022` (RPC gated paiements + affiliation), L-01/L-02/L-03/L-04, tech debt Phase 16
  (WR-04, WR-01, bg-token), corrections doc (SCALE-04, 17-VERIFICATION).
- **Gates non-code** (hors portée) : LEGAL-02 (sign-off juriste), UAT humains Phases 16/17/20.
- **Todo `0022`** examiné (match 0.6) mais NON intégré — soldé après la phase, avec check advisor/EXPLAIN ciblé.
