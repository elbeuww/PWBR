---
phase: 11-composants-nexa-reskin-transversal-rebranding
plan: 06
subsystem: member-ui
tags: [reskin, nexa, scorering, eyebrow, rls, i18n, ui-03, design-05]
requires:
  - "11-03 (SignalCard direction tokenisée + CandleChart recoloré)"
  - "11-04 (ScoreRing, Eyebrow)"
  - "11-05 (i18n marque, ordering messages)"
provides:
  - "Espace membre (liste + détail) au design NEXA"
  - "SignalCard avec ScoreRing (couleur = risque, D-12)"
  - "Détail trade avec ScoreRing size 96 + Eyebrow"
affects:
  - "apps/web/src/components/signals/SignalCard.tsx"
  - "apps/web/src/components/signals/SignalDetail.tsx"
  - "apps/web/src/app/[locale]/(member)/signaux/page.tsx"
  - "apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx"
tech_stack:
  added: []
  patterns:
    - "ScoreRing RSC-safe : label aria traduit fourni par l'appelant (precedent FloatingCards/dialog closeLabel)"
    - "mapRiskToScoreRisk : low/medium/high/extreme -> faible/modere/eleve (D-12)"
key_files:
  created: []
  modified:
    - "apps/web/src/components/signals/SignalCard.tsx"
    - "apps/web/src/components/signals/SignalDetail.tsx"
    - "apps/web/src/app/[locale]/(member)/signaux/page.tsx"
    - "apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx"
    - "apps/web/src/messages/fr.json"
    - "apps/web/src/messages/en.json"
    - "apps/web/src/messages/ar.json"
decisions:
  - "D-11-06-A : score affiché EXCLUSIVEMENT via ScoreRing (couleur=risque). Le nombre brut neutre (text-2xl/text-3xl + barre) est supprimé de SignalCard ET de l'en-tête SignalDetail pour éviter le doublon avec le ScoreRing de la route détail."
  - "D-11-06-B : mapping risque DB->ScoreRing — low->faible, medium/inconnu->modere, high/extreme->eleve. extreme replié sur eleve (un seul cran colorimétrique extrême ; le label texte i18n reste distinct via signals.filters.riskExtreme)."
  - "D-11-06-C : Eyebrow tone par défaut (purple) en en-tête de la liste (signals.eyebrow) et du détail (réutilise signalDetail.planTitle)."
metrics:
  duration: "~12 min"
  completed: "2026-06-21"
  tasks: 2
  files: 7
---

# Phase 11 Plan 06 : Reskin espace membre (signaux + détail) NEXA Summary

Liste signaux et détail trade passés au design NEXA avec ScoreRing (couleur = risque, jamais « vert = gagnant », D-12) et en-têtes Eyebrow, en préservant strictement le fetch RLS serveur (createClient) et les surfaces de gating E2E.

## What Was Built

### Task 1 — ScoreRing dans SignalCard + Eyebrow liste (commit 8ae690f)
- `SignalCard.tsx` : remplacement du bloc score neutre (span text-2xl + barre bg-muted) par `<ScoreRing score risk size=40 label />`. Couleur du stroke pilotée par le risque (D-12). Direction tokenisée (--signal-*), `<bdi>`, propriétés logiques et moule shadcn card conservés.
- `mapRiskToScoreRisk()` : low→faible, medium→modere, high/extreme→eleve, inconnu→modere.
- Label aria via `scoreRing.ariaTemplate` + `scoreRing.riskLabels.*` (RSC-safe, fourni par l'appelant — precedent FloatingCards 11-04).
- `signaux/page.tsx` : en-tête NEXA `Eyebrow + h1`, espacement 8pt (`mb-8`, `gap-2`). Fetch RLS `createClient()` INCHANGÉ. État vide i18n existant préservé (`emptyHeading`/`emptyBody`).
- `messages/{fr,en,ar}.json` : ajout de `signals.eyebrow` à parité (Espace membre / Member area / فضاء الأعضاء).

### Task 2 — Détail trade ScoreRing 96 + Eyebrow (commit 71274cd)
- `[id]/page.tsx` : nouvel en-tête NEXA (carte `bg-card border-border`) avec `Eyebrow` + symbole `<bdi>` + `<ScoreRing size=96>` (couleur = risque). Fetch RLS `createClient()` INCHANGÉ. `SignalsDisclaimerBanner` préservé. CandleChart recoloré (11-03) consommé tel quel via `CandleChartLazy`. Propriétés logiques only.
- `SignalDetail.tsx` (déviation hors files_modified, voir Deviations) : suppression du score brut neutre de l'en-tête pour éviter le doublon avec le ScoreRing de page. Direction sémantique conservée.

## Verification

- `grep ScoreRing` : SignalCard=6, [id]/page.tsx=5. `grep createClient` : liste=3, détail=3 (RLS intact, T-11-RLS mitigé).
- `grep Disclaimer` détail=2 (SignalsDisclaimerBanner préservé).
- `pnpm vitest run no-perf-claims` : 5/5 verts (T-11-PERF — pas de % nu, score=ScoreRing).
- Tests de parité i18n : 18/18 verts (la clé `signals.eyebrow` respecte la parité fr/en/ar).
- `pnpm --filter web exec tsc -b --noEmit` : 0 erreur.
- `pnpm run lint:i18n` : exit 0 (I18N-03, aucune chaîne en dur).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Consistency] Suppression du score brut dans SignalDetail.tsx**
- **Found during :** Task 2
- **Issue :** Le plan liste uniquement `[id]/page.tsx` en files_modified, mais le score était rendu par le composant enfant `SignalDetail` (en-tête, `text-3xl` neutre). Ajouter un ScoreRing dans la page sans toucher SignalDetail aurait affiché le score DEUX fois (doublon visuel + score neutre survivant, contraire à l'intention « score = ScoreRing »).
- **Fix :** Retrait du bloc score neutre de l'en-tête `SignalDetail` ; le score est désormais le seul ScoreRing de la route. Direction sémantique conservée. Loi D-03 préservée (direction = couleur, score ≠ perf).
- **Files modified :** apps/web/src/components/signals/SignalDetail.tsx
- **Commit :** 71274cd

## Anti-Pattern Compliance (threat_model)

- **T-11-RLS (Information Disclosure)** : `createClient` serveur conservé sur liste ET détail (grep). Aucune migration de fetch au client. MITIGÉ.
- **T-11-E2E (régression sécurité)** : `gating.spec.ts` cible des URLs/redirections + status 404, AUCUN data-testid/role sur ces surfaces signaux → aucun sélecteur supprimé. Suite gating rejouée en 11-08 (gate de phase). MITIGÉ.
- **T-11-PERF (légal)** : no-perf-claims vert ; ScoreRing couleur = risque, zéro % nu, zéro promesse de gain. MITIGÉ.
- **T-11-SC (Tampering)** : AUCUN package installé. MITIGÉ.

## Known Stubs

Aucun. Les surfaces consomment les données RLS réelles (fetch serveur inchangé) et les composants NEXA livrés (11-04).

## Self-Check: PASSED
