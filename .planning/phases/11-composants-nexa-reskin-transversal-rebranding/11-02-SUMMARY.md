---
phase: 11-composants-nexa-reskin-transversal-rebranding
plan: 02
subsystem: tests-guardrails
tags: [wave-0, text-scan, legal-guardrail, brand-guardrail, rtl, i18n]
requires:
  - "vitest.config.ts glob apps/web/test/** + apps/**/__tests__/**"
  - "apps/web/src/messages/{fr,en,ar}.json"
provides:
  - "Garde no-perf-claims étendu aux namespaces composant (BRAND-04)"
  - "Garde no-mera-brand (BRAND-01) scan code+messages livrés"
  - "Garde rtl-logical-props étendu aux dossiers nexa/hero (DESIGN-04)"
affects:
  - "Plans 11-03..11-08 (copy/composants/hero feront tourner ces gardes en CI)"
  - "Plan 11-05 (rebranding i18n) fera virer no-mera-brand au vert"
tech-stack:
  added: []
  patterns:
    - "Text-scan récursif node:fs tolérant à l'absence (namespace/dossier manquant => [])"
    - "RED Wave-0 documenté (Nyquist : garde avant code protégé)"
key-files:
  created:
    - "apps/web/test/no-mera-brand.test.ts"
  modified:
    - "apps/web/test/no-perf-claims.test.ts"
    - "apps/web/src/styles/__tests__/rtl-logical-props.test.ts"
decisions:
  - "D-11-02-A : MARKETING_NAMESPACES -> SCANNED_NAMESPACES + 5 namespaces composant ; tolérance à l'absence native via collectStrings(undefined)=[]"
  - "D-11-02-B (Rule 1) : BRAND_FORBIDDEN ancré À GAUCHE \\bMERA (pas \\bMERA\\b) — \\b échoue entre A et 2 de MERA2026 ; gauche-ancré attrape MERA2026 + MERA seul, exclut camera/numérateur"
  - "D-11-02-C : no-mera-brand it() scan réel RED par design jusqu'à 11-05 (fr.json:210 MERA2026) ; it() contrôle non trivial vert isolément"
  - "D-11-02-D : rtl-logical-props RESKIN_DIRS (nexa/hero) listTsx tolérant dossier absent => vert maintenant, protecteur dès création"
metrics:
  duration: "~6min"
  completed: "2026-06-21"
---

# Phase 11 Plan 02 : Wave-0 Guardrails (text-scan légal/marque/RTL) Summary

Trois gardes-fous text-scan Wave-0 verrouillent les invariants légaux et de marque de toute la Phase 11 AVANT que la copy/les composants n'existent (Nyquist) : no-perf-claims étendu aux namespaces composant (BRAND-04), no-mera-brand créé (BRAND-01), rtl-logical-props étendu aux dossiers nexa/hero (DESIGN-04).

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Étendre no-perf-claims aux namespaces composant (BRAND-04) | dc19cac | apps/web/test/no-perf-claims.test.ts |
| 2 | Créer no-mera-brand garde-fou (BRAND-01) | 502a196 | apps/web/test/no-mera-brand.test.ts |
| 3 | Étendre rtl-logical-props aux fichiers composant/hero (DESIGN-04) | e214596 | apps/web/src/styles/__tests__/rtl-logical-props.test.ts |

## What Was Built

- **no-perf-claims** : `MARKETING_NAMESPACES` renommé `SCANNED_NAMESPACES`, ajout de `hero`/`marquee`/`scoreRing`/`baseline`/`confidenceStat`. `FORBIDDEN`, whitelist `take-profits?`, exclusion `legal`/`disclaimer` et les contrôles non triviaux préservés. Tolérance native à l'absence (`collectStrings(undefined)` = `[]`). 4/4 verts.
- **no-mera-brand** (neuf) : parcours récursif `node:fs` de `apps/web/src` (.ts/.tsx/.json/.css, exclut node_modules/__tests__/.next/dist), couvre `messages/{fr,en,ar}.json` sous `src/messages`. `BRAND_FORBIDDEN = /\bMERA|Make Everybody Rich Again/i`. `.planning/**` non scanné. `it()` de contrôle non trivial vert ; `it()` de scan réel RED jusqu'à 11-05.
- **rtl-logical-props** : ajout `RESKIN_DIRS` (`components/nexa`, `components/hero`) scannés récursivement (.tsx) via `listTsx` tolérant au dossier absent. Fondation (globals.css + layout.tsx) + `PHYSICAL_CLASS` conservés. 3/3 verts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Regex \\bMERA\\b ratait MERA2026**
- **Found during:** Task 2 (premier run : `it()` de contrôle échouait sur `expect(BRAND_FORBIDDEN.test('Ex : MERA2026')).toBe(true)`)
- **Issue:** `\bMERA\b` exige une frontière de mot APRÈS `A` ; or dans `MERA2026`, `A` et `2` sont tous deux des caractères de mot → pas de frontière → pas de match. Le plan exige pourtant la détection de `MERA2026`.
- **Fix:** Ancrage gauche uniquement `\bMERA` — le token doit COMMENCER par MERA sur une frontière de mot. Attrape `MERA2026` + `MERA` seul ; exclut `camera`/`numérateur` (pas de frontière+MERA). Cas négatifs ajoutés au contrôle.
- **Files modified:** apps/web/test/no-mera-brand.test.ts
- **Commit:** 502a196

## Known RED (by design)

- `no-mera-brand.test.ts` > « ne contient aucune marque MERA... » : **RED attendu** — `apps/web/src/messages/fr.json:210` contient encore `"codePlaceholder": "Ex : MERA2026"`. Vire au GREEN au plan 11-05 (rebranding i18n MERA→NEXA). Documenté en en-tête du fichier. Le `it()` de contrôle non trivial reste vert et prouve la non-trivialité indépendamment.

## Verification

- `pnpm vitest run apps/web/test/no-perf-claims.test.ts` → 4/4 vert
- `pnpm vitest run apps/web/src/styles/__tests__/rtl-logical-props.test.ts` → 3/3 vert
- `pnpm vitest run apps/web/test/no-mera-brand.test.ts` → 1 contrôle vert / 1 scan réel RED (attendu, GREEN en 11-05)
- Acceptance greps : no-perf namespaces=9, slogan no-mera=3, components/nexa+hero=3

## Self-Check: PASSED

- FOUND: apps/web/test/no-perf-claims.test.ts
- FOUND: apps/web/test/no-mera-brand.test.ts
- FOUND: apps/web/src/styles/__tests__/rtl-logical-props.test.ts
- FOUND commit: dc19cac
- FOUND commit: 502a196
- FOUND commit: e214596
