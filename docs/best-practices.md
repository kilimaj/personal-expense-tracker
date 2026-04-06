# React & Next.js Best Practices

Adapted from the [Vercel agent-skills React best practices guide](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/AGENTS.md) for this production Next.js App Router application. Every rule here is binding — follow it unless a comment in the relevant code explicitly explains the deviation.

---

## 1. Eliminating Waterfalls

**Impact: CRITICAL** — Waterfalls are the #1 performance killer. Each sequential `await` adds full network latency.

### 1.1 Check cheap conditions before async calls

Evaluate inexpensive synchronous conditions before paying the cost of an async call.

```ts
// Wrong — pays for getFlag() even when someCondition is false
const flag = await getFlag()
if (flag && someCondition) { ... }

// Correct — skips the async call entirely when the cheap check fails
if (someCondition) {
  const flag = await getFlag()
  if (flag) { ... }
}
```

### 1.2 Defer `await` until the result is actually needed

Move `await` into the branches that use the result, not before.

```ts
// Wrong — always fetches permissions, even when resource is missing
async function updateExpense(id: string, userId: string) {
  const permissions = await fetchPermissions(userId)
  const expense = await Expense.findOne({ _id: id, userId })
  if (!expense) return { error: 'Not found' }
  if (!permissions.canEdit) return { error: 'Forbidden' }
  return updateExpenseData(expense)
}

// Correct — fetches permissions only when needed
async function updateExpense(id: string, userId: string) {
  const expense = await Expense.findOne({ _id: id, userId })
  if (!expense) return { error: 'Not found' }
  const permissions = await fetchPermissions(userId)
  if (!permissions.canEdit) return { error: 'Forbidden' }
  return updateExpenseData(expense)
}
```

### 1.3 Run independent operations in parallel with `Promise.all`

Never `await` two operations sequentially when they have no dependency on each other.

```ts
// Wrong — 3 round trips
const user = await fetchUser()
const categories = await fetchCategories()
const summary = await fetchMonthlySummary()

// Correct — 1 round trip
const [user, categories, summary] = await Promise.all([
  fetchUser(),
  fetchCategories(),
  fetchMonthlySummary(),
])
```

### 1.4 Start promises immediately in API route handlers

Kick off independent work before any `await` so it runs concurrently.

```ts
// Wrong — config waits for session to resolve
export async function GET() {
  const session = await auth()
  const config = await fetchConfig()
  const data = await fetchData(session.user.id)
  return Response.json({ data, config })
}

// Correct — session and config start together
export async function GET() {
  const sessionPromise = auth()
  const configPromise = fetchConfig()
  const session = await sessionPromise
  const [config, data] = await Promise.all([
    configPromise,
    fetchData(session.user.id),
  ])
  return Response.json({ data, config })
}
```

### 1.5 Use Suspense boundaries to unblock the surrounding UI

Don't `await` in a page component when only one section needs the data. Let the shell render immediately.

```tsx
// Wrong — entire page waits for data
async function DashboardPage() {
  const summary = await fetchMonthlySummary()
  return (
    <div>
      <Navbar />
      <SummaryCards summary={summary} />
      <Footer />
    </div>
  )
}

// Correct — Navbar and Footer render instantly, cards stream in
function DashboardPage() {
  return (
    <div>
      <Navbar />
      <Suspense fallback={<Skeleton />}>
        <SummaryCards />   {/* fetches its own data */}
      </Suspense>
      <Footer />
    </div>
  )
}
```

### 1.6 Chain nested fetches per-item, not after a full `Promise.all`

```ts
// Wrong — all author fetches wait for the slowest expense fetch
const expenses = await Promise.all(ids.map(id => getExpense(id)))
const categories = await Promise.all(expenses.map(e => getCategory(e.categoryId)))

// Correct — each expense chains its own category fetch independently
const results = await Promise.all(
  ids.map(id => getExpense(id).then(e => getCategory(e.categoryId)))
)
```

---

## 2. Bundle Size Optimization

**Impact: CRITICAL** — Smaller initial bundles mean faster Time to Interactive and better LCP scores.

