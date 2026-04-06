# Data Mutations Specification — Personal Expense Tracker

This document is the authoritative reference for all data mutation patterns. Read it before writing any Server Action, form submission handler, or component that modifies data. All patterns here are binding.

---

## Principles

1. **All mutations go through Server Actions.** No client-side `fetch()` to mutation API routes, no inline `POST /api/*` calls from components. The only exception is the `/api/auth/register` route, which exists for the initial signup flow before a session is established.
2. **Never use `FormData` as an input type.** Server Actions accept strongly typed objects validated with Zod. The type comes from `z.infer<typeof schema>` — never from `FormData`.
3. **Every action authenticates first.** The session is checked at the top of every action, before any other logic. No mutation can succeed without a valid `session.user.id`.
4. **Every database write is scoped to the authenticated user.** The `userId` field is always set from `session.user.id`, never from client input.
5. **Actions return a typed result — they never throw to the client.** Errors are caught inside the action and returned as structured data. The calling component reads the result and handles it.
6. **Cache is invalidated explicitly.** After a successful write, `revalidatePath` or `revalidateTag` is called so the UI reflects the change on next render.

---

## File Conventions

Server Actions are co-located with the feature they serve. Each protected route segment has an `actions.ts` file alongside its `page.tsx`.

```
app/
  (app)/
    expenses/
      page.tsx          # Server Component — reads data
      actions.ts        # 'use server' — mutations for expenses
    budgets/
      page.tsx
      actions.ts
    categories/
      page.tsx
      actions.ts
    settings/
      page.tsx
      actions.ts
```

Every `actions.ts` starts with the `'use server'` directive at the top of the file. This marks every exported function in the file as a Server Action.

```ts
// app/(app)/expenses/actions.ts
'use server'

// exports here are all Server Actions
```

Do not add `'use server'` to individual functions when you have a dedicated actions file — apply it once at the file level.

---

## The `ActionResult` Type

Every Server Action returns a consistent result shape. Define this type once and reuse it.

```ts
// lib/types/actions.ts
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fields?: Record<string, string> }
```

- `success: true` — the action completed. `data` carries any return value the client needs (e.g., a newly created record's `id` for redirect purposes).
- `success: false` — the action failed. `error` is a user-friendly message. `fields` is an optional map of Zod field errors, keyed by field name.

Import this type in both the actions file and the client component that calls the action.

---

## Server Action Structure

Every action follows this exact structure. Do not deviate from the order.

```ts
'use server'

import { auth } from '@/auth'
import { connectToDatabase, Expense } from '@/lib/db'
import { createExpenseSchema, type CreateExpenseInput } from '@/lib/validations/expense'
import { formatZodErrors } from '@/lib/validations/utils'
import { revalidatePath } from 'next/cache'
import { Types } from 'mongoose'
import type { ActionResult } from '@/lib/types/actions'

export async function createExpenseAction(
  input: unknown
): Promise<ActionResult> {
  // 1. Authenticate — always first, no exceptions
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'You must be signed in to do this.' }
  }

  // 2. Validate input with Zod
  const result = createExpenseSchema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      error: 'Please fix the errors below.',
      fields: formatZodErrors(result.error),
    }
  }

  // 3. Perform the database write — userId always comes from the session
  try {
    await connectToDatabase()
    await Expense.create({
      ...result.data,
      userId: new Types.ObjectId(session.user.id),
    })
  } catch (err) {
    console.error('[createExpenseAction]', err)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }

  // 4. Invalidate the cache so the updated list is fetched on next render
  revalidatePath('/expenses')

  return { success: true }
}
```

### Why `input: unknown` and not the typed input directly

The action's parameter is typed as `unknown` because Server Actions receive serialised data over the network. Even when the client passes a strongly typed object, it is serialised and deserialised at the boundary. Typing the parameter as `unknown` makes the Zod validation step non-optional — the code won't compile if you skip it.

Once `safeParse` succeeds, use only `result.data`. It is typed, validated, and transformed. The raw `input` is discarded.

---

## Update and Delete Actions

### Update — scope the query to both `_id` and `userId`

```ts
export async function updateExpenseAction(
  expenseId: string,
  input: unknown,
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'You must be signed in to do this.' }
  }

  const result = updateExpenseSchema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      error: 'Please fix the errors below.',
      fields: formatZodErrors(result.error),
    }
  }

  try {
    await connectToDatabase()
    const updated = await Expense.findOneAndUpdate(
      { _id: expenseId, userId: session.user.id }, // userId scope is mandatory
      { $set: result.data },
      { new: true },
    )

    if (!updated) {
      // Resource not found OR belongs to another user — treat both as 404
      return { success: false, error: 'This expense doesn\'t exist or you don\'t have access to it.' }
    }
  } catch (err) {
    console.error('[updateExpenseAction]', err)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }

  revalidatePath('/expenses')
  return { success: true }
}
```

### Delete — verify ownership before deleting

```ts
export async function deleteExpenseAction(expenseId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'You must be signed in to do this.' }
  }

  try {
    await connectToDatabase()
    const deleted = await Expense.findOneAndDelete({
      _id: expenseId,
      userId: session.user.id, // ownership check is part of the query
    })

    if (!deleted) {
      return { success: false, error: 'This expense doesn\'t exist or you don\'t have access to it.' }
    }
  } catch (err) {
    console.error('[deleteExpenseAction]', err)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }

  revalidatePath('/expenses')
  return { success: true }
}
```

Never do a `findById` followed by a separate ownership check. The query `{ _id, userId }` is atomic — ownership is verified and the document is fetched in one operation. A null result means either not found or not owned; return the same response for both.

---

## Calling Actions from Client Components

Client Components call Server Actions like regular async functions. Use `react-hook-form` to collect and validate data client-side, then pass the typed result to the action.

### Full form pattern

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input, Button, Alert } from '@heroui/react'
import { createExpenseSchema, type CreateExpenseInput } from '@/lib/validations/expense'
import { createExpenseAction } from '@/app/(app)/expenses/actions'

