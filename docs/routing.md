# Routing Specification — Personal Expense Tracker

This document is the authoritative reference for all routing decisions. Read it before adding, moving, or renaming any route, layout, or API handler. All routing follows Next.js App Router conventions.

---

## Core Rules

1. All routes live under `app/`. Never use the Pages Router (`pages/`).
2. Every route is a `page.tsx` file inside a named folder — never a standalone file at the `app/` root except `layout.tsx`, `loading.tsx`, `error.tsx`, and `not-found.tsx`.
3. Route folders are named after the **resource or feature** they represent, in lowercase kebab-case.
4. Route groups (`(name)`) are used to share layouts without affecting the URL path.
5. **All routes under `app/` are protected by default.** The only public routes are `/`, `/login`, and `/signup`. Everything else requires a valid session — enforced at the middleware layer before any page or API route code executes.
6. Dynamic segments use `[param]` for required params and `[[...param]]` for optional catch-all segments. Param names match the primary resource identifier of the route (e.g., `[expenseId]`, not `[id]`).

---

## Route Protection Model

Protection is enforced in two layers. Both must stay in place — neither replaces the other.

### Layer 1 — Edge Middleware (`middleware.ts`)

Runs before any page or API route. Redirects unauthenticated requests to `/login` and redirects authenticated users away from `/login` and `/signup`. See `docs/auth.md` for the full middleware implementation.

```
Public paths:    /        /login       /signup      /api/auth/*
Protected paths: everything else (any path not in the public list)
```

Unauthenticated requests to a protected path are redirected to `/login?callbackUrl=<original-path>`. After sign-in, NextAuth uses `callbackUrl` to return the user to where they were going.

### Layer 2 — Authenticated Layout (`app/(app)/layout.tsx`)

A server component that calls `auth()` and redirects to `/login` if no session exists. This is a safety net for cases where middleware is bypassed (e.g., local development with middleware disabled). It does not replace the middleware.

---

## Complete Route Map

```
app/
│
├── layout.tsx                          # Root layout — HeroUIProvider, fonts, global metadata
├── page.tsx                            # / — Landing page (public)
├── not-found.tsx                       # Global 404 page
│
├── (auth)/                             # Route group: public auth pages, no app Navbar
│   ├── layout.tsx                      # Minimal layout (no Navbar, centered card shell)
│   ├── login/
│   │   └── page.tsx                    # /login
│   └── signup/
│       └── page.tsx                    # /signup
│
├── (app)/                              # Route group: all protected pages, full app Navbar
│   ├── layout.tsx                      # Auth guard + Navbar layout (session-checked)
│   │
│   ├── dashboard/
│   │   └── page.tsx                    # /dashboard — Summary cards, recent transactions
│   │
│   ├── expenses/
│   │   ├── page.tsx                    # /expenses — Full expenses table with filters
│   │   └── [expenseId]/
│   │       └── page.tsx                # /expenses/[expenseId] — Expense detail (optional)
│   │
│   ├── budgets/
│   │   ├── page.tsx                    # /budgets — Budget cards overview
│   │   └── [budgetId]/
│   │       └── page.tsx                # /budgets/[budgetId] — Budget detail (optional)
│   │
│   ├── categories/
│   │   └── page.tsx                    # /categories — Category management
│   │
│   ├── reports/
│   │   └── page.tsx                    # /reports — Tabbed analytics and export
│   │
│   └── settings/
│       └── page.tsx                    # /settings — Profile, preferences, account
│
└── api/
    ├── auth/
    │   ├── [...nextauth]/
    │   │   └── route.ts                # NextAuth handler (GET + POST) — do not add logic here
    │   └── register/
    │       └── route.ts                # POST /api/auth/register — new user registration
    │
    ├── expenses/
    │   ├── route.ts                    # GET /api/expenses  POST /api/expenses
    │   └── [expenseId]/
    │       └── route.ts                # GET /api/expenses/[expenseId]
    │                                   # PATCH /api/expenses/[expenseId]
    │                                   # DELETE /api/expenses/[expenseId]
    │
    ├── budgets/
    │   ├── route.ts                    # GET /api/budgets  POST /api/budgets
    │   └── [budgetId]/
    │       └── route.ts                # GET /api/budgets/[budgetId]
    │                                   # PATCH /api/budgets/[budgetId]
    │                                   # DELETE /api/budgets/[budgetId]
    │
    ├── categories/
    │   ├── route.ts                    # GET /api/categories  POST /api/categories
    │   └── [categoryId]/
    │       └── route.ts                # GET /api/categories/[categoryId]
    │                                   # PATCH /api/categories/[categoryId]
    │                                   # DELETE /api/categories/[categoryId]
    │
    ├── reports/
    │   └── route.ts                    # GET /api/reports — aggregated summary data
    │
    └── user/
        └── route.ts                    # GET /api/user  PATCH /api/user (profile update)
```

---

## Route Groups

### `(auth)` — Public authentication pages

- URL paths: `/login`, `/signup`
- Layout: minimal centered shell with no Navbar
- No session check — these pages must be reachable before authentication
- Authenticated users who visit these paths are redirected to `/dashboard` by middleware

### `(app)` — Protected application pages

- URL paths: `/dashboard`, `/expenses`, `/budgets`, `/categories`, `/reports`, `/settings`
- Layout: full Navbar + session guard (`auth()` called server-side)
- Every page in this group can safely call `auth()` and assume a valid session exists

Route groups are transparent to URLs. `(auth)` and `(app)` never appear in the browser address bar.

---

## Layouts

### `app/layout.tsx` — Root layout

