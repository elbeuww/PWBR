# Phase 6: Canal Telegram public - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 6-canal-telegram-public
**Areas discussed:** Contenu du post, Langue du canal, Cadence & sélection, Cas vides / sous-seuil

---

## Contenu du post

### Granularité d'un post

| Option | Description | Selected |
|--------|-------------|----------|
| Récap journalier groupé | Un seul post/jour listant les trades clos + win rate | |
| Un post par trade clos | Chaque trade clos = son propre post | |
| Récap + win rate seul | Résumé chiffré minimaliste | |

**User's choice:** Free-text — « mélanger les 3, on ne reste pas sur un rythme statique ».
**Notes:** Formalisé en règle codable : récap quotidien (défaut) + post intraday pour trade notable + « win rate seul » le vendredi.

### Critère « notable » + conflit P5 (TP2)

| Option | Description | Selected |
|--------|-------------|----------|
| A — R réalisé ≥ 2.0 | Notable = gros R réalisé (donnée dispo), TP2 déféré | ✓ |
| A — R réalisé ≥ 3.0 | Même logique, seuil plus sélectif | |
| A — seuil au planning | Règle actée, chiffre calé par le planner | |

**User's choice:** A — R réalisé ≥ 2.0.
**Notes:** Conflit signalé — la Phase 5 (D-01) ne mesure que « TP1 atteint avant SL » (binaire), `realized_r` jusqu'à TP1 ; TP2 n'existe pas en base. Option A retenue pour rester dans le périmètre P6 et fidèle au « jamais gonflé ». Tracking TP2 → déféré.

### Champs par trade

| Option | Description | Selected |
|--------|-------------|----------|
| Actif + direction + résultat + R | « EUR/USD Long — ✅ TP1, +2.3R », sans niveaux | ✓ |
| Résultat seul (sans actif) | Minimaliste, anonymise l'actif | |
| Tout y compris niveaux | Entrée/SL/TP exacts | |

**User's choice:** Actif + direction + résultat + R.
**Notes:** Pas de niveaux exacts → préserve la valeur du produit payant + minimisation des données.

---

## Langue du canal

### Nombre de canaux / langues

| Option | Description | Selected |
|--------|-------------|----------|
| Un seul canal, FR | Canal unique en français | |
| Un seul canal, EN | Canal unique en anglais | |
| Un seul canal, AR | Canal unique en arabe | |
| Plusieurs canaux par langue | fr + en + ar séparés | |

**User's choice:** Free-text — « 1 seul canal, des posts en français ET arabe les deux langues ».
**Notes:** 1 canal, posts bilingues FR + AR (pas d'anglais).

### Agencement bilingue

| Option | Description | Selected |
|--------|-------------|----------|
| FR en haut, AR en bas | Un message unique, FR puis séparateur puis AR (RTL) | ✓ |
| AR en haut, FR en bas | Arabe en premier | |
| Deux messages séparés | Un message FR + un message AR | |

**User's choice:** FR en haut, AR en bas.
**Notes:** Un seul message, une seule notification ; disclaimer dans les deux langues.

---

## Cadence & sélection

### Fréquence du job

| Option | Description | Selected |
|--------|-------------|----------|
| Horaire (aligné H1) | Run chaque heure après outcome-tracker, notables intraday | ✓ |
| Une fois/jour | Un seul run quotidien | |
| À décider au planning | Besoin acté, cadence calée par le planner | |

**User's choice:** Horaire (aligné H1).
**Notes:** Cohérent avec D-03 P5 (outcomes sur bougies H1) ; permet le vrai « fil de l'eau ».

### Heure & fenêtre du récap quotidien

| Option | Description | Selected |
|--------|-------------|----------|
| Fin de journée NY (~21h UTC) | Récap des trades clos sur 24h après sessions US | ✓ |
| Début de journée (~06h UTC) | Récap matinal de la veille | |
| À décider au planning | Heure exacte calée par le planner | |

**User's choice:** Fin de journée NY (~21h UTC).
**Notes:** Fenêtre 24h ; heure exacte = constante config alignée sur les constantes anti look-ahead P5.

---

## Cas vides / sous-seuil

### Jour sans trade clos

| Option | Description | Selected |
|--------|-------------|----------|
| Skip silencieux | Pas de post ce jour-là | |
| Poster quand même | « Aucun trade clôturé aujourd'hui » + win rate | ✓ |

**User's choice:** Poster quand même.
**Notes:** Présence quotidienne constante voulue par le fondateur.

### Win rate sous le seuil N≥30

| Option | Description | Selected |
|--------|-------------|----------|
| « Échantillon insuffisant, N trades » | Identique à la vitrine (P5/D-09), N toujours montré | ✓ |
| Masquer la ligne win rate | Aucune mention sous le seuil | |

**User's choice:** « Échantillon insuffisant, N trades ».
**Notes:** Cohérence stricte plateforme ↔ Telegram, fidèle au « jamais gonflé ».

---

## Claude's Discretion

- Schéma `telegram_posts` + clé(s) d'idempotence (récap/hebdo par type+jour-UTC ; notable par `setup_id`) ; n° de migration (0013 réservé au cluster paiement P4 différé).
- Setup grammY 1.43 publication-only ; secrets bot/channel en `apps/jobs/.env`.
- Dimension/bucket exact du « win rate permanent » lu dans `pattern_stats`.
- Requête de sélection des trades clos (outcomes + trade_setups).
- Format exact du message (Markdown/HTML, emoji, séparateur RTL), gestion erreur/rate-limit Telegram, retry/backoff.
- Heure UTC exacte du récap + expression cron de la cadence horaire.

## Deferred Ideas

- Tracking TP2 / simulation TP partiels (touche le moteur d'outcomes P5).
- Canaux multiples par langue / version anglaise.
- Interaction / commandes du bot (publication-only au MVP).
- Lien d'acquisition/CTA dans les posts + analytics Telegram.