### 2.1 Use `optimizePackageImports` for icon and component libraries

Next.js 13.5+ transforms barrel imports automatically. Configure it in `next.config.ts` rather than rewriting every import manually.

```ts
// next.config.ts
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@heroui/react'],
  },
}
```

Barrel files in libraries like `lucide-react` (1,583 modules) and `@heroui/react` add 200–800ms cold-start overhead without this setting.

### 2.2 Lazy-load heavy components with `next/dynamic`

```tsx
import dynamic from 'next/dynamic'

// Heavy chart or editor only loaded when the Reports tab is active
const ReportsChart = dynamic(() => import('./reports-chart'), { ssr: false })
```

### 2.3 Defer non-critical third-party scripts

```tsx
import dynamic from 'next/dynamic'

const Analytics = dynamic(
  () => import('@vercel/analytics/react').then(m => m.Analytics),
  { ssr: false }
)
```

### 2.4 Preload heavy modules on user intent

```tsx
function ReportsLink() {
  const preload = () => { void import('./reports-chart') }
  return (
    <a href="/reports" onMouseEnter={preload} onFocus={preload}>
      Reports
    </a>
  )
}
```

### 2.5 Load large data or feature modules conditionally

```tsx
useEffect(() => {
  if (enabled && typeof window !== 'undefined') {
    import('./heavy-export-module')
      .then(mod => setExporter(mod.default))
  }
}, [enabled])
```

---

## 3. Server-Side Performance

**Impact: HIGH**

### 3.1 Authenticate Server Actions the same way as API routes

Server Actions are public HTTP endpoints. Always verify the session inside the action — never rely solely on middleware or layout guards.

```ts
'use server'

import { auth } from '@/auth'
import { connectToDatabase, Expense } from '@/lib/db'
import { Types } from 'mongoose'

export async function deleteExpense(expenseId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  await connectToDatabase()
  const result = await Expense.findOneAndDelete({
    _id: expenseId,
    userId: new Types.ObjectId(session.user.id),   // always scope to session user
  })

  if (!result) throw new Error('Not found')
  return { success: true }
}
```

### 3.2 Parallelize data fetching with component composition

RSC components in the same tree execute sequentially unless they are siblings. Split fetching components so they render in parallel.

```tsx
// Wrong — Sidebar waits for Header to finish
async function DashboardPage() {
  const header = await fetchHeaderData()
  return (
    <div>
      <div>{header}</div>
      <Sidebar />           {/* starts after header resolves */}
    </div>
  )
}

// Correct — both fetch simultaneously
async function Header() {
  const data = await fetchHeaderData()
  return <div>{data}</div>
}

async function Sidebar() {
  const items = await fetchSidebarItems()
  return <nav>{items.map(renderItem)}</nav>
}

function DashboardPage() {
  return (
    <div>
      <Header />
      <Sidebar />
    </div>
  )
}
```

### 3.3 Use `React.cache()` for per-request deduplication

Wrap database queries used in multiple places across a single render tree so they execute only once per request.

```ts
import { cache } from 'react'
import { auth } from '@/auth'
import { connectToDatabase, User } from '@/lib/db'

export const getCurrentUser = cache(async () => {
  const session = await auth()
  if (!session?.user?.id) return null
  await connectToDatabase()
  return User.findById(session.user.id)
})
```

Use `React.cache()` for Mongoose queries, auth checks, and other non-`fetch` async work. Next.js deduplicates `fetch` calls automatically but not Mongoose operations.

### 3.4 Minimize data crossing the RSC boundary

Only pass fields the client component actually renders. The RSC serialization embeds everything into the HTML payload.

```tsx
// Wrong — serializes all 20 user fields
async function Page() {
  const user = await getCurrentUser()
  return <ProfileHeader user={user} />
}

// Correct — serializes 2 fields
async function Page() {
  const user = await getCurrentUser()
  return <ProfileHeader name={user.firstName} email={user.email} />
}
```

### 3.5 Avoid shared module-level mutable state for request data

