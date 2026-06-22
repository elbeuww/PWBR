/**
 * telegram-rebrand — outil ops one-off : reconfigure l'identité du canal Telegram
 * (nom + description) et, optionnellement, l'identité du bot, vers la marque NEXA.
 *
 * Contexte : l'ancienne marque « MERA / Make Everybody Rich Again » a été remplacée
 * par « NEXA — Nouvelle Ère · Alliance d'Échange » (phase 11). Le nom/description/photo
 * du canal ont été posés hors-code via l'API et portent encore l'ancienne identité.
 *
 * LEGAL-01 (D-06 révisée) : le disclaimer vit dans la DESCRIPTION du canal (pas par
 * message). La nouvelle description condense le disclaimer FR + AR (limite Telegram
 * 255 chars pour setChatDescription) — source : disclaimer.footer (messages fr/ar).
 *
 * Secrets : TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID lus depuis apps/jobs/.env.
 * JAMAIS loggés.
 *
 * Usage :
 *   pnpm --filter jobs exec tsx src/scripts/telegram-rebrand.ts            # INSPECT (lecture seule)
 *   pnpm --filter jobs exec tsx src/scripts/telegram-rebrand.ts --apply    # APPLIQUE le rebrand canal
 *   pnpm --filter jobs exec tsx src/scripts/telegram-rebrand.ts --apply --bot   # + identité du bot
 *   pnpm --filter jobs exec tsx src/scripts/telegram-rebrand.ts --apply --photo brand/nexa-logo.png  # + photo
 *
 * Le bot DOIT être ADMINISTRATEUR du canal (droit « Change channel info ») sinon 400/403.
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { InputFile } from 'grammy'
import { getBot, getChannelId } from '../telegram/bot'

// ─── Identité NEXA cible (le « bon nom » + la « bonne description ») ─────────────

/** Nom public du canal (titre). */
const CHANNEL_TITLE = 'NEXA — Signaux'

/**
 * Description du canal (≤255 chars, limite Telegram). Porte le disclaimer LEGAL-01
 * condensé FR + AR + la baseline NEXA. Source : disclaimer.footer (messages fr/ar.json).
 */
const CHANNEL_DESCRIPTION =
  '📈 NEXA — Signaux & analyses de trading. Nouvelle Ère · Alliance d’Échange.\n' +
  '⚠️ Contenu éducatif, pas un conseil en investissement ; risque de perte en capital.\n' +
  '‏محتوى تعليمي وليس نصيحة استثمارية؛ مخاطر خسارة رأس المال.'

/** Identité du bot (BotFather equivalents via API). */
const BOT_NAME = 'NEXA'
const BOT_SHORT_DESCRIPTION = 'NEXA — Nouvelle Ère · Alliance d’Échange.'
const BOT_DESCRIPTION =
  'NEXA — Nouvelle Ère · Alliance d’Échange.\n' +
  'Contenu éducatif, aucune promesse de gain, pas un conseil en investissement. ' +
  'Le trading comporte un risque de perte en capital.\n' +
  'محتوى تعليمي. لا وعد بأي ربح. هذا ليس نصيحة استثمارية.'

// ─── Args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const WITH_BOT = args.includes('--bot')
// --photo-only : ne touche QUE la photo (évite CHAT_NOT_MODIFIED en re-posant le même texte).
const PHOTO_ONLY = args.includes('--photo-only')
const photoFlagIdx = args.indexOf('--photo')
const PHOTO_PATH = photoFlagIdx >= 0 ? args[photoFlagIdx + 1] : undefined

function assertDescLen(label: string, text: string, max: number): void {
  // Telegram compte en code points UTF-16 ; [...text].length approxime les caractères visibles.
  const len = [...text].length
  const status = len <= max ? 'OK' : `TROP LONG (> ${max})`
  console.log(`  ${label}: ${len}/${max} chars — ${status}`)
  if (len > max) {
    throw new Error(`${label} dépasse la limite Telegram de ${max} caractères (${len}).`)
  }
}

async function main(): Promise<void> {
  const bot = getBot()
  const channelId = getChannelId()

  // ── INSPECT (toujours, lecture seule) ───────────────────────────────────────
  const me = await bot.api.getMe()
  const chat = await bot.api.getChat(channelId)

  console.log('═══ ÉTAT ACTUEL ═══')
  console.log('Bot       :', me.first_name, `(@${me.username})`)
  const chatTitle = 'title' in chat ? chat.title : '(?)'
  const chatDesc = 'description' in chat ? chat.description : undefined
  console.log('Canal     :', chatTitle)
  console.log('Description actuelle :')
  console.log(chatDesc ? chatDesc.split('\n').map((l) => '   | ' + l).join('\n') : '   (vide)')

  console.log('\n═══ CIBLE NEXA ═══')
  console.log('Nom canal :', CHANNEL_TITLE)
  console.log('Description canal :')
  console.log(CHANNEL_DESCRIPTION.split('\n').map((l) => '   | ' + l).join('\n'))
  console.log('Longueurs :')
  assertDescLen('description canal', CHANNEL_DESCRIPTION, 255)
  if (WITH_BOT) {
    assertDescLen('bot short_description', BOT_SHORT_DESCRIPTION, 120)
    assertDescLen('bot description', BOT_DESCRIPTION, 512)
  }

  if (!APPLY) {
    console.log('\n[DRY-RUN] Aucune modification. Relancer avec --apply pour écrire.')
    return
  }

  // ── APPLY (écriture sortante) ───────────────────────────────────────────────
  console.log('\n═══ APPLICATION ═══')
  if (!PHOTO_ONLY) {
    await bot.api.setChatTitle(channelId, CHANNEL_TITLE)
    console.log('✓ Nom du canal mis à jour')
    await bot.api.setChatDescription(channelId, CHANNEL_DESCRIPTION)
    console.log('✓ Description du canal mise à jour')
  } else {
    console.log('• Mode --photo-only : nom/description/bot ignorés')
  }

  if (PHOTO_PATH) {
    const abs = resolve(process.cwd(), PHOTO_PATH)
    const buf = readFileSync(abs)
    await bot.api.setChatPhoto(channelId, new InputFile(buf, 'nexa-logo.png'))
    console.log('✓ Photo du canal mise à jour (', PHOTO_PATH, ')')
  } else {
    console.log('• Photo : non modifiée (passer --photo <chemin> pour la remplacer)')
  }

  if (WITH_BOT && !PHOTO_ONLY) {
    await bot.api.setMyName(BOT_NAME)
    await bot.api.setMyShortDescription(BOT_SHORT_DESCRIPTION)
    await bot.api.setMyDescription(BOT_DESCRIPTION)
    console.log('✓ Identité du bot mise à jour (name + short/long description)')
  } else {
    console.log('• Bot : identité non modifiée (passer --bot pour la rebrander)')
  }

  console.log('\nTerminé. Vérifier le rendu dans Telegram.')
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('telegram-rebrand a échoué :', msg)
  process.exitCode = 1
})
