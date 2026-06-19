# Phase 8: Superadmin consolidé (signaux, santé, affiliés) - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Compléter le back-office FR superadmin (`apps/web/src/app/(admin)`, hors `[locale]`, `requireRole('superadmin')`) avec la visibilité opérationnelle et le pilotage affiliés. Couvre **ADMIN-03** (voir affiliés + perfs, gérer payouts de commissions) et **ADMIN-04** (voir signaux publiés + santé jobs/données).

Le neuf réel de cette phase = (1) un **shell admin consolidé** (les pages actuelles sont isolées, sans nav commune), (2) une **vue Signaux publiés**, (3) une **vue Santé jobs/données**, (4) l'**enrichissement du workflow payout** (page payouts déjà posée en phase 7).

**Ce n'est PAS dans cette phase** (nouvelles capacités → autres phases) : CMS/articles (Phase 9), notifications/alerting automatique sur stale, modification des signaux/setups depuis l'admin, paiement automatisé des payouts on-chain.
</domain>

<decisions>
## Implementation Decisions

### Shell / navigation back-office
- **D-01:** Consolider les pages admin isolées (`membres`, `file`, `affiliation`, `affiliation/payouts`) sous un **shell avec sidebar persistante** listant : Tableau de bord, Membres, File (validation paiements), Affiliation, Payouts, Signaux, Santé. La sidebar vit dans `(admin)/layout.tsx` (ou un composant client monté par lui), sous le `requireRole('superadmin')` existant.
- **D-02:** Ajouter une **page d'accueil `/admin` (dashboard)** avec cartes KPI de synthèse : membres actifs, file de validation en attente, santé globale des données (ok/stale). C'est la landing du back-office.

### Vue Signaux publiés (ADMIN-04)
- **D-03:** Liste **chronologique des `trade_setups`** avec, par ligne, le **statut de publication Telegram** (posté / échoué / non publié) croisé depuis `telegram_posts`.
- **D-04:** **Filtres** par instrument et par statut. Chaque ligne a un **lien vers le détail** du signal.
- **D-05:** Lecture seule — pas d'édition/suppression de signaux depuis l'admin (hors scope).

### Vue Santé jobs/données (ADMIN-04)
- **D-06:** **Indicateurs feux vert/orange/rouge par source** (fraîcheur candles / news / macro) basés sur les seuils `stale` / la vue de fraîcheur des données.
- **D-07:** **Tableau des derniers `job_runs`** par job : statut (ok/échec), durée, horodatage du dernier run.
- **D-08:** Présentation opérationnelle (lecture rapide) — pas d'alerting/notification automatique (hors scope, déféré).

### Pilotage payouts affiliés (ADMIN-03)
- **D-09:** **Enrichir** le workflow payout manuel existant : marquer une commission **'payée'** avec une **référence de transaction** saisie, et conserver un **historique des payouts**.
- **D-10:** Action mutative côté serveur (server action sous `requireRole('superadmin')`), idempotente et auditable — réutiliser les garanties de sécurité posées en phase 7 (attribution/commissions durcies M-01..M-05).

### Claude's Discretion
- Style visuel précis de la sidebar/dashboard (shadcn/ui existant, FR mono-langue) — laissé au design/planner, cohérent avec l'UI back-office actuelle.
- Choix des seuils exacts orange vs rouge pour la fraîcheur (à dériver de la logique `stale` existante des jobs).
- **À résoudre en research/plan (zone grise non figée volontairement) :** le marquage 'payé' + référence tx requiert-il une **migration DB** (colonne statut payout / table `payouts` ou champ sur `commissions`) ? À investiguer dans le repo `commissions` / `affiliates` + migrations existantes. Si migration nécessaire → suivre la convention de numérotation (prochaine libre après 0015 ; **NB : 0013 est RÉSERVÉE** au cluster re-soumission paiement P4).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & exigences
- `.planning/ROADMAP.md` §"Phase 8: Superadmin consolidé" — goal, depends-on (Phase 7 affiliés, Phase 4 admin minimal), success criteria.
- `.planning/REQUIREMENTS.md` — ADMIN-03 (ligne 64), ADMIN-04 (ligne 65). ADMIN-01/02 (lignes 62-63) déjà livrés en phase 4 (contexte admin).

