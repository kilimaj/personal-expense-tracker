# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test runner is configured yet.

## Tech Stack

- **Next.js 16.2.1** with App Router — note this is a non-standard version; read `node_modules/next/dist/docs/` before writing Next.js code
- **React 19.2.4**
- **Tailwind CSS 4** (via `@tailwindcss/postcss`)
- **TypeScript 5** with strict mode

## AI Development Workflow

**Read `docs/ai-workflow.md` before starting any task.** All development follows a plan-first, code-second process. Claude Code must produce a written technical plan and wait for explicit human approval before writing any code. This applies to every task — features, bug fixes, and refactors.

## Documentation

Before implementing any feature, Claude Code MUST read and follow the relevant documentation files in the `/docs` directory. These files are the authoritative source for design decisions, component usage, and conventions for this project.

- `docs/ai-workflow.md` — Development workflow: plan format, approval rules, and implementation constraints. Read this first, before any other doc.
- `docs/ui.md` — UI specification: all screens, components, layout, accessibility, and theming rules. No feature that touches the UI may be implemented without first reading this file.
- `docs/auth.md` — Authentication specification: NextAuth configuration, session access patterns, route protection, data ownership rules, and the security checklist. No auth-related code or data-fetching code may be implemented without first reading this file.
- `docs/best-practices.md` — React and Next.js best practices: waterfall elimination, bundle optimization, re-render prevention, and JavaScript performance patterns. Apply these when writing any component, API route, or server action.

If a `/docs` file exists that is relevant to the work being done, reading it is not optional — it takes precedence over general knowledge or defaults.

## Architecture

This project uses the **App Router** (`app/` directory), not the Pages Router. All routes, layouts, and API handlers go under `app/`.

- `app/layout.tsx` — root layout with Geist font and global metadata
- `app/page.tsx` — home page
- `app/globals.css` — global styles with Tailwind imports and CSS variable theming (light/dark)

TypeScript path alias: `@/*` resolves to the project root.

The project is freshly bootstrapped — no API routes, database, authentication, or state management are configured yet.
