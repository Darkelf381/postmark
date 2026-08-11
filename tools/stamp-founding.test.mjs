// stamp-founding.test.mjs — the era-dated FOUNDING GRANT: the one line that
// funds the town's own treasury.
//   node --test tools/stamp-founding.test.mjs
//
// A founding grant is not a gift. A gift lands on a resident and needs a
// WHITE_PAGES room; the treasury is not a resident and has no room, which is
// exactly why the gift path refuses it and why this class exists. Mirrors the
// gift's discipline otherwise: MINT-sourced so conservation folds it
// structurally, signed by the office pen (the signature IS the authority), and
// appended only onto a settled tail.
//
// WRITTEN BEFORE THE IMPLEMENTATION, and every falsifier below was run against
// the unmodified stamp-mint.mjs first. The headline result of that run is the
// reason this class cannot be "just a line we write by hand": an unrecognized
// grammar makes walkLedger report REPLAY DIVERGES, so a hand-written grant line
// would brick every later --append, --gift and stamp-verify in the town.
//
// Zero-dep; throwaway repos + ed25519. Nothing here touches a real ledger.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseStampLedger, foldBalances, foldMintCount, classifyEntry, foundingGrantLine } from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MINT = join(HERE, 'stamp-mint.mjs');

const TREASURY = 'the-town';
const ERA = 'let-there-be-light';
const PROVENANCE = 'the founding act — placeholder until Wright sets the words';

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    pub: publicKey.export({ type: 'spki', format: 'pem' }),
    priv: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

// A town with two corresponding residents and a declared treasury dial.
function town({ meeps = [], dials = undefined } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'stamp-town-founding-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify({ alice: 1, bob: 2 }));
  for (const [handle, login] of [['alice', 'alogin'], ['bob', 'blogin'], ...meeps.map((m) => [m, `${m}-login`])]) {
    mkdirSync(join(repo, 'WHITE_PAGES', handle), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', handle, 'ADDRESS.md'), `---\nhandle: ${handle}\ngithub: ${login}\n---\n`);
  }
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'),
    `# ledger\n\n- 2026-06-12 · seed-1 · alice → bob · thread: new\n- 2026-06-13 · seed-2 · bob → alice · thread: new\n`);
  writeFileSync(join(repo, 'ECONOMY-DIALS.json'), JSON.stringify(dials ?? {
    law_side: { founding_grant: { treasury_handle: TREASURY, one_per_era: true } },
  }, null, 2));
  return repo;
}

function keyFile(repo, priv) { const f = join(repo, 'stamp-key.pem'); writeFileSync(f, priv); return f; }
const ledgerText = (repo) => readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8');
const entriesOf = (repo) => parseStampLedger(ledgerText(repo));

function mintPass(repo, priv) {
  execFileSync(process.execPath, [MINT, '--append', '--key', keyFile(repo, priv), '--repo', repo], { encoding: 'utf8' });
}

// Run the grant verb. Returns { ok, out } — a FATAL is an expected outcome in
// half these tests, so a throw is captured rather than failing the run.
function grant(repo, priv, { amount = 1001, era = ERA, by = 'keeminlee', date = '2026-08-10', provenance = PROVENANCE, to = TREASURY } = {}) {
  try {
    const out = execFileSync(process.execPath, [MINT, '--founding-grant', to, '--amount', String(amount),
      '--era', era, '--by', by, '--date', date, '--provenance', provenance,
      '--key', keyFile(repo, priv), '--repo', repo], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: String(e.stderr ?? '') + String(e.stdout ?? '') };
  }
}

function foundedTown() {
  const { pub, priv } = keypair();
  const repo = town();
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);   // found the ledger on the mail so the tail is settled
  return { repo, priv, pub };
}

// ── the shape ────────────────────────────────────────────────────────────────

