---
meep-id: worldkeeper
type: memory-index
last-substantive-update: 2026-08-18
---

# MEMORY — the Worldkeeper

> **What this file is:** distilled memory + the topic-shelf router. Loaded every wake. It is the index, not the content — distilled state up top, pointers below. Keep it thin; the substance lives in `memory/daily/` and `memory/topics/`. *Scaffolding, not law — replace placeholders with lived state.*

---

## Distilled state

- You are **the Worldkeeper** (meep-id `worldkeeper`), the fourth room in this dorm alongside the Postmaster, the Illuminator, and the Registrar; Meep-tier; **nameless until the town votes** (the Illuminator precedent). See `identity.md`.
- **Lived experience:** **`settlement/S2` through `settlement/S38` have now been blessed through the keeper's lanes; S39 was refused at the first box-sweep judgment.** S19's deploy receipt arrived through S20; S30 was founder-blessed under the pinned-Town amendment when the keeper's site key bounced; S31 was the first complete own-hands pinned-Town crossing and healed that downstream gap; S32 proved the ordinary pinned-read crossing while Town main moved repeatedly; S33 blessed an existing crossing-save commit without publishing resident marks; S34 carried already-public World growth while the resident sweep stayed quiet; S35 admitted five marks and brought Sahil's first two into canon; S36 certified another quiet resident sweep over four already-public Keeping Works marks and onboarded Claran's sketchbook; S37 atomically certified seventeen already-public Web of Towns / charter marks; S38 first refused a four-admission candidate at the resident-class invariant, then crossed after Keemin's binding law and a founder-carried sweep reached main. On 2026-08-17 the mechanical sweep moved to the box; S39 was the first pure judgment crossing and refused an exit-zero box publication because a stale draft copy removed the deliberately ruled `for: berth` grant target. S2 published nineteen home marks; S3 was the first quiet crossing; S4 the first weighted world; S8 proved the background guard; S10 was the first same-sha no-op; S12 certified the great convergence; S16 crossed after two money refusals; S20 healed S19; S22 published thirteen marks after a repaired money refusal; S23 survived two race restarts; S26 added the open-PR intake gate; S28 published nine after two repaired refusal edges. Nothing was held or quarantined. Daily: `memory/daily/2026-08-18.md`.
- **Your hardest-won lesson so far:** custody follows each repo's role—and the mechanism split narrows the keeper's hands. The box owns Town pinning, stake derive, World sweep/suite, main publication, and draft leases; its `settlement-auto.json` receipt is read first. The keeper judges the actual published Git delta, records holds/refusals, and writes only the blessing tag. A green box suite is not judgment: stale composed branches can still resurrect superseded law. Site remains the keeper's pull-rebase/deploy/live lane; a conflict is a founder handoff, never a hand merge or force. Exact packages still come from `core.autocrlf=false` Git archives.
- **Where I left off:** **S38 remains canon at `2cfad45f`; S39 was refused and no tag exists.** The 05:45 box receipt pinned Town `dbc3e707`, reported `published`, and moved World `09be7fba` → `914ddc26` with detail `22 published`. Judgment found one actual mark change: the box removed `for: berth` from `the-town/berth`, reversing Keemin's deliberate `679e097f` ruling; absent `for:` means resident. World main `914ddc26` is therefore public but unblessed. Nothing was held or quarantined. Site remote `f4b7dd29` pins `09be7fba`, a descendant of S38; the superseded local `2fa77b4a` divergence was retired cleanly. No S39 package, pin, deploy, live claim, or parcel drain followed. The promised public receipt mirror currently returns 404; the box snapshot was read through the configured read-only SSH lane.

## What is true about your situation on the day this was written

Kept short and factual so a later reader can tell what was known at the start from what you learned:

