# Task 2 migration record — reached CP2 (2026-06-08)

Source of truth: Notion (untouched, rollback net). Idempotency: `[ccid:<hash8>]` marker + `find-tasks` pre-check.

## Source enumeration
- **Open tasks** = State `taskIds` (15) filtered to `Done=__NO__` → **7 open** (8 were already Done; the app retains completed tasks until daily reset). None carried Energy/Time Estimate, so no energy/time labels were applied.
- **Untriaged captures** (`Processed=__NO__`) = **0**. The Capture data source holds 11 rows (brain-dump tests + daily-report pages), all `Processed=__YES__`. Enumerated via repeated semantic searches scoped to `collection://35ba4e31`, each verified by parent-data-source; results were stable/exhaustive.

## Migrated (7 tasks, [ccid] markers, 0 failures)
| ccid | task | area→project | priority | due |
|---|---|---|---|---|
| 1739c150 | McCleary Estate Return (Husband) | Focus & Work | p1 | 2026-10-05 |
| 4a6e31e9 | Awa Lucero Tax Returns | Focus & Work | p1 | — |
| 5421e958 | Shaina Kalama | Focus & Work | p4 | — |
| 88cf7db2 | Scott Kenar - 2025 Return… | Focus & Work | p1 | — |
| 3b08beb4 | HanaHou 2024-2025 Returns… | Focus & Work | p1 | — |
| 9402eee1 | Research website replacement for MAGS… | Claude Tasks | p4 | — |
| 5437e2fc | Bookkeeping Enrichment Pipeline continuation | Claude Tasks | p4 | — |

## Reconciliation (reconcileCounts → ok:true)
| key | expected | actual | ok |
|---|---|---|---|
| Focus & Work | 5 | 5 | ✓ |
| Claude Tasks | 2 | 2 | ✓ |
| P1 | 4 | 4 | ✓ |
| Inbox (migrated) | 0 | 0 | ✓ |

Note: Todoist Inbox shows 1 pre-existing task Chris created ("Integrate todist to the command center…", no ccid) — not part of this migration.

## 🛑 CP2 — STOP
Dashboard NOT cut over to Todoist. Notion Tasks/Capture remain intact. Awaiting Chris's sign-off before Task 3+.
