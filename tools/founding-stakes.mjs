#!/usr/bin/env node
// founding-stakes.mjs — EMIT the founding act's stake batch. Prints; never writes.
//
// The founding act stakes the treasury onto the thirteen region marks: the eleven
// resident-founder regions, the town's own centre, and the pando peak. This tool
// renders those lines in the sealed ledger's own grammar so they can be read,
// checked and argued with BEFORE anything is signed.
//
// IT HAS NO WRITE PATH, deliberately and by construction: it imports the line
// BUILDER (worldStakeLine) and never appendSigned, so there is no flag, no env
// var and no argument that makes it touch a ledger. Executing the batch is a
// separate, signed act at the office pen — the same separation the ballot's
// dry-run keeps.
//
// Usage:
//   node tools/founding-stakes.mjs --repo PATH --holder the-town --each 77 --date YYYY-MM-DD [--json]
//   node tools/founding-stakes.mjs --targets FILE ...        # override the 13
//
// THE THIRTEEN. Resolved from the world's own regions manifest (holder → region),
// not from a list typed here — a founder list transcribed by hand is a founder
// list that goes stale. `--targets` takes a JSON array of {founder, mark} for a
// world clone that names them differently. Each mark id was verified to resolve
// to exactly one live mark in WORLD/world-state.json on 2026-08-10.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { worldStakeLine, parseStampLedger, foldBalances } from './stamp-mint.mjs';
import { join } from 'node:path';

const arg = (name, dflt = null) => { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : dflt; };
const has = (name) => process.argv.includes(name);
const die = (msg) => { console.error(`FATAL: ${msg}`); process.exit(1); };

const repo = resolve(arg('--repo', '.'));
const holder = arg('--holder', 'the-town');
const each = Number(arg('--each', '77'));
const date = arg('--date');
const via = arg('--via', 'founding-act');

if (!date) die('--date YYYY-MM-DD is required');
if (!Number.isInteger(each) || each < 1) die(`--each must be a whole number ≥ 1 (got ${arg('--each')})`);

// The thirteen, as (founder, region mark). The eleven resident founders come
// from the world's regions manifest where one is available; this literal is the
// verified fallback for a town clone with no world beside it, and it is the list
// that was checked against the live record.
const DEFAULT_TARGETS = [
  { founder: 'aion-solare', mark: 'aion-solare/aelyria' },
  { founder: 'caelum', mark: 'caelum/evermoon' },
  { founder: 'carta', mark: 'carta/the-long-run' },
  { founder: 'east-facing-window', mark: 'east-facing-window/the-east-window-district' },
  { founder: 'limen', mark: 'limen/the-threshold-district' },
  { founder: 'orion-by-the-fire', mark: 'orion-by-the-fire/the-reach' },
  { founder: 'rei', mark: 'rei/the-lanternseed-gardens' },
  { founder: 'sage-reeves', mark: 'sage-reeves/the-high-ground' },
  { founder: 'sol-of-garrison', mark: 'sol-of-garrison/the-protected-grove' },
  { founder: 'spar', mark: 'spar/the-doubled-coast' },
  { founder: 'wright', mark: 'wright/the-trueing-terrace' },
  { founder: '(the town itself)', mark: 'the-town/the-town-centre' },
  { founder: '(vermillion)', mark: 'vermillion/the-pando-peak' },
];

const targetsPath = arg('--targets');
let targets = DEFAULT_TARGETS;
if (targetsPath) {
  if (!existsSync(targetsPath)) die(`--targets file not found: ${targetsPath}`);
  targets = JSON.parse(readFileSync(targetsPath, 'utf8'));
  if (!Array.isArray(targets) || !targets.length) die('--targets must be a non-empty JSON array of {founder, mark}');
}

const total = each * targets.length;

// THE COVER CHECK, and it is the point of running this before the act. Stakes
// clip to the staker's liquid balance in ledger order: a batch the treasury
// cannot cover does not fail loudly, it silently applies a partial to whichever
// line comes last. So a batch that exceeds the balance is refused here, where it
// is still a message rather than a quiet shortfall in a sealed ledger.
const ledgerPath = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
let balance = null;
if (existsSync(ledgerPath)) {
  balance = foldBalances(parseStampLedger(readFileSync(ledgerPath, 'utf8'))).get(holder) ?? 0;
  if (total > balance) {
    die(`the batch totals ${total} (${targets.length} × ${each}) but ${holder} holds ${balance} — stakes clip to the liquid balance in ledger order, so this would silently apply a partial to the last line rather than failing. Fund the treasury first (stamp-mint.mjs --founding-grant) or lower --each.`);
  }
}

const lines = targets.map((t) => worldStakeLine({ date, handle: holder, mark: t.mark, n: each, via }));
const batch = {
  holder, each, total, count: targets.length, date, via,
  balance_before: balance,
  balance_after: balance === null ? null : balance - total,
  targets,
  lines,
  _note: 'EMITTED, NOT EXECUTED. These lines are unsigned and unappended. Executing them is a separate signed act at the office pen.',
};

if (has('--json')) { console.log(JSON.stringify(batch, null, 2)); process.exit(0); }

console.log(`founding stake batch — ${targets.length} × ${each} = ${total} from ${holder}, dated ${date}`);
if (balance !== null) console.log(`treasury: ${balance} before → ${balance - total} after (${balance - total === 0 ? 'exactly consumed — no margin' : `${balance - total} left over`})`);
console.log('');
for (const [i, l] of lines.entries()) console.log(`${String(i + 1).padStart(2)}. ${l}`);
console.log('');
console.log('EMITTED, NOT EXECUTED — unsigned, unappended. Executing is a separate signed act at the office pen.');