test('the grant line is era-dated, carries its provenance, and classifies', () => {
  const line = foundingGrantLine({ date: '2026-08-10', handle: TREASURY, n: 1001, era: ERA, by: 'keeminlee', note: PROVENANCE });
  assert.equal(line, `- 2026-08-10 · MINT → ${TREASURY} · 1001 · for: founding:${ERA} · by: keeminlee · note: ${PROVENANCE}`);
  const c = classifyEntry(line);
  assert.equal(c.kind, 'founding-grant');
  assert.equal(c.handle, TREASURY);
  assert.equal(c.n, 1001);
  assert.equal(c.era, ERA);
  assert.equal(c.by, 'keeminlee');
  assert.equal(c.note, PROVENANCE);
});

test('a grant mints to the treasury and the ledger stays GREEN', () => {
  const { repo, priv, pub } = foundedTown();
  const before = foldMintCount(entriesOf(repo)).get(TREASURY) ?? 0;
  assert.equal(before, 0, 'the treasury starts with nothing — this is what the act is for');

  const r = grant(repo, priv);
  assert.ok(r.ok, `grant should succeed:\n${r.out}`);

  const entries = entriesOf(repo);
  assert.equal(foldMintCount(entries).get(TREASURY), 1001);
  assert.equal(foldBalances(entries).get(TREASURY), 1001, 'liquid, and therefore stakeable');
  // conservation: every account, including MINT, sums to zero
  assert.equal([...foldBalances(entries).values()].reduce((a, b) => a + b, 0), 0);

  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, true, `verify must stay green:\n${(v.problems || []).join('\n')}`);
  rmSync(repo, { recursive: true, force: true });
});

test('the grant funds exactly the 13 founding stakes and leaves nothing over', () => {
  // 13 x 77 = 1001. The arithmetic is the design: the treasury ends at zero
  // liquid, so a stake that lands out of order silently clips to a partial
  // rather than failing loudly. Named here so the number is never a surprise.
  const { repo, priv } = foundedTown();
  assert.ok(grant(repo, priv).ok);
  const balance = foldBalances(entriesOf(repo)).get(TREASURY);
  assert.equal(balance, 13 * 77);
  assert.equal(balance - 13 * 77, 0, 'zero margin — the act consumes the grant to the last stamp');
  rmSync(repo, { recursive: true, force: true });
});

// ── FALSIFIERS: every one of these was run against the pre-change tool ────────

test('FALSIFIER — an UNRECOGNIZED grant grammar bricks the replay (why this class must exist)', () => {
  // The headline. Hand-write a founding-shaped line the parser does not know and
  // the ledger stops verifying: walkLedger sees `kind: unknown` and reports
  // REPLAY DIVERGES, which then fails every later --append and --gift. A grant
  // is not something that can be added to the ledger by writing it down.
  const { repo, priv, pub } = foundedTown();
  const path = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  writeFileSync(path, readFileSync(path, 'utf8') +
    `- 2026-08-10 · MINT → ${TREASURY} · 1001 · for: the founding act · sig: not-a-real-signature\n`);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /REPLAY DIVERGES|unrecognized grammar|signature/i.test(p)),
    `expected a replay/signature failure, got:\n${v.problems.join('\n')}`);
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — a grant to anyone but the declared treasury is refused', () => {
  // The dial names the treasury. Without this, the grant class is a founder-gift
  // with no room requirement — a mint to any handle at any size.
  const { repo, priv } = foundedTown();
  const r = grant(repo, priv, { to: 'alice' });
  assert.equal(r.ok, false);
  assert.match(r.out, /treasury/i);
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — a second grant in the same era is refused', () => {
  // A founding act happens once. Without the once-per-era law the class is an
  // unbounded printing press pointed at the town's own account.
  const { repo, priv } = foundedTown();
  assert.ok(grant(repo, priv).ok);
  const second = grant(repo, priv, { date: '2026-08-11' });
  assert.equal(second.ok, false);
  assert.match(second.out, /era/i);
  // and the treasury did not grow
  assert.equal(foldBalances(entriesOf(repo)).get(TREASURY), 1001);
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — a malformed grant line is refused at every field', () => {
  const { repo, priv } = foundedTown();
  const bad = [
    [{ amount: 0 }, /amount/i],
    [{ amount: -5 }, /amount/i],
    [{ amount: 1.5 }, /amount/i],
    [{ era: 'Let There Be Light' }, /era/i],          // not kebab
    [{ era: '' }, /era/i],
    [{ provenance: '' }, /provenance/i],
    [{ provenance: 'a · b' }, /provenance|separator/i], // would split the line's fields
    [{ by: '' }, /by/i],
  ];
  for (const [opts, re] of bad) {
    const r = grant(repo, priv, opts);
    assert.equal(r.ok, false, `expected refusal for ${JSON.stringify(opts)}`);
    assert.match(r.out, re, `wrong reason for ${JSON.stringify(opts)}: ${r.out}`);
  }
  // nothing was written by any of them
  assert.equal(foldMintCount(entriesOf(repo)).get(TREASURY) ?? 0, 0);
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — a grant that would forge the provenance separator cannot be built', () => {
  // The note is the terminal field and the only free text in the grammar. If a
  // `·` could ride inside it, an author could forge trailing fields.
  assert.throws(() => foundingGrantLine({ date: '2026-08-10', handle: TREASURY, n: 1, era: ERA, by: 'x', note: 'a · by: someone-else' }),
    /separator|·/);
});

