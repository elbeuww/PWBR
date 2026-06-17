/**
 * Client grammY publication-only (TG-01) — envoi sortant uniquement.
 *
 * PUBLICATION-ONLY (T-06-LISTENER) : `new Bot(token)` SANS bot.start() /
 * long-polling / webhook. Aucun listener entrant — le bot ne fait qu'émettre
 * des sendMessage vers le canal public. Toute surface d'élévation de privilège
 * (handlers de commandes, updates entrantes) est volontairement absente.
 *
 * Secrets (T-06-TOKEN) : TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID lus UNIQUEMENT
 * depuis apps/jobs/.env via process.env. JAMAIS loggés (pino), JAMAIS placés dans
 * job_runs.stats, JAMAIS retournés dans le Json du job. .env.example sans valeur.
 *
 * Robustesse : sendPost enveloppe sendMessage dans pRetry({ retries: 3 }) —
 * backoff exponentiel sur 429/5xx réseau (miroir finnhub/client.ts).
 *
 * Référence : 06-RESEARCH §Code Examples (grammY publication-only) + §Pattern 1.
 */
import { Bot } from 'grammy'
import pRetry from 'p-retry'

/**
 * Construit le client bot grammY depuis le token d'environnement.
 *
 * @throws si TELEGRAM_BOT_TOKEN est absent (env-throw, jamais de valeur par défaut).
 * @returns un Bot prêt à émettre (api.sendMessage) — JAMAIS démarré (pas de listener).
 */
export function getBot(): Bot {
  const token = process.env['TELEGRAM_BOT_TOKEN']
  if (!token) {
    throw new Error('telegram-publish: TELEGRAM_BOT_TOKEN must be set in apps/jobs/.env')
  }
  // Publication-only : on N'APPELLE JAMAIS bot.start() — aucun update entrant.
  return new Bot(token)
}

/**
 * Lit l'identifiant du canal cible depuis l'environnement.
 *
 * Forme numérique `-100…` recommandée (plus stable que `@username`).
 *
 * @throws si TELEGRAM_CHANNEL_ID est absent (env-throw).
 * @returns l'identifiant de canal (string).
 */
export function getChannelId(): string {
  const chatId = process.env['TELEGRAM_CHANNEL_ID']
  if (!chatId) {
    throw new Error('telegram-publish: TELEGRAM_CHANNEL_ID must be set in apps/jobs/.env')
  }
  return chatId
}

/**
 * Envoie un message HTML pré-formaté sur le canal, avec retry borné.
 *
 * parse_mode 'HTML' (formatMessage produit du HTML échappé, T-06-INJ) ;
 * disable_web_page_preview pour ne pas polluer le fil avec des previews.
 *
 * @param bot    Client grammY (getBot()).
 * @param chatId Canal cible (getChannelId()).
 * @param html   Message HTML déjà formaté et échappé (< 4096 chars).
 * @returns le message_id Telegram du message posté.
 */
export async function sendPost(bot: Bot, chatId: string, html: string): Promise<number> {
  const msg = await pRetry(
    () =>
      bot.api.sendMessage(chatId, html, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    { retries: 3 },
  )
  return msg.message_id
}
