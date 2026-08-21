// epoch-close.test.mjs — falsifiers for the funding seam (keeping pots, S1/S2).
//   node --test tools/epoch-close.test.mjs
// Zero-dep; throwaway towns + ed25519 keys (the ballot.test.mjs pattern).
//
// Every test here is a falsifier: each asserts a refusal, a red verify, or an
// exact number that the ruled law forces — and the forged/tampered cases are the
// standing proof the checks CAN fail. The law's one home is deriveEpochClose
// (stamp-mint.mjs); the verifier replays it; this file tries to break both.
//
// THE VALIDATION RULE (Keemin, 2026-08-21 — the night's lesson): every falsifier
// CITES THE SENTENCE OF LAW IT ASSERTS, quoted verbatim in the test itself. The
// first pass of this suite was green while the engine encoded a paraphrase of the
// matching rule — a mis-brief nobody could see, because the tests asserted the
// paraphrase back. Law-beside-assertion makes that drift visible at diff review:
// if the quote and the number disagree, the reviewer is looking at the bug.
//
// The law: capture doc § 8, "The keeping stake and the pot (the mechanics, as
// ruled tonight)" — G:/Starstory/docs/2026-08-20/postmark-economy-ontology.md.
// Quotes below are verbatim from it (§ 3, § 9 and § 10 where noted).

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
  foldMintCount, foldHolo, foldKeepingEquity, foldPotPositions, deriveEpochClose,
  keepingDial, potFile, householdKeys, keepingLine, giftLine,
  potStakeLine, potReceiptLine, holoMintLine, patronDeedLine, keepingEquityLine,
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
// Every pot carries a POSTED NEED: target_usd_per_epoch is the only thing
// dollars are ever priced against, so a pot without one cannot close. 100 is the
// fixture default; tests whose arithmetic turns on it say so out loud.
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
    writeFileSync(join(repo, 'WHITE_PAGES', `pot-${id}.json`),
      JSON.stringify({ pot: id, status: 'open', target_usd_per_epoch: 100, ...meta }));
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

// fork a town dir by copying its ledger, then append raw canonicals with a key —
// the tamper bench: each fork is its own repo so red cases never poison a green one
function mkForkAppend(repo, privPem, ...canonicals) {
  const fork = mkdtempSync(join(tmpdir(), 'seam-fork-'));
  mkdirSync(join(fork, 'tools'), { recursive: true });
  mkdirSync(join(fork, 'WHITE_PAGES'), { recursive: true });
  for (const f of ['tools/github-ids.json', 'tools/stamp-pubkey.pem', 'ECONOMY-DIALS.json', 'WHITE_PAGES/mail-ledger.md', 'WHITE_PAGES/stamp-ledger.md']) {
    writeFileSync(join(fork, f), readFileSync(join(repo, f)));
  }
  for (const p of ['ec2', 'big', 'over', 'half', 'floors', 'even', 'odd', 'lamp', 'mix', 'untargeted']) {
    try { writeFileSync(join(fork, 'WHITE_PAGES', `pot-${p}.json`), readFileSync(join(repo, 'WHITE_PAGES', `pot-${p}.json`))); } catch {}
  }
  appendSigned(fork, canonicals, privPem);
  return fork;
}

const PINS = {
  stan: { login: 's', id: 1 }, paz: { login: 'p', id: 2 }, keeper: { login: 'k', id: 9 },
  kbro: { login: 'k', id: 9 }, dot: { login: 'd', id: 5 }, vic: { login: 'v', id: 6 },
  ann: { login: 'a', id: 11 }, bo: { login: 'b', id: 12 }, cy: { login: 'c', id: 13 },
  del: { login: 'de', id: 14 },
};

// ── the canonical close ──────────────────────────────────────────────────────

