// epoch-close.test.mjs — falsifiers for the funding seam (keeping pots, S1/S2).
//   node --test tools/epoch-close.test.mjs
// Zero-dep; throwaway towns + ed25519 keys (the ballot.test.mjs pattern).
//
// Every test here is a falsifier: each asserts a refusal, a red verify, or an
// exact number that the ruled law (Keemin, 2026-08-20) forces — and the forged/
// tampered cases are the standing proof the checks CAN fail. The law's one home
// is deriveEpochClose (stamp-mint.mjs); the verifier replays it; this file
// tries to break both.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseStampLedger, classifyEntry, appendSigned, foldBalances, foldStaked,
  foldMintCount, foldHolo, foldPotPositions, deriveEpochClose, keepingDial,
  potFile, householdKeys, keepingLine, giftLine,
  potStakeLine, potReceiptLine, holoMintLine, patronDeedLine, keeperEquityLine,
} from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const D = (date, id, from, to) => `- ${date} · ${id} · ${from} → ${to} · thread: new`;

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    pub: publicKey.export({ type: 'spki', format: 'pem' }),
    priv: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

// A town with a founded, fully-appended stamp ledger, a keeping dial, and pot
// files. Stakers are funded by founder gifts (assertion lines, like the live
// ledger's) — a gift is also the mint-count basis the ρ-cap reads.
function seamTown({ pub, priv, pins, pots = {}, gifts = [], dial } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'seam-town-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify(pins ?? {}));
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), `# ledger\n\n${[
    D('2026-06-12', 'm-1', 'stan', 'paz'),
    D('2026-06-12', 'm-2', 'keeper', 'dot'),
  ].join('\n')}\n`);
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  writeFileSync(join(repo, 'ECONOMY-DIALS.json'), JSON.stringify({
    law_side: {
      town_issuance: { treasury_handle: 'the-town', once_purposes: [] },
      keeping: { sigma: 0.5, rho: 0.25, rho_constitutional_ceiling: 0.5, ...(dial ?? {}) },
    },
  }));
  for (const [id, meta] of Object.entries(pots)) {
    writeFileSync(join(repo, 'WHITE_PAGES', `pot-${id}.json`), JSON.stringify({ pot: id, status: 'open', ...meta }));
  }
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, priv);
  execFileSync(process.execPath, [join(HERE, 'stamp-mint.mjs'), '--append', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
  if (gifts.length) {
    appendSigned(repo, gifts.map((g) => giftLine({ date: '2026-07-01', handle: g.handle, n: g.n, slug: 'seed', by: 'keemin' })), priv);
  }
  return repo;
}

const entriesOf = (repo) =>
  parseStampLedger(readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8'));

const closeArgs = ({ repo, pot, epoch, date, key = true }) => {
  const a = [join(HERE, 'epoch-close.mjs'), '--close', '--pot', pot, '--epoch', epoch, '--date', date, '--repo', repo];
  if (key) a.push('--key', join(repo, 'stamp-key.pem'));
  return a;
};

// derive + append a close directly (the tool's core path without the CLI)
function closeDirect(repo, priv, { pot, epoch, date }) {
  const entries = entriesOf(repo);
  const derived = deriveEpochClose({
    entries, households: householdKeys(repo), pot, potMeta: potFile(repo, pot),
    epoch, date, dial: keepingDial(repo),
  });
  assert.equal(derived.ok, true, derived.error);
  appendSigned(repo, derived.rows.map(keepingLine), priv);
  return derived;
}

const PINS = {
  stan: { login: 's', id: 1 }, paz: { login: 'p', id: 2 }, keeper: { login: 'k', id: 9 },
  kbro: { login: 'k', id: 9 }, dot: { login: 'd', id: 5 }, vic: { login: 'v', id: 6 },
};

test('the full cycle verifies green across all five row kinds — and the tallies stay honest', () => {
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper' } },
    gifts: [{ handle: 'stan', n: 300 }, { handle: 'paz', n: 600 }],
  });
  const keyFile = join(repo, 'stamp-key.pem');
  appendSigned(repo, [potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 300, via: 'api' })], priv);

  // the receipt goes through the door, so mint-at-entry is exercised end-to-end
  execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--receipt', '--pot', 'ec2',
    '--rail', 'stripe', '--usd', '300', '--from', 'paz', '--ref', 'stripe:pi_1', '--date', '2026-07-03',
    '--key', keyFile, '--repo', repo], { encoding: 'utf8' });

  // stakes are escrow while open: liquid dips, staked holds them, mint_count is
  // unmoved (stan holds 301 = 300 gift + 1 correspondence mint, stakes 300)
  let entries = entriesOf(repo);
  assert.equal(foldBalances(entries).get('stan') ?? 0, 1);
  assert.equal(foldStaked(entries).get('stan') ?? 0, 300);

  const out = execFileSync(process.execPath, closeArgs({ repo, pot: 'ec2', epoch: '2026-07', date: '2026-08-01' }), { encoding: 'utf8' });
  assert.match(out, /burned \(matched\):\s+300/);
  assert.match(out, /keeper-equity:\s+150/);
  assert.match(out, /holo to payers:\s+150/);

  const v = verifyStampLedger(repo);
  assert.equal(v.ok, true, (v.problems ?? []).join('\n'));

  entries = entriesOf(repo);
  const kinds = entries.map((e) => classifyEntry(e.canonical).kind);
  for (const k of ['pot-stake', 'pot-receipt', 'keeping-burn', 'keeper-equity', 'holo', 'patron-deed'])
    assert.ok(kinds.includes(k), `ledger carries a ${k} row`);

  // the burn is a real spend: stan's stamps are gone from every tense but his mint_count
  assert.equal(foldStaked(entries).get('stan') ?? 0, 0);
  assert.equal(foldBalances(entries).get('stan') ?? 0, 1);
  assert.equal(foldMintCount(entries).get('stan'), 301);
  // the keeper's σ share is a fresh primary mint: liquid AND mint_count
  assert.equal(foldBalances(entries).get('keeper') ?? 0, 150 + 1); // +1 correspondence mint
  assert.equal(foldMintCount(entries).get('keeper'), 150 + 1);
  // holo is soulbound: visible ONLY to its own reader, absent from every tally
  assert.equal(foldHolo(entries).get('paz'), 150);
  assert.equal(foldBalances(entries).get('paz') ?? 0, 600 + 1); // gift + mint — holo added nothing
  assert.equal(foldMintCount(entries).get('paz'), 600 + 1);

  const held = execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--holo-held', '--repo', repo], { encoding: 'utf8' });
  assert.match(held, /150\s+gh:2\s+\(paz:150\)/);
});

