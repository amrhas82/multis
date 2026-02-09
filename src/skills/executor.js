const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { isCommandAllowed, isPathAllowed } = require('../governance/validate');
const { logAudit } = require('../governance/audit');

const MAX_OUTPUT = 4000; // Telegram message limit ~4096 chars

/**
 * Execute a shell command after governance validation
 * @param {string} command - Full command string
 * @param {number} userId - Telegram user ID for audit
 * @returns {Object} - { success, output, denied, reason }
 */
function execCommand(command, userId) {
  const check = isCommandAllowed(command);

  if (!check.allowed) {
    logAudit({ action: 'exec', user_id: userId, command, allowed: false, reason: check.reason });
    return { success: false, denied: true, reason: check.reason };
  }

  if (check.requiresConfirmation) {
    logAudit({ action: 'exec', user_id: userId, command, allowed: true, requires_confirmation: true });
    return { success: false, denied: false, needsConfirmation: true, command };
  }

  try {
    const output = execSync(command, {
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      shell: '/bin/bash'
    });

    const trimmed = output.length > MAX_OUTPUT
      ? output.slice(0, MAX_OUTPUT) + '\n... (truncated)'
      : output;

    logAudit({ action: 'exec', user_id: userId, command, allowed: true, status: 'success' });
    return { success: true, output: trimmed || '(no output)' };
  } catch (err) {
    const stderr = err.stderr || err.message;
    logAudit({ action: 'exec', user_id: userId, command, allowed: true, status: 'error', error: stderr });
    return { success: false, output: `Error: ${stderr}` };
  }
}

/**
 * Read a file after governance path validation
 * @param {string} filePath - Path to read
 * @param {number} userId - Telegram user ID for audit
 * @returns {Object} - { success, output, denied, reason }
 */
function readFile(filePath, userId) {
  const expanded = filePath.replace(/^~/, process.env.HOME || process.env.USERPROFILE);
  const resolved = path.resolve(expanded);

  const check = isPathAllowed(resolved);

  if (!check.allowed) {
    logAudit({ action: 'read', user_id: userId, path: filePath, allowed: false, reason: check.reason });
    return { success: false, denied: true, reason: check.reason };
  }

  try {
    if (!fs.existsSync(resolved)) {
      return { success: false, output: `File not found: ${filePath}` };
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      // List directory contents instead
      const entries = fs.readdirSync(resolved);
      const output = entries.join('\n') || '(empty directory)';
      const trimmed = output.length > MAX_OUTPUT
        ? output.slice(0, MAX_OUTPUT) + '\n... (truncated)'
        : output;
      logAudit({ action: 'read', user_id: userId, path: filePath, allowed: true, type: 'directory' });
      return { success: true, output: trimmed };
    }

    if (stat.size > 512 * 1024) {
      return { success: false, output: `File too large: ${(stat.size / 1024).toFixed(0)}KB (max 512KB)` };
    }

    const content = fs.readFileSync(resolved, 'utf8');
    const trimmed = content.length > MAX_OUTPUT
      ? content.slice(0, MAX_OUTPUT) + '\n... (truncated)'
      : content;

    logAudit({ action: 'read', user_id: userId, path: filePath, allowed: true, type: 'file' });
    return { success: true, output: trimmed || '(empty file)' };
  } catch (err) {
    logAudit({ action: 'read', user_id: userId, path: filePath, allowed: true, status: 'error', error: err.message });
    return { success: false, output: `Error: ${err.message}` };
  }
}

/**
 * List available skills from skills/ directory
 * @returns {string} - Formatted skill list
 */
function listSkills() {
  const skillsDir = path.join(__dirname, '..', '..', 'skills');

  if (!fs.existsSync(skillsDir)) {
    return 'No skills directory found.';
  }

  const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));
  const skills = files.map(f => {
    const content = fs.readFileSync(path.join(skillsDir, f), 'utf8');
    // Parse frontmatter
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return `- ${f}`;
    const name = (match[1].match(/name:\s*(.+)/) || [])[1] || f;
    const desc = (match[1].match(/description:\s*(.+)/) || [])[1] || '';
    return `- ${name}: ${desc}`;
  });

  return skills.join('\n') || 'No skills found.';
}

module.exports = { execCommand, readFile, listSkills };
