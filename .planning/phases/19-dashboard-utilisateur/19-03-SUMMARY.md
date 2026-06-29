---
phase: 19-dashboard-utilisateur
plan: 03
subsystem: web-data
tags: [keyset, cursor, watchlist, source-unique, rls, searchparams, udash-02]
requires:
  - "19-01: table user_followed_setups LIVE + index keyset (user_id, created_at desc, id desc) + types régénérés"
  - "03-01/03-02: lib/signals/searchParams.ts (pattern safeParse) + lib/signals/queries.ts (frontière producteur-unique, SignalInstrument)"
provides:
  - "lib/keyset/cursor.ts — encodeCursor/decodeCursor base64url opaque, décodage tolérant (corrompu→null, jamais throw)"
  - "lib/watchlist/queries.ts — fetchFollowedSetups(status,cursor) source unique keyset + fetchFollowedSetupIds (Set)"
  - "lib/signals/searchParams.ts — WatchlistParamsSchema (tab enum + cursor opaque), parse/serialize maison sans nuqs"
affects:
  - "19-04: rend la liste suivis/historique paginée (consomme fetchFollowedSetups + nextCursor)"
  - "19-05: toggle follow (consomme fetchFollowedSetupIds pour l'état initial)"
  - "Phase 21: audit scalabilité (keyset Index Scan sur user_followed_setups à ~10k)"
tech-stack:
  added: []
  patterns:
    - "Curseur keyset opaque base64url (tuple positionnel [createdAt,id]) — décodage tolérant miroir searchParams"
    - "Source unique D-04 : user_followed_setups ⋈ trade_setups!inner filtré par statut via embed dotted (.eq/.in('trade_setups.status', …))"
    - "Tuple-compare keyset PostgREST .or(created_at.lt.X,and(created_at.eq.X,id.lt.Y)) — pas de trou/doublon (Pitfall 4)"
    - "Schéma frère WatchlistParamsSchema plutôt qu'extension de SignalsParamsSchema (surfaces disjointes)"
    - "Anti-injection .or() : sanitizeCursor valide forme UUID + ISO avant interpolation (virgule/parenthèse impossibles)"
key-files:
  created:
    - apps/web/src/lib/keyset/cursor.ts
    - apps/web/src/lib/keyset/__tests__/cursor.test.ts
    - apps/web/src/lib/watchlist/queries.ts
  modified:
    - apps/web/src/lib/signals/searchParams.ts
decisions:
  - "D-19-03-A : schéma frère WatchlistParamsSchema (tab+cursor) dans searchParams.ts plutôt qu'extension de SignalsParamsSchema — la watchlist ne partage AUCUN filtre avec les signaux ; isoler évite la régression du schéma existant (10/10 tests signaux non régressés)."
  - "D-19-03-B (Rule 2 — durcissement) : sanitizeCursor valide la forme du curseur décodé (UUID + ISO timestamp) AVANT interpolation dans .or(). PostgREST ne paramètre pas .or() ; un id/timestamp malformé pourrait porter une virgule/parenthèse et altérer le filtre. Les deux regex neutralisent toute injection → forme invalide = première page. Au-delà de T-19-10 (accept), ferme aussi T-19-09 (tampering) côté curseur."
  - "D-19-03-C : statut filtré via embed dotted sur le join inner (.eq('trade_setups.status','active') / .in(…,['invalidated','expired'])) — chemin canonique PostgREST que le plan présuppose (la barrière renouvellement D-03 « gratuite » repose sur le !inner filtrant la ligne racine). CR-02 (signals) avait observé un filtre dotté ignoré sur un autre embed → vérification fonctionnelle live requise (gate A2 ci-dessous, table vide au build)."
  - "D-19-03-D : prediction_outcomes en embed NULLABLE (pas !inner) sous trade_setups pour l'historique — l'issue n'existe que pour les setups résolus ; un inner exclurait les expired sans outcome."
gates:
  manual_only:
    - "A2 / T-19-11 (barrière renouvellement) : vérifier live qu'un abonné EXPIRÉ lit 0 ligne via fetchFollowedSetups (le trade_setups!inner gardé par has_active_subscription() filtre tout). Non automatisable : user_followed_setups vide au build (19-01) + exige session abonné expiré. Fallback filtre serveur si le !inner ne filtre pas la racine."
    - "Filtre statut embed dotté (CR-02) : confirmer live que .eq('trade_setups.status', …) filtre bien les lignes racine sur le !inner (suivis≠historique). Si silencieusement ignoré (cf. CR-02 signals), basculer en pré-résolution de setup_ids par statut."
    - "EXPLAIN keyset à l'échelle : Index Scan using user_followed_setups_keyset_idx (sans Sort) sur seed/réel — prouvé forcé table vide en 19-01, à reconfirmer post-données."
