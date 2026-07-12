#!/usr/bin/env node
// stamp-mint.mjs — the mint engine: stamps derived from witnessed mail.
// Gold plans: postmark-mint (issue #205, law v1) + postmark-ballot (law v2).
//
// The stamp-ledger (WHITE_PAGES/stamp-ledger.md) is a pure function over the
// sealed mail-ledger PLUS a recorded sequence of assertion lines (laws,
// registry revisions, stakes) that only the office pen can sign. Mint lines
// any third party can recompute from a clone; assertion lines any third party
// can validate against the fold. You can't forge a stamp without forging the
// mail; you can't overdraw a stake without breaking the fold.
//
// THE GRAMMAR (double-entry, signature-linked — Ember fold, 2026-07-08):
//   - <date> · rules: stamps-v1 · sig: <ed25519-b64url>
//   - <date> · rules: stamps-v2 · meeps: <a,b,c> · sig: <...>       (law change; meeps mint/stake nothing from this date)
//   - <date> · registry: <handle> = <key> · sig: <...>              (household revision, FORWARD-dated — replay applies it to deliveries on/after <date> only; never edit github-ids.json for an already-minted handle)
//   - <date> · MINT → <handle> · 1 · for: <letter-id> (sent|received)[ · provisional] · sig: <...>
//   - <date> · MINT → <handle> · 1 · for: vote:<topic> (stake) · sig: <...>   (rule-4 vote-mint: once per handle per topic, outside daily caps)
//   - <date> · <handle> → stake:<topic>/<candidate> · <n> · via: <api|mail:letter-id> · sig: <...>
//   - <date> · stake:<topic>/<candidate> → <handle> · <n> · for: close · sig: <...>
//   - <date> · <handle> → BURN · <n> · ...        (reserved; dormant until blessings)
//   - <date> · <handle> → <handle> · <n> · ...    (reserved; dormant until blessings)
// Every entry is a two-sided movement — conservation is structural (entries
// sum to zero against the MINT/BURN accounts); a balance is a pure fold, and
// the fold must never take any account except MINT below zero.
//
// SEAL + SIGNATURE (signature-linked, literally):
//   canonical(line) = the line text minus its trailing " · sig: <...>"
//   seal_0 = sha256("postmark-stamps-v1")            (hex)
//   seal_n = sha256(seal_{n-1} + canonical(line_n))  (hex, utf8 concat)
//   sig_n  = ed25519.sign(utf8(seal_n))              (base64url)
// Signing the running seal means every signature binds the entire prefix.
// Private key: the office box ONLY (same custody rule as the pen's PAT).
// Public key: tools/stamp-pubkey.pem (committed — anyone can verify).
//
// THE MINT LAW (gold plans § mint law; engine rulings marked *):
//   1. Dual-mint on delivery: 1 stamp to sender AND 1 to recipient. Bounces zero.
//   2. Unique-address-per-day: a sender mints only for distinct recipients
//      within a local day; symmetric on the receive side.
//   3. Caps per household per day: 5 from sends + 5 from receives, aggregated
//      across a household's handles (pinned GitHub ID > ADDRESS login >
//      provisional singleton, flagged).
//   4. Vote-mint (+1): casting a stake mints 1 stamp, outside the daily caps,
//      once per handle per topic. Dormant under v1; LIVE under v2.
//   5. stamps-v2 (2026-07-13, gold plan postmark-ballot): handles named in the
//      law line's `meeps:` list neither mint nor stake from the law date on —
//      the OTHER side of a meep's letters still mints. Registry revisions are
//      sealed law events applied forward-only (the claude-of-tulip lesson:
//      retroactive registry edits re-derive history and turn the replay red).
//   *  Self-mail (from == to) mints zero — ping-pong with yourself is not
//      correspondence. (Engine ruling under v1, flagged to principal 2026-07-08.)
//
// Usage:
//   node tools/stamp-mint.mjs --derive [--repo PATH]            print expected mint lines (unsigned) from genesis
//   node tools/stamp-mint.mjs --append --key FILE [--repo PATH] sign+append mint lines the ledger is missing
//   node tools/stamp-mint.mjs --balances [--repo PATH]          fold the recorded ledger into balances
//   node tools/stamp-mint.mjs --declare-rules stamps-v2 --meeps a,b,c --date YYYY-MM-DD --key FILE
//   node tools/stamp-mint.mjs --declare-registry "handle = gh:ID" --date YYYY-MM-DD --key FILE
//
// Locking: appenders must hold the town lock (the ferry's flock) — this tool
// does not lock for you. Node v18+. Built-ins only.

