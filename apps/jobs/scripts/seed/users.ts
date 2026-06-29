/**
 * users.ts — création déterministe de la cohorte démo (Plan 18-02 Task 2, SEED-01).
 *
 * Seul chemin LÉGAL vers public.profiles : `auth.admin.createUser` (le trigger
 * handle_new_user crée la ligne profiles ; JAMAIS d'INSERT direct dans auth.users
 * ni profiles — casse hash/identities + FK). Après création, UPDATE profiles pour
 * fixer role + source='demo' + created_at étalé.
 *
 * Déterminisme (D-06) : chaque instance Faker est seedée avec FAKER_SEED ; l'ordre
 * de génération est STABLE (boucle par index croissant) → même seed = même dataset.
 *
 * Multi-locale (RESEARCH §Code Examples) : ar (MENA prioritaire) / fr / en, fallback
 * `base` pour qu'aucun champ ne manque. Répartition déterministe par index.
 *
 * Concurrence bornée (Pitfall 4, T-18-09) : pLimit maison (p-limit absent du
 * workspace) borne les createUser concurrents pour ne pas saturer l'API Auth /
 * le pooler à ~10k users.
 *
 * Sécurité : emails `*@demo.nexa.invalid` (RFC 2606, jamais routables, T-18-06) +
 * user_metadata.seed:true (traçabilité). AUCUN champ de % de perf (SEED-02).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { Faker, ar, fr, en, base } from '@faker-js/faker'
import { DateTime } from 'luxon'
import type { Database } from '@app/supabase'
import {
  FAKER_SEED,
  SEED_SOURCE,
  DEMO_RATIOS,
  DEMO_VOLUMES,
  DEMO_TIMELINE,
  demoEmail,
  scaled,
} from './config'

type Client = SupabaseClient<Database>

/** Mot de passe partagé des comptes démo (.invalid, jamais routable). */
const DEMO_PASSWORD = 'SeedDemo!2026'

/** Rôle d'un profile démo (sous-ensemble member/affiliate/superadmin). */
type DemoRole = 'member' | 'affiliate' | 'superadmin'

/** User démo créé, exposé aux modules aval (subscriptions/payments/affiliation). */
export interface SeededUser {
  id: string
  role: DemoRole
  locale: 'ar' | 'fr' | 'en'
  /** Index déterministe (ordre de génération) — utile au seeding aval reproductible. */
  index: number
  /** created_at étalé (ISO UTC) appliqué au profile. */
  createdAt: string
}

/** Instances Faker par locale (MENA prioritaire), chacune seedée pour le déterminisme. */
function buildFakers(): Record<'ar' | 'fr' | 'en', Faker> {
  const fakers = {
    ar: new Faker({ locale: [ar, base] }),
    fr: new Faker({ locale: [fr, base] }),
    en: new Faker({ locale: [en, base] }),
  } as const
  for (const f of Object.values(fakers)) f.seed(FAKER_SEED)
  return fakers
}

/** Répartition déterministe des locales par index : ~50% ar / 30% fr / 20% en. */
function localeOf(i: number): 'ar' | 'fr' | 'en' {
  const m = i % 10
  if (m < 5) return 'ar'
  if (m < 8) return 'fr'
  return 'en'
}

/**
 * Rôle déterministe par index :
 *   - les `superadminCount` premiers indices → superadmin (teste is_superadmin())
 *   - puis ~affiliateShare de la population → affiliate
 *   - reste → member
 */
function roleOf(i: number, total: number): DemoRole {
  if (i < DEMO_RATIOS.superadminCount) return 'superadmin'
  const affiliateCount = Math.round(total * DEMO_RATIOS.affiliateShare)
  if (i < DEMO_RATIOS.superadminCount + affiliateCount) return 'affiliate'
  return 'member'
}

/**
 * created_at étalé sur la fenêtre d'acquisition (monthsBack mois avant l'ancre),
 * volume croissant vers les mois récents. Jamais identique (Pitfall 1, keyset).
 * Déterministe : dérivé de l'index + d'un tirage faker seedé.
 */
function spreadCreatedAt(f: Faker, anchor: DateTime, total: number, i: number): string {
  // Position relative (0 = plus ancien, 1 = plus récent), biaisée vers le récent.
  const linear = total > 1 ? i / (total - 1) : 1
  const skewed = Math.sqrt(linear) // courbe d'acquisition (densité croissante récente)
  const daysSpan = DEMO_TIMELINE.monthsBack * 30
  const baseDaysAgo = Math.round((1 - skewed) * daysSpan)
  // Jitter horaire déterministe pour éviter les égalités exactes (keyset).
  const jitterMinutes = f.number.int({ min: 0, max: 24 * 60 - 1 })
  return anchor.minus({ days: baseDaysAgo, minutes: jitterMinutes }).toISO() as string
}

/** Pool de promesses borné (p-limit maison — p-limit absent du workspace). */
function createLimiter(concurrency: number) {
  let active = 0
  const queue: Array<() => void> = []
  const next = () => {
    active -= 1
    const run = queue.shift()
    if (run) run()
  }
  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolvePromise, rejectPromise) => {
      const run = () => {
        active += 1
        fn().then(resolvePromise, rejectPromise).finally(next)
      }
      if (active < concurrency) run()
      else queue.push(run)
    })
  }
}

/**
 * Crée la cohorte démo déterministe. Retourne la liste des users (id, role, locale)
 * pour les modules aval. Concurrence createUser bornée à 5 (Pitfall 4).
 */
export async function seedUsers(client: Client): Promise<SeededUser[]> {
  const total = scaled(DEMO_VOLUMES.profiles)
  const fakers = buildFakers()
  const anchor = DateTime.utc(2026, 6, 25)
  const limit = createLimiter(5)

  const tasks: Promise<SeededUser>[] = []
  for (let i = 0; i < total; i += 1) {
    const locale = localeOf(i)
    const role = roleOf(i, total)
    const f = fakers[locale]
    // Générer AVANT la borne async pour garder l'ordre de génération faker stable.
    const createdAt = spreadCreatedAt(f, anchor, total, i)
    const email = demoEmail(i)

    tasks.push(
      limit(async () => {
        const { data, error } = await client.auth.admin.createUser({
          email,
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: { seed: true },
        })
        if (error || !data?.user) {
          throw new Error(`seed users: createUser ${email}: ${error?.message ?? 'no user'}`)
        }
        const userId = data.user.id

        // Le trigger handle_new_user a créé profiles → UPDATE role + source + created_at.
        const { error: updErr } = await client
          .from('profiles')
          .update({ role, source: SEED_SOURCE, created_at: createdAt })
          .eq('id', userId)
        if (updErr) {
          throw new Error(`seed users: update profile ${email}: ${updErr.message}`)
        }

        return { id: userId, role, locale, index: i, createdAt }
      }),
    )
  }

  return Promise.all(tasks)
}
