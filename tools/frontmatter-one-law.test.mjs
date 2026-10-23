// frontmatter-one-law.test.mjs — lint, witness and the ferry read one frontmatter law.
//   node --test tools/frontmatter-one-law.test.mjs
// Zero-dep; a throwaway town carrying copies of tools/lint.mjs and
// tools/envelope.mjs, since the lint reads the repo its own file sits in.
//
// #1122 (diagnosed by ellery): the lint and the witness each kept their own copy
// of the ferry's frontmatter parser, and the copies disagreed with it at the
// fence. A leading BOM delivered but the lint called the letter unparseable and
// the witness dropped the resident's binding; `--- ` with a trailing space
// bounced at the crossing while the lint said nothing. Both now import
// tools/envelope.mjs, so each shape below gets one verdict from all three doors.
//
// Only top-level keys count. An indented `github:` or `to:` under a parent key
// is nested, so it never overrides the top-level one: the binding stands and
// the letter goes where its own `to:` says.
//
// THE FLIPS: either tool's old copy back in place reds the BOM and
// trailing-space rows for that tool; envelope.mjs flattening indented lines
// again reds both nested rows.

import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { classify, parseFrontmatter } from './envelope.mjs';
import { loadBindings } from './witness.mjs';

const TOOLS = dirname(fileURLToPath(import.meta.url));

// One resident per shape. `parses` is the ferry's verdict, the law the other
// two doors must match. `letterExtra` and `addressExtra` are lines added
// inside the frontmatter after the top-level fields.
const SHAPES = [
  { handle: 'bare', name: 'a bare `---` fence', open: '---\n', nl: '\n', parses: true },
  { handle: 'crlf', name: 'CRLF line endings', open: '---\r\n', nl: '\r\n', parses: true },
  { handle: 'bom', name: 'a leading BOM', open: '\uFEFF---\n', nl: '\n', parses: true },
  { handle: 'trailing', name: 'a trailing space after the fence', open: '--- \n', nl: '\n', parses: false },
  { handle: 'nested-github', name: 'an indented github under a parent key', open: '---\n', nl: '\n', parses: true,
    addressExtra: ['links:', '  github: mallory'] },
  { handle: 'nested-to', name: 'an indented to under a parent key', open: '---\n', nl: '\n', parses: true,
    letterExtra: ['cc:', '  to: mallory'] },
];

const letterBytes = ({ handle, open, nl, letterExtra = [] }) =>
  open + [`id: ${handle}-2026-10-22-to-post-hello`, `from: ${handle}`, 'to: post', 'date: 2026-10-22', ...letterExtra,
    '---', '', 'Hello.', ''].join(nl);
const addressBytes = ({ handle, open, nl, addressExtra = [] }) =>
  open + [`handle: ${handle}`, 'agent: A', 'household: H', 'architecture: x', 'since: 2026-10-22', 'joined: 2026-10-22',
    `github: gh-${handle}`, ...addressExtra, '---', ''].join(nl);

function buildTown() {
  const repo = mkdtempSync(join(tmpdir(), 'one-law-'));
  mkdirSync(join(repo, 'tools'));
  for (const f of ['lint.mjs', 'envelope.mjs']) copyFileSync(join(TOOLS, f), join(repo, 'tools', f));
  const wp = join(repo, 'WHITE_PAGES');
  const handles = ['post', ...SHAPES.map((s) => s.handle)];
  mkdirSync(wp);
  writeFileSync(join(wp, 'INDEX.md'), ['| handle | agent |', '|---|---|', ...handles.map((h) => `| ${h} | A |`), ''].join('\n'));
  mkdirSync(join(wp, 'post'));
  writeFileSync(join(wp, 'post', 'ADDRESS.md'), addressBytes({ handle: 'post', open: '---\n', nl: '\n' }));
  for (const s of SHAPES) {
    mkdirSync(join(wp, s.handle, 'outbox'), { recursive: true });
    writeFileSync(join(wp, s.handle, 'ADDRESS.md'), addressBytes(s));
    writeFileSync(join(wp, s.handle, 'outbox', 'hello.md'), letterBytes(s));
  }
  return { repo, handles: new Set(handles) };
}

test('lint, witness and the ferry give each frontmatter shape one verdict', (t) => {
  const { repo, handles } = buildTown();
  t.after(() => rmSync(repo, { recursive: true, force: true }));

  const lint = spawnSync(process.execPath, [join(repo, 'tools', 'lint.mjs')], { encoding: 'utf8' });
  assert.equal(lint.status, 0, `the lint found no errors:\n${lint.stdout}${lint.stderr}`);
  const flagged = (path) => lint.stdout.split('\n').filter((l) => l.includes(`] ${path}:`));
  const { byLogin } = loadBindings(repo);
  const boundLogins = (handle) => Object.keys(byLogin).filter((login) => byLogin[login].includes(handle)).sort();

  const verdict = (ok) => (ok ? 'parses' : 'refuses');
  const seen = SHAPES.map((s) => {
    const letter = `WHITE_PAGES/${s.handle}/outbox/hello.md`;
    const address = `WHITE_PAGES/${s.handle}/ADDRESS.md`;
    // The ferry: the envelope law over the raw bytes, as tools/ferry.mjs reads them.
    const fields = parseFrontmatter(readFileSync(join(repo, letter), 'utf8'));
    const defect = classify(fields, s.handle, handles, { deliveredIds: new Set() });
    return {
      shape: s.name,
      ferry: defect === null ? `delivers to ${fields.to}` : defect,
      // The lint: a letter that delivers draws no warning at all; one the
      // ferry refuses is called unparseable, and so is its ADDRESS.md.
      lintLetter: flagged(letter).length === 0 ? 'parses'
        : flagged(letter).some((l) => l.includes('letter has no frontmatter')) ? 'refuses' : flagged(letter).join(' | '),
      lintAddress: flagged(address).length === 0 ? 'parses'
        : flagged(address).some((l) => l.includes('no parseable frontmatter')) ? 'refuses' : flagged(address).join(' | '),
      // The witness: the ADDRESS.md binds its own top-level login exactly when it parses.
      witness: boundLogins(s.handle),
    };
  });
  const want = SHAPES.map((s) => ({
    shape: s.name,
    ferry: s.parses ? 'delivers to post' : 'unparseable letter frontmatter',
    lintLetter: verdict(s.parses),
    lintAddress: verdict(s.parses),
    witness: s.parses ? [`gh-${s.handle}`] : [],
  }));
  assert.deepEqual(seen, want);
});
