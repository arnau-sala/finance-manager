# Security

## Current Foundation

The project supports verified-email registration, Google identities, and
username-only accounts protected by a high-entropy recovery code.

Security decisions already in place:

- The backend is the only place where future sensitive logic should run.
- `CONTEXT.md` and `apps/api/.env` are ignored by Git.
- Real credentials, production database URLs, and secrets must not be committed.
- User emails are unique in `User` and pending emails are unique in
  `PendingRegistration`.
- Usernames are normalized, unique, and separate from the required display
  name. PostgreSQL requires every user to have an email or username.

Every private financial table must include an owner field such as `userId`.

Every `/admin/*` route uses the shared `requireAdministrator` pre-handler.
Missing or invalid sessions receive `401`, while authenticated
non-administrators receive `403`.

Registration security decisions:

- Email addresses are trimmed, lowercased, and validated.
- Names are required, trimmed, and limited to 100 characters.
- Registration requires matching `password` and `passwordConfirmation` fields.
- Passwords must contain between 9 and 128 characters, with at least one uppercase letter, one digit, and one special character.
- Passwords are hashed with Argon2id only after user-existence and resend-cooldown checks, and are never returned by the API.
- The six-digit verification code is generated with Node's cryptographic random-number generator and is stored only as an email-bound HMAC-SHA256 hash.
- The HMAC secret is a separate 32-byte backend secret represented as 64 hexadecimal characters.
- Codes expire after 10 minutes, permit five failed verification attempts, and can be resent only after a persistent 60-second cooldown.
- Code comparison uses `timingSafeEqual`.
- A syntactically valid registration or resend returns the same `202` body for a new email, an existing user, a missing pending row, or an active cooldown.
- A `User` does not exist until a correct code atomically consumes its `PendingRegistration`; concurrent verification cannot consume one code twice.
- Successful verification stores `emailVerifiedAt`, starts the secure session, and exposes only public user fields.
- Brevo credentials and the verification HMAC secret are backend-only environment variables and must never enter frontend bundles or Git.
- Brevo requests have an eight-second timeout. Failed delivery restores or removes the pending row so an undelivered code does not leave misleading active state.
- Pending rows older than 24 hours are removed opportunistically and contain neither plaintext passwords nor plaintext codes.
- Successful responses expose only public fields such as ID, nullable email,
  nullable username, name, role, status, and creation timestamp.

Username account and recovery decisions:

- Usernames contain 3 to 30 lowercase characters from a restricted alphabet,
  must start and end alphanumerically, and reject reserved system names.
- Public username availability is an intentionally enumerable property because
  usernames are public login identifiers. The advisory lookup is rate limited
  by IP, selects only the user ID, and never replaces the unique constraint
  enforced by final registration.
- Username ownership is checked before Argon2id hashing and rechecked inside the
  account-creation transaction.
- Authenticated username linking derives the target user only from the secure
  session. Its public availability check remains advisory; the write validates
  again and relies on the unique constraint as the final concurrent claim.
- Google-only users must create a server-validated Argon2id password when they
  add a username. Existing password hashes are never accepted from or replaced
  by the client during linking.
- Username assignment and recovery-code creation are one transaction. A failure
  cannot leave an account with a username but without its recovery credential.
- Each new username account receives 16 unbiased Base58 characters from
  `randomBytes`, providing about 94 bits of entropy. The plaintext recovery
  code is returned only in the creation response.
- The recovery-code response is marked `Cache-Control: no-store`. The web
  client keeps the plaintext only in component memory for the one-time handoff
  screen and clears it when authenticated onboarding begins.
- PostgreSQL stores only a unique SHA-256 recovery-code hash. Its entropy makes
  offline guessing infeasible without requiring a server secret, while the
  unique index supports secure code-only username recovery without a table scan.
- Recovery input discards separators and punctuation but preserves
  alphanumeric characters and letter case. Invalid Base58 characters still
  fail validation.
- A valid code creates a random, short-lived reset grant instead of an
  authenticated session. The code is rotated only when that grant completes a
  password change, so abandoning the form cannot destroy the user's only code.
- Completion atomically claims the grant, verifies the original code hash is
  still current, changes the password, increments `sessionVersion`, and stores
  a replacement recovery-code hash. Concurrent reuse cannot succeed.
- Invalid usernames, codes, and code-only lookups share one response. Verification
  is rate limited by IP so raw recovery secrets never become rate-limit keys.
- Authenticated rotation is available only to a valid session whose user has a
  username. Preparation stores a short-lived pending hash while the current
  recovery code remains valid; the plaintext replacement exists only in the
  no-store response and React memory.
- Activation requires the random rotation token returned with that pending
  code. It atomically promotes the pending hash and invalidates the old one only
  after the user has seen the replacement screen. The pending code expires
  after 10 minutes if the handoff is abandoned.
