# Phase 1: Socle transverse — i18n/RTL & rôles/gating - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 1-Socle transverse — i18n/RTL & rôles/gating
**Areas discussed:** Langue défaut & forme d'URL, Gating abonné (table réelle vs stub), Redirections d'accès refusé, Sélecteur langue & amorçage styling

---

## Langue par défaut & forme d'URL

| Option | Description | Selected |
|--------|-------------|----------|
| AR défaut + préfixe toujours | Racine → détection Accept-Language, fallback AR (cible MENA), URLs /ar /en /fr | |
| EN défaut + préfixe toujours | Fallback EN neutre (IA générée FR/EN) | |
| FR défaut + préfixe toujours | Fallback FR (langue du fondateur), routing /ar /en /fr | ✓ |

**User's choice:** FR défaut + préfixe toujours.
**Notes:** `localePrefix: 'always'`, `defaultLocale = fr`, racine `/` → `/fr`. Pas de détection auto au MVP (déterministe). AR pleinement supporté (RTL) ; contenu IA FR/EN affiché tel quel en UI arabe.

---

## Gating abonné — table réelle vs stub (ACCESS-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Squelette 'subscriptions' dès P1 | Table réelle (migration 0009) → has_active_subscription() réel et testable ; P4 ajoute l'écriture | ✓ |
| Stub renvoyant false en P1 | Fonction false en dur, vraie table en P4 (réécriture) | |

**User's choice:** Squelette 'subscriptions' dès P1.
**Notes:** Gate prouvé dès P1 (tout le monde non-abonné → 0 ligne), pas de refonte de la fonction RLS en P4. Migrations : 0008 (role), 0009 (subscriptions).

---

## Redirections d'accès refusé

| Option | Description | Selected |
|--------|-------------|----------|
| Funnel + discrétion | Non-abonné → tarifs ; non-auth → login (returnTo) ; non-superadmin → 404 | ✓ |
| Tout vers login | Tous les refus → login | |
| 403 explicite partout | Page 403 pour tous les cas | |

**User's choice:** Funnel + discrétion.
**Notes:** Non-abonné redirigé vers tarifs = levier de conversion. 404 admin = discrétion sécuritaire (ne révèle pas le back-office).

---

## Sélecteur de langue & amorçage styling

| Option | Description | Selected |
|--------|-------------|----------|
| Header dropdown + styling minimal | Switcher header + cookie ; Tailwind v4 + RTL minimal seulement ; design system en P2 | ✓ |
| Dropdown + design system complet dès P1 | Tokens/thème/shadcn complets dès P1 | |
| Switcher footer + styling minimal | Switcher footer + Tailwind/RTL minimal | |

**User's choice:** Header dropdown + styling minimal.
**Notes:** Persistance cookie next-intl, reste sur la même page. Design system visuel reporté en Phase 2 (vitrine).

---

## Claude's Discretion

- Wiring next-intl exact (plugin, `messages/{locale}.json`, `i18n/routing.ts`).
- Finalisation du wiring auth fonctionnel (pages login/signup actuellement squelettes) pour rendre le gating testable bout en bout.
- Ordre de chaînage middleware next-intl → `updateSession()`.
- Forme de la contrainte `profiles.role` (enum vs check) et schéma minimal de `subscriptions`.

## Deferred Ideas

- Détection automatique Accept-Language à la racine — reportée (MVP fallback FR + sélecteur).
- Design system visuel complet — Phase 2.
- Traduction arabe du raisonnement IA — hors scope v2.0.
- Écriture/vérification des abonnements (paiement) — Phase 4.