test('R1 floors both legs: 300 burned → exactly 150 + 150; 301 → 150 + 150, 1 burns un-minted', () => {
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { even: { beneficiary: 'keeper' }, odd: { beneficiary: 'keeper' } },
    gifts: [{ handle: 'stan', n: 601 }, { handle: 'paz', n: 1200 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'even', n: 300, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'odd', n: 301, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'even', rail: 'usdc', usd: 300, from: 'paz', ref: 'usdc:tx1' }),
    potReceiptLine({ date: '2026-07-03', pot: 'odd', rail: 'usdc', usd: 301, from: 'paz', ref: 'usdc:tx2' }),
  ], priv);

  const even = closeDirect(repo, priv, { pot: 'even', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(even.report.burned, 300);
  assert.equal(even.report.keeperEquity, 150);
  assert.equal(even.report.holoMinted, 150);
  assert.equal(even.report.unmintedRemainder, 0, '300 = 150 + 150, never 600');

  const odd = closeDirect(repo, priv, { pot: 'odd', epoch: '2026-07', date: '2026-08-02' });
  assert.equal(odd.report.burned, 301);
  assert.equal(odd.report.keeperEquity, 150);
  assert.equal(odd.report.holoMinted, 150);
  assert.equal(odd.report.unmintedRemainder, 1, 'the odd stamp burns un-minted — the seam keeps the change');

  const v = verifyStampLedger(repo);
  assert.equal(v.ok, true, (v.problems ?? []).join('\n'));
});

