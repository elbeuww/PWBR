---
status: partial
phase: 05-track-record-mesur-affich
source: [05-VERIFICATION.md, 05-03-PLAN.md]
started: 2026-06-16
updated: 2026-06-16
---

## Current Test

[awaiting human testing — différé volontairement, vérifications navigateur]

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
result: [pending]

### 2. N toujours visible / aucun % sous le seuil
expected: le nombre de trades N est affiché à côté de chaque chiffre ; AUCUN % n'apparaît tant que N < 30.
result: [pending]

### 3. Frontière RLS anon (sécurité)
expected: depuis un client anon (devtools/console), `SELECT prediction_outcomes` → 0 ligne / refus ; `SELECT pattern_stats` → OK. (Déjà confirmé au niveau config par get_advisors en 05-02 ; ceci est la confirmation de bout en bout.)
result: [pending]

### 4. RTL arabe + lien méthodologie
expected: `/ar/` rend en RTL (propriétés logiques, nombres en `<bdi>`) ; le lien « Voir la méthodologie » mène à `/ar/methodologie`.
result: [pending]

### 5. Disclaimer LEGAL-01 adjacent
expected: le disclaimer légal est visible à côté du bloc track record, sur la vitrine ET dans l'espace membre.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
