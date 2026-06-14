# Pitfalls Research — v2.0 (couche produit payante greffée sur le cœur analytique livré)

**Domain:** Plateforme SaaS payante de signaux trading — paiement crypto USDT TRC-20 on-chain, abonnement + gating multi-rôles, affiliation à paliers, i18n trilingue RTL, Telegram, CMS, track record mesuré — audience MENA non technique
**Researched:** 2026-06-14
**Confidence:** HIGH (pièges on-chain/RLS/légal recoupés sources externes + invariants du repo lus dans ARCHITECTURE.md ; spécificités juridiques MENA = MEDIUM, bloquant non-code)

> **Périmètre.** Pièges SPÉCIFIQUES à l'ajout des features v2.0 sur l'existant (P1-4 livré). On ne re-couvre pas les pièges génériques web. Priorité absolue : **ARGENT** (paiement on-chain, commissions) → **SÉCURITÉ DU REVENU** (gating/RLS) → **LÉGAL** (conseil non agréé + crypto MENA, bloquant avant 1er encaissement) → reste.
>
> Mapping phases = waves d'ARCHITECTURE.md (W1 socle i18n/role · W2 cash paiement/gating · W3 track record/Telegram · W4 affiliation/CMS/superadmin · W5 automatisation).

---

## Critical Pitfalls

### Pitfall 1: Accepter un faux token "USDT" ou un transfert sans valeur on-chain

**What goes wrong:**
On vérifie qu'une TX existe, qu'elle va vers notre adresse, statut SUCCESS — et on active. Mais le `Transfer` provient d'un **contrat token contrefait nommé "USDT"** (Tron permet à n'importe qui de déployer un TRC-20 nommé USDT), ou c'est un **zero-value/fake transfer** (address-poisoning, frais Tron quasi nuls → spam de fausses TX trivial). L'abonné obtient l'accès sans avoir payé un seul vrai dollar.

**Why it happens:**
La vérif s'arrête au destinataire + montant + statut, sans **ancrer l'identité du contrat émetteur**. Le champ "montant" d'un faux token affiche bien `9` mais dans un actif sans valeur. Les screenshots de wallet sont encore plus faciles à falsifier — ils ne prouvent rien.

**How to avoid:**
- Vérifier que l'event `Transfer` est émis par **EXACTEMENT** le contrat USDT officiel `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` (en `.env`/config, jamais saisi par l'user). Refuser tout autre `contract_address`.
- Lire le montant depuis le `data` de l'event de CE contrat, decimals = 6 (voir Pitfall 2), jamais depuis une valeur déclarée par l'utilisateur.
- **Ne jamais activer sur la foi d'un screenshot.** Le screenshot est une pièce de support superadmin, pas une preuve.
- Exiger `to == adresse plateforme` (comparée en format normalisé — voir Pitfall 6).

**Warning signs:**
Activation avec un `contract_address` ≠ contrat officiel dans les logs ; abonnés actifs sans entrée correspondante dans le watcher de réception du cold wallet ; TX au montant exact mais aucun mouvement de solde réel.

**Phase to address:** Wave 2 (paiement USDT MVP, client TronGrid + Route Handler submit).

---

### Pitfall 2: Mauvaise gestion des decimals USDT (6) → montant lu faux par 10^6

**What goes wrong:**
USDT TRC-20 a **6 decimals**. Le `data` de l'event `Transfer` encode `9 000 000` pour 9 USDT. Si on compare cet entier brut à `9`, tout paiement réel est rejeté (sous-paiement apparent) ; si on divise par le mauvais facteur (ex. 10^18 façon ETH/ERC-20), on lit `0.000000000009` et on rejette tout, ou pire on accepte n'importe quoi.

**Why it happens:**
Réflexe ERC-20 (18 decimals) appliqué à TRC-20 ; ou comparaison float qui introduit des erreurs d'arrondi sur les montants.

**How to avoid:**
- Travailler en **entiers (BigInt), unités atomiques (×10^6)** de bout en bout. `dû_atomic = 9 * 1_000_000`. Comparer `montant_atomic >= dû_atomic`. **Jamais de float** sur de l'argent.
- Centraliser le facteur `USDT_DECIMALS = 6` dans une constante config + test golden (cohérent avec la discipline golden-values du cœur).
- Test : un paiement de 9.00, 9.01, 8.99 USDT atomiques → verdict attendu (accepté / accepté / file partiel).

**Warning signs:**
Tous les paiements valides tombent en file superadmin (sous-paiement) ; ou activations sur des montants ridicules. Tests de montants limites absents.

**Phase to address:** Wave 2.

---

### Pitfall 3: Confirmations insuffisantes / réorganisation de chaîne (réorg)

