# Phase 4: Paiement USDT MVP & abonnement — JALON ENCAISSEMENT - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Encaisser un **premier abonnement** de façon **sûre et automatique** en USDT TRC-20, puis faire vivre l'abonnement (activation, expiration, renouvellement). C'est **LE jalon « 1er abonnement encaissable »** — densité de risque maximale (tout l'argent passe ici). Construit au-dessus de la table `subscriptions` réelle déjà posée en P1 (activation = `service_role` only) et du gate `has_active_subscription()`.

1. **Réception & soumission** — écran adresse USDT TRC-20 (réseau en grand + QR + copie 1-tap + montant exact dû) → l'utilisateur paie hors-app → revient soumettre le hash (PAY-01, PAY-02).
2. **Vérification on-chain & activation** — vérif TronGrid déterministe → activation automatique de l'abonnement (période + expiration) sans intervention manuelle (PAY-02, PAY-03).
3. **Robustesse des paiements** — rejet/traçage des cas invalides (replay, mauvais montant/token/destinataire, non confirmé) ; cas ambigus (sur/sous-paiement) → file de validation superadmin (PAY-04, ADMIN-02).
4. **Cycle de vie** — expiration automatique (job `subscription-expiry`), information de l'utilisateur, perte d'accès ; offre découverte 3 $/7 j one-shot puis bascule standard (PAY-05, PAY-06).
5. **Back-office minimal** — le superadmin voit les membres (état abo/paiement) et agit à la main (ADMIN-01) ; il traite la file ambiguë (ADMIN-02).

**Couvre :** PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, ADMIN-01, ADMIN-02.

**Hors scope (autres phases / hors roadmap) :**
- Processeur de paiement automatique / watcher push généralisé (PAY-AUTO, Wave 5 — hors roadmap v2.0). P4 = soumission de hash par l'utilisateur + vérif à la demande.
- Track record / % de réussite mesuré (P5).
- Affiliation & commissions (P7), back-office affiliés/santé jobs (P8).
- Auto-renew / mandat récurrent (impossible en USDT manuel — explicitement reporté).
- Infra email (provider/templates) — non montée au MVP ; rappels = bandeau in-app (voir D-09).

**⚠️ Gate non-code bloquant la prod :** le 1er encaissement en production exige `LEGAL_REVIEW_DONE = true` (LEGAL-02, posé en P2). Le code de paiement P4 **doit consommer ce flag** avant d'autoriser un encaissement réel. Bloque la mise en prod, PAS le développement/test.

</domain>

<decisions>
## Implementation Decisions

### Réception & soumission du paiement (PAY-01, PAY-02)
- **D-01 :** **Une seule adresse USDT TRC-20 partagée** pour tous les paiements (cold wallet ; watcher en **lecture seule** ; clés privées **jamais** en code ni en DB — contrainte sécurité verrouillée). Le hash soumis + le **montant unique** (voir D-05) distinguent les paiements. Pas d'adresses dérivées par user au MVP (infra HD wallet hors budget).
- **D-02 :** **Polling live in-app** pendant la vérif on-chain (~1 min de confirmations) : écran « Vérification en cours… » avec étapes, l'accès s'ouvre dès confirmation. Choix de gratification immédiate / réassurance pour un 1er paiement crypto. (Repli différé acceptable si le job est lent — à arbitrer au planning, mais l'UX cible est le polling live.)
- **D-03 :** **Screenshot de transaction = optionnel** (champ facultatif). Sert de preuve dans la file superadmin en cas d'ambiguïté ; n'entre **jamais** dans la vérification automatique (le hash on-chain est la seule source de vérité ; un screenshot est falsifiable). Zéro friction si absent.
- **D-04 :** **Échec de vérif → raison claire + re-soumission tracée.** Message précis (« montant reçu 8 USDT, attendu 9.02 », « token non reconnu », « TX non confirmée ») + l'utilisateur peut corriger et soumettre un autre hash. Chaque tentative est tracée. Pas de bascule automatique en file superadmin pour les erreurs triviales (faute de frappe).

### Matching payeur & cas ambigus (PAY-04, ADMIN-02)
- **D-05 :** **Montant unique par facture** pour le matching déterministe : on génère des centimes uniques par paiement (ex. 9.01, 9.02… / 3.01, 3.02…) → le montant identifie le payeur de façon robuste même si l'utilisateur oublie/se trompe de hash. ⚠️ Impacte PAY-01 « montant atomique exact dû » : le montant affiché = montant nominal + offset unique. Calcul/comparaison en **decimals 6 (BigInt atomique ×10⁶, zéro float)** — verrouillé par la roadmap. *(Flag planning : durée de validité de l'offset / collision space — à cadrer.)*
- **D-06 :** **Sous-paiement** (reçu < dû) → **file de validation superadmin** (décision manuelle : demander le complément, activer au prorata, rembourser). Pas de rejet auto (éviter de punir une erreur honnête).
- **D-07 :** **Sur-paiement** (reçu > dû) → **activer la période normale, surplus ignoré** (noté, non remboursé auto). MVP simple ; les rares cas se règlent à la main.
- **D-08 :** **File superadmin** = liste des paiements ambigus (montant attendu/reçu, hash, user, lien TronScan) + actions **Activer / Rejeter (avec motif)** ET **ajuster durée/plan** à la main pour les cas tordus. L'utilisateur ne peut écrire QUE `payments(pending)` ; seul le `service_role` transitionne vers `verified`/`active` (verrouillé roadmap).

