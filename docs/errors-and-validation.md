# Error Handling & Validation Specification — Personal Expense Tracker

This document is the authoritative reference for all error handling and input validation decisions. Read it before writing any form, API route, Server Action, or error boundary. All patterns here are binding.

---

## Principles

1. **Users see friendly messages, never technical details.** Stack traces, Mongoose error messages, internal field names, and database identifiers must never reach the UI.
2. **All input is validated with Zod.** No ad-hoc `if (!value)` checks, no manual string trimming before passing to the database.
3. **Validation runs on the server, always.** Client-side validation is a UX enhancement only — it is never the authoritative check. The server validates independently of the client.
4. **Errors are surfaced through HeroUI components only.** No `alert()`, no custom DOM manipulation, no raw `<p className="text-red-500">`.
5. **Field errors appear inline on the relevant input.** Page-level or form-level errors appear in an `Alert` component above the form. The two are not mixed.

---

## Package

```bash
npm install zod
```

Zod is the only validation library used. Do not introduce `yup`, `joi`, `valibot`, or any other schema library.

---

## Zod Schema Conventions

### Location

All Zod schemas live in `lib/validations/`. One file per resource.

```
lib/
  validations/
    expense.ts
    budget.ts
    category.ts
    user.ts
    auth.ts
```

### Naming

Schema variables are named after the action they validate, in camelCase, suffixed with `Schema`.

```ts
export const createExpenseSchema = z.object({ ... })
export const updateExpenseSchema = z.object({ ... })
export const loginSchema         = z.object({ ... })
export const registerSchema      = z.object({ ... })
```

### Shared types

Each schema file also exports the inferred TypeScript type for use in components and API handlers.

```ts
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
```

### Schema design rules

- Use `.trim()` on all string fields that come from user input.
- Use `.min(1, 'Field is required')` instead of relying on `.nonempty()` — the message is more descriptive.
- Use `.positive()` or `.min(0.01)` for monetary amounts — never trust that a number is positive.
- Use `.email('Enter a valid email address')` on email fields.
- Use `.min(8, 'Password must be at least 8 characters')` on password fields.
- Prefer `.optional()` over `.nullable()` for fields that may be absent.
- Use `.transform()` to normalise values (e.g. `.toLowerCase().trim()`) rather than doing it manually in the handler.

### Example schemas

```ts
// lib/validations/expense.ts
import { z } from 'zod'

export const createExpenseSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(200, 'Description is too long'),
  amount:      z.number({ invalid_type_error: 'Amount must be a number' }).positive('Amount must be greater than 0'),
  categoryId:  z.string().trim().min(1, 'Category is required'),
  date:        z.coerce.date({ invalid_type_error: 'Enter a valid date' }),
  notes:       z.string().trim().max(1000, 'Notes are too long').optional(),
})

export const updateExpenseSchema = createExpenseSchema.partial()

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
```

```ts
// lib/validations/auth.ts
import { z } from 'zod'

export const loginSchema = z.object({
  email:    z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName:  z.string().trim().min(1, 'Last name is required').max(50),
  email:     z.string().trim().toLowerCase().email('Enter a valid email address'),
  password:  z.string().min(8, 'Password must be at least 8 characters'),
  confirm:   z.string().min(1, 'Please confirm your password'),
}).refine(data => data.password === data.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})

export type LoginInput    = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
```

---

## Server-Side Validation in API Routes

Every API route that accepts a request body validates it with Zod before doing anything else.

### Pattern

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { connectToDatabase, Expense } from '@/lib/db'
import { createExpenseSchema } from '@/lib/validations/expense'
import { ZodError } from 'zod'
import { Types } from 'mongoose'

export async function POST(req: Request) {
  // 1. Authenticate
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // 3. Validate with Zod
  const result = createExpenseSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', fields: formatZodErrors(result.error) },
      { status: 400 }
    )
  }

  // 4. Act on validated data only — never use `body` after this point
  await connectToDatabase()
  const expense = await Expense.create({
    ...result.data,
    userId: new Types.ObjectId(session.user.id),
  })

  return NextResponse.json({ data: expense }, { status: 201 })
}
```

### `formatZodErrors` helper

Flatten Zod errors into a `{ fieldName: string }` map for consistent API responses.

```ts
// lib/validations/utils.ts
import type { ZodError } from 'zod'

export function formatZodErrors(error: ZodError): Record<string, string> {
  return Object.fromEntries(
    error.errors.map(e => [e.path.join('.'), e.message])
  )
}
```

**Response shape for validation errors:**

```json
{
  "error": "Validation failed",
  "fields": {
    "amount": "Amount must be greater than 0",
    "categoryId": "Category is required"
  }
}
```

### Rule: never use `body` after `safeParse` succeeds

Once `result.success` is `true`, use only `result.data`. It is the validated, type-safe, transformed version of the input. `body` may still contain untransformed or extra fields.

---

## Server-Side Validation in Server Actions

Server Actions validate input the same way as API routes, using `safeParse`.

```ts
'use server'