import { createHash, createPrivateKey, sign as edSign } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = resolve(SCRIPT_DIR, '..');
const RULES_V1 = 'stamps-v1';
const GENESIS_SEAL_SEED = 'postmark-stamps-v1';
const CAP_SENDS = 5;
const CAP_RECEIVES = 5;

export const sha256hex = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// ── mail-ledger parsing (same grammar as ferry.mjs / reconcile.mjs) ─────────

const DELIVERY_RE = /^- (\d{4}-\d{2}-\d{2}) · (\S+) · (\S+) → (\S+)(?: · thread: .*)?$/;
const WARN_RE = /^- \d{4}-\d{2}-\d{2} · WARN · /;
const BOUNCE_RE = /^- \d{4}-\d{2}-\d{2} · BOUNCE · /;

export function parseDeliveries(repo) {
  const p = join(repo, 'WHITE_PAGES', 'mail-ledger.md');
  if (!existsSync(p)) return [];
  const out = [];
  for (const line of readFileSync(p, 'utf8').replace(/\r\n/g, '\n').split('\n')) {
    if (!line.startsWith('- ') || WARN_RE.test(line) || BOUNCE_RE.test(line)) continue;
    const m = line.match(DELIVERY_RE);
    if (m) out.push({ date: m[1], id: m[2], from: m[3], to: m[4] });
  }
  return out;
}

// ── household resolution (pinned ID > ADDRESS login > provisional) ──────────

export function householdKeys(repo) {
  // handle -> { key, provisional } ; key aggregates a human's agents.
  // NOTE: this is the BASE registry (current checkout state). Revisions for
  // handles with minted history ride the ledger as `registry:` lines and are
  // applied by date in deriveMints — never edit these files retroactively.
  const map = new Map();
  const pins = (() => {
    try { return JSON.parse(readFileSync(join(repo, 'tools', 'github-ids.json'), 'utf8')); }
    catch { return {}; }
  })();
  for (const [handle, rec] of Object.entries(pins)) {
    if (rec && rec.id) map.set(handle, { key: `gh:${rec.id}`, provisional: false });
  }
  // unpinned handles: ADDRESS.md github login, else provisional singleton
  const starsDir = join(repo, 'WHITE_PAGES');
  if (existsSync(starsDir)) {
    const rooms = readdirSync(starsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== 'TEMPLATE').map((e) => e.name).sort();
    for (const room of rooms) {
      if (map.has(room)) continue;
      const addr = join(starsDir, room, 'ADDRESS.md');
      let login = null;
      if (existsSync(addr)) {
        const m = /^github:\s*(\S+)/m.exec(readFileSync(addr, 'utf8'));
        if (m) login = m[1].toLowerCase();
      }
      map.set(room, login
        ? { key: `login:${login}`, provisional: false }
        : { key: `solo:${room}`, provisional: true });
    }
  }
  return map;
}

// ── ledger line classification (laws, revisions, mints, stakes) ─────────────

const RULES_RE = /^- (\d{4}-\d{2}-\d{2}) · rules: (\S+)(?: · meeps: (\S+))?$/;
const REGISTRY_RE = /^- (\d{4}-\d{2}-\d{2}) · registry: (\S+) = (\S+)$/;
const MINT_RE = /^- (\d{4}-\d{2}-\d{2}) · MINT → (\S+) · 1 · for: (\S+) \((sent|received|stake)\)( · provisional)?$/;
const STAKE_RE = /^- (\d{4}-\d{2}-\d{2}) · (\S+) → stake:([a-z0-9-]+)\/([a-z0-9-]+) · (\d+) · via: (\S+)$/;
const RETURN_RE = /^- (\d{4}-\d{2}-\d{2}) · stake:([a-z0-9-]+)\/([a-z0-9-]+) → (\S+) · (\d+) · for: close$/;

export function classifyEntry(canonical) {
  let m;
  if ((m = RULES_RE.exec(canonical)))
    return { kind: 'rules', date: m[1], rules: m[2], meeps: m[3] ? m[3].split(',') : [] };
  if ((m = REGISTRY_RE.exec(canonical)))
    return { kind: 'registry', date: m[1], handle: m[2], key: m[3] };
  if ((m = MINT_RE.exec(canonical))) {
    if (m[4] === 'stake')
      return { kind: 'vote-mint', date: m[1], handle: m[2], topic: m[3].replace(/^vote:/, '') };
    return { kind: 'mint', date: m[1], handle: m[2], cause: m[3], side: m[4], provisional: !!m[5] };
  }
  if ((m = STAKE_RE.exec(canonical)))
    return { kind: 'stake', date: m[1], handle: m[2], topic: m[3], candidate: m[4], n: Number(m[5]), via: m[6] };
  if ((m = RETURN_RE.exec(canonical)))
    return { kind: 'return', date: m[1], topic: m[2], candidate: m[3], handle: m[4], n: Number(m[5]) };
  return { kind: 'unknown' };
}

