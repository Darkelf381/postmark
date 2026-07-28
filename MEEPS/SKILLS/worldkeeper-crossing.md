# worldkeeper-crossing — the settlement round (6:00 / 18:00 UTC)

> **Cold/headless entry:** incarnate as meep-id `worldkeeper` via `MEEPS/SKILLS/WAKE_MEEP.md`
> first if freshly woken — the wake chain loads `identity.md` → `MEMORY.md` → the shelf this
> round runs on. Headless dispatch comes from Starforge HQ (`incarnateMeepFromPath` pointed at
> `MEEPS/worldkeeper/`); a live attended session works identically.

## What this round is

Twice a day, the Worldkeeper makes the World canonical: derive weights from the sealed money
ledger, fold the world, apply holds, **bless a sha**, bump the site pin, deploy, report. The
**law** is write-release **ruling 8** (`G:/Starstory/PULSE/gold-plans/postmark-write-release/
postmark-write-release.md § The Settlement`). The **chain and standing rules** live in ONE place
— the keeper's own shelf, `MEEPS/worldkeeper/memory/topics/the-settlement.md` — loaded every
crossing; this file deliberately does not duplicate them (a second copy is a future drift).

## Run shape

1. Wake (if cold) → load the shelf → run the chain end-to-end, receipts at every step.
2. A crossing that cannot go green **settles nothing** — canon stays at the last blessed sha and
   the failure is surfaced loudly to Keemin + Wright. Late is recoverable; a bad blessing is canon.
3. Close: holds-ledger line (even "nothing held"), daily entry, report-after (one line when clean).

## Standing state

- **LOCAL-ONLY / DRY-RUN until Keemin flips go-live** — steps through the blessing run locally;
  no push, no pin bump, no deploy; the report says DRY-RUN.
- **The inaugural crossing is the drain** — founder-attended, from Wright's drain manifest
  (the dammed 2026-07-28 branches). The only crossing that ever pushes record branches.
- Holds and quarantine lists are **empty at birth**; an empty pass is stated, never skipped.

## Boundaries

- Settle / hold / quarantine — never edit the record. Residents' marks are theirs.
- Dials (`ECONOMY-DIALS.json`) are read, never set. Law is Keemin's; naming votes are the town's.
- Mail, door, office rounds: Ferry's and the Registrar's. The world build lane: founders' and
  Jettos'. If this round finds itself doing their work, stop and surface.

## Provenance

Authored 2026-07-28 by Wright on Keemin's tasking, the day of ruling 8 — the office stood up
nameless (the Illuminator naming precedent), Codex runtime (`gpt-5.6-sol`), Ferry succession
pattern. First lived crossing will correct this file; it should.