test('FALSIFIER — a grant to a meep is refused (meeps stay outside the currency)', () => {
  const { pub, priv } = keypair();
  const repo = town({ meeps: ['botty'], dials: { law_side: { founding_grant: { treasury_handle: 'botty', one_per_era: true } } } });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  execFileSync(process.execPath, [MINT, '--declare-rules', 'stamps-v2', '--meeps', 'botty',
    '--date', '2026-06-20', '--key', keyFile(repo, priv), '--repo', repo], { encoding: 'utf8' });
  const r = grant(repo, priv, { to: 'botty' });
  assert.equal(r.ok, false);
  assert.match(r.out, /meep/i);
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — a back-dated grant is refused (the ledger is append-only)', () => {
  const { repo, priv } = foundedTown();
  const r = grant(repo, priv, { date: '2026-01-01' });
  assert.equal(r.ok, false);
  assert.match(r.out, /precedes|append-only/i);
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — a tampered grant line fails the signature chain', () => {
  const { repo, priv, pub } = foundedTown();
  assert.ok(grant(repo, priv).ok);
  const path = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  // change the amount after signing: 1001 -> 9001
  writeFileSync(path, readFileSync(path, 'utf8').replace(`· 1001 · for: founding:`, `· 9001 · for: founding:`));
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, false, 'a re-written amount must not verify');
  rmSync(repo, { recursive: true, force: true });
});

// ── the prepared stake batch: emitted, never executed ─────────────────────────

test('the stake batch is EMITTED, not executed — 13 lines, 77 each, nothing appended', () => {
  const { repo, priv } = foundedTown();
  assert.ok(grant(repo, priv).ok);
  const before = ledgerText(repo);
  const out = execFileSync(process.execPath, [join(HERE, 'founding-stakes.mjs'),
    '--repo', repo, '--holder', TREASURY, '--each', '77', '--date', '2026-08-10', '--json'], { encoding: 'utf8' });
  const batch = JSON.parse(out);
  assert.equal(batch.lines.length, 13);
  assert.equal(batch.total, 1001);
  assert.equal(batch.each, 77);
  assert.equal(batch.holder, TREASURY);
  for (const l of batch.lines) assert.match(l, /^- 2026-08-10 · the-town → stake:world-mark\/[a-z0-9-]+\/[a-z0-9-]+ · 77 · via: /);
  assert.equal(ledgerText(repo), before, 'THE LEDGER IS UNTOUCHED — this tool prints, it does not write');
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — the batch refuses to emit more than the treasury can cover', () => {
  const { repo, priv } = foundedTown();
  assert.ok(grant(repo, priv).ok);
  let failed = false, out = '';
  try {
    execFileSync(process.execPath, [join(HERE, 'founding-stakes.mjs'),
      '--repo', repo, '--holder', TREASURY, '--each', '100', '--date', '2026-08-10', '--json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { failed = true; out = String(e.stderr ?? ''); }
  assert.equal(failed, true, '13 x 100 = 1300 exceeds the 1001 the treasury holds');
  assert.match(out, /1300|balance|cover|clip/i);
  rmSync(repo, { recursive: true, force: true });
});
