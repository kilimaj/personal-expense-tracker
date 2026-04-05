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

## Documentation

Before implementing any feature, Claude Code MUST read and follow the relevant documentation files in the `/docs` directory. These files are the authoritative source for design decisions, component usage, and conventions for this project.

- `docs/ui.md` — UI specification: all screens, components, layout, accessibility, and theming rules. No feature that touches the UI may be implemented without first reading this file.

If a `/docs` file exists that is relevant to the work being done, reading it is not optional — it takes precedence over general knowledge or defaults.

## Architecture

This project uses the **App Router** (`app/` directory), not the Pages Router. All routes, layouts, and API handlers go under `app/`.

- `app/layout.tsx` — root layout with Geist font and global metadata
- `app/page.tsx` — home page
- `app/globals.css` — global styles with Tailwind imports and CSS variable theming (light/dark)

TypeScript path alias: `@/*` resolves to the project root.

The project is freshly bootstrapped — no API routes, database, authentication, or state management are configured yet.