test('a forged holo row fails the chain; an office-signed wrong one fails the keeping replay', () => {
  const { pub, priv } = keypair();
  const intruder = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper' } },
    gifts: [{ handle: 'stan', n: 100 }, { handle: 'paz', n: 400 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 100, from: 'paz', ref: 'stripe:pi_9' }),
  ], priv);

  // (a) an intruder's key: the signature chain goes red
  const forged = mkForkAppend(repo, intruder.priv,
    holoMintLine({ date: '2026-08-01', handle: 'paz', n: 999, pot: 'ec2', epoch: '2026-07', ref: 'stripe:pi_9' }));
  let v = verifyStampLedger(forged);
  assert.equal(v.ok, false, 'a holo row not signed by the office pen must fail');
  assert.match(v.problems.join('\n'), /SIGNATURE FAILS/);

  // (b) the office pen itself writing an unlawful holo row: the keeping replay goes red
  const orphan = mkForkAppend(repo, priv,
    holoMintLine({ date: '2026-08-01', handle: 'paz', n: 999, pot: 'ec2', epoch: '2026-07', ref: 'stripe:pi_9' }));
  v = verifyStampLedger(orphan);
  assert.equal(v.ok, false, 'even the office pen cannot write a holo row the derivation does not produce');
  assert.match(v.problems.join('\n'), /KEEPING REPLAY DIVERGES|derives no lawful block/);

  // (c) a real close with one holo amount nudged: byte-exact replay catches it
  const entries = entriesOf(repo);
  const derived = deriveEpochClose({
    entries, households: householdKeys(repo), pot: 'ec2', potMeta: potFile(repo, 'ec2'),
    epoch: '2026-07', date: '2026-08-01', dial: keepingDial(repo),
  });
  assert.equal(derived.ok, true, derived.error);
  const rows = derived.rows.map((r) => (r.kind === 'holo' ? { ...r, n: r.n + 1 } : r));
  const nudged = mkForkAppend(repo, priv, ...rows.map(keepingLine));
  v = verifyStampLedger(nudged);
  assert.equal(v.ok, false, 'a close block with a wrong holo amount must fail');
  assert.match(v.problems.join('\n'), /KEEPING REPLAY DIVERGES/);
});

// fork a town dir by copying its ledger, then append raw canonicals with a key —
// the tamper bench: each fork is its own repo so red cases never poison a green one
function mkForkAppend(repo, privPem, ...canonicals) {
  const fork = mkdtempSync(join(tmpdir(), 'seam-fork-'));
  mkdirSync(join(fork, 'tools'), { recursive: true });
  mkdirSync(join(fork, 'WHITE_PAGES'), { recursive: true });
  for (const f of ['tools/github-ids.json', 'tools/stamp-pubkey.pem', 'ECONOMY-DIALS.json', 'WHITE_PAGES/mail-ledger.md', 'WHITE_PAGES/stamp-ledger.md']) {
    writeFileSync(join(fork, f), readFileSync(join(repo, f)));
  }
  for (const p of ['ec2', 'even', 'odd', 'lamp']) {
    try { writeFileSync(join(fork, 'WHITE_PAGES', `pot-${p}.json`), readFileSync(join(repo, 'WHITE_PAGES', `pot-${p}.json`))); } catch {}
  }
  appendSigned(fork, canonicals, privPem);
  return fork;
}

test('the founding grant mints zero holo and lands as patron-deed #1 — and a holo-carrying treasury deed fails', () => {
  const { pub, priv } = keypair();
  const repo = seamTown({ pub, priv, pins: PINS });
  const keyFile = join(repo, 'stamp-key.pem');
  execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--deed',
    '--patron', 'founding-family-grant', '--usd', '10000', '--ref', 'grant:founding-family',
    '--epoch', '2026-08', '--date', '2026-08-20', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });

  const v = verifyStampLedger(repo);
  assert.equal(v.ok, true, (v.problems ?? []).join('\n'));
  const entries = entriesOf(repo);
  const deed = entries.map((e) => classifyEntry(e.canonical)).find((c) => c.kind === 'patron-deed');
  assert.equal(deed.patron, 'founding-family-grant');
  assert.equal(deed.usd, 10000);
  assert.equal(deed.holo, 0, 'grant dollars with no household mint ZERO holo but land as a deed');
  assert.equal(foldHolo(entries).size, 0);
  // the dollars moved no stamps at all: conservation untouched, no account changed
  assert.equal(foldBalances(entries).get('founding-family-grant') ?? 0, 0);

  const bad = mkForkAppend(repo, priv,
    potReceiptLine({ date: '2026-08-21', pot: 'treasury', rail: 'grant', usd: 5, from: 'aunt', ref: 'grant:aunt' }),
    patronDeedLine({ date: '2026-08-21', pot: 'treasury', patron: 'aunt', usd: 5, epoch: '2026-08', ref: 'grant:aunt', holo: 5 }));
  const vb = verifyStampLedger(bad);
  assert.equal(vb.ok, false);
  assert.match(vb.problems.join('\n'), /treasury deed carries holo/);
});

