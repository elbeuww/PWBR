---
phase: 05
slug: track-record-mesur-affich
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-16
---

# Phase 05 — Security

> Contrat de sécurité de la phase : registre de menaces, risques acceptés, journal d'audit.
> **Phase critique** : première ouverture de lecture publique (`anon`) du projet via la vue `pattern_stats`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| job (`service_role`) → DB | Le job `outcome-tracker` écrit `prediction_outcomes` en bypass RLS. Entrée = candles internes déjà validées à l'ingestion. | Issue rejouée par setup (outcome, realized_r) |
| `anon` (public, sans compte) → vue `pattern_stats` | **PREMIÈRE lecture publique du projet.** Seuls les agrégats anonymes traversent ; jamais les lignes par setup. | Agrégats (win_rate, avg_r, expectancy, N) |
| `authenticated` (membre) → `prediction_outcomes` + `pattern_stats` | Membre lit la table (SELECT policy) et la vue miroir. | Lignes par setup + agrégats |
| front (`apps/web`) → DB | Front READ-ONLY via anon-client. Jamais d'import `service_role`, jamais d'écriture. | Lecture vue uniquement |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-05-01 | Tampering | `replayOutcome` (calcul du R) | mitigate | Logique déterministe pure, golden-testée ; tie-break D-04 testé ; `realized_r` calculé sur prix de candles, jamais via scoring. Aucune entrée externe. | **closed** |
| T-05-02 | Tampering | helper de seuil (`applyThreshold`) | accept | Décision d'affichage pure, sans persistance ni privilège ; ne masque jamais N (D-12). Risque nul. | **closed** |
| T-05-03 | Information Disclosure | `prediction_outcomes` exposé à `anon` | mitigate | RLS **active** (vérifié live) + **une seule policy** `SELECT to authenticated` → `anon` lit 0 ligne. Seule la vue agrégée a `grant select to anon`. `get_advisors` live confirme l'absence de fuite par setup. **ASVS V4 (CRITIQUE).** | **closed** |
| T-05-04 | Elevation of Privilege | écriture front dans `prediction_outcomes` | mitigate | **Aucune policy** insert/update/delete (vérifié live) → écriture `service_role` bypass uniquement. `pattern_stats` est une vue (non-writable). Repo `predictionOutcomes` jamais importé par `apps/web`. | **closed** |
| T-05-05 | Integrity / Tampering | double comptage des stats | mitigate | Sélection bornée + PK `UNIQUE(setup_id)` + insert `onConflict ignoreDuplicates`. Test idempotence « 2e run = 0 ». | **closed** |
| T-05-06 | Tampering | track record gonflé / inventé | mitigate | Seul le job `service_role` écrit ; `replayOutcome` déterministe golden-testé ; la vue n'invente rien (agrégat SQL pur) ; N brut exposé (D-12). Core Value « jamais inventé ». | **closed** |
| T-05-07 | Information Disclosure | composant front lit des données par setup | mitigate | `TrackRecordBlock` + `getPatternStats` lisent **UNIQUEMENT** `pattern_stats` via anon-client (`.from('pattern_stats')` vérifié) ; aucun import `service_role` (grep vérifié). | **closed** |
| T-05-08 | Injection | couche d'affichage publique | mitigate | Aucune entrée utilisateur dans le pipeline d'affichage (valeurs DB + labels next-intl) ; nombres via Intl ; **aucun `dangerouslySetInnerHTML`** (grep vérifié). | **closed** |
| T-05-09 | Tampering / promesse trompeuse | % affiché | mitigate | Seuil `MIN_SAMPLE=30` (D-09) interdit tout % sous l'échantillon ; N toujours présent dans les deux branches (`sufficient`/`insufficient`, D-12) ; méthode exposée ; disclaimer LEGAL-01 adjacent (D-15). | **closed** |
| T-05-SC | Tampering (supply chain) | npm / shadcn installs | accept | Aucun package npm ni bloc shadcn ajouté en Phase 5 (RESEARCH §Package Legitimacy + UI-SPEC §Registry Safety). Pas de surface slopsquatting. | **closed** |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-05-01 | T-05-03 / advisor `security_definer_view` | La vue `pattern_stats` est délibérément `security_invoker = false` : c'est **le mécanisme même** qui lit `prediction_outcomes` (RLS-protégée) en bypass pour n'exposer **que** les agrégats à `anon`. L'ERROR `get_advisors` est attendue et by-design ; preuve dure : `anon` n'a aucune policy de lecture sur la table sous-jacente. | Borhane | 2026-06-16 |
| R-05-02 | T-05-02, T-05-SC | Risques résiduels nuls/acceptés : helper de seuil pur (sans état) ; aucun paquet installé. | Borhane | 2026-06-16 |

*Hors périmètre Phase 5 (pré-existants, à traiter ailleurs) — relevés par `get_advisors` mais non introduits par cette phase :*
- WARN `authenticated_security_definer_function_executable` sur `has_active_subscription()` et `is_superadmin()` (Phase 4 / socle) — à revoir lors d'un audit transverse.
- WARN `auth_leaked_password_protection` désactivé (config Auth globale) — à activer avant la prod publique.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-16 | 10 | 10 | 0 | /gsd-secure-phase (vérification live DB + grep code) |

**Preuves de vérification live (Supabase project `csotpitrjxryjkadyiml`) :**
- `pg_class.relrowsecurity = true` sur `prediction_outcomes` (RLS active).
- `pg_policy` : une seule policy `SELECT to authenticated` ; aucune policy `anon`, aucune policy write.
- `get_advisors(security)` : seul `security_definer_view` sur `pattern_stats` (intentionnel, R-05-01) ; aucun lint `rls_disabled` / `policy_exists_rls_disabled` sur les objets Phase 5.
- Grep `apps/web` : `patternStats.ts` requête `.from('pattern_stats')` uniquement ; aucun import `service_role` ; aucun `dangerouslySetInnerHTML`.
- `threshold.ts` : `MIN_SAMPLE = 30` ; N présent dans `SufficientStat` ET `InsufficientStat`.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-16
