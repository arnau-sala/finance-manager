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
      text-fields.css
      buttons.css
      global.css
```

The API client should be centralized. Components should not build URLs manually across the codebase. Cookie sessions mean frontend requests must include credentials when calling the API.

## Deployment

The planned frontend deployment target is Vercel.

MVP deployment assumptions:

- Frontend hosted by Vercel at `https://financemanager-mobile.vercel.app`.
- API hosted separately at `https://financemanager-api.vercel.app`.
- Those origins are defined once in `apps/api/src/config/deployment.ts`. The
  web `/api` rewrite, Google redirect URI, and production CORS default all
  follow that file.
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
- Runtime brand screens use the optimized `512x512px` variant, which is
  preloaded in `index.html`; the larger source remains available only for
  generating future icon variants.
- iOS home-screen installs use `apps/web/public/apple-touch-icon.png`, a `180x180px` PNG without transparency, served from `/apple-touch-icon.png`.
- PWA manifest icons use generated `192x192px` and `512x512px` PNG files without transparency.
- Browser tabs use a generated `32x32px` favicon PNG.
- Icon URLs include a version query so replacing an icon can invalidate the aggressive iOS Web Clip cache.
- Portrait iPhone launch screens live in `public/apple-startup` and are selected
  through `apple-touch-startup-image` media queries, with the iPhone 15 image as
  the generic fallback. These system-owned images use a white background and a
  centered icon whose rendered size matches the first HTML frame for each DPR.
  The following persistent HTML splash also contains only the icon. Before its
  first paint, a critical inline script freezes the standalone viewport
  compensation required to retain the native vertical position while WebKit
  initializes. The pre-sized splash raster is embedded in the HTML so the first
  web paint cannot precede its network request or decode. React controls the
  exit of that same DOM element instead of replacing it with a second splash
  component.
- For iPhone testing through VS Code port forwarding, only the frontend port in use (`5173` for development or `5174` for production preview) should be public. Ports `3001` and `5555` must remain private.
- A private VS Code tunnel redirects iOS's unauthenticated icon request to GitHub sign-in, causing WebKit to generate a letter icon. Set the active frontend port to `Port Visibility: Public` while testing installation.
- Verify the public URL in a private Safari tab by opening `/apple-touch-icon.png`. It must return the PNG directly without a sign-in redirect, tunnel warning page, React fallback, or 404.

Viewport and safe-area rules:

- Use `viewport-fit=cover` so iOS home-screen mode exposes safe-area insets correctly.
- The initial app shell renders a small inline splash before JavaScript starts,
  then reuses the same visual component while the session is checked. It uses
  the Retina-ready `512x512` app icon, respects safe areas and reduced-motion
  preferences, and never delays the destination screen artificially. For an
  authenticated launch, the static splash remains until the Home overview
  settles, then exits through a short blur crossfade over the rendered screen.
  An anonymous launch waits for both the preloaded brand icon and the Inter
  weights used by the landing page before revealing it. This prevents missing
  artwork and late font swaps from moving the static entry layout.
- The splash exits completely against the white app surface before the
  destination is revealed. The two short blur phases are sequential, so the
  splash logo and the destination logo are never composited together.
- Visibility lifecycle events never reactivate the global splash. A live web
  process therefore returns directly to its existing screen, including after a
  short background interval. If iOS discards the process, its icon-only launch
  surface hands off to the matching persistent HTML splash until the destination
  is ready.
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

### Text fields

Conventional text fields use the shared classes in `styles/text-fields.css` and
the dimensions defined in `styles/tokens.css`:

- `text-field` is the standard 50px, muted-surface field.
- `text-field--prominent` keeps the landing identifier aligned with its 58px actions.
- `text-field--compact` and `text-field--search` serve dense filter and toolbar controls.
- `text-field--composer` follows the transaction composer's compact viewport height.
- `text-field--dialog` preserves the 44px modal height and uses a white surface.
- `text-field-shell` applies the same system to composite fields containing icons or native controls.

All variants share the same pill shape, border, typography, focus, and error
behavior, including `20px` of leading text padding. Focus and error states
change the border only; non-dialog fields stay gray and dialog fields stay
white. Large currency editors and segmented
verification-code inputs are intentional exceptions because their content has a
different visual structure.

Visible field titles use `text-field-label`, which applies the same `20px`
leading alignment and muted text color across forms, filters, and dialogs.

