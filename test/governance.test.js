const { describe, it } = require('node:test');
const assert = require('node:assert');
const { isCommandAllowed, isPathAllowed } = require('../src/governance/validate');

const GOV = {
  commands: {
    allowlist: ['ls', 'pwd', 'cat', 'grep', 'git', 'mv'],
    denylist: ['rm', 'sudo', 'dd', 'shutdown'],
    requireConfirmation: ['mv', 'git push']
  },
  paths: {
    allowed: ['/home/testuser/Documents', '/home/testuser/Projects'],
    denied: ['/etc', '/var', '/usr', '/bin']
  }
};

describe('isCommandAllowed', () => {
  it('allows command in allowlist', () => {
    const r = isCommandAllowed('ls -la', GOV);
    assert.strictEqual(r.allowed, true);
    assert.strictEqual(r.requiresConfirmation, false);
  });

  it('allows command with arguments', () => {
    const r = isCommandAllowed('git status', GOV);
    assert.strictEqual(r.allowed, true);
  });

  it('denies command in denylist', () => {
    const r = isCommandAllowed('rm -rf /', GOV);
    assert.strictEqual(r.allowed, false);
    assert.match(r.reason, /explicitly denied/);
  });

  it('denies command not in allowlist', () => {
    const r = isCommandAllowed('echo hello', GOV);
    assert.strictEqual(r.allowed, false);
    assert.match(r.reason, /not in the allowlist/);
  });

  it('denylist wins over allowlist', () => {
    // If a command were somehow in both, deny should win
    const gov = {
      commands: { allowlist: ['rm'], denylist: ['rm'], requireConfirmation: [] }
    };
    const r = isCommandAllowed('rm file.txt', gov);
    assert.strictEqual(r.allowed, false);
  });

  it('flags requireConfirmation for matching command', () => {
    const r = isCommandAllowed('mv file.txt dest/', GOV);
    assert.strictEqual(r.allowed, true);
    assert.strictEqual(r.requiresConfirmation, true);
  });

  it('does not flag requireConfirmation for non-matching command', () => {
    const r = isCommandAllowed('ls', GOV);
    assert.strictEqual(r.requiresConfirmation, false);
  });

  it('trims whitespace from command', () => {
    const r = isCommandAllowed('  ls  -la  ', GOV);
    assert.strictEqual(r.allowed, true);
  });
});

describe('isPathAllowed', () => {
  it('allows path in allowed list', () => {
    const r = isPathAllowed('/home/testuser/Documents/report.pdf', GOV);
    assert.strictEqual(r.allowed, true);
  });

  it('allows subdirectory of allowed path', () => {
    const r = isPathAllowed('/home/testuser/Projects/multis/src/index.js', GOV);
    assert.strictEqual(r.allowed, true);
  });

  it('denies path in denied list', () => {
    const r = isPathAllowed('/etc/passwd', GOV);
    assert.strictEqual(r.allowed, false);
    assert.match(r.reason, /denied directory/);
  });

  it('denies subdirectory of denied path', () => {
    const r = isPathAllowed('/var/log/syslog', GOV);
    assert.strictEqual(r.allowed, false);
  });

  it('denied paths take priority over allowed paths', () => {
    const gov = {
      paths: {
        allowed: ['/usr/local/share'],
        denied: ['/usr']
      }
    };
    const r = isPathAllowed('/usr/local/share/doc.txt', gov);
    assert.strictEqual(r.allowed, false);
  });

  it('denies path not in any list', () => {
    const r = isPathAllowed('/opt/random/file.txt', GOV);
    assert.strictEqual(r.allowed, false);
    assert.match(r.reason, /not in an allowed directory/);
  });
});
