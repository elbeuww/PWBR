---
phase: 11-composants-nexa-reskin-transversal-rebranding
plan: 05
subsystem: branding-metadata
tags: [rebranding, i18n, metadata, next-og, brand]
requires:
  - "11-04 : composant Logo (variant full/mark) + namespace baseline trilingue"
  - "11-02 : garde no-mera-brand (scan apps/web/src + messages)"
provides:
  - "Logo NEXA câblé au header + footer (BRAND-01)"
  - "baseline trilingue « Nouvelle Ère · Alliance d'Échange » au header (BRAND-02)"
  - "metadata NEXA + favicon/apple-icon/OG via next/og (BRAND-03)"
  - "no-mera-brand GREEN : zéro MERA/Vétéran Trading dans code+contenu livrés"
affects:
  - "apps/web/src/app/[locale]/layout.tsx (header marque)"
  - "apps/web/src/app/layout.tsx (metadata root)"
  - "apps/web/src/components/Footer.tsx"
  - "apps/web/src/messages/{fr,en,ar}.json"
tech-stack:
  added: []
  patterns:
    - "next/og metadata files (icon/apple-icon/opengraph-image) racine app/, natif next@15, aucun package"
    - "metadataBase via process.env.NEXT_PUBLIC_SITE_URL (precedent sitemap.ts)"
key-files:
  created:
    - apps/web/src/app/icon.tsx
    - apps/web/src/app/apple-icon.tsx
    - apps/web/src/app/opengraph-image.tsx
  modified:
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/components/Footer.tsx
    - apps/web/src/messages/fr.json
    - apps/web/src/messages/en.json
    - apps/web/src/messages/ar.json
decisions:
  - "D-11-05-A : baseline rendue sous le wordmark via getTranslations('baseline') dans le RSC [locale]/layout (D-16/D-17, ton sobre)."
  - "D-11-05-B : Footer rend Logo variant full (densité footer suffisante) + Disclaimer + liens légaux préservés."
  - "D-11-05-C : codePlaceholder MERA2026→NEXA2026 uniquement dans fr.json — namespace admin mono-FR (D-04-03-B), pas d'équivalent en/ar à renommer."
  - "D-11-05-D : 3 metadata files réutilisent les paths SVG exacts du mark Logo (hexagone + glyphe N), hex de marque #03d87f/#63279b autorisés (asset de marque, T-11-OG-XSS contenu statique)."
metrics:
  duration: ~10min
  completed: 2026-06-21
---

# Phase 11 Plan 05 : Rebranding NEXA visible + metadata Summary

Rebranding MERA/Vétéran Trading → NEXA achevé : Logo câblé header+footer, baseline trilingue, metadata NEXA + favicon/apple-icon/OG générés via next/og, no-mera-brand viré au vert.

## What Was Built

- **Task 1 (BRAND-01/02)** : `[locale]/layout.tsx` header — span « Vétéran Trading » remplacé par `<Logo variant="full">` + baseline `t('baseline.text')` rendue sous le wordmark (RSC `getTranslations('baseline')`). `ms-6`/`ms-auto`/ThemeToggle/LanguageSwitcher/slot Footer/`<html lang dir>` unique préservés ; commentaire i18n-ignore retiré. `Footer.tsx` rend `<Logo variant="full">` en conservant Disclaimer + nav légale. `dashboard.title` fr/en/ar : Vétéran/Veteran Trading → NEXA (parité).
- **Task 2 (BRAND-03)** : `app/layout.tsx` metadata NEXA (title/description neutres éducatifs, `metadataBase` via `NEXT_PUBLIC_SITE_URL`, `openGraph` type website) ; root reste pass-through (aucun html). Création `icon.tsx` (32×32), `apple-icon.tsx` (180×180), `opengraph-image.tsx` (1200×630) via `ImageResponse` (next/og) — mark hexagonal + dégradé #03d87f→#63279b, fond ink #0a0e1a ; OG ajoute wordmark NEXA + baseline. Zéro promesse de gain, zéro %.
- **Task 3 (BRAND-01)** : `fr.json:210` `Ex : MERA2026` → `Ex : NEXA2026`. Scan `apps/web/src` : zéro MERA / « Make Everybody Rich Again » restant. `no-mera-brand.test.ts` GREEN.

## Verification

- `no-mera-brand.test.ts` : 2/2 GREEN (scan réel désormais vert).
- `no-perf-claims.test.ts` : 4/4 GREEN (baseline sans promesse de gain).
- `pnpm --filter web exec tsc -b --noEmit` : exit 0 (aucune nouvelle erreur, layout + 3 metadata files typés).
- Vérifs statiques par task : Logo présent ×3 dans layout, `metadataBase`=1, `ImageResponse` icon/OG présents, `#03d87f`+`#63279b` dans OG, zéro `Vétéran Trading`.

## Deviations from Plan

None - plan exécuté exactement comme écrit. Le placeholder MERA2026 n'existait que dans fr.json (admin mono-FR, D-04-03-B), donc une seule édition au lieu de 3 attendues par la mention « parité » du plan — cohérent avec le périmètre réel du namespace.

## Known Stubs

None.

## Threat Flags

None — aucune nouvelle surface de sécurité ; les ImageResponse sont du build statique authored sans entrée dynamique (T-11-OG-XSS mitigé), title/baseline sans promesse de gain (T-11-LEGAL mitigé), aucun package installé (T-11-SC mitigé).

## Self-Check: PASSED

- FOUND: apps/web/src/app/icon.tsx
- FOUND: apps/web/src/app/apple-icon.tsx
- FOUND: apps/web/src/app/opengraph-image.tsx
- FOUND commit 1d0aed1 (Task 1)
- FOUND commit 0009f9d (Task 2)
- FOUND commit f46ed09 (Task 3)
