---
status: passed
phase: 20-dashboard-superadmin-cockpit-4-axes
source: [20-01-SUMMARY.md, 20-02-SUMMARY.md, 20-03-SUMMARY.md, 20-04-SUMMARY.md, 20-05-SUMMARY.md, 20-06-SUMMARY.md]
started: 2026-06-26T22:25:28Z
updated: 2026-06-28T01:15:00Z
result: 11/11 passed (2 fix bloquants + 1 fix UX appliqués pendant l'UAT)
---

## Current Test

number: —
name: UAT terminée
expected: |
  Les 11 tests sont passés (2026-06-28). 2 fix de blocage débloqués via
  /gsd-debug (route group → /admin littéral ; layout admin <html>/<body>),
  1 fix UX (auto-submit filtres membres). Trous de seed notés (affiliation).
awaiting: clôture

## Tests

### 1. Cold Start Smoke Test
expected: Couper tout serveur, relancer `pnpm dev` à froid. Le serveur boote sans erreur, et `/admin` (superadmin) charge sans crash avec des données réelles (seed ~10k).
result: [passed] — 2026-06-28. A nécessité 2 fix (commits 52b8c96 + ed5bacb) débloqués via /gsd-debug : (1) route group `app/(admin)` → segment littéral `app/admin` (sinon 404 partout) ; (2) layout admin sans `<html>/<body>` → racine propre ajoutée. Aussi : aucun compte superadmin connectable n'existait → compte `uat-superadmin@nexa.test` créé. Après ça : `GET /admin 200`, cockpit affiché.

### 2. Gating accès cockpit superadmin
expected: Connecté en superadmin, `/admin` affiche le cockpit. Connecté en utilisateur normal (non-superadmin), `/admin` renvoie un 404 discret (jamais le contenu admin, jamais une 403 bavarde).
result: [passed] — 2026-06-28. 3 cas observés : superadmin (uat-superadmin) → GET /admin 200 cockpit ; membre (uat-abonne) → 404 Next.js discret (gate.ts notFound, D-09), jamais de contenu admin ni 403 ; non connecté → 307 vers /fr/login.

### 3. Cockpit home 4 axes + provenance honnête
expected: La home `/admin` montre 4 sections DANS L'ORDRE Revenus → Ops → Acquisition → Conformité. Chaque carte affiche un KPI mesuré + une ligne « Mesuré · N = … · période · source ». MRR libellé « Cash encaissé / mois ». Aucun pourcentage/chiffre inventé.
result: [passed] — 2026-06-28. Confirmé par l'utilisateur : 4 sections dans l'ordre, KPI mesurés + ligne de provenance, MRR = « Cash encaissé / mois », aucun chiffre inventé.

### 4. Sidebar regroupée en 4 axes
expected: La barre latérale admin regroupe les liens sous 4 en-têtes (Acquisition / Revenus / Ops / Conformité). Cliquer chaque lien mène à la bonne page détail (URLs `/admin/...` inchangées), l'item actif est surligné.
result: [passed] — 2026-06-28. Confirmé : sidebar en 4 en-têtes, liens mènent aux bonnes pages /admin/*, item actif surligné.

### 5. Table membres — filtres serveur + pagination keyset
expected: `/admin/membres` liste les membres. Filtrer par statut d'abonnement (active/expirée/aucune), par source (démo/backtest/live) et par recherche email recharge la liste filtrée. Un bouton « Charger la page suivante » ajoute la page suivante (pas de numéros de page). Colonne « source » présente (pas de « dernier paiement »).
result: [passed] — 2026-06-28. Filtrage serveur fonctionnel (statut, source, email), keyset « Charger la page suivante » OK, colonne source présente. Issue UX initiale (selects ne filtraient pas au changement) CORRIGÉE commit 5402f6a (AutoSubmitSelect, form.requestSubmit au onChange) — re-vérifié : filtrage immédiat au changement de select.

### 6. File de paiements — pagination keyset
expected: `/admin/file` liste les paiements paginés par keyset (du plus ancien au plus récent), avec « Charger la page suivante ». L'email du membre s'affiche par ligne.
result: [passed] — 2026-06-28. Confirmé : pagination keyset ancien→récent, « Charger la page suivante », email du membre par ligne.

### 7. Action — Offrir du temps gratuit
expected: Sur une ligne membre, « Offrir du temps gratuit » ouvre un dialog avec presets 7j / 1 mois / 3 mois et CTA « Confirmer la prolongation ». Confirmer affiche un toast de succès ; le bouton est désactivé pendant l'envoi.
result: [passed] — 2026-06-28. Toast succès + bouton désactivé confirmés par l'utilisateur. Vérifié en base : admin_audit_log = 2× grant_subscription_time (actor=uat-superadmin, payload interval=7 days), current_period_end repoussé à ~now+7j (2026-07-05). RPC gated atomique + audit OK.

### 8. Action — Suspendre puis réactiver un compte
expected: « Suspendre ce compte » ouvre une confirmation destructive (motif requis, CTA rouge). Après suspension, le membre suspendu est déconnecté/redirigé vers `/login?suspended=1` à sa prochaine navigation. « Réactiver » rétablit l'accès.
result: [passed] — 2026-06-28. Testé sur uat-abonne : confirmation destructive + motif requis, toast. Déconnexion forcée vers /login?suspended=1 confirmée (incognito). Réactivation OK. Base : audit suspend_account (reason tracé) → unsuspend_account, et profiles.suspended repassé false / reason null.

### 9. Action — Marquer une commission payée (payouts)
expected: `/admin/affiliation/payouts` permet de marquer une commission comme payée (avec hash de transaction). L'action réussit via le RPC gated, affiche un toast, et la commission passe à l'état payé. Aucun double-paiement possible.
result: [passed] — 2026-06-28. NB : domaine affiliation vide au seed (affiliates/commissions/payouts = 0) → page initialement vide (correct). Commission de test `due` créée manuellement pour l'UAT. Validation tx_hash M-03 confirmée (hash non-64-hex rejeté = tx_hash_invalid). Après hash valide 64-hex : commission status=paid, ligne payouts insérée (tx_hash + montant 20000000 = montant commission), via RPC atomique admin_mark_commission_paid. Anti-double-paiement OK (statut paid → bouton retiré).

### 10. Conformité — feu read-only par défaut sûr
expected: La carte/section Conformité affiche un feu piloté par LEGAL_REVIEW_DONE : ROUGE par défaut (revue juridique non signée), plus version + date (« — » si les variables d'env ne sont pas posées). Read-only, aucun lien de drill-down.
result: [passed] — 2026-06-28. Feu ROUGE par défaut (LEGAL_REVIEW_DONE non posé), version/date « — », read-only sans drill-down. Confirmé par l'utilisateur.

### 11. Pages santé / signaux en anon-client
expected: `/admin/sante` affiche la fraîcheur des données (pas faussement rouge). `/admin/signaux` et `/admin/signaux/[id]` s'affichent en LECTURE SEULE (aucun bouton d'édition/création de signal). Toutes chargent sans erreur via RLS superadmin.
result: [passed] — 2026-06-28. /admin/sante fraîcheur OK (pas faussement rouge), /admin/signaux + /admin/signaux/[id] en lecture seule (aucun bouton édition/création), chargent sans erreur. Confirmé par l'utilisateur.

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- **[résolu] GAP-20-A — /admin 404 partout (BLOQUANT)** : route group `app/(admin)` retirait le segment d'URL. Fix commit 52b8c96 (rename `app/(admin)`→`app/admin` + 4 imports alias + 3 garde-fous). Débloqué via /gsd-debug.
- **[résolu] GAP-20-B — /admin sans `<html>/<body>` (BLOQUANT, latent)** : exposé une fois /admin joignable ; admin hors [locale], root layout pass-through. Fix commit ed5bacb (layout admin rend son propre `<html lang="fr"><body>` + polices + ThemeProvider dark).
- **[résolu] GAP-20-C — filtres membres sans auto-submit (UX mineure)** : selects ne filtraient pas au changement. Fix commit 5402f6a (AutoSubmitSelect).
- **[ouvert] GAP-20-D — returnTo après login = `/` au lieu de `/admin`** (cosmétique) : la redirection du gate pose `returnTo=%2F`. Non bloquant. À traiter hors UAT.
- **[ouvert] GAP-20-E — trou de seed affiliation (phase 18)** : tables `affiliates`/`commissions`/`payouts` vides malgré 30 profils rôle `affiliate`. Page payouts vide (correct). Commission de test créée manuellement pour l'UAT Test 9 → **données de test à nettoyer**. Le seed phase 18 devrait peupler la chaîne affiliation.

## Test data à nettoyer (post-UAT)
- Compte `uat-superadmin@nexa.test` (créé pour l'UAT — garder ou supprimer selon besoin futur).
- Commission/affilié de test (period 2026-06, affilié seed-2@demo.nexa.invalid) + ligne payouts associée.
- `uat-abonne@nexa.test` : mot de passe redéfini (`NexaAbonne#2026`), role member intact.
