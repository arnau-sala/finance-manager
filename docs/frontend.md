# Frontend Guide

This document is the living reference for the Finance Manager frontend. It records product, design, and architecture decisions so the interface can grow screen by screen without losing consistency.

## Product Direction

The frontend is a browser-based app designed primarily for mobile use. The expected main usage is a phone browser, often installed to the home screen as a PWA-like experience. Desktop web usage must still be comfortable, but mobile ergonomics come first.

The interface should feel clean, modern, calm, and professional. The app handles private financial data, so it should avoid loud decoration, marketing-style layouts, and visual noise. It should feel more like a polished native utility than a landing page.

Initial theme scope:

- Light mode only for the MVP.
- Dark mode can be added later after the core product is stable.
- Color choices should keep enough contrast and avoid relying on color alone for meaning.

## Frontend Architecture Decisions

Recommended stack:

- Vite + React + TypeScript for the web app.
- React Router for routing.
- TanStack Query for server state once API usage grows beyond simple auth flows.
- Plain CSS modules or a small design-token CSS layer first; avoid a heavy UI framework until there is a clear need.
- Recharts or Visx later for statistics charts. Start simple; do not introduce chart complexity before the stats screens need it.
- Deploy the frontend on Vercel for the MVP.

Why this stack:

- Vite keeps local development fast and simple.
- React has strong ecosystem support for forms, routing, charts, and PWA-friendly apps.
- TypeScript matches the backend and reduces frontend/API integration mistakes.
- Vercel is simple for free MVP deployment and can support a custom domain later.

Planned structure:

```text
apps/web/
  src/
    app/
      router.tsx
      App.tsx
    components/
      ui/
      layout/
    features/
      auth/
      access-request/
      dashboard/
      transactions/
      statistics/
      account/
      admin/
    lib/
      api-client.ts
      formatters.ts
    styles/
      tokens.css
      global.css
```

The API client should be centralized. Components should not build URLs manually across the codebase. Cookie sessions mean frontend requests must include credentials when calling the API.

## Deployment

The planned frontend deployment target is Vercel.

MVP deployment assumptions:

- Frontend hosted by Vercel.
- API hosted separately.
- Production frontend URL must be added to the API `ALLOWED_ORIGINS`.
- Future custom domain can point to the Vercel project.

The app should be built so it can later support:

- PWA manifest.
- App icon and splash assets.
- Home-screen installation on mobile.
- Mobile safe areas.

## Visual Style

The visual direction is inspired by modern Apple-like interfaces:

- Rounded controls.
- Soft shadows only when useful.
- Clear hierarchy.
- Compact but breathable spacing.
- Smooth, direct interactions.
- Forms that feel native and easy on mobile.
- No heavy gradients, decorative blobs, or noisy backgrounds.

Cards should be subtle and functional. Avoid nesting cards inside cards. Repeated transaction rows can be card-like list items, but the main layout should not become a wall of floating boxes.

## Color System

The MVP uses a light palette with neutral surfaces and restrained semantic colors.

Core colors:

| Token | Hex | Use |
| --- | --- | --- |
| `--color-background` | `#F7F8FA` | App background |
| `--color-surface` | `#FFFFFF` | Main panels, inputs, sheets |
| `--color-surface-muted` | `#EEF1F5` | Secondary surfaces |
| `--color-border` | `#D9DEE7` | Dividers and input borders |
| `--color-text` | `#111827` | Primary text |
| `--color-text-muted` | `#667085` | Secondary text |
| `--color-primary` | `#2563EB` | Primary actions and active navigation |
| `--color-primary-pressed` | `#1D4ED8` | Pressed primary actions |
| `--color-primary-soft` | `#DBEAFE` | Selected/soft primary backgrounds |
| `--color-success` | `#16A34A` | Income, success states |
| `--color-success-soft` | `#DCFCE7` | Soft income/success backgrounds |
| `--color-danger` | `#DC2626` | Expense, destructive actions |
| `--color-danger-soft` | `#FEE2E2` | Soft expense/destructive backgrounds |
| `--color-warning` | `#D97706` | Warnings |
| `--color-warning-soft` | `#FEF3C7` | Soft warning backgrounds |

Usage rules:

- Primary blue is for navigation, confirmation, and focused states.
- Green is reserved for income or success.
- Red is reserved for expenses, errors, and destructive actions.
- Keep most UI neutral. Semantic colors should highlight meaning, not dominate the screen.
- Do not use a one-color theme. The app should not feel entirely blue, beige, purple, or gray.

## Typography

Initial recommendation:

- Use system font stack first: `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Inter`, `sans-serif`.
- Avoid oversized type except on focused summary moments like the dashboard balance.
- Keep letter spacing at `0`.

Suggested scale:

| Token | Size | Use |
| --- | ---: | --- |
| `--font-size-xs` | `12px` | captions, helper text |
| `--font-size-sm` | `14px` | secondary text |
| `--font-size-md` | `16px` | body and inputs |
| `--font-size-lg` | `18px` | section titles |
| `--font-size-xl` | `24px` | page titles |
| `--font-size-balance` | `36px` | dashboard balance |

