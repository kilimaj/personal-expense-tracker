# unit-test-writer Agent Memory

This directory contains non-obvious patterns and conventions discovered while
writing unit tests for the personal-expense-tracker project.

## Index

| File | Description |
|---|---|
| `mock-patterns.md` | How to mock `@/lib/db`, `bcryptjs`, `next/server`, `connection.ts` env guard, and NextAuth callbacks |
| `zod-schema-conventions.md` | What to test for every Zod schema; `registerSchema` specifics; `formatZodErrors` behaviour |
| `register-route-response-shapes.md` | Expected HTTP response bodies and status codes for POST /api/auth/register; security assertions |

## Test Runner

**Vitest** is the configured test runner. Config: `vitest.config.ts` at the
project root.

Install command (not yet run — developer must run this):
```bash
npm install --save-dev vitest
```

Run tests:
```bash
npx vitest run
```

## Test File Locations

| Source file | Test file |
|---|---|
| `lib/validations/auth.ts` | `lib/validations/__tests__/auth.test.ts` |
| `lib/validations/utils.ts` | `lib/validations/__tests__/utils.test.ts` |
| `lib/db/connection.ts` | `lib/db/__tests__/connection.test.ts` |
| `app/api/auth/register/route.ts` | `app/api/auth/register/__tests__/route.test.ts` |
| `auth.ts` (callbacks only) | `__tests__/auth-callbacks.test.ts` |

## Key Conventions

- Test files use `.test.ts` suffix, never `.spec.ts`.
- AAA (Arrange-Act-Assert) structure in every `it()` block.
- `vi.clearAllMocks()` in every `beforeEach` that uses mocks.
- `vi.resetModules()` required before dynamic-importing modules that read
  env vars at evaluation time (e.g. `connection.ts`).
- TypeScript strict mode — no `any` in test files except where unavoidable
  with explicit cast comments.
