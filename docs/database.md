# Database

## Provider

The API uses PostgreSQL through Prisma.

Prisma is managed from the repository root because the database schema belongs to the backend app, but the commands are run as monorepo-level maintenance tasks.

Schema location:

```text
apps/api/prisma/schema.prisma
```

Migration location:

```text
apps/api/prisma/migrations
```

## Local Configuration

Development configuration is stored in `apps/api/.env`.

The file is ignored by Git.

Expected values:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/finance_manager?schema=public"
WEB_APP_URL=http://localhost:5173
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/google/callback
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
BREVO_API_KEY=<brevo-api-key>
BREVO_SENDER_EMAIL=<verified-brevo-sender-email>
BREVO_SENDER_NAME=Finance Manager
EMAIL_VERIFICATION_SECRET=<64-character-hex-secret>
```

Replace the PostgreSQL user, password, host, port, or database name with your local setup.
The complete non-secret template is available at `apps/api/.env.example`.

## Commands

Generate Prisma Client:

```bash
npm run db:generate
```

Apply migrations in development:

```bash
npm run db:migrate
```

Open Prisma Studio:

```bash
npm run db:studio
```

Deploy existing migrations in a deployed environment:

```bash
npm run db:deploy
```

## Current Models

`User` stores registered users, their required display name, role/status, and
authentication provider. A user must have at least one login identifier:
`email` or `username`; PostgreSQL enforces this invariant with a check
constraint. Both identifiers are unique and nullable so a username-only account
does not need a placeholder email. Names remain required and limited to 100
characters. `emailVerifiedAt` is null until a real address is verified.

`PendingRegistration` is temporary state for password registration. Its email
is unique and normalized. Each row stores the required name, Argon2id password
hash, HMAC-SHA256 verification-code hash, number of failed attempts, expiry,
last delivery time, and maintenance timestamps. It never stores a plaintext
password or verification code.

The row is created or replaced only when the email is not registered and its
60-second resend cooldown has passed. A code is valid for 10 minutes and can be
tried five times. Successful verification atomically deletes the pending row
and creates `User`; stale pending rows older than 24 hours are removed
opportunistically during later registration requests. Account deletion also
removes a pending row with the same normalized email.

`User.authProvider` records the available authentication methods:
`PASSWORD`, `GOOGLE`, or `PASSWORD_AND_GOOGLE`. A linked account keeps both
credentials and can use either sign-in flow.

`User.passwordHash` stores an Argon2id hash, never the original password. It is
required for `PASSWORD` and `PASSWORD_AND_GOOGLE` users and null for
Google-only users.

`User.emailLoginEnabled` distinguishes an email stored as part of a Google
identity from a verified email/password sign-in method. Email registrations
set it immediately; Google registrations leave it false. Password login and
email password recovery require it when the identifier is an email, while
username login remains independent.

`User.sessionVersion` starts at `1` and increments after a password change. Authenticated cookies carry the matching version, allowing the API to reject sessions created before a credentials change without storing individual sessions in PostgreSQL.

`User.startingNetWorthCents` stores the financial baseline as signed integer
cents. It is the only persisted starting-net-worth field and has no associated
date. A null value means the initial setup has not been handled; Skip stores
`0`. The number is editable and remains profile source data, not a synthetic
income transaction.

`User.googleSubject` stores Google's stable account identifier for `GOOGLE` and
`PASSWORD_AND_GOOGLE` users. It is unique and is used with the verified Google
ID token so sign-in does not rely only on a changeable email address.

`PendingGoogleAuthAction` stores short-lived decisions that must be confirmed
after Google returns to the app: create a new account, sign into an existing
Google account, or continue to password login. It records the server-bound
login/registration intent and verified Google identity, but only stores the
SHA-256 hash of the random action token held in the encrypted session. Actions
expire after 10 minutes, are atomically deleted on confirmation, and cascade
when their referenced user is deleted.

`AccountRecoveryCode` contains at most one row per username user. It stores a
globally unique SHA-256 hash of a cryptographically random 16-character Base58
code and cascades on account deletion. Successful recovery replaces the hash in
the same transaction as the password change, making every plaintext code
single-use and enabling indexed code-only username recovery without scanning
users.

`PendingPasswordReset` stores at most one email-recovery attempt per user and
email. It distinguishes password-reset codes from Google sign-in guidance. A
reset code is stored only as an email-bound HMAC hash and carries its expiry,
attempt count, and persistent resend timestamp.

`PasswordResetGrant` stores the SHA-256 hash of a 32-byte random temporary token,
its method, and its 10-minute expiry. Recovery-code grants also bind the code
hash that must still be current when completion rotates it. Both reset tables
cascade on user deletion.

`PendingEmailLink` stores one active email-link attempt per user and reserves
one candidate email per attempt. It uses an account-and-email-bound HMAC hash,
10-minute expiry, five-attempt limit, 60-second send cooldown, and cascading
deletion. For Google-only accounts it also holds the new password only as an
Argon2id hash until verification. Successful verification deletes the row,
assigns or confirms the email on the existing `User`, and enables email login
rather than creating another account.

New email/password registrations require a verified code and a name, then
explicitly receive role `USER`, status `APPROVED`, and provider `PASSWORD`. New Google
identities store Google's verified profile name and receive provider `GOOGLE`,
no password hash, and the verified Google subject.

Username registrations also use provider `PASSWORD`, store a required username
and name, leave email fields null, and create their recovery code atomically.
Adding a normal email keeps provider `PASSWORD`; adding Google changes it to
`PASSWORD_AND_GOOGLE` and records Google's verified email when none existed.
Adding email login to Google changes the provider to `PASSWORD_AND_GOOGLE`
without replacing the stable Google subject.

`AccountRecoveryCode` keeps the active unique hash and temporary nullable fields
for a pending replacement, its hashed activation token, expiry, and optional
other-session revocation choice. This lets Profile show a newly generated code
before an activation transaction replaces the currently valid hash.

`User.updatedAt` starts as null. Prisma fills it automatically when the user is modified for the first time.

Deleting a user removes transactions, recovery code, pending email link,
pending password reset, password-reset grant, and referenced Google auth
actions through `ON DELETE CASCADE`, and explicitly removes any matching
`PendingRegistration` when the user has an email.

`Category` stores the global predefined catalog. Every category has a stable ID, display name, and `INCOME` or `EXPENSE` type. Names are unique within each type.

Expense categories: Dining, Education, Gifts, Groceries, Health, Housing, Parties, Shopping, Sports, Subscriptions, Transport, and Other.

Income categories: Allowance, Benefits, Freelance, Gifts, Investments, Salary, Sales, and Other.

Category responses place expenses first. Within each type, names are alphabetical with `Other` always last.

`Transaction` stores the first financial records. Each row contains an immutable owner `userId`, required `categoryId`, type `INCOME` or `EXPENSE`, description, occurrence date `occurredOn`, creation timestamp `createdAt`, and `amountCents` as a positive integer. Decimal money is never stored as floating point.

`occurredOn` uses PostgreSQL `DATE` and represents only the financial calendar day. It has no time or timezone. `createdAt` remains a full timestamp recording when the row was created and provides deterministic ordering for transactions sharing the same occurrence date.

`Transaction.userId` references `User.id` with `ON DELETE CASCADE`, ensuring account deletion removes every owned transaction. `Transaction.categoryId` references `Category.id` with `ON DELETE RESTRICT`, protecting the predefined catalog while transactions still use a category. The API validates that the category exists and matches the transaction type before writes.

The `(userId, occurredOn)` index supports the user-scoped chronological transaction list, while the `categoryId` index supports category filtering and statistics joins. Listing orders equal dates by `createdAt` and filters by the authenticated `userId`; editing and deletion filter by both `id` and that same owner ID.

Cash-flow balances, percentages, category chart points, medians, averages, and
streaks are derived from `Transaction`; they are not persisted as duplicate
state. Statistics
queries aggregate by the authenticated owner and calendar period using the
`(userId, occurredOn)` index. This keeps edits and deletions immediately
consistent without maintaining summary tables.

Current net worth and Net Worth Evolution combine the user's stored starting
net worth with signed transaction flow accumulated through each requested
point. Because the baseline is intentionally timeless, changing it shifts every
derived net-worth value equally without changing transaction history.
