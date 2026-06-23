---
status: partial
phase: 16-reskin-transversal-de-toutes-les-pages
source: [16-VERIFICATION.md]
started: 2026-06-23T12:00:00Z
updated: 2026-06-23T12:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Landing green-only (palette DS v3, sans toggle volt)
expected: Page d'accueil dark vert néon, aucun bouton de bascule de thème visible
result: [pending]

### 2. Pastilles de fraîcheur admin colorées (/admin, /admin/sante)
expected: Dot vert = --signal-bullish, dot amber = --risk-moderate, dot rouge = bg-destructive — toutes affichées colorées (fix CR-01)
result: [pending]

### 3. Police des titres h1 (/abonnement, /signaux, /signaux/[id])
expected: Titres en police display (Archivo), cohérents avec les autres pages
result: [pending]
note: WR-04 — `font-heading` (utilisé sur ces pages, introduit en phase 04) n'a pas de token `--font-heading` déclaré dans globals.css ; risque de fallback silencieux. Dette préexistante hors scope phase 16.

### 4. data-rain sur auth uniquement
expected: Voile ambiant très subtil sur /login et /signup seulement — zéro sur /dashboard, /abonnement, /signaux
result: [pending]

### 5. Glow sur carte vedette /tarifs + SignalCards
expected: Halo box-shadow vert néon discret sur la carte Standard + les cartes signaux
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
