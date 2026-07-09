# Security

## Phase 4 Foundation

The project now persists public access requests and exposes local administrative read endpoints.

Security decisions already in place:

- The backend is the only place where future sensitive logic should run.
- `CONTEXT.md` and `apps/api/.env` are ignored by Git.
- Real credentials, production database URLs, and secrets must not be committed.
- Financial data must not be added to the repository.
- User emails are unique in the `User` and `ApprovedEmail` tables.

The current schema does not allow financial records yet. When financial models are added, every private financial table must include an owner field such as `userId`.

The public access-request endpoint:

- Validates the entire request body and rejects unknown fields.
- Normalizes email addresses by trimming whitespace and converting them to lowercase.
- Limits names to 100 characters and messages to 1000 characters.
- Requires non-empty email, name, and message fields.
- Returns the same status and body for every syntactically valid submission.
- Uses a database constraint to prevent duplicate pending requests during concurrent calls.
- Stores every valid access-request outcome in a structured server-side event log without exposing the event or discard reason publicly.

A sender can always inspect their own HTTP request and submitted fields in browser developer tools. What remains private is the server-side decision and database destination: no second HTTP request is made, and the response does not identify whether the email is registered, approved, pending, or new.

Every `/admin/*` route uses the shared `requireAdministrator` pre-handler. Missing or invalid sessions receive `401`, while authenticated non-administrators receive `403`. The event log has a nullable `adminId`, which must be populated from the verified session rather than client input. Denial reasons are administrative data and are not exposed through public responses.

Registration security decisions:

- Email addresses are trimmed, lowercased, and validated.
- Registration requires matching `password` and `passwordConfirmation` fields.
- Passwords must contain between 9 and 128 characters, with at least one uppercase letter, one digit, and one special character.
- Passwords are hashed with Argon2id and are never returned by the API.
- User creation and approval consumption share one transaction.
- Non-approved, used, and registered emails return the same public error.
- Successful responses expose only the user ID, email, role, status, and creation timestamp.

Login security decisions:

- Unknown emails, incorrect passwords, and suspended users return the same `401` response.
- Unknown emails still run an Argon2id verification against a dummy hash to reduce timing differences.
- Password hashes and user details are never returned by login.
- Successful login regenerates the session and stores only the user ID.
- Session cookies are encrypted, `HttpOnly`, `SameSite=Lax`, and limited to seven days.
- Cookie `Secure` is disabled for local HTTP development and enabled when `NODE_ENV=production`.
- Logout requires an active session and deletes its cookie.

Administrative user listing security decisions:

- `GET /admin/users` and `GET /admin/users/:id` require an active session for an `APPROVED` administrator.
- Authenticated non-administrators receive `403 Forbidden`.
- User detail IDs must be valid CUIDs before reaching the database.
- The database query selects only ID, email, role, status, and creation timestamp.
- Password hashes and update timestamps are never loaded into the endpoint response.

`GET /auth/me` requires an active approved-user session and returns the shared public user fields plus `updatedAt`. The user ID is always derived from the encrypted session cookie rather than request input.

Transaction security decisions:

- An active session and an existing `APPROVED` user are required.
- `userId` is read from the encrypted session and is never accepted from the request body.
- Transaction listing always filters by the session `userId`; the `ADMIN` role has no bypass.
- Transaction detail retrieval filters by both ID and session `userId`.
- Missing and foreign-owned transaction details return the same `404` response.
- Description, amount, type, category, and date are validated before persistence.
- Categories must exist and match the transaction type on creation and editing.
- Category references are validated by the API before transaction writes.
- PostgreSQL foreign keys reject transactions that reference missing users or categories.
- Amounts are positive integer cents in PostgreSQL, avoiding floating-point money errors.
- PostgreSQL also rejects non-positive amounts and blank descriptions.
- Deletion filters by transaction ID and authenticated `userId` in one database operation.
- Partial editing applies the same ownership filter and validates every supplied field.
- Empty edits verify ownership and succeed without changing stored data.
- Missing and foreign-owned transaction IDs return the same `404` response, preventing ownership disclosure.
- Statistics endpoints must filter transactions by the authenticated `userId`.
- `GET /statistics/balance` returns only the caller's own totals, including for administrators.
- `GET /statistics/balance/:month/:year` and `GET /statistics/balance/:month` apply the same owner-only rule to monthly totals.
- `GET /statistics/balance/year/:year` and `GET /statistics/balance/year` apply the same owner-only rule to yearly totals.
- `GET /statistics/categories` and `GET /statistics/categories/type/:type` aggregate only the caller's own transactions.
- Period-filtered category statistics apply the same owner-only rule and never accept `userId` from the request.
- Typed period category statistics only accept `income` or `expense` as the type segment.
- Future reads and mutations must always filter transactions by the authenticated `userId`.
