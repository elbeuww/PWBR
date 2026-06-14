---
phase: 4
reviewers: [architect, security-reviewer, code-reviewer]
review_mode: internal-multi-agent (aucun CLI IA externe installé — Gemini/Codex/Cursor absents)
reviewed_at: 2026-06-14
plans_reviewed: [04-01-PLAN.md, 04-02-PLAN.md, 04-03-PLAN.md, 04-04-PLAN.md]
verdict: WARNING — aucun CRITICAL, risque MEDIUM, exécutable après clarifications de spec
---

# Cross-AI Plan Review — Phase 4 (moteur IA vétéran & scoring déterministe)

> Revue interne multi-agents adversariale (3 perspectives indépendantes : architecture / sécurité / qualité-factuel).
> Substitut au cross-AI externe (aucun CLI tiers détecté). Même famille de modèle, rôles distincts.

## Architecture Review

**Risk: MEDIUM.** Découpage en 4 waves acyclique et fidèle aux décisions verrouillées (D-42→D-52). Séparation code-déterministe / jugement-IA-borné nette et testable (`OutputSchema` exclut score/risk/confidence — A1 OK). Analogs P3 cités existent réellement (technical-engine, snapshots repo, 0005, dispatch, runJob). Zéro dérive de stack.

Concerns clés :
- **[HIGH] Clé d'immuabilité « jour » contradictoire (04-01 vs 04-03).** D-45/persist définissent `(instrument, style, session, jour)` + `dayKey(generated_at)`, mais l'index `trade_setups_versionkey_idx` et `expirePriorSetups(key:{instrument_id,style,session})` n'ont AUCUNE dimension jour. À trancher : retirer « jour » (le `valid_until`+statut gèrent le temporel) OU ajouter une colonne `session_day` indexable. En l'état les deux plans se contredisent.
- **[HIGH] Race expire→insert non transactionnelle (04-03).** 3 appels service_role séparés (expire/insertAnalysis/insertTradeSetups) sans transaction. Deux runs chevauchants → deux setups `active` même clé, ou analyse sans setups. Suggestion : `unique partial index ... where status='active'` comme filet DB, ou RPC atomique. Sinon documenter risque accepté P1.
- **[MEDIUM] Cap 45 « catalyseur fort » non défini (04-02).** Condition exacte (`news_catalysts` impact='high' + même direction ?) absente → golden test arbitraire/non reproductible.
- **[MEDIUM] Dualité `entry_price` (bord conservateur, colonne) vs `payload.entry.price` (médian).** Défendable mais à documenter sinon dashboard P5 incohérent avec le R:R.
- **[MEDIUM] Ordre de calcul score→confidence→risk implicite (04-02)** — à figer explicitement dans `score.ts` + cycle de packages `@app/core → @app/indicators` unidirectionnel à vérifier.
- **[LOW] Source `run_id`/session à l'exécution non précisée** (dispatch ne lit qu'`argv[2]`) ; dénormalisation style/session = double source de vérité ; `valid_until` swing non chiffré.

## Security Review

**Risk: MEDIUM. Aucun CRITICAL bloquant pour la Phase 1.** Frontière de confiance unique architecturalement correcte (agent ne peut pas insérer), RLS select-only calquée sur 0005, scoring hors portée de l'agent (élimine la classe la plus critique : hallucination de chiffres financiers), logs normalisés, prompt_version via node:crypto.

Concerns clés :
- **[HIGH] Injection de prompt via données de marché ingérées (04-04).** `news_catalysts[].headline`, `upcoming_risk_events[].note` viennent de Finnhub/Marketaux (tiers non contrôlés) et sont injectés dans le contexte agent. Un headline malicieux (« ignore previous instructions… ») peut détourner le jugement. Mitigation : délimiteurs `<market_data>` + strip caractères de contrôle + troncature avant injection.
- **[HIGH] Path traversal sur `run_id` → `readRunArtifacts` (04-03).** `run-artifacts/<run_id>/...` : si run_id non sanitisé → lecture fichiers arbitraires. Mitigation : regex strict `/^[a-z]+-\d{8}T\d{4}Z$/` + `path.resolve` + `startsWith(BASE)`.
- **[MEDIUM] RLS `using(true)` = pas de différenciation par abonnement.** OK pour P1 perso, mais au pivot public payant n'importe quel compte gratuit pourra requêter tous les signaux via le client JS. À noter dès maintenant pour P5 (policy `subscriptions`).
- **[MEDIUM] `payload jsonb` stocke champs texte IA non sanitisés** (`veteran_note`, `*_reasons[]`) → risque XSS stocké au rendu P5 (`dangerouslySetInnerHTML`). Documenter : rendu `textContent` only / Zod `regex(/^[^<>]*$/)`.
- **[MEDIUM] Pas de borne sur inputs numériques du scoring** (RSI=150, ATR<0 si bug upstream) → score hors [0,100]. Clamp ou exception dans `scoreSetup`.
- **[LOW] `generated_at` futur contrôlé par l'agent** → `valid_until` jamais atteint ; `run_id` text sans CHECK ; cas liste d'artefacts vide = succès silencieux.

## Quality & Factual Review

