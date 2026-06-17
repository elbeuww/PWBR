# Phase 6: Canal Telegram public - Research

**Researched:** 2026-06-17
**Domain:** Telegram Bot API publication (grammY), idempotent jobs, bilingual FR+AR (RTL) formatting, Supabase aggregate reads
**Confidence:** HIGH (stack + repo patterns verified in code; Telegram API verified via official docs + grammY docs; RTL via W3C)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (research HOW, not WHETHER)
- **D-01 (TG-01)** — Rythme adaptatif, 3 formats : (a) **récap journalier groupé** (défaut, 1×/jour, trades clos 24h + win rate permanent) ; (b) **post dédié intraday** quand un trade clôt avec **R réalisé ≥ 2.0** ; (c) **post « win rate seul »** le **vendredi**.
- **D-02** — « Notable » = `realized_r ≥ 2.0` (mesuré jusqu'à TP1 par P5). **TP2 DÉFÉRÉ** — ne jamais inventer un statut TP2 inexistant en base.
- **D-03** — Champs par trade clos = **actif + direction + résultat + R réalisé** (ex. « EUR/USD Long — ✅ TP1 atteint, +2.3R »). **JAMAIS** les niveaux entrée/SL/TP. Résultat = TP1 atteint / SL touché / flat.
- **D-04 (TG-01)** — **Un seul canal**, un seul `channel_id`. Pas de canaux par langue.
- **D-05** — Posts bilingues **FR (haut) + séparateur + AR (RTL, bas)** dans **un message unique**. Pas d'anglais. Une seule notification par post.
- **D-06 (LEGAL-01)** — Disclaimer « contenu éducatif, pas un conseil en investissement, aucune promesse de gain » sur **chaque** post, **dans les deux langues**.
- **D-07 (TG-01)** — Job **HORAIRE**, aligné H1, exécuté **APRÈS** `outcome-tracker`.
- **D-08** — Récap quotidien au run **~21h UTC** (fin de session NY), fenêtre ~24h. Heure exacte = constante de config (aligner sur `packages/core/src/time/constants.ts`).
- **D-09** — Post « win rate seul » le **vendredi**.
- **D-10** — Jour sans trade clos : **POSTER QUAND MÊME** « Aucun trade clôturé aujourd'hui » + win rate permanent. Pas de skip silencieux.
- **D-11 (TG-02)** — Win rate sous N≥30 : « **échantillon insuffisant, N trades** », jamais de % inventé. Cohérence stricte avec vitrine P5 (`threshold.ts` MIN_SAMPLE=30, N toujours affiché).

### Claude's Discretion (à trancher au planning, voir sections ci-dessous)
- Schéma `telegram_posts` + clé d'idempotence (UNIQUE) → voir **§Architecture Patterns → Pattern 4**.
- Numéro de migration (0013 réservé P4, dernière disque = 0014) → voir **§Runtime State Inventory** : **prochain numéro = 0015**.
- Setup grammY 1.43 publication-only, secrets `.env` → voir **§Standard Stack** + **§Code Examples**.
- Dimension `pattern_stats` = win rate permanent global → voir **§Architecture Patterns → Pattern 5** : **(dimension='overall', bucket='all', period='all_time')**.
- Sélection des trades clos → voir **§Architecture Patterns → Pattern 6** + **§Open Questions Q1** (`resolved_at` vs `valid_until`).
- Format message (HTML vs MarkdownV2, emoji, séparateur, RTL) → voir **§Pattern 2 + §Pattern 3**.
- Heure UTC exacte + cron → voir **§Pattern 7**.

### Deferred Ideas (OUT OF SCOPE — ignorer)
- Tracking TP2 / TP partiels (touche moteur P5).
- Canaux multiples par langue (dont anglais).
- Interaction / commandes du bot (`/winrate`) — bot strictement publication-only.
- CTA/lien d'acquisition + analytics Telegram.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **TG-01** | Job publie auto les résultats journaliers des trades clos | Job grammY publication-only (§Stack), pattern miroir `outcome-tracker`/`subscription-expiry` (§Pattern 1), sélection trades clos (§Pattern 6), récap quotidien ~21h UTC (§Pattern 7) |
| **TG-02** | Posts affichent le win rate permanent à jour | Lecture `pattern_stats` (dimension='overall', period='all_time') via `patternStats.ts` + `applyThreshold` réutilisés tels quels (§Pattern 5) |
| **TG-03** | Posts idempotents (aucun double) + tracés | Table `telegram_posts` + contrainte UNIQUE par type (§Pattern 4) ; traçabilité via `runJob`/`job_runs` (§Pattern 1) |
| **LEGAL-01** (étendu) | Disclaimer bilingue sur chaque post | Disclaimer FR+AR ajouté à chaque template message (D-06, §Pattern 2) |
</phase_requirements>

## Summary

Cette phase ajoute **un seul nouveau job** (`apps/jobs/src/jobs/telegram-publish.ts`), **une seule nouvelle table** (`telegram_posts`, migration **0015**), **un repo** (`packages/supabase/src/repositories/telegramPosts.ts`), et **une seule nouvelle dépendance** (`grammy` 1.43.0, publication-only). Le job est un quasi-clone structurel de `subscription-expiry.ts` / `outcome-tracker.ts` : client service_role lazy, fonction `async () => Json`, enregistré dans `dispatch.ts`, tracé automatiquement par `runJob`/`job_runs` (TG-03 traçabilité — rien à coder). La source du win rate (`pattern_stats`) et la logique de seuil (`threshold.ts`) existent déjà depuis P5 et se réutilisent **telles quelles** — c'est l'invariant central de cohérence vitrine ↔ Telegram (D-11).

Les deux vraies zones de recherche sont : (1) le **formatage bilingue FR+AR RTL dans un message unique** — résolu par `parse_mode: 'HTML'` (3 caractères à échapper vs 18 pour MarkdownV2) + isolats bidi Unicode `U+2066`/`U+2069` pour les segments LTR (prix, tickers, R) noyés dans le bloc arabe ; (2) la **clé d'idempotence `telegram_posts`** — une colonne `dedupe_key` texte avec `UNIQUE` global, calculée différemment selon le type (`recap:YYYY-MM-DD`, `notable:<setup_id>`, `winrate:YYYY-MM-DD`), appliquée via `insert ... onConflict ignoreDuplicates` (miroir exact de `insertOutcomes`).

Un point subtil à trancher au planning (§Open Q1) : `prediction_outcomes.resolved_at` = l'instant où `outcome-tracker` a tourné, **pas** l'instant de clôture réelle du trade (`trade_setups.valid_until`). La « fenêtre 24h » du récap (D-08) et le filtre « notable fraîchement clos » (D-07) doivent borner sur **`resolved_at`** (= ce que le job vient de voir apparaître), sinon le « fil de l'eau » est faux.

**Primary recommendation:** Cloner `outcome-tracker.ts` → `telegram-publish.ts` ; ajouter migration 0015 `telegram_posts(dedupe_key text unique, post_type, posted_at, tg_message_id, run_id?)` ; `pnpm --filter jobs add grammy@1.43.0` (après vetting déjà fait ici : OK) ; bot = `new Bot(token)`, post via `bot.api.sendMessage(chatId, html, { parse_mode:'HTML', disable_web_page_preview:true })` ; lire le win rate via `getPatternStats(anonOrServiceClient)` + `applyThreshold` sur la ligne `overall/all/all_time` ; HTML + isolats bidi pour le bloc AR.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Publication Telegram | **Job (apps/jobs, service_role)** | — | Single-writer / backend ; jamais côté web (frontière producteur-unique, D-V2-01) |
| Lecture win rate permanent | **DB view `pattern_stats`** | Job (lecture) | Agrégats only ; même source que la vitrine P5 → cohérence garantie |
| Sélection trades clos | **DB (`prediction_outcomes` + `trade_setups` + `instruments`)** | Job (jointure/lecture service_role) | Données par-setup lues server-side uniquement ; D-03 limite ce qui est publié |
| Idempotence | **DB (contrainte UNIQUE `telegram_posts.dedupe_key`)** | Job (sélection bornée niveau 1) | Filet DB inviolable (miroir `UNIQUE(tx_hash)` P4, `onConflict` P5) |
| Traçabilité (TG-03) | **DB (`job_runs`)** | `runJob` wrapper | Déjà en place — rien à coder |
| Formatage FR+AR | **Job (pur, packages/core ou inline)** | — | Logique pure testable (golden), zéro I/O |
| Secrets (token, channel_id) | **`apps/jobs/.env`** | — | Jamais en code/DB (contrainte projet) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `grammy` | **1.43.0** (pin) | Client Telegram Bot API — `Bot` + `bot.api.sendMessage` | Verrouillé CONTEXT/D-V2-02. SDK TS-natif le plus maintenu, ~3.5M dl/sem `[VERIFIED: npm registry — 3 565 069 dl 2026-06-09..15]`. latest npm = 1.44.0 ; **rester sur 1.43.0** (CONTEXT lock). Publication-only = on n'utilise que `bot.api`, jamais `bot.start()`/long-polling/webhook. |

### Supporting (déjà installés — réutiliser, NE PAS réinstaller)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `luxon` | 3.7.2 | Fenêtre 24h, jour-UTC du `dedupe_key`, détection « vendredi », heure récap | `DateTime.now({zone:'UTC'})`, `.toISODate()`, `.weekday===5` (vendredi) `[VERIFIED: apps/jobs/package.json]` |
| `pino` | 10.3.1 | Logs structurés du job | Déjà la norme jobs `[VERIFIED: apps/jobs/package.json]` |
| `p-retry` | 8.0.0 | Backoff sur 429 Telegram (ESM only) | Optionnel — voir §Pattern 3. Déjà utilisé (`finnhub/client.ts`) `[VERIFIED: packages/data-sources/package.json]` |
| `p-limit` | 7.3.0 | Borne la concurrence d'envoi (marginal pour 1-3 msg/run) | Optionnel `[VERIFIED: packages/data-sources/package.json]` |
| `dotenv` | ^16.4.5 | `import 'dotenv/config'` en tête de job | Norme jobs `[VERIFIED: apps/jobs/package.json]` |
| `@supabase/supabase-js` | 2.108.0 | Client service_role lazy | Norme jobs `[VERIFIED]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `grammy` minimal `bot.api` | `@grammyjs/auto-retry` 2.0.2 (plugin officiel, auto-attend `retry_after`) | Plugin propre (1 dep `debug`, peer grammy ^1.10, ~20k dl/sem `[VERIFIED: npm]`). **MAIS** ajoute une 2e dépendance pour un job 1-3 msg/run. **Reco : ne PAS l'ajouter** ; envelopper `sendMessage` dans le `p-retry` déjà présent (§Pattern 3). À reconsidérer si volume augmente. |
| `grammy` | `node-telegram-bot-api`, `telegraf` | grammy = meilleur TS, maintenu, déjà verrouillé. `telegraf` moins actif ; `node-telegram-bot-api` JS non typé. `[ASSUMED]` |
| `parse_mode:'HTML'` | `MarkdownV2` | MarkdownV2 = 18 chars à échapper hors entités, casse facile avec emoji + ponctuation arabe. HTML = 3 chars (`<`,`>`,`&`). **Reco : HTML** `[CITED: core.telegram.org/bots/api]` |

**Installation:**
```bash
pnpm --filter jobs add grammy@1.43.0
```

**Version verification (effectuée 2026-06-17):**
```
npm view grammy version          → 1.44.0 (latest) ; 1.43.0 publié et disponible
npm view grammy dependencies     → @grammyjs/types 3.28.0, abort-controller ^3, debug ^4.4.3, node-fetch ^2.7.0
npm view grammy scripts          → { prepare:'npm run backport', backport:'deno2node ...' }  ← scripts de BUILD (git source), PAS un postinstall réseau du tarball npm
```

## Package Legitimacy Audit

slopcheck non disponible dans l'environnement → vetting manuel via npm registry + repo officiel.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `grammy` | npm | mature (1.43/1.44, dev actif, modifié 2026-06-14) | **3.56M/sem** | github.com/grammyjs/grammY (maintainer `knorpelsenf` = fondateur grammY) | OK | **Approuvé** — pin 1.43.0 |
| `@grammyjs/auto-retry` | npm | 2.0.2 (2025-03-01) | ~20k/sem | org grammyjs officielle | OK | **Non retenu** (évite 2e dep ; p-retry suffit) |

**Transitive deps de grammy** (4) : `@grammyjs/types` (org officielle), `abort-controller`, `debug`, `node-fetch@2` — toutes ultra-courantes, aucune nouvelle surface suspecte.
**postinstall réseau ?** Non. `scripts` = `prepare`/`backport` (build deno2node depuis la source git, ne s'exécute pas depuis le tarball npm publié). Aucun fetch/CDN/télémétrie à l'install.
**Packages removed [SLOP]:** none.
**Packages flagged [SUS]:** none.

> grammy est verrouillé au niveau projet (CLAUDE.md D-V2-02) et vérifié ici (downloads massifs, repo officiel, transitive deps minimales, pas de postinstall réseau). Le planner peut traiter l'install comme **approuvée** ; un `checkpoint:human-verify` léger reste cohérent avec la rigueur projet mais n'est pas un blocage « argent » comme la lib QR P4 (le job Telegram ne touche pas au bundle client ni aux paiements).

## Architecture Patterns

### System Architecture Diagram

```
                       Scheduler (Claude routine | Windows Task Scheduler)
                         |  tsx src/dispatch.ts telegram-publish
                         v
                   dispatch.ts (JOB_REGISTRY) ──> runJob('telegram-publish', fn)
                         |                              |
                         |                       startRun → job_runs (running)   [TG-03 trace]
                         v                              |
              telegramPublish()  (service_role lazy client)
                         |
        ┌────────────────┼───────────────────────────────────┐
        v                v                                     v
  pattern_stats     prediction_outcomes  + trade_setups        telegram_posts
  (overall/all/      + instruments        (window borné        (SELECT dedupe_key
   all_time)         (trades clos récents)  sur resolved_at)     déjà postés = niveau 1)
        |                |                                     |
        v                v                                     |
   applyThreshold   sélection: décide format (D-01)            |
   (N≥30, D-11)       - récap quotidien (~21h UTC)             |
        |              - notable (realized_r≥2.0)              |
        |              - winrate-seul (vendredi)               |
        └──────┬─────────┘                                     |
               v                                               |
        formatMessage(FR + sep + AR-RTL + disclaimer)          |
        (pur, golden-testable ; HTML escape + bidi isolates)   |
               |                                               |
               v                                               |
        bot.api.sendMessage(channelId, html,                   |
           {parse_mode:'HTML', disable_web_page_preview:true}) |
               | (p-retry sur 429 retry_after)                 |
               v                                               v
         Telegram channel  ──(success)──> INSERT telegram_posts(dedupe_key,...)
                                          onConflict ignoreDuplicates   [TG-03 idempotence niveau 2]
                         |
                  finishRun → job_runs (success + stats Json)  [TG-03 trace]
```

### Recommended Project Structure
```
apps/jobs/src/jobs/
  telegram-publish.ts              # NOUVEAU job (clone outcome-tracker.ts)
  __tests__/telegram-publish.test.ts  # NOUVEAU (mock client + mock bot.api)
apps/jobs/src/dispatch.ts          # MODIF : import + entrée JOB_REGISTRY
packages/core/src/telegram/        # NOUVEAU (optionnel) : formatMessage pur + escape + bidi
  format.ts                        #   golden-testable, zéro I/O
  format.test.ts
packages/supabase/src/repositories/
  telegramPosts.ts                 # NOUVEAU repo (insertPost onConflict + getPostedKeys)
packages/supabase/src/database.types.ts  # MODIF : telegram_posts Row/Insert/Update (post gen types)
supabase/migrations/
  0015_telegram_posts.sql          # NOUVELLE migration (PAS 0013)
apps/jobs/.env                     # MODIF : TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL_ID
.env.example                       # MODIF : documenter les 2 vars (sans valeurs)
```

### Pattern 1: Job idempotent service_role tracé (miroir exact P5)
**What:** Le job clone la structure de `outcome-tracker.ts` / `subscription-expiry.ts`.
**When to use:** Toujours pour ce job. NE PAS réinventer la traçabilité — `runJob` la fournit.
**Squelette:**
```typescript
// Source: apps/jobs/src/jobs/outcome-tracker.ts (porté tel quel)
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { Json, Database } from '@app/supabase'

function getServiceClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) throw new Error('telegram-publish: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env')
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function telegramPublish(): Promise<Json> {
  const client = getServiceClient()
  // 1. lire win rate (pattern_stats overall/all/all_time) → applyThreshold
  // 2. lire trades clos récents (resolved_at window) + déjà-postés (telegram_posts)
  // 3. décider format(s) (récap quotidien / notable / winrate-vendredi)
  // 4. pour chaque post à envoyer non déjà fait : formatMessage → bot.api.sendMessage
  // 5. INSERT telegram_posts(dedupe_key,...) onConflict ignoreDuplicates
  return { posted, skipped } as Json
}
```
Enregistrement dans `dispatch.ts` (miroir l.50-52) :
```typescript
import { telegramPublish } from './jobs/telegram-publish'
// ... dans JOB_REGISTRY :
'telegram-publish': telegramPublish,
```
`runJob` enveloppe déjà l'écriture `job_runs` (TG-03) — **ne rien coder de plus pour la traçabilité**.

### Pattern 2: Message bilingue FR + AR, parse_mode HTML, disclaimer
**What:** Un message unique : bloc FR en haut, séparateur, bloc AR (RTL) en bas, disclaimer bilingue (D-05/D-06).
**Décision : `parse_mode: 'HTML'`** — 3 chars à échapper (`<` `>` `&`) vs 18 pour MarkdownV2 ; robuste avec emoji + ponctuation arabe `[CITED: core.telegram.org/bots/api]`.
**Échappement obligatoire** : tout texte injecté (ticker, R, N) doit passer par un escape HTML (`&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`) AVANT insertion dans le template. Les tickers (`EUR/USD`) ne contiennent pas ces chars mais l'escape doit être systématique (règle « never trust » même pour données internes).
**Structure recommandée:**
```typescript
// Source: pattern dérivé de core.telegram.org/bots/api (HTML style) + W3C bidi
// Bloc FR (LTR par défaut) :
//   📊 Récap du <date>
//   ✅ EUR/USD Long — TP1 atteint, +2.3R
//   ❌ BTC/USDT Short — SL touché, -1.0R
//   📈 Win rate permanent : 58% (N=142)        // ou « échantillon insuffisant, N=12 » si N<30
//   — disclaimer FR —
//   ────────────
//   — bloc AR (voir Pattern 3) —
```
**Disclaimer (D-06)** — texte court bilingue présent sur CHAQUE post :
- FR : « ⚠️ Contenu éducatif — pas un conseil en investissement, aucune promesse de gain. »
- AR : « ⚠️ محتوى تعليمي — ليس نصيحة استثمارية، ولا وعد بأي ربح. »
Réutiliser la copy exacte des disclaimers P2 (`apps/web` messages `legal`/`disclaimer` namespaces) pour cohérence plateforme ↔ Telegram. `[CITED: D-02-02-C — <Disclaimer> RSC, EN « No promise of gains »]`

### Pattern 3: RTL arabe + segments LTR (prix/ticker/R) dans le même message
**What:** Le bloc arabe est RTL ; mais les tickers (`EUR/USD`), nombres (`+2.3R`, `58%`, `N=142`) et emoji directionnels doivent rester lisibles LTR sans casser l'ordre visuel.
**Mécanisme : isolats bidi Unicode (Unicode 6.3+, préférés aux embeddings)** `[CITED: w3.org/International/questions/qa-bidi-unicode-controls]` :
- Envelopper chaque segment LTR (ticker, nombre, R) dans `U+2066` (LRI, Left-To-Right Isolate) … `U+2069` (PDI, Pop Directional Isolate).
- Le bloc arabe lui-même peut être préfixé d'un `U+200F` (RLM) ou rendu naturellement RTL par Telegram (le client détecte le premier caractère fort). Préfixer le bloc AR d'un RLM (`‏`) garantit l'alignement RTL même si la ligne commence par un emoji ou un chiffre.
```typescript
const LRI = '⁦', PDI = '⁩', RLM = '‏'
function ltr(s: string): string { return `${LRI}${s}${PDI}` }   // pour ticker/R/% noyés en arabe
const arLine = `${RLM}✅ ${ltr('EUR/USD')} ${arResultText} ${ltr('+2.3R')}`
```
**Pourquoi isolats et pas embeddings (`U+202A`/`U+202B`)** : les isolats n'affectent pas le texte environnant → pas d'effet de bord, pas de « bidi spoofing » `[CITED: w3.org — isolates encouraged over embeddings]`.
**Limite de longueur** : un message Telegram = **4096 caractères** `[CITED: core.telegram.org/bots/api — sendMessage text 1-4096]`. Un récap bilingue de N trades peut dépasser si N grand. **Reco** : borner le récap (ex. top ~10 trades clos par |R|, ou résumer « +X autres ») et garder le message < ~3500 chars de marge. À documenter comme garde-fou (§Pitfall 3).

### Pattern 4: Schéma `telegram_posts` + clé d'idempotence (TG-03) — Claude's Discretion TRANCHÉ
**What:** Une table qui garantit qu'un même « événement publiable » n'est posté qu'une fois, quel que soit le nombre de re-runs horaires.
**Décision : une colonne `dedupe_key` texte avec `UNIQUE` GLOBAL** (miroir `UNIQUE(tx_hash)` P4 + `onConflict ignoreDuplicates` P5). Le type de post détermine la forme de la clé :

| Type de post | `dedupe_key` | Granularité d'idempotence |
|--------------|--------------|---------------------------|
| Récap quotidien | `recap:<YYYY-MM-DD UTC>` | 1 récap par jour-UTC (D-08/D-10) |
| Notable intraday | `notable:<setup_id>` | 1 post dédié par trade (D-01/D-02) |
| Win rate seul (vendredi) | `winrate:<YYYY-MM-DD UTC>` | 1 post hebdo par jour-UTC du vendredi (D-09) |

**Migration recommandée (0015) :**
```sql
-- Source: miroir 0012 (UNIQUE tx_hash) + 0014 (PK idempotence) ; appliquer via MCP apply_migration
create table public.telegram_posts (
  id          uuid        primary key default gen_random_uuid(),
  dedupe_key  text        not null unique,                          -- idempotence GLOBALE (TG-03)
  post_type   text        not null check (post_type in ('recap','notable','winrate')),
  posted_at   timestamptz not null default now(),
  tg_message_id bigint,                                             -- id retourné par sendMessage (traçabilité)
  run_id      uuid        references public.job_runs(id) on delete set null  -- lien job_runs (optionnel)
);
alter table public.telegram_posts enable row level security;
-- Frontière producteur-unique : écriture service_role bypass — AUCUNE policy write.
-- Lecture : aucune policy (table interne au job) OU select authenticated si besoin admin futur.
```
**Pattern d'insert idempotent (miroir `insertOutcomes`) :**
```typescript
// Source: packages/supabase/src/repositories/predictionOutcomes.ts (porté)
await client.from('telegram_posts')
  .upsert([{ dedupe_key, post_type, tg_message_id, run_id }], { onConflict: 'dedupe_key', ignoreDuplicates: true })