test('sole staker who is sole payer mints zero holo — nothing you fully control mints for you', () => {
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper' } },
    gifts: [{ handle: 'vic', n: 200 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'vic', pot: 'ec2', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'usdc', usd: 100, from: 'vic', ref: 'usdc:vic1' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d.report.burned, 100, 'the burn is real — the keeper is genuinely funded');
  assert.equal(d.report.keeperEquity, 50);
  assert.equal(d.report.holoMinted, 0, 'vic controlled both the stake and the dollars — zero holo');
  assert.ok(!d.rows.some((r) => r.kind === 'holo'));
  assert.equal(d.rows.find((r) => r.kind === 'patron-deed').holo, 0);
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('self-stake exclusion: the beneficiary household\'s stakes return whole, never burn', () => {
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper' } },
    gifts: [{ handle: 'keeper', n: 30 }, { handle: 'kbro', n: 50 }, { handle: 'dot', n: 20 }, { handle: 'paz', n: 600 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'keeper', pot: 'ec2', n: 30, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'kbro', pot: 'ec2', n: 50, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'dot', pot: 'ec2', n: 20, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 100, from: 'paz', ref: 'stripe:pi_2' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });
  const returns = d.rows.filter((r) => r.kind === 'pot-return');
  assert.deepEqual(returns.map((r) => `${r.handle}:${r.n}`).sort(), ['kbro:50', 'keeper:30'],
    'keeper AND kbro share the household — both return whole (dollars were there to match them)');
  assert.deepEqual(d.rows.filter((r) => r.kind === 'keeping-burn').map((r) => `${r.handle}:${r.n}`), ['dot:20']);
  assert.equal(d.report.keeperEquity, 10);
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('unmatched stakes return whole — pro-rata against the dollars, remainder home safe', () => {
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper' }, lamp: { beneficiary: 'keeper' } },
    gifts: [{ handle: 'stan', n: 520 }, { handle: 'paz', n: 600 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 500, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'lamp', n: 20, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 300, from: 'paz', ref: 'stripe:pi_3' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d.report.burned, 300, 'only what the dollars matched burns');
  assert.deepEqual(d.rows.filter((r) => r.kind === 'pot-return').map((r) => `${r.handle}:${r.n}`), ['stan:200']);

  // a pot with stakes and NO dollars closes to pure return
  const d2 = closeDirect(repo, priv, { pot: 'lamp', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d2.report.burned, 0);
  assert.deepEqual(d2.rows.map((r) => r.kind), ['pot-return']);
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('a re-recorded receipt bounces — at the door and in the replay (one dollar, one mint chance)', () => {
  const { pub, priv } = keypair();
  const repo = seamTown({ pub, priv, pins: PINS, pots: { ec2: { beneficiary: 'keeper' } } });
  const keyFile = join(repo, 'stamp-key.pem');
  const rcpt = ['--receipt', '--pot', 'ec2', '--rail', 'stripe', '--usd', '50', '--from', 'paz',
    '--ref', 'stripe:pi_dup', '--date', '2026-07-03', '--key', keyFile, '--repo', repo];
  execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), ...rcpt], { encoding: 'utf8' });
  assert.throws(
    () => execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), ...rcpt], { encoding: 'utf8', stdio: 'pipe' }),
    (e) => /already recorded/.test(String(e.stderr)),
    'the door bounces a re-recorded ref');
  const dup = mkForkAppend(repo, priv,
    potReceiptLine({ date: '2026-07-04', pot: 'ec2', rail: 'usdc', usd: 999, from: 'vic', ref: 'stripe:pi_dup' }));
  const v = verifyStampLedger(dup);
  assert.equal(v.ok, false, 'a duplicate ref slipped past any door must still fail verify');
  assert.match(v.problems.join('\n'), /already recorded/);
});

test('the ρ-cap clips holo at conversion — the excess is recorded on the deed only', () => {
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper' } },
    gifts: [{ handle: 'stan', n: 300 }, { handle: 'paz', n: 100 }],
  });
  // paz's earned primary mint is 101 (gift + 1 correspondence mint): cap = floor(0.25 · 101) = 25
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 300, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 300, from: 'paz', ref: 'stripe:pi_4' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d.report.keeperEquity, 150, 'the keeper leg is untouched by the payer\'s cap');
  assert.equal(d.report.holoMinted, 25, 'raw 150 clips to floor(ρ · earned mint) = 25');
  assert.equal(d.rows.find((r) => r.kind === 'patron-deed').usd, 300, 'the deed remembers every dollar');
  assert.equal(d.rows.find((r) => r.kind === 'patron-deed').holo, 25, 'and exactly what converted');
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('a held keeping-stake survives epochs it doesn\'t close in, inert', () => {
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper' }, lamp: { beneficiary: 'dot' } },
    gifts: [{ handle: 'stan', n: 150 }, { handle: 'vic', n: 40 }, { handle: 'paz', n: 600 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'vic', pot: 'lamp', n: 40, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 150, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 150, from: 'paz', ref: 'stripe:pi_5' }),
  ], priv);
  closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });
  let v = verifyStampLedger(repo);
  assert.equal(v.ok, true, (v.problems ?? []).join('\n'));
  assert.equal(foldPotPositions(entriesOf(repo)).get('lamp|vic'), 40,
    'ec2 closing its epoch did not touch the lamp stake');
  assert.equal(foldStaked(entriesOf(repo)).get('vic'), 40, 'still escrowed, still vic\'s');

  // and the held stake closes fine in ITS epoch, months later
  appendSigned(repo, [
    potReceiptLine({ date: '2026-09-03', pot: 'lamp', rail: 'usdc', usd: 40, from: 'paz', ref: 'usdc:tx9' }),
  ], priv);
  closeDirect(repo, priv, { pot: 'lamp', epoch: '2026-09', date: '2026-10-01' });
  v = verifyStampLedger(repo);
  assert.equal(v.ok, true, (v.problems ?? []).join('\n'));
});

