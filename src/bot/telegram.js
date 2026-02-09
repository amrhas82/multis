const { Telegraf } = require('telegraf');
const { logAudit } = require('../governance/audit');
const { handleStart, handleStatus, handleUnpair, handleExec, handleRead, handleSkills, handleHelp, handleMessage } = require('./handlers');

/**
 * Create and configure the Telegram bot
 * @param {Object} config - App configuration
 * @returns {Telegraf} - Configured bot instance
 */
function createBot(config) {
  if (!config.telegram_bot_token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required. Set it in .env or ~/.multis/config.json');
  }

  const bot = new Telegraf(config.telegram_bot_token);

  // Commands
  bot.start(handleStart(config));
  bot.command('status', handleStatus(config));
  bot.command('exec', handleExec(config));
  bot.command('read', handleRead(config));
  bot.command('skills', handleSkills(config));
  bot.command('help', handleHelp(config));
  bot.command('unpair', handleUnpair(config));

  // Echo all text messages
  bot.on('text', handleMessage(config));

  // Log errors
  bot.catch((err, ctx) => {
    console.error('Bot error:', err.message);
    logAudit({ action: 'error', error: err.message, update: ctx?.update?.update_id });
  });

  return bot;
}

module.exports = { createBot };
