# Phase 16: Reskin transversal de toutes les pages - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 16-reskin-transversal-de-toutes-les-pages
**Areas discussed:** Landing volt→green, Intensité néon par tier, Effets néon transverses, Critère de « reskinée »

---

## Landing volt→green (RESKIN-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Green-only, retirer le toggle | `data-theme="green"` en dur + suppression du toggle Green/Volt. Cohérent D-01 (volt écarté) + retrait ThemeToggle global Phase 15. | ✓ |
| Green défaut + garder toggle | Green par défaut mais on conserve le toggle Green/Volt sur la landing. Réintroduit une bascule supprimée ailleurs. | |
| Garder volt par défaut | Statu quo. Contredit D-01, dissonance accueil vs reste. | |

**User's choice:** Green-only, retirer le toggle.
**Notes:** Constat amont (scan code) : `NexaLanding.tsx` tournait encore en `data-theme="volt"` + toggle interne `.nxl-theme-toggle` (lignes 58, 84-87), non touché par Phase 15 (qui n'a promu que les valeurs green dans `:root`). Nettoyage des orphelins volt (CSS + `NexaLandingEffects` toggle logic) = discrétion implémentation, green = seule branche vivante. → D-01/D-02/D-03.

---

## Intensité néon par tier

| Option | Description | Selected |
|--------|-------------|----------|
| 3 tiers (vitrine/app/admin) | Vitrine plein néon / app+compte+auth+paiement+Académie intermédiaire (accents + glow discret, sans aura/data-rain lourds) / admin sobre. Lisibilité d'abord sur l'app. | ✓ |
| 2 tiers (vitrine / reste sobre) | Vitrine riche, reste = simple héritage tokens green. Risque app/Académie fades. | |
| Néon quasi-uniforme | Même niveau néon partout sauf admin. Alourdit surfaces denses. | |

**User's choice:** 3 tiers (vitrine/app/admin).
**Notes:** Admin sobre déjà verrouillé Phase 11 D-18. → D-04/D-05.

---

## Effets néon transverses

| Option | Description | Selected |
|--------|-------------|----------|
| Glow cartes/CTA | Halo néon discret sur cartes/boutons/focus — primitive tokenée réutilisable. | ✓ |
| Titres en gradient green | Dégradé green sur titres/eyebrows clés. | |
| Aura/halo de section | Grand halo radial derrière sections héro — réservé vitrine. | |
| Data-rain ambient | Pluie de données animée en fond. | ✓ (cadré) |

**User's choice:** Glow cartes/CTA + Data-rain ambient (le reste = landing-only).
**Notes:** Tension relevée avec A2 (qui excluait le data-rain des surfaces denses). Question de réconciliation posée → choix « Primitive légère, surfaces calmes only » : data-rain réutilisable mais ambient subtil sur auth / états vides / en-tête overview membre uniquement, JAMAIS listes/tables/détail. Titres gradient + aura = landing-only. → D-06/D-07.

---

## Critère de « reskinée » (definition of done)

| Option | Description | Selected |
|--------|-------------|----------|
| Checklist par page | Zéro bespoke/littéral + accent du tier appliqué + scans guard verts + RLS/RTL/disclaimer/data-testid préservés. | ✓ |
| Scan automatisé seul | Zéro bespoke + scans verts uniquement. Ne prouve pas l'application de l'accent tier. | |
| Revue visuelle par surface | Screenshots/revue manuelle. Subjectif, lourd, non reproductible en CI. | |

**User's choice:** Checklist par page.
**Notes:** Grille du verifier = mécanique + preuve d'application du tier + garde-fous. → D-09/D-10.

---

## Claude's Discretion

- Découpage en plans/vagues (par route group / tier, fichiers disjoints) et ordre des surfaces.
- Forme du test/scan prouvant D-09 (extension scans existants vs nouveau).
- Mapping technique couleurs néon CandleChart (getComputedStyle vs table) via API lwc.
- Implémentation concrète des primitives glow/data-rain.
- États vides / skeletons / micro-interactions.
- Détail du nettoyage des orphelins volt.

## Deferred Ideas

None — discussion restée dans le périmètre reskin. Dashboards complets utilisateur/superadmin = Phases 19-20 (hors scope explicite).
