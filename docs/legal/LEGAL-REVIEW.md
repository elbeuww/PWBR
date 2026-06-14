# Revue juridique — Gate LEGAL-02 (bloque le 1ᵉʳ encaissement, Phase 4)

**Statut :** ⛔ NON VALIDÉ (défaut). Sign-off requis avant encaissement prod.

> Cet artefact est la trace humaine du gate LEGAL-02 (D-16). Tant que le sign-off
> n'est pas apposé, la variable d'environnement `LEGAL_REVIEW_DONE` reste à `false`
> et `isLegalReviewDone()` (apps/web/src/lib/legal-gate.ts) refuse l'encaissement.
> Ceci est une checklist d'opérations — **aucun texte légal faisant foi** n'est
> rédigé ici (D-15 ; les textes faisant foi sont livrés par le juriste).

## Checklist (cf. Pitfall 8)

- [ ] Statut « conseil en investissement non agréé » évalué (signaux génériques, jamais personnalisés)
- [ ] Statut crypto Algérie (interdiction loi de finances 2018) + autres pays MENA cibles
- [ ] Juridiction d'exploitation / structure tranchée
- [ ] Périmètre « éducatif » vs « conseil » validé
- [ ] Disclaimers (vitrine + membre + Telegram) rédigés/validés par le juriste
- [ ] Textes légaux faisant foi (CGU / Risques / Confidentialité / Mentions) livrés FR + traduits AR/EN
- [ ] Aucune allégation de performance / promesse de gain dans la communication

## Sign-off

- Validé par : __________   Date : __________
- Une fois TOUTES les cases cochées + sign-off : poser `LEGAL_REVIEW_DONE=true` en prod
  (et UNIQUEMENT en prod, jamais en dev/CI).
