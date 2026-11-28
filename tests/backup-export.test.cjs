const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { TextEncoder } = require('node:util');

const html = fs.readFileSync('producer.html', 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1]).filter(source => source.trim());
const exporter = scripts.at(-1);
assert.ok(exporter.includes("downloadFullBackup"), 'Full-backup exporter script must be present');

function makeIndexedDB({ rows = [], mode = 'populated' } = {}) {
  const db = {
    objectStoreNames: { contains: name => mode !== 'absent' && name === 'images' },
    close() { this.closed = true; },
    transaction() {
      const tx = {
        objectStore() {
          return {
            getAll() {
              const request = {};
              queueMicrotask(() => {
                request.result = rows;
                request.onsuccess?.();
                queueMicrotask(() => tx.oncomplete?.());
              });
              return request;
            }
          };
        },
        abort() { queueMicrotask(() => tx.onabort?.()); }
      };
      return tx;
    }
  };

  return {
    open() {
      const request = { result: db, transaction: { abort() {
        queueMicrotask(() => request.onerror?.());
      } } };
      queueMicrotask(() => {
        if (mode === 'absent') request.onupgradeneeded?.();
        else request.onsuccess?.();
      });
      return request;
    }
  };
}

async function runExport({ profile, episodes, rows = [], dbMode = 'populated' } = {}) {
  let handler;
  let downloadedBlob = null;
  const status = { textContent: '' };
  const button = {
    disabled: false,
    textContent: 'دانلود پشتیبان کامل پروژه',
    addEventListener(type, callback) {
      assert.equal(type, 'click');
      handler = callback;
    }
  };
  const store = new Map();
  if (profile !== undefined) store.set('lunaCharacterProfile', JSON.stringify(profile));
  if (episodes !== undefined) store.set('lunaEpisodes', JSON.stringify(episodes));
  store.set('lunaAiEndpoint', 'https://private-worker.example');
  store.set('lunaDiagnostics', JSON.stringify([{ secretDiagnostic: 'must-not-export' }]));

  const indexedDB = makeIndexedDB({ rows, mode: dbMode });
  const document = {
    getElementById(id) {
      if (id === 'downloadFullBackup') return button;
      if (id === 'characterStatus') return status;
      return null;
    },
    querySelector() { return { content: 'test-build' }; },
    createElement() {
      return {
        style: {},
        click() {},
        remove() {}
      };
    },
    body: { appendChild() {} }
  };
  const URL = {
    createObjectURL(blob) { downloadedBlob = blob; return 'blob:test'; },
    revokeObjectURL() {}
  };
  const context = {
    document,
    window: { crypto: webcrypto, TextEncoder, indexedDB, confirm: () => true },
    indexedDB,
    crypto: webcrypto,
    TextEncoder,
    localStorage: { getItem: key => store.has(key) ? store.get(key) : null },
    sessionStorage: { getItem: () => 'DO-NOT-EXPORT-SESSION-TOKEN' },
    URL,
    Blob,
    location: { origin: 'https://madahisaeid200-glitch.github.io' },
    Date,
    JSON,
    Object,
    Array,
    Promise,
    Error,
    Uint8Array,
    setTimeout: callback => { callback(); return 1; },
    console
  };
  vm.runInNewContext(exporter, context, { timeout: 3000 });
  assert.equal(typeof handler, 'function', 'Backup button must have a click handler');
  await handler();
  const json = downloadedBlob ? await downloadedBlob.text() : null;
  return { backup: json ? JSON.parse(json) : null, raw: json, status: status.textContent, downloaded: !!downloadedBlob };
}

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

(async () => {
  const profile = {
    lunaName: 'LUNA', lunaLook: 'Natural brunette', lunaPersonality: 'Warm',
    leoName: 'LEO', leoLook: 'Dark hair', leoPersonality: 'Charming', style: 'Photorealistic'
  };
  const episodes = [{
    id: 7, en: 'Hotel Mix-up', fa: 'سوءتفاهم هتل',
    storyEn: ['LUNA: Hello', 'LEO: Surprise'], storyFa: ['لونا: سلام', 'لئو: سورپرایز']
  }];
  const rows = [{
    id: 12, dataUrl: 'data:image/png;base64,aGVsbG8=',
    meta: { shot: 1, prompt: 'hotel entrance' }, createdAt: '2026-11-28T08:00:00.000Z'
  }];

  const populated = await runExport({ profile, episodes, rows });
  assert.equal(populated.downloaded, true, populated.status);
  assert.equal(populated.backup.format, 'luna-browser-backup');
  assert.equal(populated.backup.schemaVersion, 1);
  assert.equal(populated.backup.counts.episodes, 1);
  assert.equal(populated.backup.counts.images, 1);
  assert.equal(populated.backup.data.characterProfile.lunaName, 'LUNA');
  assert.equal(populated.backup.data.episodes[0].id, 7);
  assert.equal(populated.backup.data.images[0].sourceId, 12);
  assert.equal(populated.backup.data.images[0].dataUrl, rows[0].dataUrl);
  const expectedDigest = Buffer.from(await webcrypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(canonical(populated.backup.data))
  )).toString('hex');
  assert.equal(populated.backup.integrity.payloadDigest, expectedDigest,
    'Downloaded payload digest must independently recompute');
  for (const forbidden of ['DO-NOT-EXPORT-SESSION-TOKEN', 'private-worker.example', 'must-not-export']) {
    assert.equal(populated.raw.includes(forbidden), false, 'Backup must exclude: ' + forbidden);
  }

  const empty = await runExport({ dbMode: 'absent' });
  assert.equal(empty.downloaded, true, empty.status);
  assert.equal(empty.backup.source.episodes, 'bundled-seed');
  assert.equal(empty.backup.counts.episodes, 3);
  assert.equal(empty.backup.counts.images, 0);
  assert.equal(empty.backup.data.characterProfile, null);

  const malformedEpisodes = await runExport({
    episodes: [{ ...episodes[0], unexpectedSecret: 'reject-me' }],
    dbMode: 'absent'
  });
  assert.equal(malformedEpisodes.downloaded, false);
  assert.match(malformedEpisodes.status, /فیلد ناشناخته/);

  const malformedImages = await runExport({
    profile, episodes, rows: [{ dataUrl: 'not-an-image', meta: {}, createdAt: 'now' }]
  });
  assert.equal(malformedImages.downloaded, false);
  assert.match(malformedImages.status, /نامعتبر/);

  console.log('BACKUP_EXPORT: PASS (populated data, empty project, seed fallback)');
  console.log('BACKUP_INTEGRITY: PASS (independent SHA-256 recomputation)');
  console.log('BACKUP_PRIVACY: PASS (session token, Worker endpoint, diagnostics excluded)');
  console.log('BACKUP_FAIL_CLOSED: PASS (unknown episode field and malformed image rejected)');
})().catch(error => {
  console.error('BACKUP_EXPORT_TEST_FAILED:', error);
  process.exitCode = 1;
});
