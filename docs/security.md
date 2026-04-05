# Security Specification — Personal Expense Tracker

This document is the authoritative reference for all security decisions in this project. Read it before writing any code that touches credentials, environment variables, user data, API responses, or deployment configuration. Every rule here is binding.

---

## Core Rules — Non-Negotiable

1. **Never hardcode a secret.** No API keys, database passwords, tokens, or credentials anywhere in source code — not in comments, not in config files, not in test fixtures.
2. **Never commit `.env`, `.env.local`, or any file containing real credentials to Git.** The only env file committed is `.env.example`, which contains only placeholder values.
3. **Never expose secrets in client-side code.** Anything bundled and sent to the browser is public. Treat it that way.
4. **Never log secrets.** No passwords, tokens, connection strings, or full request bodies containing credentials in any log output.
5. **Never expose internal error details to the user.** Stack traces, database error messages, and library internals stay on the server. See `docs/errors-and-validation.md`.

---

## Environment Variables

### The three files

| File | Committed | Contains |
|---|---|---|
| `.env.example` | Yes | Placeholder keys with no real values. Documents every variable the project needs. |
| `.env.local` | No — blocked by `.gitignore` | Real values for local development. Never committed. |
| `.env` | No — blocked by `.gitignore` | Not used in this project. Docker Compose reads from `.env.local` or shell environment. |

`.gitignore` already blocks all `.env*` files except `.env.example`:

```
.env*
!.env.example
```

Do not add exceptions to this rule. If a tool requires a named env file in a specific location, ensure that file is also listed in `.gitignore` before creating it.

### The variables this project uses

Every variable the app needs must have an entry in `.env.example`. If you add a new secret, add a placeholder to `.env.example` at the same time.

```bash
# .env.example — commit this, never commit .env.local

# MongoDB Docker credentials — used by docker-compose.yml
MONGO_INITDB_ROOT_USERNAME=changeme
MONGO_INITDB_ROOT_PASSWORD=changeme
MONGO_INITDB_DATABASE=expense_tracker

# MongoDB connection URI — used by the Next.js application
MONGODB_URI=mongodb://changeme:changeme@localhost:27017/expense_tracker?authSource=admin

# NextAuth — authentication
# Generate with: openssl rand -base64 32
AUTH_SECRET=

# NextAuth — set to your production domain in deployment
NEXTAUTH_URL=http://localhost:3000
```

### What each variable is for

| Variable | Used by | Sensitivity |
|---|---|---|
| `MONGO_INITDB_ROOT_USERNAME` | `docker-compose.yml` | HIGH — database root username |
| `MONGO_INITDB_ROOT_PASSWORD` | `docker-compose.yml` | HIGH — database root password |
| `MONGO_INITDB_DATABASE` | `docker-compose.yml` | LOW — not a secret, just a name |
| `MONGODB_URI` | `lib/db/connection.ts` | CRITICAL — contains credentials and connection endpoint |
| `AUTH_SECRET` | `auth.ts` (NextAuth) | CRITICAL — signs and verifies all session tokens |
| `NEXTAUTH_URL` | NextAuth | LOW — public base URL, not a secret |

### Generating `AUTH_SECRET`

`AUTH_SECRET` must be a cryptographically random string. Never invent one manually.

```bash
openssl rand -base64 32
```

Generate a new value per environment (local, staging, production). Never reuse the same secret across environments.

### Accessing environment variables in code

Server-side only — access via `process.env`. Validate at startup so the app fails fast with a clear message rather than silently misbehaving at runtime.

```ts
// lib/db/connection.ts — already implemented this way
const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error(
    'MONGODB_URI environment variable is not defined. ' +
    'Add it to .env.local for development.'
  )
}
```

Apply the same pattern to any new required variable:

```ts
const AUTH_SECRET = process.env.AUTH_SECRET
if (!AUTH_SECRET) {
  throw new Error('AUTH_SECRET is not defined. Generate one with: openssl rand -base64 32')
}
```

---

## Client-Side vs Server-Side Variables

Next.js exposes variables to the browser only when they are prefixed with `NEXT_PUBLIC_`. Everything else is server-only.

### Rule

**No secret should ever have the `NEXT_PUBLIC_` prefix.** A `NEXT_PUBLIC_` variable is bundled into the JavaScript sent to every browser and is visible in the page source, the network tab, and the built `.js` files. It is permanently public.

| Variable type | Prefix | Accessible in |
|---|---|---|
| Public config (safe to expose) | `NEXT_PUBLIC_` | Server + browser |
| Secret (must never be exposed) | *(no prefix)* | Server only |

