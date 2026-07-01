-- Migration 0022 : désactive les instruments non couverts par Twelve Data FREE.
--
-- Contexte : OANDA (token mort, 401) est remplacé par Twelve Data comme source
-- OHLCV forex + or (quick task 260701-1ib). Le plan FREE de Twelve Data couvre
-- EUR/USD, GBP/USD, AUD/USD, USD/JPY et XAU/USD, mais PAS l'argent (XAG/USD) ni
-- le pétrole (WTI) → l'API renvoie une erreur 404 "Grow or Venture plan". Sans
-- désactivation, market-ingest tenterait ces deux instruments à chaque run (échec
-- isolé par instrument, mais bruit + gaspillage de quota).
--
-- CONVENTION REPO (CRITIQUE) : appliquée via MCP `apply_migration` (canal 0016/0017/
-- 0018/…), JAMAIS `supabase db push`. Le projet n'est pas `link`é localement →
-- `supabase gen types --linked` échoue par design.
--
-- ⚠️ NUMÉRO = 0022 (0021 = dernière migration sur disque ; 0013 est ABSENTE —
--    réservée au cluster paiement P4 différé, NE PAS la réutiliser).
--
-- RÉVERSIBLE : réactiver via
--   UPDATE public.instruments SET active = true
--   WHERE source_symbol IN ('XAG_USD','WTICO_USD');
-- (par ex. lors d'un passage au plan Grow/Venture couvrant argent + pétrole).
--
-- LABEL, PAS GATE : `active` est un flag de collecte, pas une policy RLS. Cette
-- migration ne crée/modifie AUCUNE policy. `get_advisors(security)` post-apply
-- reste inchangé.

update public.instruments
set active = false
where source_symbol in ('XAG_USD', 'WTICO_USD');
