---
name: mock-patterns
description: How to mock external dependencies in this codebase for unit tests
type: project
---

## Mongoose / lib/db mocking

Mock the entire `@/lib/db` module before importing the module under test.
Use `vi.mock()` at the top of the file (Vitest hoists it automatically).

```ts
vi.mock('@/lib/db', () => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
  User: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}))
```

After importing, use `vi.mocked(User.findOne).mockResolvedValue(...)` inside
`beforeEach` to set per-test return values and always call `vi.clearAllMocks()`
in `beforeEach` to avoid state leakage between tests.

## bcryptjs mocking

bcryptjs uses a default export:

```ts
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn().mockResolvedValue(true),
  },
}))

import bcrypt from 'bcryptjs'
// then: vi.mocked(bcrypt.hash), vi.mocked(bcrypt.compare)
```

## next/server mocking

NextResponse.json returns a plain object with `body` and `status`:

```ts
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}))
```

## connection.ts — module-level env var guard

`lib/db/connection.ts` throws at module evaluation time when `MONGODB_URI` is
missing. Test this with:

```ts
beforeEach(() => { vi.resetModules() })  // flush module cache
delete process.env.MONGODB_URI
await expect(import('../connection')).rejects.toThrow('MONGODB_URI environment variable is not defined')
```

Use `vi.doMock()` (not `vi.mock()`) when the mock must be set after
`vi.resetModules()` since `vi.mock()` is statically hoisted.

## NextAuth callbacks — test logic, not the wiring

auth.ts calls `NextAuth()` at module evaluation. Do not import it directly in
unit tests. Instead, replicate the pure callback functions in the test file and
test those directly. Inject I/O dependencies (connectToDatabase, User.findOne,
bcrypt.compare) into the `authorize` logic via parameter for testability.