export function CreateExpenseForm() {
  const router   = useRouter()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
  })

  async function onSubmit(data: CreateExpenseInput) {
    setFormError(null)

    // `data` is already typed and client-validated by react-hook-form + Zod.
    // Pass it directly to the action — do not construct FormData.
    const result = await createExpenseAction(data)

    if (!result.success) {
      // Bind server field errors back into the form inputs
      if (result.fields) {
        Object.entries(result.fields).forEach(([field, message]) => {
          setError(field as keyof CreateExpenseInput, { message })
        })
      }
      setFormError(result.error)
      return
    }

    router.push('/expenses')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError && (
        <Alert color="danger" title={formError} className="mb-4" />
      )}

      <Input
        label="Description"
        variant="bordered"
        isRequired
        isInvalid={!!errors.description}
        errorMessage={errors.description?.message}
        {...register('description')}
      />

      <Input
        label="Amount"
        type="number"
        variant="bordered"
        isRequired
        isInvalid={!!errors.amount}
        errorMessage={errors.amount?.message}
        {...register('amount', { valueAsNumber: true })}
      />

      <Button type="submit" color="primary" isLoading={isSubmitting} fullWidth>
        Save Expense
      </Button>
    </form>
  )
}
```

The form passes `data: CreateExpenseInput` — the fully typed, Zod-validated object — straight to the action. The action re-validates server-side. Two validation passes, zero `FormData`.

### Calling actions from event handlers (non-form)

For mutations triggered by buttons outside a form (e.g. delete, toggle, reorder), use `useTransition` to track the pending state.

```tsx
'use client'

import { useTransition } from 'react'
import { Button } from '@heroui/react'
import { addToast } from '@heroui/react'
import { deleteExpenseAction } from '@/app/(app)/expenses/actions'

