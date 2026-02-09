const { logAudit } = require('../governance/audit');
const { addAllowedUser } = require('../config');
const { execCommand, readFile, listSkills } = require('../skills/executor');

/**
 * Check if a user is paired (allowed)
 */
function isPaired(ctx, config) {
  return config.allowed_users.includes(ctx.from.id);
}

/**
 * Handle /start command - entry point and pairing
 * Usage: /start <pairing_code>
 */
function handleStart(config) {
  return (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;

    // Already paired
    if (isPaired(ctx, config)) {
      ctx.reply(`Welcome back, ${username}! You're already paired. Send me any message.`);
      logAudit({ action: 'start', user_id: userId, username, status: 'already_paired' });
      return;
    }

    // Check for pairing code - Telegraf provides deep link payload via ctx.startPayload
    // Also check message text for manual /start <code> input
    const text = ctx.message.text || '';
    const parts = text.split(/\s+/);
    const code = ctx.startPayload || parts[1];

    if (!code) {
      ctx.reply('Send: /start <pairing_code>\nOr use deep link: t.me/multis02bot?start=<code>');
      logAudit({ action: 'start', user_id: userId, username, status: 'no_code' });
      return;
    }

    if (code.toUpperCase() === config.pairing_code.toUpperCase()) {
      addAllowedUser(userId);
      config.allowed_users.push(userId); // update in-memory too
      ctx.reply(`Paired successfully! Welcome, ${username}. Send me any message and I'll echo it back.`);
      logAudit({ action: 'pair', user_id: userId, username, status: 'success' });
    } else {
      ctx.reply('Invalid pairing code. Try again.');
      logAudit({ action: 'pair', user_id: userId, username, status: 'invalid_code', code_given: code });
    }
  };
}

/**
 * Handle /status command - show bot info
 */
function handleStatus(config) {
  return (ctx) => {
    if (!isPaired(ctx, config)) return;

    const info = [
      'multis bot v0.1.0',
      `Paired users: ${config.allowed_users.length}`,
      `LLM provider: ${config.llm.provider}`,
      `Governance: ${config.governance.enabled ? 'enabled' : 'disabled'}`
    ];
    ctx.reply(info.join('\n'));
  };
}

/**
 * Handle /unpair command - remove self from allowed users
 */
function handleUnpair(config) {
  return (ctx) => {
    const userId = ctx.from.id;
    if (!isPaired(ctx, config)) return;

    config.allowed_users = config.allowed_users.filter(id => id !== userId);
    const { saveConfig } = require('../config');
    saveConfig(config);

    ctx.reply('Unpaired. Send /start <code> to pair again.');
    logAudit({ action: 'unpair', user_id: userId, status: 'success' });
  };
}

/**
 * Handle /exec command - run shell commands with governance
 * Usage: /exec ls -la ~/Documents
 */
function handleExec(config) {
  return (ctx) => {
    if (!isPaired(ctx, config)) return;

    const text = ctx.message.text || '';
    const command = text.replace(/^\/exec\s*/, '').trim();

    if (!command) {
      ctx.reply('Usage: /exec <command>\nExample: /exec ls -la ~/Documents');
      return;
    }

    const result = execCommand(command, ctx.from.id);

    if (result.denied) {
      ctx.reply(`Denied: ${result.reason}`);
      return;
    }

    if (result.needsConfirmation) {
      ctx.reply(`Command "${command}" requires confirmation.\nThis feature is coming in a future update.`);
      return;
    }

    ctx.reply(result.output);
  };
}

/**
 * Handle /read command - read files with governance path checks
 * Usage: /read ~/Documents/notes.txt
 */
function handleRead(config) {
  return (ctx) => {
    if (!isPaired(ctx, config)) return;

    const text = ctx.message.text || '';
    const filePath = text.replace(/^\/read\s*/, '').trim();

    if (!filePath) {
      ctx.reply('Usage: /read <path>\nExample: /read ~/Documents/notes.txt');
      return;
    }

    const result = readFile(filePath, ctx.from.id);

    if (result.denied) {
      ctx.reply(`Denied: ${result.reason}`);
      return;
    }

    ctx.reply(result.output);
  };
}

/**
 * Handle /skills command - list available skills
 */
function handleSkills(config) {
  return (ctx) => {
    if (!isPaired(ctx, config)) return;
    ctx.reply(`Available skills:\n${listSkills()}`);
  };
}

/**
 * Handle /help command - show available commands
 */
function handleHelp(config) {
  return (ctx) => {
    if (!isPaired(ctx, config)) return;
    ctx.reply([
      'multis commands:',
      '/exec <cmd> - Run a shell command',
      '/read <path> - Read a file or list a directory',
      '/skills - List available skills',
      '/status - Bot info',
      '/unpair - Remove pairing',
      '/help - This message'
    ].join('\n'));
  };
}

/**
 * Handle all text messages - echo for POC1
 */
function handleMessage(config) {
  return (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;

    if (!isPaired(ctx, config)) {
      ctx.reply('You are not paired. Send /start <pairing_code> to pair.');
      logAudit({ action: 'message', user_id: userId, username, status: 'unpaired' });
      return;
    }

    const text = ctx.message.text;

    // Skip commands — they're handled by bot.command() / bot.start()
    if (text.startsWith('/')) return;

    logAudit({ action: 'message', user_id: userId, username, text });

    // POC1: Echo
    ctx.reply(`Echo: ${text}`);
  };
}

module.exports = {
  handleStart,
  handleStatus,
  handleUnpair,
  handleExec,
  handleRead,
  handleSkills,
  handleHelp,
  handleMessage,
  isPaired
};
