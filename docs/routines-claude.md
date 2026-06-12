# Modèle d'exécution des Routines Claude Code

> **Statut :** Documenté et vérifié (Phase 1, plan 01-03).
> Source de vérité : `01-RESEARCH.md §Summary` + doc officielle `code.claude.com/docs/en/routines`.
> Ce document est la référence que la Phase 4 (moteur IA) utilisera pour configurer l'Environment + network access.

---

## 1. Deux types de Routines

| Type | Tournent sur | PC éteint OK | Use case |
|------|-------------|:------------:|---------|
| **Remote (cloud)** | Serveurs Anthropic | Oui | Analyse IA automatisée (Phase 4+) |
| **Local (Desktop)** | La machine locale | Non | Tests manuels uniquement |

**En Phase 1, AUCUNE Routine n'est planifiée.** L'analyse IA = Phase 4. Ce document pose la base pour cette configuration future.

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

**Network access :**
- Un projet Supabase cloud est une URL HTTPS publique — accessible depuis le réseau Anthropic sans configuration spéciale *a priori*.
- À **confirmer en Phase 4** lors de la configuration de l'Environment (Open Question A1 de RESEARCH : network access par défaut vers `*.supabase.co`).

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

Jobs planifiés typiques (à configurer en Phase 4) :
- `22:30 UTC` : snapshot après clôture NY (H1/H4/D tous actifs)
- `09:15 UTC` : snapshot après ouverture Londres
- `00:15 UTC` : snapshot après clôture Binance

---

## 7. Configuration Phase 4 (TODO)

Quand Phase 4 activera les Routines Claude :

- [ ] Créer l'Environment dans le dashboard Claude Code avec `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Activer network access vers `*.supabase.co` (à confirmer si nécessaire — A1)
- [ ] Créer les Routines Remote pour les horaires ci-dessus
- [ ] Vérifier le quota partagé (15 runs/j) vs nombre de jobs planifiés
- [ ] Documenter le MCP cloud-hosted si un MCP Supabase est nécessaire côté cloud

---

*Document créé : Phase 1, plan 01-03. Ne pas éditer manuellement — maintenu par l'équipe dev.*
