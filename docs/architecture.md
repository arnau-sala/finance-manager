# Architecture

## Current Backend

The repository is a small monorepo with a Fastify API and a Vite/React web app.
The API owns authentication, email verification, authorization, persistence,
and financial calculations.

Current request flow:

```text
HTTP client -> Fastify API -> route handler -> Prisma Client -> PostgreSQL
```

The database layer is now represented by Prisma.

Current backend structure:

```text
apps/api
  prisma
    migrations
    schema.prisma
  src
    db
      client.ts
    auth
      authenticated-user.ts
      password.ts
      registration.ts
      session.ts
    email
      brevo.ts
      registration-verification.ts
    routes
      admin-users.ts
      auth-google.ts
      auth.ts
      categories.ts
      auth-me.ts
      home.ts
      statistics.ts
      transactions.ts
    money
      cents.ts
    app.ts
    server.ts
```

`src/db/client.ts` exports one shared Prisma client for backend code. Future route modules should import that client instead of constructing their own `PrismaClient` instances.

Prisma dependencies and database scripts live in the root package so the generated client and migration commands are managed once for the monorepo.

The active database models cover authentication and financial records:

- `User`
- `PendingRegistration`
- `AccountRecoveryCode`
- `PendingEmailLink`
- `Category`
- `Transaction`

Password registration is split into code issuance and code verification:

```text
POST /auth/register
  -> validate and normalize input
  -> reject internally if the user exists or resend cooldown is active
  -> hash password and verification code
  -> save PendingRegistration
  -> send the code through Brevo

POST /auth/register/verify
  -> validate the email and six-digit code
  -> compare the HMAC hashes in constant time
  -> atomically consume PendingRegistration and create User
  -> start the secure session
```

`routes/auth.ts` owns the HTTP contracts, while `auth/registration.ts` owns the
registration state machine. Password hashing remains isolated in
`auth/password.ts` so registration, login, password changes, and account
deletion share the same Argon2id implementation.

`PendingRegistration` has one row per normalized email. It stores the required
name, Argon2id password hash, HMAC-SHA256 verification-code hash, failed-attempt
count, expiry, and last-send timestamp. The plaintext password and code are
never stored. Codes expire after 10 minutes, sending has a 60-second persistent
cooldown, verification permits five failed attempts, and stale rows are removed
opportunistically after 24 hours.

The Brevo adapter lives in `email/brevo.ts` and uses the provider's
transactional-email HTTP API with an eight-second timeout. Network delivery is
intentionally outside the database transaction. If Brevo rejects or cannot
complete the request, the service restores the previous pending row or removes
the newly created one, avoiding a valid-looking registration with no delivered
code. The API key and sender identity exist only in backend environment
variables.

Code issuance returns one neutral `202` body for existing users, cooldowns, and
new registrations. Verification atomically claims the pending row before
creating the user, so concurrent submissions cannot consume the same code
twice. Successful verification records `emailVerifiedAt` and immediately starts
the user's encrypted session.

Username registration is a separate synchronous path. It validates and claims
the normalized username before hashing the password, creates a `User` with no
email, and creates its `AccountRecoveryCode` in the same transaction. The
plaintext 128-bit code is returned once; only its SHA-256 hash is persisted.
Recovery atomically consumes that row, changes the password, increments
`sessionVersion`, and inserts a newly generated replacement code.

The public registration UI first calls the indexed, rate-limited
`GET /auth/usernames/:username/availability` lookup on field blur. This is only
an advisory UX check; `POST /auth/register/username` remains the authoritative
claim and handles concurrent attempts through the database unique constraint.

Login accepts one `identifier`, resolves it as an email or username, and reuses
the password module to verify Argon2id hashes. Unknown identifiers are checked
against a precomputed dummy hash so the endpoint follows the same expensive
verification path without exposing whether an account exists.

Google sign-in lives in `routes/auth-google.ts`. The route starts a server-side
OAuth 2.0 / OpenID Connect flow, validates callback `state`, verifies the Google
ID token, and requires a verified email. A new Google identity creates its
`GOOGLE` user directly because the identity provider has already verified the
address. Existing Google-capable users require the stable Google subject to
match. A password-only email collision never links implicitly; the owner must
authenticate normally and use the separate account-linking flow.

`auth/session.ts` configures an encrypted stateless cookie session through `@fastify/secure-session`. Login stores `userId` and the current `sessionVersion`; authenticated user resolution requires both to match PostgreSQL. Sessions last up to seven days, and logout deletes the current cookie.

`auth/authenticated-user.ts` resolves the session user and verifies that the account still exists and remains approved. Transaction routes use this server-derived ID; clients cannot select the owner of financial data.

