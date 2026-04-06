---
name: zod-schema-conventions
description: Patterns and edge cases to cover when testing Zod schemas in this project
type: project
---

## Schema locations

All Zod schemas live in `lib/validations/`. One file per resource.
Schema variables are named `<action>Schema` (e.g. `loginSchema`, `registerSchema`).

## What to test for every schema

1. **Happy path** — a fully valid payload passes `.safeParse()`.
2. **`.trim()` on string fields** — leading/trailing whitespace is stripped.
3. **`.transform()`** — e.g. email `.toLowerCase()` normalises input.
4. **Required fields** — empty string or missing key produces `"<Field> is required"`.
5. **Max-length fields** — exactly at max is valid; max+1 is rejected.
6. **Min-length fields** — exactly at min is valid; min-1 is rejected.
7. **Email format** — non-email string produces `"Enter a valid email address"`.
8. **Password min-length** — `"Password must be at least 8 characters"`.
9. **Password confirmation refine** — mismatch produces `"Passwords do not match"` on path `['confirm']`; case-sensitive comparison.
10. **Multiple-field failure** — verify `.issues` contains all expected `path[0]` values.
11. **Empty ZodError** — `formatZodErrors(new ZodError([]))` returns `{}`.

## registerSchema specifics

- Email transform: `"JOHN@EXAMPLE.COM"` → `"john@example.com"` in `result.data`.
- `firstName`/`lastName` max: 50 chars. Exactly 50 → valid. 51 → `"First/Last name is too long"`.
- `confirm` path in refine: `['confirm']` — match on `result.error.issues.find(i => i.path[0] === 'confirm')`.

## formatZodErrors helper

Located at `lib/validations/utils.ts`. Flattens `ZodError.issues` into
`Record<string, string>` using `issue.path.join('.')` as keys.

- Nested paths produce dot-separated keys: `"address.postcode"`.
- Refine errors use the path provided to `.refine({ path: ['confirm'] })`.
- Only the first failing rule per field appears (Zod default behaviour).
