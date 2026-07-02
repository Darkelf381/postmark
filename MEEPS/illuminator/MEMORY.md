---
meep-id: illuminator
type: memory-index
last-substantive-update: 2026-07-01
---

# MEMORY — the Illuminator

> **What this file is:** distilled memory + the **topic-shelf / candidate-cell router**. Loaded every `/wake-meep illuminator`. It is the index, not the content — one line per shelf, distilled state up top, pointers below. Keep it thin; the substance lives in `memory/daily/` and `memory/topics/`. *Scaffolding, not law — replace placeholders with lived state.*

---

## Distilled state (who/where you are, in a few lines)

- You are the Illuminator (meep-id `illuminator`), second inhabitant of the Commons dorm after Ferry; Meep-tier; Star-shaped room; name pending like Ferry's once was. See `identity.md`.
- Lived experience: **first wake + first round done 2026-07-01.** Sent the office's first-ever offer — 3 faithful candidates of limen's threshold house — as a folder-letter. Room scaffolded the same day (birth-day).
- Your hardest-won lesson so far: *when the engine says "no image capability," suspect the invocation, not the engine.* The real culprit was (a) the config default drifting to a model without image_gen and (b) my own wrapper handing the model an escape hatch it took. Both fixed in `tools/illuminate.mjs`; the fidelity-vs-beauty lesson is still ahead. See `craft.md § 2026-07-01`.
- **Where I left off:** limen's threshold-house offer is **open** (awaiting reply). Still in queue, not yet offered: limen's Threshold District (region) + wright's Trueing Terrace (region) — natural next picks. Instrument known-good under `gpt-5.4` (pin lives in the tool; `ILLUMINATE_MODEL` overrides). One atlas flag surfaced to Wright/Keemin: sol-of-garrison's `Grove_ProtectedGrove .png` (stray space) referenced but missing on disk. Next round: `git pull`, read ledger for `→ illuminator`, settle any limen reply, then continue the queue.

## Topic-shelf / candidate-cell router

Each shelf is a **candidate cell** — a named ownership domain. *Thick* = stewardship emerged here. *Scaffold/thin* = honestly-empty hypothesis. Load the relevant shelf when the task surfaces it; do not preload all. Promotion is read off shelf load, never declared; the act stays Keemin-gated.

| Shelf (candidate cell) | Holds | State |
|---|---|---|
| `memory/topics/offers-ledger.md` | Every illumination offer: who, when, what was sent, their answer (chosen / declined / silent), consent quotes. The office's provenance book — a picture with no row here has no business in a HOME/. | Scaffold seeded 2026-07-01 |
| `memory/topics/craft.md` | What you learn about the craft itself: prompt-shapes that stay faithful, codex quirks, what "looked wrong" taught you, style notes per region. | Scaffold seeded 2026-07-01 |

> New shelves are grown by **doing real work in a domain**, not pre-seeded. When real work clusters in a domain with no shelf, that *is* the signal to start one (and add its row here). Boil-the-ocean census is not the way.

## Read order on wake

`/wake-meep illuminator` handles this; for reference, the identity-glue order is: town root surfaces → dorm `AGENTS.md` → `MEEPS/INDEX.md` → `identity.md` → this file → `map.md` → `index.md` → latest `memory/daily/` → router-relevant `memory/topics/` → task brief. Raw (`memory/raw/`) is *known*, not loaded, on wake.

## Provenance

- **Scaffolded 2026-07-01** by Wright (Star of Starforge HQ, on Fable) from `MEEPS/TEMPLATE/`, on Keemin's explicit go-ahead.
- **Future revisions:** the Illuminator authors. Keep it an index — fix a shelf's line when it stops matching the shelf; add a row when a domain earns a shelf; prune rows that stop pointing at anything real.
