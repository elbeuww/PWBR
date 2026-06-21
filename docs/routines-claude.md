# Modèle d'exécution des Routines Claude Code — Runbook go-live (Phase 12)

> **Statut :** Phase 12, go-live. Runbook reproductible de l'activation des routines Remote.
> Source de vérité : `12-RESEARCH.md` + `apps/jobs/config/sessions.ts` (crons UTC) + doc officielle `code.claude.com/docs/en/routines`.
> Ce document est la **SEULE trace versionnée** de la configuration cloud : l'Environment, les secrets et les crons vivent **hors git** (dashboard Anthropic / `/schedule`). Sa reproductibilité dépend entièrement de ce doc — il reflète la réalité corrigée par la recherche, pas les hypothèses P1 périmées.

---

## 1. Deux types de Routines

| Type | Tournent sur | PC éteint OK | Use case |
|------|-------------|:------------:|---------|
| **Remote (cloud)** | Serveurs Anthropic | Oui | Analyse IA automatisée (rollout #1) |
| **Local (Desktop)** | La machine locale | Non | Tests manuels uniquement |

**Rollout #1 (D-12-01) :** activer en premier les routines Remote `newyork` et `eod-swing` (voir §6). Les sessions `asia`/`london` sont un élargissement ultérieur (gate ROUTINE-03).

---

## 2. Quota

- **~15 runs/jour** sur le forfait **Max** (confirmé RESEARCH).
- Ce quota est **partagé** avec les sessions interactives Claude Code (Pitfall 6 RESEARCH).
- Conséquence : les jobs déterministes d'ingestion (candles/news/macro) **ne doivent pas** consumer ce quota — ils tournent via Windows Task Scheduler hors quota Claude (voir §5 Fallback).

---

## 3. Injection de secrets (Environments)

Dans une Routine Remote, les variables d'environnement sont injectées via le mécanisme **Environments** :

1. Créer un Environment dans le dashboard Claude Code (variables chiffrées, setup script optionnel, network access réglable).
2. Associer l'Environment à la Routine.
3. Les variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) sont disponibles dans `process.env` — lues par `dotenv/config` en local, ou directement par le runtime en cloud.

Le dispatcher `apps/jobs/src/dispatch.ts` charge `dotenv/config` en tête — cela est un no-op en cloud (les vars sont déjà dans l'env), et charge le fichier `.env` en local. **Aucune réécriture nécessaire entre les deux contextes.**

---

## 4. MCP et connectivité réseau

**Point critique (Pitfall 5 RESEARCH) :**

- Les connecteurs MCP d'une Routine Remote sont des **MCP cloud-hosted** (configurés dans le dashboard).
- Le MCP Supabase connecté interactivement via `.mcp.json` (stdio local) **n'est PAS accessible** dans une Routine Remote.
- Les jobs appellent donc Supabase via le **SDK `supabase-js`** uniquement (connexion HTTPS vers `*.supabase.co`).

**Network access (P-NET — corrige D-12-10 / §4 §7 P1 périmés) :**

Le profil réseau **Trusted** activé par défaut sur une Routine Remote **N'INCLUT PAS** `*.supabase.co`. La liste d'hôtes autorisés du profil Trusted vérifiée = `api.anthropic.com`, `github.com`, les package managers (`npm`/`pypi`/`crates`/`yarn`), et les miroirs Ubuntu — **rien de Supabase**. Un appel `supabase-js` vers `*.supabase.co` depuis Trusted échoue avec :

```
403  x-deny-reason: host_not_allowed
```

C'est exactement ce qui casse le client service_role de `runJob.ts` / `persist.ts` (la seule voie d'écriture). **L'allowlist Custom est donc OBLIGATOIRE, pas optionnelle.**