```
**Ordre critique (anti double-post) :** envoyer `sendMessage` PUIS insérer `telegram_posts`. Mais sélectionner d'abord les `dedupe_key` déjà présents (niveau 1) pour ne pas re-poster. Race possible si 2 runs simultanés (improbable : cron horaire séquentiel) → le `UNIQUE` est le filet. **Subtilité** : si `sendMessage` réussit mais l'INSERT échoue, le prochain run re-postera (pas de clé en base). Mitigation pragmatique acceptable pour ce volume ; à noter (§Pitfall 2). Alternative plus stricte : INSERT d'abord (réserve la clé), puis sendMessage, puis si échec marquer/supprimer — plus complexe, non recommandé au MVP.

### Pattern 5: Lecture du win rate permanent (TG-02) — dimension TRANCHÉE
**What:** Le « win rate permanent » global = la ligne `pattern_stats` **(dimension='overall', bucket='all', period='all_time')** `[VERIFIED: supabase/migrations/0014 l.85-92]`.
**Réutiliser tel quel** (cohérence vitrine ↔ Telegram, D-11) :
```typescript
// Source: apps/web/src/lib/track-record/patternStats.ts + threshold.ts (P5)
import { getPatternStats } from '...patternStats'      // ou requête directe service_role
import { applyThreshold } from '...threshold'           // MIN_SAMPLE=30
const { rows } = await getPatternStats(client)
const overall = rows.find(r => r.dimension === 'overall' && r.period === 'all_time')
const res = applyThreshold({ n: overall?.n ?? 0, win_rate: overall?.win_rate ?? null, expectancy: overall?.expectancy ?? null, avg_r: overall?.avg_r ?? null })
// res.sufficient ? `${res.winRatePct}% (N=${res.n})` : `échantillon insuffisant, N=${res.n}`  (D-11)
```
**Note client** : `patternStats.ts` est typé `AnonClient` mais le SELECT marche aussi avec le service client (service_role lit tout). Le planner peut soit importer `getPatternStats` directement (le grant SELECT est `anon, authenticated` — service_role bypass aussi), soit dupliquer la mini-requête côté `packages/supabase`. **Reco** : importer la fonction P5 pour ne pas dupliquer la forme de requête (1 source de vérité). Si l'import cross-app (jobs → web/lib) gêne le graphe de packages (D-49), extraire la lecture dans un repo `packages/supabase` partagé. **À trancher au planning** (§Open Q2).

### Pattern 6: Sélection des trades clos pour récap/notable
**What:** Lire les trades fraîchement résolus depuis `prediction_outcomes` joint à `trade_setups` (direction) + `instruments` (ticker/symbole).
```sql
-- conceptuel (service_role) : trades résolus dans la fenêtre + champs D-03 only
select o.setup_id, o.outcome, o.realized_r, o.resolved_at,
       ts.direction, i.symbol      -- D-03 : actif + direction + résultat + R ; JAMAIS entry/sl/tp
