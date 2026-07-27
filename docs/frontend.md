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
- Reusable confirmation dialogs live in `components/ui` and use the existing React and design-token CSS layer; adding a second UI framework is deferred until multiple components justify it.
- Apache ECharts for statistics charts, imported through its modular API and rendered as SVG. A small local React adapter owns initialization and responsive resizing; chart-specific modules register only the ECharts features they use.
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

App icon:

- The canonical icon file is `apps/web/public/icons/app-icon.png`.
- Use a square PNG, ideally `1024x1024px` or larger.
- Avoid transparency if possible because mobile platforms can render transparent app icons inconsistently.
- Keep the symbol centered with enough internal padding so it works when masked by Android or rounded by iOS.
- The source file is used directly in the login screen.
- iOS home-screen installs use `apps/web/public/apple-touch-icon.png`, a `180x180px` PNG without transparency, served from `/apple-touch-icon.png`.
- PWA manifest icons use generated `192x192px` and `512x512px` PNG files without transparency.
- Browser tabs use a generated `32x32px` favicon PNG.
- Icon URLs include a version query so replacing an icon can invalidate the aggressive iOS Web Clip cache.
- For iPhone testing through VS Code port forwarding, only frontend port `5173` should be public. Ports `3001` and `5555` must remain private.
- A private VS Code tunnel redirects iOS's unauthenticated icon request to GitHub sign-in, causing WebKit to generate a letter icon. Set port `5173` to `Port Visibility: Public` while testing installation.
- Verify the public URL in a private Safari tab by opening `/apple-touch-icon.png`. It must return the PNG directly without a sign-in redirect, tunnel warning page, React fallback, or 404.

Viewport and safe-area rules:

- Use `viewport-fit=cover` so iOS home-screen mode exposes safe-area insets correctly.
- The mobile app is portrait-first. The web manifest declares `orientation: portrait`, and touch devices in landscape show `Landscape mode coming soon`.
- Static screens, such as login and register, should fill exactly one viewport and avoid accidental body scroll.
- Screens with real lists or long forms can scroll, but the scroll should belong to the screen content intentionally.
- Horizontal panning and browser edge navigation are blocked throughout the app. A non-passive `touchstart` guard cancels touches originating in either screen edge before WebKit starts native history navigation; vertical scrolling remains available elsewhere. Google's external OAuth pages keep their native gestures.
- The gesture lock is isolated in `app/app-navigation-guard.ts` and installed once by `App`. Removing that single initializer restores native browser navigation when the product is ready to support it.
- Layout padding on mobile should account for `env(safe-area-inset-*)` so content does not collide with notches, home indicators, or browser UI.

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
| `--color-primary` | `#0F766E` | Primary actions and active navigation |
| `--color-primary-hover` | `#0D6B63` | Hover state when a desktop interaction needs it |
| `--color-primary-pressed` | `#115E59` | Pressed primary actions |
| `--color-primary-soft` | `#E7F6F3` | Subtle active and informational backgrounds |
| `--color-primary-soft-strong` | `#CDEBE5` | Selected chips, badges, and stronger highlights |
| `--color-primary-border` | `#9FD8CE` | Borders paired with branded soft backgrounds |
| `--color-primary-accent` | `#4FAF9F` | Charts, indicators, and small visual details |
| `--color-focus-ring` | `rgba(15, 118, 110, 0.25)` | Focus indication |
| `--color-on-primary` | `#FFFFFF` | Text and icons on primary controls |
| `--color-success` | `#16A34A` | Income, success states |
| `--color-success-soft` | `#DCFCE7` | Soft income/success backgrounds |
| `--color-danger` | `#DC2626` | Expense, destructive actions |
| `--color-danger-soft` | `#FEE2E2` | Soft expense/destructive backgrounds |
| `--color-warning` | `#D97706` | Warnings |
| `--color-warning-soft` | `#FEF3C7` | Soft warning backgrounds |

Usage rules:

- Petroleum green is the brand and interaction color. Use it for primary actions,
  active navigation, important links, and focus states.
- Keep main surfaces white and the interface predominantly neutral. Soft green
  belongs only to selected, active, or intentionally highlighted elements.
