---
phase: 10-fondation-design-system-nexa
plan: 02
subsystem: design-system-fonts
tags: [wave-2, fonts, next-font-local, self-host, woff2, fontsource, rtl, no-cdn, design-02]
requires:
  - "Wave-0 gardes fonts.test.ts + no-cdn-fonts.spec.ts (plan 10-01)"
provides:
  - "5 familles NEXA self-hostées exposées en --font-* (archivo, space-grotesk, jetbrains-mono, chakra-petch, noto-arabic)"
  - "10 .woff2 versionnés sous apps/web/src/fonts/ (latin 400/600 ×4 + arabic 400/600 Noto)"
  - "Injection des 5 .variable sur <body> de [locale]/layout.tsx"
affects:
  - "Plan 10-03 (globals.css) repointera --font-latin/--font-arabic vers ces variables"
  - "Phase 11 consommera les 5 --font-* (display/corps/tabulaire/accents/arabe)"
tech_stack:
  added:
    - "@fontsource/archivo ^5.2.8 (devDep)"
    - "@fontsource/space-grotesk ^5.2.10 (devDep)"
    - "@fontsource/jetbrains-mono ^5.2.8 (devDep)"
    - "@fontsource/chakra-petch ^5.2.7 (devDep)"
    - "@fontsource/noto-sans-arabic ^5.2.10 (devDep)"
  patterns:
    - "next/font/local ×5 (src array {path,weight,style}, display:swap) — self-host pur, zéro CDN runtime"
    - "Copie build-time des .woff2 depuis node_modules/@fontsource vers src/fonts/ versionnés"
    - "Injection body via [...].map(f => f.variable).join(' ') (5 variables)"
key_files:
  created:
    - apps/web/src/fonts/Archivo-Regular.woff2
    - apps/web/src/fonts/Archivo-SemiBold.woff2
    - apps/web/src/fonts/SpaceGrotesk-Regular.woff2
    - apps/web/src/fonts/SpaceGrotesk-SemiBold.woff2
    - apps/web/src/fonts/JetBrainsMono-Regular.woff2
    - apps/web/src/fonts/JetBrainsMono-SemiBold.woff2
    - apps/web/src/fonts/ChakraPetch-Regular.woff2
    - apps/web/src/fonts/ChakraPetch-SemiBold.woff2
    - apps/web/src/fonts/NotoSansArabic-Regular.woff2
    - apps/web/src/fonts/NotoSansArabic-SemiBold.woff2
  modified:
    - apps/web/src/lib/fonts.ts
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/package.json
    - pnpm-lock.yaml
  deleted:
    - apps/web/src/fonts/IBMPlexSansArabic-Regular.woff2
    - apps/web/src/fonts/IBMPlexSansArabic-SemiBold.woff2
decisions:
  - "D-10-02-A : le paquet Noto pré-existant était @fontsource/ibm-plex-sans-arabic (ancien D-01), PAS @fontsource/noto-sans-arabic. Le plan supposait Noto déjà installé — inexact. Installé @fontsource/noto-sans-arabic 5.2.10 (provenance vérifiée : npm view → version OK, scripts.postinstall vide, même org Fontsource déjà approuvée au gate supply-chain Task 0). Subset arabic (Pitfall 4)."
  - "D-10-02-B : noms sources @fontsource = <name>-<subset>-<weight>-normal.woff2 sous apps/web/node_modules/@fontsource/<name>/files/ (pas à la racine node_modules — résolution pnpm par workspace)."
  - "D-10-02-C : NotoSansArabic-Regular.woff2 = 48 KB (subset arabic confirmé, ≫30 KB ; pas le latin ~15 KB) — Pitfall 4 respecté."
metrics:
  duration: ~9min
  tasks: 3
  files: 12
  completed: 2026-06-21
---

# Phase 10 Plan 02 : Migration polices → 5 familles NEXA self-hostées Summary

Migre le setup typographique de 2 familles v2.0 (Inter via next/font/google + IBM Plex Arabic) vers les 5 familles NEXA self-hostées via next/font/local (Archivo, Space Grotesk, JetBrains Mono, Chakra Petch, Noto Sans Arabic), en sourçant 10 .woff2 depuis les paquets @fontsource au build-time et en injectant leurs 5 variables CSS sur le `<body>`. DESIGN-02 couvert : 5 `--font-*` exposés, zéro requête CDN au runtime (vérifié live).

## What Was Built