Password inputs must use the shared `AuthPasswordField`. While hidden, it
renders the same fine-dot overlay in every flow and can color only mismatched
confirmation characters. Every password field includes the persistent
show/hide icon action. The `dialog` variant keeps the shared behavior while
using the white 44px modal field surface.

Profile offers `Link username` only while the authenticated user has no
username. The full-screen account flow reuses the registration availability
field and password assistance controls: Google-only accounts see username and
password fields, while accounts with email/password sign-in see only username.
Success slides to the shared one-time recovery-code screen, then returns to the
updated Profile.

Profile actions are grouped into `Account`, `Security`, and `Session` sections.
Account always starts with profile editing, followed by available Google,
email, and username links. Once at least two sign-in methods exist, every
linked method also has a red-icon `Unlink` row after the remaining link rows;
all three unlink actions use secure server-confirmed flows. A Google-only
account omits `Security` because it has
neither a password nor a recovery code.

`Unlink Google` is functional when another password-based method remains. Its
confirmation copy lists the exact methods and email association that will
remain. Continuing opens Google's account chooser; cancellation restores the
confirmation, an identity mismatch opens a warning with the required address,
and success returns directly to the updated Profile. `Unlink username` uses the
same password-confirmation field as account deletion, explains the remaining
methods, and returns the updated Profile without a navigation. Email unlink
first explains which username and Google methods will remain, then sends a
six-digit code to the current address. Its confirmation modal reuses the shared
one-time-code cells, expiry, errors, and resend cooldown with destructive red
accents. Success rotates sessions and returns the updated Profile without a
navigation. Every successful Google, email, or username unlink then replaces
its confirmation state with a matching informational dialog: a confirmation
icon, concise removed-method message, and one `Done` action.

### Buttons

Command buttons use the shared `ActionButton` component in
`components/ui/ActionButton.tsx`. Its geometry lives in `styles/buttons.css`
and uses the radius tokens from `styles/tokens.css`:

- The default shape is a full pill for primary, secondary, destructive, dialog,
  profile, retry, and compact text actions.
- `shape="icon"` creates a circular icon action such as Back, Close, or Filters.
- `shape="card"` is reserved for multi-line action cards, such as choosing the
  initial account method, where a pill would not fit the content naturally.

Colors, heights, and layout remain owned by each feature so semantic danger,
brand actions, and neutral actions stay distinct. Data rows, chart cells,
category choices, filter tags, navigation items, inline text links, and
segmented controls are not `ActionButton` instances because they represent
selection or information rather than a standalone command. The compact
List/Charts view control is an intentional pill-shaped exception while keeping
its segmented-control behavior.

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
| `--color-password-autofill` | `#FAFFBD` | Apple-compatible generated-password fill |

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
- `CalendarDatePicker`
- `TransactionRow`
- `AmountText`
- `EmptyState`
- `ErrorMessage`
- `SkeletonBlock`
- `LoadingState`
- `Sheet` or mobile modal

Controls should use familiar icons where helpful. Use `lucide-react` when icons are introduced.

## Loading Feedback

Read-only server data uses a shared local `SkeletonBlock` component instead of
loading text, blank values, or page-level spinners. Its neutral surface and
left-to-right shimmer preserve the expected layout while React Query resolves
the request; it does not start requests or add artificial delay.

Current behavior:

- Home replaces the complete overview with a matching skeleton until its first
  response settles.
- Transactions skeletonize the initial screen and each new search or filter
  result, then append row skeletons while another infinite-scroll page is
  fetched.
- Statistics skeletonize availability, the complete overview, and the chart
  collection as coherent groups.
- Transaction details render the preview data immediately and skeletonize only
  the balance and contextual ranking that require the detail request.
- Mutation controls keep explicit progress labels such as `Saving...` because
  they communicate an action already requested by the user, not incoming page
  content.
- Errors and empty states remain explicit and are never represented as loading.
- Reduced-motion preferences disable the moving shimmer while preserving the
  skeleton shapes.

A build-time DOM snapshot library such as Boneyard was evaluated but is not used
for the MVP. Protected, stateful screens would require browser fixtures and
regeneration after each layout change. The local primitive has no runtime
dependency, works with the existing design tokens, and lets each feature define
only the geometry it actually owns.

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

Purpose: authenticate an existing user.

The unauthenticated entry screen combines the available access paths in one
static, mobile-first layout:

