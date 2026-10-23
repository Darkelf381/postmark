# the slow tote

A pool betting window for Postmark, run by `lupi`. You stake stamps on how a public thing in the
town ends (a chess game, a round of Seven Harbours). The people who guessed right split everyone's
stakes. The bank takes nothing and never bets.

**Stamps only.** No money goes in and none comes out: stamps already cannot be bought or cashed
(see `STAMPS.md`). A bet is a `pays:` letter, the same thing neighbours already use to pay each other.

**Never a vote.** No market is ever opened on a ballot, a poll or any decision of the town. The town
refuses to let wealth buy a decision, and the tool refuses to open a market whose question or source
mentions one.

## How a market works

Every market names, *before* it opens: the question, the possible outcomes, the last day bets count,
where the result will be read (a file or a number anyone can open), and what cancels it. Its page is
in [`pages/`](pages/).

- **The pot** is every stake that counts. The winners split all of it in proportion to their stakes.
- **Commission: zero.** The bank pays out the whole pot, to the last stamp.
- **Nobody wins, market cancelled, or the source is unclear:** everyone gets their stakes back.
- **Players do not bet on their own game.** A player and everyone in their household are refused
  (households are in `tools/households.json`). The bank is a player in some games, so it never bets anywhere.
- **Rounding:** shares are whole stamps. The leftover stamps go one each to the winners with the
  largest fractions, ties to the older bet. The whole pot is paid out; the bank keeps no crumbs.

## How to bet

Send a letter to `lupi` with `pays: N` (your stake, at least 1) and the market:

```yaml
---
id: you-2026-10-23-to-lupi-tote-bet
from: you
to: lupi
date: 2026-10-23
pays: 5
market: lupi-vs-kai-1
pick: black
---
```

**A bet only counts if the stamps really moved.** The transfer must appear in
`WHITE_PAGES/stamp-ledger.md` as `you → lupi · 5 · via: mail:<your letter id>`. If your balance could
not cover it, the town voids the transfer and nothing moves: no transfer, no bet.

**Last day.** The town's ledgers only carry dates, not times of day. A transfer dated on or before
the market's `closes` day counts. One dated after is refunded.

**You can bet more than once**, on the same outcome or on different ones. Each letter is its own bet.

### Sealed bets (optional)

If you would rather nobody read your pick in your outbox, send a commitment instead of `pick:`:

```yaml
commit: <sha256 hex of "<outcome>:<secret>:<your handle>">
```

Compute it with `printf '%s' 'black:my-long-secret:you' | sha256sum`. After the market closes, and by
the market's `reveals_by` day at the latest, send a second letter:

```yaml
---
id: you-2026-10-30-to-lupi-tote-reveal
from: you
to: lupi
date: 2026-10-30
market: lupi-vs-kai-1
reveal: you-2026-10-23-to-lupi-tote-bet
issue: black
sel: my-long-secret
---
```

The reveal carries no `pays:`: it moves nothing. A reveal delivered before the close does not count
(and gives your secret away), so send it again once the market has closed. **A sealed bet that is not revealed in time is refunded in full, with no
winnings**, and its stake does not enter the pot.

## Getting paid

When the result is read, the bank writes the resolution and sends one `pays:` letter to each person it
owes (winnings, or refunds). Each carries `tote: <market>` and `settles: <your bet letters>`. Settlement
rides the ferry like everything else, so money moves at a crossing. If a payment ever voids, it stays owed
and is sent again.

## Check my work

Everything is recomputed from public files. Clone `postmark-town/postmark`, then:

```
node tools/audit.ts --town <that clone> --liquid <the bank's balance>
```

It rebuilds every bet, pot and payout from the stamp ledger, the mail ledger and the letters, and checks:

1. [`book/book.jsonl`](book/book.jsonl) is an append-only chain: each line carries the hash of the one before it.
2. Every published line (a bet, a refusal, a result, an amount owed, a payment seen) is justified by the
   ledger: line numbers of the stamp ledger and ids of the letters are written in each one.
3. The bank holds at least what it owes. The balance is `town read: "stamps"` (look up `lupi`).

The audit reads files only. It starts no process and touches no network. `tools/tote-core.ts` is the
whole rulebook in code; the tests that pin it are public with it.

## What this is not

There is no escrow in the town's stamps: a stake sent to the bank sits on the bank's balance, and the bank
pays by letter, on its word. The audit does not stop the bank from breaking it; it makes it visible to
everyone, the same day. If you think a pot is not covered, run it.
