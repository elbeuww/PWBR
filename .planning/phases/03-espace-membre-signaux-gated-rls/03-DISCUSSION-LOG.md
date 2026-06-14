# Phase 3: Espace membre signaux (gated RLS) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 3-Espace membre signaux (gated RLS)
**Areas discussed:** Cartes & liste, Filtres & tri, Détail (vulgarisation & chart), Temps réel, Navigation, États UI, Volume & pagination, Disclaimer membre

---

## Cartes & liste

| Option | Description | Selected |
|--------|-------------|----------|
| Grille de cartes | Cartes responsives 1/2-3 col, met en valeur score+direction | ✓ |
| Liste compacte verticale | Lignes denses, plus d'items visibles | |
| Tableau triable | Colonnes triables, pro/dense mais intimidant | |
| **Statuts** — Seulement 'active' | Liste = opportunités exploitables maintenant | ✓ |
| **Statuts** — Active + expirés grisés | Brouille « quoi trader » + empiète sur P5 | |
| **Score** — Chiffre + libellé + couleur | « 82/100 · Forte conviction », couleur neutre | ✓ |
| **Score** — Jauge/anneau | Joli mais primitive en plus | |
| **Score** — Chiffre brut | Peu parlant non-technique | |
| **Fraîcheur** — Âge relatif + échéance | « il y a 2 h » + valid_until | ✓ |
| **Fraîcheur** — Âge relatif seul | Cache l'échéance | |

**User's choice:** Grille de cartes · seulement 'active' · chiffre+libellé+couleur neutre · âge relatif + échéance
**Notes:** Couleur du score NEUTRE — vert/rouge réservés à la direction long/short (sémantique trading).

---

## Filtres & tri

| Option | Description | Selected |
|--------|-------------|----------|
| Chips/segments | Pastilles toggle visibles | |
| Menus déroulants | Selects compacts, cachent les options | |
| Barre mixte | Chips style/risque + recherche actif | ✓ |
| **Combinaison** — Cumulables (ET) | Plusieurs filtres simultanés | ✓ |
| **Combinaison** — Exclusifs | Un seul à la fois | |
| **Persistance** — URL query params | Rechargeable, partageable, RSC | ✓ |
| **Persistance** — État local | Perdu au reload | |
| **Tri** — Score + fraîcheur + R:R | Score défaut + 2 alternatifs | ✓ |
| **Tri** — Score seul | Minimal | |

**User's choice:** Barre mixte · cumulables (ET) · URL query params · score (défaut) + fraîcheur + R:R
**Notes:** —

---

## Détail (vulgarisation & chart)

| Option | Description | Selected |
|--------|-------------|----------|
| **Simple** — Note vétéran + plan résumé | veteran_note + direction/entrée/SL/TP/R:R | ✓ |
| **Simple** — Note vétéran seule | Plan à chercher ailleurs | |
| **Simple** — Résumé reformulé | Risque d'altérer le contenu IA faisant foi | |
| **Jargon** — Bruts + glossaire/infobulles | Contenu IA tel quel + aide additive | ✓ |
| **Jargon** — Bruts tels quels | Intimidant pour débutant | |
| **Décompo** — Barres par dimension | technique/fondamental/news/structure (recharts) — SI dispo | ✓ |
| **Décompo** — Score + facteurs contributifs | Robuste sans breakdown stocké (repli) | |
| **Décompo** — Score + libellé seul | Minimal | |
| **Chart** — Lecture seule + niveaux tracés | TF analyse, ~100-150 bougies, entrée/SL/TP | ✓ |
| **Chart** — Interactif (zoom/pan) | Plus lourd, intimidant | |

**User's choice:** Note vétéran + plan résumé · jargon brut + glossaire/infobulles · barres par dimension (si source dispo) · chart lecture seule + niveaux tracés
**Notes:** FLAG RECHERCHE — confirmer la source des composantes du score, sinon repli « facteurs contributifs ».

---

## Temps réel

| Option | Description | Selected |
|--------|-------------|----------|
| Badge discret 'N nouveaux' | Pastille en haut, clic pour insérer | ✓ |
| Insertion auto + animation | Peut décaler la lecture | |
| **Granularité** — Nouveaux + retrait à l'expiration | INSERT + transitions de statut | ✓ |
| **Granularité** — Nouveaux seulement | Expirations au prochain reload | |
| **Portée** — Liste seulement (MVP) | Détail = instantané | ✓ |
| **Portée** — Liste + détail | Plus de surface temps réel | |
| **Repli** — Silencieux + revalidation | Realtime = bonus, pas dépendance dure | ✓ |
| **Repli** — Best-effort sans repli | Moins robuste | |

**User's choice:** Badge discret · INSERT + retrait à l'expiration · liste seulement (MVP) · repli silencieux + revalidation
**Notes:** —

---

## Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Route dédiée /signaux/[id] | RSC, deep-link partageable, recharge OK | ✓ |
| Modal / drawer | URL non partageable, overlay | |

**User's choice:** Route dédiée `/[locale]/(member)/signaux/[id]`
**Notes:** Cohérent avec l'état filtres dans l'URL.

---

## États UI (vide / chargement / erreur)

| Option | Description | Selected |
|--------|-------------|----------|
| Les trois soignés | Vide rassurant + skeletons + erreur réessayer | ✓ |
| Vide + erreur seulement | Chargement basique | |

**User's choice:** Les trois soignés
**Notes:** La liste sera souvent vide (immuabilité 1 actif/clé + cycle des jobs) → l'état vide doit rassurer.

---

## Volume & pagination

| Option | Description | Selected |
|--------|-------------|----------|
| Tout afficher (cap ~100) | Volume borné par immuabilité | ✓ |
| Pagination | Superflu au MVP | |
| Scroll infini | Complexe avec realtime | |

**User's choice:** Tout afficher avec plafond de sécurité (~100), pas de pagination MVP
**Notes:** —

---

## Disclaimer membre (LEGAL-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Footer + bandeau dédié | Footer transverse + rappel sur surface signaux | ✓ |
| Footer transverse seul | Plus sobre | |

**User's choice:** Footer + bandeau dédié « contenu éducatif, pas un conseil personnalisé, risque de perte »
**Notes:** Surface qui présente des plans de trade → plus défendable légalement.

---

## Claude's Discretion

- Wiring exact Supabase Realtime (channel, filtres `postgres_changes`, interaction RLS).
- Découpage des composants (SignalCard, FilterBar, SignalDetail, CandleChart, ScoreBreakdown, glossaire).
- Format des nombres/prix par actif (décimales) via Intl/`<bdi>`.
- Mécanique glossaire/infobulles (tooltip shadcn vs section dédiée).
- Stratégie de revalidation (intervalle, react-query staleTime + Realtime).
- Extension du namespace `signals` vs nouveau namespace.

## Deferred Ideas

- Historique signaux + % de réussite chiffré → Phase 5 (track record).
- Détail en temps réel (signal ouvert qui s'invalide) → écarté du MVP.
- Notifications push/email à la publication → future.
- Pagination/scroll infini → si le volume explose (peu probable).
- Accessibilité avancée du chart (résumé textuel lecteurs d'écran) → si objectif a11y formel.
</content>
