---
phase: 19-dashboard-utilisateur
plan: 05
subsystem: web
tags: [dash, settings, parametres, password, notifications, signout, udash-06, rsc, i18n]
requires:
  - "19-02: shell (dash) — layout requireUser + DashShell (nav figée /dashboard/parametres) + namespace i18n dash.settings"
  - "19-04: overview (dash)/dashboard/* + suppression du stub /dashboard (D-19-04-A) — routing sous /dashboard"
  - "01: gate.ts requireUser (getUser session courante) + (auth)/actions.ts signOut"
  - "01-RESEARCH: LanguageSwitcher (Don't Hand-Roll), client navigateur @/lib/supabase/client"
provides:
  - "Écran Paramètres /dashboard/parametres (UDASH-06) : Compte (email + mdp) + Langue + Notifications (UI) + Abonnement + Déconnexion"
  - "PasswordChangeForm : changement mdp client via supabase.auth.updateUser (session courante, aucun service_role)"
  - "NotificationPreferences : préférences UI seules (localStorage, aucune delivery — D-12)"
affects:
  - "Boucle dashboard membre complète : l'onglet Paramètres de DashShell (19-02) et le raccourci overview (19-04) ont désormais une cible réelle"
tech-stack:
  added: []
  patterns:
    - "Îlots clients dans une page RSC : la page Paramètres reste RSC (lecture email serveur), les bribes interactives (PasswordChangeForm, NotificationPreferences) sont des Client Components montés ponctuellement"
    - "updateUser sur session courante : aucun user_id transmis → impossible de changer le mdp d'un autre compte (T-19-17)"
    - "Préférences UI sans moteur : notifications persistées en localStorage uniquement, libellé explicite « aucune notification envoyée » (D-12, T-19-20)"
    - "Réutilisation stricte : LanguageSwitcher monté tel quel (Don't Hand-Roll), signOut = action (auth) existante, zéro réimplémentation"
key-files:
  created:
    - apps/web/src/components/dash/PasswordChangeForm.tsx
    - apps/web/src/components/dash/NotificationPreferences.tsx
    - apps/web/src/app/[locale]/(dash)/dashboard/parametres/page.tsx
  modified:
    - apps/web/src/messages/fr.json
    - apps/web/src/messages/en.json
    - apps/web/src/messages/ar.json
  deleted: []
decisions:
  - "D-19-05-A (déviation de chemin, Rule 3 — cohérence routing) : le plan note (dash)/parametres/page.tsx, MAIS un route group (dash) n'ajoute rien à l'URL → (dash)/parametres résoudrait /parametres (orphelin, hors nav). La nav DashShell figée en 19-02 et les raccourcis de l'overview (19-04) pointent sur /dashboard/parametres. La page est donc placée à (dash)/dashboard/parametres/page.tsx (URL /dashboard/parametres). Aligné sur la décision sœur D-19-04-A (overview à (dash)/dashboard/page.tsx)."
  - "D-19-05-B (Task 3 hors scope, suite à D-19-04-A) : la tâche « remplacer le stub /dashboard par une redirection » est ABANDONNÉE. 19-04 a déjà SUPPRIMÉ l'ancien stub [locale]/dashboard/page.tsx (conflit de routes parallèles Next avec le groupe (dash)) et relocalisé l'overview à (dash)/dashboard/page.tsx. Recréer un fichier [locale]/dashboard/page.tsx (même pour rediriger) ré-introduirait le conflit et casserait le build. Stub vérifié absent ; /dashboard est servi par une source unique (l'overview (dash))."
  - "D-19-05-C (notifications = îlot client + 2 fichiers, Rule 2) : la section Notifications exige de l'interactivité (bascules + bouton « Enregistrer ») dans une page RSC. Extraite en composant client dédié NotificationPreferences.tsx (cohérent avec PasswordChangeForm). Persistance localStorage uniquement, AUCUNE infra d'envoi (D-12). Le plan listait 2 artefacts ; ce 3e fichier implémente une section requise, pas une fonctionnalité hors plan."
  - "D-19-05-D (i18n, Rule 2) : namespace dash.settings figé en 19-02 mais incomplet pour cette surface. Ajout à parité STRICTE fr/en/ar de newPassword/confirmPassword/passwordMinHint/passwordTooShort/passwordMismatch/passwordUpdated/passwordUpdateError (formulaire mdp) + notificationsHint/notifyNewSignals/notifyExpiry (notifications). Aucun terme interdit (gratuit/%/garanti/profit) → parité dash 4/4 verte."
gates:
  manual_only:
    - "Vérif visuelle live (différée, exige session) : rendu des 5 sections, changement mdp réel (updateUser → succès/erreur), bascule de langue via LanguageSwitcher, persistance localStorage des préférences notifications, déconnexion → /login localisé, RTL fr/en/ar. Non automatisable (exige session authentifiée seedée)."
verification:
  - "pnpm typecheck (tsc -b --noEmit) : exit 0"
  - "pnpm lint:i18n : exit 0 (aucune chaîne en dur dans le JSX)"
  - "messages-parity-dash.test.ts : 4 passed (parité récursive fr/en/ar + anti-gratuit + anti-perf)"
  - "greps page : LanguageSwitcher=3, PasswordChangeForm=3, signOut=4, theme-toggle=0"
  - "grep PasswordChangeForm : auth.updateUser=2 (import session + commentaire), 'use client' présent, createClient depuis @/lib/supabase/client (navigateur), aucun service_role"
  - "stub [locale]/dashboard/page.tsx : ABSENT (D-19-04-A respecté, aucune recréation)"
metrics:
  duration: ~12min
  completed: 2026-06-26
---

# Phase 19 Plan 05 : Écran Paramètres de compte (UDASH-06)