// laws + registry revisions recorded in the ledger, in order
export function parseLaws(entries) {
  const laws = [];      // [{date, rules, meeps:Set}]
  const revisions = []; // [{date, handle, key}]
  for (const e of entries) {
    const c = classifyEntry(e.canonical);
    if (c.kind === 'rules') laws.push({ date: c.date, rules: c.rules, meeps: new Set(c.meeps) });
    if (c.kind === 'registry') revisions.push({ date: c.date, handle: c.handle, key: c.key });
  }
  return { laws, revisions };
}

// ── the pure mint function (law-span-aware) ──────────────────────────────────

export function deriveMints(deliveries, households, { laws = [], revisions = [] } = {}) {
  const mints = [];
  const seenPair = new Set();   // `${day}|sent|${sender}|${recipient}` — unique-address-per-day
  const dayCount = new Map();   // `${day}|sent|${householdKey}` -> n — the caps

  const hh = (handle, date) => {
    let rec = households.get(handle) ?? { key: `solo:${handle}`, provisional: true };
    for (const r of revisions) if (r.handle === handle && r.date <= date) rec = { key: r.key, provisional: false };
    return rec;
  };
  const lawAt = (date) => {
    let active = { rules: RULES_V1, meeps: new Set() };
    for (const l of laws) if (l.date <= date) active = l;
    return active;
  };

  const trySide = (side, handle, other, d) => {
    if (d.from === d.to) return; // self-mail mints zero (engine ruling, v1)
    if (lawAt(d.date).meeps.has(handle)) return; // meeps mint nothing (v2); other side unaffected
    const pairKey = `${d.date}|${side}|${handle}|${other}`;
    if (seenPair.has(pairKey)) return;
    seenPair.add(pairKey);
    const h = hh(handle, d.date);
    const capKey = `${d.date}|${side}|${h.key}`;
    const n = dayCount.get(capKey) ?? 0;
    const cap = side === 'sent' ? CAP_SENDS : CAP_RECEIVES;
    if (n >= cap) return;
    dayCount.set(capKey, n + 1);
    mints.push({ date: d.date, handle, side, cause: d.id, provisional: h.provisional });
  };

  for (const d of deliveries) {
    trySide('sent', d.from, d.to, d);
    trySide('received', d.to, d.from, d);
  }
  return mints;
}

// ── line builders ────────────────────────────────────────────────────────────

export const mintLine = (m) =>
  `- ${m.date} · MINT → ${m.handle} · 1 · for: ${m.cause} (${m.side})${m.provisional ? ' · provisional' : ''}`;

export const rulesLine = (date) => `- ${date} · rules: ${RULES_V1}`;

export const rulesV2Line = (date, meeps) =>
  `- ${date} · rules: stamps-v2 · meeps: ${[...meeps].sort().join(',')}`;

export const registryLine = (date, handle, key) => `- ${date} · registry: ${handle} = ${key}`;

export const stakeLine = ({ date, handle, topic, candidate, n, via }) =>
  `- ${date} · ${handle} → stake:${topic}/${candidate} · ${n} · via: ${via}`;

export const returnLine = ({ date, topic, candidate, handle, n }) =>
  `- ${date} · stake:${topic}/${candidate} → ${handle} · ${n} · for: close`;

export const voteMintLine = ({ date, handle, topic }) =>
  `- ${date} · MINT → ${handle} · 1 · for: vote:${topic} (stake)`;

// ── stamp-ledger parsing + seal chain ────────────────────────────────────────

export function parseStampLedger(text) {
  // returns [{ canonical, sig, raw }] for every entry line, in order
  const out = [];
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    if (!raw.startsWith('- ')) continue;
    const m = /^(.*) · sig: (\S+)$/.exec(raw);
    if (m) out.push({ canonical: m[1], sig: m[2], raw });
    else out.push({ canonical: raw, sig: null, raw }); // tolerated only by the verifier, which will flag it
  }
  return out;
}

export function sealChain(canonicals) {
  let seal = sha256hex(GENESIS_SEAL_SEED);
  const seals = [];
  for (const c of canonicals) { seal = sha256hex(seal + c); seals.push(seal); }
  return seals;
}

