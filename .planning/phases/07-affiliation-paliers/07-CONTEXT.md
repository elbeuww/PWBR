# Phase 7: Affiliation à paliers - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Activer l'**acquisition par influenceurs** via une affiliation **idempotente**, **sans fraude ni fuite de PII**, dont les commissions sont calculées **uniquement sur les abonnés actifs**. Construit au-dessus du socle Phase 4 (paiements réels `payments.amount_atomic`, abonnements `subscriptions`, pattern file superadmin) et du rôle `affiliate` posé en P1 (`profiles.role`, jamais le JWT).

1. **Code promo & onboarding affilié (AFF-01)** — programme **sur candidature** : un candidat remplit un formulaire (réseaux sociaux, Telegram, Facebook, nb abonnés, interactions) → file de revue superadmin → vérification manuelle → attribution du rôle `affiliate` + code **vanity** choisi.
2. **Attribution `?ref` (AFF-01)** — capture middleware (ordre **locale → ref → session**, verrouillé roadmap), cookie 30 j, **last-touch**, attribution figée à l'inscription.
3. **Calcul des commissions (AFF-03, AFF-05)** — taux **progressif à 8 paliers** (plafond 20 %) déterminé par le **nombre d'inscrits via le code** ; montant = `taux × revenu réel des filleuls ACTIFS` ; **idempotent** par mois (`UNIQUE(affiliate_id, referral_id, period)`) ; auto-parrainage et expirés → 0 commission.
4. **Dashboard affilié no-PII (AFF-02)** — portail dédié affilié : **agrégats seuls** (aucune ligne par filleul), set complet de métriques, isolation RLS prouvée (un affilié ne voit jamais les referrals d'un autre).
5. **Payout (AFF-04)** — le superadmin marque les commissions payées (payout **crypto manuel**) en traçant **tx_hash + date + montant** ; l'état se reflète dans le dashboard affilié.

**Couvre :** AFF-01, AFF-02, AFF-03, AFF-04, AFF-05.

**Hors scope (autres phases / hors roadmap) :**
- Payout des commissions **on-chain automatisé** (AFF-AUTO — Wave 5, hors roadmap v2.0). P7 = payout manuel tracé par le superadmin.
- Gestion consolidée des affiliés / performances côté superadmin (ADMIN-03/04 = Phase 8) — P7 pose la table de payout + l'action « marquer payé » minimale, P8 consolide.
- **Moteur de règles d'éligibilité auto-évalué** (seuils abonnés/interactions vérifiés automatiquement) — au MVP la validation des « conditions requises » est **manuelle** par le superadmin (voir Deferred).

</domain>

<decisions>
## Implementation Decisions

### Barème de commission (AFF-03)
- **D-01 :** **Taux progressif à 8 paliers**, plafond 20 %. Grille validée par le fondateur (objectif : récompenser le volume d'audience, 20 % réservé aux très gros) :

  | Palier | Inscrits via le code | Taux |
  |--------|----------------------|------|
  | 1 | 1 – 99 | 8 % |
  | 2 | 100 – 500 | 12 % |
  | 3 | 501 – 1 000 | 14 % |
  | 4 | 1 001 – 5 000 | 15 % |
  | 5 | 5 001 – 10 000 | 16 % |
  | 6 | 10 001 – 25 000 | 17 % |
  | 7 | 25 001 – 50 000 | 18 % |
  | 8 | 50 000 + | 20 % |

- **D-02 :** **Le palier (taux %) est déterminé par le NOMBRE D'INSCRITS via le code** (l'audience ramenée = referrals attribués à l'inscription), **PAS** par le nombre d'abonnés actifs. Design d'incitation : grosse audience → meilleur taux, mais on ne paie que sur l'argent réellement encaissé.
- **D-03 :** **Base du montant = montant payé réel `payments.amount_atomic`** (BigInt atomique ×10⁶, zéro float — déterminisme financier verrouillé P4) des **filleuls ACTIFS uniquement**. Commission = `taux × Σ amount_atomic des paiements vérifiés du filleul sur la période`.
- **D-04 :** **Découverte (3 $/7 j) ET standard (9 $/mois) commissionnent** toutes deux (récompense dès la 1re conversion, encourage le volume).
- **D-05 :** **Période = mois calendaire** (`period = 'YYYY-MM'`). `UNIQUE(affiliate_id, referral_id, period)` → **1 commission par filleul par mois**, idempotente (re-run = même total). Commission rattachée au(x) paiement(s) vérifié(s) tombant dans le mois.
- ⚠️ **Flag planning (définition d'« inscrit ») :** le fondateur considère qu'« il n'y a pas de compte sans payer ». Techniquement (socle P4), un profil existe dès l'inscription, AVANT paiement. Le planner DOIT définir précisément ce que compte D-02 : **un `referral` = un profil attribué à l'affilié au moment du signup** (capture du cookie ref). Le palier compte ces inscrits ; le montant (D-03) ne paie que ceux qui sont actifs/payants. Garder ces deux compteurs distincts et déterministes.

### Code promo & onboarding affilié (AFF-01)
- **D-06 :** **Code = vanity choisi par l'affilié** (ex. `BORHANE`), **unique**, format borné (A-Z0-9, longueur à fixer — discrétion). Mémorisable/brandable pour un influenceur.
- **D-07 :** **Posé par le superadmin** : il promeut le user en `profiles.role = 'affiliate'` et enregistre/valide le code via le back-office `(admin)`. **Pas de self-serve** d'activation directe (anti-abus, cohérent payout manuel, peu d'affiliés triés au MVP).
- **D-08 :** **Onboarding = candidature.** Page formulaire (accessible via le lien du programme d'affiliation) capturant : **réseaux sociaux, canal Telegram, page Facebook, nombre d'abonnés, niveau d'interactions**. → **file de revue** dans le back-office `(admin)` (réutilise le pattern « file superadmin » de P4) → **vérification manuelle** des conditions (PAS d'auto-évaluation) → approbation → attribution rôle + code (D-07).

### Attribution du `?ref` (AFF-01, AFF-05)
- **D-09 :** **Capture middleware** ordre **locale → ref → session** (verrouillé roadmap). **Cookie `ref` persistant 30 jours** entre l'arrivée avec `?ref=CODE` et l'inscription.
- **D-10 :** **Last-touch** — si plusieurs `?ref=` différents sont vus avant l'inscription, le **dernier écrase** le précédent.
- **D-11 :** **Attribution figée à l'inscription** — le `ref` présent dans le cookie au moment du signup attache le profil créé à l'affilié (le `referral`).
- **D-12 :** **Auto-parrainage (AFF-05) exclu au CALCUL** — garde-fou déterministe à la source de vérité : le job de commission **EXCLUT** toute ligne où `referral.user_id = affiliate.user_id`. Inviolable côté calcul. (Blocage UX à l'inscription = bonus optionnel, non requis.)

### Dashboard affilié no-PII (AFF-02) & payout (AFF-04)
- **D-13 :** **Filleuls affichés en AGRÉGATS SEULS** (compteurs) — **aucune ligne par filleul** → zéro risque de ré-identification, AFF-02 « sans PII » au plus strict.
- **D-14 :** **Métriques = set complet** : abonnés actifs ramenés (en cours) · total inscrits via le code · revenus générés (cumul + mois courant) · commissions dues / payées · **taux/palier actuel**.
- **D-15 :** **Payout (AFF-04) = tx_hash + date + montant.** Quand le superadmin marque une commission payée (payout USDT manuel), on enregistre le **hash de transaction**, la **date** et le **montant** (traçabilité on-chain complète, anti-litige, cohérent rigueur P4). L'état `due → payée` se reflète dans le dashboard affilié (D-14).

### Claude's Discretion
- **Schéma exact des tables** (migration **0016** — plus haute existante = 0015 ; ⚠️ 0013 absente/différée, ne PAS réutiliser ce numéro). Tables pressenties : `affiliates`/`affiliate_codes` (code vanity, taux/palier dérivé), `affiliate_applications` (candidature D-08, statut pending/approved/rejected), `referrals` (filleul ↔ affilié, attribué au signup D-11), `commissions` (`UNIQUE(affiliate_id, referral_id, period)`, montant atomique, statut due/payée), `payouts` (tx_hash + date + montant, D-15). Numéros, noms et colonnes exacts = discrétion.
- **RLS isolation affilié** : « lis les tiens » (affilié) + « superadmin voit tout », miroir exact de `payments`/`subscriptions` (0009/0012). Écritures (attribution, commissions, payout) réservées au `service_role` / RPC — jamais d'écriture front. Prouver l'isolation (un affilié ne voit jamais les referrals/commissions d'un autre).
- **Job de calcul de commission** idempotent (pattern `job_runs` + Windows Task Scheduler, cadence mensuelle), agrégation déterministe BigInt ×10⁶, application de la grille D-01 selon le compteur d'inscrits D-02.
- **Définition opérationnelle d'« inscrit »** (cf. flag D-05) : compteur de `referrals` attribués, distinct du compteur d'abonnés actifs.
- **Format/longueur/normalisation du code vanity** (casse, caractères autorisés, collision).
- **Implémentation de la capture cookie `ref`** dans le middleware existant (P1), sans casser l'ordre locale → ref → session.
- **Requêtes d'agrégation no-PII** du dashboard (compteurs sans exposer d'identifiants filleuls).
- **Découpage UI** : page de candidature, portail/dashboard affilié, file de revue `(admin)`, vue payout `(admin)` ; extension du namespace de messages i18n (nouveau `affiliate`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Exigences & roadmap du milestone
- `.planning/ROADMAP.md` § Phase 7 — Goal + 4 Success Criteria (couvre AFF-01..05), incl. contraintes verrouillées (capture middleware locale → ref → session, idempotence `UNIQUE(affiliate_id, referral_id, period)`, max 20 %, no-PII).
- `.planning/REQUIREMENTS.md` § AFF (AFF-01..05) — libellés exacts ; note AFF-AUTO (payout on-chain auto) = hors roadmap.
- `.planning/STATE.md` § Accumulated Context — décisions héritées du milestone.

### Contexte Phase 4 (socle réutilisé — paiements & file superadmin)
- `.planning/phases/04-paiement-usdt-mvp-abonnement-jalon-encaissement/04-CONTEXT.md` — patterns directement réutilisés : idempotence (UNIQUE index + RPC atomique), RLS producteur-unique, **file de validation superadmin** (modèle pour la file de candidature D-08), transitions `service_role`-only, montants BigInt atomique ×10⁶, route group `(admin)` hors `[locale]` + 404.

### Données & schéma (cœur réutilisé)
- `supabase/migrations/0012_payments.sql` — **source de revenu** (`payments.amount_atomic`, `verified_at`, `plan`, `user_id`), RLS producteur-unique, **UNIQUE index anti-replay**, **RPC atomique** `activate_subscription_for_payment` (modèle d'idempotence pour les commissions).
- `supabase/migrations/0009_subscriptions_gating.sql` — `subscriptions` (`status` active/expired, `current_period_end`, `plan`), `has_active_subscription()` (security definer) — définit « abonné actif » pour D-03/AFF-05.
- `supabase/migrations/0010_has_active_subscription_null_expiry.sql` — durcissement helper (expiry nullable).
- `supabase/migrations/0008_profiles_role.sql` — `profiles.role` (rôle `affiliate`, ACCESS-03) + `is_superadmin()` (RLS back-office et file de revue).
- `packages/supabase/src/` — clients (`anon-client.ts` lecture front, service-client serveur) + repositories typés ; **ré-générer/éditer `database.types.ts` à la main après migration 0016** (projet non `link`é — `gen types --linked` échoue par design, cf. 0012).

### Contexte des phases antérieures (socle réutilisé)
- `.planning/phases/01-socle-transverse-i18n-rtl-r-les-gating/01-CONTEXT.md` — `profiles.role` hors JWT, **middleware** i18n (point d'extension pour la capture `?ref` D-09), admin `(admin)` hors `[locale]` + 404 (D-09 P1), i18n next-intl verrouillé (check CI anti-chaîne-dure).
- `.planning/phases/02-vitrine-publique-trilingue-gate-l-gal/02-CONTEXT.md` — design system (toggle dark/light, vert/rouge sémantiques), tarifs 9 $/mois + 3 $/7 j (base des montants commissionnés).

### Recherche v2.0 (stack & pièges)
- `.planning/research/STACK.md` — `@tanstack/react-query` (dashboard), luxon (bornes de période mensuelle), p-retry/p-limit.
- `.planning/research/ARCHITECTURE.md` — frontière producteur-unique, segment `[locale]`, `(admin)` hors `[locale]`, jobs idempotents + `job_runs`.
- `.planning/research/PITFALLS.md` — gating UI sans RLS (#5 : la RLS est la SEULE barrière non contournable — critique pour l'isolation affilié et le no-PII).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Table `payments` + `amount_atomic` (0012)** — **source unique de revenu** pour le calcul des commissions (D-03). Lire les paiements `verified` des filleuls par période.
- **Pattern idempotence (0012)** : UNIQUE index partiel + RPC atomique `security definer` — modèle direct pour `UNIQUE(affiliate_id, referral_id, period)` et un RPC de calcul/insertion de commission sans doublon.
- **File de validation superadmin (P4, ADMIN-02)** — modèle pour la **file de revue des candidatures affiliées** (D-08) : liste pending + actions Approuver/Rejeter via `service_role`.
- **Route group `(admin)`** (`apps/web/src/app/(admin)`, hors `[locale]`, 404 non-superadmin) — y greffer la file de candidature + la vue payout.
- **`is_superadmin()` (0008)** + **`profiles.role` (rôle `affiliate`)** — RLS des surfaces back-office et du portail affilié.
- **Middleware i18n (P1)** — point d'insertion de la capture `?ref` (ordre locale → ref → session, D-09) sans casser le routing locale.
- **Pattern jobs idempotents + `job_runs`** (cœur v1.0, Windows Task Scheduler) — modèle pour le job mensuel de calcul de commission.
- **`has_active_subscription()` / `subscriptions` (0009)** — définit « filleul actif » (D-03) et exclut les expirés (AFF-05).
- **Namespace messages i18n** ({fr,en,ar}.json) à étendre (nouveau `affiliate` : candidature, dashboard, payout).

### Established Patterns
- **Frontière producteur-unique / RLS** : aucune écriture front sur les tables d'affiliation/commissions/payouts ; attributions et calculs via `service_role`/RPC. La RLS « lis les tiens + superadmin voit tout » est la SEULE barrière d'isolation (Pitfall #5).
- **Migrations SQL versionnées = source de vérité unique** (pas d'ORM). Prochain numéro = **0016** (⚠️ 0013 absente — ne pas réutiliser). Appliquées via MCP `apply_migration`, puis édition manuelle de `database.types.ts`.
- **Déterminisme financier** : montants/commissions en **BigInt atomique ×10⁶**, zéro float, comparaisons exactes.
- **@supabase/ssr `getUser()`** (jamais `getSession()`) côté serveur.
- **i18n verrouillé P1** : tout texte via next-intl ; montants/dates via `<bdi>`/`Intl`.

### Integration Points
- Nouvelles tables (migration 0016) : affiliés/codes, candidatures, referrals, commissions (`UNIQUE(affiliate_id, referral_id, period)`), payouts (tx_hash+date+montant).
- Capture `?ref` dans le **middleware** existant → cookie 30 j → lu à l'inscription pour créer le `referral` (D-11).
- **Job mensuel** de commission : lit `payments`+`subscriptions`, applique la grille D-01 selon le compteur d'inscrits (D-02), insère les commissions idempotentes, alimente `job_runs`.
- **Portail affilié** (`[locale]` ou surface dédiée) : lectures agrégées via RLS (anon/auth-client), aucune PII.
- **Back-office `(admin)`** : file de candidatures + action « marquer payé » (écrit `payouts` via `service_role`).

</code_context>

<specifics>
## Specific Ideas

- **Objectif explicite du fondateur** : un programme taillé pour les **gros influenceurs** (jusqu'à **50k+ inscrits** par affilié). Le barème est volontairement **agressif au sommet** (20 % réservé à 50k+) et **modeste en bas** (8 % sous 100) pour récompenser le volume d'audience tout en protégeant la marge sur les petits affiliés.
- **Découplage audience / argent** : le **taux** suit l'audience (inscrits), le **montant** suit l'argent réel encaissé (filleuls actifs). Conçu pour qu'un gros influenceur soit fortement incité, sans payer sur des comptes non convertis.
- **Programme sur candidature, pas ouvert** : le fondateur veut **trier les affiliés** (réseaux sociaux, Telegram, Facebook, nb abonnés, interactions) et valider à la main — qualité plutôt que quantité d'affiliés.
- **No-PII strict** : agrégats seuls, le fondateur a écarté les lignes pseudonymisées par filleul.
- **Traçabilité payout on-chain** : tx_hash systématique, cohérent avec la rigueur « tout l'argent est traçable » de P4.

</specifics>

<deferred>
## Deferred Ideas

- **Moteur d'éligibilité auto-évalué** (vérification automatique des seuils d'abonnés/interactions des candidats via API réseaux sociaux) — au MVP la validation est **manuelle** (superadmin). Capacité en soi → phase ultérieure si le volume de candidatures l'exige.
- **Payout des commissions on-chain automatisé** (TronWeb, job isolé, secret manager — AFF-AUTO) — Wave 5, hors roadmap v2.0. P7 = payout manuel tracé.
- **Lignes pseudonymisées par filleul** dans le dashboard (#1234 · plan · actif depuis) — écarté au profit des agrégats (D-13) ; ré-évaluable si les affiliés réclament plus de visibilité.
- **Blocage de l'auto-parrainage à l'inscription** (refus d'attribution si compte = affilié) — gardé optionnel ; le garde-fou au calcul (D-12) suffit et est inviolable.
- **Gestion consolidée des affiliés / performances côté superadmin** (ADMIN-03/04) — Phase 8. P7 pose le strict minimum (file de candidature + action « marquer payé »).

None déféré au-delà : la discussion est restée dans le périmètre de la phase.

</deferred>

---

*Phase: 7-Affiliation à paliers*
*Context gathered: 2026-06-18*
