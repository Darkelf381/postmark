#!/usr/bin/env node
// illuminate.mjs — the Illuminator's instrument.
//
// Drives codex's built-in `image_gen` tool headless and harvests the PNG it
// produces. One prompt file in, one image file out. The judgment — writing a
// faithful prompt from a resident's words, and LOOKING at the result before
// it enters a letter — is the Illuminator's, not this script's.
//
// Usage:
//   node illuminate.mjs <promptFile> <outPath>     generate one image
//   node illuminate.mjs --check                    verify the instrument works (no generation)
//
// Two codex-on-Windows quirks this script exists to absorb (verified 2026-07-01):
//   1. The prompt must be piped via STDIN — a positional prompt arg hangs codex
//      on "Reading additional input from stdin".
//   2. codex's sandboxed shell cannot copy its own output ("windows sandbox:
//      spawn setup refresh"), so the PNG lands under
//      C:/Users/<user>/.codex/generated_images/<uuid>/ig_*.png with an opaque
//      name. We snapshot that tree before the run and harvest what's new after.
//
// Machine-local by design (needs the codex CLI + its flat-monthly auth).
// No secrets in this file. Node built-ins only.

import { spawnSync, execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync, copyFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, tmpdir } from 'node:os';

const GENERATED = join(homedir(), '.codex', 'generated_images');
const TIMEOUT_MS = 10 * 60 * 1000; // codex generation runs a few minutes; 10 is generous
// The engine's image_gen tool is model-gated. The config default drifts (gpt-5.5,
// current default, reports NO-IMAGE-CAPABILITY; gpt-5.4 exposes image_gen — the
// model the birth-day verification and this office's first renders ran under).
// Pin image runs to a known-good model here, scoped to this instrument only, so
// the machine's global default is left untouched. Override with ILLUMINATE_MODEL.
const MODEL = process.env.ILLUMINATE_MODEL || 'gpt-5.4';

function log(m) { process.stdout.write(m + '\n'); }
function fail(m) { process.stderr.write('illuminate: ' + m + '\n'); process.exit(1); }

// every image file under GENERATED, flat, with mtimes
function snapshotImages() {
  const out = new Map();
  if (!existsSync(GENERATED)) return out;
  for (const sub of readdirSync(GENERATED)) {
    const dir = join(GENERATED, sub);
    let entries;
    try { entries = statSync(dir).isDirectory() ? readdirSync(dir) : []; } catch { continue; }
    for (const f of entries) {
      const p = join(dir, f);
      try { out.set(p, statSync(p).mtimeMs); } catch { /* races are fine */ }
    }
  }
  return out;
}

const args = process.argv.slice(2);

if (args[0] === '--check') {
  let version;
  try { version = execSync('codex --version', { encoding: 'utf8' }).trim(); }
  catch { fail('codex CLI not found on PATH — the instrument needs it'); }
  log(`codex: ${version}`);
  log(`model: ${MODEL} (image_gen is model-gated; override with ILLUMINATE_MODEL)`);
  log(`harvest dir: ${GENERATED} (${existsSync(GENERATED) ? 'exists' : 'will be created by codex on first generation'})`);
  log('check: OK (no generation attempted — a real run is the true test)');
  process.exit(0);
}

const [promptFile, outPath] = args;
if (!promptFile || !outPath) fail('usage: node illuminate.mjs <promptFile> <outPath> | --check');
if (!existsSync(promptFile)) fail(`prompt file not found: ${promptFile}`);

const userPrompt = readFileSync(promptFile, 'utf8').trim();
if (!userPrompt) fail('prompt file is empty');

// The wrapper instruction: a NATURAL raster-generation request. codex now routes
// image gen through its built-in `imagegen` skill; an over-rigid wrapper that
// demanded a "NO-IMAGE-CAPABILITY" sentinel made the model take that escape
// branch instead of generating (verified 2026-07-01 — a plain request succeeds,
// the sentinel-laden one fails). So: ask plainly, note the file needn't be copied
// (the sandbox can't, and harvesting is external), and let the harvest-diff below
// be the real success check — a new PNG means success, none means failure.
const fullPrompt = `Generate a raster image with your built-in image generation tool from the description below. Generate it directly — you do not need to copy or move the output file anywhere; that harvesting is handled outside this session. Do not substitute ASCII art, SVG, or a placeholder; if you genuinely cannot generate a raster image, say so plainly and why.\n\nDescription:\n${userPrompt}`;

const before = snapshotImages();
const scratch = mkdtempSync(join(tmpdir(), 'illuminate-'));

log('illuminate: generating (codex image_gen, a few minutes)...');
const run = spawnSync('codex', ['exec', '-m', MODEL, '--skip-git-repo-check', '--sandbox', 'workspace-write', '--cd', scratch, '-'], {
  input: fullPrompt,
  encoding: 'utf8',
  timeout: TIMEOUT_MS,
  shell: true, // codex is a .cmd shim on Windows
});

if (run.error) fail(`codex spawn failed: ${run.error.message}`);
const output = (run.stdout || '') + (run.stderr || '');
// Success/failure is decided by the harvest-diff below (a new PNG appeared or it
// didn't), not by parsing prose — the model's phrasing is not a stable contract.

// harvest: newest image file that did not exist (or was rewritten) since the snapshot
const after = snapshotImages();
let newest = null;
for (const [p, mtime] of after) {
  if (before.has(p) && before.get(p) === mtime) continue;
  if (!newest || mtime > newest.mtime) newest = { p, mtime };
}
if (!newest) {
  fail(`no new image appeared under ${GENERATED} — codex output tail:\n` + output.slice(-600));
}

mkdirSync(dirname(outPath), { recursive: true });
copyFileSync(newest.p, outPath);
const size = statSync(outPath).size;
log(`illuminate: harvested ${newest.p}`);
log(`illuminate: wrote ${outPath} (${(size / 1024 / 1024).toFixed(2)} MB)`);
if (size < 10_000) log('illuminate: WARNING — suspiciously small file; look at it before trusting it');
log('illuminate: now LOOK at it before it enters a letter. That part is yours.');
