/**
 * captureRef — capture du paramètre `?ref` dans le middleware composé (D-09, D-10).
 *
 * Inséré entre handleI18n et updateSession (ordre verrouillé locale → ref → session).
 * MUTE la response next-intl transmise (ne la recrée JAMAIS, sinon le rewrite de locale
 * est perdu — même invariant que updateSession, Pitfall 2).
 *
 * Sécurité (T-07-REFINJ) : la valeur `?ref` est un input non fiable. On valide la regex
 * ^[A-Z0-9]{3,20}$ AVANT toute pose de cookie ; une valeur non conforme est ignorée
 * (no-op). Le code n'est jamais concaténé — il sert uniquement de valeur de cookie.
 *
 * Cookie aff_ref : httpOnly (non lisible/forgeable depuis JS, T-07-COOKIE), sameSite=lax
 * (capture cross-site sur navigation top-level depuis un lien influenceur, A1), secure,
 * 30 jours (D-09). Last-touch (D-10) : le dernier ?ref valide écrase toujours le précédent.
 *
 * Source : 07-RESEARCH.md §Pattern 1.
 */
import type { NextRequest, NextResponse } from 'next/server'

const REF_COOKIE = 'aff_ref'
const REF_MAX_AGE = 60 * 60 * 24 * 30 // 30 jours (D-09)
const CODE_RE = /^[A-Z0-9]{3,20}$/ // borne D-06 (anti-injection T-07-REFINJ)

/**
 * Pose le cookie aff_ref si `?ref=CODE` est présent et conforme. No-op sinon.
 * Last-touch (D-10) : écrase toujours le cookie précédent.
 */
export function captureRef(request: NextRequest, response: NextResponse): void {
  const raw = request.nextUrl.searchParams.get('ref')
  if (!raw) return
  const code = raw.toUpperCase().trim()
  if (!CODE_RE.test(code)) return // valeur non conforme → ignorée (anti-injection)

  response.cookies.set({
    name: REF_COOKIE,
    value: code,
    maxAge: REF_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
  })
}
