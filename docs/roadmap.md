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

- Make access-request fields mandatory.
- Separate the pending queue from the permanent structured event log.
- Add pending-request list and detail endpoints.
- Add event list and detail endpoints for local administrative review.
- Allow a pending request to be approved through the local administrative endpoint.
- Allow a pending request to be denied with a mandatory reason.
- Keep the public result independent from the internal database decision.

## Remaining Phase 4 Work

- Authenticate administrative requests.
- Require the `ADMIN` role on every `/admin/*` endpoint.

## Phase 5A: Registration

- Add `POST /auth/register`.
- Require an unused approved email.
- Hash passwords with Argon2id.
- Create users as `USER` and `APPROVED`.
- Mark the approved email as used atomically.

## Phase 5B: Login Verification

- Add `POST /auth/login`.
- Verify Argon2id credentials.
- Return the same error for unknown emails, incorrect passwords, and suspended users.
- Create a secure cookie session after login.
- Add `POST /auth/logout` and require an active session.

## Remaining Phase 5 Work

- Add `GET /auth/me`.

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
- Add transaction listing in later API work.

## Phase 7A: Administrative Account Listing

- Add authenticated `GET /accounts`.
- Restrict the endpoint to users with role `ADMIN`.
- Return only ID, email, role, status, and creation timestamp.
