# Roadmap — Plateforme d'Analyse de Trading "Vétéran"

## Milestones

- ✅ **v1.0 — Moteur analytique déterministe** — Phases 1-4 (livré 2026-06-14, archivé `.planning/archive/v1.0-moteur-analytique/`)
- ✅ **v2.0 — MVP plateforme publique (MENA, trilingue)** — Phases 1-9 (livré 2026-06-20)
- 📋 **v2.1+ — Automatisation (W5)** — PAY-AUTO / ENGINE-API / AFF-AUTO (planifié, hors scope v2.0)

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

**v2.0 : 9/9 phases complètes, 37/37 plans, 41/41 requirements couverts.**

## Notes de clôture v2.0

- Vérification automatisée 100 % verte (Vitest 566 ✓, typecheck 0 erreur) ; P01 + P09 live-vérifiés (E2E 32 ✓).
- Items différés à la clôture (vérifs live P02-P08, UAT P02/P03) : voir `STATE.md → Deferred Items`.
- Dette explicite hors jalon : **WIRING-01** (ExpiryBanner non câblé, PAY-05) et **LEGAL-02** (sign-off juriste, bloque le 1er encaissement réel).

---
*Roadmap collapsée à la clôture v2.0 (2026-06-20). W5 (automatisation) = prochain milestone candidat.*