verification:
  - "pnpm vitest run cursor.test.ts : 7/7 verts (round-trip + undefined + vide + corrompu + non-tuple + tuple non-string)"
  - "pnpm typecheck (tsc -b) : vert (dotted .eq('trade_setups.status') compile)"
  - "searchParams.test.ts : 10/10 non régressés (schéma signaux intact)"
  - "greps : and(created_at.eq présent (2), service_role==0, throw==0 (cursor+queries), nuqs import==0, base64url>=1"
metrics:
  duration: ~12min
  completed: 2026-06-26
---

# 19-03 — Curseur keyset + requêtes watchlist source unique

## Réalisé

- **Task 1 (TDD)** : `lib/keyset/cursor.ts` — `encodeCursor`/`decodeCursor` base64url
  opaque (tuple positionnel `[createdAt, id]`). Décodage TOLÉRANT : absent/vide/
  corrompu/non-tuple/non-string → `null` (première page), jamais d'exception. RED
  (`d4e94d1`, module introuvable) → GREEN (`4647f7e`, 7/7).
- **Task 2** : `searchParams.ts` étendu d'un **schéma frère** `WatchlistParamsSchema`
  (`tab` enum `suivis|historique` défaut `suivis` ; `cursor` string non-vide opaque),
  `parseWatchlistParams`/`serializeWatchlistParams` safeParse champ par champ, omission
  des défauts pour un round-trip propre. Aucun `nuqs`. (`93b8d55`)
- **Task 3** : `lib/watchlist/queries.ts` — `fetchFollowedSetups(status, cursor)`
  source unique `user_followed_setups ⋈ trade_setups!inner` filtrée par statut,
  keyset tuple-compare `.or(created_at.lt.X,and(created_at.eq.X,id.lt.Y))`, détection
  page suivante via la (PAGE_SIZE+1)-ième ligne → `nextCursor`. `fetchFollowedSetupIds`
  → `Set<setup_id>`. Client anon RLS uniquement, jamais service-role, jamais throw.
  (`a3e980e`)

## Garde-fous prouvés

- **T-19-09 (anti-injection curseur)** : `sanitizeCursor` valide UUID + ISO avant
  interpolation `.or()` — virgule/parenthèse impossibles dans un id/timestamp valide.
- **T-19-12 (no service-role front)** : grep `service_role` == 0 ; client anon seul.
- **D-05 (keyset, pas OFFSET)** : tri `(created_at desc, id desc)` racine + tuple-compare.
- **D-04 (source unique)** : `trade_setups!inner` par statut, pas de table view-log.
- **Tolérance URL** : curseur/onglet corrompus → première page / défaut, jamais de throw.

## Déviations du plan

### Ajouts critiques (Rule 2)

**1. [Rule 2 - Sécurité] Durcissement anti-injection du curseur (`sanitizeCursor`)**
- **Trouvé pendant** : Task 3
- **Issue** : les valeurs du curseur (décodées d'une URL non fiable) sont interpolées
  dans `.or()` que PostgREST ne paramètre PAS. Un id/timestamp malformé pourrait
  porter `,`/`)` et altérer l'expression de filtre.
- **Fix** : validation de forme (regex UUID + ISO timestamp) avant interpolation ;
  forme invalide → première page. Ferme T-19-09 côté curseur au-delà de l'accept T-19-10.
- **Fichiers** : apps/web/src/lib/watchlist/queries.ts
- **Commit** : a3e980e

Sinon : plan exécuté tel qu'écrit (helper keyset, schéma frère, source unique).

## Stubs / dette

Aucun stub. Les requêtes lisent la vraie table `user_followed_setups` (vide au build,
seedée ultérieurement) ; aucune donnée mockée. Le rendu (liste, toggle) est livré par
19-04/19-05 qui consomment ces helpers.

## Self-Check: PASSED

- Fichiers : cursor.ts, cursor.test.ts, watchlist/queries.ts, searchParams.ts — tous FOUND.
- Commits : d4e94d1, 4647f7e, 93b8d55, a3e980e — tous FOUND.
- cursor.test.ts : 7/7 verts. typecheck vert. searchParams 10/10 non régressés.
