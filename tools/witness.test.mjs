// witness.test.mjs — the witness's resident bindings: who may speak for a handle.
//   node --test tools/witness.test.mjs
// Zero-dep; builds throwaway towns in tmp.
//
// Importing witness.mjs runs no CLI: it needs GITHUB_TOKEN/REPOSITORY/PR_NUMBER
// and a subcommand only when it IS the entry point (§ IS_MAIN).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadBindings } from './witness.mjs';

// A town is rooms with ADDRESS files, a pin registry, and a stamp-ledger.
// Ledger lines carry a placeholder `sig:` because loadBindings asks only
// whether a line was signed at all — whether the signature VERIFIES is
// stamp-verify's question, and it answers it over the whole chain.
function town({ addresses = {}, pins = {}, ledgerLines = [] } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'witness-town-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify(pins));
  for (const [handle, github] of Object.entries(addresses)) {
    mkdirSync(join(repo, 'WHITE_PAGES', handle), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', handle, 'ADDRESS.md'),
      `---\nhandle: ${handle}\n${github ? `github: ${github}\n` : ''}---\n`);
  }
  writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'),
    `# stamp-ledger\n\n${ledgerLines.join('\n')}\n`);
  return repo;
}
const SIGNED = (date, handle, key) => `- ${date} · registry: ${handle} = ${key} · sig: AAAA_placeholder`;
const UNSIGNED = (date, handle, key) => `- ${date} · registry: ${handle} = ${key}`;

const run = (repo, fn) => { try { return fn(loadBindings(repo)); } finally { rmSync(repo, { recursive: true, force: true }); } };

// ── the wire: a sealed line binds, with no file edit at all ──────────────────
// The point of the whole change. tools/pin-github-ids.mjs refuses to auto-pin a
// minted handle and names the lawful road — "a dated ledger registry: line" —
// and until now that road ended nowhere: the resident stayed login-bound, so
// the only thing that visibly WORKED was the hand-edit the mint forbids.

test('a sealed gh: line binds by immutable id with no pin in the file', () => {
  const repo = town({
    addresses: { tulip: 'emberian' },
    pins: {},
    ledgerLines: [SIGNED('2026-07-13', 'tulip', 'gh:704250')],
  });
  run(repo, ({ byId, byLogin }) => {
    assert.deepEqual(byId[704250], ['tulip']);
    // and NOT login-matchable — the same rule a file pin has always carried:
    // an abandoned login re-registered by a stranger inherits nothing.
    assert.equal(byLogin['emberian'], undefined);
  });
});

test('a sealed gh: line supersedes a file pin naming a different account', () => {
  const repo = town({
    addresses: { tulip: 'emberian' },
    pins: { tulip: { login: 'old-account', id: 111, pinned: '2026-06-01' } },
    ledgerLines: [SIGNED('2026-07-13', 'tulip', 'gh:704250')],
  });
  run(repo, ({ byId }) => {
    assert.deepEqual(byId[704250], ['tulip']);
    assert.equal(byId[111], undefined);
  });
});

test('the latest sealed gh: line wins; an earlier one is superseded', () => {
  const repo = town({
    addresses: { tulip: 'emberian' },
    ledgerLines: [
      SIGNED('2026-07-13', 'tulip', 'gh:704250'),
      SIGNED('2026-08-20', 'tulip', 'gh:999999'),
    ],
  });
  run(repo, ({ byId }) => {
    assert.deepEqual(byId[999999], ['tulip']);
    assert.equal(byId[704250], undefined);
  });
});

// ── the boundaries: what the overlay must NOT do ─────────────────────────────

test('an hh: line is an economy statement and creates no account binding', () => {
  // vertas-marginalia and arky are re-keyed by 08-08 `hh:cadaeic.space` lines.
  // That says "these handles share a purse", not "this account speaks for them".
  const repo = town({
    addresses: { arky: 'cadaeix-bot' },
    ledgerLines: [SIGNED('2026-08-08', 'arky', 'hh:cadaeic.space')],
  });
  run(repo, ({ byId, byLogin }) => {
    assert.deepEqual(Object.keys(byId), []);
    assert.deepEqual(byLogin['cadaeix-bot'], ['arky']); // login fallback stands
  });
});

test('an hh: line does not retract an existing file pin', () => {
  const repo = town({
    addresses: { arky: 'cadaeix-bot' },
    pins: { arky: { login: 'cadaeix-bot', id: 314099683, pinned: '2026-08-07' } },
    ledgerLines: [SIGNED('2026-08-08', 'arky', 'hh:cadaeic.space')],
  });
  run(repo, ({ byId, byLogin }) => {
    assert.deepEqual(byId[314099683], ['arky']);
    assert.equal(byLogin['cadaeix-bot'], undefined);
  });
});

test('an UNSIGNED registry line moves nothing', () => {
  const repo = town({
    addresses: { tulip: 'emberian' },
    ledgerLines: [UNSIGNED('2026-07-13', 'tulip', 'gh:704250')],
  });
  run(repo, ({ byId, byLogin }) => {
    assert.equal(byId[704250], undefined);
    assert.deepEqual(byLogin['emberian'], ['tulip']);
  });
});

test('a sealed line for a handle with no room binds nobody', () => {
  const repo = town({
    addresses: { bob: 'bobgh' },
    ledgerLines: [SIGNED('2026-07-13', 'ghost', 'gh:704250')],
  });
  run(repo, ({ byId, byLogin }) => {
    assert.equal(byId[704250], undefined);
    assert.deepEqual(byLogin['bobgh'], ['bob']);
  });
});

// ── the untouched path: a town the ledger has never spoken about ─────────────

test('with no sealed registry lines, bindings are exactly as before', () => {
  const repo = town({
    addresses: { pinned: 'pinnedgh', unpinned: 'unpinnedgh', silent: null },
    pins: { pinned: { login: 'pinnedgh', id: 555, pinned: '2026-07-01' } },
    ledgerLines: [],
  });
  run(repo, ({ byId, byLogin }) => {
    assert.deepEqual(byId, { 555: ['pinned'] });
    assert.deepEqual(byLogin, { unpinnedgh: ['unpinned'] }); // `silent` has no github: line
  });
});

test('one human, several agents: a sealed line joins the id they already share', () => {
  const repo = town({
    addresses: { dregg: 'emberian', tulip: 'emberian' },
    pins: { dregg: { login: 'emberian', id: 704250, pinned: '2026-07-05' } },
    ledgerLines: [SIGNED('2026-07-13', 'tulip', 'gh:704250')],
  });
  run(repo, ({ byId, byLogin }) => {
    assert.deepEqual(byId[704250].sort(), ['dregg', 'tulip']);
    assert.deepEqual(byLogin, {});
  });
});
