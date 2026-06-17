---
status: complete
phase: 05-track-record-mesur-affich
source: [05-VERIFICATION.md, 05-03-PLAN.md]
started: 2026-06-16
updated: 2026-06-17
---

## Current Test

[terminé — 5/5 validés par Borhane le 2026-06-17 ("tout est parfait") ; item 3 pré-vérifié live (RLS anon)]

Note état des données au moment du test : `prediction_outcomes` contient désormais
**2 outcomes** (backtest forcé de cette session, cf. engine-pipeline-state) → la vitrine
affiche « échantillon insuffisant — 2 trades » **sans aucun %** (pas l'empty state).
C'est le comportement N<30 attendu (« jamais de % inventé »).

## Pré-requis

```
pnpm --filter web dev   # http://localhost:3000  (.env.local Supabase configuré)
```

Note : `prediction_outcomes` est vide aujourd'hui (aucun setup encore rejoué) →
le bloc affichera l'**état vide** « Track record en cours de mesure ». C'est le
comportement attendu, et il prouve déjà le cœur (« jamais de % inventé »). Pour
voir le chemin %+N avec N≥30, il faut d'abord des outcomes (laisser tourner
`outcome-tracker` sur des setups expirés, ou injecter des données de test).

## Tests

### 1. Rendu vitrine en navigation privée (anon)
expected: en navigation privée (non connecté), la vitrine `/` affiche le bloc track record — soit les agrégats %+N (si N≥30), soit « échantillon insuffisant — N trades », soit l'empty state « Track record en cours de mesure ». Aucun crash.
result: passed — affiche « échantillon insuffisant — 2 trades » (N=2 < 30), aucun %, pas de crash.

### 2. N toujours visible / aucun % sous le seuil
expected: le nombre de trades N est affiché à côté de chaque chiffre ; AUCUN % n'apparaît tant que N < 30.
result: passed — N=2 visible, aucun % rendu sous le seuil.

### 3. Frontière RLS anon (sécurité)
expected: depuis un client anon (devtools/console), `SELECT prediction_outcomes` → 0 ligne / refus ; `SELECT pattern_stats` → OK. (Déjà confirmé au niveau config par get_advisors en 05-02 ; ceci est la confirmation de bout en bout.)
result: passed — pré-vérifié live 2026-06-17 avec la vraie clé anon : `prediction_outcomes` HTTP 200 `[]` (content-range */0, 0 ligne) ; `pattern_stats` HTTP 206 (14 lignes lisibles). RLS = vrai verrou (1 policy SELECT authenticated, aucune policy anon).

### 4. RTL arabe + lien méthodologie
expected: `/ar/` rend en RTL (propriétés logiques, nombres en `<bdi>`) ; le lien « Voir la méthodologie » mène à `/ar/methodologie`.
result: passed — `/ar` rend en RTL, lien méthodologie OK.

### 5. Disclaimer LEGAL-01 adjacent
expected: le disclaimer légal est visible à côté du bloc track record, sur la vitrine ET dans l'espace membre.
result: passed — disclaimer LEGAL-01 visible vitrine + espace membre.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