`routes/admin-users.ts` exposes administrative user list and detail endpoints. A plugin-scoped hook resolves the current user from the session and checks the `ADMIN` role for every user-management route. Both queries share an explicit Prisma selection so password hashes and unrelated fields cannot enter responses.

`routes/auth-me.ts` returns the public profile selected by the current secure session. It includes the required name, authentication provider, and `updatedAt` in addition to the fields shared with administrative user reads. The frontend uses the provider to offer Google linking only to password accounts.

`routes/account.ts` owns owner-only profile updates, password changes, recovery
code rotation, and password-confirmed deletion. `routes/account-email.ts` and
`account/email-link.ts` own the authenticated six-digit verification flow that
adds an email to the existing username user. `routes/auth-google.ts` owns public
Google sign-in plus authenticated account linking and Google-capable deletion
reauthentication. A username account may link its first verified Google email;
an account that already has an email must select that exact address. Both paths
preserve the password credential and operate on the same `User` row.

Phase 6 currently supports transaction creation, partial editing, deletion, and a global predefined category catalog. `GET /categories` exposes stable category IDs, while transaction routes validate that referenced categories exist and match the transaction type. `Transaction` now has Prisma relations to `User` and `Category`; scalar `userId` remains internal for ownership filters, while `categoryId` is still returned because the client needs it for category-based views. The financial day is stored as `occurredOn` using PostgreSQL `DATE`; the public API exposes it as `date: "YYYY-MM-DD"`, while `createdAt` remains the exact technical timestamp.

Transaction reads and mutations derive `userId` exclusively from the secure session. Listing, category-filtered listing, and detail retrieval therefore return only the caller's transactions, with no administrative bypass. ID-based operations combine the transaction ID with that `userId`, so a missing transaction and a transaction owned by another user are indistinguishable to the caller. Empty edits verify ownership and succeed without writing. Financial account containers remain deferred.

`services/transaction-service.ts` owns the transaction response serializer and
the detail aggregate. `GET /transactions/:id` uses one owner-scoped PostgreSQL
statement to return the movement, its tracked balance before and after, and
Month/Year/All category rank, type rank, and period impact. Same-day ordering
uses `occurredOn`, `createdAt`, and `id`, while equal-amount rankings use those
fields as deterministic tie-breakers. Derived values are intentionally not
stored because backdated edits and deletions would invalidate later balances
and ranks.

The frontend uses one owner-keyed TanStack Query cache for Home, transaction
pages, transaction details, Statistics Overview, Statistics Charts, and period
availability. Successful data remains fresh for five minutes and is rendered
immediately while stale entries revalidate in the background. Inactive
financial queries can remain in memory for up to 30 minutes; detail entries use
a shorter 10-minute retention window. No private response is persisted to
browser storage.

Moves requests filtered pages of 20 from PostgreSQL instead of downloading the
complete history. Search, type, category, amount, and date filters are applied
before pagination. The first page includes the matching total plus compact
account metadata; later pages avoid repeating the metadata query. Financial
writes retain at most the first cached list page before revalidation, preventing
an infinite query with a long scroll history from refetching dozens of pages.

A foreground-aware scheduler performs at most one speculative request at a
time and starts it only during browser idle time. Navigation, filter changes,
infinite scroll, ticket opening, and financial writes interrupt the active
prefetch and pause the queue, so user-requested work receives network priority.
Queued ticket prefetches are discarded when the Moves query changes.

Transaction sharing is a frontend-only capability. The detail sheet formats
the already loaded transaction and invokes Web Share synchronously from the
Share control, preserving the browser's required user activation. It does not
create a public URL or call a sharing endpoint. A clipboard fallback keeps the
feature usable when the native interface is unavailable.

`routes/statistics.ts` owns the first read-only statistics endpoints. `GET /statistics/balance` groups all of the current user's transactions by type and returns total income, total spent, and income-minus-expense balance. `GET /statistics/balance/:month/:year` and `GET /statistics/balance/:month` apply the same calculation to a calendar month, with the short form defaulting to the current year. `GET /statistics/balance/year/:year` and `GET /statistics/balance/year` apply it to a full calendar year. They use the same session-derived ownership rule as transaction reads, so administrators do not receive cross-user financial totals.

`GET /statistics/categories` and `GET /statistics/categories/type/:type` aggregate the caller's transactions by category with a single database join between `Transaction` and `Category`. Monthly and yearly category-statistics endpoints reuse the same query with date-only calendar boundaries, avoiding timezone-dependent period changes. Typed period routes such as `GET /statistics/categories/type/expense/6/2026`, `GET /statistics/categories/type/expense/6`, `GET /statistics/categories/type/income/year/2026`, and `GET /statistics/categories/type/income/year` combine the transaction-type and period filters. Routes without an explicit year default to the server's current year. Percentages are calculated separately for `EXPENSE` and `INCOME`, categories without transactions are omitted, and integer percentages are adjusted to total exactly 100 within each returned type.

