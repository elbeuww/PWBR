-- Migration 0011 : Realtime pour trade_setups (MEMB-05) + alignement RLS candles.
--
-- MEMB-05 : la liste membre doit se mettre à jour en direct (D-13/D-14). Pour que les
--           events postgres_changes INSERT/UPDATE soient émis ET filtrables par RLS,
--           trade_setups doit (a) avoir REPLICA IDENTITY FULL et (b) être membre de la
--           publication supabase_realtime. Sans ça, zéro callback malgré un canal correct
--           (Pitfall 2 du RESEARCH).
--
-- A1 : REPLICA IDENTITY FULL porte l'ANCIEN enregistrement sur les UPDATE → permet de
--      détecter la transition active→expired/invalidated et de retirer la carte en direct
--      (D-14). Sans elle, payload.old est incomplet.
-- A4 : la publication supabase_realtime peut DÉJÀ contenir public.trade_setups (état non
--      géré par les migrations précédentes). L'ajout est donc gardé par une vérification
--      pg_publication_tables pour rester idempotent (re-run sûr, ne fait pas échouer la
--      migration).
--
-- Sécurité (T-03-01) : la RLS de lecture de trade_setups est déjà gated par
-- has_active_subscription() (0009/0010). REPLICA IDENTITY FULL et la publication ne
-- contournent PAS la RLS : les events postgres_changes restent filtrés par policy →
-- un non-abonné ne reçoit aucun event.
--
-- DÉCISION RLS candles (Open Question 1, tranchée AVEC le développeur — disposition ALIGN,
-- T-03-02) : par cohérence de la barrière payante, candles n'est plus lisible par tout
-- `authenticated` mais uniquement par les abonnés actifs. On drop/recreate la policy
-- existante par son NOM EXACT (lu dans 0003 l.89), en miroir du pattern trade_setups de
-- 0009. Conséquence : un authentifié non-abonné ne peut lire NI les setups NI l'OHLCV.
--
-- Invariant producteur-unique préservé : AUCUNE écriture front introduite ; le service_role
-- bypass RLS pour les écritures (inchangé).
--
-- Process projet : migration appliquée via MCP apply_migration (PAS `supabase db push`),
-- convention 0006/0009.

-- ─────────────────────────────────────────────────────────────────────────────
-- (a) REPLICA IDENTITY FULL sur trade_setups (A1 — old record sur UPDATE, D-14)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.trade_setups replica identity full;

-- ─────────────────────────────────────────────────────────────────────────────
-- (b) Ajout idempotent de trade_setups à la publication supabase_realtime (A4)
-- La table peut déjà y être → on vérifie pg_publication_tables avant l'ALTER pour
-- ne pas faire échouer la migration sur un re-run.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trade_setups'
  ) then
    alter publication supabase_realtime add table public.trade_setups;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (c) DÉCISION RLS candles = ALIGN (T-03-02) : gater l'OHLCV sur has_active_subscription()
-- NOM EXACT lu dans 0003 l.89 ("candles: lecture authentifiés") — un nom erroné fait
-- échouer la migration. Miroir du drop/recreate trade_setups de 0009.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy "candles: lecture authentifiés" on public.candles;
create policy "candles: abonnés actifs"
  on public.candles
  for select to authenticated
  using (public.has_active_subscription());
