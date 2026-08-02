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
```

Replace the PostgreSQL user, password, host, port, or database name with your local setup.

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

`User` stores registered users, their required display name, role/status, and authentication provider. Names are limited to 100 characters and cannot be null.

`AccessRequest` is the current pending queue. Its email is unique; email and name must be non-empty, while an omitted message is persisted as an empty string. Approval and denial both remove the row.

`AccessRequestEvent` is the permanent structured history. New pending requests create an `ACCESS_REQUEST_CREATED` event with actor `VISITOR`. Valid-looking submissions that are not added to the queue create an `ACCESS_REQUEST_DISCARDED` event with actor `SYSTEM` and one of these reasons:

- `EMAIL_ALREADY_REGISTERED`
- `ACCESS_REQUEST_ALREADY_EXISTS`

Created events store the pending request ID in `accessRequestId`. This field is intentionally not a foreign key: it is a permanent historical reference that remains available after approval or denial deletes the pending row.

Approval events use `ACCESS_REQUEST_APPROVED` and actor `ADMIN`. They copy the pending request's ID, email, name, and message, store the approving administrator ID in `adminId`, and leave `discardReason` and `denialReason` null.

Denial events use `ACCESS_REQUEST_DENIED` and actor `ADMIN`. They copy the same request fields, including its ID, store the denying administrator ID in `adminId`, and require a free-text `denialReason`, while `discardReason` remains null.

Automatic `ACCESS_REQUEST_DISCARDED` events always leave `accessRequestId` null, including duplicate submissions. They describe an input discarded by the system rather than a lifecycle action on the pending request.

PostgreSQL enforces this distinction: discarded events must have a null reference, while creation, approval, and denial events must have a non-null `accessRequestId`. Historical lifecycle events erased by the previous foreign-key behavior use their creation event ID as a stable reference when the original value was no longer recoverable.

Malformed submissions are rejected before database access and do not create events.

`ApprovedEmail` stores emails approved for registration. `approvedBy` stores the administrator user ID that authorized the email, without adding a relation field to `User`. A successful registration sets `usedAt` in the same transaction that creates the `User`, preventing one approval from being consumed twice.

`User.authProvider` records the available authentication methods:
`PASSWORD`, `GOOGLE`, or `PASSWORD_AND_GOOGLE`. A linked account keeps both
credentials and can use either sign-in flow.

`User.passwordHash` stores an Argon2id hash, never the original password. It is
required for `PASSWORD` and `PASSWORD_AND_GOOGLE` users and null for
Google-only users.

`User.sessionVersion` starts at `1` and increments after a password change. Authenticated cookies carry the matching version, allowing the API to reject sessions created before a credentials change without storing individual sessions in PostgreSQL.

`User.startingNetWorthCents` stores the financial baseline as signed integer
cents. It is the only persisted starting-net-worth field and has no associated
date. A null value means the initial setup has not been handled; Skip stores
`0`. The number is editable and remains profile source data, not a synthetic
income transaction.

`User.googleSubject` stores Google's stable account identifier for `GOOGLE` and
`PASSWORD_AND_GOOGLE` users. It is unique and is used with the verified Google
ID token so sign-in does not rely only on a changeable email address.

New password registrations require a name and explicitly receive role `USER`, status `APPROVED`, and provider `PASSWORD`. Google users created from an approved email store Google's verified profile name and receive provider `GOOGLE`, no password hash, and the verified Google subject.

`User.updatedAt` starts as null. Prisma fills it automatically when the user is modified for the first time.

Deleting a user removes records containing that account's email from `AccessRequest`, `AccessRequestEvent`, and `ApprovedEmail`. Administrative references made by that user are anonymized by setting `AccessRequestEvent.adminId` and `ApprovedEmail.approvedBy` to null, preserving records that belong to other people without retaining the deleted user's ID.

`AccessRequestEvent.adminId` is a nullable historical reference stored directly in the log, without adding a relation field to `User`. Approval and denial events populate it from the verified administrator session; visitor and system events leave it null.

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