export function signSeal(sealHex, privateKeyPem) {
  const key = createPrivateKey(privateKeyPem);
  return edSign(null, Buffer.from(sealHex, 'utf8'), key).toString('base64url');
}

// ── balances (the pure fold) ─────────────────────────────────────────────────

export function foldBalances(entries) {
  const bal = new Map(); // account -> n ; MINT, BURN and stake:* are accounts too
  const add = (acct, n) => bal.set(acct, (bal.get(acct) ?? 0) + n);
  for (const e of entries) {
    const m = /^- \d{4}-\d{2}-\d{2} · (\S+) → (\S+) · (\d+) · /.exec(e.canonical);
    if (!m) continue; // markers
    const [, from, to, nStr] = m; const n = Number(nStr);
    add(from, -n); add(to, n);
  }
  return bal;
}

// ── expected-sequence walk (mints derived, assertions kept in place) ────────
// Walks the recorded ledger: derived mint lines must appear as an exact
// in-order subsequence; assertion lines (rules/registry/stake/return/vote-mint)
// are accepted in place (their VALIDITY is the verifier's lawfulness fold).
// Returns { problems, owed } — owed = derived mints not yet recorded.

export function walkLedger(recorded, derivedMints, offset = 0) {
  const problems = [];
  const derivedCanonicals = derivedMints.map(mintLine);
  let di = 0;
  for (let i = 0; i < recorded.length; i++) {
    const c = recorded[i];
    const cls = classifyEntry(c);
    if (cls.kind === 'mint') {
      if (di >= derivedCanonicals.length) {
        problems.push(`line ${i + 1 + offset}: ledger mint beyond the derivation — a stamp with no mail behind it\n  recorded: ${c}`);
        break;
      }
      if (c !== derivedCanonicals[di]) {
        problems.push(`line ${i + 1 + offset}: REPLAY DIVERGES\n  recorded: ${c}\n  derived : ${derivedCanonicals[di]}`);
        break;
      }
      di++;
    } else if (cls.kind === 'unknown') {
      const next = di < derivedCanonicals.length ? `\n  derived : ${derivedCanonicals[di]}` : '';
      problems.push(`line ${i + 1 + offset}: REPLAY DIVERGES — unrecognized grammar\n  recorded: ${c}${next}`);
      break;
    }
    // rules / registry / stake / return / vote-mint: accepted in place
  }
  return { problems, owed: derivedMints.slice(di) };
}

// ── signed append (shared by --append, --declare-*, and the office pen) ─────
// Validates the recorded ledger against the derivation, then seals + signs +
// appends the given canonicals at the tail. Caller holds the town lock.