- Email or username entry starts the unified login flow; password entry belongs
  to the next screen.
- Continue with Google is grouped with normal sign-in above the `OR` divider.
  Existing linked identities enter immediately; an unknown identity opens a
  concise confirmation over the landing page before account creation.
- Create an account is the sole action below `OR` and opens the dedicated
  registration-method screen.
- The initial logo and slogan are placeholders until the product identity is finalized.
- The entry screen uses a flat white canvas, without a card around the main content.
- Controls do not use hover animations or desktop-specific sizing; they remain touch-first.
- The screen must not scroll, zoom, or overscroll when all content fits in the viewport.

Fields across the two login steps:

- Email or username.
- Password.

States:

- Loading.
- Invalid login.
- Session already active.

### 3. Register

Purpose: choose between verified email, username-only, and Google accounts
without making their recovery and sign-in differences ambiguous.

The first registration screen is static and non-scrollable. It presents three
large actions: `Email account`, `Username account`, and `Google account`. Each
uses the same compact three-point comparison. Email accounts recover by email
and may add a username; username accounts recover with their one-use code and
may add an email; Google accounts use a verified Google address and need no app
password. Selecting email or username slides the shared form in from the right.
Selecting Google opens its account chooser.

If Google registration finds no account, it creates one and enters onboarding.
An existing Google account opens a short sign-in confirmation over the method
screen. A password-only account opens a separate explanation and can continue
to password login with the verified email prefilled. Cancelling either dialog
leaves the registration-method screen unchanged.

Shared fields:

- Name.
- Password.
- Password confirmation.

Email-specific field:

- Email.

Username-specific field:

- Username.

UX notes:

- Show password requirements clearly.
- Validate all fields locally before calling `POST /auth/register`. Validate
  email format on blur and keep submission disabled until it is valid.
- Move to code verification after the neutral `202` response.
- Do not reveal whether the email already has an account.
- Keep registration passwords only in React memory and in their semantic form
  controls until server-confirmed account creation. This lets Safari associate
  the submitted credential with the final success state. Unmount and clear the
  form immediately when registration finishes or is abandoned.
- Show requirement completion and a compact strength meter beneath the first
  password. The optional generator uses Web Crypto, guarantees every backend
  requirement, and fills both password fields with a 14-character value. Both
  fields use the same pale-yellow fill as WebKit password autofill until the
  user manually edits either value.
- Keep the native password inputs active for cursor, editing, and visibility
  behavior. Masked fields remain real `type="password"` controls and switch to
  `type="text"` only while explicitly revealed, without replacing the DOM
  input. While masked, both fields use the same thin dots; compared
  positions remain black when they match and turn red only when they differ.
  Both input borders turn green only when the password is valid and the
  complete values match.
- Mark both new-password controls with `autocomplete="new-password"` and mark
  either email or username as `autocomplete="username"` so platform password
  managers can associate the credential with the account.
- Keep the semantic registration form mounted until the account is actually
  created. The final confirmation submits that same form natively to
  `POST /auth/login/browser`; its `303` redirect returns to the app with an
  authenticated session and gives platform password managers the conventional
  form-submission lifecycle used for save prompts.
- Treat the API response identically for new and existing emails. The browser
  receives no delivery flag and cannot infer whether Brevo was called from the
  response status or body.
- Detect reserved usernames immediately while the user types, but reveal other
  local length and format errors only after the field loses focus. For locally
  valid values, debounce `GET /auth/usernames/:username/availability` by 250 ms
  and keep its result hidden until blur. Only the latest request may update
  state. A valid available username then shows an animated green check;
  unavailable and failed checks remain visible beside the field. Never show an
  intermediate `Checking` label.
- Username availability only enables the primary action. Submission still
  sends the complete payload to `POST /auth/register/username`, where every
  field and the final username claim are validated again.

### 4. Username Recovery Code

Purpose: hand the username-only account's recovery secret to its owner before
entering the authenticated app.

Behavior:

- Open immediately after successful `POST /auth/register/username`.
- Display the grouped recovery code returned by that response and provide a
  dedicated copy action with visible confirmation.
- Explain that the code replaces email recovery, must be stored securely, can
  reset the password, and cannot be shown again.
- Keep the plaintext code only in React memory. Do not write it to local
  storage, session storage, logs, or URLs.
- Enter the authenticated flow only after the user presses `Continue`; the
  existing first-account flow then opens Starting Net Worth setup.
