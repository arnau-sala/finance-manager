# Roadmap

## Phase 1: Backend Base

- Create the backend TypeScript app.
- Add a `GET /health` endpoint.
- Confirm the server can run locally.

## Phase 2: Database and Prisma

- Add Prisma.
- Configure PostgreSQL through `DATABASE_URL`.
- Create the initial authentication and access-control schema.
- Add the first migration.
- Add a shared database client module.

## Phases 3-4: Access Review (Retired)

- The original MVP used public access requests, an administrative approval
  queue, and a permanent review event log.
- This flow was removed when registration became open with email ownership
  verification. Its routes and active models no longer exist.

## Phase 5A: Registration

- Add `POST /auth/register`.
- Require and persist the user's name.
- Hash passwords with Argon2id.
- Deliver a six-digit ownership code through Brevo.
- Keep unverified data in `PendingRegistration` with expiry, resend cooldown,
  and attempt limits.
- Add `POST /auth/register/resend` and `POST /auth/register/verify`.
- Atomically consume the verified pending registration and create the user as
  `USER` and `APPROVED`.
- Start a secure session immediately after successful verification.

## Phase 5B: Login Verification

- Add `POST /auth/login`.
- Verify Argon2id credentials.
- Return the same error for unknown emails, incorrect passwords, and suspended users.
- Create a secure cookie session after login.
- Add `POST /auth/logout` and require an active session.

## Phase 5C: Account Deletion

- Add authenticated `DELETE /account` without a client-provided user ID.
- Require the current password for password accounts.
- Delete all account-owned data atomically and invalidate the session.
- Require fresh Google reauthentication and an exact email/Google-subject match for Google accounts.

## Phase 5D: Password Changes

- Add authenticated `PATCH /account/password` for `PASSWORD` accounts.
- Require the current password and two matching new-password values.
- Reuse the registration password policy and Argon2id hashing.
- Rotate the current cookie and invalidate other sessions through `sessionVersion`.

## Phase 6A: Basic Transaction Creation

- Add the `Transaction` model and `TransactionType` enum.
- Store monetary values as integer cents.
- Add authenticated `POST /transactions`.
- Validate type, amount, description, and optional date-only occurrence day.
- Assign ownership from the secure session.

## Phase 6B: Transaction Deletion

- Add authenticated `DELETE /transactions/:id`.
- Restrict deletion to the transaction owner derived from the session.
- Return the same not-found response for missing and foreign-owned transactions.

## Phase 6C: Transaction Editing

- Add authenticated `PATCH /transactions/:id`.
- Update only supplied fields while preserving creation validation rules.
- Accept empty edits without changing stored data.
- Apply the same owner-only and indistinguishable not-found behavior as deletion.

## Phase 6D: Predefined Categories

- Add the global `Category` model and predefined English catalog.
- Add authenticated `GET /categories` with an optional transaction-type filter.
- Require a compatible category when creating or editing transactions.
- Backfill existing transactions with the corresponding fallback category.

## Remaining Phase 6 Work

- Add user-created category management in a later version.

## Phase 7A: Administrative User Listing

- Add authenticated `GET /admin/users`.
- Add authenticated `GET /admin/users/:id` with CUID validation.
- Restrict the endpoint to users with role `ADMIN`.
- Return only ID, email, role, status, and creation timestamp.

## Phase 7B: Current User Profile

- Add authenticated `GET /auth/me`.
- Add owner-only `PATCH /account` for partial name and starting-net-worth
  updates.
- Resolve the user exclusively from the secure session.
- Reuse the public fields exposed by administrative user reads and include `updatedAt`.

## Phase 7C: Current User Transactions

- Add authenticated `GET /transactions`.
- Add authenticated `GET /transactions/categories/:category`.
- Add owner-only `GET /transactions/:id`.
- Return only records owned by the current session user.
- Apply the same ownership rule to administrators.
- Order results by transaction date, newest first.

## Phase 8A: Basic Balance Statistics

- Add authenticated `GET /statistics/balance`.
- Sum only transactions owned by the current session user.
- Return total income, total spent, and total balance.
- Keep administrators limited to their own financial data.

## Phase 8B: Monthly Balance Statistics

- Add authenticated `GET /statistics/balance/:month/:year`.
- Add authenticated `GET /statistics/balance/:month`, defaulting to the current year.
- Validate numeric month and year route parameters.
- Return zero totals when the selected month has no transactions.

## Phase 8C: Yearly Balance Statistics

- Add authenticated `GET /statistics/balance/year/:year`.
- Add authenticated `GET /statistics/balance/year`, defaulting to the current year.
- Reuse the shared user-balance aggregation service.
- Return zero totals when the selected year has no transactions.

## Phase 8D: Category Percentage Statistics

- Add authenticated `GET /statistics/categories`.
- Add authenticated `GET /statistics/categories/type/:type`.
- Calculate category percentages independently within each transaction type.
- Return integer percentages that sum to exactly 100 per returned type.
- Exclude categories without transactions.

## Phase 8E: Period Category Percentage Statistics

- Add authenticated `GET /statistics/categories/:month/:year`.
- Add authenticated `GET /statistics/categories/:month`, defaulting to the current year.
- Add authenticated `GET /statistics/categories/year/:year`.
- Add authenticated `GET /statistics/categories/year`, defaulting to the current year.
- Apply the same exact integer percentage logic to period-filtered category totals.

## Phase 8F: Typed Period Category Percentage Statistics

- Add authenticated `GET /statistics/categories/type/:type/:month/:year`.
- Add authenticated `GET /statistics/categories/type/:type/:month`, defaulting to the current year.
- Add authenticated `GET /statistics/categories/type/:type/year/:year`.
- Add authenticated `GET /statistics/categories/type/:type/year`, defaulting to the current year.
- Restrict `:type` to `income` or `expense`.
- Combine transaction type and period filters in the same category-percentage query.

## Phase 10: Statistics Experience

- Add authenticated `GET /statistics/overview` for the complete numeric view.
- Add authenticated `GET /statistics/charts` for bounded chart-ready series.
- Support Month, Year, and All with one shared period contract.
- Load Overview immediately and Charts lazily.
- Cache successful responses briefly in owner-scoped memory and invalidate them
  after financial writes or session termination.
- Derive all displayed values from PostgreSQL transactions without sending raw
  transaction history to the browser.
- Store starting net worth as one timeless, editable profile value in integer
  cents.
- Gate the first authenticated app entry behind a save-or-skip setup step.
- Derive current net worth and Net Worth Evolution without treating the
  starting amount as income.