test('the canonical close: 300 staked on a fully funded $150 pot → 300 burn → 150 + 150', () => {
  // LAW § 8.4: "At epoch close, conversion runs pro-rata to dollars actually
  //             paid; unmatched stakes RETURN (no counterparty, no burn)."
  // LAW § 8.5: "σ × pot mints back to the keepers as their own equity, at par of
  //             their burn — permanent, verb-less, remembered."
  // LAW § 8.5: "(1−σ) × pot mints to payers as Holo, by dollar share."
  // LAW § 8.5: "Total new equity = the matched burn, exactly. No double mint."
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 150 } },
    gifts: [{ handle: 'stan', n: 300 }, { handle: 'paz', n: 1200 }],
  });
  const keyFile = join(repo, 'stamp-key.pem');
  appendSigned(repo, [potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 300, via: 'api' })], priv);

  // the receipt goes through the door, so mint-at-entry is exercised end-to-end
  execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--receipt', '--pot', 'ec2',
    '--rail', 'stripe', '--usd', '150', '--from', 'paz', '--ref', 'stripe:pi_1', '--date', '2026-07-03',
    '--key', keyFile, '--repo', repo], { encoding: 'utf8' });

  // stakes are escrow while open: liquid dips, staked holds them, mint_count is
  // unmoved (stan holds 301 = 300 gift + 1 correspondence mint, stakes 300)
  let entries = entriesOf(repo);
  assert.equal(foldBalances(entries).get('stan') ?? 0, 1);
  assert.equal(foldStaked(entries).get('stan') ?? 0, 300);

  const out = execFileSync(process.execPath, closeArgs({ repo, pot: 'ec2', epoch: '2026-07', date: '2026-08-01' }), { encoding: 'utf8' });
  assert.match(out, /funded fraction:\s+100\.0%/, '$150 against a $150 posted need funds the pot whole');
  assert.match(out, /burned \(funded\):\s+300/);
  assert.match(out, /keeping-equity:\s+150/);
  assert.match(out, /holo to payers:\s+150/);

  const v = verifyStampLedger(repo);
  assert.equal(v.ok, true, (v.problems ?? []).join('\n'));

  entries = entriesOf(repo);
  const kinds = entries.map((e) => classifyEntry(e.canonical).kind);
  for (const k of ['pot-stake', 'pot-receipt', 'keeping-burn', 'keeping-equity', 'holo', 'patron-deed'])
    assert.ok(kinds.includes(k), `ledger carries a ${k} row`);

  // the burn is a real spend: stan's stamps are gone from every tense but his mint_count
  assert.equal(foldStaked(entries).get('stan') ?? 0, 0);
  assert.equal(foldBalances(entries).get('stan') ?? 0, 1);
  assert.equal(foldMintCount(entries).get('stan'), 301);
  // the σ leg came back to STAN — the staker — not to the pot's beneficiary,
  // and it is "permanent, verb-less, remembered": arrow-free, so it adds nothing
  // to liquid (still 1, asserted above) and nothing to mint_count (still 301)
  assert.equal(foldKeepingEquity(entries).get('stan'), 150);
  assert.equal(foldKeepingEquity(entries).get('keeper'), undefined,
    'the beneficiary keeps the DOLLARS; the σ leg is the stakers\' own equity');
  assert.equal(foldBalances(entries).get('keeper') ?? 0, 1, 'a close mints the keeper no stamps at all');
  assert.equal(foldMintCount(entries).get('keeper'), 1);
  // holo is soulbound: visible ONLY to its own reader, absent from every tally
  assert.equal(foldHolo(entries).get('paz'), 150);
  assert.equal(foldBalances(entries).get('paz') ?? 0, 1200 + 1); // gift + mint — holo added nothing
  assert.equal(foldMintCount(entries).get('paz'), 1200 + 1);

  // "Total new equity = the matched burn, exactly. No double mint."
  const total = 150 + 150;
  assert.equal(total, 300, '300 burned is 150 + 150 — never 600');
  assert.notEqual(total, 600);

  // both arrow-free legs are readable only through their own readers
  const held = execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--holo-held', '--repo', repo], { encoding: 'utf8' });
  assert.match(held, /150\s+gh:2\s+\(paz:150\)/);
  const kept = execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--keeping-held', '--repo', repo], { encoding: 'utf8' });
  assert.match(kept, /150\s+gh:1\s+\(stan:150\)/);
});

// ── matching: priced against the posted need, never against the staked mass ──

