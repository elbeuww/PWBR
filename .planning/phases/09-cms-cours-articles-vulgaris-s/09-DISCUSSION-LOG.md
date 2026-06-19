# Phase 9: CMS cours & articles vulgarisés - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 9-CMS cours & articles vulgarisés
**Areas discussed:** Recadrage périmètre, Stockage, Validation, Taxonomie, Navigation vitrine, Anatomie du contenu, Trilingue & robustesse, Périmètre de livraison

---

## Recadrage du périmètre (initié par le fondateur)

Le fondateur a redéfini la phase avant toute discussion de gray areas : **pas de CMS éditeur**. Le contenu est rédigé par l'agent Claude (bases du trading + usage plateforme), publié dans les 3 langues, ~30 au démarrage puis ~10/semaine. Conséquence : **CMS-02 (UI superadmin create/edit/publish) retiré**, CMS-01 (lecture vitrine) conservé comme cœur.

**Note de vision :** le contenu sert d'enablement produit — tutos MetaTrader (ouvrir position, TP/SL) pour que les abonnés sachent exécuter les signaux.

---

## Stockage du contenu

| Option | Description | Selected |
|--------|-------------|----------|
| Fichiers MDX dans le repo | `content/…`, commit → deploy, zéro DB | ✓ |
| Table DB seedée par script | Table `articles (slug, locale)`, RLS publique, script d'import | |

**User's choice:** Fichiers MDX dans le repo.
**Notes:** Cohérent maintenant qu'il n'y a plus d'éditeur ; s'écarte du « contenu DB » de la ROADMAP, acté.

---

## Validation avant publication

| Option | Description | Selected |
|--------|-------------|----------|
| Relecture avant publication | Claude rédige, le fondateur valide | |
| Publication autonome | Claude rédige et publie directement, disclaimers appliqués | ✓ |

**User's choice:** Publication autonome.

---

## Taxonomie : types & classement

| Option | Description | Selected |
|--------|-------------|----------|
| Deux types : articles + cours | Articles autonomes + cours ordonnés (séquentiel, ex. MT5) | ✓ |
| Que des articles | Tout indépendant, relié par tags | |
| Que des cours | Tout en parcours ordonnés | |

**User's choice:** Deux types (articles + cours). Classement (multi-sélection) : **par thème + par niveau + par plateforme**.

---

## Navigation & lecture vitrine

| Option | Description | Selected |
|--------|-------------|----------|
| Page « Académie » avec filtres | Une page, articles + cours, filtres thème/niveau/plateforme | ✓ |
| Deux sections séparées | Page Cours + page Articles distinctes | |

**User's choice:** Page « Académie » unique avec filtres. Nom/route = **Académie** (`/[locale]/academie`). Liens funnel (multi) : **home + espace signaux + nav principale**.

---

## Anatomie du contenu

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown + composants pédago | Callouts, étapes, captures, encadré trade, disclaimer auto | ✓ |
| Markdown simple | Titres/listes/images brutes | |

**User's choice:** Markdown + composants pédago. Habillage (multi) : **image de couverture + temps de lecture + sommaire (TOC) + navigation leçon préc./suiv.**

---

## Trilingue & robustesse

| Option | Description | Selected |
|--------|-------------|----------|
| Toujours les 3 langues d'un coup | fr+en+ar publiés ensemble | ✓ (cadence) |
| FR d'abord, traductions suivent | Publication FR seul possible | |
| Masquer dans la langue manquante | Article absent si pas traduit | |
| Fallback FR avec bandeau | Version FR + bandeau « traduction à venir » | ✓ (fallback) |

**User's choice:** Cadence = **les 3 langues d'un coup** (cas nominal) ; règle de fallback = **FR + bandeau** en filet de sécurité.

---

## Périmètre de livraison de la phase

| Option | Description | Selected |
|--------|-------------|----------|
| Système + quelques articles de preuve | Académie complète + 3-5 contenus réels ; bulk après | ✓ |
| Système + les 30 articles initiaux | Inclut la rédaction de ~90 fichiers MDX | |

**User's choice:** Système + quelques articles de preuve. Bulk (30 + 10/sem) = production continue après la phase.

---

## Claude's Discretion

- Choix de la lib de rendu MDX (`@next/mdx` vs `next-mdx-remote/rsc`).
- Mécanique des filtres (RSC searchParams vs client), sitemap + hreflang, calcul temps de lecture, extraction du sommaire, convention exacte de nommage des fichiers `(slug, locale)`.

## Deferred Ideas

- CMS éditeur/WYSIWYG superadmin (retiré).
- Recherche plein-texte, quiz/certificats, commentaires, SEO assisté par IA.
