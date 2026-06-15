# GOLDEN — Fixture TronGrid Nile (B-04-01)

> Généré par `apps/jobs/scripts/freeze-nile-fixture.ts` depuis une transaction RÉELLE.
> Réseau : **nile** (https://nile.trongrid.io). NE PAS éditer à la main : relancer le script.

## Transaction de référence

| Champ | Valeur réelle observée |
|-------|------------------------|
| `transaction_id` | `2447022488064d2eb70d8beadbd1364218eed5d08246fd586f2f08a06277341f` |
| `from` | `TVF2Mp9QY7FEGTnr3DBpFLobA6jguHyMvi` |
| `to` | `TK5vKwGSazWAaJeXpPJLZ5V6jHuryeLzaK` |
| `to` (hex 0x41…) | `4163fe1fe54aa85b7b4686cef7bea275919a1424ba` |
| `value` (atomique) | `1000000000` |
| `token_info.symbol` | `USDT` |
| `token_info.address` (CONTRAT) | `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf` |
| `token_info.decimals` | `6` |
| `type` | `Transfer` |
| montant humain | `1000 USDT` |

## Invariants confirmés (remplacent A1-A7)

- **A1 — forme JSON** : enveloppe `{ data: [...], success, meta }`, items TRC-20 avec
  `transaction_id`, `token_info.{symbol,address,decimals}`, `from`, `to`, `value`, `type`, `block_timestamp`.
- **A2 — adresses base58** : `from`/`to` renvoyés en base58 (T…), décodables en hex 0x41 (checksum OK).
- **A3 — destinataire** : `to` == USDT_RECEIVE_ADDRESS → **OUI ✅** (hex 4163fe1fe54aa85b7b4686cef7bea275919a1424ba vs 4163fe1fe54aa85b7b4686cef7bea275919a1424ba).
- **A4 — montant** : `value` est une **string atomique** entière (×10^decimals). decimals=6.
- **A5 — only_confirmed** : requête avec `only_confirmed=true` → uniquement transactions confirmées.
- **A6 — header clé** : authentification via header `TRON-PRO-API-KEY` (jamais en query/body).
- **A7 — contrat** : `token_info.address` = **TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf** → renseigner `USDT_CONTRACT_ADDRESS` avec CETTE valeur.

## Action requise

- ⚠️ `USDT_CONTRACT_ADDRESS` est VIDE → y mettre **TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf** (contrat réellement observé) après vérification sur https://nile.tronscan.org.
