# Roadmap

## Phase 1: Backend Base

- Create the backend TypeScript app.
- Add a `GET /health` endpoint.
- Confirm the server can run locally.

## Phase 2: Database and Prisma

- Add Prisma.
- Configure PostgreSQL through `DATABASE_URL`.
- Create the initial schema for `User`, `AccessRequest`, and `ApprovedEmail`.
- Add the first migration.
- Add a shared database client module.

## Phase 3: Public Access Requests

- Add `POST /access-requests`.
- Validate and normalize public input.
- Avoid duplicate pending requests.
- Keep responses neutral to avoid exposing account or approval state.

## Phase 4: Administrative Review Foundation

- Require access-request email and name while keeping the administrator message optional.
- Separate the pending queue from the permanent structured event log.
- Add pending-request list and detail endpoints.
- Add event list and detail endpoints for local administrative review.
- Allow a pending request to be approved through the local administrative endpoint.
- Allow a pending request to be denied with a mandatory reason.
- Keep the public result independent from the internal database decision.

## Phase 5A: Registration

- Add `POST /auth/register`.
- Require an unused approved email.
- Require and persist the user's name.
- Hash passwords with Argon2id.
- Create users as `USER` and `APPROVED`.
- Mark the approved email as used atomically.

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

## Phase 6A: Basic Transaction Creation

- Add the `Transaction` model and `TransactionType` enum.
- Store monetary values as integer cents.
- Add authenticated `POST /transactions`.
- Validate type, amount, description, and optional occurrence date.
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