### Cycle de vie & expiration (PAY-05, PAY-06)
- **D-09 :** **Rappel avant expiration = bandeau in-app** (« ton abo expire dans X jours — renouvelle ») à J-3/J-1 dans l'espace membre. **Aucune infra email** montée au MVP (budget quasi-nul) ; l'email est ajoutable plus tard sans refonte.
- **D-10 :** **Coupe nette à `current_period_end`** (la RLS `has_active_subscription()` fait déjà `current_period_end > now()`). Déterministe, rien à coder de plus côté gating. **Pas de période de grâce** au MVP.
- **D-11 :** **Renouvellement = même parcours de paiement** (nouveau hash USDT) → prolonge `current_period_end` (ajout d'une période). **Pas d'auto-renew** (impossible en crypto manuel).
- **D-12 :** **Offre découverte 3 $/7 j = one-shot + upgrade anticipé.** Après usage (enforcement par historique en DB — `plan = 'discovery'` déjà consommé), l'utilisateur ne voit plus que le standard 9 $/mois. En cours de période découverte, il **peut** passer au standard (nouveau paiement qui prolonge), **sans remboursement** du prorata découverte. Pas de cumul libre (anti-abus).

### Back-office membres (ADMIN-01)
- **D-13 :** Vue membres superadmin = **lecture + actions manuelles** (indispensable dès le 1er encaissement). Actions retenues : **activer/prolonger**, **révoquer/suspendre**, **changer de plan** (discovery↔standard). Toute action passe par le `service_role` (jamais d'écriture front sur `subscriptions`).
- **D-14 :** Liste membres = **filtre statut (actif/inactif/expiré) + recherche par email + colonnes plan / date d'expiration / dernier paiement.** Suffisant pour piloter sans surcharge.
- **D-15 :** Emplacement = **route group `(admin)` existant** (`apps/web/src/app/(admin)`, HORS `[locale]`, **404 pour non-superadmin** — cohérent P1 D-09, discrétion sécurité). Le squelette existe déjà.

### Claude's Discretion
- Schéma exact de la table `payments` (colonnes : `user_id`, `tx_hash` UNIQUE GLOBAL, `amount_atomic`, `expected_amount_atomic`, `status` pending/verified/rejected/ambiguous, `plan`, `screenshot_url?`, `created_at`, `verified_at?`…) + policies RLS (user insert `pending` seulement ; lectures scopées ; transitions service_role). Migration suivante = **0012** (plus haute existante = 0011).
- Forme du client TronGrid (fetch + Zod maison, cohérent avec les autres clients data-sources) : endpoint de lecture d'une transaction TRC-20, normalisation destinataire hex↔base58, contrôle `only_confirmed:true` (anti-réorg), montant en BigInt ×10⁶.
- Variables `.env` à ajouter : adresse de réception USDT TRC-20, contrat USDT officiel (`TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`), clé/endpoint TronGrid. **Jamais** de clé privée de wallet.
- Mécanique de l'offset de montant unique (D-05) : plage, durée de réservation, libération si paiement abandonné.
- Job `subscription-expiry` : exécution (Windows Task Scheduler + idempotence `job_runs`, pattern v1.0) ; transition `active → expired` quand `current_period_end <= now()`.
- Découpage des composants UI (écran adresse/QR/montant, formulaire hash, écran polling, file admin, table membres) + extension du namespace de messages (`pricing`/nouveau `payment`).
- Stratégie exacte du polling (intervalle, timeout, `@tanstack/react-query`) et du repli différé éventuel.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Exigences & roadmap du milestone
- `.planning/ROADMAP.md` § Phase 4 — Goal + 5 Success Criteria (couvre PAY-01..06, ADMIN-01/02), incl. contraintes on-chain verrouillées.
- `.planning/REQUIREMENTS.md` § PAY (PAY-01..06) + § ADMIN (ADMIN-01, ADMIN-02) — libellés exacts.
- `.planning/STATE.md` § Accumulated Context — décisions héritées du milestone.

### Gate juridique (BLOQUANT prod — à lire impérativement)
- `.planning/phases/02-vitrine-publique-trilingue-gate-l-gal/02-CONTEXT.md` D-16 — double mécanisme du gate LEGAL-02 : artefact `LEGAL-REVIEW.md` + flag `LEGAL_REVIEW_DONE` que **le code paiement P4 consomme** avant le 1er encaissement prod.
- `docs/legal/LEGAL-REVIEW.md` (ou `.planning/` — emplacement posé en P2) — sign-off juriste à vérifier non-code.
- Variable `.env` `LEGAL_REVIEW_DONE` (déjà présente, défaut non validé).

### Contexte des phases antérieures (socle réutilisé)
- `.planning/phases/01-socle-transverse-i18n-rtl-r-les-gating/01-CONTEXT.md` — gating verrouillé : `subscriptions` réelle (status/plan/`current_period_end`), `has_active_subscription()`, **aucune policy write** (activation service_role only), `profiles.role` hors JWT, redirection non-abonné → `/[locale]/tarifs`, admin `(admin)` hors `[locale]` + 404 (D-09).
- `.planning/phases/02-vitrine-publique-trilingue-gate-l-gal/02-CONTEXT.md` — tarifs **9 $/mois + 3 $/7 j one-shot** (D-11 P2), affichage « payable en USDT (TRC-20) », design system (toggle dark/light, vert/rouge sémantiques), `Disclaimer` transverse, écran « paiement bientôt » à remplacer par le vrai flux.
- `.planning/phases/03-espace-membre-signaux-gated-rls/03-CONTEXT.md` — surface membre gated que l'abonnement débloque (la liste signaux apparaît dès `has_active_subscription()` = true).

### Données & schéma (cœur + P1)
- `supabase/migrations/0009_subscriptions_gating.sql` — schéma `subscriptions` (`status` pending/active/expired/canceled, `plan` discovery/standard, `current_period_end`) + `has_active_subscription()` (security definer). P4 ajoute l'**écriture/transition** (service_role), pas de réécriture de la fonction RLS.
- `supabase/migrations/0010_has_active_subscription_null_expiry.sql` — durcissement du helper (expiry nullable).
- `supabase/migrations/0008_profiles_role.sql` — `is_superadmin()` (RLS back-office).
- `supabase/migrations/0006_analyses_trade_setups.sql` — pattern RLS « journal privé » (lecture authenticated, écritures service_role) à étendre pour `payments`.
- `packages/supabase/src/` — clients (`anon-client.ts`, service-client par import direct) + repositories typés ; ré-générer `database.types.ts` après migration 0012.

### Recherche v2.0 (stack & pièges)
- `.planning/research/STACK.md` — clients data-sources fetch+Zod maison (modèle pour TronGrid), `@tanstack/react-query`, luxon (périodes/expiry), p-retry/p-limit (rate limits API).
- `.planning/research/ARCHITECTURE.md` — frontière producteur-unique, segment `[locale]`, `(admin)` hors `[locale]`, jobs idempotents + `job_runs`.
- `.planning/research/PITFALLS.md` — gating UI sans RLS (#5), secrets/clés, conformité.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Table `subscriptions` + `has_active_subscription()` (0009/0010)** — déjà réelles ; P4 n'ajoute QUE l'écriture (table `payments` + transitions service_role). Ne pas réécrire la fonction RLS.
- **Route group `(admin)`** (`apps/web/src/app/(admin)`) — squelette existant, hors `[locale]`, 404 non-superadmin (P1 D-09). Y greffer la vue membres + la file de validation.
- **Écran `[locale]/(marketing)/paiement-bientot/page.tsx`** + `tarifs/page.tsx` (P2) — point de bascule : remplacer « paiement bientôt » par le vrai parcours (adresse/QR/montant → soumission hash).
- **Clients data-sources fetch+Zod maison** (`packages/data-sources/*` ou pattern équivalent) — modèle direct pour le client TronGrid (Bearer + parsing Zod + p-retry).
- **Pattern jobs idempotents + `job_runs`** (cœur v1.0, Windows Task Scheduler) — modèle pour le job `subscription-expiry`.
- **`is_superadmin()` (0008)** — RLS des écrans/actions back-office.
- **Namespace messages `pricing`** ({fr,en,ar}.json) à étendre (nouveau `payment` : adresse, montant, polling, erreurs, file admin, membres).

### Established Patterns
- **Frontière producteur-unique / RLS** : l'utilisateur n'écrit QUE `payments(pending)` ; toute transition (`verified`/`active`/`expired`) et toute écriture `subscriptions` passent par le `service_role` (jobs/route handlers serveur). Jamais d'import du service-client dans le front client.
- **Migrations SQL versionnées = source de vérité unique** (pas d'ORM). Prochain numéro = **0012**. Appliquées via MCP `apply_migration` (convention repo) puis `supabase gen types`.
- **@supabase/ssr `getUser()`** (jamais `getSession()`) côté serveur — maintenir.
- **Déterminisme financier** : montants en BigInt atomique ×10⁶, zéro float, comparaisons exactes (verrouillé roadmap).
- **i18n verrouillé P1** : tout texte via next-intl (check CI anti-chaîne-dure) ; montants/dates via `<bdi>`/`Intl`.

### Integration Points
- Nouvelle table `payments` (migration 0012) + policies RLS (insert pending par l'user, transitions service_role) ; `UNIQUE(tx_hash)` GLOBAL.
- Route handler serveur (ou server action) qui appelle TronGrid avec le `service_role` pour vérifier + activer (jamais côté client).
- Le job `subscription-expiry` transitionne `subscriptions.status` et alimente `job_runs`.
- Le code paiement lit `LEGAL_REVIEW_DONE` (env) avant d'autoriser un encaissement en prod.
- La vue membres `(admin)` lit via `is_superadmin()` ; ses actions écrivent via service_role.

</code_context>

<specifics>
## Specific Ideas

- **Densité de risque maximale assumée** : c'est la phase « tout l'argent ». Le fondateur privilégie la robustesse (file superadmin pour les cas limites plutôt que rejets/activations auto risqués) et l'UX rassurante (polling live) pour un public crypto-novice.
- **Matching par montant unique** (centimes 9.01/9.02…) retenu comme garde-fou déterministe en complément du hash — le fondateur veut pouvoir relier un paiement même en cas d'erreur utilisateur.
- **Pas d'email au MVP** : assumé, cohérent budget quasi-nul ; bandeau in-app suffit pour le rappel d'expiry.
- **Cold wallet + watcher lecture seule** : clés privées hors système, réaffirmé.

</specifics>

<deferred>
## Deferred Ideas

- **Reset de mot de passe d'un membre par le superadmin** — évoqué par le fondateur comme action admin. C'est de la **gestion de compte (auth)**, hors du périmètre littéral d'ADMIN-01 (« voir membres + état abo/paiement »). Petit ajout possible mais touche l'auth Supabase. **Décision : non intégré à P4** (le fondateur a choisi « prêt pour le contexte » sans l'inclure). À reprendre dans une phase back-office (P8) ou comme tâche dédiée si le besoin se confirme.
- **Auto-renew / paiement récurrent** → impossible en USDT manuel ; nécessiterait un processeur (Wave 5 hors roadmap / Phase 2 d'un futur milestone).
- **Watcher push on-chain généralisé / détection auto sans soumission de hash** (PAY-AUTO) → Wave 5, hors roadmap v2.0. P4 = soumission de hash par l'utilisateur.
- **Infra email (rappels expiry, reçus de paiement)** → ajoutable post-MVP sans refonte (bandeau in-app au MVP).
- **Période de grâce après expiration** → écartée du MVP (coupe nette) ; ré-évaluable selon le churn observé.
- **Remboursement automatique des sur-paiements / crédit de durée** → traité à la main via la file/vue membres au MVP.
- **Adresses USDT dérivées par utilisateur (HD wallet)** → hors budget/scope MVP (une adresse partagée + montant unique).

None déféré au-delà : la discussion est restée dans le périmètre de la phase.

</deferred>

---

*Phase: 4-Paiement USDT MVP & abonnement — JALON ENCAISSEMENT*
*Context gathered: 2026-06-15*
