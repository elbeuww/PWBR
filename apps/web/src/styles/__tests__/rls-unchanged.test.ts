/**
 * rls-unchanged.test.ts — garde structurelle Phase 16 (threat T-16-01).
 *
 * Invariant inviolable du reskin : la barrière de données reste la RLS anon. Les pages
 * member / account / marketing / auth lisent via `lib/supabase/server.ts` (anon client)
 * et la RLS est le seul rempart. Un reskin NE DOIT PAS :
 *   - importer `admin-service` (client service_role) sur une page non-admin,
 *   - référencer `service_role` / `SUPABASE_SERVICE_ROLE_KEY` sur une page non-admin,
 *   - migrer une lecture gated serveur vers `lib/supabase/client` (client browser).
 *
 * Ce scan filesystem (node:fs / node:path uniquement) parcourt les `page.tsx` /
 * `layout.tsx` des groupes (member)/(account)/(marketing)/(auth) sous app/[locale]/ et
 * ÉCHOUE sur toute infraction. Les deux fichiers de Server Actions pré-existants
 * (`app/[locale]/affiliation/actions.ts` et `app/[locale]/(auth)/actions.ts`) sont
 * ALLOWLISTÉS — le scan ne flague que les NOUVEAUX imports service_role de page non-admin.
 *
 * ÉTAT ATTENDU EN WAVE 1 : l'arbre est conforme → GREEN. SANITY prouve que le détecteur
 * d'import admin-service n'est pas trivial.
 *
 * Source : 16-PLAN.md task 1 (rls scan) ; threat T-16-01 ; PATTERNS.md C-1/C-2 (anon vs service_role).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'

// __dirname = apps/web/src/styles/__tests__ → racine src = ../../
const SRC_ROOT = path.resolve(__dirname, '../../')
const APP_LOCALE = path.resolve(SRC_ROOT, 'app/[locale]')

// Groupes de routes NON-admin scannés (chemins relatifs à app/[locale]/).
const SCANNED_GROUPS = ['(member)', '(account)', '(marketing)', '(auth)'] as const

// Allowlist : Server Actions pré-existants autorisés à utiliser service_role (D-13).
// Chemins relatifs à src/ — seuls les NOUVEAUX imports de page non-admin doivent échouer.
const ALLOWLIST = [
  'app/[locale]/affiliation/actions.ts',
  'app/[locale]/(auth)/actions.ts',
] as const

// Infractions interdites sur une page non-admin.
const FORBIDDEN: { token: string; re: RegExp }[] = [
  { token: 'import admin-service', re: /from\s+['"][^'"]*lib\/supabase\/admin-service['"]/ },
  { token: 'createAdminServiceClient', re: /createAdminServiceClient/ },
  { token: 'service_role / SERVICE_ROLE_KEY', re: /service_role|SUPABASE_SERVICE_ROLE_KEY/ },
  { token: 'browser client import (lib/supabase/client)', re: /from\s+['"][^'"]*lib\/supabase\/client['"]/ },
]

/**
 * Retire les commentaires (// ligne et bloc) avant l'analyse. Les pages non-admin
 * documentent SOUVENT « aucun service_role » dans leur en-tête : ces mentions en
 * prose ne sont PAS des infractions. Le scan ne mesure que du CODE réel (imports,
 * accès env, appels). Heuristique suffisante (pas de littéral contenant `//` ici).
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // blocs /* … */
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1') // lignes // … (épargne les `://` d'URL)
}

/** Liste récursive des page.tsx / layout.tsx sous un dossier. */
function listPages(dir: string): string[] {
  const out: string[] = []
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...listPages(full))
    } else if (entry === 'page.tsx' || entry === 'layout.tsx') {
      out.push(full)
    }
  }
  return out
}

/** Un fichier est-il allowlisté ? (comparaison src-relative, séparateurs normalisés). */
function isAllowlisted(abs: string): boolean {
  const rel = path.relative(SRC_ROOT, abs).split(path.sep).join('/')
  return (ALLOWLIST as readonly string[]).includes(rel)
}

describe('Phase 16 / T-16-01 : la barrière RLS anon reste intacte (pages non-admin)', () => {
  it('aucune page member/account/marketing/auth n’importe service_role ni le client browser pour une lecture gated', () => {
    const offenders: string[] = []
    for (const group of SCANNED_GROUPS) {
      const groupDir = path.join(APP_LOCALE, group)
      for (const file of listPages(groupDir)) {
        if (isAllowlisted(file)) continue
        const src = stripComments(readFileSync(file, 'utf-8'))
        for (const { token, re } of FORBIDDEN) {
          if (re.test(src)) {
            offenders.push(`${path.relative(SRC_ROOT, file).split(path.sep).join('/')} → ${token}`)
          }
        }
      }
    }
    expect(
      offenders,
      `Fuite de la barrière RLS anon sur une page non-admin :\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })

  it('SANITY — les deux Server Actions pré-existants sont explicitement allowlistés', () => {
    // Les deux chemins littéraux sont présents dans l'allowlist (preuve de l'exemption).
    expect((ALLOWLIST as readonly string[])).toContain('app/[locale]/affiliation/actions.ts')
    expect((ALLOWLIST as readonly string[])).toContain('app/[locale]/(auth)/actions.ts')
  })

  it('SANITY — le détecteur matche un import admin-service planté (détecteur non trivial)', () => {
    const planted = `import { createAdminServiceClient } from '@/lib/supabase/admin-service'`
    const adminImportRe = FORBIDDEN[0]!.re
    expect(adminImportRe.test(planted), 'doit matcher un import admin-service planté').toBe(true)
    const clientImportRe = FORBIDDEN[3]!.re
    expect(
      clientImportRe.test(`import { createClient } from '@/lib/supabase/client'`),
      'doit matcher un import du client browser planté',
    ).toBe(true)
  })
})