- Use the darker primary only for pressed states. Use the accent sparingly for
  charts, secondary icons, and small indicators.
- Primary buttons use the brand color with white text. Secondary buttons stay
  white or neutral unless selected or focused.
- Semantic success green is reserved for income, confirmation, and positive results.
- Red is reserved for expenses, errors, and destructive actions.
- Keep most UI neutral. Semantic colors should highlight meaning, not dominate the screen.
- Do not use a one-color theme. The app should not feel entirely blue, beige, purple, or gray.
- Brand green and semantic success green must remain separate: primary expresses
  interaction, while success expresses income, confirmation, or a positive result.
- Never rely on color alone for financial types or states; pair it with text,
  labels, or icons.
- Component styles must consume the centralized tokens in `styles/tokens.css`.
  Direct color values are reserved for external brands such as Google.

## Typography

Initial recommendation:

- Use the locally bundled Inter family in light and regular weights.
- Avoid oversized type except on focused summary moments like the dashboard balance.
- Avoid bold text as a default hierarchy tool; prefer size, spacing, and light-to-regular weight changes.
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

The bottom navigation is a floating translucent surface with a subtle border, blur, and shadow. It remains above page content while preserving visible margins around it; scrollable Home and Profile content can pass behind the bar and includes enough bottom padding to remain fully reachable.

### 2. Login

Purpose: authenticate an approved user.

The unauthenticated entry screen combines the available access paths in one
static, mobile-first layout:

- Email entry starts the normal login flow; password entry belongs to the next screen.
- Create an account leads to the access-request flow.
- Continue with Google starts the backend OAuth flow. A successful Google account session enters the app; a non-approved account opens a Google access-request form with verified email/name prefilled.
- The initial logo and slogan are placeholders until the product identity is finalized.
- The entry screen uses a flat white canvas, without a card around the main content.
- Controls do not use hover animations or desktop-specific sizing; they remain touch-first.
- The screen must not scroll, zoom, or overscroll when all content fits in the viewport.

Fields:

- Email.
- Name.
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
- Message (optional note for the administrator).

Security UX:

- Validate the email, required name, and field lengths locally before calling the API.
- Submit only from the explicit `Submit request` button.
- Always show a neutral success message for syntactically valid requests.
- Google access requests show a slightly different form: email and name come from the verified Google identity and are prefilled. The email remains read-only, while the user can edit the display name and add an optional administrator message before submitting.
- Google access requests also use neutral copy and do not reveal whether the email is registered, pending, approved, or newly requested.
- After a successful response, show a simple confirmation screen with the normalized email, name, and submitted message, or `No message added` when it was left empty.
- Use the visible back button to return to the unauthenticated entry screen. Horizontal edge swipes are intentionally disabled.

### 5. Dashboard

Purpose: first authenticated screen.

MVP content:

- Personal greeting and current date.
- Current balance as the single headline figure.
- Primary action for recording a transaction.
- Three latest transactions with a route toward the complete list.
- A three-column monthly activity summary for transaction count, highest expense category, and highest income category.

The Dashboard loads its real values through one authenticated `GET /api/home` request. The response contains the all-time balance, at most three latest transactions, and current-month activity, keeping the initial mobile view to one network round trip. Loading, empty, and error states preserve the same layout. The latest-moves region always reserves the height of three rows, so profiles with fewer transactions do not pull the content below it upward.

If the Home request reports an expired session, the authenticated interface is blocked by a non-dismissible alert dialog. Its only action clears local session state and returns to the unauthenticated main screen; backdrop clicks and the Escape key cannot close it.

Transaction category icons come from `lucide-react` and are mapped by stable category ID rather than display name. The same map is used by latest moves and the top expense/income activity metrics. Every predefined category has a specific icon; missing or unknown categories fall back to an upward income arrow or downward expense arrow.

Euro amounts use one shared frontend formatter. They use a decimal comma, omit digit grouping and place the currency symbol directly after the number, for example `1234,56€`, `+100,00€`, and `-42,80€`.

The Home layout uses five intrinsic grid rows with a minimum gap. Available vertical space is distributed between those rows on tall screens; when their content exceeds the viewport, the Home content region becomes vertically scrollable while the footer remains fixed.
- Recent transactions.
- Link to statistics.

