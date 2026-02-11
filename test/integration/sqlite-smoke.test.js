const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { DocumentStore } = require('../../src/indexer/store');
const { DocumentIndexer } = require('../../src/indexer/index');
const { DocChunk } = require('../../src/indexer/chunk');

/**
 * SQLite smoke tests — real DB, real FTS5, real scope filtering.
 * Catches schema drift between migrations and queries.
 */

describe('SQLite smoke: store layer', () => {
  let store, dbPath, tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multis-sqlite-'));
    dbPath = path.join(tmpDir, 'test.db');
    store = new DocumentStore(dbPath);
  });

  after(() => {
    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('saves and retrieves a chunk', () => {
    const chunk = new DocChunk({
      filePath: '/tmp/test.txt',
      name: 'intro',
      content: 'Widgets are mechanical devices used in factories',
      sectionPath: ['Manual', 'Introduction'],
      documentType: 'txt',
      scope: 'kb'
    });
    store.saveChunk(chunk);

    const retrieved = store.getChunk(chunk.chunkId);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.content, chunk.content);
    assert.deepStrictEqual(retrieved.sectionPath, ['Manual', 'Introduction']);
  });

  it('FTS5 search finds matching chunks', () => {
    const results = store.search('widgets factory', 5);
    assert.ok(results.length > 0);
    assert.match(results[0].content, /Widgets/i);
  });

  it('scope filtering excludes out-of-scope chunks', () => {
    // Add an admin-scoped chunk
    const adminChunk = new DocChunk({
      filePath: '/tmp/admin.txt',
      name: 'secrets',
      content: 'Widgets secret internal pricing formula',
      sectionPath: ['Admin', 'Pricing'],
      documentType: 'txt',
      scope: 'admin'
    });
    store.saveChunk(adminChunk);

    // Non-admin search should only find kb chunks
    const kbResults = store.search('widgets', 10, { scopes: ['kb'] });
    assert.ok(kbResults.length > 0);
    for (const r of kbResults) {
      assert.strictEqual(r.scope, 'kb', `expected kb scope, got ${r.scope}`);
    }

    // Admin search (no scope filter) finds both
    const allResults = store.search('widgets', 10);
    const scopes = new Set(allResults.map(r => r.scope));
    assert.ok(scopes.has('kb'));
    assert.ok(scopes.has('admin'));
  });

  it('user-scoped chunks are isolated between users', () => {
    const chunkA = new DocChunk({
      filePath: '/tmp/userA.txt',
      name: 'noteA',
      content: 'Customer Alice prefers blue widgets',
      sectionPath: ['Notes'],
      documentType: 'txt',
      scope: 'user:alice_chat'
    });
    const chunkB = new DocChunk({
      filePath: '/tmp/userB.txt',
      name: 'noteB',
      content: 'Customer Bob prefers red widgets',
      sectionPath: ['Notes'],
      documentType: 'txt',
      scope: 'user:bob_chat'
    });
    store.saveChunks([chunkA, chunkB]);

    // Alice's search shouldn't see Bob's data
    const aliceResults = store.search('widgets', 10, { scopes: ['kb', 'user:alice_chat'] });
    for (const r of aliceResults) {
      assert.ok(r.scope === 'kb' || r.scope === 'user:alice_chat',
        `Alice should not see scope ${r.scope}`);
    }

    // Bob's search shouldn't see Alice's data
    const bobResults = store.search('widgets', 10, { scopes: ['kb', 'user:bob_chat'] });
    for (const r of bobResults) {
      assert.ok(r.scope === 'kb' || r.scope === 'user:bob_chat',
        `Bob should not see scope ${r.scope}`);
    }
  });

  it('ACT-R activation updates on access', () => {
    const results = store.search('widgets', 1, { scopes: ['kb'] });
    assert.ok(results.length > 0);
    const chunkId = results[0].chunkId;

    // Before access
    const before = store.computeActivation(chunkId);

    // Record access
    store.recordAccess(chunkId, 'widgets');

    // After access — activation should increase
    const afterAccess = store.computeActivation(chunkId);
    assert.ok(afterAccess > before, `activation should increase: ${before} -> ${afterAccess}`);
  });

  it('getStats reflects stored chunks', () => {
    const stats = store.getStats();
    assert.ok(stats.totalChunks >= 3);
    assert.ok(stats.byType.txt >= 3);
  });

  it('deleteByFile removes chunks and FTS entries', () => {
    const chunk = new DocChunk({
      filePath: '/tmp/deleteme.txt',
      name: 'ephemeral',
      content: 'Ephemeral zygomorphic content for deletion test',
      sectionPath: ['Temp'],
      documentType: 'txt',
      scope: 'kb'
    });
    store.saveChunk(chunk);

    // Verify it's searchable
    let results = store.search('zygomorphic', 5);
    assert.ok(results.length > 0);

    // Delete
    store.deleteByFile('/tmp/deleteme.txt');

    // Verify it's gone from search
    results = store.search('zygomorphic', 5);
    assert.strictEqual(results.length, 0);
  });
});