- Do not provide a back action after account creation, because returning to the
  form would hide the only plaintext copy of the recovery code.
- Profile shows `Reset recovery code` only when the session user has a username,
  regardless of linked email or Google access. Its confirmation dialog offers
  an off-by-default option to sign out other devices.
- Reuse this recovery-code page for the reset handoff. The reset request only
  prepares the code; pressing `Done` after the enforced reading delay activates
  it and returns to Profile. The old code remains valid if preparation or
  activation fails.

### 5. Email Verification

Purpose: finish password registration with the code delivered by Brevo.

Fields:

- Six-digit verification code.

Security UX:

- Keep the normalized email from the registration step in application state; do
  not ask the user to edit it on the code screen.
- Render six visual cells over one numeric input so paste, keyboard navigation,
  and iOS `one-time-code` AutoFill behave as a single field.
- Submit through `POST /auth/register/verify` and enter onboarding immediately
  after the API creates the session.
- Offer resend through `POST /auth/register/resend`, with a visible 60-second
  cooldown to match the backend rule.
- Explain the 10-minute expiry and use one neutral invalid-or-expired message.
- Returning to the form keeps the non-sensitive email and name but requires the
  password fields to be entered again.

### 6. Account Recovery

Purpose: recover password accounts without exposing whether an identifier
exists or turning a recovery credential into an authenticated session.

Behavior:

- `Forgot password?` opens the existing dialog style over login and accepts the
  same unified email-or-username identifier.
- An email starts the neutral email flow and opens the shared six-cell code
  screen. A username opens the 16-character recovery-code screen. `Forgot your
  username?` opens that same screen without requiring an identifier.
- Reuse the registration email-code component so iOS `one-time-code` AutoFill,
  expiry text, resend countdown, spacing, and controls remain identical.
- After verification, show two normal `AuthPasswordField` controls and the same
  password-strength and requirements component used by account creation. Keep
  the action disabled until both valid passwords match.
- Email recovery returns to login with the identifier filled and a concise
  success status. Recovery-code completion first reuses the one-time code page
  to hand off the replacement recovery code, then returns to login.
- Never store passwords, email codes, recovery codes, or reset-grant tokens in
  browser storage. `sessionStorage` may retain only the stage and normalized
  identifier for 10 minutes so switching to Mail can survive a page reload.
- Back from the new-password step calls the cancellation endpoint to revoke the
  temporary grant. A completed reset never signs the user in automatically.

### 7. Starting Net Worth Setup

Purpose: establish the user's real financial baseline before showing the
authenticated app for the first time.

The setup is a flat, full-screen step without the bottom navigation. It explains
that net worth means what the user owns minus what they owe, accepts a signed
amount with at most two decimals, and keeps the primary action close to the
bottom of the content. `Skip for now` remains visible in the safe-area-aware
top bar.

Both save and skip call the same authenticated endpoint. Saving records the
timeless amount; skipping records `0`. The central app shell checks whether
`startingNetWorth` is null after password login, Google login, and session
restoration, so no authentication path can bypass the initial screen
accidentally. The value can be replaced later without changing transactions.
Session expiration uses the existing non-dismissible dialog.

### 8. Dashboard

Purpose: first authenticated screen.

MVP content:

- Personal greeting and current date.
- Net worth as the single headline figure when a starting value exists;
  otherwise an explicitly labelled tracked balance.
- Primary action for recording a transaction.
- Three latest transactions with a route toward the complete list.
- A three-column monthly activity summary for transaction count, highest expense category, and highest income category.

The Dashboard loads its real values through one authenticated `GET /api/home` request. The response contains all-time cash flow, current net worth when available, at most three latest transactions, and current-month activity, keeping the initial mobile view to one network round trip. Loading, empty, and error states preserve the same layout. The latest-moves region always reserves the height of three rows, so profiles with fewer transactions do not pull the content below it upward.

If the Home request reports an expired session, the authenticated interface is blocked by a non-dismissible alert dialog. Its only action clears local session state and returns to the unauthenticated main screen; backdrop clicks and the Escape key cannot close it.

Transaction category icons come from `lucide-react` and are mapped by stable category ID rather than display name. The same map is used by latest moves and the top expense/income activity metrics. Every predefined category has a specific icon; missing or unknown categories fall back to an upward income arrow or downward expense arrow.

