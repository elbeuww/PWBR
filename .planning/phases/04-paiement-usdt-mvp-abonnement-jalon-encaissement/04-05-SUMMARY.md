# 04-05 SUMMARY — Parcours de paiement member-facing

**Statut : COMPLET.** Plan exécuté end-to-end (3 commits de code + ce SUMMARY). L'exécuteur a heurté une erreur API « Overloaded » APRÈS le dernier commit de code mais AVANT d'écrire ce SUMMARY ; l'orchestrateur a vérifié l'état réel du repo (tout commité, suite verte) et finalise ici.

## Requirements couverts
PAY-01, PAY-02, PAY-03, PAY-04, PAY-06 (+ décisions D-01/02/03/04/05/11/12).

## Commits
- `20155a0` feat(04-05): module QR maison zéro-dépendance golden-testé (B-04-03)
- `395e0ae` feat(04-05): actions paiement — reservePayment + verifyPayment anti-TOCTOU + gate légal
- `8e23271` feat(04-05): UI parcours paiement — page + PlanCard + PaymentPanel + HashForm + VerificationPolling

## Fichiers créés
**QR maison (zéro dépendance npm — B-04-03 résolu) :**
- `apps/web/src/lib/qr/qrcodegen.ts` (encodeur QR auto-contenu, port d'une implémentation de référence permissive ; attribution licence en en-tête)
- `apps/web/src/lib/qr/toSvgPath.ts` (matrice → path SVG)
- `apps/web/src/lib/qr/QrCode.tsx` (composant React SVG, rend l'adresse PUBLIQUE seule)
- `apps/web/src/lib/qr/index.ts` (barrel)
- `apps/web/src/lib/qr/__tests__/qrcodegen.test.ts` (golden test de correction — 7 cas)

**Parcours abonnement** (sous `[locale]/(account)/abonnement/` — voir déviation route) :
- `actions.ts` — `reservePayment` / `verifyPayment` (anti-TOCTOU) / `getPaymentStatus` / `getDiscoveryAvailability`
- `discovery.ts` + `__tests__/discovery.test.ts` — décision pure `canConsumeDiscovery` (one-shot D-12), 6 cas
- `page.tsx` (RSC), `PlanCard.tsx`, `PaymentPanel.tsx`, `HashForm.tsx`, `VerificationPolling.tsx`, `CopyButton.tsx`
- `apps/web/src/app/[locale]/(account)/layout.tsx` — nouveau groupe, gate `requireUser()` seul

## Invariants financiers livrés (vérifiés par lecture de actions.ts)
- **Ordre anti-TOCTOU inviolable** : `verifyPayment` arme le `tx_hash` (UPDATE service_role, `.eq('status','pending')`) AVANT toute lecture réseau ; `23505` → `{rejected, replay}` immédiat **sans aucun appel TronGrid**.
- **service_role LOCAL** (`createServiceClient` depuis `process.env`), jamais le barrel (frontière producteur-unique respectée ; aucun import service-client côté apps/web).
- **Montant attendu posé serveur** par `reserveOffset` (D-05) — le client ne choisit jamais `expected_amount_atomic` (BigInt → string pour le payload RSC, reformaté `formatAtomic` côté client).
- **Gate légal** : `TRON_NETWORK==='mainnet' && !isLegalReviewDone()` → `legal_gate` (testnet/Nile libre, LEGAL-02).
- **over/under → `ambiguous`** (file superadmin, jamais activation/rejet auto — D-06/D-07) ; `exact` → `activateForPayment` (RPC atomique, période 7 days / 1 month).
- **Codes d'erreur typés** → clés i18n, jamais `error.message` brut (T-04-ERRLEAK).

## UI PaymentPanel (décision fondateur, mobile-first)
QR SVG maison en haut (adresse publique seule) → adresse + copie 1-tap → montant exact unique + copie. Copie = action primaire mobile, QR pour desktop/2ᵉ appareil. Bloc « Réseau : TRC-20 (TRON) ». Montants en `<bdi>` via formatAtomic+Intl.

## Vérification (exécutée par l'orchestrateur)
- QR golden test : **7/7** vert. discovery one-shot : **6/6** vert.
- **Aucune dépendance npm ajoutée** (`git diff` package.json/pnpm-lock = vide) → B-04-03 honoré.
- `pnpm typecheck` (tsc -b) : **vert**. `pnpm lint:i18n` : « aucune chaîne en dur » (I18N-03 OK). Parité fr/en/ar : verte.
- Suite complète : **354/354** tests (45 fichiers), zéro régression.

## Déviations
1. **Route group `(account)` au lieu de `(member)`** (résolution d'un point critique signalé) : le layout `(member)` appelle `requireActiveSub()` qui redirige un membre non-abonné vers `/tarifs` → la page d'achat y serait inatteignable (boucle). Nouveau groupe `(account)` avec `requireUser()` seul ; les groupes `()` n'altèrent pas l'URL. Rationale documentée en tête de `(account)/layout.tsx`.
2. **QR : port d'une implémentation de référence permissive** (attribution en en-tête) plutôt que from-scratch, pour garantir la correction (un QR non scannable serait pire qu'inutile) tout en respectant « zéro dépendance npm » (dans l'arbre, auditable, aucun `pnpm add`). Golden-testé.

## À confirmer en secure-phase / code-review (non bloquant)
- `verifyPayment` arm-step : si la ligne n'est pas `pending`, l'UPDATE matche 0 ligne sans erreur et le flux poursuit → repose sur l'idempotence de la RPC `activate_subscription_for_payment`. Vérifier cette idempotence (re-soumission d'un payment déjà traité).
- Lecture du parcours via service_role local pour `getDiscoveryAvailability`/`priorPlans` (cohérent avec la frontière, mais à auditer comme pour 04-06).

## Manuel (human-verify à la vérification de phase)
Parcours testnet Nile bout-en-bout : choix offre → reservePayment → adresse/QR/montant unique → hash réel → polling → abonnement actif.