**What goes wrong:**
On active dès qu'on voit la TX (non confirmée / 1 bloc). Une réorg ou une TX non solidifiée disparaît ou est annulée → accès accordé pour un paiement qui n'a jamais été finalisé.

**Why it happens:**
Pression du "ça confirme en secondes" sur Tron + envie d'activer instantanément pour l'UX. On confond "vue dans le mempool/dernier bloc" et "finalisée".

**How to avoid:**
- Appeler TronGrid avec `only_confirmed: true` sur `gettransactioninfobyid` (endpoint `walletsolidity`) → ne renvoie que les TX **au-delà de la fenêtre de solidification** (~19 blocs / ~1 min). C'est la garantie anti-réorg.
- Si l'user soumet trop tôt (TX pas encore solidifiée) → laisser `payments` en `pending`, ne PAS activer. Le job `payment-watcher` re-vérifie périodiquement et active quand confirmé.
- UX : message rassurant "paiement en cours de confirmation (~1-2 min)" plutôt qu'un échec.

**Warning signs:**
Activations puis disparition de la TX du registre ; abonnements actifs sans dépôt finalisé sur le cold wallet.

**Phase to address:** Wave 2 (submit + `payment-watcher` job ensemble).

---

### Pitfall 4: Rejeu / double-réclamation d'un hash de transaction

**What goes wrong:**
Un même TxID est soumis deux fois (même user qui réessaie, ou **deux comptes différents** qui collent le même hash) → deux activations pour un seul paiement. Ou un user récupère un vieux hash légitime d'un tiers vu sur un explorer et le réclame.

**Why it happens:**
Pas de contrainte d'unicité forte ; ou unicité par `(user_id, tx_hash)` au lieu de `tx_hash` global → le même hash crédite plusieurs comptes.

**How to avoid:**
- **`UNIQUE` sur `tx_hash` GLOBAL** (pas par user) en DB — un hash ne crédite qu'une fois, jamais. Même discipline upsert idempotent que l'ingestion.
- L'insertion `payments(pending)` par l'user se heurte à la contrainte unique si déjà soumis → refus propre.
- Lier la vérif au **destinataire = NOTRE adresse** : un hash de paiement entre tiers ne passera pas le check `to == wallet plateforme`.
- Idempotence de la transition `pending→verified` (re-run du watcher = no-op).

**Warning signs:**
Deux `subscriptions` actives pointant le même `tx_hash` ; comptes activés avec des hash apparaissant déjà ailleurs.

**Phase to address:** Wave 2.

---

### Pitfall 5: Fuite du contenu payant — gating UI sans RLS (AP1)

**What goes wrong:**
On vérifie l'abonnement dans `(member)/layout.tsx` et on laisse `trade_setups`/`analyses` en `select using(true)`. Le front lit avec l'**anon-client** : un appel direct (devtools, `supabase-js` en console, script) contourne le layout et **aspire tous les signaux** → le produit payant fuit gratuitement. C'est la fuite directe du revenu.

**Why it happens:**
On croit que la porte du layout suffit ("la page n'est pas accessible"). On oublie que la couche données est interrogeable directement avec la clé anon publique.

**How to avoid:**
- RLS `using ( public.has_active_subscription() )` sur `trade_setups` ET `analyses` (remplace la policy `select to authenticated using(true)` de 0006). Helper `security definer`, `search_path` figé (anti-injection schéma, anti-récursion de policy).
- **Layout = UX (redirige /pricing) ; RLS = sécurité (refuse les lignes).** Défense en profondeur, jamais l'un sans l'autre.
- Test Playwright/RLS : user sans abonnement actif lit `trade_setups` via anon-client direct → **0 ligne** (répliquer le pattern du journal privé déjà testé).

**Warning signs:**
Aucune policy modifiée sur trade_setups en migration ; test "non-abonné lit 0 signal" absent ; signaux visibles en réponse API à un compte expiré.

