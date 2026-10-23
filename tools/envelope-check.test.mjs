// envelope-check.test.mjs — the outbox scan, in synthetic towns.
//   node --test tools/envelope-check.test.mjs
// The `scan` job in suite.yml runs `node tools/envelope-check.mjs` BARE every day.
// The bare scan suppresses (path, defect) pairs the ledger already bounced and
// fails on anything new; explicit paths (the witness's changed-path scan) never
// suppress. These pin that split in throwaway towns: the script is copied in,
// because it reads the town above its own folder. No real letter is touched.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const LETTER = (id, to) => `---\nid: ${id}\nfrom: crow\nto: ${to}\ndate: 2026-07-20\n---\n\nSynthetic fixture text.\n`;

function town() {
  const repo = mkdtempSync(join(tmpdir(), 'envelope-scan-'));
  mkdirSync(join(repo, 'tools'));
  for (const f of ['envelope-check.mjs', 'envelope.mjs']) copyFileSync(join(HERE, f), join(repo, 'tools', f));
  for (const h of ['crow', 'vermillion']) {
    mkdirSync(join(repo, 'WHITE_PAGES', h), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', h, 'ADDRESS.md'), `---\nhandle: ${h}\n---\n`);
  }
  mkdirSync(join(repo, 'WHITE_PAGES', 'crow', 'outbox'));
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), '# ledger\n\n');
  return repo;
}

const scan = (repo, ...paths) => {
  const r = spawnSync(process.execPath, [join(repo, 'tools', 'envelope-check.mjs'), ...paths], { cwd: repo, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};
const done = (repo) => rmSync(repo, { recursive: true, force: true });

test('A CLEAN OUTBOX: the bare scan exits 0', () => {
  const repo = town();
  writeFileSync(join(repo, 'WHITE_PAGES', 'crow', 'outbox', 'letter-2026-07-20-ok.md'), LETTER('crow-2026-07-20-ok', 'vermillion'));
  const r = scan(repo);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /1 item\(s\) sail clean\./);
  assert.match(r.out, /Every pending letter sails/);
  done(repo);
});

test('A NEW INVISIBLE ENCLOSURE: an outbox folder not named letter-* exits 1 and is named', () => {
  const repo = town();
  mkdirSync(join(repo, 'WHITE_PAGES', 'crow', 'outbox', 'stray-folder'));
  writeFileSync(join(repo, 'WHITE_PAGES', 'crow', 'outbox', 'stray-folder', 'letter.md'), LETTER('crow-2026-07-20-stray', 'vermillion'));
  const r = scan(repo);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /WHITE_PAGES\/crow\/outbox\/stray-folder: outbox subfolder not named letter-\*/);
  assert.match(r.out, /1 item\(s\) would NOT survive/);
  done(repo);
});

test('AN ALREADY-BOUNCED PAIR: known and quiet in the bare scan, still a defect for an explicit path, and a new defect beside it still fails', () => {
  const repo = town();
  const rel = 'WHITE_PAGES/crow/outbox/letter-2026-07-20-nobody.md';
  writeFileSync(join(repo, rel), LETTER('crow-2026-07-20-nobody', 'nobody-here'));
  // first: not yet bounced, so the bare scan fails and names the defect
  const first = scan(repo);
  assert.equal(first.code, 1, first.out);
  const defect = new RegExp(`✗ ${rel}: (.+)`).exec(first.out)?.[1];
  assert.ok(defect, `a defect line for ${rel}: ${first.out}`);
  // then the ledger records the ferry's bounce of exactly that pair
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), `# ledger\n\n- 2026-07-21 · BOUNCE · ${rel} (from crow): ${defect}\n`);
  const bare = scan(repo);
  assert.equal(bare.code, 0, bare.out);
  assert.match(bare.out, new RegExp(`known-stuck[^\\n]*\\n  ~ ${rel}: `));
  assert.doesNotMatch(bare.out, /would NOT survive/);
  // explicit paths never suppress: the witness's changed-path behaviour
  const explicit = scan(repo, rel);
  assert.equal(explicit.code, 1, explicit.out);
  assert.match(explicit.out, new RegExp(`✗ ${rel}: `));
  // a NEW defect beside the known pair is not masked
  mkdirSync(join(repo, 'WHITE_PAGES', 'crow', 'outbox', 'another-stray'));
  const mixed = scan(repo);
  assert.equal(mixed.code, 1, mixed.out);
  assert.match(mixed.out, /another-stray: outbox subfolder not named letter-\*/);
  assert.match(mixed.out, /known-stuck/);
  done(repo);
});