### Contexte phase 7 (socle direct affiliés/payouts)
- `.planning/phases/07-affiliation-paliers/07-CONTEXT.md` — décisions affiliation (paliers, dashboard sans PII, commissions idempotentes ≤20% sur abonnés actifs).

### Code existant à étendre/consolider
- `apps/web/src/app/(admin)/layout.tsx` — gate `requireRole('superadmin')` + provider FR mono-langue ; point d'ancrage du shell/sidebar.
- `apps/web/src/app/(admin)/affiliation/page.tsx` + `actions.ts` — vue affiliés existante (ADMIN-03 partie 1).
- `apps/web/src/app/(admin)/affiliation/payouts/page.tsx` + `actions.ts` — page payouts à enrichir (D-09/D-10).
- `apps/web/src/app/(admin)/membres/page.tsx` + `file/page.tsx` — pages à rattacher au shell (pattern de page admin établi).

### Repositories data (lecture des vues phase 8)
- `packages/supabase/src/repositories/tradeSetups.ts` — source signaux.
- `packages/supabase/src/repositories/telegramPosts.ts` — statut publication Telegram (croisé signaux).
- `packages/supabase/src/repositories/jobRuns.ts` — santé jobs (`job_runs`) + fraîcheur données.
- `packages/supabase/src/repositories/commissions.ts` + `affiliates.ts` — payouts/affiliés.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `(admin)/layout.tsx` : gate superadmin + `NextIntlClientProvider` FR + `Toaster` (sonner) déjà montés → la sidebar et tous les retours d'action s'y branchent sans refaire l'auth.
- Repos prêts à l'emploi : `tradeSetups`, `telegramPosts`, `jobRuns`, `commissions`, `affiliates` → pas de nouvel accès DB brut à écrire, étendre les repos si besoin.
- Pattern de page admin déjà établi (`membres`, `file`, `affiliation`) : `page.tsx` (RSC lecture repo) + `actions.ts` (server actions mutatives sous gate). Reproduire pour `signaux` et `sante`.

### Established Patterns
- Back-office **hors `[locale]`**, mono-FR (D-15 antérieure) — les nouvelles pages restent FR fixe, pas de routing i18n.
- Sécurité défense-en-profondeur : gate layout (`requireRole`) + RLS DB. `profiles.role` jamais dans le JWT. Les server actions payout doivent re-vérifier le rôle.
- `notFound()` (404) pour non-superadmin — ne pas faire fuiter l'existence du back-office (threat T-04-ADMIN-ELEV).

### Integration Points
- Sidebar nouvelle ↔ toutes les routes `(admin)/*` existantes + nouvelles (`/admin` dashboard, `/admin/signaux`, `/admin/sante`).
- Vue Signaux ↔ jointure logique `trade_setups` × `telegram_posts`.
- Vue Santé ↔ `job_runs` + vue/flag de fraîcheur (`stale`).
- Payout enrichi ↔ `commissions`/`affiliates` (éventuelle migration DB statut payout — voir D-10 discretion).

</code_context>

<specifics>
## Specific Ideas

- Dashboard d'accueil = 3 cartes KPI minimum : membres actifs, file de validation en attente, santé globale données (feu ok/stale).
- Santé : sémantique "feux" explicite (vert = frais, orange = limite, rouge = stale) plutôt que tableau brut.
- Payout : la "référence de transaction" est une saisie manuelle (le superadmin paie hors-plateforme puis enregistre la preuve) — cohérent avec le mode manuel/testnet du projet.

</specifics>

<deferred>
## Deferred Ideas

- **Alerting/notifications automatiques** sur données stale ou job en échec (email/Telegram admin) — capacité à part, hors ADMIN-04 (qui est de la *visibilité*). Future phase ops.
- **Paiement on-chain automatisé des payouts** — hors scope ; phase 8 reste sur marquage manuel + référence tx.
- **Édition/modération des signaux depuis l'admin** — lecture seule en phase 8.
- **Export CSV des payouts** — proposé puis écarté au profit de l'historique in-app ; réenvisageable plus tard si besoin de traitement externe.

</deferred>

---

*Phase: 8-Superadmin consolidé (signaux, santé, affiliés)*
*Context gathered: 2026-06-19*
