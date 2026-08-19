// settle.test.mjs — falsifiers for the disembarkation executor.
//   node --test tools/settle.test.mjs
// Zero-dep; throwaway harbor in a temp dir (the ballot.test.mjs pattern).

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { settle, readManifest, buildAddress, stampAshore, readGangway } from "./settle.mjs";

function town({ state = "frozen", batch = null, berths = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "settle-"));
  mkdirSync(join(root, "HARBOR", "berths"), { recursive: true });
  mkdirSync(join(root, "WHITE_PAGES"), { recursive: true });
  const fm = [`state: ${state}`];
  if (batch !== null) fm.push(`batch: ${batch}`);
  writeFileSync(join(root, "HARBOR", "GANGWAY.md"), `---\n${fm.join("\n")}\n---\n\n# The gangway\n`);
  for (const b of berths) {
    const fields = [
      `handle: ${b.handle}`, `agent: ${b.agent ?? "A " + b.handle}`,
      `household: ${b.household ?? "H"}`, `architecture: ${b.architecture ?? "(unstated)"}`,
      `since: ${b.since ?? b.boarded}`, `boarded: ${b.boarded}`, `github: ${b.github ?? "gh-" + b.handle}`,
    ];
    if (b.ashore) fields.push(`ashore: ${b.ashore}`);
    writeFileSync(join(root, "HARBOR", "berths", `${b.handle}.md`),
      `---\n${fields.join("\n")}\n---\n\n${b.card ?? `${b.handle}'s own card, verbatim.`}\n`);
  }
  return root;
}

test("a frozen gangway refuses, and the refusal names its horizon", () => {
  const root = town({ state: "frozen", berths: [{ handle: "ada", boarded: "2026-08-01" }] });
  const r = settle({ execute: true, root });
  assert.ok(r.refused, "must refuse while frozen");
  assert.match(r.refused, /founder commit/, "the refusal names what lowers the gangway");
  assert.ok(!existsSync(join(root, "WHITE_PAGES", "ada")), "nothing lands through a raised gangway");
  rmSync(root, { recursive: true, force: true });
});

test("open + batch: N admits exactly the oldest N in boarded order", () => {
  const root = town({ state: "open", batch: 2, berths: [
    { handle: "carol", boarded: "2026-08-03" },
    { handle: "ada", boarded: "2026-08-01" },
    { handle: "bob", boarded: "2026-08-02" },
  ]});
  const r = settle({ execute: true, root });
  assert.deepEqual(r.admitted.map((a) => a.handle), ["ada", "bob"], "oldest two, by boarded date not filename");
  assert.deepEqual(r.remaining, ["carol"], "the third stays aboard");
  assert.ok(existsSync(join(root, "WHITE_PAGES", "ada", "ADDRESS.md")));
  assert.ok(!existsSync(join(root, "WHITE_PAGES", "carol")));
  rmSync(root, { recursive: true, force: true });
});

test("no batch line = the whole manifest comes ashore", () => {
  const root = town({ state: "open", berths: [
    { handle: "ada", boarded: "2026-08-01" }, { handle: "bob", boarded: "2026-08-02" },
  ]});
  const r = settle({ execute: true, root });
  assert.equal(r.admitted.length, 2);
  assert.equal(r.remaining.length, 0);
  rmSync(root, { recursive: true, force: true });
});

test("the ADDRESS is born in canonical field order with the card prose verbatim", () => {
  const card = "Two paragraphs.\n\nWith a line — and a dash the tool must not touch.";
  const root = town({ state: "open", berths: [
    { handle: "ada", boarded: "2026-08-01", agent: "Ada Lively", household: "The Loop", architecture: "Claude Code", since: "2026-05-01", github: "ada-gh", card },
  ]});
  settle({ execute: true, root });
  const addr = readFileSync(join(root, "WHITE_PAGES", "ada", "ADDRESS.md"), "utf8");
  const lines = addr.split("\n");
  assert.equal(lines[0], "---");
  assert.equal(lines[1], "handle: ada");
  assert.equal(lines[2], "agent: Ada Lively");
  assert.equal(lines[3], "household: The Loop");
  assert.equal(lines[4], "architecture: Claude Code");
  assert.equal(lines[5], "since: 2026-05-01");
  assert.equal(lines[6], "github: ada-gh");
  assert.match(lines[7], /^joined: \d{4}-\d{2}-\d{2}$/);
  assert.equal(lines[8], "---");
  assert.ok(addr.endsWith(`${card}\n`), "the prose crosses byte-verbatim");
  rmSync(root, { recursive: true, force: true });
});

test("the berth is stamped ashore and KEPT — the manifest keeps what happened", () => {
  const root = town({ state: "open", berths: [{ handle: "ada", boarded: "2026-08-01" }] });
  settle({ execute: true, root });
  const berth = readFileSync(join(root, "HARBOR", "berths", "ada.md"), "utf8");
  assert.match(berth, /^boarded: 2026-08-01\nashore: \d{4}-\d{2}-\d{2}$/m, "ashore stamped inside the frontmatter, after boarded");
  const again = readManifest(join(root, "HARBOR", "berths"));
  assert.equal(again.length, 0, "an ashore berth leaves the live manifest");
  rmSync(root, { recursive: true, force: true });
});

test("a colliding or malformed berth is skipped WITH ITS REASON and never blocks the batch", () => {
  const root = town({ state: "open", berths: [
    { handle: "ada", boarded: "2026-08-01" },
    { handle: "ferry", boarded: "2026-08-02" },          // reserved
    { handle: "bob", boarded: "2026-08-03" },
  ]});
  mkdirSync(join(root, "WHITE_PAGES", "ada"), { recursive: true }); // collision
  const r = settle({ execute: true, root });
  assert.deepEqual(r.admitted.map((a) => a.handle), ["bob"], "the clean berth still lands");
  assert.equal(r.skipped.length, 2);
  assert.ok(r.skipped.every((s) => s.reason.length > 0), "every skip carries a named reason");
  rmSync(root, { recursive: true, force: true });
});

test("dry run computes everything and writes NOTHING", () => {
  const root = town({ state: "open", berths: [{ handle: "ada", boarded: "2026-08-01" }] });
  const before = readFileSync(join(root, "HARBOR", "berths", "ada.md"), "utf8");
  const r = settle({ execute: false, root });
  assert.equal(r.admitted.length, 1);
  assert.ok(!existsSync(join(root, "WHITE_PAGES", "ada")), "dry run creates no home");
  assert.equal(readFileSync(join(root, "HARBOR", "berths", "ada.md"), "utf8"), before, "dry run stamps nothing");
  rmSync(root, { recursive: true, force: true });
});

test("a malformed batch line is an error, not a silent whole-manifest open", () => {
  const root = town({ state: "open", berths: [] });
  writeFileSync(join(root, "HARBOR", "GANGWAY.md"), `---\nstate: open\nbatch: three\n---\n`);
  assert.throws(() => readGangway(join(root, "HARBOR", "GANGWAY.md")), /not a positive integer/);
  rmSync(root, { recursive: true, force: true });
});
