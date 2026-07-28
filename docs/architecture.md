# Architecture

## Phase 4 Foundation

The repository starts as a small monorepo with a single implemented app:

```text
apps/api
```

The API owns all backend behavior. The frontend and shared packages can be added later when they are useful.

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
      session.ts
    routes
      admin-users.ts
      admin-access-requests.ts
      access-requests.ts
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

The database models cover authentication, access-control foundations, and basic financial records:

- `User`
- `AccessRequest`
- `AccessRequestEvent`
- `ApprovedEmail`
- `Category`
- `Transaction`

Accounts remain deferred until their first behavior is implemented.

Public access requests are handled by a focused Fastify route module. The route validates and normalizes input before querying Prisma, while `app.ts` remains responsible only for assembling the API.

The public flow makes one internal database decision:

```text
valid input -> registered email -> discarded event
            -> existing/approved request -> discarded event
            -> new email -> pending access request + created event
```

Every branch performs its database write on the server and produces the same public `202` response. There is no internal HTTP request for a browser to observe.

`AccessRequest` represents current state, while `AccessRequestEvent` preserves the history of valid access-related activity. Approval and denial both append administrative events to this history.

Administrative decisions are atomic. Approval records the approved email and event before completing the transaction; denial records its mandatory reason and event. Both remove the pending request in the same transaction.

`AccessRequestEvent.accessRequestId` is an immutable historical reference rather than a foreign-key relation. Creation, approval, and denial events require it, allowing administrative decisions to retain the original request ID after the pending row is deleted. Automatic system discards always leave it null.

Administrative access-request routes and user-management routes share `auth/require-administrator.ts`. Each administrative module registers it as a plugin-scoped `preHandler`, so every route verifies an active approved user and the `ADMIN` role before executing its handler.

Registration lives in `routes/auth.ts`, requires the user's name, and keeps password hashing isolated in `auth/password.ts` so login can reuse the same Argon2id implementation. Creating the user and consuming the approved email happen atomically in one Prisma transaction.

Login reuses the password module to verify Argon2id hashes. Unknown emails are checked against a precomputed dummy hash so the endpoint follows the same expensive verification path without exposing whether a user exists.

Google sign-in lives in `routes/auth-google.ts`. The route starts a server-side OAuth 2.0 / OpenID Connect flow, validates the callback `state`, verifies the Google ID token, and then either starts a session for an existing Google user, creates a Google user with its verified profile name from an unused approved email, or stores the verified email/name in the encrypted session so the frontend can open a prefilled Google access-request form.

`POST /access-requests/google` lives beside the normal access-request endpoint. It accepts only the optional user message, reads the verified Google email/name from the session, appends the internal Google source marker to the stored message, and then reuses the same pending-request/event-log persistence path.

`auth/session.ts` configures an encrypted stateless cookie session through `@fastify/secure-session`. Login stores `userId` and the current `sessionVersion`; authenticated user resolution requires both to match PostgreSQL. Sessions last up to seven days, and logout deletes the current cookie.

`auth/authenticated-user.ts` resolves the session user and verifies that the account still exists and remains approved. Transaction routes use this server-derived ID; clients cannot select the owner of financial data.

`routes/admin-users.ts` exposes administrative user list and detail endpoints. A plugin-scoped hook resolves the current user from the session and checks the `ADMIN` role for every user-management route. Both queries share an explicit Prisma selection so password hashes and unrelated fields cannot enter responses.

`routes/auth-me.ts` returns the public profile selected by the current secure session. It includes the required name, authentication provider, and `updatedAt` in addition to the fields shared with administrative user reads. The frontend uses the provider to offer Google linking only to password accounts.

`routes/account.ts` owns owner-only profile updates through `PATCH /account`, password changes through `PATCH /account/password`, and password-confirmed self-service deletion through `DELETE /account`. Password changes verify the current Argon2id hash before hashing the new value, increment `sessionVersion`, and regenerate the current cookie; other cookies then fail version validation. Google accounts start a separate deletion reauthentication flow through `POST /account/google/delete/start`; the existing Google callback validates a one-time deletion-specific OAuth `state` and requires the verified Google email and stable `sub` to match the active session user. Both deletion paths call `account/delete-account.ts`, which performs the same database cleanup atomically and never accepts a client-provided user ID.

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

The Moves client stores a completed paginated history and transaction-detail
responses in the shared expiring memory-cache utility for 30 seconds, keyed by
authenticated `userId`. Empty histories are cached as valid results. Successful
financial writes invalidate both transaction caches through their frontend
integration. Creation and editing also invalidate the Statistics caches and
increment the shared financial refresh key so Home, Moves, and Stats request
fresh derived data. Editing increments a detail refresh key after the successful
`PATCH`, causing its owner-scoped balance and rankings to be recalculated before
the editor reveals the underlying detail sheet. Session termination clears
caches before another user can authenticate.

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

The current no-spend streak is calculated only when the requested period ends
today: the current month, current year, or All. Historical month/year responses
set `currentStreak` to `null`; their longest streak remains available because it
describes the selected closed period.

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
out of the initial authenticated application bundle. Overview data is requested
only while Overview is active; chart data is requested only while Charts is
active. Successful report responses use a 30-second in-memory cache by user and
period, while period availability uses 60 seconds. Financial writes invalidate
all three caches, and session termination clears them. Browser HTTP caching
stays disabled for private financial responses. The former deterministic mock
fixtures remain temporarily in the repository for comparison, but no active
Statistics component imports or bundles them.

Net Worth Evolution intentionally reports that an opening balance is required.
Tracked income minus expenses is not presented as net worth. A later financial
profile or auditable balance-adjustment model must store that missing source
fact before the chart can expose real points.

`routes/home.ts` provides the authenticated Home overview through one browser request. It derives the owner from the secure session and runs the all-time balance, three-newest-transactions, and current-month activity reads in parallel. The monthly activity reuses the statistics service to return the transaction count and highest-value expense and income categories without exposing `userId`.

`money/cents.ts` centralizes integer-cent formatting for API responses that expose money as decimal strings.