**Procédure REQUISE (Environment → Network access) :**
1. Régler **Network access = `Custom`** (pas `Trusted`).
2. Ajouter l'hôte `*.supabase.co`.
3. Cocher **« inclure les package managers par défaut »** (sinon `pnpm install` échoue lui aussi en `host_not_allowed`).
4. **Fallback `Full`** uniquement si `Custom` se révèle non fonctionnel (bug connu, A2 — GitHub issue #30112). `Full` ouvre tout l'egress : moins de privilège, à n'utiliser qu'en dépannage documenté.

L'étape réseau Custom est **gatée par un run de fumée** (ROUTINE-01, plan 03) : un premier run cloud doit écrire dans `job_runs` sans `403 host_not_allowed` dans `job_runs.error` AVANT de planifier les fenêtres.

**Architecture des jobs (invariante) :**
```
Routine Claude Remote / Task Scheduler / croner
          │
          ▼
apps/jobs/src/dispatch.ts  (tsx ESM, lit process.env)
          │
          ▼
apps/jobs/src/runJob.ts    (startRun / finishRun)
          │
          ▼
Supabase cloud SDK supabase-js   ← UNIQUEMENT cette voie (pas le MCP)
  └── job_runs  (service_role bypass RLS)
```

---

## 5. Fallback Windows Task Scheduler (ingestion déterministe)

Le fallback garantit que les données (candles/news/macro) restent à jour même sans Routine Claude active.

**Fichier :** `apps/jobs/windows/run-job.cmd`

**Utilisation :**
```cmd
:: Dans Windows Task Scheduler, action Programme/script :
C:\chemin\vers\repo\apps\jobs\windows\run-job.cmd
:: Arguments :
heartbeat
```

**Lancement local direct (développement) :**
```bash
pnpm --filter jobs exec tsx src/dispatch.ts heartbeat
```

**Ce que le fallback couvre :**
- Jobs déterministes : ingestion candles, news, macro, snapshot (Phases 2-3)
- Monitoring via `job_runs` (toujours écrit)

**Ce que le fallback ne couvre PAS :**
- L'analyse IA (raisonnement vétéran, scoring) — exige l'agent Claude → Phase 4 uniquement.
- Tant que l'agent ne tourne pas, `job_runs` indique `status='running'` puis n'est jamais mis à jour → flag `stale` visible au dashboard (Phase 5).

---

## 6. Horaires UTC des sessions marché

Référence `ARCHITECTURE.md §5` pour les horaires exacts. Résumé :

| Session | Ouverture UTC | Fermeture UTC | Notes DST |
|---------|:------------:|:-------------:|-----------|
| Tokyo | 00:00 | 09:00 | Pas de DST au Japon |
| Londres | 08:00 (07:00 BST) | 17:00 (16:00 BST) | BST mars→oct |
| New York | 13:00 (12:00 EDT) | 22:00 (21:00 EDT) | EDT mars→nov |
| Daily OANDA | 17:00 NY | +24h | Convention close-of-day FX |
| Daily Binance | 00:00 UTC | +24h | UTC fixe, pas de DST |

**Crons UTC des routines (source de vérité : `apps/jobs/config/sessions.ts`, lignes 27-32).**

Les crons ci-dessous sont la SEULE source de vérité versionnée des horaires (la config `/schedule` vit hors git). **Rollout #1 (D-12-01)** active uniquement `newyork` et `eod-swing` :

| Routine | Cron UTC | Style | Statut rollout |
|---------|----------|-------|----------------|
| `newyork` | `30 12 * * 1-5` | day | **#1 — activée** |
| `eod-swing` | `00 21 * * 1-5` | swing | **#1 — activée** |
| `asia` | `00 23 * * 0-4` | day | élargissement (gate ROUTINE-03) |
| `london` | `00 07 * * 1-5` | day+swing | élargissement (gate ROUTINE-03) |

**Contraintes de saisie dans le dashboard :**
- **Intervalle minimum 1 h** entre deux runs d'une même routine.
- L'heure saisie est convertie **local → UTC** par le dashboard : **saisir les valeurs en UTC** (ex. `newyork` = 12:30 UTC) pour qu'elles correspondent aux crons ci-dessus.
- Tout changement de fenêtre se reflète **d'abord** dans le commentaire de `sessions.ts`, qui reste la source de vérité, **puis** dans `/schedule`.

---

## 7. Runbook go-live (checklist)

> Réécriture de la checklist : l'étape réseau Custom est REQUISE, gatée par un run de fumée.

- [ ] Créer l'Environment dans le dashboard Claude Code avec `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (P-SECRET — voir §8).
- [ ] **Network access = `Custom` + `*.supabase.co` + package managers par défaut — REQUIS** (P-NET, §4). `Full` en fallback documenté seulement.
- [ ] **Run de fumée egress (gate ROUTINE-01)** : un run cloud écrit dans `job_runs` SANS `403 host_not_allowed` — AVANT de planifier les fenêtres.
- [ ] Retirer tout connecteur Supabase MCP de la routine (P-MCP, §8 — ROUTINE-05).
- [ ] Créer les Routines Remote `newyork` (`30 12 * * 1-5`) et `eod-swing` (`00 21 * * 1-5`) via `/schedule` (§6).
- [ ] Vérifier le quota partagé (15 runs/j) vs nombre de routines × runs/jour.
- [ ] **Run réel de bout en bout (gate ROUTINE-03)** : ≥1 setup persisté via la séquence single-run (§8) avant d'élargir à `asia`/`london`.

---

*Runbook go-live — Phase 12. Source de vérité hors git : dashboard Anthropic (Environment, secrets, crons). Maintenu par l'équipe dev.*
