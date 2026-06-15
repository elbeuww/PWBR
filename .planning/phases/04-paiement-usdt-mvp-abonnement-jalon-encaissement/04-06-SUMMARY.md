---
phase: 04-paiement-usdt-mvp-abonnement-jalon-encaissement
plan: 06
subsystem: paiement-usdt-mvp / cycle de vie abonnement + back-office
tags: [PAY-05, ADMIN-01, ADMIN-02, job, service_role, i18n, rls]
requires:
  - "04-02 (repos service_role : expireDue, activateForPayment, changePlan, transitionPayment, reserveOffset ; RPC 0012)"
  - "04-03 (blocs shadcn table/dialog/alert-dialog/dropdown/select/textarea/sonner + i18n admin/payment fr/en/ar)"
provides:
  - "job subscription-expiry idempotent (active->expired + sweep réservations pending expirées)"
  - "releaseExpiredReservations (repo payments) + RESERVATION_EXPIRED_REASON (barrel)"
  - "back-office (admin)/membres (table + filtres + actions service_role)"
  - "back-office (admin)/file (paiements ambigus : activer/rejeter+motif/ajuster)"
  - "ExpiryBanner J-3/J-1 in-app (member)"
  - "admin-service.ts : client service_role local web (lecture cross-user + mutations)"
affects:
  - "apps/jobs (dispatch JOB_REGISTRY)"
  - "apps/web (admin layout : NextIntlClientProvider FR + Toaster)"
  - "packages/supabase (barrel + repo payments)"
tech-stack:
  added: []
  patterns:
    - "Server Action admin = re-guard requireRole('superadmin') (endpoint POST non protégé par le layout)"
    - "Lecture admin cross-user via service_role local côté RSC (profiles sans policy superadmin)"
    - "Sweep applicatif des réservations d'offset expirées (index partiel 0012 ne peut porter now())"
key-files:
  created:
    - apps/jobs/src/jobs/subscription-expiry.ts
    - apps/jobs/src/jobs/__tests__/subscription-expiry.test.ts
    - apps/web/src/app/(admin)/membres/page.tsx
    - apps/web/src/app/(admin)/membres/actions.ts
    - apps/web/src/app/(admin)/file/page.tsx
    - apps/web/src/app/(admin)/file/actions.ts
    - apps/web/src/components/admin/MemberRowActions.tsx
    - apps/web/src/components/admin/QueueRowActions.tsx
    - apps/web/src/components/member/ExpiryBanner.tsx
    - apps/web/src/lib/supabase/admin-service.ts
  modified:
    - apps/jobs/src/dispatch.ts
    - apps/web/src/app/(admin)/layout.tsx
    - packages/supabase/src/repositories/payments.ts
    - packages/supabase/src/index.ts
decisions:
  - "Sweep réservations expirées rattaché au job subscription-expiry (offset libéré, anti-DoS reserveOffset)"
  - "Lecture admin via service_role local (profiles sans policy superadmin RLS) au lieu d'anon-client"
  - "ExpiryBanner calcule le diff de jours en JS natif UTC (luxon absent de apps/web, écart de jours trivial)"
  - "CTA Renouveler -> /tarifs (parcours paiement existant, pas de route abonnement dédiée)"
metrics:
  duration: ~1h
  completed: 2026-06-15
  tasks: 3
  files: 14
---

# Phase 4 Plan 06 : Paiement USDT — cycle de vie & back-office Summary

