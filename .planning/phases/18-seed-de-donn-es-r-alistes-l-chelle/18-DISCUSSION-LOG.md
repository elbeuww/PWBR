# Phase 18: Seed de données réalistes à l'échelle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-25
**Phase:** 18-seed-de-donn-es-r-alistes-l-chelle
**Areas discussed:** Labellisation & non-fabrication, Population 10k & mix MRR, Idempotence & re-run, Preuve RLS à l'échelle

---

## Labellisation & non-fabrication

### Marquage des données seedées (Phase 13 reportée)

| Option | Description | Selected |
|--------|-------------|----------|
| Mini-migration 0018 (colonne source) | Colonne `source`/`is_demo` sur tables seedées dès P18 ; avance le min. de P13 ; testable/requêtable | ✓ |
| Cohorte démo conventionnelle (sans schéma) | Convention (emails @demo, plage UUID, flag profiles) ; zéro migration mais labellisation implicite/fragile | |
| Avancer toute la source-discrimination P13 | Tirer la migration complète (backtest_outcomes + pattern_stats) ; lourd, hors périmètre P18 | |

**User's choice:** Mini-migration 0018 (colonne source)
**Notes:** Justifié par SEED-02 = critère de succès dur qu'un scan/test doit prouver → colonne explicite préférable à une convention implicite.

### Génération des outcomes (VITR-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Outcomes bruts → % recalculé | Seeder win/loss/timeout + R par trade ; aucun win-rate stocké ; % calculés par DB/code | ✓ |
| Distribution paramétrée sans cible de win-rate | Idem + légère asymétrie R:R réaliste ; risque de paraître orienté | |
| Tu décides | Principe verrouillé, mécanique au researcher | |

**User's choice:** Outcomes bruts → % recalculé
**Notes:** Respect littéral de VITR-03 ; un test no-perf-claims/scan ne doit trouver aucun % en dur.

---

## Population 10k & mix MRR

### Profil de distribution

| Option | Description | Selected |
|--------|-------------|----------|
| Funnel réaliste (majorité gratuits) | ~65% jamais-payé / 12% découverte / 14% standard / 9% churned | |
| Orienté démo (plus d'abonnés actifs) | ~35-40% actifs ; dashboards mieux remplis, moins réaliste comme funnel | ✓ |
| Tu décides (ratios au researcher) | Principe verrouillé, ratios au researcher | |

**User's choice:** Orienté démo (plus d'abonnés actifs)
**Notes:** Choix de démonstration assumé. MRR reste mesuré (compté sur abonnements seedés réels) — VITR-03 ne concerne pas les comptes de population.

### Pricing seedé

| Option | Description | Selected |
|--------|-------------|----------|
| 9$ standard + 3$/15j découverte | Conforme PROJECT.md + vitrine livrée | ✓ |
| Autre grille à préciser | Grille différente (paliers annuels, etc.) | |

**User's choice:** 9$ standard + 3$/15j découverte

### Affiliés

| Option | Description | Selected |
|--------|-------------|----------|
| Oui, cohorte d'affiliés + commissions | Affiliés + abonnés ramenés + commissions ≤20% récurrent, FK-cohérentes | ✓ |
| Minimal (quelques affiliés témoins) | Juste de quoi prouver le schéma | |
| Tu décides | Volume au researcher | |

**User's choice:** Oui, cohorte d'affiliés + commissions
**Notes:** P19 (affiliation intégrée) et P20 (mix) seraient vides sans seed affilié.

---

## Idempotence & re-run

| Option | Description | Selected |
|--------|-------------|----------|
| Truncate cohorte démo + reseed | Delete WHERE source='demo' (ordre FK inverse) puis reseed faker déterministe ; ne touche jamais source='live' | ✓ |
| Upsert sur IDs déterministes | UUID déterministes + ON CONFLICT ; plus complexe sur graphes FK / orphelins | |
| Tu décides | Principe verrouillé, mécanique au researcher | |

**User's choice:** Truncate cohorte démo + reseed
**Notes:** La colonne `source` (décision précédente) rend le ciblage du nettoyage sûr et explicite.

---

## Preuve RLS à l'échelle (SEED-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Test d'intégration Vitest (client anon) | Client anon ; non-abonné=0 signal + isolation cross-user à l'échelle ; CI-able | ✓ |
| E2E Playwright | Parcours navigateur complet ; lourd, plutôt P21, risque de doublon | |
| Requêtes SQL manuelles documentées | Vérifs ad hoc ; pas de garde-fou automatisé | |

**User's choice:** Test d'intégration Vitest (client anon)
**Notes:** Ciblé SEED-03, complémentaire à l'E2E Playwright de Phase 21.

---

## Claude's Discretion

- Périmètre exact des tables recevant la colonne `source` (au-delà du minimum trade_setups/prediction_outcomes/profiles).
- Ratios numériques exacts de la distribution démo.
- Volumes de candles/snapshots/telegram_posts/job_runs à seeder.
- Fenêtre temporelle des paiements pour matérialiser le churn.
- Répartition des locales fr/en/ar et noms MENA.
- Ordre précis FK du nettoyage truncate.

## Deferred Ideas

- Moteur de backtest réel (packages/backtest, replayOutcome, Wilson, catalogue figé) → Phase 13 (reportée).
- Discrimination de source complète (backtest_outcomes, pattern_stats discriminée) → Phase 13.
- Audit chiffré de scalabilité (~10k) → Phase 21 (SCALE-06).
- E2E Playwright complet + isolation RLS par parcours navigateur → Phase 21.
- Câblage curseur keyset + matviews KPI restantes → Phases 19/20.