import { auth } from '@/auth'
import { createExpenseSchema } from '@/lib/validations/expense'
import { connectToDatabase, Expense } from '@/lib/db'
import { Types } from 'mongoose'
import { revalidatePath } from 'next/cache'

export type ActionResult =
  | { success: true }
  | { success: false; error: string; fields?: Record<string, string> }

export async function createExpenseAction(
  input: unknown
): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'You must be signed in to do this.' }
  }

  const result = createExpenseSchema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      error: 'Please fix the errors below.',
      fields: formatZodErrors(result.error),
    }
  }

  try {
    await connectToDatabase()
    await Expense.create({
      ...result.data,
      userId: new Types.ObjectId(session.user.id),
    })
    revalidatePath('/expenses')
    return { success: true }
  } catch {
    return { success: false, error: 'Something went wrong. Please try again.' }
  }
}
```

**Rules for Server Actions:**
- Always return a typed result object (`ActionResult`) — never `throw` to the client.
- The `error` field is always a user-friendly string with no internal details.
- The `fields` map mirrors the Zod field names so the form can bind inline errors.

---

## Client-Side Validation with React Hook Form + Zod

Client-side validation uses `react-hook-form` with the `@hookform/resolvers/zod` adapter. It mirrors the server schema — the same Zod schema validates both.

```bash
npm install react-hook-form @hookform/resolvers
```

### Form pattern

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input, Button, Alert } from '@heroui/react'
import { createExpenseSchema, type CreateExpenseInput } from '@/lib/validations/expense'
import { createExpenseAction } from '@/app/(app)/expenses/actions'
import { useState } from 'react'

export function CreateExpenseForm() {
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)

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
    const result = await createExpenseAction(data)

    if (!result.success) {
      // Bind server-returned field errors back into the form
      if (result.fields) {
        Object.entries(result.fields).forEach(([field, message]) => {
          setError(field as keyof CreateExpenseInput, { message })
        })
      }
      // Surface a form-level error if there is one
      if (result.error) setFormError(result.error)
      return
    }

    setSuccess(true)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Form-level error — rendered above the fields */}
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

      <Button
        type="submit"
        color="primary"
        isLoading={isSubmitting}
        fullWidth
      >
        Save Expense
      </Button>
    </form>
  )
}
```

### Rules for client-side forms

- Always set `noValidate` on `<form>` — this disables browser native validation so HeroUI and Zod control all error display.
- Pass `isInvalid` and `errorMessage` props to every HeroUI `Input`. Never render a separate error element next to the field.
- Form-level errors (non-field errors returned by the server) render as an `<Alert color="danger">` above the form fields.
- Success feedback renders as an `<Alert color="success">` or triggers a toast via `addToast`. Never use `alert()`.

---

## Displaying Errors — HeroUI Component Reference

All visible error feedback uses HeroUI components. The choice depends on the context.

### Inline field errors — `Input` `errorMessage` prop

For individual field validation failures.

```tsx
<Input
  label="Email"
  variant="bordered"
  isInvalid={!!errors.email}
  errorMessage={errors.email?.message}
/>
```

The `errorMessage` prop renders the error below the field with HeroUI's built-in styling. Never add a separate `<p>` or `<span>` for this.

### Form-level errors — `Alert`

For errors that apply to the whole form (e.g. "Email already registered", "Something went wrong").

```tsx
import { Alert } from '@heroui/react'

{formError && (
  <Alert
    color="danger"
    title="Unable to save"
    description={formError}
    className="mb-4"
  />
)}
```

### Transient feedback — `addToast`

For success confirmation and non-critical errors after a completed action (e.g. expense deleted, export failed).

```tsx
import { addToast } from '@heroui/react'

// Success
addToast({ title: 'Expense saved', color: 'success' })

// Non-critical error
addToast({ title: 'Could not delete expense. Please try again.', color: 'danger' })
```

### Page-level errors — `error.tsx`

For route-level failures caught by Next.js error boundaries. Must be a Client Component.

```tsx
// app/(app)/expenses/error.tsx
'use client'

import { Alert, Button } from '@heroui/react'

export default function ExpensesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <Alert
        color="danger"
        title="Something went wrong"
        description="We couldn't load your expenses. Please try again."
      />
      <Button color="primary" variant="flat" onPress={reset}>
        Try again
      </Button>
    </div>
  )
}
```

`error.message` and `error.stack` must never be rendered. The `digest` property is a safe opaque identifier provided by Next.js for server-side log correlation — it can be logged but not shown to the user.