from prediction_outcomes o
join trade_setups ts on ts.id = o.setup_id
join instruments  i on i.id = ts.instrument_id
where o.resolved_at >= :window_start    -- voir Open Q1 : resolved_at, pas valid_until
order by o.resolved_at desc;
```
- **Notable (D-02)** : `where realized_r >= 2.0 and resolved_at >= :last_run_window` ET `notable:<setup_id>` absent de `telegram_posts`.
- **Récap (D-08)** : `where resolved_at >= now()-24h` au run ~21h UTC ; si vide → D-10 (poster « aucun trade » + win rate).
- **Mapping résultat → texte (D-03)** : `hit_tp`→« ✅ TP1 atteint », `hit_sl`→« ❌ SL touché », `flat`→« ➖ clôture neutre (flat) ». Sémantique = `replayOutcome` P5 `[VERIFIED: packages/core/src/replay/outcome.ts]`.

### Pattern 7: Cadence horaire + sélection du format + heure récap
**What:** Le job tourne **chaque heure** (D-07), après `outcome-tracker`. À chaque run il décide quels post(s) émettre :
```typescript
import { DateTime } from 'luxon'
const now = DateTime.now().setZone('UTC')
const isFriday = now.weekday === 5                      // luxon : 1=lundi..7=dimanche
const isRecapHour = now.hour === RECAP_HOUR_UTC         // constante config, ~21 (D-08)
// 1. notables fraîchement résolus (chaque run)        → post(s) notable
// 2. si isRecapHour                                    → récap quotidien (ou « aucun trade » D-10)
// 3. si isFriday && <run approprié>                    → post winrate-seul (D-09)
```
**Constante d'heure** : ajouter `RECAP_HOUR_UTC = 21` (ou aligner sur `DAILY_ANCHOR` D-09 du cœur). Mettre la constante près de `packages/core/src/time/constants.ts` (D-08) ou dans un module config du job. `UTC_ZONE='UTC'` existe déjà `[VERIFIED: packages/core/src/time/constants.ts]`.
**Cron** : Windows Task Scheduler via `apps/jobs/windows/run-job.cmd telegram-publish` (horaire). Routine Claude : `tsx src/dispatch.ts telegram-publish`. **Ordre** : programmer APRÈS `outcome-tracker` (décalage de quelques minutes) pour que les outcomes de l'heure soient en base.

### Anti-Patterns to Avoid
- **Coder la traçabilité `job_runs` à la main** → `runJob` la fait déjà. Juste retourner un `Json` stats.
- **Utiliser `bot.start()` / long-polling / webhook** → c'est publication-only. Seul `bot.api.sendMessage` est utilisé. Ne JAMAIS démarrer un listener.
- **MarkdownV2** → échappement fragile avec emoji + arabe. HTML.
- **Embeddings bidi (`U+202A/B`)** → utiliser les isolats `U+2066/2069`.
- **Lire `prediction_outcomes` par-setup côté web** → frontière D-05/D-07 ; le job (service_role) lit, le web ne lit que `pattern_stats`. Le canal est public mais D-03 limite les champs publiés.
- **Réinventer le seuil N≥30** → `applyThreshold` (threshold.ts) est la source unique.
- **Numéro de migration 0013** → réservé P4 différé. Prochain = **0015**.
- **Mettre le token/channel_id en DB ou en dur** → `apps/jobs/.env` uniquement.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Appel Telegram Bot API | client HTTP `fetch` maison | `grammy` `bot.api.sendMessage` | Gère sérialisation, erreurs typées, méthodes API à jour |
| Backoff sur 429 | boucle retry maison | `p-retry` (déjà présent) sur l'appel sendMessage | Backoff exponentiel testé ; ou `@grammyjs/auto-retry` (non retenu, §Alternatives) |
| Traçabilité d'exécution | INSERT job_runs maison | `runJob` wrapper | Déjà en place (TG-03) |
| Seuil d'échantillon N≥30 | re-coder MIN_SAMPLE | `applyThreshold` (threshold.ts P5) | Cohérence stricte vitrine ↔ Telegram (D-11) |
| Win rate / agrégats | re-calculer depuis prediction_outcomes | vue `pattern_stats` (P5) | Source unique, agrégats only |
| Résultat d'un trade (hit_tp/sl/flat + R) | re-rejouer | lire `prediction_outcomes` (écrit par outcome-tracker) | Le replay est fait en amont (P5) |
| Idempotence | flag applicatif | contrainte `UNIQUE(dedupe_key)` + onConflict | Filet DB inviolable (miroir P4/P5) |
| Manipulation fuseaux/jour-UTC/vendredi | `Date` natif | `luxon` (déjà présent) | DST/zone-safe (norme jobs) |

**Key insight:** ~80% de cette phase est de l'assemblage de briques P5 existantes. Le seul code vraiment neuf et testable est `formatMessage` (pur, golden) + la décision de format + la clé d'idempotence.

## Runtime State Inventory

> Phase greenfield-côté-code (nouveau job + nouvelle table), mais touche du state runtime externe (Telegram + scheduler + secrets). Inventaire requis.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | Nouvelle table `telegram_posts` (state d'idempotence). Aucune donnée existante à migrer. | Migration **0015** (créer la table). Aucune migration de données. |
| **Live service config** | **Canal Telegram + bot** : créés hors git (via @BotFather + Telegram). Le bot DOIT être **admin du canal** avec droit « Post Messages », sinon `sendMessage` échoue (403). `chat_id` numérique `-100…` du canal (préféré au `@username`) `[CITED: search — numeric -100 reliable]`. | Étape ops hors-code (checkpoint) : créer bot, créer canal, ajouter bot admin, récupérer `chat_id` numérique. |
| **OS-registered state** | Windows Task Scheduler : nouvelle tâche horaire `run-job.cmd telegram-publish`, ordonnée APRÈS `outcome-tracker`. | Enregistrer la tâche (ops). Routine Claude équivalente. |
| **Secrets/env vars** | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL_ID` — **nouveaux**, dans `apps/jobs/.env` (jamais en code/DB). À ajouter aussi dans `.env.example` (sans valeurs). | Provisionner les 2 vars (ops). Le job throw si absentes (miroir pattern `getServiceClient`). |
| **Build artifacts** | `pnpm add grammy` modifie `apps/jobs/package.json` + lockfile. `database.types.ts` à régénérer après apply 0015 (ajouter `telegram_posts` Row/Insert/Update + réappliquer les aliases maison, cf. D-05-02-F). | `pnpm install` ; `generate_typescript_types` via MCP après apply LIVE. |