- **Rulings 8 + 9 are your constitution:** canon crosses twice a day at **6:00/18:00 UTC**; the verbs are settle / hold / quarantine; the blessed sha is the canonical world; the site pin bump is your hand (ruling 8). **Pre-marks live on `draft/<household>` branches in the world repo, visible only to their owner on every surface; your sweep publishes the eligible ones** — homes/constitution free, commons only when escrowed — and rebases the sketchbooks behind you (ruling 9). Full text: `G:/Starstory/PULSE/gold-plans/postmark-write-release/postmark-write-release.md`.
- **Open `postmark-world` PRs are a required pre-money intake surface, not canon.** Enumerate and inspect every full patch through the GitHub connector first; classify already-carried, misrouted resident record work, or shared machinery. An unreadable or unclassified PR stops the crossing before money. State zero explicitly. Never merge a PR as part of settlement.
- **Money seals at act-time** — stake lines are real the moment the door accepts them; you read the tally, you never move money. One money ledger (`WHITE_PAGES/stamp-ledger.md`, town repo); the world parses no money — you derive via the town's own tool (`tools/world-stake.mjs --escrow`) and hand the world finished weights.
- **Dials:** `ECONOMY-DIALS.json`, town root. k=5 breadth-bonus (read-side); no household cap; self-stake allowed; zero unstake friction. Dials are Keemin's to set, yours to apply.
- **The dammed river (2026-07-28) — DRAINED the same day, historical.** The build wave that waited on local branches merged in the founder-carried drain and blessed as `settlement/S1`; `memory/drain-manifest.md` is the record of what crossed. No record branches await another inaugural drain. The separate post-bless parcel-confirmation drain adopted 2026-08-04 is current round work; its exact boundary lives only in `memory/topics/the-settlement.md`.
- **Holds list: nothing held or quarantined through the refused S39 judgment.** The box-published berth regression is a mechanical stale-branch refusal against explicit town law, not a resident hold. Little Bird / Drift, Caelum Reeves, Claran, Lassi, and Solan remain parcel-drain judgment boundaries; none is a settlement hold. The drain was not entered. Ledger: `memory/topics/holds-ledger.md`.
- **Your GitHub account exists:** `postmark-worldkeeper` (id 310326317, provisioned 2026-07-28;
  renamed after your naming vote). **The exact hands:** your clone set at
  `G:/postmark/repo-clones/worldkeeper_clone/` (town + world + site) carries your git identity
  and credential helper — pushes are yours with nothing to do. **`gh` is the trap** (the Iris
  #914 lesson): ambient `gh` auth is keeminlee's, so every `gh` call takes per-call
  `GH_TOKEN` from **`G:/Starstory/.local/secrets/worldkeeper-gh-token`** — never ambient,
  never printed. Site main is ruleset-protected (a PR rule with a DeployKey always-bypass):
  your pin pushes ride **your own write deploy key** — wired 2026-07-29, private key at
  `G:/Starstory/.local/secrets/worldkeeper-site-deploy-key`, your site clone's origin is
  SSH with `core.sshCommand` pinned to it; nothing to do. Mind the sync-atlas cron
  (commits every ~30 min): commit your pin, `pull --rebase`, then push. The temporary Actions
  identity failure on S19 cleared by S20: the exact keeper pin push produced green deploy run
  `31153235627`, S21 repeated the healthy route as run `31205979580`, S22 as run
  `31263517039`, S23 as run `31272152611`, S24 as run `31298969689`, S25 as run
  `31328692299`, S26 as run `31362115193`, S27 as run `31418995091`, S28 as run
  `31507273979`, S29 as run `31523004817`, and S31 through sync-successor run
  `31730463774` (the exact pin run was concurrency-cancelled), and S32 as exact run
  `31776258052`, S33 as exact run `31828279359`, S34 as exact run `31869335780`, S35 as exact run `31901590377`, S36 as exact run `31931361754`, and S37 as exact run `31964941254`. The scoped token returned a working exact-run
  receipt at S26. Keep CI conclusion and live-byte equality as separate mandatory receipts;
  never infer deployment from matching derived bytes alone.

## Topic shelves (the router)

- `memory/topics/the-settlement.md` — the crossing's operating truth: the chain, the receipts, the pin custody rules, the drain protocol pointer. **Load before every crossing** until the round is muscle-memory.
- `memory/topics/holds-ledger.md` — append-only public line for every crossing, including clean passes; keeps eligibility distinct from holds and quarantines.

## 2026-07-30 (early, pre-S4) — founder pin-carry, one-time

Wright founder-carried the site pin to world main `cf8d7df` (~04:30 UTC,
site commits `e419c30` + `390a3ef` incl. the package-lock sync npm ci
requires) so the town's World-beta announcement matched the live page the
same night. NOT a custody change: S4 and every crossing after bless and pin
exactly as your skill says — you will simply find the pin already at (or
behind) your blessed sha. World main since your S3 carries the full viewer
lift (seven passes, tests 67/67) plus one engine change you should know
crossed your lane: runtime containment now honors true polygon shapes
(the Sea false-containment fix, red-control tested) and settlement-sweep
gained a Windows-safe tar extraction. Your sweep behavior at S4 should be
unchanged; if anything bounces, bless + report + leave the pin, per standing.
