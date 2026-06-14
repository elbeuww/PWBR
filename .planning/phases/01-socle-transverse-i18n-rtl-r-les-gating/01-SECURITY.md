---
phase: 01
slug: socle-transverse-i18n-rtl-r-les-gating
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-14
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verified by gsd-security-auditor (Opus, ASVS L1, block_on: high) — 11/11 threats CLOSED.
> Register authored at plan time (`register_authored_at_plan_time: true`) — mitigations verified, not re-discovered.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| anon-client (clé publique) → Postgres | Un appel direct (devtools/script) franchit cette frontière sans passer par le gate UX. **Seule la RLS tranche.** | Signaux de trading (`trade_setups`, `analyses`), abonnements |
| JWT (claims) → décision d'accès | Le token peut être périmé/forgé ; le rôle ne doit JAMAIS en être déduit. | Identité utilisateur, rôle |
| URL (segment `[locale]`) → résolution serveur | La locale vient de l'URL ; une valeur non supportée ne doit pas casser le rendu. | Locale (fr/en/ar) |
| `returnTo` param → redirect | Valeur contrôlée par l'attaquant — risque open-redirect. | Chemin de redirection post-login |
| `(admin)` existence → visiteur | L'existence du back-office ne doit pas fuiter. | Topologie des routes protégées |
| npm registry → build | Installation de paquets tiers (next-intl, tailwindcss). | Code exécuté au build/runtime |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-01 | Information Disclosure | `trade_setups`/`analyses` via anon-client | mitigate | RLS `for select to authenticated using (public.has_active_subscription())` — `0009_subscriptions_gating.sql:87-97` (remplace l'ancien `using(true)` de `0006:38-41,78-81`). Non-abonné → 0 ligne. | closed |
| T-01-02 | Elevation of Privilege | `profiles.role` | mitigate | `role` = colonne DB (`0008:20-22`), jamais JWT. `is_superadmin()` lit `public.profiles` après `auth.uid()` (`0008:36-41`) ; `requireRole` lit `profiles.role` après `getUser()` (`gate.ts:99-109`). Aucune policy UPDATE sur profiles. | closed |
| T-01-03 | Tampering / EoP | Helpers RLS (`has_active_subscription`, `is_superadmin`) | mitigate | `security definer set search_path = public` (`0008:33-34`, `0009:67-68`, `0010:20-21`) ; tables en `public.xxx` ; `revoke execute from public, anon` + `grant to authenticated` (`0008:46-47`, `0009:79-80`). | closed |
| T-01-04 | Information Disclosure | `subscriptions` cross-user | mitigate | SELECT `using (user_id = auth.uid())` (`0009:41-44`) + superadmin-voit-tout (`0009:47-50`) ; aucune policy write pour `authenticated` (`0009:52`). | closed |
| T-01-05 | Input Validation / DoS | locale depuis l'URL | mitigate | `hasLocale(routing.locales, requested)` valide avant rendu, fallback `routing.defaultLocale` (`request.ts:13-15`). | closed |
| T-01-06 | Spoofing | `gate.ts` décision d'accès | mitigate | `getUser()` à chaque frontière serveur (`gate.ts:65`, `middleware.ts:47`, `dashboard/page.tsx:24`), jamais `getSession()` (présent en commentaire uniquement). | closed |
| T-01-07 | Open Redirect | `returnTo` (requireUser/signIn) | mitigate | `safeReturnTo()` (`gate.ts:32-51`) : décode, normalise `\`→`/`, rejette non-`/`, `//`, et schémas `^[a-z][a-z0-9+.-]*:` ; fallback `/`. Réutilisé par `signIn` (`actions.ts:18,76`). | closed |
| T-01-08 | Information Disclosure | `(admin)` enumeration | mitigate | `requireRole('superadmin')` → `notFound()` (404, pas 403) (`gate.ts:110-111`), appliqué `(admin)/layout.tsx:10`. | closed |
| T-01-09 | Information Disclosure | flash de contenu gated | mitigate | Gate au RSC layout avant rendu : `(member)/layout.tsx:11` (`requireActiveSub`), `(admin)/layout.tsx:10` ; redirect serveur vers `/tarifs` (`gate.ts:91-93`). | closed |
| T-01-10 | Information Disclosure | chaînes en dur | mitigate | `scripts/check-i18n-hardcoded.mjs` (`exit 1` sur texte littéral, `:179-191`), câblé `lint:i18n` (`package.json:11`) — barrière de régression CI. | closed |
| T-01-SC | Tampering | supply-chain npm | accept | Versions exactes épinglées (pas de range) : `next-intl 4.13.0`, `tailwindcss 4.3.1`, `@tailwindcss/postcss 4.3.1` (`apps/web/package.json`), conformes à STACK.md. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Défense en profondeur (note, pas une faille)

Le gate UX `(member)` (`requireActiveSub`) lit via RPC `has_active_subscription` (`gate.ts:89`), miroir du helper RLS — source unique de vérité, expiry NULL gérée (`0010:28`). La **barrière non-contournable** reste la RLS (T-01-01/04) ; le gate layout n'est qu'UX (documenté `(member)/layout.tsx:4-6`).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-SC | T-01-SC | Supply-chain npm : risque résiduel = compromission upstream d'une version épinglée. Mitigé par épinglage exact (pas de semver range) conforme à STACK.md. Non traité en P1 (slopcheck indisponible ; paquets largement adoptés — amannn/next-intl, tailwindlabs). | Borhane (fondateur) | 2026-06-14 |
| AR-01-PWD | Auth config | `leaked_password_protection` désactivée (advisor live WARN). Toggle config Auth (HaveIBeenPwned), hors périmètre code P1. **Recommandé** de l'activer avant ouverture communauté (Phase ultérieure). | Borhane (fondateur) | 2026-06-14 |
| AR-01-SECDEF | T-01-03 | Advisors live WARN `authenticated_security_definer_function_executable` sur `has_active_subscription()` et `is_superadmin()` : **intentionnel** — le pattern gating exige que `authenticated` appelle ces RPC pour vérifier ses propres droits. `search_path` figé → pas de WARN `function_search_path_mutable`. | gsd-security-auditor | 2026-06-14 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-14 | 11 | 11 | 0 | gsd-security-auditor (Opus, ASVS L1) + live advisor check (MCP `get_advisors`) |

**Live DB advisors (2026-06-14) :** 0 ERROR. 3 WARN, toutes documentées en risques acceptés (2× security-definer intentionnel, 1× leaked-password config). Aucun `rls_disabled` ni `function_search_path_mutable` ⇒ confirme T-01-01/03/04.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-14