export function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteExpenseAction(expenseId)

      if (!result.success) {
        addToast({ title: result.error, color: 'danger' })
        return
      }

      addToast({ title: 'Expense deleted', color: 'success' })
    })
  }

  return (
    <Button
      color="danger"
      variant="flat"
      isLoading={isPending}
      onPress={handleDelete}
    >
      Delete
    </Button>
  )
}
```

`useTransition` keeps the UI responsive during the server round-trip. `isPending` drives the loading state on the button. Do not use `useState` + a manual boolean for this — `useTransition` is the correct primitive.

---

## Cache Invalidation

Call `revalidatePath` or `revalidateTag` at the end of every successful mutation, before returning `{ success: true }`.

### `revalidatePath` — invalidate by URL

Use when you know exactly which page should refresh.

```ts
revalidatePath('/expenses')              // list page
revalidatePath(`/expenses/${expenseId}`) // detail page
revalidatePath('/dashboard')             // summary cards also change
```

Call it for every page that would show stale data after the mutation. A create/update/delete of an expense invalidates both the list and the dashboard.

### `revalidateTag` — invalidate by cache tag

Use when multiple pages share the same fetched data and you want to invalidate them together. Pair with `fetch` cache tags or `unstable_cache` tags.

```ts
// In a data-fetching utility:
import { unstable_cache } from 'next/cache'

export const getExpenses = unstable_cache(
  async (userId: string) => {
    await connectToDatabase()
    return Expense.find({ userId }).lean()
  },
  ['expenses'],
  { tags: ['expenses'] }
)

// In the action:
import { revalidateTag } from 'next/cache'
revalidateTag('expenses') // invalidates all cache entries tagged 'expenses'
```

For Mongoose queries that are not wrapped in `unstable_cache`, use `revalidatePath` — `revalidateTag` has no effect on un-tagged queries.

---

## Actions That Redirect

Some actions should redirect on success instead of returning to the caller — for example, creating a resource and navigating to its detail page.

```ts
import { redirect } from 'next/navigation'

export async function createBudgetAction(input: unknown): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'You must be signed in to do this.' }
  }

  const result = budgetSchema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      error: 'Please fix the errors below.',
      fields: formatZodErrors(result.error),
    }
  }

  let budgetId: string
  try {
    await connectToDatabase()
    const budget = await Budget.create({
      ...result.data,
      userId: new Types.ObjectId(session.user.id),
    })
    budgetId = budget._id.toString()
  } catch (err) {
    console.error('[createBudgetAction]', err)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }

  revalidatePath('/budgets')
  redirect(`/budgets/${budgetId}`) // redirect is called outside the try/catch
}
```

`redirect()` throws internally — calling it inside a `try/catch` will catch the throw and suppress the redirect. Always call `redirect()` after the `try/catch` block, at the end of the action.

When the action redirects, the client component does not need to handle a success result — the navigation happens automatically. The client only needs to handle the failure case.

---

## What API Routes Are For

The `app/api/` directory is reserved for:

- **Read operations** — `GET` endpoints that return data for client-side fetching (e.g., search, pagination, export).
- **External integrations** — webhooks or third-party callbacks that cannot use Server Actions.
- **Authentication** — the `/api/auth/*` routes managed by NextAuth.

**Do not create `POST`, `PATCH`, or `DELETE` API routes to replace Server Actions.** If a client component needs to mutate data, it calls a Server Action. The fact that the component is a Client Component does not make an API route necessary — Server Actions are callable directly from Client Components.

---

## Logging Rules for Actions

Follow the same rules as API routes (see `docs/errors-and-validation.md`):

- Log with `console.error('[actionName]', err)` before returning the generic error response.
- Include the action name as a prefix so logs are filterable.
- Never log passwords, session tokens, or full input objects that may contain credentials.
- Never return the caught error's message to the client.

---

## Checklist — Before Shipping a Server Action

- [ ] File begins with `'use server'`
- [ ] First line of logic is `const session = await auth()`; returns early if `!session?.user?.id`
- [ ] Input parameter is typed as `unknown`; Zod `safeParse` is called before any database operation
- [ ] Only `result.data` is used after a successful parse — raw input is discarded
- [ ] Every database query includes `userId: session.user.id` in the filter
- [ ] Not-found and ownership failures return the same generic `404`-style message — never `403`
- [ ] `try/catch` wraps the database operation; catch logs server-side and returns a generic message
- [ ] `revalidatePath` or `revalidateTag` is called before `return { success: true }` (or before `redirect()`)
- [ ] `redirect()` is called outside any `try/catch` block
- [ ] `ActionResult` is the return type — no bare `throw`, no untyped returns
- [ ] No `FormData` anywhere in the action or its callers
