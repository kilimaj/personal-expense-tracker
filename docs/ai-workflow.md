# AI-Assisted Development Workflow

This document defines how AI-assisted development works in this project. It applies to every feature, bug fix, refactor, or architectural change — regardless of size. The workflow exists to keep the human in control of every decision before a single line of code is written.

---

## Core Principle

**Plan first. Code only after explicit approval.**

The AI must never jump directly to writing code. Every task starts with a written plan that the human reviews and approves. Code generation is gated behind that approval. No exceptions.

---

## The Two Phases

### Phase 1 — Plan

When given a task, the AI must:

1. Read all relevant `/docs` files before forming any opinion
2. Explore the existing codebase to understand what is already in place
3. Produce a structured technical plan (see format below)
4. Stop and wait

The plan is a proposal, not a commitment. It exists to surface assumptions, trade-offs, and open questions before any implementation work begins.

### Phase 2 — Implement

Implementation begins only when the human responds with explicit approval (see Approval section). The AI then:

1. Follows the approved plan exactly — no scope additions, no "while I'm in here" changes
2. Implements one step at a time in the order listed in the plan
3. Marks each step complete before moving to the next
4. Stops immediately if it discovers something that contradicts the plan

---

## Plan Format

Every plan must include all of the following sections. A plan missing any section is incomplete and must not be submitted.

---

### Summary

One or two sentences describing what is being built and why. No technical detail yet — just what problem this solves.

---

### Relevant Documentation

List every `/docs` file that applies to this task and the specific rules from each that will govern the implementation.

Example:
- `docs/auth.md` — session access pattern, userId scoping rules, security checklist
- `docs/ui.md` — component choices for the expense form modal

---

### Files to Read Before Starting

List every existing file in the codebase that must be read and understood before writing code. Include the reason each file is relevant.

Example:
```
lib/db/models/expense.ts        — understand the schema and existing indexes
app/(app)/layout.tsx            — understand how the authenticated layout works
app/api/expenses/route.ts       — check if the route already exists before creating it
```

---

### Architecture

Describe the structure of the solution:

- What new files will be created, and what each one does
- What existing files will be modified, and what specifically changes
- How the pieces connect to each other (data flow, component hierarchy, API shape)
- Any state management, caching, or async considerations

Keep this concrete. "I'll add a component" is not architecture. "I'll add `app/(app)/expenses/page.tsx`, a Server Component that calls `GET /api/expenses` and passes the result to `<ExpensesTable>`" is.

---

### API Design (if applicable)

For any new or modified API routes, specify:

| Field | Detail |
|---|---|
| Method + path | e.g. `POST /api/expenses` |
| Auth required | Yes — session.user.id from `auth()` |
| Request body | Shape and types |
| Success response | Shape, status code |
| Error responses | Each failure case and its status code |
| userId scoping | Confirm how the query is scoped to the session user |

---

### Implementation Steps

A numbered list of discrete, ordered steps. Each step must be small enough to be completed and verified independently.

Example:
```
1. Install next-auth@5 and bcryptjs
2. Create auth.ts at project root with Credentials provider
3. Create app/api/auth/[...nextauth]/route.ts
4. Create middleware.ts with public path list and redirect logic
5. Create types/next-auth.d.ts to augment Session type
6. Update app/(app)/layout.tsx to add server-side session guard
7. Replace app/(auth)/login/page.tsx with HeroUI form that calls signIn()
8. Replace app/(auth)/signup/page.tsx with HeroUI form that POSTs to /api/auth/register
9. Create app/api/auth/register/route.ts with bcrypt hashing and user creation
```

Steps must be in dependency order — a step that depends on another must come after it.

---

### What Is Explicitly Out of Scope

List anything related to the task that will **not** be done in this implementation. This prevents scope creep and makes the boundary of the work clear.

Example:
- OAuth providers (Google, GitHub) — credentials only for now
- Password reset flow — not included in this iteration
- Email verification — out of scope

---

### Open Questions

List anything uncertain that requires human input before implementation can begin. If there are no open questions, write "None."

Example:
- Should the session max age be 7 days or 30 days?
- Do budgets belong to a user or a household (multi-user)?

---

## Approval

### What counts as approval

The human must respond with a clear go-ahead. Any of the following count:

- "Approved"
- "Looks good, go ahead"
- "Yes, proceed"
- "Ship it"
- A response that addresses open questions and ends with a directive to proceed

### What does not count as approval

- Silence
- A question in response ("What about X?")
- Partial agreement ("The architecture looks right but I'm not sure about step 4")
- Acknowledgement ("OK I see what you're proposing")

If the human responds with questions or partial feedback, the AI must update the plan to incorporate the feedback and wait for approval again. It does not start coding.

### Asking for clarification

If the task is ambiguous and the AI cannot write a complete plan without more information, it must ask specific, targeted questions before producing a plan. It must not produce a speculative plan that guesses at requirements.

---

## During Implementation

### Staying on plan

Once approved, the AI implements exactly what was described in the plan. If a step reveals that the plan needs to change — a file is structured differently than expected, a dependency is missing, a constraint was overlooked — the AI must:

1. Stop
2. Describe what it found and how it affects the plan
3. Propose a revised plan or a specific adjustment
4. Wait for approval before continuing

It does not improvise, extend scope, or make judgment calls about unplanned changes.

### No unrequested improvements

The AI must not:
- Refactor code it was not asked to change
- Add comments, docstrings, or types to code it did not write
- Add error handling for scenarios not in the plan
- "Clean up" surrounding code while implementing a feature
- Add features because they seem like a natural next step

The only work done is the work in the approved plan.

### Stopping conditions

The AI stops and reports back if any of the following occur during implementation:

- A discovered constraint makes a step impossible as described
- An existing file contains logic that conflicts with the plan
- A security concern is identified that was not anticipated in the plan
- The change required to complete a step is significantly larger than described

---

## Checklist — Before Submitting a Plan

The AI must verify every item before presenting a plan to the human:

- [ ] All relevant `/docs` files have been read
- [ ] All files listed in "Files to Read Before Starting" have been read
- [ ] The plan does not contradict any rule in `docs/auth.md`, `docs/ui.md`, or other active docs
- [ ] Every API route in the plan includes userId scoping (if the route accesses user-owned data)
- [ ] Every UI element in the plan uses a HeroUI component (no custom CSS)
- [ ] Open questions are listed, not assumed away
- [ ] Out-of-scope items are listed explicitly
- [ ] Implementation steps are in dependency order
- [ ] No code has been written yet

---

## Checklist — Before Considering Implementation Complete

After all steps are done:

- [ ] Every item in the approved plan has been implemented
- [ ] No unplanned files were created or modified
- [ ] The auth security checklist in `docs/auth.md` has been verified (if auth-related)
- [ ] The UI follows `docs/ui.md` exactly (if UI-related)
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] ESLint passes (`npm run lint`)