### 6. Create Transaction

Purpose: fast mobile-first transaction entry.

The initial interface is a full-screen composer presented as a temporary layer
above Home. It keeps the task focused, hides the bottom navigation while open,
and gives the mobile keyboard and category picker the full viewport instead of
placing a long form inside a small dialog. Closing it returns focus to the Home
action that opened it.

Fields:

- Amount.
- Type: income or expense.
- Name, stored through the API's `description` field.
- Category.
- Date.

UX notes:

- Expense is selected by default and type changes use a visible two-option
  segmented control. Its selected segment can be dragged a short distance
  toward the other option, while taps on either option remain available.
  Horizontal navigation gestures outside this control remain disabled.
- Income and expense use restrained semantic green and red treatments while the
  save action continues to use the petroleum brand color.
- The amount input uses the mobile decimal keyboard and the fields retain their
  natural form order for previous/next keyboard navigation.
- Categories are selected from a four-column icon grid backed by the same
  category catalog used on Home; no dropdown is used.
- Date defaults to the phone's current calendar day. The native HTML date input
  allows Safari on iOS to provide Apple's system picker; transaction time is not
  part of the financial record.
- Before submitting, the client validates the positive amount and its two-decimal
  limit, the required name, the category/type pairing, and the calendar date.
  The API repeats all validation and remains authoritative.
- Submission uses the authenticated `POST /transactions` endpoint. Controls are
  temporarily disabled to prevent duplicate writes, and connection, validation,
  rate-limit, and server errors remain visible without clearing the form.
- A successful creation closes the composer and refreshes the aggregated Home
  response so its balance, latest moves, and monthly activity update together.
  A `401` response opens the existing non-dismissible session-expired dialog.

### 7. Transactions

Purpose: browse historical records.

The `Moves` footer item loads the current user's records from
`GET /transactions`. API pages are requested in batches of 200 until
`nextOffset` is `null`, ensuring that search and filters operate over the full
history. It uses the shared transaction-row component also used by Home, so
icon, category, date, amount formatting, and income/expense colors remain
consistent.

Current behavior:

- Case-insensitive search against the transaction description only.
- Local automatic presentation in batches of 12. An `IntersectionObserver`
  rooted in the Moves scroll area reveals the next batch near the list end.
- Dynamic result count, clear-search action, and an empty search state.
- Combined filtering by exact amount or amount range, exact date or date range,
  one or more categories, and transaction type.
- Filters use a draft state and update results only through `Apply filters`;
  `Clear all` resets the results immediately.
- The filter panel can be hidden without clearing applied filters and restores
  those values when reopened.
- A `401 Unauthorized` response opens the shared expired-session dialog.

Final MVP content:

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
- All-time balance.
- Category percentages.

The numeric view consumes the authenticated `GET /statistics/overview`
endpoint. One response provides the money summary, category totals, insights,
and expense behavior required by the complete view. Month, Year, and All use
the same response contract, and no raw transactions or `userId` values reach
the browser. Money is kept in one group containing net balance, income,
expenses, and the percentage of income saved. Category values show amounts by
default. Selecting any value switches the visible list to percentages;
selecting one again restores the amount view. Summary amounts are displayed as
whole euros while cents remain preserved in the API values.

In Month mode, the visible month and year open the custom month picker. Enabled
months come from the authenticated `GET /statistics/months` endpoint. Future
days and months are excluded, and the current period ends today when
calculating daily values or no-spend streaks. The picker's year can be changed
with bounded arrow controls, a horizontal swipe, or a mouse/trackpad wheel.
Selecting an enabled month closes the picker and updates the Stats period.

Year mode uses an anchored picker with the same animation, focus handling, and
outside-click behavior as the month picker. It derives available years from the
already available month keys instead of requesting the database again. Every
year between the first recorded year and the current year is shown; years
without transactions are disabled. The modal is not interactive when only one
recorded year exists. With multiple years, balanced rows contain two or three
options: four years become a 2x2 layout, five become 3+2, and later rows expand
when necessary so that a single orphan option is avoided.