Job `subscription-expiry` idempotent (expire les abonnements échus + libère les réservations d'offset expirées), vue membres superadmin et file de validation des paiements ambigus (toutes mutations via service_role), et bandeau d'expiration in-app J-3/J-1 sans email.

## Ce qui a été livré

### Task 1 — Job subscription-expiry (idempotent) + dispatch + test
- `subscriptionExpiry(): Promise<Json>` calqué sur `calendar-ingest` (getServiceClient lazy local, stats `Json`). Fait DEUX choses idempotentes :
  1. `expireDue(client)` — subscriptions `active`->`expired` WHERE `current_period_end<=now()` (D-10).
  2. `releaseExpiredReservations(client)` — **scope ajouté** : payments `pending` WHERE `reservation_expires_at<=now()` -> `rejected` + `reject_reason='reservation_expired'` (libère l'offset).
- Enregistré dans `JOB_REGISTRY` sous `'subscription-expiry'` (dispatch.ts). Windows Task Scheduler : `run-job.cmd subscription-expiry`.
- Stats retournées : `{ expired, released }`.
- Test d'idempotence par **mock store** (pas de DB réelle) : 1er run `{expired:2, released:3}`, 2e run consécutif `{0,0}`.

### Task 2 — Admin membres (table + filtres + actions service_role)
- `(admin)/membres/page.tsx` (RSC, mono-FR, hors `[locale]`). Colonnes D-14 : email / statut (badge) / plan / expiration (`Intl`) / dernier paiement (`<bdi>` + `formatAtomic`). Filtres statut + email synchronisés via URL (GET form). Wrapper scroll horizontal.
- `MemberRowActions` (client) : dropdown -> activer/prolonger, changer de plan (dialog), révoquer (alert-dialog destructive).
- `membres/actions.ts` : service_role local + **re-guard `requireRole('superadmin')` par action** ; `activateForPayment`/`changePlan` + révoquer (`status='canceled'`). Durées/plans bornés serveur (anti-injection valeur).

### Task 3 — File ambigus + ExpiryBanner
- `(admin)/file/page.tsx` (RSC) : payments `status='ambiguous'` (sous-paiements D-06 + sur-paiements D-07). Montant attendu / reçu en `<bdi>` (`formatAtomic`), hash TronScan `target=_blank rel="noopener noreferrer"`, badge amber « À valider », empty state rassurant.
- `QueueRowActions` (client) : activer (D-07 période normale, surplus ignoré), rejeter (alert-dialog + textarea **motif requis**, confirm désactivé tant que vide), ajuster (dialog changePlan).
- `file/actions.ts` : service_role local + re-guard superadmin ; `activateForPayment`/`transitionPayment('rejected')`/`changePlan`.
- `ExpiryBanner` (member, client) : alert amber affiché J-3/J-2/J-1, ICU plural (`payment.expiryBanner`), CTA « Renouveler » -> `/tarifs` (D-11, pas d'auto-renew), in-app uniquement aucun email (D-09), coupe nette à `current_period_end` (D-10, rien affiché <=0 jour). RTL via `dir` document, aucune animation.

## Déviations du plan

### Scope ajouté (demande explicite)
**[Scope - Sweep réservations] `releaseExpiredReservations` rattaché au job**
- **Schéma 0012 réel vérifié** : l'index unique partiel `payments_expected_amount_active_idx` est `where status='pending'` (commentaire SQL l.70-76 confirme la réduction depuis `... and reservation_expires_at > now()` à cause de PG 42P17 — prédicat IMMUTABLE requis). La libération des réservations expirées EST donc explicitement déléguée à ce job (Plan 06).
- **Fait** : statuts réels confirmés `('pending','verified','rejected','ambiguous')` ; colonnes `reservation_expires_at` (nullable), `reject_reason`. La transition utilisée est `pending -> rejected` avec `reject_reason='reservation_expired'` (cohérent avec `transitionPayment`). `RESERVATION_EXPIRED_REASON` exporté au barrel.
- **Couvert** par le test d'idempotence (2e run = 0 ligne libérée).
- **Commit** : c7b7d28.

### Auto (Rule 2/3) — corrections nécessaires
1. **[Rule 2 - sécurité] Re-guard superadmin dans chaque Server Action.** Une Server Action est un endpoint POST appelable directement, NON protégé par le layout `(admin)`. Sans `requireRole('superadmin')` en tête, n'importe quel authenticated pourrait muter via service_role. Ajouté à toutes les actions (membres + file). Commits fcfded4, 5d6b171.
2. **[Rule 3 - blocking] Lecture admin via service_role local, pas anon-client.** Le plan prévoyait « anon-client + RLS is_superadmin() », mais `profiles` n'a **aucune policy superadmin** (migration 0008) → la jointure email échoue sous RLS anon. Créé `admin-service.ts` (createClient SDK local + `server-only` ; le module `service-client.ts` du barrel reste lint-interdit côté web). Sûr : RSC server-only, jamais bundle. Commit fcfded4.
3. **[Rule 3 - blocking] NextIntlClientProvider + Toaster dans le layout admin.** Le groupe `(admin)` est hors `[locale]` donc sans provider next-intl ni Toaster → les composants client (`useTranslations`, `toast`) auraient planté. Layout admin wrappe désormais `NextIntlClientProvider locale="fr"` + `<Toaster/>`. Commit fcfded4.

### Mineures (simplicité)
4. **ExpiryBanner : diff de jours en JS natif UTC** au lieu de luxon — luxon n'est pas une dépendance de `apps/web` et un simple écart de jours ne justifie pas de l'ajouter (Karpathy simplicity). Comportement identique (J-3/J-1, coupe à 0).
5. **CTA « Renouveler » -> `/tarifs`** : pas de route `(member)/abonnement` dédiée dans l'existant ; `/tarifs` EST le parcours de souscription/renouvellement (D-11, même parcours, pas d'auto-renew).
6. **Unité « USDT » externalisée** via `payment.amountUnit` (déjà en i18n) pour passer `check-i18n-hardcoded` — pas de chaîne en dur dans le JSX.

## Vérifications
- `npx vitest run apps/jobs/src/jobs/__tests__/subscription-expiry.test.ts` -> **2/2 vert** (idempotence expireDue ET releaseExpiredReservations, stats `{expired,released}`).
- `pnpm typecheck` -> **vert** (tsc -b --noEmit).
- `node scripts/check-i18n-hardcoded.mjs` -> **exit 0** (lint:i18n).
- `npx eslint (admin) + components/{admin,member}` -> **exit 0** (no-restricted-imports service-client respecté).
- `subscription-expiry` présent dans `JOB_REGISTRY`.
- `rel="noopener noreferrer"` présent dans `file/page.tsx`.

## Threat model
- T-04-ADMIN-ELEV : layout `requireRole('superadmin')` -> 404 (inchangé).
- T-04-ADMIN-WRITE : mutations service_role local + re-guard par action ; aucune écriture front subscriptions/payments.
- T-04-DESTRUCT : alert-dialog (révoquer, rejeter) ; motif requis pour rejeter (confirm désactivé si vide).
- T-04-EXTLINK : TronScan `rel="noopener noreferrer" target=_blank`.
- T-04-EXPIRE : UPDATE idempotent borné par WHERE + job_runs (via runJob).
- T-04-NOEMAIL : ExpiryBanner in-app uniquement, aucune infra email.

## Known Stubs
Aucun. Toutes les pages sont câblées sur des données réelles (service_role). La file et la table membres affichent des données live ; empty states intentionnels (pas des stubs).

## Self-Check: PASSED
- Fichiers créés vérifiés présents (subscription-expiry.ts, membres/page.tsx, file/page.tsx, ExpiryBanner.tsx, admin-service.ts).
- Commits vérifiés : c7b7d28, fcfded4, 5d6b171.