Server components can run concurrently. Module-level variables are shared across all concurrent renders in the same process.

```ts
// Wrong — race condition: request B overwrites currentUser before request A finishes rendering
let currentUser: User | null = null
export default async function Page() {
  currentUser = await auth()
  return <Dashboard />
}

// Correct — pass data through the component tree
export default async function Page() {
  const user = await auth()
  return <Dashboard user={user} />
}
```

### 3.6 Hoist static asset loading to module scope

File and network reads at module scope execute once. Inside a route handler, they execute on every request.

```ts
// Wrong — reads font on every OG image request
export async function GET() {
  const font = await fetch(new URL('./Inter.ttf', import.meta.url))
    .then(r => r.arrayBuffer())
  return new ImageResponse(...)
}

// Correct — loaded once when the module is first imported
const fontPromise = fetch(new URL('./Inter.ttf', import.meta.url))
  .then(r => r.arrayBuffer())

export async function GET() {
  const font = await fontPromise
  return new ImageResponse(...)
}
```

### 3.7 Use `after()` for non-blocking post-response work

```ts
import { after } from 'next/server'

export async function POST(req: Request) {
  await saveExpense(req)

  after(async () => {
    await logAuditEvent({ action: 'expense.created' })
  })

  return Response.json({ success: true })
}
```

Analytics, audit logs, and cache invalidation should not block the response.

---

## 4. Client-Side Data Fetching

### 4.1 Use SWR for client-side data with automatic deduplication

```ts
import useSWR from 'swr'

function ExpenseList() {
  const { data, error, isLoading } = useSWR('/api/expenses', fetcher)
}
```

Multiple components calling `useSWR` with the same key share one request automatically.

### 4.2 Use passive event listeners for scroll and touch

```ts
useEffect(() => {
  const handler = (e: TouchEvent) => trackGesture(e)
  window.addEventListener('touchstart', handler, { passive: true })
  return () => window.removeEventListener('touchstart', handler)
}, [])
```

### 4.3 Deduplicate global event listeners

When a hook is used in multiple component instances, use a module-level Map so only one listener is ever registered.

```ts
const keyCallbacks = new Map<string, Set<() => void>>()

function useKeyboardShortcut(key: string, callback: () => void) {
  useEffect(() => {
    if (!keyCallbacks.has(key)) keyCallbacks.set(key, new Set())
    keyCallbacks.get(key)!.add(callback)
    return () => {
      const set = keyCallbacks.get(key)
      if (set) {
        set.delete(callback)
        if (set.size === 0) keyCallbacks.delete(key)
      }
    }
  }, [key, callback])
}
```

### 4.4 Version and minimize `localStorage` data

```ts
const V = 'v1'

function savePrefs(prefs: UserPrefs) {
  try {
    localStorage.setItem(`prefs:${V}`, JSON.stringify(prefs))
  } catch {
    // incognito, quota exceeded, or storage disabled
  }
}
```

---

## 5. Re-render Optimization

### 5.1 Derive state during render — don't sync it with effects

```ts
// Wrong — extra state + effect = extra render cycle
const [fullName, setFullName] = useState('')
useEffect(() => { setFullName(`${first} ${last}`) }, [first, last])

// Correct — derive inline
const fullName = `${first} ${last}`
```

### 5.2 Never define components inside other components

Defining a component inside another creates a new type every render, causing remount and state loss.

```ts
// Wrong
function ExpenseForm() {
  function Row({ label }: { label: string }) { ... }  // new type every render
  return <Row label="Amount" />
}

// Correct
function Row({ label }: { label: string }) { ... }
function ExpenseForm() {
  return <Row label="Amount" />
}
```

### 5.3 Use functional `setState` updates to avoid stale closures

```ts
const addExpense = useCallback((expense: Expense) => {
  setExpenses(prev => [...prev, expense])
}, [])   // no dependency on `expenses`
```

### 5.4 Split `useMemo` when dependencies differ