**Migration numbering — verified:** Dernière sur disque = `0014_prediction_outcomes_pattern_stats.sql`. `0013` ABSENT (réservé cluster paiement P4 différé). **Prochain numéro libre = `0015`** `[VERIFIED: glob supabase/migrations — 0001..0012, 0014 présents ; 0013 absent]`.

## Common Pitfalls

### Pitfall 1: `resolved_at` ≠ heure de clôture réelle du trade
**What goes wrong:** Le récap « 24h » et le « fil de l'eau » notable bornent sur la mauvaise colonne et ratent ou dupliquent des trades.
**Why:** `prediction_outcomes.resolved_at = now()` au moment où `outcome-tracker` insère `[VERIFIED: 0014 l.33 default now()]`. Ce n'est PAS `trade_setups.valid_until` (clôture réelle). Comme telegram-publish tourne juste après outcome-tracker, `resolved_at ≈ instant de détection` → c'est en fait la bonne base pour le « fil de l'eau » (on poste ce qu'on vient de voir résoudre), mais le récap « clos sur 24h » est ambigu.
**How to avoid:** Trancher au planning (§Open Q1). Reco : borner notable + récap sur `resolved_at` (cohérent avec « le job détecte les fraîchement clos »), et documenter que « clos aujourd'hui » = « résolu aujourd'hui ». Le `dedupe_key notable:<setup_id>` empêche tout double-post même si la fenêtre se recouvre.
**Warning signs:** un trade apparaît 2 jours de suite dans le récap, ou un notable posté en double.

