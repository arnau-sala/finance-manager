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

`User` stores registered users and their role/status.

`AccessRequest` is the current pending queue. Its email is unique, and its email, name, and message fields are required. Approval and denial both remove the row.

`AccessRequestEvent` is the permanent structured history. New pending requests create an `ACCESS_REQUEST_CREATED` event with actor `VISITOR`. Valid-looking submissions that are not added to the queue create an `ACCESS_REQUEST_DISCARDED` event with actor `SYSTEM` and one of these reasons:

- `EMAIL_ALREADY_REGISTERED`
- `ACCESS_REQUEST_ALREADY_EXISTS`

Created events store the pending request ID in `accessRequestId`. This field is intentionally not a foreign key: it is a permanent historical reference that remains available after approval or denial deletes the pending row.

Approval events use `ACCESS_REQUEST_APPROVED` and actor `ADMIN`. They copy the pending request's ID, email, name, and message while leaving `discardReason` and `denialReason` null.

Denial events use `ACCESS_REQUEST_DENIED` and actor `ADMIN`. They copy the same request fields, including its ID, and require a free-text `denialReason`, while `discardReason` remains null.

Automatic `ACCESS_REQUEST_DISCARDED` events always leave `accessRequestId` null, including duplicate submissions. They describe an input discarded by the system rather than a lifecycle action on the pending request.

PostgreSQL enforces this distinction: discarded events must have a null reference, while creation, approval, and denial events must have a non-null `accessRequestId`. Historical lifecycle events erased by the previous foreign-key behavior use their creation event ID as a stable reference when the original value was no longer recoverable.

Malformed submissions are rejected before database access and do not create events.

`ApprovedEmail` stores emails approved for registration. A successful registration sets `usedAt` in the same transaction that creates the `User`, preventing one approval from being consumed twice.

`User.passwordHash` stores an Argon2id hash, never the original password. New registrations explicitly receive role `USER` and status `APPROVED`.

`User.updatedAt` starts as null. Prisma fills it automatically when the user is modified for the first time.

`AccessRequestEvent.adminId` is a nullable historical reference stored directly in the log, without adding a relation field to `User`. It remains null until authenticated administrative actions can obtain the administrator ID from the session.

`Category` stores the global predefined catalog. Every category has a stable ID, display name, and `INCOME` or `EXPENSE` type. Names are unique within each type.

Expense categories: Bars & Restaurants, Education, Gifts, Groceries, Health, Housing, Parties, Shopping, Sports, Subscriptions, Transportation, Travel, and Other.

Income categories: Allowance, Freelance, Gifts, Investments, Salary, Sales, and Other.

Category responses place expenses first. Within each type, names are alphabetical with `Other` always last.

`Transaction` stores the first financial records. Each row contains an immutable owner `userId`, required `categoryId`, type `INCOME` or `EXPENSE`, description, occurrence timestamp, creation timestamp, and `amountCents` as a positive integer. Decimal money is never stored as floating point.

`categoryId` is stored as a scalar reference without a Prisma relation field, matching the project's current approach for ownership and administrative references. The API validates that the category exists and matches the transaction type. The migration assigns existing transactions to `Other Expense` or `Other Income` according to their type before making `categoryId` mandatory.

The `(userId, occurredAt)` index supports future user-scoped chronological lists, while the `categoryId` index supports category filtering. Transaction editing and deletion filter by both `id` and the authenticated `userId`; the database never mutates a row owned by another user.
