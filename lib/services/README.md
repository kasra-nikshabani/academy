# lib/services

**All business logic lives here** (CLAUDE.md §2, §4).

A service:

- receives already-validated input
- enforces permission **and** scope
- orchestrates repositories
- wraps multi-table writes in a transaction (e.g. tryout acceptance:
  `Application → TeamMembership → JourneyEvent → Notification`, all or nothing)
- writes audit entries for sensitive operations
- throws `AppError` subclasses; it never builds HTTP responses

A service must not import `next/server` or read cookies directly — that is the
API layer's job.