```ts
// Wrong — sort reruns when only category changes
const sorted = useMemo(
  () => expenses.filter(e => e.category === cat).toSorted(...),
  [expenses, cat, sortOrder]
)

// Correct — each step only reruns when its own inputs change
const filtered = useMemo(
  () => expenses.filter(e => e.category === cat),
  [expenses, cat]
)
const sorted = useMemo(
  () => filtered.toSorted((a, b) => ...),
  [filtered, sortOrder]
)
```

### 5.5 Don't wrap simple primitive expressions in `useMemo`

```ts
// Wrong — overhead exceeds benefit
const isLoading = useMemo(
  () => userLoading || categoriesLoading,
  [userLoading, categoriesLoading]
)

// Correct — just compute inline
const isLoading = userLoading || categoriesLoading
```

### 5.6 Use lazy `useState` initialisation for expensive computations

```ts
const [filters, setFilters] = useState(() => {
  const saved = localStorage.getItem('expense-filters')
  return saved ? JSON.parse(saved) : defaultFilters
})
```

Without the function form, `JSON.parse` runs on every render.

### 5.7 Extract module-level constants for default non-primitive props in memoized components

```ts
const NOOP = () => {}
const EMPTY_ARRAY: never[] = []

const ExpenseRow = memo(function ExpenseRow({
  onDelete = NOOP,
  tags = EMPTY_ARRAY,
}: Props) { ... })
```

Inline default objects and functions break `memo`'s shallow equality check.

### 5.8 Use `useTransition` instead of manual loading state

```tsx
const [isPending, startTransition] = useTransition()

function handleFilter(category: string) {
  setCategory(category)           // immediate
  startTransition(async () => {
    const data = await fetchExpenses({ category })
    setExpenses(data)
  })
}
```

### 5.9 Use `useDeferredValue` for expensive derived renders

```tsx
const deferredQuery = useDeferredValue(query)
const filtered = useMemo(
  () => expenses.filter(e => matches(e, deferredQuery)),
  [expenses, deferredQuery]
)
const isStale = query !== deferredQuery
```

### 5.10 Use `useRef` for values that change often but don't drive rendering

```ts
const lastScrollY = useRef(0)
useEffect(() => {
  const handler = () => { lastScrollY.current = window.scrollY }
  window.addEventListener('scroll', handler, { passive: true })
  return () => window.removeEventListener('scroll', handler)
}, [])
```

### 5.11 Put interaction logic in event handlers, not effects

```tsx
// Wrong — action modelled as state + effect
function handleSubmit() { setSubmitted(true) }
useEffect(() => { if (submitted) post('/api/expenses', data) }, [submitted])

// Correct — action in the handler directly
function handleSubmit() { post('/api/expenses', data) }
```

### 5.12 Subscribe to derived boolean state, not continuous values

```ts
// Rerenders only when crossing the breakpoint, not on every pixel
const isMobile = useMediaQuery('(max-width: 767px)')
```

---

## 6. Rendering Performance

### 6.1 Use `content-visibility: auto` for long lists

```css
.expense-row {
  content-visibility: auto;
  contain-intrinsic-size: 0 64px;
}
```

For 500+ rows, the browser skips layout and paint for off-screen items.

### 6.2 Wrap SVG animations in a `<div>`

Most browsers do not hardware-accelerate CSS transforms on SVG elements directly.

```tsx
// Correct
<div className="animate-spin">
  <svg viewBox="0 0 24 24">...</svg>
</div>
```

### 6.3 Hoist static JSX to module scope

```tsx
// Recreated every render
function Container() {
  return <>{loading && <div className="animate-pulse h-16 bg-default-100" />}</>
}

// Reuses the same element reference
const skeleton = <div className="animate-pulse h-16 bg-default-100" />
function Container() {
  return <>{loading && skeleton}</>
}
```

### 6.4 Use `next/script` with `strategy` instead of raw `<script>` tags

```tsx
import Script from 'next/script'

<Script src="https://analytics.example.com/script.js" strategy="afterInteractive" />
```

Raw script tags without `defer`/`async` block HTML parsing.

### 6.5 Prevent hydration mismatch for client-only values without flickering

