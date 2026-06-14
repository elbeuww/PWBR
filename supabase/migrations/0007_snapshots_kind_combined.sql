-- Migration 0007 : autorise kind='combined' sur public.snapshots
--
-- L'ANALYZE de la Phase 4 produit un snapshot combiné {technical, fundamental, news}
-- que la frontière de confiance `persist.ts` lit comme `CombinedSnapshot` via
-- `getSnapshotByHash(raw_indicators_ref)` (D-43, déviation 04-03 D-04-03-B).
-- Le CHECK posé en 0005 ne listait que les 3 kinds séparés ('technical',
-- 'fundamental', 'news') — un snapshot combiné était donc rejeté (gap relevé
-- par 04-VERIFICATION.md, contourné en kind='technical' au run de validation).
--
-- Additif et non destructif : on étend l'allow-list. Aucune ligne existante n'est
-- invalidée (les 3 valeurs d'origine restent acceptées).

alter table public.snapshots drop constraint snapshots_kind_check;

alter table public.snapshots add constraint snapshots_kind_check
  check (kind in ('technical', 'fundamental', 'news', 'combined'));
