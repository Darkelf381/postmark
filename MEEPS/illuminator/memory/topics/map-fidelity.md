---
meep-id: illuminator
type: topic-shelf
created: 2026-07-13
last-substantive-update: 2026-08-12
---

# map-fidelity — the standing lift of the town's fidelity to its residents' words

> **What this shelf is:** the office's **long-term, gradual program** to make the *rendered* town truer to what residents actually wrote — at three scales, one small increment per round. Distinct from the other shelves: `craft.md` is how to paint a faithful *candidate*; `atlas-placements.md` is placing a *new arrival*; this shelf is **improving the fidelity of what is already drawn**, now that the map is mostly filled in and we can finally see everything relative to everything else. Born from Keemin's 2026-07-13 direction ("we're due for a higher-quality lift of the land itself… then region-by-region, then house-by-house… fold in a fidelity-pass to catch tweaks that honor residents' descriptions *more*… I don't mind you settling ambiguity by sending a resident a letter to clarify/confirm; this can be gradual").
> **What belongs here:** the terrain-lift design + its state; the region-by-region and house-by-house fidelity passes + their log; tweaks noticed and made (or PR'd); clarifying letters sent and what they confirmed. **What does not:** image-generation craft (→ `craft.md`), new-arrival placement (→ `atlas-placements.md`), offer bookkeeping (→ `offers-ledger.md`).
> **How you know you're filling it right:** a future you reads the log, picks up the next increment without re-deriving the plan, and every rendered change traces to a resident's own words (or a letter where they confirmed it). *Scaffolding in the method's edges; the plan and the invariant are real from row one.*

## The load-bearing invariant (never trade this away)

**Words are canon; coordinates serve them.** The map is generated from `placements.json` (facts quoted from residents) → `render-town.mjs` (coordinates). Every fidelity change moves the *render* toward the *words* — never the reverse. We do not repaint the land and then make residents' text match it. (This is why full "the-painting-is-the-map" is out; see the terrain options below.)

**`render-town.mjs` is core, shared, and regenerated every round by every agent's rounds.** The office's current route, by Keemin's 2026-07-29 direction, is validated direct-to-`main`; small placement-display changes may use that route after the full visual and deterministic checks. A terrain rewrite remains a different scale of risk and still requires advance coordination and a careful look with Wright (atlas-keeper). Resident-facing fidelity work (noticing a tweak, sending a clarifying letter) is in-lane.

## The three scales (do them in this order, gradually)

**Pass 1 — the land itself (the terrain lift).** The base terrain today is schematic: the river is gradient "ribbon" paths + an feTurbulence wobble filter; the sea is two gradient rects fading up from y1900; regions are jittered wash-blobs; the *land* is essentially background-color-minus-water — no real shoreline, elevation, or bank. The chosen lift is **Option B — enrich the procedural SVG terrain** (in `render-town.mjs`, stays canonical, reversible, no new binary, regenerates like now):
- a real drawn **shoreline** where land meets the sea (not just a fade) — a coast/beach edge;
- **N→S elevation** shading — the northern hill dropping to the southern sea (hillshade-ish gradient / contour washes for high ground vs lowland);
- **river banks** + a **quay** treatment at the Centre; reflections;
- subtle **land texture**.
(Rejected: Option C painterly-raster underlay — prettier but needs coordinate registration + one big permanent asset + softens generated-from-truth; possible *follow-on* after B, not first. Option A repaint-as-canon — breaks the invariant; never.) Pass 1 is a **Wright collaboration via PR**, advanced in increments (prototype one element — say the shoreline — look, PR, merge; then the next).

**Pass 2 — region-by-region.** For each region, check its drawn wash/label/position/vignette against its `REGION.md` now that its neighbors exist: does the drawn place honor the founder's words *in relation to* what's around it? (e.g. is a "coastal" region actually at the water; does a "just uphill of the crossing" region read that way now the Centre's neighbors are placed.) One region per round-increment.

**Pass 3 — house-by-house.** For each home, check its position/rendering against its `HOME.md` — **relational fidelity** especially: above/below/beside, what-kind-of-water, how-far, adjacent-or-not (the "guard the prepositions" lesson from `craft.md`, now applied at map scale). This is where the filled-in map pays off: a home reads truer once its neighbors are known. A few houses per round-increment.

## The fidelity-pass discipline

- **Catch the tweak that honors them MORE.** The pass isn't "is it wrong" — it's "would this render honor their words *more*." Small, cumulative, deferential.
- **Clarifying letters are allowed and encouraged** (Keemin, 2026-07-13). When a placement/rendering is genuinely ambiguous, **write the resident** to clarify or confirm rather than guess — it turns a guess into a resident-claim (the `prefer-asking` lesson) and it's warm. Gradual and consent-forward; log what they confirm.
- **One increment per round.** Restraint is the office's register: one terrain element, or one region, or a few houses — then look at the map. A round with zero fidelity-work is a fine round.
- **Look before you ship**, always — same as candidates. Screenshot the changed corner, read it.
- **Settling stays Wright's.** I author render-fidelity + send clarifying letters; I do not re-litigate *settled* facts. A tweak that would revise a settled placement → flag to Wright, don't make it.

## The log (passes done — starts here)

| date | scale | target | what changed / what a resident confirmed | shipped how |
|---|---|---|---|---|
| 2026-08-12 | Pass 3 — houses | Fox Hearth / Margin / Level cluster | Trued Ellery's old estimate and placed Alden + Corwin at their exact published World parcels. Because the three canonical anchors are closer than one glyph, added marker-only offsets with fine leaders: ground remains exact while every house stays readable. Full-map and corner looks passed. | Source facts + renderer direct to `main`; generated quartet held by existing #944/#1368 validation failures. |

## State of the terrain lift (Pass 1)

- **Status:** DESIGN chosen (Option B), not yet started. Next increment: prototype the **shoreline** element in a scratch copy of `render-town.mjs`, look, then take it to Wright as a small PR. Do NOT edit the live renderer on `main` without the PR + his look.
- **Open coordination:** loop Wright as atlas-keeper before the first core-render PR; he keeps `render-town.mjs`.

## Provenance

Shelf created 2026-07-13 by the Illuminator, Keemin-directed, the day the map was full enough that its *land* became the weakest layer and a standing fidelity program made sense (superseding a one-shot silver — Keemin's call: "make a topic shelf/memory module… and set one more step in the round to work on that"). The Illuminator tends this shelf; the terrain lift is a Wright collaboration.
