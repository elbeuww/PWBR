# Phase 2: Vitrine publique trilingue & gate légal - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Livrer une vitrine publique **convaincante et légalement défendable**, dans les 3 langues (AR/EN/FR), au-dessus du socle i18n/RTL/gating posé en Phase 1, ET franchir la **porte juridique non-code** requise avant tout encaissement.

1. **Vitrine** — page d'accueil (présentation produit + appel à l'abonnement), page tarifs, disclaimers légaux. Aucune promesse de gain.
2. **Design system visuel** — thème/tokens de marque + composants étoffés + police arabe (reporté explicitement de la Phase 1 vers ici).
3. **Gate légal** — disclaimers rédigés par un juriste + revue juridique (conseil non agréé + statut crypto Algérie/MENA) tracée, bloquant le 1ᵉʳ encaissement (Phase 4).

**Couvre :** VITR-01, VITR-02, VITR-03, LEGAL-01, LEGAL-02.

**Hors scope (autres phases) :**
- Liste/détail des signaux, charts, temps réel (P3).
- Flux de paiement réel USDT, vérification on-chain, écriture des abonnements (P4) — P2 s'arrête à un écran « paiement bientôt ».
- Calcul/affichage du **% de réussite mesuré** (P5) — la home P2 ne contient AUCUNE allégation de performance ; le slot est construit mais masqué jusqu'à P5.
- CMS articles/cours (P9).
</domain>

<decisions>
## Implementation Decisions

### Identité visuelle & design system (reporté de P1)
- **D-01 :** Ton de marque = **finance sérieuse & crédible** (institutionnel, sobre, inspire confiance/discipline). Aligné sur la valeur cœur (fiabilité/traçabilité) et une cible MENA intermédiaire méfiante des arnaques.
- **D-02 :** **Toggle dark/light** (les deux thèmes, bascule utilisateur). Tokens de couleur à définir pour les deux modes ET à valider en RTL (arabe).
- **D-03 :** Police arabe **self-hostée via `next/font/local`** (ex. IBM Plex Sans Arabic ou Noto Sans Arabic, fichiers dans le repo). Zéro CDN au runtime → perf + confidentialité + aligné contrainte coût/robustesse. Résout IN-01 (reporté de P1).
- **D-04 :** Palette = **bleu de marque + vert/rouge réservés à la sémantique de trading** (directions long/short, résultats). Le vert/rouge ne sert JAMAIS à la déco, pour éviter toute confusion sémantique.

### Page d'accueil (VITR-01)
- **D-05 :** Structure = **parcours de conversion complet** : hero → « Comment ça marche » → preuve → aperçu tarifs → disclaimers en pied.
- **D-06 :** Pitch = **bénéfice d'abord en hero** (« décidez avec discipline : chaque opportunité notée /100, niveau de risque, plan entrée/SL/TP clair »), **méthode détaillée en section** (« IA vétéran combinant technique + fondamental + news »).
- **D-07 :** CTA principal du hero = **« S'abonner / Voir les tarifs »** (pousse vers la conversion).
- **D-08 :** ⛔ **Aucune allégation de performance sur la home en P2.** La section % de réussite est **masquée jusqu'à la Phase 5** (track record réel). Construire la structure de la home pour accueillir ce slot plus tard, sans afficher de chiffre. **Aucun pourcentage inventé** (ex. « 90% » écarté après discussion : viole valeur cœur + VITR-03 + gate légal de cette phase).
  - *Sous-clause VITR-01 « présentant le % de réussite mesuré » : volontairement reportée à P5. Documenté pour le verifier.*

### Funnel d'abonnement (VITR-02 — paiement réel = P4)
- **D-09 :** Profondeur du funnel en P2 = **tarifs → signup → écran honnête « paiement disponible très bientôt »**. Pas de flux de paiement, pas d'adresse USDT factice. Le parcours s'arrête proprement.
- **D-10 :** Affichage des prix = **USD + mention « payable en USDT (TRC-20) »** (USDT ≈ USD, pas de taux de change à gérer ; clarifie le moyen de paiement dès les tarifs).
- **D-11 :** ⚠️ **Offre mise à jour par le fondateur : `9 $/mois` OU `3 $/7 jours` (offre découverte, utilisable une seule fois pour tester la plateforme).** REMPLACE le `3 $/15 j` encore présent dans REQUIREMENTS.md (VITR-02) et ROADMAP.md (Phase 2/4) → **incohérence doc à corriger** (voir Deferred / action). L'enforcement « une seule fois par utilisateur » est en P4 (PAY-06) ; P2 ne fait qu'afficher l'offre.
- **D-12 :** **Tarifs publics** (visibles par tout visiteur, conforme VITR-02) ; la création de compte n'est requise qu'au **clic « s'abonner »**.