- The optional sign-out setting increments `sessionVersion` during activation,
  invalidating other devices, then regenerates the current secure session with
  the new version so this device stays signed in.
- During registration, the semantic form remains mounted only until
  server-confirmed account creation. Final confirmation submits it to the
  rate-limited `POST /auth/login/browser` endpoint, which repeats normal
  password authentication and redirects without placing credentials in URLs.
  Abandoning registration unmounts the form, and plaintext credentials are
  never written to browser storage or logs.

Password-reset security decisions:

- Email reset issuance always returns the same neutral response. Unknown
  addresses, cooldowns, password accounts, and Google-only accounts cannot be
  distinguished by status or response body.
- Delivery happens after the neutral response path has been decided. Eligible
  password accounts receive a six-digit HMAC-SHA256 email code; Google-only
  accounts receive sign-in guidance instead of a nonexistent password reset.
- Email codes expire after 10 minutes, allow five failed attempts, and have a
  persistent 60-second resend cooldown. They are bound to the normalized email.
- Successful email-code or recovery-code verification creates a 32-byte random
  grant. Only its SHA-256 hash is stored in PostgreSQL; the plaintext exists in
  a ten-minute `HttpOnly`, `SameSite=Strict` cookie restricted to the reset API.
- The grant authorizes only password-reset endpoints. It is never accepted by
  authenticated routes and is never exposed to React, local storage, session
  storage, logs, or URLs.
- The frontend may keep only the non-sensitive recovery stage and identifier in
  `sessionStorage` for up to 10 minutes so switching to Mail on mobile does not
  lose the flow.
- Completing a reset requires the normal password policy and matching fields,
  consumes the grant once, increments `sessionVersion`, clears the current
  session, and does not sign the user in automatically.
- Accounts with an email receive a password-change notification. Delivery
  failure is logged but cannot roll back an already-secured password change.
- Starting a new recovery or cancelling after verification invalidates an older
  grant. Expired grants and stale pending rows are removed opportunistically.

Email-linking decisions:

- Only an approved authenticated user without enabled email/password sign-in
  can start the email-link flow; the target user ID never comes from the body.
- `emailLoginEnabled` separates a Google-verified address from an address that
  is allowed to authenticate with the account password. Password login and
  email reset both enforce this flag.
- Candidate addresses are normalized and checked against users, pending email
  registrations, and other pending links before delivery and before assignment.
- Codes use a scoped HMAC binding the user ID, candidate email, and code, so a
  code from another registration or account cannot be replayed.
- The flow has the same 10-minute expiry, five-attempt limit, 60-second resend
  cooldown, neutral issuance response, and delivery rollback as registration.
- When a candidate address already belongs to another user, its owner receives
  an informational notice that contains no requester identity. A persistent
  per-owner 24-hour cooldown prevents notification abuse across sessions or IPs.
- Successful code and conflict-notice branches share the same `202` body and a
  timing-normalized response window, preventing account discovery through the
  response payload, status, or a fast no-send branch.
- A Google-only account must submit a policy-compliant password before the
  email is sent. Only its Argon2id hash enters `PendingEmailLink`; cancellation
  or expiry removes it without changing the account.
- Successful verification updates the existing user. Unique constraints and an
  atomic final claim prevent two accounts from taking the same address. Email,
  username, and Google credentials already present are preserved.
- Google linking may establish a username account's first email only after
  Google verifies it. Accounts with an existing email must select that exact
  email, and every Google subject remains globally unique.

Login security decisions:

- Unknown identifiers, incorrect passwords, and suspended users return the same `401` response.
- Unknown identifiers still run an Argon2id verification against a dummy hash to reduce timing differences.
- Password login only accepts users whose `authProvider` is `PASSWORD` or
  `PASSWORD_AND_GOOGLE` and whose password hash exists.
- Password hashes and user details are never returned by login.
- Successful login regenerates the session and stores the user ID and current session version in the encrypted cookie.
- Session cookies are encrypted, `HttpOnly`, `SameSite=Lax`, and limited to seven days.
- Cookie `Secure` is disabled for local HTTP development and enabled when `NODE_ENV=production`.
- Logout requires an active session and deletes its cookie.

Account deletion security decisions:

- `DELETE /account` derives the target account only from the encrypted session and never accepts a user ID.
- Password-capable accounts must provide their current password when that verification method is selected; an incorrect value returns the explicit `Incorrect password.` error because the caller is already authenticated as that account.
- User deletion and all related database cleanup run in one transaction.
- Owned transactions and any matching pending registration are deleted.
- The current session is deleted after success. Sessions on other devices can no longer resolve the deleted user and therefore lose access.
- Google-only accounts require a fresh account selection through Google. Hybrid accounts may choose either fresh Google verification or their current password.
- The Google deletion flow uses a random, one-use OAuth `state` separate from normal sign-in and preserves the active session until verification finishes.
- Google deletion requires both Google's verified email and stable `sub` identifier to match the active `GOOGLE` or `PASSWORD_AND_GOOGLE` user. A different account produces a retryable mismatch and no database writes.
- Password and Google deletion reuse one atomic cleanup service so both remove the same account-owned data.