Euro amounts use one shared frontend formatter. They use a decimal comma, omit digit grouping and place the currency symbol directly after the number, for example `1234,56€`, `+100,00€`, and `-42,80€`.

The Home layout uses five intrinsic grid rows with a minimum gap. Available vertical space is distributed between those rows on tall screens; when their content exceeds the viewport, the Home content region becomes vertically scrollable while the footer remains fixed.
- Recent transactions.
- Link to statistics.

### 9. Create Transaction

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
- The Name control starts at one line and grows automatically up to three full
  wrapped lines. Longer values scroll inside that fixed maximum; manual
  resizing and explicit line breaks remain disabled, preserving the
  single-name value used by the API. Creation and editing both enforce a
  50-character maximum. A compact counter appears from character 35 onward.
- Categories are selected from a four-column icon grid backed by the same
  category catalog used on Home; no dropdown is used.
- The composer keeps its confirmation action fixed near the bottom thumb area.
  Shared field, spacing, and category-grid dimensions are compact enough for
  the larger Expense catalog to fit without scrolling on normal mobile
  viewports; an additional short-viewport layout preserves usable touch targets.
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

### 10. Transactions

Purpose: browse historical records.

The `Moves` footer item loads the current user's records from
`GET /transactions`. The first 20 records are normally prefetched after Home
finishes, and further pages are requested only when the list approaches its
end. Search and applied filters are sent to the API, so pagination remains
correct for histories with hundreds or thousands of records. It uses the
shared transaction-row component also used by Home, keeping icon, category,
date, amount formatting, and income/expense colors consistent.
Search text, applied filters, filter-panel visibility, and scroll position are
kept by the authenticated screen container while the user moves between footer
sections.

Current behavior:

- Debounced, case-insensitive server search against the transaction description
  only.
- Automatic server pagination in batches of 20. An `IntersectionObserver`
  rooted in the Moves scroll area requests the next page near the list end.
- Dynamic result count, clear-search action, and an empty search state.
- Combined filtering by exact amount or amount range, exact date or date range,
  one or more categories, and transaction type.
- Exact and range date filters use the shared anchored calendar instead of the
  browser's native date dialog. Its Monday-first day view supports arrows and
  horizontal paging between months; selecting the header opens the matching
  year grid, where choosing a month returns to its days. Dates before the
  account's oldest transaction and after today are disabled.
- Range mode shares one calendar between `Start date` and `End date`. Starting
  from `Start date` keeps the picker open after the first date and closes it
  once the end is selected; starting from `End date` replaces that boundary.
  Partial ranges survive outside-click dismissal, while complete ranges show
  both endpoints and a continuous soft-green interval.
- Filters use a draft state and update results only through `Apply filters`;
  `Clear all` resets the results immediately.
- The filter panel can be hidden without clearing applied filters and restores
  those values when reopened.
- A `401 Unauthorized` response opens the shared expired-session dialog.

When the account has no transactions, Moves retains the `Transactions` title
but hides its result count, search, filters, and history. It uses the same first
transaction empty state and shared New Transaction composer as Stats. After a
successful creation, the owner-scoped financial queries are invalidated while
Moves remains the active section.

While its transaction request is loading, Moves renders only the
`Transactions` title. The result count, search field, filter control, and list
remain absent until the request finishes.

Final MVP content:

- Paginated transaction list.
- Category filter.
- Transaction detail entry point.
- Empty states.

### 11. Transaction Detail And Edit

Purpose: view, update, or delete one transaction.

Transaction rows in Home and Moves open a shared mobile bottom sheet above the
current section. The underlying screen remains mounted and inert, preserving
its scroll position, search, and filters. A transparent backdrop blurs that
content without applying a gray tint, so white surfaces and the iOS status-bar
region retain their normal color. The sheet can be dismissed through its close
control, the backdrop, `Escape`, a controlled downward drag from its handle, or
a direct downward swipe over the rest of its non-scrollable content.
The content swipe is disabled whenever vertical overflow is present so it
cannot compete with scrolling. The sheet restores focus to the transaction that
opened it.

The sheet opens immediately with the real summary already held by Home or
Moves, then completes its derived values through one authenticated
`GET /transactions/:id` request. Moves speculatively loads no more than five
likely details for its current query, starting with the first three visible
records. Successful detail responses remain in the owner-keyed query cache for
up to 10 minutes. It presents the category, type, title, signed
amount, full date, tracked balance before and after the movement, and a local
Month/Year/All context selector for category rank, type rank, and period impact.
All three contexts arrive together, so changing the selector performs no
additional network request.