**Phase to address:** Wave 2 (RLS signaux migrée AVANT toute exposition de l'espace membre).

---

### Pitfall 6: Activer l'abonnement sans vérif on-chain serveur / faire confiance au client (AP2)

**What goes wrong:**
Une server action insère `subscriptions(active)` ou laisse l'utilisateur écrire `payments.status='verified'`. N'importe qui colle un faux hash (ou édite la requête) → accès gratuit.

**Why it happens:**
Frontière producteur mal étendue : on traite l'écriture de paiement comme une écriture utilisateur ordinaire.

**How to avoid:**
- RLS `payments` : l'user ne peut insérer QUE `status='pending'` à son nom (`with check user_id=auth.uid() and status='pending'`). **Aucune** policy update/insert `verified`/`active` pour `authenticated`.
- Transition `pending→verified` + `subscriptions(active)` = **service_role uniquement**, dans le Route Handler `nodejs` server-only après vérif TronGrid stricte (contrat + montant + destinataire + confirmations + hash unique).
- Comparaison d'adresses TRON en **format normalisé** : les topics renvoient du hex (`41…`), notre wallet est en base58 (`T…`) → convertir (`tron-format-address`) avant comparaison, sinon faux négatif systématique OU comparaison qui passe à côté.

**Warning signs:**
Import du service-client hors de l'allowlist lint (`app/api/payments/**`) ; activation sans appel TronGrid dans la trace ; policy `payments` permettant `verified` à `authenticated`.

**Phase to address:** Wave 2.

---

### Pitfall 7: Fenêtre d'expiration de l'offre + sous/sur-paiements ignorés

**What goes wrong:**
Le prix affiché (9 $ / 3 $) est fixé à l'instant T mais la TX arrive heures/jours plus tard ; ou l'user paie 8.5 (sous-paiement), 12 (sur-paiement), ou pour la mauvaise offre. Sans règle, soit on rejette des paiements de bonne foi (clients furieux), soit on suractive.

**Why it happens:**
Pas de modèle d'**intention de paiement** (montant dû figé + fenêtre de validité) ; comparaison binaire `montant == dû`.

**How to avoid:**
- Modéliser une **intention** : `payments(expected_amount, offer, created_at)`. Tolérance explicite : `montant >= dû` active (sur-paiement = crédit/ignoré, jamais un rejet) ; `montant < dû` → file superadmin (résolution manuelle : compléter ou rembourser).
- Pas de "fenêtre d'expiration" qui invalide un vrai paiement reçu : le prix est stable, une TX confirmée correspondant à une offre active crédite cette offre. Documenter la politique sur/sous-paiement côté produit.
- Tous les cas tordus (mauvais montant, mauvais réseau, sous-paiement) → **file de validation superadmin**, jamais un rejet silencieux qui perd l'argent du client.

**Warning signs:**
Plaintes "j'ai payé mais pas activé" ; paiements rejetés sans trace ; aucune file superadmin pour les cas partiels.

**Phase to address:** Wave 2 (modèle payments + file superadmin).

---

### Pitfall 8: Vendre des signaux = conseil en investissement non agréé + statut crypto Algérie/MENA (BLOQUANT avant 1er encaissement)

**What goes wrong:**
On encaisse des abonnements pour des **signaux** (entrée/SL/TP/levier) auprès d'un public non averti → exposition réelle au régime du **conseil en investissement non agréé**. En parallèle, l'**Algérie interdit légalement les cryptomonnaies** (loi de finances 2018) et plusieurs pays MENA ont un statut restrictif/flou → encaisser en USDT sur un wallet local est un risque structurel (pas juste un disclaimer manquant).

**Why it happens:**
On traite le légal comme une checkbox UI ("ajouter un disclaimer") au lieu d'un **bloquant structurel** (statut juridique, juridiction d'exploitation, nature du service). Un disclaimer générique copié-collé offre une protection minimale et peut même aggraver la responsabilité.

**How to avoid:**
- **Revue juridique réelle AVANT d'encaisser le 1er abonnement** (contrainte PROJECT.md) : juridiction d'exploitation, structure, statut crypto par pays cible (Algérie en tête), périmètre "éducatif" vs "conseil".
- **Signaux génériques, jamais personnalisés** : aucune recommandation tenant compte de la situation d'un utilisateur précis (le "personnalisé" bascule clairement en activité régulée). Le produit livré est déjà générique (setups en base) — préserver ça, pas de "que dois-je acheter avec mon capital ?".
- **Disclaimers rédigés par un juriste**, systématiques sur vitrine + espace membre + Telegram : contenu éducatif, pas de conseil personnalisé, **aucune promesse de gain**, risque de perte total.
- Aucune communication marketing du type "devenez riche", "95 % de réussite garanti", performances présentées comme reproductibles.

**Warning signs:**
Date d'encaissement planifiée sans revue juridique signée ; copy marketing promettant des gains ; fonctionnalité "conseil personnalisé"/"que faire de mon argent" ; disclaimer générique non revu.

**Phase to address:** Wave 2 (BLOQUANT parallèle, hors code) — gate de lancement. Disclaimers techniques posables dès Wave 1.

---

### Pitfall 9: Rôle dans le JWT cru sans revérification DB (élévation de privilège, AP3)

**What goes wrong:**
On stocke `role` dans `app_metadata`/JWT et on gate dessus. Désync token↔DB (rétrogradation non propagée), révocation difficile, et `getSession()` serveur n'est PAS revérifié → un token stale conserve `superadmin`/accès affilié.

