# Security

## Phase 4 Foundation

The project now persists public access requests and exposes local administrative read endpoints.

Security decisions already in place:

- The backend is the only place where future sensitive logic should run.
- `CONTEXT.md` and `apps/api/.env` are ignored by Git.
- Real credentials, production database URLs, and secrets must not be committed.
- User emails are unique in the `User` and `ApprovedEmail` tables.

Every private financial table must include an owner field such as `userId`.

The public access-request endpoint:

- Validates the entire request body and rejects unknown fields.
- Normalizes email addresses by trimming whitespace and converting them to lowercase.
- Limits names to 100 characters and messages to 1000 characters.
- Requires non-empty email and name fields; the optional message is still limited to 1000 characters.
- Returns the same status and body for every syntactically valid submission.
- Uses a database constraint to prevent duplicate pending requests during concurrent calls.
- Stores every valid access-request outcome in a structured server-side event log without exposing the event or discard reason publicly.

A sender can always inspect their own HTTP request and submitted fields in browser developer tools. What remains private is the server-side decision and database destination: no second HTTP request is made, and the response does not identify whether the email is registered, approved, pending, or new.

Every `/admin/*` route uses the shared `requireAdministrator` pre-handler. Missing or invalid sessions receive `401`, while authenticated non-administrators receive `403`. Approval and denial events store `adminId` from the verified session rather than client input. Denial reasons are administrative data and are not exposed through public responses.

Administrative access-request lists are paginated. Pending requests default to 50 items with a maximum of 100. The permanent event log defaults to 100 items with a maximum of 200.

Registration security decisions:

- Email addresses are trimmed, lowercased, and validated.
- Registration requires matching `password` and `passwordConfirmation` fields.
- Passwords must contain between 9 and 128 characters, with at least one uppercase letter, one digit, and one special character.
- Passwords are hashed with Argon2id and are never returned by the API.
- Password hashing happens only after the email is confirmed as approved and unused.
- User creation and approval consumption share one transaction.
- Non-approved, used, and registered emails return the same public error.
- Successful responses expose only the user ID, email, role, status, and creation timestamp.

Login security decisions:

- Unknown emails, incorrect passwords, and suspended users return the same `401` response.
- Unknown emails still run an Argon2id verification against a dummy hash to reduce timing differences.
- Password login only accepts users whose `authProvider` is `PASSWORD`.
- Password hashes and user details are never returned by login.
- Successful login regenerates the session and stores only the user ID.
- Session cookies are encrypted, `HttpOnly`, `SameSite=Lax`, and limited to seven days.
- Cookie `Secure` is disabled for local HTTP development and enabled when `NODE_ENV=production`.
- Logout requires an active session and deletes its cookie.

Google sign-in security decisions:

- Google sign-in uses a backend OAuth 2.0 / OpenID Connect redirect flow.
- The backend stores a random `state` value in the encrypted session and validates it on callback before exchanging the authorization code.
- Google ID tokens are verified server-side with Google's official Node.js auth library and the configured client ID as audience.
- The backend requires a verified Google email before using it.
- Existing `GOOGLE` users can sign in only when Google's stable `sub` identifier matches the stored `googleSubject`.
- If an approved email has no user yet, Google sign-in creates a `GOOGLE` user without a password and consumes the approval in the same transaction.
- Password users are not silently converted to Google users. A Google attempt with an existing password email receives the same neutral request-received frontend result as other non-created requests.
- Public Google access-request outcomes remain neutral: the frontend cannot distinguish registered, pending, approved, or newly created request states unless the result is an actual successful login for the Google account owner.

Origin protection decisions:

- Mutating requests (`POST`, `PUT`, `PATCH`, and `DELETE`) with an `Origin` header must come from an allowed origin.
- Requests without an `Origin` header are allowed so Postman, CLI tools, and same-server internal calls keep working.
- Local development allows common localhost frontend/API origins by default.
- Production must set `ALLOWED_ORIGINS` as a comma-separated list, for example `https://app.example.com,https://www.example.com`.
- Disallowed browser origins receive `403 Forbidden` with `{"error":"Origin not allowed."}`.

