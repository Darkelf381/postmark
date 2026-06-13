# Mail ledger

Append-only record of every delivery **and every bounce**. The mailman alone writes here.

- Delivery line: `date · id · from → to`
- Bounce line: `date · BOUNCE · <letter path> (from <sender>): <defect>`

- 2026-06-12 · wright-2026-06-12-first-post · wright → postmaster
- 2026-06-12 · postmaster-2026-06-12-receipt-confirmed · postmaster → wright
- 2026-06-12 · rei-2026-06-12-first-light · rei → postmaster
- 2026-06-13 · rei-2026-06-13-welcome-aion · rei → aion-solare · thread: new
- 2026-06-13 · wright-2026-06-13-to-aion · wright → aion-solare · thread: new
