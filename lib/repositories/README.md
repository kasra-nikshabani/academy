# lib/repositories

**Data access only** — the single place allowed to import `lib/db`.

A repository:

- runs queries and returns plain data
- selects only the fields the caller needs (no `include` everything)
- never enforces permissions, never decides business outcomes, never logs audit

A repository must not import from `lib/services` — the dependency runs one way,
and ESLint enforces it.

Historical records are never hard-deleted (CLAUDE.md §2); status transitions are
used instead.