Security header decisions:

- The API uses Helmet globally to send standard defensive HTTP headers.
- `X-Content-Type-Options`, `X-Frame-Options`, referrer policy, and related browser-hardening headers are enabled through Helmet defaults.
- The referrer policy is `no-referrer` because API responses should not depend on or leak navigation context.
- Content Security Policy is disabled for now because the API does not serve the frontend. A strict CSP should be designed when the production web interface and asset origins are known.
- Cross-Origin Embedder Policy is disabled for now to avoid unnecessary friction with future frontend tooling and third-party integrations.

Rate limiting decisions:

- A global IP-based limit protects the full API from broad request floods.
- Login is limited by IP and normalized email, allowing normal human mistakes while slowing repeated attempts against the same account from the same source.
- Registration is limited by IP and normalized email because password hashing is intentionally expensive.
- Public access requests are limited by IP and normalized email to reduce spam while preserving neutral public responses.
- Authenticated financial reads are limited by session user when available, falling back to IP for unauthenticated requests.
- Financial writes have a stricter session/IP limit than reads.
- Administrative routes share an admin-specific session/IP limit in addition to requiring an approved administrator.
- Rate-limited requests return `429 Too Many Requests` with a retry hint.
- The current rate-limit store is in memory, which is suitable for the local MVP. A production multi-instance deployment must use a shared store such as Redis.

Current limits:

| Area | Limit | Key |
| :---: | :---: | :---: |
| Global API | 300/min | IP |
| Login | 20/15min | IP + email |
| Register | 8/15min | IP + email |
| Google auth | 30/15min | IP |
| Logout | 30/min | session/IP |
| Access requests | 10/hour | IP + email |
| Financial reads | 180/min | session/IP |
| Financial writes | 60/min | session/IP |
| Admin routes | 120/min | session/IP |

Administrative user listing security decisions:

- `GET /admin/users` and `GET /admin/users/:id` require an active session for an `APPROVED` administrator.
- Authenticated non-administrators receive `403 Forbidden`.
- User detail IDs must be valid CUIDs before reaching the database.
- The database query selects only ID, email, role, status, and creation timestamp.
- Password hashes and update timestamps are never loaded into the endpoint response.
- User lists are paginated with a default limit of 50 and maximum limit of 100.

`GET /auth/me` requires an active approved-user session and returns the shared public user fields plus `updatedAt`. The user ID is always derived from the encrypted session cookie rather than request input.

Transaction security decisions:

- An active session and an existing `APPROVED` user are required.
- `userId` is read from the encrypted session and is never accepted from the request body.
- Transaction listing always filters by the session `userId`; the `ADMIN` role has no bypass.
- Transaction lists are paginated with a default limit of 100 and maximum limit of 200.
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
- Category-filtered transaction reads filter by category ID and authenticated `userId`.
- Missing and foreign-owned transaction IDs return the same `404` response, preventing ownership disclosure.
- Statistics endpoints must filter transactions by the authenticated `userId`.
- `GET /statistics/balance` returns only the caller's own totals, including for administrators.
- `GET /statistics/balance/:month/:year` and `GET /statistics/balance/:month` apply the same owner-only rule to monthly totals.
- `GET /statistics/balance/year/:year` and `GET /statistics/balance/year` apply the same owner-only rule to yearly totals.
- `GET /statistics/categories` and `GET /statistics/categories/type/:type` aggregate only the caller's own transactions.
- Period-filtered category statistics apply the same owner-only rule and never accept `userId` from the request.
- Typed period category statistics only accept `income` or `expense` as the type segment.
- Future reads and mutations must always filter transactions by the authenticated `userId`.
