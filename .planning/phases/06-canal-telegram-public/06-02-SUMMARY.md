# 06-02 SUMMARY — Table d'idempotence telegram_posts (TG-03)

**Plan:** 06-02 · **Wave:** 1 · **Status:** complete · **Date:** 2026-06-17

## Objectif livré
Filet DB inviolable contre les doublons de publication Telegram (TG-03) : table `telegram_posts` avec `UNIQUE(dedupe_key)` global + RLS producteur-unique, appliquée LIVE, types régénérés, repo idempotent livré.

## Tâches
- **Task 1 (auto, executor)** — migration `0015_telegram_posts.sql` + repo `telegramPosts.ts` écrits sur disque. Commit `aaf1c7a`.
- **Task 2 (checkpoint:human-action BLOCKING, orchestrateur via MCP)** — migration appliquée à la base LIVE, types régénérés, alias maison + `TelegramPost*` ré-appliqués, casts provisoires retirés, typecheck vert.

## Actions checkpoint (orchestrateur)
1. Confirmation humaine avant écriture prod (AskUserQuestion → « Oui, appliquer LIVE »).
2. `apply_migration 0015_telegram_posts` → `{"success":true}` (CREATE TABLE additif, aucun DROP).
3. `list_tables` → `public.telegram_posts` confirmée : `dedupe_key` text UNIQUE, `post_type` check `('recap','notable','winrate')`, `posted_at` default now(), `tg_message_id` bigint nullable, `run_id` uuid FK→job_runs ON DELETE SET NULL, RLS enabled.
4. `get_advisors security` → seul `rls_enabled_no_policy` (INFO) sur telegram_posts = **attendu/voulu** (RLS active + 0 policy = deny-all anon ; write = service_role bypass, D-05). Autres advisors préexistants (pattern_stats, has_active_subscription, leaked_password), non introduits par 0015.
5. `generate_typescript_types` → réécriture `database.types.ts` + ré-application du bloc d'alias maison (Pitfall 6 / D-05-02-F) + ajout `TelegramPostRow/Insert/Update`.
6. `telegramPosts.ts` : type provisoire + cast `as never` retirés → `import type { Database, TelegramPostInsert } from '../database.types'`.
7. `index.ts` : `export type { TelegramPostRow, TelegramPostInsert, TelegramPostUpdate }` ajouté.

## Vérifications
- `pnpm typecheck` : exit 0, 0 erreur.
- `npx vitest run` : 53 fichiers, **401 tests verts** (non régressé).
- Migrations live : 0014 → 0015 (0013 toujours réservée P4).

## Garde-fous (threat model)
- **T-06-DUP** (mitigate) : `UNIQUE(dedupe_key)` global + `onConflict ignoreDuplicates` — filet inviolable même en course concurrente.
- **T-06-RLS** (mitigate) : RLS active, 0 policy write → inaccessible anon ; confirmé par get_advisors.
- **T-06-SC** (mitigate) : apply via MCP `apply_migration` (jamais `db push`), checkpoint humain, get_advisors post-apply.
- Aucun secret (token/channel_id) dans migration ou repo.

## key-files.created
- `supabase/migrations/0015_telegram_posts.sql`
- `packages/supabase/src/repositories/telegramPosts.ts`

## key-files.modified
- `packages/supabase/src/database.types.ts` (régénéré + alias maison + TelegramPost*)
- `packages/supabase/src/index.ts` (exports repo + types)

## Commits
- `aaf1c7a` feat(06-02): migration 0015 telegram_posts + repo telegramPosts (idempotence dedupe_key)
- (ce commit) feat(06-02): appliquer 0015 LIVE + types régénérés + alias TelegramPost* (TG-03)

## Self-Check: PASSED
Migration live confirmée, types alignés, idempotence en place, repo exporté et prêt pour le job 06-03.