test('treasury-covers-shortfall mints nothing — the town never receives from its own seam', () => {
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper' } },
    gifts: [{ handle: 'stan', n: 100 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'usdc', usd: 100, from: 'the-town', ref: 'usdc:town1' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d.report.burned, 0, 'treasury dollars match nothing');
  assert.equal(d.report.keeperEquity, 0);
  assert.equal(d.report.holoMinted, 0);
  assert.deepEqual(d.rows.filter((r) => r.kind === 'pot-return').map((r) => `${r.handle}:${r.n}`), ['stan:100'],
    'the stakes come home whole');
  assert.equal(d.rows.find((r) => r.kind === 'patron-deed').holo, 0);
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('one epoch, one close — and the reserved namespaces hold', () => {
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper' } },
    gifts: [{ handle: 'stan', n: 50 }, { handle: 'paz', n: 200 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 50, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 50, from: 'paz', ref: 'stripe:pi_6' }),
  ], priv);
  closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });
  const again = deriveEpochClose({
    entries: entriesOf(repo), households: householdKeys(repo), pot: 'ec2',
    potMeta: potFile(repo, 'ec2'), epoch: '2026-07', date: '2026-08-02', dial: keepingDial(repo),
  });
  assert.equal(again.ok, false);
  assert.match(again.error, /already closed/);

  // a keeping stake is never a ballot stake: the pot/ namespace is reserved
  const c = classifyEntry(potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'x', n: 1, via: 'api' }));
  assert.equal(c.kind, 'pot-stake', 'stake:pot/… must never parse as a vote on a topic called "pot"');
  // and a stake against a pot no file declares fails verify
  const ghost = mkForkAppend(repo, priv, potStakeLine({ date: '2026-08-03', handle: 'paz', pot: 'ghost', n: 1, via: 'api' }));
  const v = verifyStampLedger(ghost);
  assert.equal(v.ok, false);
  assert.match(v.problems.join('\n'), /unknown pot "ghost"/);
});

test('a forged keeper-equity row fails — even the σ leg is replayed, not trusted', () => {
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper' } },
    gifts: [{ handle: 'stan', n: 50 }, { handle: 'paz', n: 200 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 50, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 50, from: 'paz', ref: 'stripe:pi_7' }),
  ], priv);
  const solo = mkForkAppend(repo, priv,
    keeperEquityLine({ date: '2026-08-01', handle: 'keeper', n: 9999, pot: 'ec2', epoch: '2026-07' }));
  const v = verifyStampLedger(solo);
  assert.equal(v.ok, false, 'a keeper-equity row outside its derived block must fail');
  assert.match(v.problems.join('\n'), /KEEPING REPLAY DIVERGES|derives no lawful block/);
});