**Risk: MEDIUM. Verdict WARNING — 4 HIGH à clarifier dans les plans avant exécution.** Découpage solide, analogs P3 tous réels (aucune référence morte), barèmes §3 correctement retranscrits, chaîne `depends_on` correcte, principe IA/code cohérent bout en bout.

Concerns clés :
- **[HIGH] A1 : `OutputSchema` strict vs permissif non tranché.** L'exemple §3 dans `veteran.md` contient `opportunity_score:78`/`risk_level`/`confidence`. Si l'agent les émet et `OutputSchema` est `.strict()` → rejet Zod artificiel dès le 1er run. Décider explicitement : `z.object()` permissif + test « parse réussit avec clés supplémentaires ».
- **[HIGH] « Structure cassée contre le trade = rejet » (§3) sans implémentation ni test.** Règle dure §3 absente des garde-fous persist.ts (qui ne couvrent que R:R<1.2 + cohérence SL/TP). Définir (`bos_choch` contredit direction → reject('structure_against')).
- **[HIGH] `snapshot.partial:true` non couvert (04-03).** P3 produit des snapshots partiels (<200 bougies). Scorer/persister ou rejeter ? risk_level relevé ? Edge case fréquent au lancement, aucun plan ne répond.
- **[HIGH] `valid_until` swing « quelques jours » non implémentable.** Pas de valeur précise → golden test instable. Constante nommée requise (`SWING_VALID_HOURS=72`).
- **[MEDIUM] `readRunArtifacts` non spécifiée** (où créé run-artifacts/ ? qui passe runId ? pas dans `files_modified`) — bloque l'implémentation de persist.ts.
- **[MEDIUM] `alloc_pct ≠ 100` : borné OU rejet ?** comportements opposés non tranchés (33+33+33=99). Recommandé : rejet `tp_bounds` + instruction prompt.
- **[MEDIUM] `expirePriorSetups` sans « jour »** (miroir du HIGH archi) ; **critère `grep` Windows-hostile** dans 04-01 Task 2 ; **VALIDATION.md incomplet** (3 lignes pour 7 REQ, `nyquist_compliant:false`).
- **[LOW] `analyses` sans colonne `raw_indicators_ref`** (pas de requête SQL « setups de ce snapshot ») ; répertoires `packages/core/src/schemas/` à créer ; comptage 04-02 « 11 vs 12 fichiers ».

---

## Consensus Summary

Les trois reviewers convergent : **architecture saine, aucun défaut structurel, aucun CRITICAL. Risque global MEDIUM. Les problèmes sont des lacunes de SPÉCIFICATION (à verrouiller dans les plans), pas des refactors.** Les plans restent exécutables après clarifications ; la phase n'est pas bloquée.

### Agreed Strengths (2+ reviewers)
- Frontière d'écriture unique `persist.ts` réellement étanche (agent ne peut pas insérer) — architect + security.
- Séparation code-déterministe / IA-bornée nette, `OutputSchema` exclut score/risk/confidence (A1) — les 3.
- Réutilisation fidèle des patrons P3 vérifiés ; analogs cités existent réellement — architect + quality.
- Scoring pur golden-testé sans `Date.now()` ; logs normalisés (T-02-13) — security + quality.

### Agreed Concerns (2+ reviewers — priorité haute)
1. **[HIGH] Clé d'immuabilité « jour » contradictoire** (04-01 index/expirePriorSetups SANS jour vs D-45/persist AVEC jour) — architect [HIGH] + quality [MEDIUM]. **#1 à trancher.**
2. **[HIGH] `readRunArtifacts(runId)` non spécifiée + path traversal** — security [HIGH] + quality [MEDIUM]. Bloque l'implémentation ET surface d'attaque.
3. **[HIGH/MEDIUM] `valid_until` swing non chiffré** → constante nommée requise — quality [HIGH] + architect [LOW].
4. **[MEDIUM] Bornes numériques inputs scoring / snapshot pathologique** — security [MEDIUM] + quality [HIGH partial].

### Divergent / Single-reviewer Views (à investiguer)
- **Injection de prompt via news tierces** (security [HIGH], seul) — pertinent vu sources Finnhub/Marketaux non contrôlées.
- **RLS `using(true)` contournable au pivot payant** (security [MEDIUM], seul) — à noter pour P5, pas bloquant P1.
- **« Structure cassée = rejet » non implémentée** (quality [HIGH], seul) — règle §3 sans code.
- **A1 strict/permissif + exemple §3 dans veteran.md** (quality [HIGH], seul) — risque taux de rejet.
- **Race expire→insert non transactionnelle** (architect [HIGH], seul) — suggère unique partial index.
- **Cap 45 « catalyseur fort » / dualité entry_price / `alloc_pct` borné-vs-rejet** — précisions à figer pour golden tests reproductibles.

### Recommandation
Intégrer les 4 concerns consensus + les HIGH single-reviewer dans les plans via `/gsd-plan-phase 4 --reviews` (révision ciblée des specs, pas de re-planification). Priorité : (1) trancher la clé « jour », (2) spécifier `readRunArtifacts` + validation run_id, (3) figer `SWING_VALID_HOURS`, (4) A1 permissif + test, (5) « structure cassée » + bornes inputs + snapshot.partial. Les LOW (grep Windows, VALIDATION.md, répertoires) = nettoyage à l'exécution.
