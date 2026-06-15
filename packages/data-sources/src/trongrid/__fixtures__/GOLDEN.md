# GOLDEN values — TRON base58check (déterministe, crypto pure)

> Portée : ces valeurs sont **calculables hors-ligne** par double-SHA256 (`crypto`
> natif) sur l'encodage base58check TRON. Elles ne dépendent PAS du réseau et sont
> reproductibles à l'identique. Elles pilotent les golden tests de `address.ts`.
>
> ⚠️ À NE PAS confondre avec la fixture API `nile-trc20-transfer.json` (forme de
> réponse TronGrid), qui elle exige une frappe réseau réelle et reste **BLOQUÉE au
> checkpoint Task 1** (clé TronGrid + TX Nile réelle non provisionnées). Voir
> 04-01-SUMMARY.md.

## Golden base58 <-> hex (préfixe TRON 0x41)

| base58 | hex (lowercase, 21 octets, préfixe `41`) | checksum |
|--------|------------------------------------------|----------|
| `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` (USDT contract mainnet, D-V2-03) | `41a614f803b6fd780986a42c78ec9c7f77e6ded13c` | valide |
| `TL1y3hnprGvKWAdAGRjZnoWJmEp5q8D9qR` (adresse échantillon valide pour test `sameAddress`) | `416e36db7034c9c00f631e7c95e44529525a09a10f` | valide |

## Cas négatif (checksum corrompu → throw attendu)

| base58 corrompu | dérivé de | attendu |
|-----------------|-----------|---------|
| `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u` | `TR7NH...6t` dernier char `t`→`u` | `base58ToHex` doit **throw** (jamais comparer une adresse non vérifiée) |

## Méthode de calcul (reproductible)

```
payload (21 octets) = 0x41 || 20 octets address body
checksum (4 octets) = sha256(sha256(payload))[0..4]
base58 = base58encode(payload || checksum)
```

Calculé via `node` + `crypto` (double sha256), confirmé `checksumOk: true` pour les
deux adresses valides et `throw` pour le cas corrompu.

## Valeurs ASSUMED encore bloquées au checkpoint Task 1 (réseau)

Les éléments suivants NE peuvent PAS être figés sans frappe TronGrid Nile réelle et
restent ASSUMED (RESEARCH §A1-A7) :

- Forme exacte de la réponse `/v1/accounts/{addr}/transactions/trc20` (noms de
  champs `from`/`to`/`value`/`token_info.address`/`token_info.decimals`, base58 vs hex).
- `only_confirmed` + `contract_address` réellement supportés (A2).
- Header `TRON-PRO-API-KEY` (A3).
- `decimals === 6` confirmé côté API (A5).
- Adresse du contrat USDT **Nile testnet** (A6, différente de la mainnet).
- Seuil de confirmations / finalité (A7).
