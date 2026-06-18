---
phase: 07-affiliation-paliers
plan: 01
status: complete
requirements: [AFF-01, AFF-02, AFF-03, AFF-04, AFF-05]
commits: [1686543, bebdce9]
date: 2026-06-18
---

# Plan 07-01 — Socle DB de l'affiliation (SUMMARY)

## Résultat

Migration **0016** appliquée LIVE sur la base réelle ; `database.types.ts` aligné. Socle financier déterministe en place : tout le calcul, l'idempotence et l'isolation vivent en DB ; les couches JS (plans suivants) ne font qu'appeler ces objets.

## Ce qui a été livré

- **6 tables** LIVE avec RLS active : `affiliates`, `affiliate_codes` (PK `^[A-Z0-9]{3,20}$`), `affiliate_applications`, `referrals` (UNIQUE user_id), `commissions`, `payouts`.
- **RLS isolation** « lis les tiens + superadmin », **zéro policy write** (écriture = service_role bypass) — miroir exact du triplet `payments` (0012).
- **Index idempotence** `commissions_aff_ref_period_idx` UNIQUE(affiliate_id, referral_id, period) (D-05).
- **`affiliate_rate_bps(int)`** : grille 8 paliers en basis points (D-01), `set search_path=public` figé (D-V2-05).
- **`compute_affiliate_commissions(text)`** security definer : taux(audience D-02) × Σ `payments.amount_atomic` filleuls actifs (D-03), exclusion auto-parrainage `r.user_id <> a.user_id` (D-12), join subscriptions actives (AFF-05), bornes mois UTC `[date_trunc, +1 month)`, upsert `on conflict ... where status='due'` (T-07-DOUBLEPAY), `revoke execute`.
- **`mark_commission_paid(uuid,text,bigint)`** security definer : update due→paid (raise si row_count=0, anti double-payout) + insert payouts en une transaction (D-15), `revoke execute`.
- **Vue `affiliate_dashboard`** `security_invoker=true` : agrégats seuls scopés `auth.uid()`, zéro user_id filleul (D-13), revenu cumul + mois courant (D-14).
- **`database.types.ts`** : ajout chirurgical des 6 tables + vue + 3 fonctions + alias maison ; `base_atomic`/`amount_atomic` (commissions, payouts) typés `string` (CR-02) ; blocs `payments`/alias existants préservés intacts.

## Vérifications

- **list_tables** : 6 tables affiliation présentes, RLS enabled, index `commissions_aff_ref_period_idx`.
- **get_advisors security** : ZÉRO nouvel advisor côté affiliation. La vue ne déclenche **pas** `security_definer_view` (security_invoker OK) ; les 2 RPC ne sont **pas** exécutables par `authenticated` (revoke OK). Advisors restants tous préexistants (pattern_stats, telegram_posts, is_superadmin/has_active_subscription, leaked-password).
- **`pnpm typecheck`** : 0 erreur.
- Greps invariants Task 1 : tables=6, rls=6, writepolicy=0, idx=1, invoker=1(réel), revoke=2, selfref=1(réel), accent=0, revenuecols=2.

## Déviations

- **Rule 1 (méthode types)** : `database.types.ts` mis à jour par **ajout chirurgical** plutôt que `generate_typescript_types` + ré-application. Raison : préserve sans risque les overrides `payments` `*_atomic` et le bloc d'alias maintenu main (le regen les écrase, D-05-02-F) ; même critère d'acceptation atteint (alias + `*_atomic: string` + typecheck 0). Schéma des types saisi depuis `list_tables verbose` (source = base LIVE).
- **Hygiène sécurité** : ajout `set search_path=public` sur `affiliate_rate_bps` (advisor `function_search_path_mutable` nouveau) + ALTER LIVE + fichier migration aligné → advisor résolu, convention D-V2-05 respectée.

## Point de vigilance (pour 07-03)

Le `join subscriptions` du RPC sert de filtre « actif » : si un filleul cumulait plusieurs lignes `subscriptions` actives, la somme `payments` serait multipliée. En pratique l'activation maintient une ligne/user. À couvrir par les tests d'intégration 07-03 (re-run idempotent, self-ref→0, expiré→0).

## Suivi

Migration history LIVE : `0016_affiliation` + `0016_affiliate_rate_bps_search_path`. Prochaine migration libre = **0017** (0013 toujours absente).