The variables this project currently uses — `MONGODB_URI`, `AUTH_SECRET`, `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD` — must never have the `NEXT_PUBLIC_` prefix. Adding it would expose database credentials and session signing keys to every visitor.

### How secrets flow to the client — what is and is not safe

```
MONGODB_URI           ← server only (connection.ts) → DB query result → safe to send
AUTH_SECRET           ← server only (auth.ts)       → session token  → safe to send
session.user.id       ← session object               → safe to send to client
session.user.email    ← session object               → safe to send to client
user.passwordHash     ← database field               → NEVER send, never include in API response
```

Never query and return `passwordHash` from the database. Never include it in a serialised user object.

```ts
// Wrong — leaks the hash
const user = await User.findById(id)
return NextResponse.json({ data: user })

// Correct — exclude sensitive fields explicitly
const user = await User.findById(id).select('-passwordHash')
return NextResponse.json({ data: user })
```

---

## Secrets in Logs

Logging is the most common accidental leak vector. Apply these rules to every `console.log`, `console.error`, and any future structured logger.

### Never log

- Passwords or password hashes
- The full `MONGODB_URI` (it contains credentials)
- Session tokens or JWTs
- Full request bodies when they may contain passwords (e.g. login, register)
- The `AUTH_SECRET` value

### Safe to log

- User IDs (opaque MongoDB ObjectIds)
- Route names and HTTP methods
- Error types and sanitised messages
- Timestamps and request metadata (without auth headers)

### Pattern for error logging

```ts
// Wrong — may leak connection string or internal error with credentials
console.error('Database error:', err)

// Correct — log the error type and a safe prefix, not the full object blindly
// For known errors, log a structured summary
console.error('[POST /api/expenses] Failed to create expense', {
  userId: session.user.id,
  errorName: err instanceof Error ? err.name : 'UnknownError',
})

// For unexpected errors during development, the full error is acceptable
// In production, use a structured error service (e.g. Sentry) that strips PII
console.error('[POST /api/expenses]', err)
```

The full `err` object is acceptable to log server-side because it stays on the server. What must never happen is sending it to the client or writing it to a public log stream that users can read.

---

## Git Safety

### What is already protected

`.gitignore` currently blocks:

```
.env*              # all env files except .env.example
*.pem              # certificate private keys
.mcp.json          # MCP config (may contain local credentials)
```

### Checking before every commit

Before committing, verify no secret files are staged:

```bash
git status
git diff --cached
```

If a secret is accidentally staged, unstage it before committing:

```bash
git restore --staged .env.local
```

### If a secret is accidentally committed

**Act immediately.** A committed secret must be treated as compromised even if the repository is private.

1. **Revoke the secret immediately.** Rotate the database password, regenerate `AUTH_SECRET`, invalidate any API key. Do not wait.
2. Remove the secret from history using `git filter-repo` or BFG Repo Cleaner. Removing it from the latest commit is not enough — it remains in the full Git history.
3. Force-push the cleaned history and notify any collaborators to re-clone.
4. If the repository was ever public, even briefly, assume the secret was scraped. Rotation is the only remedy.

```bash
# Install git-filter-repo (one-time)
pip install git-filter-repo

# Remove the file from all history
git filter-repo --path .env.local --invert-paths --force
```

### Pre-commit protection (recommended)

Add a pre-commit hook to scan for accidental secret patterns. Tools like `git-secrets` or `truffleHog` can be configured to block commits containing patterns that look like connection strings, API keys, or private keys.

```bash
# Example: block commits containing mongodb:// with credentials
# .git/hooks/pre-commit
grep -r "mongodb://[^@]*:[^@]*@" --include="*.ts" --include="*.js" --include="*.json" . \
  && echo "ERROR: Possible MongoDB credentials detected in source files." && exit 1 || exit 0
```

---

## Docker Compose Security

`docker-compose.yml` reads credentials from environment variables — it never hardcodes them:

```yaml
environment:
  MONGO_INITDB_ROOT_USERNAME: ${MONGO_INITDB_ROOT_USERNAME}
  MONGO_INITDB_ROOT_PASSWORD: ${MONGO_INITDB_ROOT_PASSWORD}
  MONGO_INITDB_DATABASE:      ${MONGO_INITDB_DATABASE}
```

This is correct. The values come from the shell environment or `.env.local`. Docker Compose automatically reads `.env` in the project root — place development values in `.env.local` and source it before running Compose, or use the `--env-file` flag:

```bash
docker compose --env-file .env.local up -d
```

**Never commit a `docker-compose.override.yml` or any Compose file that contains hardcoded credentials.**

---

## Deployment — Environment Variable Management

### Development