The numeric Insights section adapts to the selected period. Every mode shows
the top expense and income with their exact dates. Year adds the best and worst
month, positive month count, and average monthly balance. All adds the same
monthly indicators across the complete history plus their yearly equivalents.
Best and worst periods are ranked by savings percentage and show both balance
and percentage. Periods without income are excluded from that ranking because
their savings percentage is undefined, but they still count toward positive
period and average balance calculations. Insights use the same row structure,
icon treatment, type scale, and spacing as the category list.

The final Expenses section focuses on spending behavior rather than repeating
the main totals. It shows the median expense, the daily/monthly/yearly expense
for the selected mode, and the longest no-spend streak. The current no-spend
streak appears only for the current month, current year, and All; closed
month/year periods omit the row entirely. A trophy marks the current streak
when it is also the longest.

Stats has separate Overview and Charts views under the same period controls.
Changing views moves only the content below the selected period, while the
header and date controls remain fixed. The chart engine is loaded through a
dynamic import the first time Charts is opened, so ECharts is excluded from the
initial application bundle. The charts response is also requested only when
that view is active. Overview and Charts results use a short 30-second
in-memory cache by authenticated account and period. Period availability uses
60 seconds. Transaction changes, logout, account deletion, and session
expiration invalidate those caches.

The shared `components/charts/EChart.tsx` adapter initializes one modular
ECharts instance, uses the SVG renderer, responds to container resizing, and
disposes the instance with the React lifecycle. Charts consumes one
authenticated `GET /statistics/charts` response. Shared financial intervals
feed Period Balance and Income vs Expenses, while one category-by-interval
aggregation feeds both Category Breakdown and Category Timeline.

`Net Worth Evolution` remains visibly unavailable until the data model stores
an opening net worth and its effective date. The API reports
`OPENING_BALANCE_REQUIRED` instead of drawing a misleading line from zero.

`Period Balance` displays income minus expenses around an explicit zero line.
Year renders one bar per available month and All one aggregated bar per year.
The graph is intentionally omitted from Month, and exact signed values appear
only after pressing a bar. Pressing the selected bar again or pressing outside
the chart clears its focus and dismisses the detail.

`Income vs Expenses` follows Period Balance in Year and All and is likewise
omitted from Month. It renders stepped areas from the same shared financial
intervals: income remains above zero, expenses below it, and each height change
lands on an interval boundary. Labels are centered inside the represented
month or year, future periods are not reserved, and the shared tooltip exposes
both exact amounts. Pressing an interval outlines its income and expense areas
while muting every other interval; pressing it again or pressing outside clears
the selection.

`Category Breakdown` and `Category Timeline` share the same category totals.
Categories below one percent are grouped into Other when necessary. Breakdown
uses the compact percentage matrix; Timeline shows how each category is
distributed over weeks, months, or years. `Weekday Spending` uses seven
server-provided weekday aggregates and appears when the selected period has
enough expense transactions.

The deterministic statistics fixture files remain in the repository as visual
development references, but production components do not import or bundle
them.

### 10. Account

Purpose: user profile and session controls.

MVP content:

- Name and account creation date.
- Email.
- Provider-specific account actions.
- Name editing through a focused modal; email remains read-only account data.
- Password changes through a three-field modal for password accounts.
- Confirmed logout.
- Irreversible account deletion confirmed by password or fresh Google account selection.

Google deletion returns to the profile with a warning dialog when the selected account does not match the active session. The dialog identifies the required session email without exposing it in the OAuth redirect URL.

The edit-profile modal uses the current name as its placeholder, validates the shared 1-to-100-character name rule locally, and enables submission only for a valid changed value. The profile replaces its session user with the `PATCH /account` response so the new name appears without another API read.

The change-password modal requires the current password and two copies of the new password. It enables submission once all three fields contain a value, then validates the registration password policy and matching new-password fields locally before calling `PATCH /account/password`. A successful request replaces the form with confirmation content in the same dialog; API and rate-limit errors remain visible alongside the form.

Logout keeps the confirmation dialog visible while the request is pending. Only after the API confirms that the session has ended does the private screen slide to the right, revealing the public access screen underneath. Failed and cancelled attempts do not trigger the transition.

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