### Disclaimers & gate juridique (VITR-03, LEGAL-01, LEGAL-02)
- **D-13 :** Placement disclaimers = **disclaimer court permanent en footer global** (toutes pages) **+ pages légales dédiées**. LEGAL-01 exige la présence sur vitrine + espace membre + posts Telegram → le composant disclaimer doit être réutilisable transverse.
- **D-14 :** Pages légales = **bundle complet** : CGU/Conditions + Avertissement sur les risques (risque de perte total) + Politique de confidentialité + Mentions légales. Le juriste tranchera la liste définitive.
- **D-15 :** Rédaction = **le texte légal définitif vient du juriste** (source FR) → **traduction professionnelle AR/EN**. Le code pose la structure i18n ; jusqu'à réception, **placeholders clairement marqués « en cours de revue juridique »**. ⛔ L'IA n'invente PAS de texte légal faisant foi (risque de fausse assurance / non-conformité MENA).
- **D-16 :** Gate LEGAL-02 (non-code) = **double mécanisme** :
  1. **Artefact versionné `LEGAL-REVIEW.md`** (en repo, dans `.planning/` ou `docs/legal/`) avec checklist : statut conseil non agréé, statut crypto Algérie/MENA, disclaimers validés, sign-off daté.
  2. **Flag** (env ou config DB, ex. `legal_review_done`) que le **code de paiement de la Phase 4 vérifiera** avant d'autoriser le 1ᵉʳ encaissement en production. P2 pose le flag (défaut = non validé) + l'artefact ; P4 consomme le flag.

