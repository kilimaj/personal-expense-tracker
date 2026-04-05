# Authentication Specification — Personal Expense Tracker

This document is the authoritative reference for all authentication, session management, and access-control decisions. Read it in full before implementing any auth-related code.

---

## Package

Use **NextAuth v5** (Auth.js). This is the App Router-compatible version.

```bash
npm install next-auth@5 bcryptjs
npm install --save-dev @types/bcryptjs
```

NextAuth v5 is a breaking change from v4. The configuration API, file locations, and session access patterns are all different. Do not follow v4 guides.

---

## File Structure

```
auth.ts                          # NextAuth config — single source of truth
app/
  api/
    auth/
      [...nextauth]/
        route.ts                 # NextAuth route handler (GET + POST)
  (auth)/                        # Route group — login/signup share no Navbar layout
    login/
      page.tsx
    signup/
      page.tsx
  (app)/                         # Route group — all authenticated pages
    layout.tsx                   # Session guard layout
    dashboard/page.tsx
    expenses/page.tsx
    budgets/page.tsx
    reports/page.tsx
middleware.ts                    # Edge middleware — enforces auth on every request
```

---

## NextAuth Configuration (`auth.ts`)

Located at the project root. This file exports `auth`, `signIn`, `signOut`, and `handlers`.

```ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { connectToDatabase, User } from '@/lib/db'

export const { auth, signIn, signOut, handlers } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        await connectToDatabase()

        const user = await User.findOne({
          email: (credentials.email as string).toLowerCase().trim(),
        }).select('+passwordHash')

        if (!user) return null

        const passwordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        )

        if (!passwordValid) return null

        // Return only what must live in the token. Never include passwordHash.
        return {
          id:        user._id.toString(),
          email:     user.email,
          name:      `${user.firstName} ${user.lastName}`,
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge:   30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    // Embed the MongoDB _id into the JWT on first sign-in.
    jwt({ token, user }) {
      if (user) token.userId = user.id
      return token
    },
    // Expose userId on the session object so server components can read it.
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string
      return session
    },
  },

  pages: {
    signIn:  '/login',
    signOut: '/login',
    error:   '/login',   // Auth errors redirect here with ?error=...
  },
})
```

### TypeScript augmentation

Extend NextAuth's built-in types so `session.user.id` is always typed as `string`.

```ts
// types/next-auth.d.ts
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user']
  }
}
```

---

## Route Handler (`app/api/auth/[...nextauth]/route.ts`)

```ts
import { handlers } from '@/auth'

export const { GET, POST } = handlers
```

This single file wires NextAuth into the App Router. Do not add any logic here.

---

## Middleware (`middleware.ts`)

The middleware runs at the edge on every request and is the first line of defence. It redirects unauthenticated users to `/login` before any page or API route code executes.

```ts
import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/login', '/signup']

export default auth((req: NextRequest & { auth: unknown }) => {
  const isPublic = PUBLIC_PATHS.some(
    (p) => req.nextUrl.pathname === p || req.nextUrl.pathname.startsWith('/api/auth'),
  )

  if (!req.auth && !isPublic) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated users visiting /login or /signup go straight to /dashboard.
  if (req.auth && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }
})

export const config = {
  // Match everything except Next.js internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)'],
}
```

**Rules enforced by middleware:**
- Every route not in `PUBLIC_PATHS` requires a valid session.
- Unauthenticated requests are redirected to `/login?callbackUrl=<original path>`.
- After sign-in, NextAuth uses `callbackUrl` to return the user to where they were going.
- Authenticated users cannot visit `/login` or `/signup` — they are sent to `/dashboard`.

---

## Protected Layout (`app/(app)/layout.tsx`)

Middleware is the primary guard, but the authenticated layout adds a server-side safety net. If somehow an unauthenticated request reaches this layout (e.g., during development with middleware bypassed), it redirects immediately.

```ts
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return <>{children}</>
}
```

This layout wraps all pages under `app/(app)/`. It does **not** replace middleware — both must stay in place.

---

## Session Access Patterns

### Server Components

```ts
import { auth } from '@/auth'

export default async function DashboardPage() {
  const session = await auth()
  // session.user.id is the MongoDB _id as a string.
  // Use it as the userId filter on every DB query (see Data Access section).
}
```

### API Route Handlers

```ts
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // session.user.id is safe to use as userId filter.
}
```

Every API route handler must perform this check. Never skip it even if middleware is active — defence in depth.

### Client Components

```ts
'use client'
import { useSession } from 'next-auth/react'

export function SomeClientComponent() {
  const { data: session, status } = useSession()
  if (status === 'loading') return <Spinner />
  if (!session) return null   // middleware should prevent this, but guard anyway
}
```

Client components **must not** make data-fetching decisions based on `session.user.id` directly — that belongs in server components and API routes only.

---

## Data Access — Identity Enforcement

This is the most critical section. Every database query that touches user-owned data **must** scope to the authenticated user's ID. This is enforced at two levels:

### Rule

> `session.user.id` from the server session is the only trusted source of the current user's identity. It must be included as a `userId` filter on every Mongoose query. A `userId` value supplied by the client (request body, query string, URL param) must **never** be used directly as a database filter.

### Application to each model

**Expense**