`GET /statistics/months` performs one owner-scoped database aggregation over `occurredOn` and returns only distinct `YYYY-MM` values through the current day. The Stats month picker uses this compact result to derive its oldest selectable month and disable empty or future months without downloading the user's transaction history. The year picker derives its distinct years and disabled gaps from the same response, avoiding a second database query.

`GET /statistics/overview` and `GET /statistics/charts` are view-oriented
aggregate endpoints. Both accept `period=month`, `period=year`, or `period=all`
with an optional explicit month/year and default to the current month. A shared
period parser rejects future periods and uses inclusive calendar dates with an
exclusive SQL upper bound. All mode starts at the caller's earliest
non-future transaction and ends today.

Overview executes monthly totals, category totals, largest movements, and
expense-distribution reads in parallel. PostgreSQL calculates the median
expense, while the API derives balances, exact category percentages, interval
summaries, averages, and no-spend streaks in integer cents. Empty calendar
intervals are filled with zero values so chart continuity and positive-period
denominators remain deterministic.

The largest income and expense records retain their transaction IDs and compact
previews in the Overview response. Selecting either insight opens the shared
transaction sheet, which then uses the owner-scoped transaction detail endpoint
for balances, rankings, and period impact without downloading the full history.

The current no-spend streak is calculated only when the requested period ends
today: the current month, current year, or All. Historical month/year responses
set `currentStreak` to `null`; their longest streak remains available because it
describes a global record rather than the selected closed period. The current
streak is also global: current Month, Year, and All responses derive it from the
same latest expense through today. `lastExpenseDate` identifies the expense
immediately before that streak.

Both streaks are intentionally independent of the selected period. A compact
SQL gap query calculates their global boundaries from the caller's first
non-future expense through today, so Month, Year, and All return the same
historical state without loading the user's transaction history into the API.
Income does not start expense-streak tracking. Overview exposes
`hasExpenseHistory`; when it is false, both streaks are empty and the frontend
omits the complete Expenses section.

Charts executes three bounded aggregations in parallel: financial intervals,
category-by-interval totals, and weekday expense totals. The financial series
feeds the combined Cash Flow visualization, including income, expenses, and
their balance without another query. Category totals are derived from the
category timeline query and shared by Category Breakdown and Category Timeline.
Month returns weekly category buckets, Year monthly buckets, and All yearly
buckets; Weekday Spending always returns seven values. No transaction rows or
`userId` values cross the API boundary.

`services/statistics-service.ts` retains the focused balance/category queries.
`services/statistics-report-service.ts` owns the view aggregates, and
`services/statistics-period.ts` owns their calendar contract. The existing
`(userId, occurredOn)` transaction index supports every period scan; additional
rollup tables and indexes remain deferred until measured data volumes justify
their synchronization cost.

Frontend charts use Apache ECharts through the tree-shakeable `echarts/core`
entry and a local React lifecycle adapter in `components/charts`. The SVG
renderer and only the currently required chart modules are registered. The
complete Charts view is a lazy-loaded frontend chunk, keeping the chart engine
out of the initial authenticated application bundle. Entering Stats schedules
that chunk and selected-period chart data in the idle queue. Current-year,
previous-month, and All reports are then prefetched in descending likelihood,
with All Charts last because it is the heaviest speculative read. Navigating
through arbitrary periods does not recursively prefetch their charts.

Financial writes invalidate Home, transaction, detail, and Statistics query
families by key. Logout, account deletion, and session expiration clear the
complete authenticated cache. When the installed web app is hidden, new
prefetches pause. Returning within three minutes resumes the existing cache;
after three minutes the cache and queue are discarded and authenticated Home
starts from a clean read. Browser HTTP caching remains disabled for private
financial responses.

Starting net worth is stored on `User` only as nullable signed integer cents. A
null value means the initial setup is pending; saving or skipping replaces it
with a number, with Skip storing `0`. The value is timeless and editable:
`services/net-worth-service.ts` adds the same baseline to accumulated
transaction flow without filtering by an effective date. Month and Year return
daily closing points; All returns month-end points. Period cash-flow statistics
remain independent and are never inflated with the starting amount.

`routes/home.ts` provides the authenticated Home overview through one browser request. It derives the owner from the secure session and runs the all-time cash-flow balance, current net worth, three-newest-transactions, and current-month activity reads in parallel. The monthly activity reuses the statistics service to return the transaction count and highest-value expense and income categories without exposing `userId`.

`money/cents.ts` centralizes integer-cent formatting for API responses that expose money as decimal strings.