Wraps the entire application. Responsibilities:
- Load and apply fonts (Geist)
- Mount `HeroUIProvider`
- Set global `<html>` and `<body>` attributes
- Export `metadata` (title, description)

Does not render a Navbar. Does not check authentication.

### `app/(auth)/layout.tsx` — Auth layout

Wraps login and signup. Responsibilities:
- Centered single-column shell
- No Navbar, no sidebar

### `app/(app)/layout.tsx` — App layout

Wraps all protected pages. Responsibilities:
- Call `auth()` and redirect to `/login` if no session (safety net)
- Render the global `Navbar`
- Provide page content area

```ts
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/navbar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <>
      <Navbar user={session.user} />
      <main>{children}</main>
    </>
  )
}
```

---

## Special Files

Every route segment can optionally include these co-located files. Use them where appropriate.

| File | Purpose |
|---|---|
| `page.tsx` | The UI for the route. Required to make the segment publicly addressable. |
| `layout.tsx` | Shared UI that wraps the segment and all its children. Persists across navigations. |
| `loading.tsx` | Instant loading UI shown while the segment's `page.tsx` is streaming. Wraps the page in a `<Suspense>` boundary automatically. |
| `error.tsx` | Error boundary UI for the segment. Must be a Client Component (`'use client'`). |
| `not-found.tsx` | UI shown when `notFound()` is called from within the segment. |
| `route.ts` | API route handler. Makes the segment an HTTP endpoint instead of a page. A segment cannot have both `page.tsx` and `route.ts`. |

---

## API Routes

### Authentication

Every API route handler — without exception — must verify the session at the top of the function. Never rely solely on middleware.

```ts
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ...
}
```

### HTTP method conventions

| Method | Usage |
|---|---|
| `GET` | Fetch a resource or list of resources |
| `POST` | Create a new resource |
| `PATCH` | Partial update to an existing resource |
| `DELETE` | Remove a resource |

`PUT` is not used. All updates use `PATCH`.

### URL param naming

Dynamic segment names in API routes match the page routes exactly.

| Route | Param |
|---|---|
| `/api/expenses/[expenseId]` | `params.expenseId` |
| `/api/budgets/[budgetId]` | `params.budgetId` |
| `/api/categories/[categoryId]` | `params.categoryId` |

```ts
export async function PATCH(
  req: Request,
  { params }: { params: { expenseId: string } }
) {
  // params.expenseId is the raw string from the URL
}
```

### Response shape

All API routes return JSON. Success and error responses follow a consistent shape:

```ts
// Success
{ data: T }                          // single resource
{ data: T[], total: number }         // paginated list

// Error
{ error: string }                    // human-readable message
```

Status codes:

| Code | When |
|---|---|
| `200` | Successful GET or PATCH |
| `201` | Successful POST (resource created) |
| `400` | Invalid request body or missing required fields |
| `401` | No valid session |
| `403` | Session exists but resource does not belong to the user — return `404` instead (see `docs/auth.md`) |
| `404` | Resource not found, or belongs to another user |
| `409` | Conflict (e.g. duplicate category name) |
| `500` | Unhandled server error |

---

## Navigation

Use Next.js `<Link>` for all client-side navigation. Never use `<a>` tags for internal routes.

```tsx
import Link from 'next/link'

<Link href="/expenses">Expenses</Link>
<Link href={`/expenses/${expense._id}`}>View</Link>
```

For programmatic navigation in Server Actions and after form submissions, use `redirect()` from `next/navigation`.

```ts
import { redirect } from 'next/navigation'

redirect('/dashboard')
```

For programmatic navigation in Client Components, use `useRouter()`.

```ts
'use client'
import { useRouter } from 'next/navigation'

const router = useRouter()
router.push('/expenses')
```

---

## Naming Conventions

| Context | Convention | Example |
|---|---|---|
| Route folders | lowercase kebab-case | `expenses/`, `monthly-reports/` |
| Dynamic segments | camelCase resource + `Id` | `[expenseId]`, `[categoryId]` |
| Route group folders | lowercase, wrapped in parens | `(app)`, `(auth)` |
| Page files | always `page.tsx` | `page.tsx` |
| Layout files | always `layout.tsx` | `layout.tsx` |
| API route files | always `route.ts` | `route.ts` |
| Parallel/intercepted routes | not used in this project | — |

---

## What Belongs Where

| Task | Location |
|---|---|
| Render a page | `app/(app)/<resource>/page.tsx` |
| Share UI across multiple pages | `app/(app)/layout.tsx` or a nested `layout.tsx` |
| Fetch data for a page | Inside `page.tsx` as a Server Component (no separate data layer) |
| Handle form submissions | Server Action co-located in the page or a `actions.ts` file beside the route |
| Expose data to the client | `app/api/<resource>/route.ts` |
| Redirect after auth | `middleware.ts` |
| Protect a page server-side | `app/(app)/layout.tsx` via `auth()` |
| Show loading UI | `app/(app)/<resource>/loading.tsx` |
| Handle route errors | `app/(app)/<resource>/error.tsx` |

---

## Adding a New Route — Checklist

Before creating a new page or API route, verify:

- [ ] The folder name describes the resource or feature, in kebab-case
- [ ] The route is inside `(app)/` if it requires authentication (almost always)
- [ ] A `loading.tsx` is added if the page fetches slow data
- [ ] An `error.tsx` is added if the page can fail in recoverable ways
- [ ] The corresponding API route is in `app/api/<resource>/route.ts`
- [ ] The API route calls `auth()` and returns `401` if no session
- [ ] All Mongoose queries in the API route include `userId` scoping (see `docs/auth.md`)
- [ ] Navigation to the new route uses `<Link>` or `redirect()`, not `<a>`