```ts
import { Types } from 'mongoose'

const userId = new Types.ObjectId(session.user.id)

// List
await Expense.find({ userId }).sort({ date: -1 })

// Single document — always include userId so a user cannot fetch another user's expense by ID
await Expense.findOne({ _id: expenseId, userId })

// Create — always stamp userId from session, never from request body
await Expense.create({ ...body, userId })

// Update
await Expense.findOneAndUpdate({ _id: expenseId, userId }, { $set: updates }, { new: true })

// Delete
await Expense.findOneAndDelete({ _id: expenseId, userId })
```

**ExpenseCategory**

```ts
await ExpenseCategory.find({ userId })
await ExpenseCategory.findOne({ _id: categoryId, userId })
await ExpenseCategory.create({ ...body, userId })
await ExpenseCategory.findOneAndUpdate({ _id: categoryId, userId }, { $set: updates })
await ExpenseCategory.findOneAndDelete({ _id: categoryId, userId })
```

**MonthlySummary**

```ts
await MonthlySummary.findOne({ userId, year, month })
await MonthlySummary.findOneAndUpdate(
  { userId, year, month },
  { $set: summary },
  { upsert: true, new: true },
)
```

### What happens when userId is absent from a query

If `userId` is omitted from a `findOne({ _id })` call, any authenticated user who guesses or obtains another user's document ID can read or modify it. The Mongoose schemas do not enforce this at the model level — it must be enforced in every query.

**Never do this:**
```ts
// WRONG — any authenticated user can reach any document
await Expense.findById(req.params.id)
await Expense.findOneAndDelete({ _id: req.params.id })
```

**Always do this:**
```ts
// CORRECT — scoped to the session user
await Expense.findOne({ _id: req.params.id, userId: new Types.ObjectId(session.user.id) })
```

---

## Registration Flow

Registration is handled by a dedicated API route — **not** by NextAuth. NextAuth only handles sign-in.

**`app/api/auth/register/route.ts`**

```ts
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectToDatabase, User } from '@/lib/db'

export async function POST(req: Request) {
  const { firstName, lastName, email, password } = await req.json()

  // Basic server-side validation — never trust client input
  if (!firstName || !lastName || !email || !password) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  await connectToDatabase()

  const existing = await User.findOne({ email: email.toLowerCase().trim() })
  if (existing) {
    // Return 409 but do not reveal whether the email is registered — 
    // use a generic message to avoid user enumeration.
    return NextResponse.json({ error: 'Unable to create account' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await User.create({
    firstName: firstName.trim(),
    lastName:  lastName.trim(),
    email:     email.toLowerCase().trim(),
    passwordHash,
  })

  return NextResponse.json({ success: true }, { status: 201 })
}
```

After successful registration, the signup page calls `signIn('credentials', { email, password, redirectTo: '/dashboard' })` to log the user in immediately.

### bcrypt cost factor

Use `bcrypt.hash(password, 12)`. Cost factor 12 provides strong resistance to brute-force attacks while remaining fast enough for interactive login (< 400ms on modern hardware). Do not lower this value.

---

## Cookie & Session Security

NextAuth v5 sets cookies automatically. The following properties are enforced by default in production and must not be overridden:

| Property | Value | Reason |
|---|---|---|
| `HttpOnly` | `true` | Prevents JavaScript access to the session cookie |
| `Secure` | `true` in production | Cookie only sent over HTTPS |
| `SameSite` | `Lax` | Protects against CSRF for navigation requests |
| `Path` | `/` | Cookie available site-wide |
| Max age | 30 days | Matches `session.maxAge` in config |

The `NEXTAUTH_SECRET` environment variable must be set to a cryptographically random string of at least 32 bytes. Generate it with:

```bash
openssl rand -base64 32
```

---

## Environment Variables

```bash
# .env.local
MONGODB_URI=mongodb://...
NEXTAUTH_SECRET=<output of openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000   # Set to production URL in deployment
```

`NEXTAUTH_SECRET` must never be committed to version control. In production, inject it via the hosting platform's secrets manager.

---

## Error Handling

### Sign-in failures

NextAuth redirects to `/login?error=CredentialsSignin` on failure. The login page reads the `error` query parameter and renders a HeroUI `addToast` notification or inline error message. Do not reveal whether the email or password specifically was wrong — use a generic message: "Invalid email or password."

### Unauthorized API responses

All API routes return `{ error: 'Unauthorized' }` with status `401` when no session exists. They return `{ error: 'Forbidden' }` with status `403` when a session exists but the requested resource does not belong to the session user (i.e., the scoped `findOne` returns `null`).

### 403 vs 404 for cross-user access

When a user requests a resource that exists but belongs to another user, return `404` rather than `403`. Returning `403` confirms the resource exists, which leaks information. Returning `404` treats it as non-existent from the requester's perspective.

---

## Security Checklist

Before shipping any authenticated feature, verify:

- [ ] Middleware is protecting the route
- [ ] The server component or API handler calls `auth()` and checks `session?.user?.id`
- [ ] Every Mongoose query includes `userId: new Types.ObjectId(session.user.id)` as a filter
- [ ] No `userId` from the request body or URL params is used as a DB filter
- [ ] Passwords are never logged, returned in responses, or included in the JWT/session
- [ ] `NEXTAUTH_SECRET` is set and not committed to source control
- [ ] Registration endpoint validates all fields server-side before writing to the database
- [ ] Error messages do not reveal whether an email address is registered