Transaction titles wrap normally between words. A single word wider than the
entire title line receives browser-visible soft hyphens at its actual wrap
points, preventing overflow without splitting ordinary phrases unnecessarily.

The action control expands Share, Edit, and Delete around its trigger. Share
builds a compact English summary from the transaction already held in the
sheet and opens the browser or operating system's native share interface
through Web Share. It sends a `Finance Manager` title plus type, description,
signed amount, category, and date as text. Cancelling the native interface has
no side effect; unsupported browsers copy the same text to the clipboard and
show brief feedback.

Edit opens the same full-screen transaction composer used for creation above
the detail sheet; the detail remains mounted but inert underneath. Every field
is prefilled, the save action stays disabled until a value changes, and
changing the transaction type clears the incompatible category. The client
repeats the creation validations and sends only changed fields through
`PATCH /transactions/:id`.

Closing the editor without saving reveals the unchanged detail. A successful
save invalidates the affected owner-keyed query families, preserves currently
visible data during background revalidation, and recalculates the selected
transaction's derived balance, ranks, and period impact.

Delete opens a compact confirmation popover directly below the trash action.
It identifies the transaction, states that the operation cannot be undone, and
keeps the underlying detail mounted but inactive. Outside clicks and `Escape`
cancel only the confirmation. While the authenticated `DELETE` request is in
progress, every confirmation control is disabled; success closes the detail and
refreshes every financial view, while failures remain visible in the popover.

### 12. Statistics

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
the same response contract. Only the compact previews for the largest income
and expense reach the view so those two insights can open the shared
transaction-detail sheet; no transaction history or `userId` values are
included. Money is kept in one group containing net balance, income,
expenses, and the percentage of income saved. Category values show amounts by
default. Selecting any value switches the visible list to percentages;
selecting one again restores the amount view. Summary amounts are displayed as
whole euros while cents remain preserved in the API values.

Best/Worst month and year insights are rendered only as complete comparison
pairs. If the selected range has fewer than two periods with a calculable
savings percentage, neither row in that pair is shown.

When `GET /statistics/months` reports no recorded period, Stats replaces its
period controls, view selector, Overview, and Charts content with one empty
state while retaining the `Stats` page title. Its action opens the shared New
Transaction composer. A successful first transaction invalidates Statistics
and Home, closes the composer, and leaves Stats as the active section.

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
for the selected mode, and the longest no-spend streak. Median and average
expense rows are omitted when the selected period contains no expenses. The
current no-spend streak appears only for the current month, current year, and
All; closed month/year periods omit the row entirely. A trophy marks the
current streak when it is also the longest.

Stats has separate Overview and Charts views under the same period controls.
Changing views moves only the content below the selected period, while the
header and date controls remain fixed. ECharts stays outside the initial
authenticated bundle, but entering Stats schedules its dynamic import during
idle time. Current-month Charts, current-year Overview, previous-month
Overview, current-year Charts, All Overview, and finally All Charts are
prefetched sequentially. Arbitrary period navigation remains foreground-only
and does not fan out into speculative chart requests.

All financial screens share TanStack Query's in-memory cache. Data is fresh for
five minutes and can remain inactive for 30 minutes, so revisiting a screen
renders cached content immediately and revalidates stale data without replacing
it with a loading screen. Period availability is fresh for 15 minutes. Hiding
the installed web app pauses new prefetches; returning after three minutes
clears private cached data and restarts at Home. Transaction changes, starting
net worth changes, logout, account deletion, and session expiration use
targeted invalidation or full authenticated-cache removal as appropriate.
The three-minute threshold controls financial-data freshness only; it does not
show the branded startup screen. That screen is reserved for full document
loads and web-process reconstruction, whose timing is controlled by iOS rather
than by an application timeout.

The shared `components/charts/EChart.tsx` adapter initializes one modular
ECharts instance, uses the SVG renderer, responds to container resizing, and
disposes the instance with the React lifecycle. Charts consumes one
authenticated `GET /statistics/charts` response. Shared financial intervals
feed the combined Cash Flow chart, while one category-by-interval aggregation
feeds both Category Breakdown and Category Timeline.

