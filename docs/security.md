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

The `/admin/*` routes do not yet authenticate sessions and must only be used during local development. The event log has a nullable `adminId`, but it must be populated from a verified session rather than a client-supplied value. Denial reasons are administrative data and must not be exposed through public responses. These routes must gain session-based authentication and role authorization before deployment.

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

Authenticated user lookup through `GET /auth/me` remains pending.

Account listing security decisions:

- `GET /accounts` and `GET /accounts/:id` require an active session and an `APPROVED` account.
- Authenticated non-administrators receive `403 Forbidden`.
- Account detail IDs must be valid CUIDs before reaching the database.
- The database query selects only ID, email, role, status, and creation timestamp.
- Password hashes and update timestamps are never loaded into the endpoint response.

`GET /myaccount` requires an active approved-user session and returns the shared public account fields plus `updatedAt`. The account ID is always derived from the encrypted session cookie rather than request input.

Transaction security decisions:

- An active session and an existing `APPROVED` user are required.
- `userId` is read from the encrypted session and is never accepted from the request body.
- Description, amount, type, category, and date are validated before persistence.
- Categories must exist and match the transaction type on creation and editing.
- Category references are validated by the API before transaction writes.
- Amounts are positive integer cents in PostgreSQL, avoiding floating-point money errors.
- PostgreSQL also rejects non-positive amounts and blank descriptions.
- Deletion filters by transaction ID and authenticated `userId` in one database operation.
- Partial editing applies the same ownership filter and validates every supplied field.
- Empty edits verify ownership and succeed without changing stored data.
- Missing and foreign-owned transaction IDs return the same `404` response, preventing ownership disclosure.
- Future reads and mutations must always filter transactions by the authenticated `userId`.
