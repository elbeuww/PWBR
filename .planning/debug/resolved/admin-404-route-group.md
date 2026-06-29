---
status: resolved
trigger: "Le back-office /admin renvoie 404 partout (UAT phase 20, Test 1 Cold Start)."
created: 2026-06-27
updated: 2026-06-28
runtime_verified: 2026-06-28
---

> **Runtime verifié (2026-06-28)** : `pnpm dev` à froid → `✓ Compiled /admin`, `GET /admin`
> renvoie 307 (pas de session → login) ou 404 (session non-superadmin → notFound D-09) —
> les deux = comportement CORRECT du gate, plus jamais le 404 « route inexistante ».
> Le 404 observé pendant le re-test venait du compte connecté `uat-abonne@nexa.test` (role
> `member`), pas d'un défaut de routing. Confirmé via `auth.sessions` (session active = abonné).
> Pour l'UAT cockpit : `rcoul20@gmail.com` promu superadmin (réversible).

# Debug Session: admin-404-route-group

## Symptoms

- expected: Connecté en superadmin, `/admin` charge le cockpit (4 axes, données réelles seed ~10k). Les sous-routes `/admin/membres`, `/admin/file`, `/admin/affiliation/payouts`, `/admin/sante`, `/admin/signaux`, etc. répondent.
- actual: Tout `/admin/*` renvoie 404. Le back-office est entièrement injoignable.
- error: HTTP 404 (Next.js not-found).
- timeline: Découvert pendant l'UAT phase 20, Test 1 (Cold Start Smoke Test), 2026-06-27. Jamais joignable depuis que le back-office vit dans un route group.
- reproduction: `pnpm dev` à froid, ouvrir `/admin` (ou n'importe quelle sous-route) connecté en superadmin → 404.

## Current Focus

hypothesis: `apps/web/src/app/(admin)` est un route group Next.js (parenthèses) → Next retire le segment de l'URL. Donc `app/(admin)/page.tsx` sert `/`, `app/(admin)/membres/page.tsx` sert `/membres`, etc. Tous les liens (AdminSidebar, AxisSummary*), le middleware i18n (`(?!admin|…)`) et les specs E2E visent `/admin/*` → 404. Les specs d'isolation passent pour la mauvaise raison (tout 404, pas le gating réel).
test: CONFIRMÉ par code (voir Evidence).
expecting: route group confirmé, fix = renommer en segment littéral.
next_action: git mv (admin) → admin, maj 3 garde-fous + 4 imports alias, typecheck + 3 suites vertes.

reasoning_checkpoint:
  hypothesis: "Le dossier app/(admin) est un route group (parenthèses) → Next strip le segment `admin` de l'URL. Aucune route ne sert donc `/admin/*`, alors que sidebar, middleware matcher et specs visent tous `/admin/*` → 404 systématique."
  confirming_evidence:
    - "ls app/ : (admin) présent, admin (littéral) absent — observation directe filesystem."
    - "AdminSidebar.tsx hrefs littéraux /admin, /admin/membres, /admin/file, /admin/sante, /admin/signaux, /admin/affiliation/* (lignes 48-74)."
    - "AxisSummary{Ops,Revenus,Acquisition}.tsx href=/admin/* (sante, file, membres, affiliation)."
    - "middleware.ts matcher `(?!admin|api|…)` exclut littéralement `admin` → suppose des URLs /admin/* qui n'existent pas avec un route group."
    - "Tous les page.goto des specs e2e/admin/* et e2e/isolation/* ciblent /admin/* — donc 404 actuel."
  falsification_test: "Si après git mv (admin)→admin (segment littéral) + maj imports, `pnpm typecheck` passe ET les specs cockpit atteignent /admin en 200, l'hypothèse est confirmée. Si /admin reste 404, hypothèse fausse."
  fix_rationale: "Renommer (admin) en admin transforme le route group en segment littéral → /admin/* est servi par les pages existantes. Adresse la cause (segment strippé), pas un symptôme. Le layout fournit déjà FR + requireRole('superadmin'), imports relatifs (../../lib, ./_components) restent valides (même profondeur)."
  blind_spots: "4 fichiers src/components/admin/*RowActions importent via alias `@/app/(admin)/.../actions` → DOIVENT être mis à jour sinon typecheck casse (HORS scope initial des 3 garde-fous — détecté à la vérification). Les commentaires en prose mentionnant (admin) dans specs/admin-service ne sont pas load-bearing."

fix cadré (pré-diagnostiqué):
1. `git mv app/(admin)` → `app/admin` (segment littéral ; reste hors `[locale]` ; layout fournit déjà FR + `requireRole('superadmin')`).
2. Maj 3 garde-fous codant en dur `(admin)` :
   - `apps/web/src/styles/__tests__/rls-unchanged.test.ts` (SCANNED_GROUPS, groupBaseDir, ALLOWLIST)
   - `apps/web/src/styles/__tests__/theme-scan.test.ts` (FOUNDATION_FILES + sanity)
   - `apps/web/test/no-perf-seed-claims.test.ts` (ADMIN_UI_FILES)
3. `pnpm typecheck` + relancer les 3 suites → vert. Reprendre l'UAT 20 Test 1.

## Evidence

- timestamp: 2026-06-27 — `ls apps/web/src/app/` montre `(admin)` présent, `admin` absent. Confirme le route group.
- timestamp: 2026-06-27 — middleware.ts matcher `'/((?!admin|api|_next/...).*)'` exclut littéralement `admin` → le middleware suppose des URLs `/admin/*` réelles, incompatibles avec un route group qui strip le segment. Confirme l'intention « segment littéral ».
- timestamp: 2026-06-27 — AdminSidebar.tsx : hrefs littéraux `/admin`, `/admin/membres`, `/admin/file`, `/admin/sante`, `/admin/signaux`, `/admin/affiliation/*` (l.48-74). AxisSummary{Ops,Revenus,Acquisition}.tsx : `href=/admin/*`. Tous pointaient vers des URLs 404.
- timestamp: 2026-06-27 — layout.tsx `(admin)` fournit déjà `NextIntlClientProvider locale="fr"` + `requireRole('superadmin')` ; imports relatifs `../../lib/auth/gate` et `./_components/AdminSidebar` → restent valides après rename (profondeur identique).
- timestamp: 2026-06-27 — DÉCOUVERTE hors scope initial (technique « Follow the indirection ») : 4 fichiers `src/components/admin/*RowActions.tsx` + `PayoutRowAction.tsx` importent via alias `@/app/(admin)/.../actions`. Imports module load-bearing → cassent typecheck/build si non mis à jour. Corrigés.
- timestamp: 2026-06-27 — specs e2e/admin/* et e2e/isolation/* naviguent déjà vers `/admin/*` (page.goto) → après fix, cockpit.spec atteint /admin en 200 (au lieu de 404), isolation/gating conservent le 404 via requireRole. Mentions `(admin)` dans les specs = prose, non load-bearing.

## Eliminated

[none — hypothèse initiale confirmée du premier coup par le code]

## Resolution

root_cause: `apps/web/src/app/(admin)` était un **route group** Next.js (nom entre parenthèses). Next.js retire ces segments de l'URL : `app/(admin)/page.tsx` servait `/` (et entrait en conflit avec `[locale]`), `app/(admin)/membres/page.tsx` servait `/membres`, etc. Aucune route ne servait donc `/admin/*`, alors que la sidebar, les liens « Voir le détail », le matcher middleware et toutes les specs E2E ciblent `/admin/*` → 404 systématique sur tout le back-office.

fix: Renommé le route group en **segment littéral** via `git mv "app/(admin)" "app/admin"` (19 fichiers, suivis comme renames). Le segment reste hors `[locale]` ; le layout fournit déjà FR fixe + `requireRole('superadmin')`. Mis à jour les références codant en dur le chemin :
- 4 imports alias `@/app/(admin)/.../actions` → `@/app/admin/...` (MemberRowActions, PayoutRowAction, ApplicationRowActions, QueueRowActions).
- 3 garde-fous statiques : rls-unchanged.test.ts (SCANNED_GROUPS, groupBaseDir, ALLOWLIST), theme-scan.test.ts (FOUNDATION_FILES + sanity), no-perf-seed-claims.test.ts (ADMIN_UI_FILES).

verification: `pnpm typecheck` (tsc -b) clean ; les 3 suites touchées = 18/18 vertes ; suite Vitest complète = 676 passed / 13 skipped / 0 failed (aucune régression). theme-scan.test.ts lit chaque `app/admin/*` via `readFoundation` (throw si introuvable) → preuve que les chemins renommés résolvent réellement (pas de vert vacant). Validation runtime du 404→200 = checkpoint humain (E2E/UAT, nécessite dev server + DB seedée + auth superadmin).

files_changed:
  - apps/web/src/app/admin/** (renommé depuis app/(admin)/**, git mv, 19 fichiers)
  - apps/web/src/components/admin/MemberRowActions.tsx
  - apps/web/src/components/admin/PayoutRowAction.tsx
  - apps/web/src/components/admin/ApplicationRowActions.tsx
  - apps/web/src/components/admin/QueueRowActions.tsx
  - apps/web/src/styles/__tests__/rls-unchanged.test.ts
  - apps/web/src/styles/__tests__/theme-scan.test.ts
  - apps/web/test/no-perf-seed-claims.test.ts