`Net Worth Evolution` renders real owner-scoped points once starting net worth
has been configured. Month and Year use daily closing values to preserve
within-month movement; All uses month-end points to keep long histories
bounded. Pending setup reports `OPENING_BALANCE_REQUIRED`; Skip stores a zero
baseline and therefore produces a valid line from recorded transaction flow.

`Cash Flow` combines the former Period Balance and Income vs Expenses charts
and is shown in Year and All, while Month intentionally omits it. Every month or
year occupies one vertical column position: income rises above zero, expenses
fall below it, and the signed balance is drawn in amber over the corresponding
side. All three layers share the same width and horizontal position.

Three independent icon controls in the header toggle Income, Expenses, and
Balance. All begin enabled, at least one must remain visible, and each layer
animates between its value and zero. Pressing any visible part selects the whole
interval; the shared tooltip includes only enabled metrics. Pressing it again,
changing a visible metric, or pressing outside clears the selection.

`Category Breakdown` and `Category Timeline` share the same category totals.
Categories below one percent are grouped into Other when necessary. Breakdown
uses the compact percentage matrix; Timeline shows how each category is
distributed over weeks, months, or years. `Weekday Spending` uses seven
server-provided weekday aggregates and appears when the selected period has
enough expense transactions.

The deterministic statistics fixture files remain in the repository as visual
development references, but production components do not import or bundle
them.

### 13. Account

Purpose: user profile and session controls.

MVP content:

- Name, account creation date, and starting net worth.
- Email.
- Provider-specific account actions.
- Name and starting-net-worth editing through a focused modal; email remains
  read-only account data.
- Password changes through a three-field modal for password accounts.
- Password-only accounts can open a confirmation modal and add Google as a
  second sign-in method. Google requires explicit account selection; success,
  email mismatch, cancellation, and failure return directly to Profile with
  focused feedback. The mismatch dialog identifies the required session email
  and offers a retry.
- Accounts without verified email/password sign-in show `Link email` with the
  shared Mail icon. It opens a full-screen stack from the right. Username-only
  accounts enter an address; Google-only accounts confirm Google's address and
  create a password; username-and-Google accounts confirm the address and skip
  password creation. Every path reuses the six-cell verification screen and
  finishes with the complete list of available sign-in methods.
- Accounts with another sign-in method can unlink email through two focused
  dialogs. The first describes the exact remaining methods; Continue sends the
  code. The second accepts the six-digit code, supports resend after 60 seconds,
  and keeps the destructive controls and active code cell red.
- Back removes only the current linking step with the reverse transition. The
  final confirmation has no Back action and returns to Profile through `Done`.
- Confirmed logout.
- Irreversible account deletion confirmed by password or fresh Google account selection. Hybrid accounts choose either method in a compact, click-only selector; Google is selected by default.

Google deletion returns to the profile with a warning dialog when the selected account does not match the active session. The dialog identifies the required session email without exposing it in the OAuth redirect URL.

The edit-profile modal pre-fills the current name and starting net worth so
either value can be edited in place, independently or together. Name uses
the shared 1-to-100-character rule, while starting net worth reuses the signed
eight-integer-digit, two-decimal, and `-10M` to `10M` validation from onboarding.
Only changed fields are sent. The profile replaces its session user with the
`PATCH /account` response and invalidates financial caches when the baseline
changes.

The change-password modal requires the current password and two copies of the new password. It enables submission once all three fields contain a value, then validates the registration password policy and matching new-password fields locally before calling `PATCH /account/password`. A successful request replaces the form with confirmation content in the same dialog; API and rate-limit errors remain visible alongside the form.

Logout keeps the confirmation dialog visible while the request is pending. Only after the API confirms that the session has ended does the private screen slide to the right, revealing the public access screen underneath. Failed and cancelled attempts do not trigger the transition.

### 14. Admin

Purpose: operational review tools.

MVP content:

- Users list.

Admin UI should feel functional and denser than the consumer finance screens.

## API Integration Notes

- All private API requests rely on the secure session cookie.
- Browser requests must include credentials.
- Mutating requests must come from an allowed origin.
- Handle `401` by sending the user to login.
- Handle `403` with a permissions message.
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

## Frontend Delivery Status

The Vite/React shell, theme, authentication, verified password registration,
email and recovery-code password reset, onboarding, Home, transaction creation
and management, Statistics, and Profile flows are implemented. Administrative
screens remain outside the current mobile MVP frontend.

Each completed screen includes its relevant loading, error, empty, and API
states rather than relying on static preview data.