### Not-found pages — `not-found.tsx`

```tsx
// app/(app)/expenses/[expenseId]/not-found.tsx
import { Alert, Button } from '@heroui/react'
import Link from 'next/link'

export default function ExpenseNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <Alert
        color="default"
        title="Expense not found"
        description="This expense doesn't exist or you don't have access to it."
      />
      <Button as={Link} href="/expenses" color="primary" variant="flat">
        Back to expenses
      </Button>
    </div>
  )
}
```

Never reveal whether a resource exists but belongs to another user. The message is always "doesn't exist or you don't have access."

---

## Error Categorisation

Errors fall into four categories. Each has a defined handling strategy.

### 1. Validation errors (400)

User input did not pass the Zod schema. Field-level messages are shown inline. A summary message is shown above the form.

- **Source:** `safeParse` failure in API route or Server Action
- **User sees:** Inline `Input` `errorMessage` per field + optional `Alert` above form
- **Never log** (not a system error)

### 2. Authentication errors (401)

No valid session. The API returns `401`. Middleware handles the redirect for page routes.

- **Source:** `auth()` returning null in an API route
- **User sees:** Redirected to `/login` (page routes) or receives `401` JSON (API routes)
- **Client handling:** If a `401` is received from a fetch call, redirect to `/login`

### 3. Not-found / access errors (404)

Resource does not exist or belongs to another user. Always return `404`, never `403` (see `docs/auth.md`).

- **Source:** `findOne({ _id, userId })` returning null
- **User sees:** `not-found.tsx` component or `Alert` with neutral copy
- **Never reveal** whether the resource exists

### 4. Unexpected server errors (500)

Unhandled exceptions — database connection failure, unexpected null, runtime error.

- **Source:** Any unhandled `throw` in an API route or Server Action
- **User sees:** Generic "Something went wrong. Please try again." message
- **Log:** Yes — log the original error server-side with enough context to diagnose (see Logging section)
- **Never expose:** Error message, stack trace, or any internal detail

---

## Error Logging

Server errors must be logged before sending the generic response. Use `console.error` for now; replace with a structured logger when one is introduced.

```ts
try {
  await Expense.create({ ...result.data, userId })
} catch (err) {
  console.error('[POST /api/expenses]', err)
  return NextResponse.json(
    { error: 'Something went wrong. Please try again.' },
    { status: 500 }
  )
}
```

Logging rules:
- Always include the route or action name as a prefix: `[POST /api/expenses]`, `[createExpenseAction]`.
- Log the original error object, not a stringified version — the full stack is preserved.
- Never log user passwords, full request bodies containing credentials, or session tokens.
- Never send the logged error message to the client.

---

## Error Messages — Wording Guide

All user-facing error messages follow these rules:

- Written in plain language. No technical terms (`ZodError`, `MongoServerError`, `ECONNREFUSED`).
- Describe what happened and what the user can do. "Something went wrong. Please try again." is acceptable. "Error: CastError: Cast to ObjectId failed" is not.
- Field-level messages are concise and specific: "Amount must be greater than 0", not "Invalid value".
- Never blame the user. "That email is already registered" is better than "Duplicate key error".

| Situation | Message shown to user |
|---|---|
| Required field empty | `"{Field name} is required"` |
| Invalid email format | `"Enter a valid email address"` |
| Password too short | `"Password must be at least 8 characters"` |
| Passwords don't match | `"Passwords do not match"` |
| Duplicate email on register | `"Unable to create account"` (do not confirm the email exists) |
| Wrong email or password | `"Invalid email or password"` (do not specify which) |
| Resource not found | `"This item doesn't exist or you don't have access to it."` |
| Generic server error | `"Something went wrong. Please try again."` |
| Network / fetch failure | `"Unable to reach the server. Check your connection and try again."` |

---

## Checklist — Before Shipping a Form or API Route

**Forms:**
- [ ] Zod schema exists in `lib/validations/<resource>.ts`
- [ ] `useForm` uses `zodResolver(schema)`
- [ ] Every `Input` passes `isInvalid` and `errorMessage` from `formState.errors`
- [ ] Form-level errors render as `<Alert color="danger">`
- [ ] Success feedback uses `addToast` or `<Alert color="success">`
- [ ] `<form>` has `noValidate`
- [ ] No `alert()`, no raw `<p>` error text

**API routes and Server Actions:**
- [ ] `safeParse` is used (not `parse` — never throw a ZodError to the client)
- [ ] Validation happens after auth, before any database call
- [ ] `result.data` is used after validation, never `body`
- [ ] All `catch` blocks log server-side and return a generic user message
- [ ] Stack traces and error objects never appear in the response body
- [ ] `404` is returned when a resource is not found or belongs to another user (not `403`)
