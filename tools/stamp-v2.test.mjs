// stamp-v2.test.mjs — stamps-v2 law: spans, registry revisions, stakes.
//   node --test tools/stamp-v2.test.mjs
// Gold plan: postmark-ballot. Zero-dep; throwaway repos + ed25519 keys.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseStampLedger, foldBalances, appendSigned,
  stakeLine, returnLine, voteMintLine,
} from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function town({ ledgerLines, pins = {}, addresses = {} }) {
  const repo = mkdtempSync(join(tmpdir(), 'stamp-town-v2-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify(pins));
  for (const [handle, github] of Object.entries(addresses)) {
    mkdirSync(join(repo, 'WHITE_PAGES', handle), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', handle, 'ADDRESS.md'),
      `---\nhandle: ${handle}\n${github ? `github: ${github}\n` : ''}---\n`);
  }
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), `# ledger\n\n${ledgerLines.join('\n')}\n`);
  return repo;
}

const D = (date, id, from, to) => `- ${date} · ${id} · ${from} → ${to} · thread: new`;

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    pub: publicKey.export({ type: 'spki', format: 'pem' }),
    priv: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

function mintPass(repo, privPem) {
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, privPem);
  execFileSync(process.execPath, [join(HERE, 'stamp-mint.mjs'), '--append', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
}

function declareV2(repo, privPem, date, meeps) {
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, privPem);
  execFileSync(process.execPath, [join(HERE, 'stamp-mint.mjs'), '--declare-rules', 'stamps-v2',
    '--meeps', meeps.join(','), '--date', date, '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
}

function declareRegistry(repo, privPem, date, handle, key) {
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, privPem);
  execFileSync(process.execPath, [join(HERE, 'stamp-mint.mjs'), '--declare-registry', `${handle} = ${key}`,
    '--date', date, '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
}

function ballot(repo, topic, candidates, cap = 20) {
  writeFileSync(join(repo, 'WHITE_PAGES', `ballot-${topic}.json`),
    JSON.stringify({ topic, status: 'staking', cap_per_household_per_candidate: cap, candidates }));
}

const balancesOf = (repo) =>
  foldBalances(parseStampLedger(readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8')));

test('v2: meeps mint nothing after the marker; other side unaffected; v1 history intact', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'meepy')] });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  declareV2(repo, priv, '2026-06-20', ['meepy']);
  const ml = join(repo, 'WHITE_PAGES', 'mail-ledger.md');
  writeFileSync(ml, readFileSync(ml, 'utf8') + `${D('2026-06-21', 'a-2', 'alice', 'meepy')}\n${D('2026-06-21', 'm-1', 'meepy', 'bob')}\n`);
  mintPass(repo, priv);
  const r = verifyStampLedger(repo);
  assert.equal(r.ok, true, r.problems.join('; '));
  const bal = balancesOf(repo);
  assert.equal(bal.get('meepy'), 1, 'meepy keeps the v1 mint, gains nothing under v2');
  assert.equal(bal.get('alice'), 2, 'alice mints on both spans');
  assert.equal(bal.get('bob'), 1, 'receiving FROM a meep still mints');
  rmSync(repo, { recursive: true, force: true });
});

test('v2: registry revision applies forward only (the tulip case)', () => {
  const { pub, priv } = keypair();
  const lines = [];
  for (let i = 1; i <= 5; i++) lines.push(D('2026-06-12', `d-${i}`, 'dregg', `friend-${i}`));
  lines.push(D('2026-06-12', 't-1', 'tulip', 'friend-6'));
  const repo = town({
    ledgerLines: lines,
    pins: { dregg: { login: 'ember', id: 1 } },
    addresses: { tulip: 'ghost-login' },
  });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  const before = verifyStampLedger(repo);
  assert.equal(before.ok, true, before.problems.join('; '));
  assert.equal(balancesOf(repo).get('tulip'), 1, 'split household let tulip mint past the shared cap');

  declareRegistry(repo, priv, '2026-06-20', 'tulip', 'gh:1');
  assert.equal(verifyStampLedger(repo).ok, true, 'forward-dated pin keeps the replay green');

  const ml = join(repo, 'WHITE_PAGES', 'mail-ledger.md');
  const day2 = [];
  for (let i = 1; i <= 5; i++) day2.push(D('2026-06-21', `d2-${i}`, 'dregg', `pal-${i}`));
  day2.push(D('2026-06-21', 't2-1', 'tulip', 'pal-6'));
  writeFileSync(ml, readFileSync(ml, 'utf8') + day2.join('\n') + '\n');
  mintPass(repo, priv);
  const r = verifyStampLedger(repo);
  assert.equal(r.ok, true, r.problems.join('; '));
  assert.equal(balancesOf(repo).get('tulip'), 1, 'day 2: tulip clipped by the now-shared household cap');
  rmSync(repo, { recursive: true, force: true });
});

test('v2: retroactive declaration refused (date not after last delivery)', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob')] });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  assert.throws(() => declareV2(repo, priv, '2026-06-12', ['bob']));
  rmSync(repo, { recursive: true, force: true });
});