describe('SQLite smoke: indexer with real files', () => {
  let indexer, tmpDir, dbPath;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multis-idx-'));
    dbPath = path.join(tmpDir, 'test.db');
    const store = new DocumentStore(dbPath);
    indexer = new DocumentIndexer(store);

    // Create test files
    fs.writeFileSync(path.join(tmpDir, 'guide.md'), [
      '# Widget Installation Guide',
      '',
      '## Prerequisites',
      '',
      'You need Node.js 20 or higher to run the widget installer.',
      '',
      '## Step 1: Download',
      '',
      'Download the latest widget package from the repository.',
      'The package includes all necessary dependencies.',
      '',
      '## Step 2: Configure',
      '',
      'Edit config.json to set your widget preferences.',
      'Available options: color, size, material.',
    ].join('\n'));

    fs.writeFileSync(path.join(tmpDir, 'faq.txt'), [
      'Frequently Asked Questions about Widgets',
      '',
      'Q: How do I reset my widget?',
      'A: Press the red button on the back for 5 seconds.',
      '',
      'Q: What warranty does the widget have?',
      'A: All widgets come with a 2-year manufacturer warranty.',
      '',
      'Q: Can I use widgets outdoors?',
      'A: Yes, widgets are rated IP67 for outdoor use.',
    ].join('\n'));
  });

  after(() => {
    indexer.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('indexes a markdown file with correct chunk count', async () => {
    const count = await indexer.indexFile(path.join(tmpDir, 'guide.md'), 'kb');
    assert.ok(count > 0, `expected chunks, got ${count}`);

    const stats = indexer.getStats();
    assert.ok(stats.totalChunks > 0);
  });

  it('indexes a text file as admin scope', async () => {
    const count = await indexer.indexFile(path.join(tmpDir, 'faq.txt'), 'admin');
    assert.ok(count > 0);
  });

  it('search returns relevant chunks from indexed files', () => {
    const results = indexer.search('reset widget', 5);
    assert.ok(results.length > 0);
    // Should find the FAQ answer about resetting
    const texts = results.map(r => r.content).join(' ');
    assert.match(texts, /red button|reset/i);
  });

  it('scoped search excludes admin content from kb-only query', () => {
    const results = indexer.search('warranty', 5, { scopes: ['kb'] });
    // FAQ was indexed as admin, so kb-only search should not find warranty info
    for (const r of results) {
      assert.strictEqual(r.scope, 'kb', `expected kb scope, got ${r.scope}`);
    }
  });

  it('re-indexing replaces old chunks', async () => {
    const countBefore = indexer.getStats().totalChunks;

    // Re-index the same file
    await indexer.indexFile(path.join(tmpDir, 'guide.md'), 'kb');
    const countAfter = indexer.getStats().totalChunks;

    // Should not double — old chunks deleted first
    assert.strictEqual(countAfter, countBefore);
  });

  it('indexBuffer works for uploaded files', async () => {
    const content = 'Special uploaded document about quantum widgets and photon alignment.';
    const buffer = Buffer.from(content);
    const count = await indexer.indexBuffer(buffer, 'upload.txt', 'kb');
    assert.ok(count > 0);

    const results = indexer.search('quantum photon', 5);
    assert.ok(results.length > 0);
    assert.match(results[0].content, /quantum/i);
  });
});
