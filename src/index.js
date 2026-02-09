const { loadConfig, ensureMultisDir } = require('./config');
const { createBot } = require('./bot/telegram');
const { logAudit } = require('./governance/audit');

function main() {
  ensureMultisDir();
  const config = loadConfig();

  console.log('multis v0.1.0');
  console.log(`Pairing code: ${config.pairing_code}`);
  console.log(`Paired users: ${config.allowed_users.length}`);
  console.log(`LLM provider: ${config.llm.provider}`);

  const bot = createBot(config);

  logAudit({ action: 'bot_start', paired_users: config.allowed_users.length });

  bot.launch();
  console.log('Bot is running. Send /start <pairing_code> in Telegram to pair.');

  // Graceful shutdown
  process.once('SIGINT', () => {
    console.log('\nShutting down...');
    logAudit({ action: 'bot_stop', reason: 'SIGINT' });
    bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    logAudit({ action: 'bot_stop', reason: 'SIGTERM' });
    bot.stop('SIGTERM');
  });
}

main();
