# Phase 1: Socle transverse — i18n/RTL & rôles/gating - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Poser, AVANT toute UI publique, l'infrastructure transverse réutilisée par toutes les phases suivantes :
1. **Internationalisation** — routing `[locale]` (AR/EN/FR) + bascule RTL pour l'arabe, par propriétés logiques natives Tailwind v4.
2. **Primitive d'accès** — rôle porté par `profiles.role` (jamais dans le JWT) + gating défense-en-profondeur (gate layout UX **et** RLS données), prouvé par test anon-client.

**Couvre :** I18N-01..04, ACCESS-01..04.

**Hors scope (autres phases) :** contenu/visuel de la vitrine (P2), liste/détail des signaux (P3), flux de paiement et écriture des abonnements (P4), design system visuel complet/marque (P2). P1 ne pose que la plomberie transverse + le strict styling nécessaire au RTL.
</domain>

<decisions>
## Implementation Decisions

### i18n — langue par défaut & forme d'URL
- **D-01 :** `localePrefix: 'always'` — toutes les URLs sont préfixées : `/fr/…`, `/en/…`, `/ar/…`. Aucune route sans préfixe de locale.
- **D-02 :** `defaultLocale = 'fr'`. La racine `/` redirige vers `/fr`. Pas de détection Accept-Language automatique au MVP (déterministe ; l'utilisateur change via le sélecteur). La détection automatique pourra être ajoutée plus tard sans casser le routing.
- **D-03 :** Locales supportées = `['fr', 'en', 'ar']`. `ar` déclenche `dir="rtl"` ; `fr`/`en` restent `ltr`. Toutes les chaînes d'interface externalisées via next-intl (aucune chaîne en dur). Le raisonnement IA généré (FR/EN) reste affiché tel quel même en UI arabe (hypothèse v2.0 documentée).

### Gating abonnement — séquençage (ACCESS-04)
- **D-04 :** Créer le **squelette réel** de la table `subscriptions` dès la Phase 1 (nouvelle migration **0009**) afin que `has_active_subscription()` soit une fonction RÉELLE et testable immédiatement (à ce stade personne n'a d'abonnement → tout utilisateur lit 0 setup). La Phase 4 n'ajoutera que l'écriture/vérification de paiement (pas de réécriture de la fonction RLS). **PAS de stub** renvoyant false.
- **D-05 :** `profiles.role` ajouté en migration **0008** (la prochaine — la plus haute existante est 0007). Enum/contrainte des valeurs : `member` (défaut) / `affiliate` / `superadmin`. Lu côté serveur après `getUser()`, jamais via le JWT.
- **D-06 :** Helpers RLS `has_active_subscription()` et `is_superadmin()` en `security definer` avec `search_path` figé. Réutilisent le pattern « journal privé » du cœur v1.0 (lecture `authenticated`, écritures `service_role`). RLS `has_active_subscription()` appliquée sur `trade_setups` et `analyses`.

### Redirections d'accès refusé — funnel & discrétion
- **D-07 :** Utilisateur authentifié SANS abonnement actif atteignant une surface membre (`/[locale]/membre…`) → redirigé vers la page **TARIFS** (`/[locale]/tarifs`, opportunité de conversion), pas vers login.
- **D-08 :** Visiteur NON authentifié atteignant une surface protégée → redirigé vers **login** avec `returnTo` (retour à la page demandée après connexion).
- **D-09 :** Non-superadmin atteignant le back-office `(admin)` → **404** (discrétion : ne révèle pas l'existence de l'admin), pas 403.

### Sélecteur de langue & périmètre styling
- **D-10 :** Sélecteur de langue en **dropdown dans le header**, persistance via cookie next-intl, reste sur la même page (même route, locale changée).
- **D-11 :** P1 pose **Tailwind v4 + primitive RTL minimale uniquement** (propriétés logiques `ms-*`/`me-*`/`start`/`end`, `dir` auto selon locale, `<bdi>`/`Intl` pour prix/nombres/dates). Le design system visuel complet (thème, tokens, marque, composants shadcn étoffés) est **reporté en Phase 2** (vitrine).

### Claude's Discretion
- Choix exact du wiring next-intl (plugin `next-intl/plugin`, structure `messages/{locale}.json`, `i18n/routing.ts`) — pattern standard, doc complète.
- Finalisation du wiring auth fonctionnel (login/signup actuellement squelettes) si nécessaire pour rendre le gating testable de bout en bout.
- Ordre de chaînage du middleware : `next-intl` (locale) → `updateSession()` (déjà en place via `getUser()`). Ordre sensible (cf. recherche ARCHITECTURE).
- Détail de la contrainte SQL sur `profiles.role` (enum natif vs `check`) et du schéma minimal de `subscriptions` (colonnes `user_id`, `status`, `current_period_end`, etc.) — squelette suffisant pour la fonction RLS.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Décisions verrouillées du milestone
- `.planning/STATE.md` § Accumulated Context — décisions D-V2-01..08 héritées (rôle hors JWT, gating défense-en-profondeur, séquençage migrations).
- `.planning/REQUIREMENTS.md` § I18N + § ACCESS — libellés exacts des 8 requirements de la phase.
- `.planning/ROADMAP.md` § Phase 1 — Goal + 4 Success Criteria.

### Recherche v2.0 (stack & pièges)
- `.planning/research/SUMMARY.md` — synthèse (Wave 1 socle transverse, arêtes critiques).
- `.planning/research/STACK.md` — next-intl 4.13, RTL Tailwind v4 natif (PAS tailwindcss-rtl).
- `.planning/research/ARCHITECTURE.md` — segment `[locale]` enveloppant front, `(admin)` HORS `[locale]`, chaînage middleware locale→ref→session, `profiles.role` lu après `getUser()`, helpers `security definer`.
- `.planning/research/PITFALLS.md` — rôle dans JWT (#7), gating UI sans RLS (#5).

### Cœur v1.0 (socle à réutiliser)
- `supabase/migrations/0001_*.sql` — table `profiles` existante (id/email/created_at), RLS `auth.uid()`.
- `supabase/migrations/0006_*.sql` — RLS « journal privé » sur `trade_setups`/`analyses` (lecture `authenticated`, écritures `service_role`) — pattern à étendre avec `has_active_subscription()`.
- `packages/supabase/src/anon-client.ts` — `createBrowserSupabaseClient()` / `createServerSupabaseClient(cookieStore)` (@supabase/ssr 0.12, getAll/setAll).
- `apps/web/src/lib/supabase/middleware.ts` — `updateSession()` (utilise `getUser()`, pas `getSession()`).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`packages/supabase` (clients + 13 repositories + `database.types.ts`)** : ré-générer les types après migrations 0008/0009 (`supabase gen types`). Service-client non ré-exporté (import par chemin direct) — à respecter.
- **`apps/web/src/lib/supabase/middleware.ts` (`updateSession`)** : middleware d'auth déjà en place ; y chaîner next-intl AVANT, sans casser le refresh `getUser()`.
- **Pattern RLS « journal privé » (migration 0006)** : modèle direct pour les politiques de gating (lecture conditionnée, écritures service_role).

### Established Patterns
- **Frontière producteur-unique** : les jobs écrivent (service_role), le front lit (RLS select-only). P1 ne doit PAS introduire d'écriture front sur les setups.
- **Migrations SQL versionnées = source de vérité unique** (pas d'ORM). Prochains numéros : **0008** (role), **0009** (subscriptions).
- **@supabase/ssr getAll/setAll + `getUser()`** (jamais `getSession()` côté serveur) — déjà respecté, à maintenir.

### Integration Points
- `apps/web/src/app/` actuel (`(auth)/login`, `(auth)/signup`, `dashboard`) → à déplacer sous le segment `[locale]`. Le back-office `(admin)` futur reste HORS `[locale]`.
- `apps/web/src/app/layout.tsx` : `<html lang="fr">` codé en dur, aucun `dir` → remplacé par lang/dir dynamiques selon la locale.
- `apps/web/package.json` : ajouter `next-intl` (absent) ; configurer Tailwind v4 (absent : aucun `tailwind.config`, aucun CSS).
</code_context>

<specifics>
## Specific Ideas

- Default FR explicitement choisi par le fondateur (sa langue de travail), malgré la cible MENA arabophone — AR reste pleinement supporté et le contenu généré FR/EN s'affiche tel quel en UI arabe.
- Redirection non-abonné → tarifs : pensée comme levier de conversion du funnel, pas seulement comme un blocage technique.
- 404 (et non 403) pour le back-office : choix de discrétion sécuritaire.
</specifics>

<deferred>
## Deferred Ideas

- **Détection automatique Accept-Language** à la racine `/` — reportée (MVP déterministe avec fallback FR + sélecteur). Ajoutable plus tard sans refonte du routing.
- **Design system visuel complet** (thème, tokens de marque, composants shadcn étoffés) — Phase 2 (vitrine).
- **Traduction arabe du raisonnement IA** — hors scope v2.0 (contenu FR/EN affiché tel quel).
- **Écriture/vérification des abonnements** (paiement, transitions de statut) — Phase 4 ; P1 ne pose que le squelette de table + la fonction RLS de lecture.

None déféré au-delà : la discussion est restée dans le périmètre de la phase.
</deferred>

---

*Phase: 1-Socle transverse — i18n/RTL & rôles/gating*
*Context gathered: 2026-06-14*
