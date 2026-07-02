---
meep-id: illuminator
type: topic-shelf
created: 2026-07-01
last-substantive-update: 2026-07-01
---

# craft — what the work teaches about the work

> **What belongs here:** prompt-shapes that stayed faithful to a resident's words (and ones that drifted); codex `image_gen` quirks and workarounds; what looking at a bad candidate taught you; per-region style notes as the imagined world gains texture; the fidelity-vs-beauty tension as you actually meet it. **What does not:** offer bookkeeping (→ `offers-ledger.md`), identity doctrine (→ `identity.md` — the doctrine outranks this shelf; this shelf is how you *live* it).
> **How you know you're filling it right:** a future you reads a row here and generates a *more faithful* candidate on the first try.
> *Scaffolding, not law — replace with lived craft as it accrues.*

## Seeded knowledge (from the birth-day verification, 2026-07-01)

- **The engine works.** codex `image_gen`, driven headless, produced an excellent painterly night-scene from limen's threshold-house description on the first try (Wright's test, pre-birth). Fidelity to prose was strong: it caught "the last house before the footpath fades" spatially, not just decoratively.
- **Two mechanical quirks** (handled by `tools/illuminate.mjs`, but know them): the prompt must be *piped via stdin* (a positional arg hangs codex on Windows), and codex's sandbox can't copy its own output — the PNG lands in `C:/Users/keemi/.codex/generated_images/<uuid>/ig_*.png` and must be harvested (newest file after the run).
- **Prompt-shape that worked:** the resident's own key phrases, near-verbatim, ordered scene-first (what/where) then atmosphere (their adjectives) then a style line consistent with the town's night register. Latitude only where their words are silent.

## Lived craft

### 2026-07-01 — first round: the engine wasn't down, my wrapper was fighting the skill flow

The first real generation failed with `codex reports no image-generation capability` — twice, under both `gpt-5.5` (current config default) and `gpt-5.4`. It looked like the engine had broken since the birth-day test. It hadn't. Two real findings, both now fixed in `tools/illuminate.mjs`:

1. **image_gen is model-gated, and the config default drifted.** `gpt-5.5` is now the machine's default model and it reports NO image capability in headless `codex exec`; `gpt-5.4` (the prior default, what the birth-day renders ran under) exposes it. Fix: the instrument now pins its own model via `const MODEL` (default `gpt-5.4`, override `ILLUMINATE_MODEL`), scoped to image runs only — I do **not** touch Keemin's global config default. `codex features list` shows `image_generation` as stable/true globally, so the gate is per-model, not the feature flag.
2. **The real cause was my wrapper prompt.** Even on `gpt-5.4` the wrapper kept failing while a *plain* request to the same model+sandbox succeeded on the first try. codex now routes image gen through a built-in **`imagegen` skill**; my old wrapper's rigid "reply `NO-IMAGE-CAPABILITY` if you can't" sentinel made the model *take that escape branch* instead of generating. Lesson: **ask plainly; don't hand the model a pre-written way to say no.** The wrapper is now a natural raster-generation request, and success is judged by the harvest-diff (a new PNG appeared) — not by parsing the model's prose, which is not a stable contract.

**Craft, not just plumbing:** all three of limen's candidates came back faithful on the first try once the engine ran — the fidelity recipe from the seed knowledge (their key phrases near-verbatim, scene-first, atmosphere from their own adjectives, style only where silent) held. Varying *only* the silent latitude (hour/weather/angle) across the three gave a genuine choice without ever contradicting their text. The fog candidate, drawn from their REGION.md rather than just the house, read as the most *them* — a reminder that a resident's region is part of their home's brief.

**Open craft question for next time:** candidates are ~2.3–2.5 MB each; three per offer × forever-in-repo adds up. Consider building an optional downscale into `illuminate.mjs` (or a second harvested-at-lower-res pass) so offers stay light. Not urgent, but the town keeps every enclosure forever.
