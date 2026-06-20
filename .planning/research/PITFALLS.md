# Pitfalls Research — v2.1 (identité NEXA · routines Claude sans API · backtest + track record en prod)

**Domain:** Reskin trilingue RTL d'une app de signaux trading DÉJÀ LIVRÉE (Next.js 15 + Supabase) · activation du moteur IA via routines Claude Code Remote SANS clé API (Max ~15 runs/j partagés) · moteur de backtest seedant `pattern_stats` + bascule vers outcomes réels
**Researched:** 2026-06-20
**Confidence:** HIGH (pièges ancrés dans le code RÉEL du repo : `persist.ts`, `pattern_stats` view 0014, `replayOutcome`, `candle.ts`, `threshold.ts`, `docs/routines-claude.md`) · MEDIUM sur les chiffres exacts de quota/jank device (dépendent de l'environnement runtime)

> **Périmètre.** Pièges SPÉCIFIQUES à l'ajout de ces 3 axes sur l'existant v2.0. Pas de pièges génériques web. **Priorité absolue :**
> 1. **EXPOSITION LÉGALE** — afficher un % non mesuré, réintroduire une promesse de gain (contrainte dure « jamais inventé », slogan MERA écarté). Une seule fuite = risque réglementaire + perte du socle de confiance.
> 2. **CORRUPTION SILENCIEUSE DES DONNÉES** — look-ahead, double-comptage backtest↔live dans `pattern_stats`, hallucination de chiffres passant `persist.ts`. Invisible, contamine le % affiché, donc retombe en (1).
> 3. Régressions d'intégration (RTL cassé, sélecteurs E2E, FOUC, quota épuisé, double-publication).
>
> **Fait structurel central (vérifié dans la migration 0014).** La vue `pattern_stats` agrège `prediction_outcomes ⋈ trade_setups ⋈ instruments`. **Il n'existe AUCUNE colonne `source`/`origin`** distinguant un outcome backtesté d'un outcome réel. En l'état, dès qu'on seede le backtest dans cette chaîne, backtest et live sont **indistinguables et additionnés**. C'est le piège #1 data-integrity de ce milestone — voir Pitfall 8.

---

## Critical Pitfalls

### Pitfall 1: Afficher un % issu du backtest sans le marquer « mesuré par backtest » (glissement légal)

**What goes wrong:**
Le backtest seede `pattern_stats`, la vitrine lit la vue via `getPatternStats` + `applyThreshold` (déjà câblé en v2.0 P5) et affiche un %. Mais l'UI ne dit PAS que ce chiffre vient d'un backtest historique, pas de trades réels. Un public non averti le lit comme « la plateforme gagne X% sur de l'argent réel » → promesse implicite de performance.

**Why it happens:**
La couche d'affichage existante (`SufficientStat.winRatePct`) ne porte aucune notion de provenance. Le composant rend juste « 64% (N=120) ». Brancher le backtest dessus sans toucher au label = glissement invisible.

**How to avoid:**
- Le libellé doit être explicite et trilingue : « Taux mesuré par backtest du pattern » vs « Track record réel de la plateforme » — JAMAIS un % nu.
- Ajouter la provenance dans le contrat de sortie du seuil (ex. `provenance: 'backtest' | 'live' | 'mixed'`) et la rendre obligatoire dans le composant (type qui force le rendu du label).
- Conserver le test anti-claim de v2.0 (`no-perf-claims`) et l'ÉTENDRE : interdire un `winRatePct` rendu sans son label de provenance adjacent.
- Réutiliser la méthodologie trilingue déjà livrée (bloc « méthodologie ») et la pointer depuis chaque % backtest.

**Warning signs:**
Un `%` dans le DOM sans nœud de provenance frère ; le test no-perf-claims passe alors que le backtest est branché (= test trop étroit) ; copy marketing qui reparle de « gains ».

**Phase to address:** Axe 3 (backtest → pattern_stats), tâche d'affichage. À cabler AVANT toute mise en visibilité publique du %.

---

### Pitfall 2: Mélanger backtest et outcomes réels dans le même agrégat → double-comptage / chiffre faux

**What goes wrong:**
`pattern_stats` somme tout `prediction_outcomes`. Si le seed backtest insère des lignes dans `prediction_outcomes` (ou dans une table jointe à la vue) sans dimension de séparation, alors : (a) le N affiché double-compte backtest + live ; (b) la bascule « backtest → réel » est impossible à opérer proprement ; (c) un même setup pourrait être compté deux fois (backtest puis résolution live).

**Why it happens:**
La PK `prediction_outcomes.setup_id` lie une issue à un `trade_setups` réel. Le backtest porte sur des patterns/setups HISTORIQUES qui n'ont pas forcément de `trade_setups` live → tentation de fabriquer des `trade_setups` factices ou d'insérer dans `prediction_outcomes` un setup_id qui collisionnera plus tard avec une vraie résolution.

**How to avoid:**
- **Décision d'archi à trancher en début d'axe 3 :** soit une table `backtest_stats` séparée + une vue d'union explicite étiquetée par provenance, soit une colonne `source text not null check (source in ('backtest','live'))` ajoutée à `prediction_outcomes` ET propagée comme dimension dans `pattern_stats` (migration). Ne PAS seeder dans la chaîne live sans ce discriminant.
- La bascule devient un changement de FILTRE de provenance, jamais une réécriture de chiffres (Pitfall 9).
- Tester l'idempotence du seed : re-run du backtest → N stable, pas d'accumulation.

**Warning signs:**
N qui grimpe à chaque re-run du seed ; un `setup_id` présent à la fois en backtest et live ; impossibilité de répondre « ce % vient d'où ? » par une requête SQL simple.

**Phase to address:** Axe 3, migration de schéma EN PREMIER (avant d'écrire le moteur de backtest).

---

### Pitfall 3: Look-ahead bias dans le backtest (le pattern « voit » des bougies futures)

**What goes wrong:**
Le backtest détecte un pattern à l'instant T en utilisant des indicateurs/structure calculés sur des bougies ≥ T, ou rejoue l'outcome sur des bougies que la détection a déjà « vues ». Le win-rate explose artificiellement → on affiche un % flatteur mais faux dès J1.

**Why it happens:**
Réutiliser le même tableau de candles pour détecter ET pour résoudre, sans borne stricte. Le repo a DÉJÀ la défense côté live (`lastClosedCandleStart` ne retourne que la bougie clôturée ; `replayOutcome` exige `ts < valid_until`, responsabilité appelant). Le backtest est un NOUVEAU chemin qui ne passe pas par ces gardes s'il est écrit naïvement.

**How to avoid:**
- Réutiliser `replayOutcome` (pur, golden-testé) tel quel : détecter sur `candles[0..i]`, rejouer UNIQUEMENT sur `candles[i+1..i+window]`. Frontière stricte au point de détection.
- Réutiliser `lastClosedCandleStart` / la convention « jamais la bougie en cours » dans la boucle de backtest.
- Test golden de non-régression : un pattern dont le futur est tronqué doit donner le même verdict que le live ; injecter une bougie future « parfaite » ne doit JAMAIS changer la détection.
- Indicateurs (RSI/MACD/ATR…) calculés sur la fenêtre passée seulement, pas sur la série complète pré-chargée.

**Warning signs:**
Win-rate backtest >> intuition vétéran (ex. 85%+) ; le verdict change si on ajoute des bougies après la détection ; détection et replay partagent la même slice.

**Phase to address:** Axe 3, moteur de backtest (coeur). Highest data-integrity priority.

---

### Pitfall 4: Échantillon insuffisant (N<30) affiché comme un vrai % parce que le seuil est court-circuité côté backtest

**What goes wrong:**
Le seuil `MIN_SAMPLE = 30` (`applyThreshold`) protège la vitrine. Mais le backtest peut produire des buckets fins (par instrument × score_band × période) avec N=8 ; si un nouveau chemin d'affichage backtest n'applique PAS `applyThreshold`, on montre « 75% » sur 8 trades → bruit présenté comme mesure.

**Why it happens:**
`applyThreshold` est appliqué côté front sur la vue live. Un moteur de backtest qui calcule et pré-formate ses propres % (ex. pour le seed ou un dashboard admin) re-implémente la logique sans le garde N≥30.

**How to avoid:**
- TOUT chemin qui rend un % (vitrine, Telegram, admin, backtest) DOIT passer par `applyThreshold` de `@app/core` (source unique D-11). Interdire tout `Math.round(win_rate*100)` ailleurs (règle lint/grep + test).
- N affiché BRUT toujours (déjà la discipline D-12) — même backtest.
- Les buckets fins sous seuil affichent « échantillon insuffisant », jamais un %.

**Warning signs:**
Un `* 100` ou `toFixed` sur un win_rate hors de `applyThreshold` ; buckets par instrument avec petits N montrant un % ; divergence vitrine vs Telegram (signe de logique dupliquée).

**Phase to address:** Axe 3, affichage backtest + dashboard admin métriques.

---

### Pitfall 5: First-touch ambigu (SL et TP dans la même bougie) — résolu en live, à NE PAS ré-inventer en backtest

**What goes wrong:**
Une bougie H1 touche TP1 ET SL. Le verdict dépend de l'hypothèse. Si le backtest applique une règle différente de la prod (`replayOutcome` D-04 : niveau le plus proche de l'entrée gagne, tie → hit_tp), le % backtest n'est pas comparable au % live → la bascule fait « bouger » les chiffres sans raison visible.

**Why it happens:**
Le backtest est écrit comme un script séparé qui ré-implémente la résolution d'outcome au lieu d'appeler `replayOutcome`.

**How to avoid:**
- Appeler `replayOutcome` EXACTEMENT (même fonction pure) pour le backtest. Zéro ré-implémentation de la résolution first-touch.
- Documenter que la règle D-04 est une hypothèse optimiste/conservatrice connue ; si on veut un mode pessimiste (SL d'abord en cas d'ambiguïté), c'est un PARAMÈTRE explicite testé, pas une divergence accidentelle.
- Pour réduire l'ambiguïté : résoudre sur un timeframe plus fin que celui de génération si dispo (mais cohérent backtest ↔ live).

**Warning signs:**
Deux fonctions de résolution dans le repo ; % backtest et % live qui divergent sur les mêmes setups ; tests golden de `replayOutcome` non réutilisés par le backtest.

**Phase to address:** Axe 3, moteur de backtest.

---

### Pitfall 6: Survivorship / selection bias dans le catalogue de patterns (overfitting du catalogue)

**What goes wrong:**
On choisit/ajuste les patterns du catalogue d'après ceux qui « ont bien marché » sur l'historique, et/ou on ne backteste que sur les instruments/périodes favorables. Le % affiché reflète l'overfit, pas une edge réelle → s'effondre en prod, et le track record réel contredit publiquement le backtest.

**Why it happens:**
Tentation de présenter un beau chiffre dès J1. Le catalogue est figé après inspection des résultats (peeking). Périodes calmes seulement, instruments cherry-pickés.

**How to avoid:**
- Définir le catalogue de patterns AVANT de regarder les résultats de backtest (pré-enregistrement de l'hypothèse).
- Backtester sur l'ensemble des instruments seedés (12) et sur des régimes variés (trend/range, périodes incluant du stress), pas un sous-ensemble flatteur.
- Out-of-sample : réserver une fenêtre temporelle non utilisée pour la sélection.
- Afficher la période et le périmètre du backtest dans la méthodologie (honnêteté + auto-discipline).

**Warning signs:**
Catalogue modifié après lecture des résultats ; backtest limité aux 2-3 meilleurs instruments ; pas de période out-of-sample ; % backtest >> % live dès les premières résolutions réelles.

**Phase to address:** Axe 3, conception du catalogue (avant le moteur).

---

### Pitfall 7: Réintroduire une promesse de gain visuelle pendant le reskin NEXA

**What goes wrong:**
Le HTML de référence porte le slogan « Make Everybody Rich Again » (écarté par décision 2026-06-20). En reconstruisant fidèlement le design, on recopie un hero, une stat « +X% », un compteur de gains, un témoignage chiffré, ou une baseline promettant l'enrichissement → viole la contrainte légale dure.

**Why it happens:**
« Fidélité interprétative au HTML » pousse à tout reproduire. Les visuels marketing chiffrés sont précisément ce qui « vend » dans le mock.

**How to avoid:**
- Baseline officielle = « Nouvelle Ère · Alliance d'Échange », jamais le slogan MERA. Grep du repo pour « rich », « gain », « profit », « gagner », « +%» dans les copies trilingues.
- Étendre le test `no-perf-claims` de v2.0 aux nouveaux composants NEXA (hero, marquee, gauges) : aucun chiffre de performance non mesuré, aucune baseline de gain.
- Les gauges de score affichent un score /100 (qualité d'analyse), PAS un % de gain ; vérifier que le marquee ne fait pas défiler des « résultats » chiffrés inventés.
- Garder le `<Disclaimer />` global sur toutes les pages reskinnées (régression facile au reskin).

**Warning signs:**
Composant hero avec un nombre « % » hardcodé ; marquee de gains ; disparition du Disclaimer sur une page redesignée ; mots-clés gain dans les fichiers de traduction.

**Phase to address:** Axe 1 (design NEXA), dès le hero/landing. Legal-exposure → priorité haute.

---

### Pitfall 8: RTL cassé par des propriétés CSS physiques dans les nouveaux composants

**What goes wrong:**
Le reskin introduit `ml-`, `mr-`, `left-`, `right-`, `pl-`, `text-left`, `translate-x`, `rounded-l` etc. en dur. En arabe (`dir=rtl`), tout se retrouve du mauvais côté : flèches, gauges, marquee qui défile dans le mauvais sens, icônes mal alignées. L'app v2.0 utilisait les **propriétés logiques Tailwind v4 natives** (pas de tailwindcss-rtl) — le reskin doit tenir cette discipline sinon régression massive sur l'audience #1 (arabe).

**Why it happens:**
Le HTML de référence est probablement LTR-only ; on porte ses classes physiques directement. Les animations JS (translate, marquee) sont les pires car la direction y est codée en dur.

**How to avoid:**
- Propriétés logiques partout : `ms-`/`me-`/`ps-`/`pe-`, `start-`/`end-`, `text-start`/`text-end`, `rounded-s`/`rounded-e`. Grep d'interdiction (`\b(ml|mr|pl|pr|left|right|text-left|text-right)-` ) dans les nouveaux fichiers.
- Marquee/animations : direction dérivée de `dir`, pas codée en dur. Tester le défilement en RTL.
- Hero 3D / gauges : vérifier que les transforms respectent `dir` ou sont neutres en miroir.
- E2E i18n existant (`e2e/i18n.spec.ts`) à étendre pour vérifier `dir=rtl` sur les nouvelles pages NEXA.

**Warning signs:**
Classes physiques dans les nouveaux composants ; gauge/flèche du mauvais côté en arabe ; marquee qui défile L→R en RTL ; un seul `<html lang dir>` cassé.

**Phase to address:** Axe 1, fondation du design system NEXA (tokens + premiers composants).

---

### Pitfall 9: La bascule backtest → réel change silencieusement le % affiché

**What goes wrong:**
Le jour où assez d'outcomes réels existent, le système passe du % backtest au % réel. Sans gestion explicite, un visiteur revient et voit « 64% » devenir « 48% » sans explication → perte de confiance brutale, soupçon de manipulation.

**Why it happens:**
La bascule est implémentée comme un simple changement de source de données, sans communication ni transition. Pire si Pitfall 2 (mélange) provoque un saut numérique inexpliqué.

**How to avoid:**
- Bascule = changement de provenance EXPLICITE et étiqueté (« mesuré par backtest » → « track record réel sur N trades »), pas un remplacement muet.
- Période de coexistence possible : afficher les deux clairement séparés pendant la montée en N.
- Seuil de bascule documenté (ex. réel affiché dès N_live≥30 par bucket, sinon backtest), cohérent avec `MIN_SAMPLE`.
- Jamais réécrire l'historique des chiffres ; la transition est additive et tracée.

**Warning signs:**
% qui saute sans changement de label ; aucune logique de provenance dans le composant ; pas de seuil documenté pour la bascule.

**Phase to address:** Axe 3, boucle outcome-tracker en prod (transition).

---

### Pitfall 10: Hallucination de chiffres par l'agent passant la frontière `persist.ts`

**What goes wrong:**
L'agent Claude (vétéran) invente un prix d'entrée/SL/TP, un score, ou un R:R qui « semble » cohérent mais ne dérive pas du snapshot déterministe. Si ça passe `persist.ts`, un signal payant repose sur un chiffre inventé.

**Why it happens:**
Sortie LLM non fiable par nature. Le repo a DÉJÀ la défense : `persist.ts` est la frontière de confiance UNIQUE (Zod §3 + `runGuardrails` : R:R recalculé sur bord conservateur, cohérence SL/TP par direction, `structure_against`, alloc=100, MIN_RR) + scoring déterministe (jamais le score de l'agent). Le risque v2.1 = AFFAIBLIR cette frontière en activant les routines (ex. nouveau champ de sortie non couvert par Zod, contournement du scoring).

**How to avoid:**
- Ne rien écrire en DB hors de `persist.ts`. L'agent écrit des FICHIERS, point (D-43).
- Tout nouveau champ du contrat §3 doit être ajouté au `OutputSchema` Zod ET à `runGuardrails` AVANT d'être consommé.
- Le scoring reste déterministe (`scoreSetup`), jamais `output.score`.
- Logs de rejet = codes normalisés seulement (déjà le cas), surveiller le taux de rejet par run (un pic = prompt qui dérive ou snapshot manquant).

**Warning signs:**
Un chemin d'insert hors `persist.ts` ; un champ de sortie consommé sans passer Zod/guardrails ; taux de rejet anormal ; `snapshot_not_found` fréquent (l'agent référence un hash inexistant = il invente).

**Phase to address:** Axe 2 (routines Claude). Data-integrity → priorité haute.

---

### Pitfall 11: Quota Claude (~15 runs/j) épuisé — partagé avec l'usage interactif

**What goes wrong:**
Les routines day + swing consomment le quota Max (~15 runs/j) PARTAGÉ avec les sessions interactives du fondateur. Une journée de dev interactif intense → plus de runs pour les routines → aucune nouvelle analyse publiée → données `stale` côté membres payants.

**Why it happens:**
Sous-estimation du nombre de routines × instruments × sessions, et oubli que le dev interactif pioche dans le même pot (`docs/routines-claude.md` §2 le note explicitement).

**How to avoid:**
- Budget de runs explicite : compter (sessions planifiées × style) et garder une marge sous 15. Une seule routine peut batcher plusieurs instruments par run (1 run = snapshot multi-instruments → analyze → persist).
- Les jobs déterministes (ingestion candles/news/macro) restent HORS quota via Windows Task Scheduler (déjà le design) — ne JAMAIS les faire passer par une routine Claude.
- Monitorer la consommation ; alerter si on approche le plafond.
- Plan de bascule documenté vers clé API Anthropic au lancement payant (décision déjà prise) — le quota Max n'est pas un SLA 24/7.

**Warning signs:**
Runs interactifs nombreux les jours de publication manquée ; `job_runs` montrant des routines non exécutées ; dashboard `stale` qui s'allume.

**Phase to address:** Axe 2, dimensionnement des routines.

---

### Pitfall 12: MCP Supabase indisponible en routine Remote → job qui marche en interactif, casse en cloud

**What goes wrong:**
On teste l'analyse en interactif où le MCP Supabase (stdio local `.mcp.json`) marche, puis on planifie la routine Remote où ce MCP n'existe PAS (`docs/routines-claude.md` §4). Le job qui s'appuyait sur le MCP échoue silencieusement en cloud.

**Why it happens:**
Le MCP interactif crée une fausse confiance. La routine Remote n'a accès qu'aux MCP cloud-hosted configurés au dashboard ; le chemin supporté est `supabase-js` via HTTPS.

**How to avoid:**
- Les jobs lisent/écrivent Supabase EXCLUSIVEMENT via `supabase-js` (service_role), jamais via le MCP (déjà l'invariant d'archi). Vérifier qu'aucune étape de la routine n'appelle un outil MCP Supabase.
- Tester la routine EN REMOTE (pas seulement en interactif) avant de s'y fier.
- Confirmer le network access `*.supabase.co` depuis le runtime Anthropic (Open Question A1 de `routines-claude.md` — à valider en début d'axe 2).
- Secrets via Environments (variables chiffrées), `dotenv/config` no-op en cloud.

**Warning signs:**
Routine qui réussit en local et échoue/timeout en Remote ; appel à un outil `mcp__supabase__*` dans le script de routine ; erreurs réseau vers `*.supabase.co`.

**Phase to address:** Axe 2, configuration de l'Environment + premier run Remote réel.

---

### Pitfall 13: FOUC / flash de thème au chargement sur volt/green × light/dark (multi-thème OKLCH)

**What goes wrong:**
Au premier paint, le thème par défaut s'affiche puis bascule vers le thème stocké (cookie/localStorage) → flash visible, pire avec 2 familles (volt/green) × 2 modes (light/dark). v2.0 avait un `ThemeToggle` no-flash RTL-safe ; le reskin NEXA multiplie les axes de thème et peut casser cette garantie.

**Why it happens:**
Le thème est appliqué côté client après hydratation au lieu d'un script inline bloquant dans `<head>` qui pose la classe/attribut AVANT le premier paint. OKLCH + variables CSS aggravent le contraste du flash.

**How to avoid:**
- Script inline anti-flash dans `<head>` qui lit la préférence (cookie de préférence pour SSR-cohérence, ou localStorage) et pose `data-theme`/classe AVANT paint, pour les 4 combinaisons.
- Préférer un cookie lisible en RSC pour rendre le bon thème côté serveur (évite tout flash).
- Tokens OKLCH définis par thème via `[data-theme=...]`, pas de calcul JS au runtime.
- Tester les 4 combinaisons × 3 locales (RTL inclus) au reload.

**Warning signs:**
Flash visible au reload ; thème appliqué dans un `useEffect` ; mismatch hydratation (warning React) sur l'attribut de thème.

**Phase to address:** Axe 1, fondation thèmes (tout début).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Seeder le backtest directement dans `prediction_outcomes` sans colonne `source` | Réutilise la vue `pattern_stats` telle quelle, zéro migration | Double-comptage backtest↔live, bascule impossible, % faux affiché publiquement | **Jamais** — c'est la corruption de données #1 |
| Ré-implémenter la résolution d'outcome dans le backtest | Script autonome rapide | Divergence backtest vs live (first-touch D-04), chiffres non comparables | **Jamais** — appeler `replayOutcome` |
| Calculer le % côté backtest avec `win_rate*100` au lieu de `applyThreshold` | Affichage admin rapide | Buckets N<30 montrés comme vrais %, divergence vitrine/Telegram | **Jamais** pour tout rendu visible ; OK en interne brut non affiché |
| Copier les classes CSS physiques du HTML de référence | Reskin plus rapide | Régression RTL massive sur l'audience arabe | MVP seulement si la page n'est jamais servie en `ar` (rare) |
| Appliquer le thème en `useEffect` | Simple | FOUC sur 4 combinaisons | Jamais pour des pages publiques (vitrine) |
| Routines Claude comme seul mécanisme de publication | Coût zéro | Pas de SLA, données stale dès quota épuisé/PC off | Pré-lancement uniquement ; clé API au lancement payant |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Routine Claude Remote ↔ Supabase | S'appuyer sur le MCP Supabase (absent en Remote) | `supabase-js` service_role via HTTPS uniquement |
| Routine Remote ↔ secrets | Coder/committer les clés, ou supposer `.env` présent en cloud | Environments chiffrés ; `dotenv/config` no-op en cloud |
| Quota Max ↔ dev interactif | Compter les runs routines seuls | Budget partagé interactif + routines, marge sous 15/j |
| Backtest ↔ `pattern_stats` view | Insérer sans discriminant de provenance | Colonne/table `source` + dimension dans la vue (migration d'abord) |
| Reskin ↔ E2E existants | Casser les sélecteurs role/testid des 6 spec files | Conserver `data-testid` / rôles ARIA stables sur les éléments testés ; auditer les specs avant merge |
| Reskin ↔ Disclaimer/RLS gating | Recopier des pages sans le `<Disclaimer />` global / sans le gate abonné | Garder les wrappers de conformité et de gating sur chaque page reskinnée |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Hero 3D / animations lourdes sur devices MENA bas de gamme | Jank au scroll, batterie, CLS au chargement du hero | `prefers-reduced-motion` respecté, animations CSS/GPU-friendly, dimensions réservées (pas de CLS), lazy/conditional 3D | Dès l'audience réelle (Android entrée de gamme) |
| Marquee/gauges animés en boucle JS | CPU constant, jank | requestAnimationFrame borné ou animation CSS pure, pause hors viewport | Pages longues, onglets en arrière-plan |
| Polices self-hosted (Noto Sans Arabic + 4 latines) non optimisées | FOUT, CLS, gros transfert | `font-display: swap`/`optional`, subset, preload des fonts critiques, `next/font` | Connexions MENA lentes |
| `pattern_stats` view recalculée à chaque hit | Vitrine lente quand outcomes grossissent | Vue OK à petite échelle ; matérialiser si N de résolutions devient grand | >> dizaines de milliers d'outcomes |
| Backtest sur série complète chargée en mémoire | Lenteur/OOM du job | Fenêtre glissante, pas toute la série indicateurs d'un coup | Longs historiques multi-instruments |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| service_role exposé dans une routine Remote mal configurée | Bypass RLS total, fuite/écriture arbitraire | Environments chiffrés ; service_role jamais côté client/front ; garde ESLint server-only déjà en place |
| Backtest qui écrit via un client front/anon | Échec ou contournement RLS | Seed via service_role en job, jamais depuis apps/web |
| Nouveau champ de sortie agent inséré sans Zod/guardrails | Injection de données non validées dans un signal payant | Tout champ passe `OutputSchema` + `runGuardrails` avant insert |
| `prediction_outcomes` exposé à anon en ajoutant le backtest | Fuite ligne-par-ligne (la vue ne doit exposer QUE des agrégats) | Re-passer `get_advisors` après toute migration touchant la chaîne track record |
| Reskin qui retire le gating RLS d'une page membre | Signaux payants visibles gratuitement | Conserver le gate abonné sur chaque page reskinnée ; test gating E2E |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| % qui change sans explication à la bascule backtest→réel | Perte de confiance, soupçon de triche | Label de provenance + transition expliquée (Pitfall 9) |
| Néon OKLCH sur fond sombre sous le seuil de contraste WCAG | Texte illisible, surtout public non technique | Vérifier contraste AA pour le texte ; réserver le néon aux accents non textuels |
| Animations non désactivables | Mal des transports, exclusion accessibilité | `prefers-reduced-motion` honoré partout |
| Numéraux arabes incohérents (latins vs arabes-indiens) | Lecture confuse pour l'audience arabe | Décider une convention de chiffres par locale et la tenir (scores, %, prix) |
| Gauge de score lue comme un % de gain | Promesse implicite | Libeller clairement « score d'analyse /100 », distinct du % track record |

## "Looks Done But Isn't" Checklist

- [ ] **% backtest affiché :** souvent manque le LABEL de provenance — vérifier qu'aucun % nu n'est rendu sans « mesuré par backtest » / « réel ».
- [ ] **pattern_stats + backtest :** souvent manque le discriminant `source` — vérifier qu'une requête SQL sépare backtest et live.
- [ ] **Backtest :** souvent manque la borne anti-look-ahead — vérifier que détection et replay n'utilisent jamais la même slice.
- [ ] **Reskin RTL :** souvent reste des propriétés physiques — grep `ml-/mr-/left-/right-` dans les nouveaux fichiers + test `dir=rtl`.
- [ ] **Thème :** souvent FOUC sur 1 des 4 combinaisons — tester volt/green × light/dark au reload, en RTL.
- [ ] **Routine Remote :** souvent marche en interactif seulement — vérifier un run Remote réel + network `*.supabase.co`.
- [ ] **Disclaimer/gating :** souvent retiré au reskin — vérifier `<Disclaimer />` global + gate abonné sur chaque page redesignée.
- [ ] **E2E :** souvent cassés par le reskin — faire tourner les 6 spec files (auth, gating, i18n, academie, signals-rls, affiliation) avant merge.
- [ ] **no-perf-claims :** souvent trop étroit — vérifier qu'il couvre les nouveaux composants NEXA (hero, marquee, gauges).
- [ ] **Quota :** souvent sous-estimé — vérifier le budget de runs vs 15/j partagés.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Backtest mélangé à live dans pattern_stats (P2) | HIGH | Migration `source`, purge des lignes backtest mal taguées, recalcul de la vue, ré-audit get_advisors |
| % non mesuré affiché publiquement (P1/P4) | HIGH (légal + confiance) | Retirer immédiatement l'affichage, corriger label/seuil, communiquer si déjà public |
| Promesse de gain réintroduite (P7) | HIGH (légal) | Retirer le visuel, grep complet, étendre no-perf-claims, revue |
| Look-ahead dans le backtest (P3) | MEDIUM | Re-borner détection/replay, recalculer tout le seed, re-tester golden |
| RTL cassé (P8) | LOW-MEDIUM | Remplacer propriétés physiques par logiques, re-test dir=rtl |
| FOUC thème (P13) | LOW | Ajouter script inline anti-flash dans head |
| Quota épuisé (P11) | LOW | Re-dimensionner/batcher les routines ; planifier bascule clé API |
| E2E cassés par reskin | LOW | Réaligner sélecteurs/role ; restaurer testids |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase (axe) | Verification |
|---------|------------------------|--------------|
| P1 % backtest sans label provenance | Axe 3 affichage | Test : pas de `winRatePct` rendu sans nœud provenance |
| P2 mélange backtest/live | Axe 3 migration (d'abord) | Requête SQL sépare source ; N stable au re-seed |
| P3 look-ahead backtest | Axe 3 moteur | Golden : bougie future n'altère pas la détection |
| P4 N<30 affiché | Axe 3 affichage | Tout % passe `applyThreshold` ; grep anti `*100` |
| P5 first-touch divergent | Axe 3 moteur | Backtest appelle `replayOutcome` ; goldens partagés |
| P6 survivorship/overfit | Axe 3 catalogue (avant moteur) | Catalogue figé avant résultats ; out-of-sample |
| P7 promesse de gain visuelle | Axe 1 hero/landing | no-perf-claims étendu ; grep mots-clés gain |
| P8 RTL cassé | Axe 1 fondation design | Grep propriétés physiques ; E2E dir=rtl |
| P9 bascule silencieuse | Axe 3 outcome-tracker | Label change avec provenance ; seuil documenté |
| P10 hallucination passe persist | Axe 2 routines | Aucun insert hors persist.ts ; champs sous Zod+guardrails |
| P11 quota épuisé | Axe 2 dimensionnement | Budget runs < 15/j ; monitoring conso |
| P12 MCP absent en Remote | Axe 2 config Environment | Run Remote réel réussi ; aucun appel MCP Supabase |
| P13 FOUC thème | Axe 1 fondation thèmes | Reload sans flash × 4 combinaisons × 3 locales |

## Sources

- Code RÉEL du repo (HIGH) : `supabase/migrations/0014_prediction_outcomes_pattern_stats.sql` (absence de colonne `source` — fait central P2), `packages/core/src/replay/outcome.ts` (`replayOutcome`, first-touch D-04), `packages/core/src/time/candle.ts` (`lastClosedCandleStart` anti look-ahead), `packages/core/src/track-record/threshold.ts` (`MIN_SAMPLE=30`, `applyThreshold`), `apps/jobs/src/jobs/persist.ts` (frontière de confiance, guardrails), `apps/web/src/lib/track-record/*` (re-exports vitrine).
- `docs/routines-claude.md` (HIGH) : quota ~15 runs/j partagé (§2), MCP Supabase absent en Remote (§4), secrets via Environments (§3), network `*.supabase.co` à confirmer (A1), fallback Task Scheduler (§5).
- `.planning/PROJECT.md` (HIGH) : contrainte légale dure « % jamais inventé », slogan MERA écarté (décisions 2026-06-20), bascule backtest→réel, design reconstruit.
- `.planning/research/PITFALLS.md` v2.0 (MEDIUM, contexte) : pièges on-chain/RLS/légal du milestone précédent, non re-couverts ici.
- E2E existants (HIGH, inventaire) : 6 spec files (`auth`, `gating`, `i18n`, `academie`, `signals-rls`, `affiliation-attribution`) utilisant role/testid — à protéger au reskin.

---
*Pitfalls research for: reskin NEXA trilingue RTL + routines Claude sans API + backtest/track record en prod*
*Researched: 2026-06-20*
