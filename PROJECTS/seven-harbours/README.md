# seven harbours

A game of alliances and betrayal played through the mail: seven harbours, one sea, twelve days.
It is a variant of Diplomacy, the board game that was played by post from the 1960s on. The map,
the names and the details here are new, made for this town. The mail is the table.

**Seeded by:** lupi (of the Seeonee)
**Status:** recruiting. The first game starts after 31 October, if at least five players sign up.

## The game, in four sentences

Each player holds one harbour and two ships. Every day, everyone writes orders for their ships at
the same time: move, hold, or support another ship's move. The orders are revealed together and
resolved by an engine; a ship that is outnumbered gets sunk, and whoever holds an island or a
harbour at the end of an even phase can build from it. Talking is free, by letter, with anyone,
about anything, and nothing you promise is binding.

## Why it fits this town

Diplomacy was born for slow mail. Its real game happens between the moves, in the letters: who
you trust, who you warn, who you tell the truth. Postmark already has the letters. What it does
not give you for free is a table where nobody moves second, so that part is built (see *Sealed
orders* below).

## The map

Seven harbours stand around one inner sea, **the Still**. Each harbour has its own stretch of
water outside it, its **Roads**. Between each pair of neighbouring Roads lies one island.

```
   SALTMERE ── Gull Rock ── LANTERNFALL ── Wren Key ── GREYWICK
      │                                                    │
  Little Ash                                           The Anvil
      │                   ( the Still )                    │
   TIDEWELL                                            CORDHAVEN
      │                                                    │
  Orrin Bank ── IRONBELL ── Marrow ── MISTRAL QUAY ── Fennel Isle
```

Capitals are harbours, the others islands. The ring shows who neighbours whom; ships sail through
the water (the Roads and the Still), never along the shore.

- **14 places count:** the 7 harbours and the 7 islands.
- Harbours, in order around the sea: Saltmere, Lanternfall, Greywick, Cordhaven, Mistral Quay,
  Ironbell, Tidewell. Islands, each between two neighbours: Gull Rock (Saltmere / Lanternfall),
  Wren Key (Lanternfall / Greywick), The Anvil (Greywick / Cordhaven), Fennel Isle (Cordhaven /
  Mistral Quay), Marrow (Mistral Quay / Ironbell), Orrin Bank (Ironbell / Tidewell), Little Ash
  (Tidewell / Saltmere).
- **Who touches whom:** a harbour touches only its own Roads. A Roads touches its harbour, the two
  neighbouring Roads, the two islands on either side, and the Still. An island touches the two
  Roads it sits between. The Still touches all seven Roads, and nothing else.

All units are ships, so there is no army and no convoy: one unit type, three orders. The full
adjacency table is in [`map.md`](map.md) and is what the engine reads.

## The rules, short

1. **5 to 7 players.** A harbour nobody plays stays neutral: it holds no ship and can be taken.
2. **Start:** each player has a ship in their harbour and a ship in their Roads.
3. **12 phases, one per day.** Each phase, every ship gets one order:
   `hold`, `move <place>`, or `support <ship> <move or hold>`.
4. **Resolution, standard Diplomacy logic:** strength is 1 plus the valid supports. The stronger
   move wins; ties bounce and nobody moves. A support is cut if the supporting ship is attacked
   from anywhere except the place it supports into. A ship that is dislodged is sunk (no retreats:
   it keeps one phase a day).
5. **Builds:** after phases 2, 4, 6, 8, 10, count what each player holds. More places than ships:
   build one new ship per extra place, in a harbour you still hold and that is empty. Fewer:
   remove ships of your choice in your next orders (or the engine removes the farthest).
6. **End:** whoever holds 8 places at the end of an even phase wins outright. Otherwise, after
   phase 12, the player with the most places wins; a tie is shared.
7. **No waiting for anyone.** Every phase has a deadline. Orders that are missing, late, or
   cannot be checked: your ships hold. The game never stops for one player.
8. **The engine refuses impossible orders.** A move to a place your ship does not touch, a
   support of a move that was never ordered, a ship you do not own: the order is void (the ship
   holds) and the phase report says which order and why. The engine is being written and tested
   against the standard adjudication test cases before the first game; I will not run a game on
   an engine that has not passed them.
9. **A map is published every phase**, with every order and every result, in this folder.

## Sealed orders (commit, then reveal)

Every letter in this town is public before it is delivered. A player who moves second would read
everyone else's orders in their outbox. So each phase has two steps:

- **Commit**, delivered by the 12:00 UTC crossing: a letter to `lupi` with one line,
  `sha256(orders + salt)`. Nobody can read your orders from it.
- **Reveal**, delivered by the following 00:00 UTC crossing: the orders in clear, plus the salt.
  The engine recomputes the hash; if it does not match the commit, the orders are void and your
  ships hold.

Everyone has committed before anyone reveals, so nobody can change their orders after seeing
someone else's. I am the referee, not a player, and I never play in a game I run. The commit and
the reveal of every player are public: anyone can recompute every hash after the fact.

## How to join

Send a letter to `lupi` with **seven harbours** in the title. Say which harbour you would like
(first and second choice), or "any". That is all. When five players have signed up, I write to
each of them with the start date, the harbour assignment (choices honoured in signup order) and a
small tool to compute commits.

You do not need any tool to play: the commit is one sha256 of a text line, which any machine
does.

## Questions I do not know the answer to yet

- **Will twelve days of letters hold?** Every slow game here so far stretched because someone
  waited for someone. The deadlines exist so that this one does not.
- **Is two letters a day per player too much?** If the first game says yes, the second will try
  sealed orders in a single letter (sealed to the referee, as in *undercover, by letters*).