```tsx
function ThemeWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <div id="theme-root">{children}</div>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
            try {
              var t = localStorage.getItem('theme') || 'light';
              document.getElementById('theme-root').className = t;
            } catch(e){}
          })()`,
        }}
      />
    </>
  )
}
```

`useEffect` causes a visible flash. An inline script runs synchronously before paint, eliminating the flicker.

### 6.6 Use explicit ternary rendering — never `&&` with numbers

```tsx
// Wrong — renders "0" when count is 0
{count && <Badge>{count}</Badge>}

// Correct
{count > 0 ? <Badge>{count}</Badge> : null}
```

### 6.7 Use `<Activity>` for components that toggle visibility frequently

```tsx
import { Activity } from 'react'

function ExpenseDrawer({ isOpen }: { isOpen: boolean }) {
  return (
    <Activity mode={isOpen ? 'visible' : 'hidden'}>
      <ExpenseDetailPanel />
    </Activity>
  )
}
```

Avoids remounting and state loss for expensive panels.

### 6.8 Use React DOM resource hints for critical assets

```tsx
import { preconnect, preload } from 'react-dom'

export default function RootLayout({ children }) {
  preconnect('https://fonts.gstatic.com')
  preload('/fonts/inter.woff2', { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' })
  return <html><body>{children}</body></html>
}
```

### 6.9 Use `useTransition` over manual loading state booleans

See §5.8. `isPending` resets correctly even when the transition throws; manual `setIsLoading` does not.

---

## 7. JavaScript Performance

### 7.1 Build index Maps for repeated lookups

```ts
// O(n) per lookup — wrong
const category = categories.find(c => c._id === expense.categoryId)

// O(1) per lookup — correct
const categoryById = new Map(categories.map(c => [c._id.toString(), c]))
const category = categoryById.get(expense.categoryId.toString())
```

### 7.2 Use `toSorted()` instead of `sort()` — never mutate props or state

```ts
// Wrong — mutates the prop array
const sorted = expenses.sort((a, b) => b.amount - a.amount)

// Correct — returns a new array
const sorted = expenses.toSorted((a, b) => b.amount - a.amount)
```

### 7.3 Use `flatMap` to map and filter in one pass

```ts
// 2 iterations + intermediate array
const names = expenses
  .map(e => e.isVisible ? e.description : null)
  .filter(Boolean)

// 1 iteration, no intermediate array
const names = expenses.flatMap(e =>
  e.isVisible ? [e.description] : []
)
```

### 7.4 Find min/max with a loop, not sort

```ts
// O(n log n) — wrong
const largest = expenses.toSorted((a, b) => b.amount - a.amount)[0]

// O(n) — correct
let largest = expenses[0]
for (let i = 1; i < expenses.length; i++) {
  if (expenses[i].amount > largest.amount) largest = expenses[i]
}
```

### 7.5 Use `Set`/`Map` for repeated membership checks

```ts
// O(n) per check
if (activeIds.includes(expense._id.toString())) { ... }

// O(1) per check
const activeSet = new Set(activeIds)
if (activeSet.has(expense._id.toString())) { ... }
```

### 7.6 Check array length before expensive comparisons

```ts
function hasChanges(a: string[], b: string[]) {
  if (a.length !== b.length) return true    // O(1) early exit
  const sorted = a.toSorted()
  const orig   = b.toSorted()
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== orig[i]) return true
  }
  return false
}
```

### 7.7 Combine multiple array iterations into one loop

```ts
// 3 passes — wrong
const overBudget  = expenses.filter(e => e.amount > e.budget)
const thisMonth   = expenses.filter(e => isThisMonth(e.date))
const uncategorized = expenses.filter(e => !e.categoryId)

// 1 pass — correct
const overBudget: Expense[] = []
const thisMonth: Expense[] = []
const uncategorized: Expense[] = []

for (const e of expenses) {
  if (e.amount > e.budget) overBudget.push(e)
  if (isThisMonth(e.date)) thisMonth.push(e)
  if (!e.categoryId) uncategorized.push(e)
}
```

### 7.8 Hoist RegExp creation

```tsx
// Wrong — new RegExp on every render
function Highlighter({ text, query }: Props) {
  const regex = new RegExp(`(${query})`, 'gi')
  ...
}