**Why it happens:**
Le JWT semble pratique ("le rôle est déjà dans la session"). On confond `getSession()` (cookie, non revérifié) et `getUser()` (revérifié serveur).

**How to avoid:**
- `role` = source unique sur `profiles` (migration 0008), lu serveur **après `getUser()`**, jamais dans le JWT.
- RLS via helpers `is_superadmin()`/`has_active_subscription()` `security definer` — la DB tranche, pas le client.
- `getUser()` partout côté serveur (jamais `getSession()` pour une décision d'accès) — invariant du middleware existant à préserver.

**Warning signs:**
`role` écrit en app_metadata ; gating basé sur un claim de token ; usage de `getSession()` dans un gate.

**Phase to address:** Wave 1 (`profiles.role` + `lib/auth/gate.ts` + helpers RLS).

---

### Pitfall 10: Fraude d'affiliation + double comptage / commissions sur abonnés expirés

**What goes wrong:**
Auto-parrainage (l'affilié s'abonne via son propre code), faux abonnés (comptes jetables abonnés puis remboursés/expirés), **double comptage** d'une commission récurrente si le job se relance, commissions calculées sur des abonnés **déjà expirés**, et **fuite de PII des filleuls** (l'affilié voit l'email de ses referrals).

**Why it happens:**
Calcul de commission non idempotent ; "abonné ramené" compté sur l'existence du referral, pas sur l'abonnement **actif au moment de la période** ; table `referrals` exposant des colonnes sensibles via RLS.

**How to avoid:**
- **Idempotence stricte** : `commissions` UNIQUE sur `(affiliate_id, referral_id, period)` → re-run du job = no-op (cohérent runner `job_runs`).
- Commission = **20 % max des abonnés ACTIFS sur la période** (`subscriptions.status='active' AND expires_at>période`), jamais sur un referral historique inactif.
- Anti auto-parrainage : refuser `referred_user_id == affiliate.user_id` ; détecter les patterns (même IP/wallet, abonnements remboursés rapidement).
- **1 seul niveau, pas de MLM/sous-affiliés** (apparence pyramidale = risque légal/réputation).
- **PII filleuls** : la table `referrals` ne porte AUCUNE colonne exploitable (pas d'email). L'affilié voit des **compteurs/alias**, jamais l'identité (AP6). Tester l'isolation cross-affilié (un affilié ne voit pas les referrals d'un autre).

**Warning signs:**
Commission qui double après un re-run ; commissions dues sur des abonnements expirés ; affilié pouvant requêter l'email d'un filleul ; referral où `affiliate.user_id == referred_user_id`.

**Phase to address:** Wave 4 (affiliation : tables + `commission-calc` job + RLS scoped).

---

### Pitfall 11: i18n/RTL posé après coup → refactor massif (AP4)

**What goes wrong:**
On construit la vitrine en `ml-*`/`pl-*`/`text-left`/`left-*` puis on "ajoute l'arabe". RTL inverse tout (marges, paddings, alignements, icônes/flèches directionnelles) → refactor global coûteux. Et le contenu DB (articles, raisonnement des signaux) reste non traduit.

**Why it happens:**
RTL traité comme une feature tardive au lieu d'une contrainte transverse. Confusion entre i18n des **strings UI** et i18n du **contenu DB**.

**How to avoid:**
- Poser `[locale]` + `<html dir={ar?'rtl':'ltr'}>` + **propriétés logiques Tailwind v4 natives** (`ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start/end`) **dès la première page**. Variants `rtl:`/`ltr:` pour les exceptions (flèches). NE PAS installer `tailwindcss-rtl` (abandonné, incompatible v4).
- **Séparer les deux mécanismes** : strings UI → `messages/{ar,en,fr}.json` (next-intl) ; contenu DB → colonne `locale` + une ligne par langue (`articles(slug, locale)`).
- **Mélange LTR dans RTL** : prix/symboles/nombres/dates restent LTR au sein d'un paragraphe arabe → utiliser `dir="ltr"` ou `<bdi>` autour des montants (`9 USDT`, dates, TxID), sinon affichage cassé ("USDT 9" inversé, signes mal placés). Formatage via `Intl`/next-intl ICU (pluriels arabes).
- Traduction **humaine relue** des chaînes finance (pas d'auto-traduction machine — anti-feature).

**Warning signs:**
Classes `ml/mr/pl/pr/left/right` dans le nouveau code ; prix affichés à l'envers en arabe ; `tailwindcss-rtl` dans package.json ; contenu DB sans colonne `locale`.

**Phase to address:** Wave 1 (i18n + RTL = tout premier socle, avant toute UI publique).

---

### Pitfall 12: Track record / % de réussite non mesuré, sur-ajusté, ou échantillon insuffisant

**What goes wrong:**
On affiche un win rate "75 %" non mesuré, ou un backtest **sur-ajusté** (look-ahead, paramètres optimisés a posteriori), ou un % sur 5 trades présenté comme fiable. Cela ruine la Core Value ("jamais inventé") ET ajoute un risque légal (promesse implicite).

**Why it happens:**
Pression marketing d'afficher un beau chiffre ; confusion backtest vs résultats réels ; pas de seuil d'échantillon minimal.

**How to avoid:**
- % affiché = **toujours mesuré** : Wave 3 → win rate backtesté des patterns (méthode + taille d'échantillon affichées), puis track record réel (`prediction_outcomes`) qui prend le relais. Distinguer **clairement backtest vs réel** dans l'UI.
- Réutiliser les **constantes anti look-ahead** déjà livrées (P1, 16/16 golden) dans le backtest des patterns — ne pas réintroduire de fuite temporelle.
- **Seuil d'échantillon** : sous un minimum, afficher "échantillon en construction", pas un pourcentage. Montrer aussi les pertes (crédibilité).
- `outcome-tracker` compare les setups expirés au **prix réel** (candles déjà en base) → `prediction_outcomes`/`pattern_stats`, idempotent par `setup_id`.

**Warning signs:**
% affiché sans source ni taille d'échantillon ; backtest sans garde-fou temporel ; win rate sur quelques trades ; pas de séparation backtest/réel à l'écran.

**Phase to address:** Wave 3 (track record + % vitrine) — alimente Wave 3 Telegram.

---

### Pitfall 13: Fiabilité 24/7 — routines Claude Max non garanties pour une plateforme payante

**What goes wrong:**
Le moteur tourne via routines Claude Max (PC du fondateur potentiellement éteint, quota Max non garanti). Pour des abonnés payants, **pas de nouveaux signaux** = produit perçu comme mort, churn, remboursements. Migration tardive vers l'API = précipitation.

**Why it happens:**
On garde le mode "coût zéro" trop longtemps après le lancement payant. Le scheduling local (Windows Task Scheduler) ne suffit plus pour un SLA implicite.

**How to avoid:**
- Au **lancement payant**, migrer la source de raisonnement agent Max → `@anthropic-ai/sdk` (le contrat JSON §3 + `persist.ts` + garde-fous restent INCHANGÉS — seule l'invocation change) + scheduling **cloud** (GitHub Actions cron / worker croner / Supabase pg_cron). Jobs déjà idempotents → migration sans risque de double-exécution.
- Garder Windows Task Scheduler comme **backup d'ingestion déterministe** (candles/news/macro restent frais même sans moteur IA) ; afficher l'état via `job_runs` + flag `stale` au dashboard.
- Budgéter le coût API (passage de "0 token" à facturation, prompt caching sur le system prompt stable).

**Warning signs:**
Abonnés payants alors que le moteur dépend encore du PC/Max ; trous dans la publication des signaux ; pas de monitoring `job_runs` exposé.

**Phase to address:** Wave 5 (migration moteur + scheduling cloud), déclenchée AVANT/au lancement payant.

---

### Pitfall 14: Sécurité webhook processeur (étage 2) — signature, corps brut, runtime, idempotence (AP5)

**What goes wrong:**
Le webhook Cryptomus est traité en **Edge runtime** (pas de `crypto` Node ni corps brut) ; ou la signature est vérifiée sur l'objet **re-sérialisé** (l'ordre des clés change le hash → échec ou bypass) ; ou pas d'idempotence (rejeu webhook = double activation) ; ou aucun filtrage IP. Résultat : activation frauduleuse ou doublée = perte directe.

**Why it happens:**
Réflexe Route Handler par défaut (Edge) ; on vérifie la signature sur `await req.json()` au lieu du corps brut.

**How to avoid:**
- `export const runtime = 'nodejs'` + `const raw = await req.text()` → vérifier la signature sur le **corps BRUT** : Cryptomus = `md5( base64(json_brut) + PAYMENT_API_KEY )` comparé au champ `sign`.
- **Idempotence** sur `order_id`/`uuid` (rejeu = no-op).
- **Whitelist IP** du provider en complément de la signature.
- Mêmes garde-fous montant/destinataire qu'à l'étage 1.

**Warning signs:**
Webhook sans `runtime='nodejs'` ; signature calculée sur l'objet parsé ; pas de contrainte unique sur `order_id` ; activation sur webhook non signé.

**Phase to address:** Wave 5 (processeur étage 2).

---

### Pitfall 15: Payout commissions on-chain — clé privée exposée / pertes irréversibles

**What goes wrong:**
Automatiser tôt le paiement des commissions affiliées en crypto → clé privée du wallet de payout en DB/code/env mal protégé, un bug = envoi de fonds réels irréversible (mauvais montant, mauvais destinataire, boucle).

**Why it happens:**
Envie d'automatiser le payout ; clé chaude nécessaire pour signer/broadcast (TronWeb).

**How to avoid:**
- **Payout MANUEL** validé en superadmin au lancement (calcul auto du dû, paiement humain tracé `commissions.status=paid`). Anti-feature explicite.
- Si auto plus tard : TronWeb dans un **job isolé**, clé privée en **secret manager** (JAMAIS DB/code — contrainte PROJECT.md), montant/destinataire re-validés, idempotence stricte, plafond par run.
- Cold wallet pour les fonds, watcher en lecture seule pour la réception.

**Warning signs:**
Clé privée trouvée en env/DB/code ; payout automatique sans plafond ni idempotence ; aucune validation humaine sur les sorties de fonds.

**Phase to address:** Wave 5 (reporté ; manuel dès Wave 4).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Vérif paiement manuelle (file superadmin) au lieu du processeur | Lance le cash sans dépendance tierce | File sature vers ~1k abonnés (goulot ARCHITECTURE.md) | OUI au MVP (étage 1) — migrer étage 2 quand ingérable |
| Payout commissions manuel | Zéro risque de fuite de fonds | Travail opérateur croissant | OUI jusqu'à confiance opérationnelle + volume |
| Gating UI seul, RLS "plus tard" | UI livrée vite | **Fuite directe du revenu** | **JAMAIS** — RLS signaux dès Wave 2 |
| `role` dans le JWT | Pas de requête DB | Élévation de privilège, désync | **JAMAIS** — `profiles.role` + getUser() |
| i18n/RTL après la vitrine | Vitrine livrée plus tôt | Refactor UI global | **JAMAIS** — poser dès Wave 1 |
| % de réussite non mesuré "provisoire" | Beau chiffre marketing | Casse Core Value + risque légal | **JAMAIS** — mesuré ou "en construction" |
| Disclaimer générique copié | Page "conforme" rapidement | Protection minimale, peut aggraver la responsabilité | **JAMAIS avant encaissement** — revue juriste |
| Unicité hash par `(user,hash)` | Simple | Même hash crédite plusieurs comptes | **JAMAIS** — UNIQUE global sur `tx_hash` |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| TronGrid | Vérifier destinataire+montant sans le contrat émetteur | Exiger contrat USDT officiel `TR7NH…Lj6t` ; refuser tout autre token |
| TronGrid | Lire montant avec 18 decimals (ERC-20) | 6 decimals, BigInt atomique ×10^6 |
| TronGrid | Activer sur TX non confirmée | `only_confirmed:true` (walletsolidity) + `payment-watcher` re-vérif |
| TronGrid | Comparer adresse hex (topics `41…`) à base58 (`T…`) | Normaliser via `tron-format-address` avant comparaison |
| TronGrid | Pas de clé API → rate limit | Header `TRON-PRO-API-KEY` (gratuit) + p-retry/p-limit existants |
| Cryptomus webhook | Signature sur objet re-sérialisé / Edge runtime | `runtime='nodejs'`, corps brut `req.text()`, MD5(base64(json)+key), IP whitelist |
| Telegram (grammY) | Spam → rate limit (~1 msg/s/canal) | p-limit + idempotence `telegram_posts(outcome_id)` ; pas de webhook (publication only) |
| Telegram MarkdownV2 | Échappement strict → messages cassés/rejetés | Échapper ou `parse_mode:'HTML'` ; tester les caractères spéciaux/arabe |
| Anthropic SDK | Réécrire le contrat JSON en migrant | Changer SEULEMENT l'invocation ; `persist.ts`/Zod/scoring inchangés ; prompt caching |
| next-intl middleware | Mauvais ordre (session avant locale) | Chaîner : locale (next-intl) → capture `?ref` → `updateSession()` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `has_active_subscription()` appelée à chaque lecture de signal | Lenteur liste signaux | Index `subscriptions(user_id, status, expires_at)` + cache statut au RSC (revalidate court) | ~1k-10k abonnés |
| File de validation paiement manuelle | Backlog superadmin, activations lentes | Migrer processeur étage 2 (webhooks) | ~1k abonnés |
| Telegram publication non batchée | Rate limit 1 msg/s atteint | Batcher / espacer via p-limit | Beaucoup de clôtures/jour |
| `pattern_stats`/win rate recalculé à la volée | Vitrine lente | Vue matérialisée / job pré-calcule | 10k+ visiteurs |
| Re-pull on-chain de tous les pending à chaque run | Rate limit TronGrid | Borner aux pending récents, p-limit | Volume de paiements en attente |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Activer sur faux token "USDT" / screenshot | Accès gratuit, perte de revenu | Contrat officiel exact + vérif on-chain, jamais screenshot |
| RLS signaux absente (gating UI seul) | Fuite totale du produit payant | RLS `has_active_subscription()` sur trade_setups/analyses |
| `verified`/`active` écrit par l'anon-client | Auto-activation frauduleuse | Seul service_role transitionne ; user n'écrit que `pending` |
| `role` dans JWT | Élévation de privilège | `profiles.role` + getUser() + RLS `is_superadmin()` |
| Service-client importé hors allowlist web | Bypass de la double barrière | Lint allowlist `app/api/payments|webhooks/**` + `server-only` + revue sécu |
| Clé privée wallet en DB/code/env | Vol de fonds irréversible | Cold wallet + watcher lecture seule ; payout manuel ; secret manager si auto |
| PII filleul exposée à l'affilié | Fuite de données inter-users | `referrals` sans colonne sensible ; affilié voit alias/compteurs |
| Webhook sans signature/IP | Activation frauduleuse | Signature corps brut + idempotence + IP whitelist |
| Helper RLS sans `search_path` figé | Injection de schéma / récursion policy | `security definer set search_path = public` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Réseau de paiement ambigu (TRC-20 non explicite) | User paie sur le mauvais réseau, fonds perdus | Réseau TRC-20 affiché en grand + QR + adresse copiable 1 tap |
| Échec sec pendant les confirmations | Panique "j'ai perdu mon argent" | Message "confirmation en cours ~1-2 min", statut visible |
| Prix/dates inversés en arabe (RTL) | Montants illisibles, perte de confiance | `<bdi>`/`dir=ltr` + Intl autour des nombres/devises |
| Expiration d'abonnement sans préavis | Coupure surprise, churn | Date visible + relance J-3/J-0 (Telegram/email) |
| Jargon en première lecture du signal | Public non technique perdu | Explication simple d'abord, approfondi dépliable (déjà prévu) |
| Win rate sans contexte d'échantillon | Méfiance / sentiment d'arnaque | Méthode + taille d'échantillon + pertes montrées |

## "Looks Done But Isn't" Checklist

- [ ] **Vérif paiement :** souvent manque la vérif du **contrat USDT exact** — vérifier que `contract_address == TR7NH…Lj6t`.
- [ ] **Vérif paiement :** souvent manque `only_confirmed`/anti-réorg — vérifier que les non-solidifiées restent `pending`.
- [ ] **Hash :** souvent UNIQUE par user au lieu de global — vérifier `UNIQUE(tx_hash)` global + test double-compte.
- [ ] **Decimals :** souvent oublié 6 vs 18 — test montants limites (9.00/8.99/9.01).
- [ ] **Gating signaux :** souvent gating UI sans RLS — test "non-abonné lit 0 signal via anon-client".
- [ ] **Abonnement expiré :** souvent lit encore les signaux — test `expires_at` passé → 0 ligne.
- [ ] **Rôle :** souvent dans le JWT — vérifier lecture `profiles.role` après getUser().
- [ ] **Affiliation :** souvent commission non idempotente — test re-run job = même total.
- [ ] **Affiliation :** souvent PII filleul exposée — test affilié ne voit pas l'email.
- [ ] **RTL :** souvent classes `ml/mr/left/right` résiduelles — grep le nouveau code.
- [ ] **RTL :** souvent prix/dates inversés — revue visuelle arabe sur montants.
- [ ] **% réussite :** souvent sans source/échantillon — vérifier méthode affichée + seuil min.
- [ ] **Légal :** souvent disclaimer générique — vérifier revue juriste signée AVANT encaissement.
- [ ] **Webhook (étage 2) :** souvent Edge/objet re-sérialisé — vérifier `nodejs` + corps brut + idempotence.
- [ ] **Moteur 24/7 :** souvent dépend encore du PC/Max — vérifier scheduling cloud + monitoring `job_runs`.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Faux token activé | MEDIUM | Audit des activations vs réception cold wallet ; révoquer abonnements sans dépôt réel ; ajouter check contrat |
| Fuite signaux (RLS absente) | HIGH | Ajouter RLS immédiatement ; supposer le contenu compromis ; auditer logs d'accès anon ; rotation éventuelle de clé anon si abus |
| Double commission | LOW-MEDIUM | Job de réconciliation idempotent ; ajuster `commissions` ; ajouter UNIQUE rétroactif |
| Rôle JWT exploité | MEDIUM | Migrer vers `profiles.role` ; invalider sessions ; audit des accès admin |
| RTL refactor tardif | HIGH | Migration globale `ml→ms` etc. ; coûteux — d'où "poser tôt" |
| % non mesuré publié | MEDIUM (réputation) | Retirer le chiffre ; remplacer par mesuré/"en construction" ; communiquer la méthode |
| Légal non couvert avant cash | HIGH/CRITIQUE | Stopper l'encaissement ; revue juridique ; rembourser si nécessaire ; restructurer |
| Clé privée exposée | CRITIQUE | Vider le wallet vers un nouveau cold wallet immédiatement ; rotation ; post-mortem |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase (wave) | Verification |
|---------|-------------------------|--------------|
| 1. Faux token USDT | W2 paiement | Test : TX d'un contrat ≠ officiel → rejet |
| 2. Decimals 6 | W2 paiement | Tests golden montants limites |
| 3. Confirmations/réorg | W2 paiement+watcher | Test : non-solidifiée → pending, pas d'activation |
| 4. Rejeu hash | W2 paiement | Test : même hash 2 comptes → 1 seul crédit |
| 5. Fuite signaux (RLS) | W2 gating | Test RLS non-abonné → 0 ligne |
| 6. Activation sans vérif serveur | W2 paiement | Test : user ne peut écrire que pending |
| 7. Expiration offre / sous-paiement | W2 paiement | Test sur/sous-paiement → crédit/file |
| 8. Légal conseil non agréé + crypto MENA | W2 (bloquant parallèle) | Revue juriste signée avant 1er encaissement |
| 9. Rôle JWT (privilège) | W1 role/gate | Test : token stale ne donne pas admin |
| 10. Fraude/double commission affiliation | W4 affiliation | Test idempotence + isolation PII cross-affilié |
| 11. i18n/RTL tardif | W1 socle | Grep `ml/mr/left/right` ; revue visuelle arabe |
| 12. % non mesuré/sur-ajusté | W3 track record | Méthode + échantillon affichés ; anti look-ahead |
| 13. Fiabilité 24/7 moteur | W5 (avant lancement payant) | Scheduling cloud + `job_runs` exposé |
| 14. Sécurité webhook étage 2 | W5 processeur | Test signature corps brut + idempotence |
| 15. Payout on-chain clé privée | W5 (manuel dès W4) | Aucune clé privée en DB/code ; payout tracé |

## Sources

- ARCHITECTURE.md v2.0 (anti-patterns AP1-AP6, frontière producteur étendue, modèle RLS multi-rôles, build order par waves) — repo, **HIGH** (source primaire projet)
- STACK.md v2.0 (TronGrid `only_confirmed`, decimals 6, contrat USDT, Cryptomus signature MD5 corps brut, runtime nodejs, RTL natif Tailwind v4, libs à éviter) — **HIGH**
- FEATURES.md v2.0 (anti-features : garantie de gains, processeur dès lancement, payout auto, MLM, custody ; % mesuré jamais inventé) — **HIGH**
- PROJECT.md (légal renforcé post-pivot : conseil non agréé + interdiction crypto Algérie ; clés jamais en DB/code ; revue légale avant 1er encaissement) — **HIGH**
- [CryptoTimes — fake USDT detection](https://www.cryptotimes.io/learn/fake-usdt-what-it-is-how-to-detect-it/), [Cubex — spot fake USDT transactions](https://getcubex.co/ways-to-spot-fake-usdt-transactions/), [imToken — fake transaction record scam](https://support.token.im/hc/en-us/articles/17009391596697-Be-wary-of-the-fake-transaction-record-scam), [AML Crypto — check USDT TRC20](https://medium.com/@AMLCrypto/how-to-check-usdt-trc20-transaction-for-purity-and-risks-6ad1c13da3bc) — faux token TRC-20, zero-value/fake transfer, screenshots non fiables, contrat officiel `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` — **HIGH** (consensus multi-sources)
- [Adam Tracy — crypto signal regulation](https://adamtracy.io/2023/05/30/crypto-trade-signal-regulation/), [Finance n Investments — financial advice disclaimer](https://financeninvestments.com/financial-advice-disclaimer/) — signaux personnalisés = activité régulée ; disclaimer générique = protection minimale, juriste requis — **MEDIUM** (peu de sources MENA-spécifiques ; régime crypto Algérie depuis PROJECT.md)

---
*Pitfalls research for: v2.0 plateforme publique payante (paiement crypto on-chain, gating multi-rôles, affiliation, i18n RTL, Telegram, CMS, track record) — pièges argent/sécurité du revenu/légal priorisés*
*Researched: 2026-06-14*