Livre l'écran Paramètres du dashboard membre (`/dashboard/parametres`) : Compte (e-mail affiché + changement de mot de passe via Supabase Auth), Langue (LanguageSwitcher existant, sans toggle thème), Notifications (préférences UI seules, aucune delivery — D-12), lien de gestion d'abonnement, et déconnexion (D-11). Lecture e-mail serveur (session courante, jamais service_role), changement de mot de passe client sur la session courante (T-19-17/18).

## Réalisé

- **Task 1 — PasswordChangeForm** : Client Component (`'use client'`). Formulaire nouveau mot de passe + confirmation, validation client (longueur min 8, égalité) AVANT l'appel, soumission via `createClient()` navigateur (`@/lib/supabase/client`) → `supabase.auth.updateUser({ password })` (session courante, aucun user_id transmis). Succès/erreur en région `aria-live`, chaînes `dash.settings.*`, aucun service_role.
- **Task 2 — Page Paramètres + NotificationPreferences** : `(dash)/dashboard/parametres/page.tsx` (RSC, gate au layout). 5 sections en cartes : (1) Compte = e-mail (`requireUser().email`, session courante) + `<PasswordChangeForm/>` ; (2) Langue = `<LanguageSwitcher/>` monté tel quel, **aucun toggle thème** (D-11) ; (3) Notifications = `<NotificationPreferences/>` (bascules localStorage, libellé « aucune notification envoyée », **aucune infra d'envoi**, D-12) ; (4) Abonnement = lien `/dashboard/abonnement` ; (5) Déconnexion = `<form action={signOut}>` (action `(auth)/actions.ts`), bouton direct réversible (pas de modale, UI-SPEC §116).
- **Task 3 — ABANDONNÉE (hors scope)** : la suppression/redirection du stub `/dashboard` était déjà réalisée par 19-04 (D-19-04-A). Voir Déviations.

## Garde-fous prouvés

- **T-19-17 (spoofing mdp)** : `updateUser({ password })` sur la session courante (token revalidé), aucun identifiant de compte reçu → impossible de cibler un autre compte.
- **T-19-18 (fuite e-mail)** : e-mail lu via `requireUser()` (getUser session courante), jamais service_role.
- **T-19-19 (i18n bypass)** : toutes les chaînes via `dash.settings`/`dash.nav` ; `lint:i18n` exit 0.
- **T-19-20 (scope notifications)** : préférences UI seules, libellé `notificationsHint` explicite (« aucune notification n'est encore envoyée »), persistance locale sans moteur (D-12).
- **D-11 (pas de thème)** : `grep -Eic 'theme.?toggle|ThemeToggle|setTheme'` = 0 sur la page.
- **D-02 (réutilisation)** : LanguageSwitcher et signOut montés tels quels, zéro réimplémentation.

## Déviations au plan

### Corrections de cohérence / scope (Rule 3)

**1. [Rule 3 — Cohérence routing] Chemin de la page corrigé**
- **Trouvé pendant :** Task 2 (lecture du routing réel sur disque).
- **Problème :** Le plan note `(dash)/parametres/page.tsx`. Or un route group `(dash)` n'ajoute rien à l'URL → cela résoudrait `/parametres` (orphelin), alors que la nav DashShell figée en 19-02 (`href: '/dashboard/parametres'`) et le raccourci de l'overview 19-04 (`Link href="/dashboard/parametres"`) pointent sous `/dashboard/`.
- **Fix :** page placée à `(dash)/dashboard/parametres/page.tsx` (URL `/dashboard/parametres`). Aligné sur D-19-04-A.
- **Fichiers :** créé `(dash)/dashboard/parametres/page.tsx`.
- **Commits :** 156e66e (i18n + form), 5e1a1cb (page).

**2. [Rule 3 — Hors scope, suite D-19-04-A] Task 3 (stub /dashboard) abandonnée**
- **Trouvé pendant :** lecture de 19-04-SUMMARY (déviation amont D-19-04-A).
- **Problème :** 19-04 a déjà SUPPRIMÉ l'ancien stub `[locale]/dashboard/page.tsx` (il provoquait un conflit de routes parallèles Next avec le groupe `(dash)`) et relocalisé l'overview à `(dash)/dashboard/page.tsx`. Recréer un fichier `[locale]/dashboard/page.tsx` (même une simple redirection) ré-introduirait le conflit et casserait le build.
- **Fix :** tâche non exécutée. Stub vérifié ABSENT sur disque ; `/dashboard` servi par une source unique (l'overview `(dash)`). Aucune boucle, aucun lien orphelin.
- **Fichiers :** aucun.

### Ajustements requis (Rule 2)

**3. [Rule 2 — Section requise] Composant client NotificationPreferences**
- **Problème :** la section Notifications exige de l'interactivité (bascules + bouton) dans une page RSC.
- **Fix :** extraite en `NotificationPreferences.tsx` (Client Component, localStorage, aucune delivery). 3e fichier au-delà des 2 artefacts listés, mais implémente une section explicitement requise par le plan/UI-SPEC.
- **Commit :** 5e1a1cb.

**4. [Rule 2 — i18n] Clés settings ajoutées à parité stricte**
- **Problème :** le namespace `dash.settings` (19-02) ne couvrait pas le formulaire mdp ni les libellés notifications.
- **Fix :** 7 clés mdp + 3 clés notifications ajoutées à parité STRICTE fr/en/ar, sans terme interdit. Parité dash 4/4 verte.
- **Commits :** 156e66e (mdp), 5e1a1cb (notifications).

## Known Stubs

Aucun stub de données. `NotificationPreferences` est intentionnellement « UI seule » (D-12, delivery déférée) — comportement attendu et libellé clairement, pas un stub masquant une fonctionnalité manquante.

## Self-Check: PASSED