test('v2: stakes fold, refund at close, vote-mint once; overdraft breaks LAWFUL', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [
    D('2026-06-12', 'a-1', 'alice', 'bob'),
    D('2026-06-13', 'a-2', 'alice', 'carol'),
  ] });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv); // alice: 2, bob: 1, carol: 1
  ballot(repo, 'name-vote', ['lumen', 'brightwork'], 20);

  appendSigned(repo, [
    stakeLine({ date: '2026-06-14', handle: 'alice', topic: 'name-vote', candidate: 'lumen', n: 2, via: 'api' }),
    voteMintLine({ date: '2026-06-14', handle: 'alice', topic: 'name-vote' }),
  ], priv);
  let r = verifyStampLedger(repo);
  assert.equal(r.ok, true, r.problems.join('; '));

  appendSigned(repo, [
    returnLine({ date: '2026-06-15', topic: 'name-vote', candidate: 'lumen', handle: 'alice', n: 2 }),
  ], priv);
  r = verifyStampLedger(repo);
  assert.equal(r.ok, true, r.problems.join('; '));
  const bal = balancesOf(repo);
  assert.equal(bal.get('alice'), 3, 'stake refunded + vote-mint');
  assert.equal(bal.get('stake:name-vote/lumen') ?? 0, 0, 'escrow zeroed at close');

  appendSigned(repo, [
    stakeLine({ date: '2026-06-16', handle: 'bob', topic: 'name-vote', candidate: 'lumen', n: 5, via: 'api' }),
  ], priv);
  r = verifyStampLedger(repo);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((x) => x.includes('overdrawn')), r.problems.join('; '));
  rmSync(repo, { recursive: true, force: true });
});

test('v2: household cap on stakes enforced across handles', () => {
  const { pub, priv } = keypair();
  const lines = [];
  for (let i = 1; i <= 5; i++) lines.push(D('2026-06-12', `w-${i}`, 'wright', `f-${i}`));
  for (let i = 1; i <= 5; i++) lines.push(D('2026-06-13', `r-${i}`, 'rei', `f-${i}`));
  for (let i = 1; i <= 5; i++) lines.push(D('2026-06-14', `w2-${i}`, 'wright', `g-${i}`));
  for (let i = 1; i <= 5; i++) lines.push(D('2026-06-15', `r2-${i}`, 'rei', `g-${i}`));
  const repo = town({
    ledgerLines: lines,
    pins: { wright: { login: 'k', id: 7 }, rei: { login: 'k', id: 7 } },
  });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv); // household cap: wright 10, rei 10 minted
  ballot(repo, 'name-vote', ['lumen'], 12);

  appendSigned(repo, [
    stakeLine({ date: '2026-06-21', handle: 'wright', topic: 'name-vote', candidate: 'lumen', n: 10, via: 'api' }),
    stakeLine({ date: '2026-06-21', handle: 'rei', topic: 'name-vote', candidate: 'lumen', n: 2, via: 'mail:rei-ballot' }),
  ], priv);
  let r = verifyStampLedger(repo);
  assert.equal(r.ok, true, r.problems.join('; '));

  appendSigned(repo, [
    stakeLine({ date: '2026-06-22', handle: 'rei', topic: 'name-vote', candidate: 'lumen', n: 1, via: 'api' }),
  ], priv);
  r = verifyStampLedger(repo);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((x) => x.includes('cap is 12')), r.problems.join('; '));
  rmSync(repo, { recursive: true, force: true });
});

test('v2: meeps cannot stake; vote-mint needs a stake; unknown candidate refused', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [D('2026-06-12', 'm-1', 'someone', 'meepy')] });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  declareV2(repo, priv, '2026-06-20', ['meepy']);
  ballot(repo, 'name-vote', ['lumen'], 12);
  appendSigned(repo, [
    stakeLine({ date: '2026-06-21', handle: 'meepy', topic: 'name-vote', candidate: 'lumen', n: 1, via: 'api' }),
  ], priv);
  let r = verifyStampLedger(repo);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((x) => x.includes('cannot stake')), r.problems.join('; '));
  rmSync(repo, { recursive: true, force: true });

  const repo2 = town({ ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob')] });
  writeFileSync(join(repo2, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo2, priv);
  ballot(repo2, 'name-vote', ['lumen'], 20);
  appendSigned(repo2, [
    voteMintLine({ date: '2026-06-14', handle: 'alice', topic: 'name-vote' }),
  ], priv);
  r = verifyStampLedger(repo2);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((x) => x.includes('no stake behind it')), r.problems.join('; '));
  rmSync(repo2, { recursive: true, force: true });

  const repo3 = town({ ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob')] });
  writeFileSync(join(repo3, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo3, priv);
  ballot(repo3, 'name-vote', ['lumen'], 20);
  appendSigned(repo3, [
    stakeLine({ date: '2026-06-14', handle: 'alice', topic: 'name-vote', candidate: 'nobody', n: 1, via: 'api' }),
  ], priv);
  r = verifyStampLedger(repo3);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((x) => x.includes('not a candidate')), r.problems.join('; '));
  rmSync(repo3, { recursive: true, force: true });
});

test('v2: a forged stake line fails signatures from a fresh clone', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob')] });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  ballot(repo, 'name-vote', ['lumen'], 20);
  const p = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  writeFileSync(p, readFileSync(p, 'utf8') +
    '- 2026-06-14 · alice → stake:name-vote/lumen · 1 · via: api · sig: AAAA\n');
  const r = verifyStampLedger(repo);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((x) => x.includes('SIGNATURE FAILS')), r.problems.join('; '));
  rmSync(repo, { recursive: true, force: true });
});