Profile editing security decisions:

- `PATCH /account` derives the target user only from the encrypted session and accepts no user ID.
- The strict request body accepts only optional `name` and
  `startingNetWorth`, requires at least one, and rejects email, role, status,
  provider, and unknown fields.
- Name validation is shared with registration: surrounding whitespace is removed and the result must contain 1 to 100 characters.
- Starting net worth uses the same signed range and decimal validation as
  onboarding and updates only the authenticated user's timeless baseline.
- Only an existing `APPROVED` session user can be updated, and the response excludes password and Google subject data.

Password change security decisions:

- `PATCH /account/password` derives the account from the encrypted session and
  is available to password-only and password-and-Google accounts, but not
  Google-only accounts.
- The backend requires the current password, validates two matching new-password fields, and applies the same password policy as registration.
- The new password must differ from the current password. Its Argon2id hash is calculated only after all validation and current-password verification succeeds.
- A successful change increments `User.sessionVersion`, regenerates the current cookie with the new version, and invalidates every other session for that account.
- Cookies created before session versioning are intentionally rejected and require one fresh login.

Google sign-in security decisions:

- Google sign-in uses a backend OAuth 2.0 / OpenID Connect redirect flow.
- The backend stores a random `state` value in the encrypted session and validates it on callback before exchanging the authorization code.
- Google ID tokens are verified server-side with Google's official Node.js auth library and the configured client ID as audience.
- The backend requires a verified Google email before using it.
- Existing `GOOGLE` and `PASSWORD_AND_GOOGLE` users can sign in with Google only
  when Google's stable `sub` identifier matches the stored `googleSubject`.
- Public Google starts bind an explicit `login` or `register` intent to the
  encrypted-session OAuth state; callback query values cannot change it.
- Login with a previously unknown Google identity requires explicit in-app
  confirmation before creating its account. Registration creates a new Google
  identity directly because Google has already verified the address.
- Registration with an existing Google-capable identity requires confirmation
  before starting that existing account's session.
- Password users are not silently converted to Google users.
- A verified email collision with a password-only account can prefill normal
  login, but Google proof alone never authenticates or links that account.
- Consent-required outcomes use a 32-byte random, 10-minute, one-use token. The
  encrypted HttpOnly session stores the token and PostgreSQL stores only its
  SHA-256 hash. Confirmation revalidates provider, status, email, Google
  subject, and current ownership before atomically consuming the row.
- Exact existing-account feedback is available only after Google verifies
  control of the selected email; no public email lookup endpoint is added.
- Anonymous session checks do not delete pending OAuth state. `/auth/me`
  returns `401` without clearing the encrypted cookie when it contains no
  claimed user, while malformed or stale authenticated sessions are still
  removed.
- `POST /account/google/link/start` requires an approved authenticated
  password-only account and preserves its active session while Google presents
  the account chooser.
- Google linking has its own random, one-use OAuth `state`, separate from public
  sign-in and account deletion. The callback requires the verified Google email
  to equal an existing session email, or securely assigns it when the username
  account has no email. It rejects an email or `sub` already owned elsewhere.
- Successful linking keeps the Argon2id password hash, stores `googleSubject`,
  and changes the provider to `PASSWORD_AND_GOOGLE`; mismatch and failure paths
  make no database changes.

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
- Registration and resend are limited by IP to protect password hashing and the
  outbound Brevo quota without creating a per-email enumeration signal.
- Verification is limited by IP and normalized email in addition to the
  persistent code-attempt limit.
- Authenticated financial reads are limited by session user when available, falling back to IP for unauthenticated requests.
- Financial writes have a stricter session/IP limit than reads.
- Administrative routes share an admin-specific session/IP limit in addition to requiring an approved administrator.
- Rate-limited requests return `429 Too Many Requests` with a retry hint.
- The current rate-limit store is in memory, which is suitable for the local MVP. A production multi-instance deployment must use a shared store such as Redis.

Current limits:

| Area | Limit | Key |
| :---: | :---: | :---: |
| Global API | 300/min | IP |
| Login | 20/15min | IP + identifier |
| Register/email | 20/hour | IP |
| Username availability | 60/15min | IP |
| Verify registration | 10/15min | IP + email |
| Start/reset email | 5/15min | IP + email |
| Verify email code | 10/15min | IP + email |
| Verify recovery code | 10/15min | IP |
| Complete reset | 5/15min | IP |
| Google auth | 30/15min | IP |
| Google auth decisions | 10/15min | IP |
| Logout | 30/min | session/IP |
| Profile editing | 30/15min | session/IP |
| Google linking | 5/15min | session/IP |
| Email linking | 5/15min | session/IP |
| Verify linked email | 10/15min | session/IP |
| Password changes | 5/15min | session/IP |
| Replace recovery code | 5/15min | session/IP |
| Account deletion | 5/15min | session/IP |
| Financial reads | 180/min | session/IP |
| Financial writes | 60/min | session/IP |
| Admin routes | 120/min | session/IP |