## Spacing And Shape

Suggested tokens:

| Token | Value |
| --- | ---: |
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `20px` |
| `--space-6` | `24px` |
| `--radius-sm` | `8px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `16px` |
| `--radius-pill` | `999px` |

Apple-like controls can use rounded pills for buttons and search inputs. Repeated content cards should generally stay around `12px` radius so the interface remains professional.

## Core Components

Base components to create early:

- `AppShell`
- `TopBar`
- `BottomNav`
- `DesktopSidebar`
- `Button`
- `IconButton`
- `TextField`
- `PasswordField`
- `Select`
- `SegmentedControl`
- `TransactionRow`
- `AmountText`
- `EmptyState`
- `ErrorMessage`
- `LoadingState`
- `Sheet` or mobile modal

Controls should use familiar icons where helpful. Use `lucide-react` when icons are introduced.

## Navigation

Mobile navigation:

- Bottom navigation for primary authenticated areas.
- Main actions should be reachable with one thumb.
- The add transaction action should be prominent.

Proposed authenticated tabs:

- Dashboard
- Transactions
- Add
- Statistics
- Account

Desktop navigation:

- Left sidebar or top navigation.
- Content should use wider layouts but not stretch excessively.
- Lists and detail panels can sit side by side later.

Public routes:

- Login
- Register
- Request access

Admin routes:

- Admin requests
- Admin request events
- Admin users

Admin screens should be accessible only after login and role check.

## Screens

### 1. App Shell

Purpose: establish layout, navigation, spacing, and responsive behavior.

MVP content:

- Mobile bottom navigation.
- Desktop navigation.
- Page container.
- Loading and error patterns.

### 2. Login

Purpose: authenticate an approved user.

Fields:

- Email.
- Password.

States:

- Loading.
- Invalid login.
- Session already active.

### 3. Register

Purpose: create an account from an approved email.

Fields:

- Email.
- Password.
- Password confirmation.

UX notes:

- Show password requirements clearly.
- Do not reveal whether an email is approved beyond the API response.

### 4. Request Access

Purpose: public access request form.

Fields:

- Email.
- Name.
- Message.

Security UX:

- Always show a neutral success message for syntactically valid requests.

### 5. Dashboard

Purpose: first authenticated screen.

MVP content:

- Current balance.
- Income and spent summary.
- Quick actions for income and expense.
- Recent transactions.
- Link to statistics.

### 6. Create Transaction

Purpose: fast mobile-first transaction entry.

Fields:

- Type: income or expense.
- Category.
- Amount.
- Description.
- Date.

UX notes:

- Expense should be quick to enter.
- Amount input should be optimized for mobile numeric keyboards.
- Category selection should be easy with one hand.

### 7. Transactions

Purpose: browse historical records.

MVP content:

- Paginated transaction list.
- Category filter.
- Transaction detail entry point.
- Empty states.

### 8. Transaction Detail And Edit

Purpose: view, update, or delete one transaction.

MVP content:

- Transaction details.
- Edit form.
- Delete confirmation.

### 9. Statistics

Purpose: show simple financial insights.

MVP content:

- Balance overview.
- Monthly balance.
- Yearly balance.
- Category percentages.

Chart direction:

- Start with simple bars/lists.
- Add richer charts only when the data and UX justify them.

### 10. Account

Purpose: user profile and session controls.

MVP content:

- Email.
- Role/status if useful.
- Logout.

### 11. Admin

Purpose: operational review tools.

MVP content:

- Pending access requests.
- Request detail.
- Approve/deny.
- Access request event log.
- Users list.

Admin UI should feel functional and denser than the consumer finance screens.

## API Integration Notes

- All private API requests rely on the secure session cookie.
- Browser requests must include credentials.
- Mutating requests must come from an allowed origin.
- Handle `401` by sending the user to login.
- Handle `403` with a permissions message or neutral registration/access text depending on context.
- Handle `429` with a retry message.
- Paginated endpoints expose `pagination.nextOffset`; use it for loading the next page.

## Accessibility

Baseline requirements:

- All inputs have visible labels.
- Buttons have clear text or accessible labels.
- Focus states must be visible.
- Touch targets should be at least `44px`.
- Text contrast must be checked against the light theme.
- Do not rely on red/green alone for income/expense meaning.

## Frontend Build Order

Recommended implementation order:

1. Scaffold `apps/web` with Vite, React, and TypeScript.
2. Add design tokens and app shell.
3. Build login.
4. Build register.
5. Build request access.
6. Build dashboard.
7. Build create transaction.
8. Build transaction list.
9. Build transaction detail/edit/delete.
10. Build statistics.
11. Build account.
12. Build admin screens.

Each screen should be polished enough before moving on: responsive layout, loading state, error state, empty state, and API integration where applicable.