- **10 .woff2 versionnés** sous `apps/web/src/fonts/` — latin 400/600 pour les 4 familles latines (Archivo, Space Grotesk, JetBrains Mono, Chakra Petch) + arabic 400/600 pour Noto Sans Arabic (Pitfall 4 : subset arabic, jamais latin).
- **lib/fonts.ts réécrit** — 5 exports `localFont` (`archivo`, `spaceGrotesk`, `jetbrainsMono`, `chakraPetch`, `notoArabic`), chacun src array {path,weight,style} + `display: 'swap'` + `variable: '--font-*'`. Suppression totale de `next/font/google`/Inter (D-03) et d'IBM Plex (D-01). Header JSDoc FR mis à jour (5 familles, mapping rôle, D-01/D-02/D-03).
- **layout.tsx repointé** — import des 5 nouvelles familles ; `<body className={[archivo, spaceGrotesk, jetbrainsMono, chakraPetch, notoArabic].map((f) => f.variable).join(' ')}>`. Tout le reste (html lang dir, suppressHydrationWarning, ThemeProvider, header, Footer, no-flash, RTL) inchangé.
- **2 IBM Plex orphelins supprimés** (`IBMPlexSansArabic-Regular/-SemiBold.woff2`).
- **5 @fontsource en devDependencies** (4 nouveaux + noto-sans-arabic).

## Verification Results

- `fonts.test.ts` : **GREEN 5/5** (5 `--font-*` présents, Inter/IBM absents, `next/font/google` absent, 10 .woff2 attendus, 0 IBMPlexSansArabic-*).
- `tsc --noEmit` (apps/web) : **0 erreur** (aucune nouvelle, ni baseline).
- `no-cdn-fonts.spec.ts` : **GREEN au runtime réel** — serveur dev démarré sur :3000, /fr/login (200), interception `page.on('request')` → 0 requête vers fonts.googleapis.com / fonts.gstatic.com. Self-host pur confirmé (au-delà du simple --list déféré du plan).
- `ls apps/web/src/fonts/*.woff2 | wc -l` = 10 ; `IBMPlexSansArabic-*` = 0.
- Noto Regular = 48 KB → subset arabic confirmé.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Paquet Noto absent (supposé installé par le plan)**
- **Found during:** Task 1 (sourcing des .woff2).
- **Issue:** le plan indiquait `@fontsource/noto-sans-arabic` déjà installé. En réalité seul `@fontsource/ibm-plex-sans-arabic` (ancien D-01) était présent — aucun fichier `noto-sans-arabic` dans node_modules. Sans ce paquet, impossible de sourcer `NotoSansArabic-*.woff2` (subset arabic), bloquant Task 1.
- **Fix:** vérifié la provenance (`npm view @fontsource/noto-sans-arabic` → 5.2.10, `scripts.postinstall` vide, org Fontsource — déjà couverte par le gate supply-chain approuvé en Task 0), puis `pnpm --filter web add -D @fontsource/noto-sans-arabic`. Copié le subset arabic 400/600. **Pas un install ambigu** : paquet officiel attendu, dans le périmètre du checkpoint approuvé (Noto = remplaçant IBM Plex D-01).
- **Files modified:** apps/web/package.json, pnpm-lock.yaml, apps/web/src/fonts/NotoSansArabic-Regular.woff2, NotoSansArabic-SemiBold.woff2
- **Commit:** b5efb9b

## Threat Mitigations Applied

- **T-10-SC** (supply chain) : gate Task 0 (checkpoint blocking-human) approuvé par l'humain avant tout install ; provenance des 5 @fontsource vérifiée (org officielle, postinstall vide). L'install Noto additionnel (Rule 3) a été soumis à la même vérification de provenance.
- **T-10-ID** (fuite CDN) : `next/font/local` + .woff2 versionnés → 0 requête Google Fonts ; `next/font/google` entièrement supprimé (D-03) ; vérifié GREEN au runtime par no-cdn-fonts.spec.ts contre serveur dev.
- **T-10-04** (mauvais subset Noto) : subset arabic imposé et vérifié (48 KB, ≫ fichier latin ~15 KB) — Pitfall 4 respecté.

## Self-Check: PASSED

- FOUND: apps/web/src/lib/fonts.ts (modified)
- FOUND: apps/web/src/app/[locale]/layout.tsx (modified)
- FOUND: 10 .woff2 sous apps/web/src/fonts/
- FOUND: 0 IBMPlexSansArabic-* restant
- FOUND commit: b5efb9b (Task 1)
- FOUND commit: 863dd7c (Task 2)
