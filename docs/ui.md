# UI Design Specification — Personal Expense Tracker

All UI is built exclusively with [HeroUI](https://www.heroui.com/) components. No custom CSS, no custom Tailwind classes, no inline styles. HeroUI handles theming, dark mode, accessibility, and responsiveness. Every interactive element must be a HeroUI component.

---

## Setup

```bash
npm install @heroui/react framer-motion
```

Wrap the app in `HeroUIProvider` in `app/layout.tsx` and pass `className="dark"` or `className="light"` based on user preference. Enable `disableAnimation={false}` for smooth transitions.

---

## Design Tokens (HeroUI Theme)

Use HeroUI's built-in semantic color tokens throughout. Never reference raw hex values.

| Token | Usage |
|---|---|
| `primary` | CTAs, active nav items, key actions |
| `secondary` | Secondary buttons, tags |
| `success` | Income entries, positive balances |
| `danger` | Delete actions, overspent budgets |
| `warning` | Budget warnings, pending items |
| `default` | Neutral backgrounds, borders |

Typography scales, border radii, and shadows all come from the HeroUI theme. No overrides.

---

## Global Layout

### Root Layout (`app/layout.tsx`)

- `HeroUIProvider` wraps everything
- Top-level flex column, full viewport height
- `Navbar` is always rendered at the top (see Navbar section)
- Page content fills remaining height via HeroUI layout tokens

### Navbar (authenticated)

```
Navbar (maxWidth="xl", isBordered)
  NavbarBrand
    - App logo icon (emoji or SVG) + "Spendly" text as NavbarBrand
  NavbarContent (justify="center", hidden on mobile)
    NavbarItem × 4: Dashboard | Expenses | Budgets | Reports
  NavbarContent (justify="end")
    - Switch (dark mode toggle, size="sm", aria-label="Toggle dark mode")
    - Avatar (size="sm", fallback initials, color="primary") with Dropdown
      DropdownMenu: Profile | Settings | Divider | Sign out
  NavbarMenuToggle (visible on mobile only)
  NavbarMenu (mobile slide-out)
    NavbarMenuItem × 4: same nav links
```

All `NavbarItem` links use HeroUI `Link` component with `color="foreground"` and `isActive` prop for the current route.

---

## Pages

### 1. Landing Page (`/`)

Single centered layout. No Navbar on this page.

```
main (full viewport, flex column, items-center, justify-center)
  Card (maxWidth="md", shadow="lg")
    CardHeader
      - App name in large text using HeroUI's Snippet or heading via built-in scale
      - Tagline as muted paragraph
    CardBody
      - Two Buttons side by side:
          Button (color="primary", size="lg", fullWidth): "Get Started" → /signup
          Button (variant="bordered", size="lg", fullWidth): "Sign in" → /login
    CardFooter
      - Small muted text: "Free forever. No credit card required."
```

---

### 2. Login Page (`/login`)

```
main (full viewport, flex, items-center, justify-center, px-4)
  Card (maxWidth="sm", shadow="md", fullWidth)
    CardHeader (flex-col, items-start, gap-1)
      - Heading: "Welcome back"
      - Muted text: "Sign in to your account"
    CardBody (gap-4)
      Input
        type="email"
        label="Email"
        placeholder="you@example.com"
        variant="bordered"
        isRequired
        autoComplete="email"
        startContent: mail icon (Heroicons or Lucide, not custom CSS)
      Input
        type="password"
        label="Password"
        placeholder="Enter your password"
        variant="bordered"
        isRequired
        autoComplete="current-password"
        endContent: eye/eye-off toggle Button (variant="light", isIconOnly, size="sm")
      Link (href="/forgot-password", size="sm", color="primary", className aligned right)
        "Forgot password?"
      Button
        type="submit"
        color="primary"
        fullWidth
        size="lg"
        "Sign in"
    CardFooter (justify-center)
      - "Don't have an account?" + Link (href="/signup", color="primary"): "Sign up"
```

---

### 3. Signup Page (`/signup`)

```
main (full viewport, flex, items-center, justify-center, px-4)
  Card (maxWidth="sm", shadow="md", fullWidth)
    CardHeader (flex-col, items-start, gap-1)
      - Heading: "Create an account"
      - Muted text: "Start tracking your expenses today"
    CardBody (gap-4)
      - Two Inputs side by side using HeroUI's grid layout:
          Input (label="First name", variant="bordered", isRequired)
          Input (label="Last name", variant="bordered", isRequired)
      Input (type="email", label="Email", variant="bordered", isRequired)
      Input (type="password", label="Password", variant="bordered", isRequired,
             description="At least 8 characters")
      Input (type="password", label="Confirm password", variant="bordered", isRequired)
      Button (type="submit", color="primary", fullWidth, size="lg"): "Create account"
    CardFooter (justify-center)
      - "Already have an account?" + Link (href="/login", color="primary"): "Sign in"
```

---

### 4. Dashboard (`/dashboard`)

Three-column grid on desktop, single column on mobile.

#### Summary Cards Row

Four `Card` components in a responsive grid (1 col mobile → 2 col tablet → 4 col desktop):

| Card | Content |
|---|---|
| Total Balance | Large number + Chip (color="success", "Healthy") |
| Monthly Income | Amount + trend percentage in Chip (color="success" or "danger") |
| Monthly Expenses | Amount + trend percentage in Chip |
| Savings Rate | Progress (color="primary", value=N) + percentage label |

Each card: `Card (shadow="sm")`, `CardHeader` with icon + label, `CardBody` with the main metric.

#### Recent Transactions

```
Card (shadow="sm", fullWidth)
  CardHeader
    - Heading: "Recent Transactions"
    - Button (variant="light", size="sm", color="primary", endContent arrow icon): "View all"
  CardBody
    Table (aria-label="Recent transactions", removeWrapper)
      TableHeader
        TableColumn: Date
        TableColumn: Description
        TableColumn: Category
        TableColumn (align="end"): Amount
      TableBody
        TableRow × N
          TableCell: formatted date
          TableCell: description text
          TableCell: Chip (variant="flat", color per category)
          TableCell: colored amount (success=income, danger=expense)
```

#### Spending by Category (sidebar)

```
Card (shadow="sm")
  CardHeader: "This Month"
  CardBody
    - For each category:
        div (label + percentage right-aligned)
        Progress (color per category, value=N, size="sm")
```

---

### 5. Expenses Page (`/expenses`)

Full-width table with filtering controls above.

#### Toolbar

```
div (flex, gap-3, flex-wrap, items-end)
  Input
    placeholder="Search expenses..."
    variant="bordered"
    size="sm"
    startContent: search icon
    isClearable
  Select (label="Category", variant="bordered", size="sm")
    SelectItem × N (all categories)
  Select (label="Period", variant="bordered", size="sm")
    SelectItem: This Month | Last Month | Last 3 Months | Custom
  DateRangePicker (variant="bordered", size="sm", shown only for "Custom" period)
  Button (color="primary", startContent: plus icon): "Add Expense"
```

#### Expenses Table

```
Table
  aria-label="Expenses"
  selectionMode="multiple"
  sortDescriptor / onSortChange
  topContent: row count + bulk delete Button (shown when rows selected, color="danger", variant="flat")
  bottomContent: Pagination (total pages, color="primary")

  TableHeader
    TableColumn (allowsSorting): Date
    TableColumn (allowsSorting): Description
    TableColumn: Category
    TableColumn: Payment Method
    TableColumn (allowsSorting, align="end"): Amount
    TableColumn (align="center"): Actions

  TableBody (loadingContent=<Spinner />, emptyContent="No expenses found")
    TableRow × N
      TableCell: date string
      TableCell: description
      TableCell: Chip (variant="flat")
      TableCell: Chip (variant="dot")
      TableCell: formatted amount in danger color
      TableCell:
        ButtonGroup (size="sm", variant="light")
          Button (isIconOnly, color="default"): edit icon
          Button (isIconOnly, color="danger"): trash icon
```

---

### 6. Add / Edit Expense Modal

Triggered by "Add Expense" button or row edit icon.

```
Modal (size="md", isDismissable, isKeyboardDismissDisabled=false)
  ModalContent
    ModalHeader: "Add Expense" | "Edit Expense"
    ModalBody (gap-4)
      Input (label="Description", variant="bordered", isRequired, placeholder="e.g. Grocery run")
      Input (label="Amount", variant="bordered", isRequired, type="number",
             startContent: currency symbol as text, min="0")
      Select (label="Category", variant="bordered", isRequired)
        SelectItem × N with Chip preview
      DatePicker (label="Date", variant="bordered", isRequired)
      Select (label="Payment Method", variant="bordered")
        SelectItem: Cash | Card | Mobile Money | Bank Transfer
      Textarea (label="Notes", variant="bordered", placeholder="Optional notes...", maxRows=3)
    ModalFooter
      Button (variant="flat", color="default", onPress=onClose): "Cancel"
      Button (color="primary", type="submit"): "Save Expense"
```

---

### 7. Budgets Page (`/budgets`)

```
div (flex, justify-between, items-center, mb-4)
  Heading: "Budgets"
  Button (color="primary", startContent: plus icon): "New Budget"

div (responsive grid: 1 col mobile, 2 col tablet, 3 col desktop)
  Card × N (one per budget category)
    CardHeader
      - Chip (variant="flat", color per category): category name
      - Dropdown (edit/delete actions)
          DropdownTrigger: Button (isIconOnly, variant="light", size="sm"): ⋯
          DropdownMenu
            DropdownItem: Edit
            DropdownItem (color="danger"): Delete
    CardBody
      - Budget amount vs spent summary
      - Progress
          value=(spent/budget * 100)
          color: success (<70%) | warning (70–90%) | danger (>90%)
          size="md"
      - Remaining or overspent amount as Chip
```

---

### 8. Reports Page (`/reports`)

```
Tabs (aria-label="Report views", color="primary", variant="underlined")
  Tab (key="overview", title="Overview")
    - Summary Cards (same 4 as Dashboard) for selected period
  Tab (key="trends", title="Trends")
    - Period selector: ButtonGroup of Buttons (variant="flat"): 3M | 6M | 1Y
    - Placeholder Card for chart area (HeroUI Skeleton while loading)
  Tab (key="categories", title="By Category")
    - Table of category breakdown: name | budget | spent | remaining | %
    - Each row's % shown as Progress inline
  Tab (key="export", title="Export")
    Card
      CardBody
        Select (label="Format"): CSV | PDF
        Select (label="Period"): presets
        DateRangePicker
        Button (color="primary", fullWidth): "Export Report"
```

---

## Shared / Reusable Patterns

### Empty States

```
Card (shadow="none", variant="bordered")
  CardBody (flex-col, items-center, gap-3, py-16)
    - Icon (large, muted)
    - Heading: contextual empty message
    - Muted subtext
    - Button (color="primary"): primary CTA
```

### Loading State

Replace table rows or card content with `Skeleton` components that mirror the real layout shape. Use `isLoaded` prop on each `Skeleton`.

### Confirmation Dialog (Delete)

```
Modal (size="sm")
  ModalContent
    ModalHeader: "Delete Expense?"
    ModalBody: "This action cannot be undone."
    ModalFooter
      Button (variant="flat"): "Cancel"
      Button (color="danger"): "Delete"
```

### Toast / Feedback

Use `addToast` from HeroUI's `ToastProvider` for all success/error feedback. Never use `alert()` or custom DOM manipulation.

```
addToast({ title: "Expense added", color: "success" })
addToast({ title: "Something went wrong", color: "danger" })
```

---

## Responsiveness

All layouts use HeroUI's built-in responsive props. No custom breakpoint CSS.

| Context | Pattern |
|---|---|
| Navigation | `NavbarMenuToggle` + `NavbarMenu` for mobile |
| Grids | `className` not used — use HeroUI `grid` layout tokens |
| Table on mobile | `hideHeader` on small screens; show stacked card list instead |
| Modals | `size="full"` on mobile via responsive size prop |
| Buttons | `fullWidth` on mobile, auto width on desktop |

---

## Accessibility

All HeroUI components are ARIA-compliant by default. Enforce these additional rules:

- Every `Input` has a `label` prop (never just `placeholder` as a label substitute)
- Every icon-only `Button` has `aria-label`
- Every `Table` has `aria-label`
- Every `Modal` has a descriptive `ModalHeader`
- `Switch` for dark mode uses `aria-label="Toggle dark mode"`
- Color alone is never the only indicator — pair color with text or icon (e.g., Chip with icon + label for status)
- Focus ring is always visible — never suppress HeroUI's default focus styles
- All form errors surface via Input `errorMessage` prop, not custom DOM elements

---

## Dark Mode

HeroUI handles dark mode automatically via the `dark` class on `<html>`. The app provides a `Switch` in the Navbar to toggle. Store the preference in `localStorage` and apply the class in the root layout before hydration to prevent flash.

No color values are hardcoded. All contrast ratios meet WCAG AA (4.5:1 for text, 3:1 for UI components) by virtue of using HeroUI's semantic tokens.
