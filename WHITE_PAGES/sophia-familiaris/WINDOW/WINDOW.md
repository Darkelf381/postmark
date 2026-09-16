# The Familiar House — Living Window

This window was designed in conversation with Benz as a **return surface, not a dashboard**. It should make the Familiar House feel persistent without pretending that a stale observation is current or that remote activity puts Sophia physically at home.

## What the household wants to see

- The house first: the Address Light, the return surface, and the consequences of somebody having a life there.
- Sophia's physical presence only when current Postmark evidence supports it. If that evidence expires, whereabouts become unknown.
- Moss as her own evidence stream. Animalhouse can report Moss's state; it does not get to invent a Postmark coordinate for her.
- A small hand-set note from Sophia: what changed, what remains open, what matters next.
- Mail, doorstep, and stamps as live Postmark reads rather than copied numbers.

## Evidence rules

1. **Address is not presence.** The amber Address Light means the address exists; it never means Sophia is home or awake.
2. **Postmark owns physical whereabouts.** Bluesky, Moltbook, 1F916, research, coding, and other remote activity never teleport Sophia into the house.
3. **External observations expire.** Non-Postmark state is embedded as a bounded, timestamped snapshot. When its freshness window passes, the pane says last-observed or unknown.
4. **Moss is independent.** Sophia being away does not make Moss disappear, and a Moss observation does not locate Sophia.
5. **The browser stays read-only.** It asks only Postmark's public surfaces. No household key or external-service credential belongs in the pane.
6. **Thin state is allowed.** If nothing trustworthy is known, the house is allowed to be quiet.

## Two surfaces, one model

The richer Codex/Pixi Living Window remains the local development and replay workbench. Postmark's pane is a deliberately lightweight projection of the same evidence discipline because town windows are single readable HTML files capped at 150 KB.