// Correct — memoized per query change
function Highlighter({ text, query }: Props) {
  const regex = useMemo(
    () => new RegExp(`(${escapeRegex(query)})`, 'gi'),
    [query]
  )
  ...
}
```

### 7.9 Defer non-critical work with `requestIdleCallback`

```ts
function handleAddExpense(expense: Expense) {
  saveExpense(expense)          // critical

  requestIdleCallback(() => {
    updateMonthlySummaryCache(expense)   // non-critical
  })
}
```

### 7.10 Batch DOM reads and writes — avoid layout thrashing

```ts
// Wrong — interleaved read/write forces multiple reflows
el.style.width = '100px'
const w = el.offsetWidth      // forces reflow
el.style.height = '200px'

// Correct — all writes first, read once
el.style.width  = '100px'
el.style.height = '200px'
const { width } = el.getBoundingClientRect()
```

Prefer toggling CSS classes over inline style mutations when possible.

### 7.11 Cache module-level `localStorage` reads

```ts
const _cache = new Map<string, string | null>()

function getLocal(key: string) {
  if (!_cache.has(key)) _cache.set(key, localStorage.getItem(key))
  return _cache.get(key)
}

function setLocal(key: string, value: string) {
  localStorage.setItem(key, value)
  _cache.set(key, value)
}
```

---

## 8. Advanced Patterns

### 8.1 Never include `useEffectEvent` functions in dependency arrays

```tsx
const onMessage = useEffectEvent((msg: Message) => {
  onReceive(msg)  // always reads latest onReceive
})

useEffect(() => {
  const unsub = subscribe(roomId, onMessage)
  return unsub
}, [roomId])   // onMessage intentionally omitted
```

### 8.2 Initialize app-level singletons at module scope, not in `useEffect`

```ts
// Module scope — runs once when the module loads
const dbConnection = connectToDatabase()

function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    dbConnection.then(() => setReady(true))
  }, [])
  if (!ready) return <Spinner />
  return <AppShell />
}
```

This is especially important in Next.js where navigation unmounts and remounts components.

### 8.3 Store event handlers in refs for stable subscriptions

```ts
const handlerRef = useRef<() => void>()

useEffect(() => {
  handlerRef.current = () => doSomethingWith(currentValue)
}, [currentValue])

useEffect(() => {
  const handler = () => handlerRef.current?.()
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}, [])   // registered once, ref keeps the logic fresh
```

### 8.4 Use `useEffectEvent` for stable callbacks with latest state

```tsx
import { useEffectEvent } from 'react'

function ExpenseSubscriber({ expenseId, onUpdate }: Props) {
  const handleUpdate = useEffectEvent((data: ExpenseUpdate) => {
    onUpdate(data)    // always calls the latest onUpdate prop
  })

  useEffect(() => {
    const unsub = subscribeToExpense(expenseId, handleUpdate)
    return unsub
  }, [expenseId])    // re-subscribes only when expenseId changes
}
```

---

## Quick Reference — What to Reach for First

| Situation | Rule |
|---|---|
| Two independent fetches | `Promise.all` (§1.3) |
| RSC with slow data | Suspense boundary (§1.5) |
| Heavy component on load | `next/dynamic` (§2.2) |
| Same DB query in multiple components | `React.cache()` (§3.3) |
| Mutation after response | `after()` (§3.7) |
| Client data with caching | `useSWR` (§4.1) |
| State derived from other state | Derive inline (§5.1) |
| Loading state for async work | `useTransition` (§5.8) |
| Frequent value that doesn't drive UI | `useRef` (§5.10) |
| Long scrollable list | `content-visibility` (§6.1) |
| Repeated array lookups by key | `Map` index (§7.1) |
| Sorting state/props arrays | `toSorted()` (§7.2) |
| Filter + map combined | `flatMap` (§7.3) |
| Callback that should not retrigger effects | `useEffectEvent` (§8.4) |