### Claude's Discretion
- Choix exact de la police arabe (IBM Plex Sans Arabic vs Noto Sans Arabic vs autre) et du couple de polices latines marque/corps.
- Définition des tokens de couleur/typo Tailwind v4 (config CSS-first) pour les deux thèmes, et des composants shadcn/ui à étoffer (branche compatible Tailwind v4 + React 19).
- Architecture des pages marketing sous `[locale]/(marketing)` (réutilise le route group existant) et structure des namespaces de messages (`home`, `legal`, extension de `pricing`).
- Forme exacte du flag `legal_review_done` (env vs ligne de config DB) — à arbitrer au planning selon ce que P4 pourra lire le plus simplement.
- Emplacement exact de `LEGAL-REVIEW.md` (`.planning/` vs `docs/legal/`).
- Métriques réelles factuelles optionnelles sur la home (nb d'analyses produites, marchés couverts, R:R moyen visé) — peuvent enrichir la preuve sans allégation de perf (évoqué, non retenu fermement ; à proposer si la home paraît vide sans le % masqué).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Décisions & exigences du milestone
- `.planning/REQUIREMENTS.md` § VITR + § LEGAL — libellés exacts des 5 requirements (VITR-01..03, LEGAL-01..02). ⚠️ Le tarif `3 $/15 j` y est obsolète (cf. D-11).
- `.planning/ROADMAP.md` § Phase 2 — Goal + 4 Success Criteria. ⚠️ Même obsolescence tarif.
- `.planning/STATE.md` § Accumulated Context — décisions héritées du milestone.

### Contexte Phase 1 (socle réutilisé — à lire impérativement)
- `.planning/phases/01-socle-transverse-i18n-rtl-r-les-gating/01-CONTEXT.md` — décisions i18n verrouillées : `localePrefix:'always'`, `defaultLocale='fr'`, locales `[fr,en,ar]`, redirection non-abonné → `/[locale]/tarifs`, sélecteur de langue header, RTL natif Tailwind v4. **Le design system complet est explicitement délégué à P2 (D-11 de P1).**
- `.planning/phases/01-socle-transverse-i18n-rtl-r-les-gating/01-SECURITY.md` — gate de gating (RLS + `gate.ts`) déjà vérifié ; ne pas régresser.
- `.planning/phases/01-socle-transverse-i18n-rtl-r-les-gating/01-HUMAN-UAT.md` — IN-01 (police arabe sans CDN) résolu ici par D-03.

### Recherche v2.0 (stack & pièges)
- `.planning/research/STACK.md` — next-intl 4.13, RTL natif Tailwind v4 (PAS tailwindcss-rtl), shadcn/ui branche v4, recharts (graphes analytiques, pas vitrine).
- `.planning/research/ARCHITECTURE.md` — segment `[locale]` enveloppant, `(marketing)` route group, structure messages.
- `.planning/research/PITFALLS.md` — promesses de gain / conformité ; à recroiser avec le gate légal.

### Cœur réutilisé
- `apps/web/src/app/[locale]/(marketing)/tarifs/page.tsx` — placeholder tarifs existant à étoffer.
- `apps/web/src/app/[locale]/layout.tsx` — layout locale (lang/dir dynamiques) où brancher thème + polices + footer disclaimer.
- `apps/web/src/components/LanguageSwitcher.tsx` — composant existant à intégrer au header marque.
- `apps/web/src/messages/{fr,en,ar}.json` — namespaces existants (`common`, `language`, `auth`, `access`, `pricing`, `signals`, `dashboard`) à étendre (`home`, `legal`).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Route group `[locale]/(marketing)`** déjà créé (P1) avec `tarifs/page.tsx` placeholder — y ajouter la home et les pages légales.
- **`LanguageSwitcher.tsx`** — à placer dans le header de la vitrine.
- **Namespace `pricing`** déjà présent dans les 3 fichiers messages — étendre pour les tarifs réels (9 $/3 $) + mentions USDT.
- **`[locale]/layout.tsx`** — point d'ancrage pour le `ThemeProvider` (toggle dark/light), les polices (`next/font/local`), et le footer disclaimer global.

### Established Patterns
- **i18n verrouillé P1** : toute chaîne via next-intl, jamais en dur (le check CI `check-i18n-hardcoded.mjs` bloque les régressions). Tout texte de la vitrine = clés de messages dans `{fr,en,ar}.json`.
- **RTL natif Tailwind v4** : propriétés logiques `ms-*`/`me-*`/`start`/`end` ; `<bdi>`/`Intl` pour prix/nombres. À respecter pour tout nouveau composant.
- **Frontière producteur-unique / RLS** : la vitrine est en lecture seule publique ; aucune écriture front sur les données métier. Le signup réutilise le wiring auth existant.

### Integration Points
- Pas encore de page d'accueil : `[locale]/page.tsx` (ou `(marketing)/page.tsx`) à créer — la racine `/` redirige déjà vers `/fr` (P1).
- Le flag `legal_review_done` (D-16) doit être posé de façon à être lisible par le code paiement de P4 (env ou config DB).
- Les disclaimers (D-13) doivent être un composant transverse réutilisable par l'espace membre (P3) et les posts Telegram (P6).
</code_context>

<specifics>
## Specific Ideas

- Le fondateur a d'abord proposé d'afficher « 90% de trades réussis/jour » en attendant le track record ; écarté après discussion (publicité trompeuse + conflit valeur cœur/VITR-03/gate légal). Retenu : **section % masquée jusqu'à P5, zéro chiffre inventé**. La transparence (« track record en cours de mesure, % publié dès échantillon suffisant ») est positionnée comme argument de vente différenciant vs les arnaques.
- Offre découverte repensée par le fondateur : **3 $/7 j utilisable une seule fois** (au lieu de 3 $/15 j) pour « tester la plateforme ».
- Vert/rouge strictement sémantiques (trading), jamais décoratifs — cohérence avec l'espace membre à venir (P3).
</specifics>

<deferred>
## Deferred Ideas

- **Affichage du % de réussite mesuré** (slot construit mais masqué) → **Phase 5** (track record réel). Sous-clause de VITR-01 reportée.
- **Flux de paiement réel + adresse USDT + vérification on-chain** → **Phase 4** (P2 s'arrête à « paiement bientôt »).
- **Équivalent prix en DZD/devise locale** → non retenu (taux de change à maintenir) ; ré-évaluable plus tard.
- **Métriques réelles factuelles sur la home** (nb analyses, marchés, R:R moyen) → optionnel, à proposer au planning si la home paraît creuse sans le % masqué.
- **Consentement cookies / bannière RGPD-like** → non discuté ; à évaluer si le besoin émerge (analytics futurs).

### Action requise (cohérence docs)
- **Mettre à jour `REQUIREMENTS.md` (VITR-02) et `ROADMAP.md` (Phases 2 & 4)** : remplacer `3 $/15 j` par **`3 $/7 j, utilisable une seule fois`** (D-11). À faire avant ou pendant le planning pour éviter une dérive entre docs.

None déféré au-delà : la discussion est restée dans le périmètre de la phase.
</deferred>

---

*Phase: 2-Vitrine publique trilingue & gate légal*
*Context gathered: 2026-06-14*