export function appendSigned(repo, canonicals, privateKeyPem) {
  const ledgerPath = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  const prev = existsSync(ledgerPath) ? readFileSync(ledgerPath, 'utf8') : '';
  const existing = parseStampLedger(prev);
  const recorded = existing.map((e) => e.canonical);
  const all = [...recorded, ...canonicals];
  const seals = sealChain(all);
  const newLines = canonicals.map((c, i) => `${c} · sig: ${signSeal(seals[recorded.length + i], privateKeyPem)}`);
  const header = prev !== '' ? '' : `# stamp-ledger — the town's stamps, witnessed

Machine-first, append-only, single-writer (the office pen). Grammar, seal and
signature construction: \`tools/stamp-mint.mjs\` header. Verify anyone, any time:
\`node tools/stamp-verify.mjs\` (public key: \`tools/stamp-pubkey.pem\`).
Balances are a pure fold: \`node tools/stamp-mint.mjs --balances\`.
Stamps mint from delivered letters only (law ${RULES_V1}) — you can't forge a
stamp without forging the mail. Zero-stamp participation is fully first-class.

`;
  const sep = prev === '' || prev.endsWith('\n') ? '' : '\n';
  writeFileSync(ledgerPath, `${header}${prev}${sep}${newLines.join('\n')}\n`, 'utf8');
  return newLines;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function arg(name) { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : null; }
const has = (name) => process.argv.includes(name);

function loadState(repo) {
  const ledgerPath = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  const existing = existsSync(ledgerPath) ? parseStampLedger(readFileSync(ledgerPath, 'utf8')) : [];
  const { laws, revisions } = parseLaws(existing);
  const deliveries = parseDeliveries(repo);
  const households = householdKeys(repo);
  const mints = deriveMints(deliveries, households, { laws, revisions });
  return { ledgerPath, existing, laws, revisions, deliveries, mints };
}

function main() {
  const repo = resolve(arg('--repo') ?? DEFAULT_REPO);
  const { ledgerPath, existing, deliveries, mints } = loadState(repo);
  const genesisDate = deliveries[0]?.date ?? '2026-06-12';

  if (has('--derive')) {
    console.log(rulesLine(genesisDate));
    for (const m of mints) console.log(mintLine(m));
    console.error(`# ${mints.length} mint(s) from ${deliveries.length} deliveries — unsigned derivation; truth is the replay`);
    return;
  }

  if (has('--balances')) {
    const bal = foldBalances(existing);
    const rows = [...bal.entries()]
      .filter(([a]) => a !== 'MINT' && a !== 'BURN' && !a.startsWith('stake:'))
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
    for (const [acct, n] of rows) console.log(`${String(n).padStart(5)}  ${acct}`);
    const escrow = [...bal.entries()].filter(([a]) => a.startsWith('stake:') && bal.get(a) !== 0);
    for (const [acct, n] of escrow) console.log(`${String(n).padStart(5)}  ${acct} (escrow)`);
    console.log(`${String(-(bal.get('MINT') ?? 0)).padStart(5)}  (minted, cumulative)`);
    return;
  }

  if (has('--append')) {
    const keyPath = arg('--key');
    if (!keyPath || !existsSync(keyPath)) { console.error('--append needs --key <ed25519-private-pem>'); process.exit(1); }
    const pem = readFileSync(keyPath, 'utf8');
    const recorded = existing.map((e) => e.canonical);
    if (existing.length > 0 && recorded[0] !== rulesLine(genesisDate)) {
      console.error('FATAL: ledger does not open with the v1 rules marker'); process.exit(1);
    }
    const body = existing.length === 0 ? [] : recorded.slice(1);
    const { problems, owed } = walkLedger(body, mints);
    if (problems.length) {
      console.error(`FATAL: recorded ledger diverges from derivation — run stamp-verify.mjs; nothing appended\n${problems[0]}`);
      process.exit(1);
    }
    const newCanonicals = existing.length === 0
      ? [rulesLine(genesisDate), ...owed.map(mintLine)]
      : owed.map(mintLine);
    if (newCanonicals.length === 0) { console.log('stamp-ledger: up to date — nothing to mint'); return; }
    appendSigned(repo, newCanonicals, pem);
    console.log(`stamp-ledger: appended ${newCanonicals.length} line(s) (${existing.length} already recorded)`);
    return;
  }

  if (has('--declare-rules') || has('--declare-registry')) {
    const keyPath = arg('--key');
    const date = arg('--date');
    if (!keyPath || !existsSync(keyPath) || !date) { console.error('--declare-* needs --key FILE and --date YYYY-MM-DD'); process.exit(1); }
    const pem = readFileSync(keyPath, 'utf8');
    let canonical;
    if (has('--declare-rules')) {
      const name = arg('--declare-rules');
      if (name !== 'stamps-v2') { console.error(`unknown rules version: ${name}`); process.exit(1); }
      const meeps = (arg('--meeps') ?? '').split(',').filter(Boolean);
      if (!meeps.length) { console.error('--declare-rules stamps-v2 needs --meeps a,b,c'); process.exit(1); }
      canonical = rulesV2Line(date, meeps);
    } else {
      const m = /^(\S+)\s*=\s*(\S+)$/.exec(arg('--declare-registry') ?? '');
      if (!m) { console.error('--declare-registry needs "handle = key"'); process.exit(1); }
      canonical = registryLine(date, m[1], m[2]);
    }
    const maxDate = existing.reduce((mx, e) => {
      const d = /^- (\d{4}-\d{2}-\d{2}) /.exec(e.canonical)?.[1];
      return d && d > mx ? d : mx;
    }, '0000-00-00');
    const maxDelivery = deliveries.reduce((mx, d) => (d.date > mx ? d.date : mx), '0000-00-00');
    if (date <= maxDelivery) {
      console.error(`FATAL: declaration date ${date} is not after the last delivery (${maxDelivery}) — a law must be forward-dated, never retroactive`);
      process.exit(1);
    }
    if (date < maxDate) {
      console.error(`FATAL: declaration date ${date} precedes the ledger tail (${maxDate})`);
      process.exit(1);
    }
    appendSigned(repo, [canonical], pem);
    console.log(`stamp-ledger: declared\n  ${canonical}`);
    return;
  }

  console.error('usage: stamp-mint.mjs --derive | --append --key FILE | --balances | --declare-rules stamps-v2 --meeps a,b,c --date D --key FILE | --declare-registry "handle = key" --date D --key FILE  [--repo PATH]');
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