Administrative user listing security decisions:

- `GET /admin/users` and `GET /admin/users/:id` require an active session for an `APPROVED` administrator.
- Authenticated non-administrators receive `403 Forbidden`.
- User detail IDs must be valid CUIDs before reaching the database.
- The database query selects only public ID, nullable email/username, name,
  role, status, and creation timestamp.
- Password hashes and update timestamps are never loaded into the endpoint response.
- User lists are paginated with a default limit of 50 and maximum limit of 100.

`GET /auth/me` requires an active approved-user session and returns the shared public user fields plus `updatedAt`. The user ID is always derived from the encrypted session cookie rather than request input.

`POST /account/onboarding/starting-net-worth` also derives the owner from the
encrypted session and never accepts a user ID. The body is a strict `SET` or
`SKIP` action, and signed money is range-checked before reaching PostgreSQL.
`SET` replaces only the authenticated user's baseline, while `SKIP` stores
zero; neither operation creates, edits, or deletes transactions.

Transaction security decisions:

- An active session and an existing `APPROVED` user are required.
- `userId` is read from the encrypted session and is never accepted from the request body.
- Transaction listing always filters by the session `userId`; the `ADMIN` role has no bypass.
- Transaction lists are paginated. The main Moves feed defaults to 20 records,
  category-only reads default to 100, and both enforce a maximum of 200.
- Transaction detail retrieval filters by both ID and session `userId`.
- Missing and foreign-owned transaction details return the same `404` response.
- Balance and ranking aggregates in transaction detail are restricted to that
  same session `userId`, and the response never exposes an owner ID.
- Description, amount, type, category, and the `YYYY-MM-DD` calendar date are validated before persistence; descriptions are limited to 50 characters, while transaction timestamps and timezone offsets are rejected.
- Categories must exist and match the transaction type on creation and editing.
- Category references are validated by the API before transaction writes.
- PostgreSQL foreign keys reject transactions that reference missing users or categories.
- Amounts are positive integer cents in PostgreSQL, avoiding floating-point money errors.
- PostgreSQL also rejects non-positive amounts and blank descriptions.
- Deletion filters by transaction ID and authenticated `userId` in one database operation.
- Partial editing applies the same ownership filter and validates every supplied field.
- Empty edits verify ownership and succeed without changing stored data.
- Native sharing is initiated locally and includes only type, description,
  signed amount, category, and date. It does not expose transaction IDs,
  ownership identifiers, tracked balances, ranks, or an authenticated URL.
- Category-filtered transaction reads filter by category ID and authenticated `userId`.
- Missing and foreign-owned transaction IDs return the same `404` response, preventing ownership disclosure.
- All financial query keys include the authenticated `userId`; no private cache is persisted outside memory. Transaction and starting-net-worth writes invalidate the relevant owner-scoped query families, while logout, account deletion, and session expiration clear the full authenticated cache.
- New speculative reads pause while the installed web app is hidden. Returning after three minutes discards cached financial data and pending prefetches before Home is loaded again.
- Statistics endpoints must filter transactions by the authenticated `userId`.
- `GET /statistics/balance` returns only the caller's own totals, including for administrators.
- `GET /statistics/balance/:month/:year` and `GET /statistics/balance/:month` apply the same owner-only rule to monthly totals.
- `GET /statistics/balance/year/:year` and `GET /statistics/balance/year` apply the same owner-only rule to yearly totals.
- `GET /statistics/categories` and `GET /statistics/categories/type/:type` aggregate only the caller's own transactions.
- Period-filtered category statistics apply the same owner-only rule and never accept `userId` from the request.
- Typed period category statistics only accept `income` or `expense` as the type segment.
- `GET /statistics/overview` and `GET /statistics/charts` derive their owner only from the encrypted session, reject future periods, and never return `userId`. Overview returns compact previews only for the caller's largest income and expense so the authenticated detail flow can open those transactions; it does not expose transaction history.
- Aggregate financial responses disable shared/browser HTTP storage with `Cache-Control: private, no-store`; the frontend keeps only short-lived owner-keyed in-memory entries and clears them when the session ends.
- `GET /home` derives ownership from the authenticated session and returns only that user's cash-flow balance, current net worth, latest transactions, and current-month activity; it does not accept or expose `userId`.
- Future reads and mutations must always filter transactions by the authenticated `userId`.
