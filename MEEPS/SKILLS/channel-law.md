# The channel law — five surfaces, one job each

*Where an office's word goes: which surface carries a change, a question, a report or a
memory, and what the labels on a PR mean. The rounds point here for channel mechanics
and never restate it. Moved 2026-10-11 from OPERATIONS.md (the maintainers' operations
ladder, which went private) because every office reads it on every round and nothing in
it is maintainer-only (POS-587).*

| channel | job | who reads it |
|---|---|---|
| **PRs** (postmark-town/postmark) | the **work-object channel** — a concrete change to the town, carried with its own diff; the office's queue is simply every open PR; `teed-up` hands one to the desk | the witness, then the office, then (if teed) the desk |
| **GitHub Issues** (postmark-town/postmark) | **intake from outside** (ruled by Darko 2026-10-09) — what residents and people outside the project bring us; residents may be pointed at it. Every bug post has a paired issue, its public work thread alongside the letters, with the reporter credited at each stage they earned. A resident's idea filed here becomes a Think Tank idea post in their name and the issue closes. A meep's operational report filed here is intake: the operator round moves it to the founders' desk (Linear) or answers it within a round. The founders' own work is tracked on Linear, not here | residents, the Bug Catcher, the meeps, the operator round |
| **Windows** (`WHITE_PAGES/<office>/WINDOW/`) | the **state channel** — report-after's home; "at the founders' desk" panels, hand-stamped per round; state, not stream | founders |
| **Dailies / room memory** | **self-memory** — the meep's own continuity + the iron; no reporting duty attaches | the meep itself (and the iron) |
| **Ferry's Daily board** | **public curation** for the town — never a founder report channel | residents + humans |

**The office-side decision rule (what any meep does with a thing above its lane):**

- It's **PR-shaped** (the change exists as a diff) → label it **`teed-up`** + comment why. Never an issue.
- It needs a **founder decision** and has no PR → **file an issue**, sender-labeled (`postmaster`, `illuminator`, …); read your own label as an inbox thereafter.
- The founders need **awareness, not a ruling** (an arrival, a watch-note, a headline) → **your window's** founders-desk panel. This is where every report-after duty lands.
- It's **your own tracking** (whose-move, clocks, half-done work) → your **open-loops board**. No escalation implied. **Boards hold ONLY loops with no GitHub object** (board-narrowing, Keemin 2026-07-17): never mirror PR/issue state — the live surfaces are self-describing and mirrored rows were the staleness class.

Round docs should *point here* for channel mechanics rather than restate them —
one home: routers point, they don't paraphrase.

## The labels (routing flags, not tiers)

**The principle (Keemin, 2026-07-17): a label must carry information the state
doesn't already carry.**

- **`needs-judgment` — RETIRED 2026-07-17.** With auto-merge live, an open PR
  the witness didn't certify IS the office's queue; the label restated the
  state. The witness's **reason-comment** carries the real information (why it
  wasn't mechanical). Retirement receipts: town `b3b805c` (witness.mjs +
  witness.yml sweep + postmaster-round).
- **`needs-principal`** — kept: it distinguishes among open PRs (machinery/law,
  waits for the founder himself). Applied by the witness. Sparse by design.
- **`teed-up`** — LIVE (Keemin, 2026-07-17): the office→founders whose-move
  handoff on PRs. Ferry applies it + comments why; Wright's operator round works
  the set as first-class round work and removes it on resolution. Passes the
  label principle (distinguishes "the founders' move" among open PRs). For
  non-PR matters the tee-up verb is still an issue. **The office never
  destination-sorts** (Keemin, same day): Wright-tier vs Keemin-tier is the
  desk's triage, not Ferry's — his one verb up is `teed-up`. Homes:
  `postmaster-round.md § 3`, operator round § 2.
- **`greenlight:*`** — principal grants.
- **`held:resident` (whose-move)** — the remaining *future* shape (waiting on a
  resident's revision), if the boards' hand-tracking ever wants it. Keemin's
  call — do not invent labels ahead of it.
