---
name: register-route-response-shapes
description: Expected HTTP response shapes for POST /api/auth/register
type: project
---

## POST /api/auth/register — response shapes

| Condition | Status | Body shape |
|---|---|---|
| Valid payload, user does not exist | 201 | `{ success: true }` |
| Body is not JSON | 400 | `{ error: 'Invalid request body' }` |
| Zod validation fails | 400 | `{ error: 'Validation failed', fields: Record<string, string> }` |
| Email already registered | 409 | `{ error: 'Unable to create account' }` |
| DB or unexpected error | 500 | `{ error: 'Something went wrong. Please try again.' }` |

## Security rules verified in tests

- 409 message must NOT contain the words "already", "registered", or "exists"
  (prevents user enumeration).
- 500 message must not contain the original error message.
- `bcrypt.hash` must NOT be called when a duplicate email is found.
- `connectToDatabase` must NOT be called when the JSON body is malformed.
- `User.findOne` must NOT be called when Zod validation fails.

## Password hashing

`bcrypt.hash(password, 12)` — cost factor is 12. Verify in tests with:
```ts
expect(bcrypt.hash).toHaveBeenCalledWith(validBody.password, 12)
```

## Email normalisation

The Zod `registerSchema` transform lower-cases the email before it reaches
the route handler. `User.findOne` therefore always receives a lower-cased email.
