'use server'
import 'server-only'

/**
 * Server Action — candidature affilié (AFF-01, D-08, Open Q1 RESOLVED).
 *
 * Frontière producteur-unique : la table `affiliate_applications` n'a AUCUNE policy
 * insert front (migration 0016). La candidature est donc insérée via `service_role`
 * LOCAL (admin-service.ts, `server-only`), exactement comme les mutations back-office.
 * Le candidat ne s'auto-évalue pas : la ligne est créée en `status='pending'` puis
 * passe en file de revue superadmin (D-08, pas d'auto-approbation).
 *
 * Trust boundary : l'input du formulaire est NON FIABLE → validé par Zod côté serveur
 * (≥1 réseau social, nb abonnés entier ≥0). PostgREST paramètre les valeurs (jamais
 * concaténées). Retour { ok } / { ok:false, error } i18n opaque — aucune fuite de
 * message Supabase brut. PAS de redirect (le client affiche un toast `sonner`).
 *
 * L'email est capturé depuis la session si l'utilisateur est connecté, sinon depuis
 * le champ du formulaire (candidat visiteur).
 */
import { z } from 'zod'
import { createAdminServiceClient } from '../../../lib/supabase/admin-service'
import { createClient } from '../../../lib/supabase/server'

/** Code d'erreur i18n opaque (clé `affiliate.application.errors.*`). */
export type ApplicationErrorCode = 'invalid' | 'submitFailed'

export type SubmitApplicationResult = { ok: true } | { ok: false; error: ApplicationErrorCode }

/**
 * Schéma serveur (source de vérité). Au moins UN canal d'audience requis
 * (réseau social, Telegram ou Facebook). Nb abonnés = entier ≥ 0.
 */
const applicationSchema = z
  .object({
    email: z.string().email(),
    socialLinks: z.string().trim().max(2000).optional().default(''),
    telegram: z.string().trim().max(500).optional().default(''),
    facebook: z.string().trim().max(500).optional().default(''),
    subscriberCount: z.coerce.number().int().min(0).max(1_000_000_000),
    interactions: z.string().trim().max(2000).optional().default(''),
  })
  .refine((v) => v.socialLinks !== '' || v.telegram !== '' || v.facebook !== '', {
    message: 'at_least_one_channel',
    path: ['socialLinks'],
  })

export async function submitApplication(formData: FormData): Promise<SubmitApplicationResult> {
  // Email : session connectée prioritaire, sinon champ saisi (candidat visiteur).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const parsed = applicationSchema.safeParse({
    email: user?.email ?? formData.get('email') ?? '',
    socialLinks: formData.get('socialLinks') ?? '',
    telegram: formData.get('telegram') ?? '',
    facebook: formData.get('facebook') ?? '',
    subscriberCount: formData.get('subscriberCount') ?? '0',
    interactions: formData.get('interactions') ?? '',
  })

  if (!parsed.success) {
    return { ok: false, error: 'invalid' }
  }

  const v = parsed.data
  const admin = createAdminServiceClient()
  const { error } = await admin.from('affiliate_applications').insert({
    applicant_email: v.email,
    social_links: v.socialLinks || null,
    telegram: v.telegram || null,
    facebook: v.facebook || null,
    subscriber_count: v.subscriberCount,
    interactions: v.interactions || null,
    status: 'pending',
  })

  if (error) {
    // Loggé serveur, jamais propagé brut (anti-fuite d'implémentation).
    console.error(`[submitApplication] insert affiliate_applications échoué : ${error.message}`)
    return { ok: false, error: 'submitFailed' }
  }

  return { ok: true }
}