### Pitfall 2: sendMessage OK mais INSERT telegram_posts échoue → re-post au prochain run
**What goes wrong:** Message envoyé, clé non persistée → doublon à l'heure suivante.
**Why:** Deux opérations non atomiques (Telegram réseau + DB).
**How to avoid:** Volume faible → risque marginal. Accepter et logger l'échec d'INSERT bruyamment (pino error). Ne PAS tenter une transaction distribuée. Documenter comme limite connue.
**Warning signs:** `job_runs.stats` montre `posted>0` mais `telegram_posts` ne grossit pas.

### Pitfall 3: dépassement des 4096 caractères sur un gros récap bilingue
**What goes wrong:** `sendMessage` rejette (400) si `text` > 4096.
**Why:** Récap = N trades × 2 langues + disclaimer bilingue.
**How to avoid:** Borner le nombre de trades détaillés (top par |R| ou « +X autres trades »), viser < ~3500 chars. Tester avec un récap à fort N. `[CITED: core.telegram.org/bots/api — text 1-4096]`
**Warning signs:** erreur 400 « message is too long ».

### Pitfall 4: bot non-admin du canal → 403
**What goes wrong:** `sendMessage` lève `403 Forbidden: bot is not a member of the channel chat` (ou « not enough rights »).
**Why:** Le bot doit être ajouté comme **administrateur** avec droit Post Messages.
**How to avoid:** Étape ops (checkpoint) : ajouter le bot admin du canal AVANT le 1er run. Le job doit gérer l'erreur (la remonter dans `job_runs.stats.errors`, ne pas la masquer).
**Warning signs:** 403 dès le premier envoi.

