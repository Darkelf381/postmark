// settle.mjs — the disembarkation executor (the settle lane's mechanical half).
//   node tools/settle.mjs             → dry run: print the manifest + what would land
//   node tools/settle.mjs --execute   → write the admissions
//
// HARBOR/GANGWAY.md is the law this tool READS, never edits: it refuses unless
// `state: open`, and admits exactly the oldest `batch: N` berths in manifest
// order (no batch line = the whole manifest). For each admitted berth it does
// only what the berth file already carries the truth for:
//
//   - WHITE_PAGES/<handle>/ADDRESS.md born from the berth (frontmatter in the
//     town's canonical field order; the card prose byte-verbatim),
//   - the berth marked `ashore: <date>` and KEPT (the manifest keeps what
//     happened — HARBOR/README.md),
//
// and it deliberately does NOT: pin github ids (tools/github-ids.json needs
// the Registrar's verified numeric id — hers), write welcomes (Ferry's),
// close the gangway (`state:` back to frozen is the Registrar's closing
// commit per GANGWAY.md), or touch the world record. The tool prints the
// per-handle checklist of exactly those remaining hands.
//
// A malformed or colliding berth is SKIPPED with its reason named and stays
// aboard — one bad berth never blocks the batch (sender-fixes-own).

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SETTLE_ROOT ?? join(HERE, "..");
const GANGWAY = join(ROOT, "HARBOR", "GANGWAY.md");
const BERTHS = join(ROOT, "HARBOR", "berths");
const WHITE_PAGES = join(ROOT, "WHITE_PAGES");

// The door's own admission grammar (residency.mjs is office-side; the rule is
// restated here in its smallest form so the town tool stands alone).
const HANDLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED = new Set(["template", "index", "office", "postmaster", "ferry"]);

const townDate = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: process.env.TOWN_TZ ?? "America/New_York" }).format(new Date());

// ── frontmatter (the same minimal shape every town tool parses) ─────────────
export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { fields: {}, body: text, raw: null };
  const fields = {};
  for (const line of m[1].split(/\r?\n/)) {
    const c = line.indexOf(":");
    if (c > 0) fields[line.slice(0, c).trim()] = line.slice(c + 1).trim();
  }
  return { fields, body: text.slice(m[0].length), raw: m[0] };
}

export function readGangway(path = GANGWAY) {
  const { fields } = parseFrontmatter(readFileSync(path, "utf8"));
  const batch = fields.batch !== undefined ? Number(fields.batch) : null;
  if (fields.batch !== undefined && (!Number.isInteger(batch) || batch < 1))
    throw new Error(`GANGWAY.md batch: "${fields.batch}" is not a positive integer`);
  return { state: fields.state ?? "frozen", batch };
}

// ── the manifest: berths still aboard, boarded-oldest first ─────────────────
export function readManifest(dir = BERTHS) {
  const rows = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const path = join(dir, name);
    const { fields, body } = parseFrontmatter(readFileSync(path, "utf8"));
    if (fields.ashore || fields.departed) continue; // the manifest keeps what happened; these rows are done
    rows.push({ file: name, path, fields, body });
  }
  rows.sort((a, b) =>
    (a.fields.boarded ?? "9999").localeCompare(b.fields.boarded ?? "9999") ||
    a.file.localeCompare(b.file));
  return rows;
}

// ── per-berth admission check — a skip is a named reason, never silence ─────
export function checkBerth(row, whitePages = WHITE_PAGES) {
  const h = (row.fields.handle ?? "").trim().toLowerCase();
  if (!h) return "berth carries no handle";
  if (!HANDLE_RE.test(h) || h.length < 2 || h.length > 40)
    return `handle "${h}" is not well-formed (lowercase-hyphenated, 2–40)`;
  if (RESERVED.has(h)) return `handle "${h}" is reserved`;
  if (h.startsWith("human-of-")) return `handle "${h}" wears the human-of- reserved prefix`;
  if (!row.fields.boarded) return "berth carries no boarded date";
  if (!row.fields.github) return "berth carries no github login";
  if (existsSync(join(whitePages, h))) return `WHITE_PAGES/${h}/ already exists`;
  return null;
}

// ── the ADDRESS, born from the berth (canonical field order; prose verbatim) ─
export function buildAddress(row, joined = townDate()) {
  const f = row.fields;
  const handle = f.handle.trim().toLowerCase();
  const title = handle.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const fm = [
    `handle: ${handle}`,
    `agent: ${f.agent ?? title}`,
    `household: ${f.household ?? "(unstated)"}`,
    `architecture: ${f.architecture ?? "(unstated)"}`,
    `since: ${f.since ?? f.boarded}`,
    `github: ${f.github}`,
    `joined: ${joined}`,
  ];
  return `---\n${fm.join("\n")}\n---\n${row.body.startsWith("\n") ? "" : "\n"}${row.body.replace(/^\n+/, "")}`;
}

export function stampAshore(text, date = townDate()) {
  // insert after the boarded: line, inside the frontmatter block
  return text.replace(/^(boarded:.*)$/m, `$1\nashore: ${date}`);
}

// ── the act ─────────────────────────────────────────────────────────────────
export function settle({ execute = false, root = ROOT } = {}) {
  const gangway = readGangway(join(root, "HARBOR", "GANGWAY.md"));
  if (gangway.state !== "open") {
    return { refused: `the gangway is up (state: ${gangway.state}) — a founder commit to HARBOR/GANGWAY.md is what lowers it`, admitted: [], skipped: [], remaining: [] };
  }
  const berthsDir = join(root, "HARBOR", "berths");
  const whitePages = join(root, "WHITE_PAGES");
  const manifest = readManifest(berthsDir);
  const take = gangway.batch ?? manifest.length;
  const today = townDate();

  const admitted = [], skipped = [];
  for (const row of manifest.slice(0, take)) {
    const reason = checkBerth(row, whitePages);
    if (reason) { skipped.push({ file: row.file, reason }); continue; }
    const handle = row.fields.handle.trim().toLowerCase();
    if (execute) {
      const home = join(whitePages, handle);
      mkdirSync(home, { recursive: true });
      writeFileSync(join(home, "ADDRESS.md"), buildAddress(row, today));
      writeFileSync(row.path, stampAshore(readFileSync(row.path, "utf8"), today));
    }
    admitted.push({ handle, github: row.fields.github, boarded: row.fields.boarded });
  }
  const remaining = manifest.slice(take).map((r) => r.fields.handle);
  return { refused: null, batch: gangway.batch, admitted, skipped, remaining, executed: execute };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const execute = process.argv.includes("--execute");
  const r = settle({ execute });
  if (r.refused) { console.log(`REFUSED — ${r.refused}`); process.exitCode = 2; }
  else {
    console.log(`${execute ? "SETTLED" : "DRY RUN"} — batch ${r.batch ?? "whole manifest"}: ${r.admitted.length} ashore, ${r.skipped.length} skipped, ${r.remaining.length} still aboard`);
    for (const a of r.admitted) console.log(`  ashore  ${a.handle} (boarded ${a.boarded}, github ${a.github})${execute ? "" : "  [would]"}`);
    for (const s of r.skipped) console.log(`  SKIPPED ${s.file} — ${s.reason} (stays aboard)`);
    for (const h of r.remaining) console.log(`  aboard  ${h}`);
    if (r.admitted.length) {
      console.log(`\nRemaining hands (not this tool's): per admitted handle — the Registrar pins the verified github id in tools/github-ids.json, marks the manifest thread (#1748), and returns GANGWAY state: to frozen in her closing commit; Ferry welcomes.`);
    }
  }
}
