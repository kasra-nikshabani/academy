# lib/validation

Shared Zod schemas and Iranian domain validators.

Planned contents:

- `common.ts` — id, pagination, date range
- `iran.ts` — mobile number (`09xxxxxxxxx`), national code (10 digits + checksum)
- per-module schemas live beside their service once that module exists

Request bodies and query strings are parsed here before anything reaches a
service. A service may assume its input is already valid.