### Pitfall 5: échappement HTML oublié → message cassé ou injection de balise
**What goes wrong:** Un caractère `<`/`>`/`&` dans une donnée casse le parsing HTML Telegram (400) ou injecte une balise.
**Why:** `parse_mode:'HTML'` interprète les balises.
**How to avoid:** Fonction `escapeHtml()` appliquée à TOUTE donnée dynamique avant insertion dans le template. Golden-tester. `[CITED: core.telegram.org/bots/api — HTML style]`
**Warning signs:** 400 « can't parse entities ».

### Pitfall 6: régénération `database.types.ts` écrase les aliases maison
**What goes wrong:** `generate_typescript_types` supprime les aliases de convenance (PredictionOutcomeInsert, etc.).
**Why:** Connu en P5 (D-05-02-F).
**How to avoid:** Après apply 0015 + gen types, réappliquer le bloc d'aliases en fin de fichier + ajouter `TelegramPost{Row,Insert,Update}`. `[VERIFIED: STATE.md D-05-02-F]`

## Code Examples

### Bot publication-only (grammy 1.43)
```typescript
// Source: grammy.dev (bot.api usage) — publication-only, jamais bot.start()
import { Bot } from 'grammy'
function getBot(): Bot {
  const token = process.env['TELEGRAM_BOT_TOKEN']
  if (!token) throw new Error('telegram-publish: TELEGRAM_BOT_TOKEN must be set in apps/jobs/.env')
  return new Bot(token)   // pas de bot.start() — on n'utilise que bot.api
}
function getChannelId(): string {
  const id = process.env['TELEGRAM_CHANNEL_ID']
  if (!id) throw new Error('telegram-publish: TELEGRAM_CHANNEL_ID must be set in apps/jobs/.env')
  return id   // forme numérique '-100…' recommandée
}
```