test('no dollar↔stamp rate: a fully funded pot burns EVERY stake, however large the pile', () => {
  // LAW § 8.1: "The town posts a funded need ($N per epoch — e.g. EC2, $150/mo)."
  // LAW § 8.2: "Households stake keeping-stakes on it (the want signal + the
  //             pricing mass)."
  // LAW § 8.4: "conversion runs pro-rata to dollars actually paid"
  // The pro-rata is against the POSTED NEED. Nothing in the law names a rate
  // between a dollar and a stamp, and there is none: the town prices money's
  // power by how much it stakes. $150 that fully funds a $150 need converts
  // 1000 staked stamps as readily as it converts 1.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: {
      big: { beneficiary: 'keeper', target_usd_per_epoch: 150 },
      over: { beneficiary: 'keeper', target_usd_per_epoch: 150 },
    },
    gifts: [{ handle: 'stan', n: 1000 }, { handle: 'dot', n: 100 }, { handle: 'paz', n: 4000 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'big', n: 1000, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'dot', pot: 'over', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'big', rail: 'stripe', usd: 150, from: 'paz', ref: 'stripe:pi_big' }),
    potReceiptLine({ date: '2026-07-03', pot: 'over', rail: 'usdc', usd: 600, from: 'paz', ref: 'usdc:over1' }),
  ], priv);

  const big = closeDirect(repo, priv, { pot: 'big', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(big.report.fundedFraction, 1);
  assert.equal(big.report.burned, 1000, '$150 met the $150 need, so every staked stamp converts');
  assert.notEqual(big.report.burned, 150,
    'the killed reading (burn = min(stakes, dollars)) invents a 1:1 dollar↔stamp rate the law never grants');
  assert.equal(big.report.keepingEquity, 500);
  assert.equal(big.report.holoMinted, 500);
  assert.deepEqual(big.rows.filter((r) => r.kind === 'pot-return'), [], 'nothing is left over to return');

  // and overfunding never burns more than was staked — the fraction caps at 1
  const over = closeDirect(repo, priv, { pot: 'over', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(over.report.fundedFraction, 1, '$600 against a $150 need is still 100%, not 400%');
  assert.equal(over.report.burned, 100);
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('half-funded: each stake burns floor(fraction × stake), the rest returns whole', () => {
  // LAW § 8.4: "At epoch close, conversion runs pro-rata to dollars actually
  //             paid; unmatched stakes RETURN (no counterparty, no burn)."
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { half: { beneficiary: 'keeper', target_usd_per_epoch: 150 } },
    gifts: [{ handle: 'stan', n: 300 }, { handle: 'dot', n: 101 }, { handle: 'paz', n: 1200 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'half', n: 300, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'dot', pot: 'half', n: 101, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'half', rail: 'stripe', usd: 75, from: 'paz', ref: 'stripe:pi_h' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'half', epoch: '2026-07', date: '2026-08-01' });

  assert.equal(d.report.fundedFraction, 0.5, '$75 of a $150 posted need');
  // half of EACH stake, floored on that staker's own number
  assert.deepEqual(d.rows.filter((r) => r.kind === 'keeping-burn').map((r) => `${r.handle}:${r.n}`),
    ['dot:50', 'stan:150'], 'floor(101 × ½) = 50 and floor(300 × ½) = 150');
  assert.deepEqual(d.rows.filter((r) => r.kind === 'pot-return').map((r) => `${r.handle}:${r.n}`),
    ['dot:51', 'stan:150'], 'the unfunded remainder of every stake goes home whole');
  assert.equal(d.report.burned, 200);
  assert.deepEqual(d.rows.filter((r) => r.kind === 'keeping-equity').map((r) => `${r.handle}:${r.n}`),
    ['dot:25', 'stan:75']);
  assert.equal(d.report.holoMinted, 100);
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('a zero-dollar close is pure return — no counterparty, no burn', () => {
  // LAW § 8.4: "unmatched stakes RETURN (no counterparty, no burn)."
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { lamp: { beneficiary: 'keeper', target_usd_per_epoch: 150 } },
    gifts: [{ handle: 'stan', n: 20 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'lamp', n: 20, via: 'api' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'lamp', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d.report.fundedFraction, 0);
  assert.equal(d.report.burned, 0);
  assert.equal(d.report.keepingEquity, 0);
  assert.equal(d.report.holoMinted, 0);
  assert.deepEqual(d.rows.map((r) => r.kind), ['pot-return'], 'the whole close is one stake coming home');
  assert.equal(foldBalances(entriesOf(repo)).get('stan') ?? 0, 21, 'gift + mint, all of it back');
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('a pot with no posted need cannot close — there is nothing to price dollars against', () => {
  // LAW § 8.1: "The town posts a funded need ($N per epoch — e.g. EC2, $150/mo)."
  // No posted need, no funded fraction; the only alternative would be inventing a
  // dollar↔stamp rate, which the law never grants. So the close refuses.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { untargeted: { beneficiary: 'keeper', target_usd_per_epoch: null } },
    gifts: [{ handle: 'stan', n: 50 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'untargeted', n: 50, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'untargeted', rail: 'usdc', usd: 50, from: 'paz', ref: 'usdc:u1' }),
  ], priv);
  const d = deriveEpochClose({
    entries: entriesOf(repo), households: householdKeys(repo), pot: 'untargeted',
    potMeta: potFile(repo, 'untargeted'), epoch: '2026-07', date: '2026-08-01', dial: keepingDial(repo),
  });
  assert.equal(d.ok, false);
  assert.match(d.error, /target_usd_per_epoch/);
});

// ── the split ────────────────────────────────────────────────────────────────

test('R1 floors EVERY leg, per staker and not on the total — the remainder burns un-minted', () => {
  // LAW § 8.5: "σ × pot mints back to the keepers as their own equity, at par of
  //             their burn" — at par of THEIR burn, so the floor is taken on each
  //             staker's own number. A floor of the total would hand one staker's
  //             rounding to another.
  // LAW § 8.5: "Total new equity = the matched burn, exactly. No double mint."
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: {
      floors: { beneficiary: 'keeper', target_usd_per_epoch: 10 },
      odd: { beneficiary: 'keeper', target_usd_per_epoch: 100 },
    },
    gifts: [
      { handle: 'ann', n: 3 }, { handle: 'bo', n: 3 }, { handle: 'cy', n: 3 },
      { handle: 'del', n: 100 }, { handle: 'stan', n: 301 }, { handle: 'paz', n: 1200 },
    ],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'ann', pot: 'floors', n: 3, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'bo', pot: 'floors', n: 3, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'cy', pot: 'floors', n: 3, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'odd', n: 301, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'floors', rail: 'usdc', usd: 10, from: 'del', ref: 'usdc:f1' }),
    potReceiptLine({ date: '2026-07-03', pot: 'odd', rail: 'usdc', usd: 100, from: 'paz', ref: 'usdc:o1' }),
  ], priv);

  const f = closeDirect(repo, priv, { pot: 'floors', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(f.report.burned, 9, 'three stakes of 3, all funded');
  assert.deepEqual(f.rows.filter((r) => r.kind === 'keeping-equity').map((r) => `${r.handle}:${r.n}`),
    ['ann:1', 'bo:1', 'cy:1'], 'floor(3 × ½) = 1 each');
  assert.equal(f.report.keepingEquity, 3);
  assert.notEqual(f.report.keepingEquity, 4,
    'floor(σ · B) on the TOTAL would be 4 — a stamp nobody\'s own burn paid for');
  assert.equal(f.report.holoMinted, 4, 'floor((1−σ) · 9 · 10/10) = 4');
  assert.equal(f.report.unmintedRemainder, 2, 'every remainder burns un-minted — the seam keeps the change');
  assert.ok(f.report.keepingEquity + f.report.holoMinted <= f.report.burned,
    'total new equity never exceeds the matched burn');

  // and the odd stamp: 301 burned at σ=½ is 150 + 150, with 1 left un-minted
  const o = closeDirect(repo, priv, { pot: 'odd', epoch: '2026-07', date: '2026-08-02' });
  assert.equal(o.report.burned, 301);
  assert.equal(o.report.keepingEquity, 150);
  assert.equal(o.report.holoMinted, 150);
  assert.equal(o.report.unmintedRemainder, 1);
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('the σ leg is the STAKERS\' own — a beneficiary\'s stakes convert like anyone else\'s', () => {
  // LAW § 8.5: "σ × pot mints back to the keepers as their own equity, at par of
  //             their burn — permanent, verb-less, remembered."
  // LAW § 8.6: "Self-stake exclusion: a payer's own stakes are excluded from
  //             their holo calculation." — the PAYER's. § 8 excludes no one
  //             else's stakes anywhere, so the beneficiary's burn like the rest.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'keeper', n: 30 }, { handle: 'kbro', n: 50 }, { handle: 'dot', n: 20 }, { handle: 'paz', n: 1200 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'keeper', pot: 'ec2', n: 30, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'kbro', pot: 'ec2', n: 50, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'dot', pot: 'ec2', n: 20, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 100, from: 'paz', ref: 'stripe:pi_2' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });

  assert.deepEqual(d.rows.filter((r) => r.kind === 'pot-return'), [],
    'a funded pot returns nothing — the beneficiary household gets no carve-out');
  assert.deepEqual(d.rows.filter((r) => r.kind === 'keeping-burn').map((r) => `${r.handle}:${r.n}`),
    ['dot:20', 'kbro:50', 'keeper:30']);
  assert.deepEqual(d.rows.filter((r) => r.kind === 'keeping-equity').map((r) => `${r.handle}:${r.n}`),
    ['dot:10', 'kbro:25', 'keeper:15'], 'each staker\'s own σ share, at par of their own burn');
  assert.equal(d.report.burned, 100);
  assert.equal(d.report.keepingEquity, 50);
  assert.equal(d.report.holoMinted, 50);
  // the pot's beneficiary receives DOLLARS, never stamps, from a close
  assert.equal(foldMintCount(entriesOf(repo)).get('keeper'), 30 + 1, 'gift + correspondence mint, nothing from the close');
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('sole staker who is sole payer mints zero holo — deed only', () => {
  // LAW § 8.6: "Self-stake exclusion: a payer's own stakes are excluded from
  //             their holo calculation. Sole-staker-sole-payer mints zero holo —
  //             deed only. You cannot trade with yourself."
  // LAW § 3:   "Nothing you fully control can mint for you."
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'vic', n: 200 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'vic', pot: 'ec2', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'usdc', usd: 100, from: 'vic', ref: 'usdc:vic1' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d.report.burned, 100, 'the burn is real — the posted need was funded');
  assert.equal(d.report.holoMinted, 0, 'vic controlled both the stake and the dollars — zero holo');
  assert.ok(!d.rows.some((r) => r.kind === 'holo'));
  assert.equal(d.rows.find((r) => r.kind === 'patron-deed').holo, 0, 'the deed remembers the dollars anyway');
  // the σ leg is NOT the excluded one: her own stake still converts at par
  assert.equal(d.report.keepingEquity, 50, 'her keeping-equity is hers, bought with her own burn');
  assert.equal(d.report.unmintedRemainder, 50, 'the holo she could not mint burns un-minted');
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('a payer who also staked: holo basis excludes their own burn, nothing else', () => {
  // LAW § 8.6: "a payer's own stakes are excluded from their holo calculation."
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { mix: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'vic', n: 200 }, { handle: 'dot', n: 40 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'dot', pot: 'mix', n: 40, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'vic', pot: 'mix', n: 60, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'mix', rail: 'usdc', usd: 100, from: 'vic', ref: 'usdc:vic2' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'mix', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d.report.burned, 100);
  assert.equal(d.report.holoMinted, 20,
    'basis is B minus vic\'s own 60 burned: floor((1−σ) · 40 · 100/100) = 20');
  assert.notEqual(d.report.holoMinted, 50, 'an unexcluded basis would have paid her 50 for her own stake');
  assert.deepEqual(d.rows.filter((r) => r.kind === 'keeping-equity').map((r) => `${r.handle}:${r.n}`),
    ['dot:20', 'vic:30'], 'the exclusion is payer-side only — her σ leg is untouched');
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('the ρ-cap clips holo at conversion — and never touches the stakers\' σ leg', () => {
  // LAW § 9:  "Cap: cumulative holo ≤ ρ × cumulative earned primary mint, per
  //            household."
  // ρ is the filter on what MONEY may ever own (§ 7's second filter,
  // "Unboundedness"). The σ leg is bought with staked attention, not dollars, so
  // no ρ appears on it anywhere in § 8 or § 9.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 150 } },
    gifts: [{ handle: 'stan', n: 300 }, { handle: 'paz', n: 100 }],
  });
  // paz's earned primary mint is 101 (gift + 1 correspondence mint): cap = floor(0.25 · 101) = 25
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 300, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 150, from: 'paz', ref: 'stripe:pi_4' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d.report.keepingEquity, 150, 'the stakers\' leg is untouched by the payer\'s cap');
  assert.equal(d.report.holoMinted, 25, 'raw 150 clips to floor(ρ · earned mint) = 25');
  assert.equal(d.rows.find((r) => r.kind === 'patron-deed').usd, 150, 'the deed remembers every dollar');
  assert.equal(d.rows.find((r) => r.kind === 'patron-deed').holo, 25, 'and exactly what converted');
  assert.equal(d.report.unmintedRemainder, 125, 'the clipped excess burns un-minted');
  assert.equal(verifyStampLedger(repo).ok, true);
});

// ── the treasury and the grant ───────────────────────────────────────────────

test('treasury dollars fund nothing and mint nothing — the stakes come home whole', () => {
  // LAW § 8.4: "Treasury may cover any shortfall — minting nothing."
  // LAW § 3:   "treasury spending mints nothing · the town never stands on the
  //             receiving side of the seam."
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'stan', n: 100 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'usdc', usd: 100, from: 'the-town', ref: 'usdc:town1' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d.report.dollarsWitnessed, 100, 'the bill was genuinely paid');
  assert.equal(d.report.dollarsFunding, 0, 'but not by the town\'s payers');
  assert.equal(d.report.fundedFraction, 0, 'so the pot funded 0% of its posted need');
  assert.equal(d.report.burned, 0);
  assert.equal(d.report.keepingEquity, 0);
  assert.equal(d.report.holoMinted, 0);
  assert.deepEqual(d.rows.filter((r) => r.kind === 'pot-return').map((r) => `${r.handle}:${r.n}`), ['stan:100']);
  assert.equal(d.rows.find((r) => r.kind === 'patron-deed').holo, 0);
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('the founding grant mints zero holo and lands as patron-deed #1 — a holo-carrying treasury deed fails', () => {
  // LAW § 11: at entry the grant "minted zero holo (no household, no earned mint
  //           → zero cap — the filter working) and patron deed #1".
  // LAW § 10: "Mint-at-entry, never at spend: a dollar mints (or doesn't) exactly
  //            once, when it crosses the seam."
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

// ── tamper bench: every check proves it can go red ───────────────────────────

test('a forged holo row fails the chain; an office-signed wrong one fails the keeping replay', () => {
  // LAW § 9:  "Soulbound equity denomination: no stake, no vote, no transfer."
  // A holo row is the only record of soulbound equity, so it must be exactly what
  // the derivation produces — no signature, however authentic, can substitute.
  const { pub, priv } = keypair();
  const intruder = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
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

test('a forged keeping-equity row fails — even the σ leg is replayed, not trusted', () => {
  // LAW § 8.5: "The matched pot converts to equity exactly once, split by σ."
  // Exactly once, and only as the derivation computes it.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'stan', n: 50 }, { handle: 'paz', n: 200 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 50, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 50, from: 'paz', ref: 'stripe:pi_7' }),
  ], priv);
  const solo = mkForkAppend(repo, priv,
    keepingEquityLine({ date: '2026-08-01', handle: 'stan', n: 9999, pot: 'ec2', epoch: '2026-07' }));
  const v = verifyStampLedger(solo);
  assert.equal(v.ok, false, 'a keeping-equity row outside its derived block must fail');
  assert.match(v.problems.join('\n'), /KEEPING REPLAY DIVERGES|derives no lawful block/);
});

test('the retired MINT-shaped σ row is gone from the grammar — and cannot be smuggled back in', () => {
  // LAW § 8.5: the σ leg is "permanent, verb-less, remembered". A `MINT → keeper`
  // row is a verb: liquid, spendable, counted. The first pass wrote one; the
  // correction retires the shape, and a ledger carrying it must not verify — the
  // walk has no grammar for it and the movement fold would otherwise credit real,
  // spendable stamps to a handle no derivation ever chose.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'stan', n: 50 }],
  });
  const stale = `- 2026-08-01 · MINT → keeper · 25 · for: keeper-equity:ec2/2026-07`;
  assert.equal(classifyEntry(stale).kind, 'unknown', 'the old shape parses as nothing at all');
  const smuggled = mkForkAppend(repo, priv, stale);
  const v = verifyStampLedger(smuggled);
  assert.equal(v.ok, false);
  assert.match(v.problems.join('\n'), /unrecognized grammar/);
});

test('a re-recorded receipt bounces — at the door and in the replay (one dollar, one mint chance)', () => {
  // LAW § 10: "Mint-at-entry, never at spend: a dollar mints (or doesn't) exactly
  //            once, when it crosses the seam."
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

test('one epoch, one close — and the reserved namespaces hold', () => {
  // LAW § 8.5: "The matched pot converts to equity exactly once."
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
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

test('a held keeping-stake survives epochs it doesn\'t close in, inert', () => {
  // LAW § 8.2: "Households stake keeping-stakes on it (the want signal + the
  //             pricing mass)." A stake is per pot; closing one pot's epoch is
  //             not an event in any other pot's life.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: {
      ec2: { beneficiary: 'keeper', target_usd_per_epoch: 150 },
      lamp: { beneficiary: 'dot', target_usd_per_epoch: 40 },
    },
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