- Values live in `.env.local` at the project root.
- `.env.local` is loaded automatically by Next.js during `npm run dev`.
- Never share `.env.local` over Slack, email, or any communication channel. Use a secrets manager or a secure vault (e.g. 1Password, Bitwarden) to share secrets with teammates.

### Production (Vercel)

Environment variables are injected through the Vercel dashboard — never through committed files.

1. Go to **Project → Settings → Environment Variables** in the Vercel dashboard.
2. Add each variable with its production value.
3. Set the correct scope: `Production`, `Preview`, or `Development`.
4. Use different values for production and preview environments, especially for `AUTH_SECRET` and `MONGODB_URI`.

Variables set in the Vercel dashboard are encrypted at rest and injected at build and runtime. They are never written to the filesystem or the build output.

```
Production environment:
  MONGODB_URI        → points to production Atlas cluster
  AUTH_SECRET        → unique production value (openssl rand -base64 32)
  NEXTAUTH_URL       → https://your-production-domain.com

Preview environment:
  MONGODB_URI        → points to staging Atlas cluster or separate database
  AUTH_SECRET        → unique preview value (different from production)
  NEXTAUTH_URL       → https://your-preview-url.vercel.app
```

### MongoDB Atlas (production database)

- Enable **IP allowlist** — only allow connections from your deployment platform's IP ranges, not `0.0.0.0/0`.
- Create a **dedicated database user** for the application with the minimum required permissions (readWrite on the app database only). Do not use the root user.
- Enable **TLS/SSL** on all connections (Atlas enforces this by default).
- Enable **MongoDB Atlas Auditing** for production to track access and mutations.
- Rotate the database password periodically and update `MONGODB_URI` in your deployment platform's secret store.

---

## Next.js-Specific Security

### Server Components fetch data, Client Components display it

Keep data fetching on the server. Client Components receive only the data they need to render — not raw database documents.

```tsx
// Correct — server component fetches, passes only what's needed
async function ExpensePage() {
  const session = await auth()
  const expenses = await Expense.find({ userId: session.user.id })
    .select('description amount date categoryId')  // explicit field selection
    .lean()
  return <ExpenseList expenses={expenses} />
}
```

Never pass full Mongoose documents, `_id` fields you don't need, or fields that exist only for internal use to Client Components.

### `NEXT_PUBLIC_` audit

Periodically check that no secret is accidentally prefixed with `NEXT_PUBLIC_`:

```bash
grep -r "NEXT_PUBLIC_" .env.local .env.example next.config.ts 2>/dev/null
```

None of the current variables (`MONGODB_URI`, `AUTH_SECRET`, `MONGO_INITDB_*`) should ever appear in this output.

### Security headers

Add security headers in `next.config.ts` to protect against common browser-level attacks:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",   // tighten once nonce-based CSP is added
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

---

## Dependency Security

- Run `npm audit` regularly and before major deployments.
- Pin dependency versions in `package.json` (`^` is acceptable; avoid `*`).
- Review new dependencies before adding them — a compromised package is a supply chain attack.
- Keep `next`, `next-auth`, and `mongoose` up to date. Security patches in these packages are critical.

```bash
npm audit
npm audit fix       # apply safe fixes
npm outdated        # see what has updates
```

---

## Security Checklist

### Before every commit

- [ ] `git status` shows no `.env*` files (other than `.env.example`) in the staged changes
- [ ] No hardcoded passwords, tokens, or connection strings in any changed file
- [ ] No `console.log` statements that print request bodies, session data, or credentials

### Before shipping a new feature

- [ ] All secrets are read from `process.env`, with a startup check if the variable is required
- [ ] No new variable has the `NEXT_PUBLIC_` prefix unless it is genuinely safe to expose
- [ ] API responses do not include `passwordHash` or any other credential field
- [ ] `.env.example` is updated with a placeholder for any new variable
- [ ] Error responses return generic messages — no stack traces, no internal error details (see `docs/errors-and-validation.md`)
- [ ] All Mongoose queries scope to `userId` (see `docs/auth.md`)

### Before deploying to production

- [ ] All environment variables are set in the deployment platform (Vercel), not in committed files
- [ ] `AUTH_SECRET` in production is a unique value generated with `openssl rand -base64 32`
- [ ] `MONGODB_URI` points to the production database, not localhost
- [ ] `NEXTAUTH_URL` is set to the production domain
- [ ] MongoDB Atlas IP allowlist is configured — `0.0.0.0/0` is not acceptable in production
- [ ] The database user in `MONGODB_URI` has the minimum required permissions (not the root user)
- [ ] `npm audit` has been run with no critical or high vulnerabilities outstanding