### Envoi avec retry sur 429
```typescript
// Source: pattern p-retry de packages/data-sources/src/finnhub/client.ts
import pRetry from 'p-retry'
async function sendPost(bot: Bot, chatId: string, html: string): Promise<number> {
  const msg = await pRetry(
    () => bot.api.sendMessage(chatId, html, { parse_mode: 'HTML', disable_web_page_preview: true }),
    { retries: 3 },   // grammy expose err.parameters.retry_after sur 429 ; p-retry backoff sinon
  )
  return msg.message_id
}
```
> Note : grammy lève `GrammyError` avec `error_code:429` et `parameters.retry_after`. Pour respecter exactement `retry_after`, lire `e.parameters?.retry_after` dans un `onFailedAttempt` (ou adopter `@grammyjs/auto-retry`). Au volume du job (1-3 msg/run), le backoff p-retry par défaut suffit. `[CITED: grammy.dev/advanced/flood ; gramio.dev/rate-limits]`

### escapeHtml + isolats bidi
```typescript
const LRI = '⁦', PDI = '⁩', RLM = '‏'
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
export function ltr(s: string): string { return `${LRI}${escapeHtml(s)}${PDI}` }
// ligne arabe : préfixe RLM + segments LTR isolés
// `${RLM}✅ ${ltr('EUR/USD')} ${arResult} ${ltr('+2.3R')}`
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MarkdownV1 (`parse_mode:'Markdown'`) | HTML ou MarkdownV2 | Bot API 4.x | MarkdownV1 déprécié ; HTML = plus sûr pour notre cas |
| Embeddings bidi `U+202A/202B` | Isolats `U+2066/2067/2069` | Unicode 6.3 (2013) | Isolats préférés, pas d'effet de bord `[CITED: w3.org]` |
| node-telegram-bot-api (JS) | grammy (TS-natif) | écosystème 2021+ | TS strict, maintenu |

**Deprecated/outdated:** MarkdownV1 ; embeddings bidi ; `bot.start()` non pertinent ici (publication-only).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `chat_id` numérique `-100…` préféré au `@username` pour fiabilité | Pattern 4 / Pitfall 4 | Faible — `@username` marche aussi pour un canal public ; numérique = plus robuste si le canal est renommé |
| A2 | Au volume du job, le backoff p-retry suffit (pas besoin de @grammyjs/auto-retry) | Stack / Pattern 3 | Faible — 1-3 msg/run << 30 msg/s ; si volume monte, ajouter le plugin |
| A3 | Borner récap + notable sur `resolved_at` est correct pour le « fil de l'eau » | Pitfall 1 / Open Q1 | Moyen — décision produit à confirmer ; dedupe_key protège contre les doublons quoi qu'il arrive |
| A4 | Importer `getPatternStats` (web/lib) depuis le job est acceptable, sinon extraire en repo | Pattern 5 / Open Q2 | Faible — au pire dupliquer la mini-requête dans packages/supabase |
| A5 | Disclaimer AR rédigé ici est une traduction de travail — la copy juridique finale vient du juriste (LEGAL-02) | Pattern 2 | Moyen — texte légal ; utiliser la copy validée P2 si disponible, sinon flag human-verify |
| A6 | grammy 1.43.0 est installable (npm latest=1.44.0, lock CONTEXT=1.43) | Stack | Faible — 1.43.0 confirmé présent sur le registre |

## Open Questions

1. **Fenêtre de sélection : `resolved_at` vs `valid_until` ?**
   - Ce qu'on sait : `resolved_at` = instant d'insertion par outcome-tracker ; `valid_until` = clôture théorique du setup.
   - Ce qui est flou : « trades clos sur 24h » (D-08) signifie-t-il « résolus » ou « expirés » dans la fenêtre ?
   - Recommandation : **`resolved_at`** (le job poste ce qu'il vient de voir résoudre — vrai « fil de l'eau » D-07). Documenter dans le post que « clos aujourd'hui » = « résolu aujourd'hui ». `dedupe_key` garantit l'absence de doublon.

2. **Lecture win rate : importer `getPatternStats` (apps/web/lib) ou extraire un repo partagé ?**
   - Ce qu'on sait : la fonction existe, typée AnonClient ; service_role la consomme aussi (grant anon+authenticated, bypass service).
   - Ce qui est flou : import cross-app jobs→web/lib vs graphe de packages (D-49).
   - Recommandation : extraire une lecture minimale dans `packages/supabase` (repo `patternStats.ts`) que web ET jobs importent — source unique, graphe propre. Sinon import direct si toléré.

3. **Format exact / longueur du récap (cap N trades) ?**
   - Recommandation : top ~10 par |R| + « +X autres », < 3500 chars (Pitfall 3). À figer dans l'UI-SPEC du plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Telegram Bot (token) | TG-01/02/03 | ✗ (à provisionner ops) | — | aucune — bloque l'envoi réel (checkpoint human) |
| Canal Telegram + bot admin | TG-01 | ✗ (à créer ops) | — | aucune — `sendMessage` échoue sans (Pitfall 4) |
| `TELEGRAM_CHANNEL_ID` | TG-01 | ✗ | — | aucune |
| grammy 1.43.0 | client TG | ✗ (à `pnpm add`) | 1.43.0 | aucune (verrouillé) |
| Supabase (pattern_stats, prediction_outcomes) | TG-02/01 | ✓ (P5 live, migration 0014) | — | — |
| outcome-tracker job | données d'entrée | ✓ (P5) | — | — |
| luxon / pino / p-retry | job | ✓ | 3.7.2 / 10.3.1 / 8.0.0 | — |

**Missing dependencies with no fallback (bloquent l'exécution réelle, pas le code) :**
- Token bot + canal + bot admin + `chat_id` → **checkpoint ops/human-verify** avant le 1er envoi réel. Le code + migration + tests (mock bot) sont livrables et vérifiables SANS ces secrets (miroir P5 : logique livrée, envoi réel = human-verify, comme E2E P1 D-01-04-C).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 `[VERIFIED: CLAUDE.md stack]` |
| Config file | `vitest.config.ts` (racine) — glob inclut `apps/**/__tests__/**` + `packages/**` |
| Quick run command | `npx vitest run apps/jobs/src/jobs/__tests__/telegram-publish.test.ts` |
| Full suite command | `npx vitest run` puis `pnpm typecheck` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TG-03 | 2e run consécutif = 0 post (idempotent) | unit (mock client + mock bot) | `npx vitest run …/telegram-publish.test.ts` | ❌ Wave 0 |
| TG-03 | dedupe_key distinct par type (recap/notable/winrate) | unit | idem | ❌ Wave 0 |
| TG-01 | jour vide → poste « aucun trade » + win rate (D-10) | unit | idem | ❌ Wave 0 |
| TG-01 | notable réalisé ≥2.0R → post dédié ; <2.0R → non | unit | idem | ❌ Wave 0 |
| TG-02 | N<30 → « échantillon insuffisant, N » ; N≥30 → % (D-11) | unit (formatMessage pur) | `npx vitest run …/core/src/telegram/format.test.ts` | ❌ Wave 0 |
| LEGAL-01 | disclaimer FR+AR présent dans chaque template | unit (golden) | idem | ❌ Wave 0 |
| D-05/D-03 | format bilingue + escape HTML + isolats bidi + pas de niveaux entry/sl/tp | unit (golden) | idem | ❌ Wave 0 |
| TG-01 | envoi réel sur le canal | manual / human-verify | (checkpoint ops, secrets requis) | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run <fichier touché>`
- **Per wave merge:** `npx vitest run` + `pnpm typecheck`
- **Phase gate:** full suite verte + `get_advisors` security après apply 0015 + checkpoint envoi réel (human-verify).

### Wave 0 Gaps
- [ ] `apps/jobs/src/jobs/__tests__/telegram-publish.test.ts` — mock client (store mémoire, miroir outcome-tracker.test.ts) + **mock `bot.api.sendMessage`** (vi.mock 'grammy') — couvre TG-01/TG-03.
- [ ] `packages/core/src/telegram/format.test.ts` — golden FR+AR, escape, bidi, disclaimer, seuil N (D-11) — couvre TG-02/LEGAL-01/D-03/D-05.
- [ ] Pas de framework à installer (Vitest déjà en place).

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | non | bot token = secret en `.env` (pas d'auth user) |
| V3 Session Management | non | job batch, pas de session |
| V4 Access Control | oui | frontière producteur-unique : seul le job (service_role) écrit `telegram_posts` ; AUCUNE policy write ; `prediction_outcomes` non exposé au web |
| V5 Input Validation | oui | escapeHtml sur toute donnée dynamique avant `parse_mode:HTML` (Pitfall 5) ; pas d'input user (publication-only) |
| V6 Cryptography | non | aucun crypto maison |
| V7 Secrets | oui | `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHANNEL_ID` en `.env` jobs, jamais en code/DB/logs (ne jamais logger le token) |

### Known Threat Patterns for ce stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token bot fuité (logs, DB, repo) | Information Disclosure | `.env` jobs only ; ne jamais inclure le token dans `job_runs.stats`/pino ; `.env.example` sans valeurs |
| HTML injection dans le message (`<`/`>`/`&`) | Tampering | escapeHtml systématique (V5) |
| Bidi spoofing (caractères de contrôle) | Tampering | isolats `U+2066/2069` (pas embeddings) ; n'injecter que des isolats contrôlés, pas de contrôle bidi venant de données externes |
| Double-post (re-run / race) | (intégrité) | `UNIQUE(dedupe_key)` + onConflict (TG-03) |
| Fuite de données premium (niveaux entry/SL/TP sur canal public) | Information Disclosure | D-03 : ne publier QUE actif+direction+résultat+R ; jamais les niveaux (gate de revue au plan) |
| Disclaimer manquant | (conformité LEGAL-01) | test golden « disclaimer FR+AR présent » bloquant |

## Sources

### Primary (HIGH confidence)
- Code repo (lecture directe) : `apps/jobs/src/jobs/{outcome-tracker,subscription-expiry,news-ingest}.ts`, `runJob.ts`, `dispatch.ts`, `supabase/migrations/{0012,0014}.sql`, `apps/web/src/lib/track-record/{patternStats,threshold}.ts`, `packages/core/src/replay/outcome.ts`, `packages/core/src/time/constants.ts`, `packages/supabase/src/repositories/{predictionOutcomes,jobRuns}.ts`, `apps/jobs/windows/run-job.cmd`, package.json (jobs/data-sources).
- npm registry (vérifié 2026-06-17) : grammy 1.43.0/1.44.0 (deps, downloads 3.56M/sem, scripts, repo officiel) ; @grammyjs/auto-retry 2.0.2.
- core.telegram.org/bots/api — sendMessage, parse_mode HTML/MarkdownV2, limite 4096 chars.
- w3.org/International/questions/qa-bidi-unicode-controls — isolats bidi U+2066/2069 préférés aux embeddings.
- CONTEXT.md D-01..D-11 ; STATE.md (D-05-02-*, conventions migration MCP, gen types).

### Secondary (MEDIUM confidence)
- grammy.dev/advanced/flood + gramio.dev/rate-limits (WebSearch) — gestion 429/retry_after, @grammyjs/auto-retry.
- WebSearch chat_id numérique -100 vs @username — fiabilité (recoupé).

### Tertiary (LOW confidence)
- Disclaimer AR (traduction de travail) — à valider juriste/copy P2 (A5).

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH — grammy verrouillé + vérifié npm ; reste déjà installé et lu en code.
- Architecture / patterns : HIGH — clonage direct de jobs P5 existants lus ligne à ligne.
- Idempotence / migration : HIGH — miroir 0012/0014 vérifiés ; numéro 0015 confirmé par glob.
- Win rate source : HIGH — vue pattern_stats lue (overall/all/all_time confirmé).
- Telegram API (HTML, 4096, 429) : HIGH (docs officielles) ; RTL bidi : HIGH (W3C).
- Sélection fenêtre `resolved_at` : MEDIUM — décision produit ouverte (Open Q1).
- Disclaimer AR : LOW — copy juridique à valider.

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (stack stable ; grammy actif → revérifier version si report > 1 mois)
