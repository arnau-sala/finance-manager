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

Approval events use `ACCESS_REQUEST_APPROVED` and actor `ADMIN`. They copy the pending request's ID, email, name, and message while leaving `adminId`, `discardReason`, and `denialReason` null until administrator sessions exist.

Denial events use `ACCESS_REQUEST_DENIED` and actor `ADMIN`. They copy the same request fields, including its ID, and require a free-text `denialReason`, while `adminId` and `discardReason` remain null for now.

Automatic `ACCESS_REQUEST_DISCARDED` events always leave `accessRequestId` null, including duplicate submissions. They describe an input discarded by the system rather than a lifecycle action on the pending request.

PostgreSQL enforces this distinction: discarded events must have a null reference, while creation, approval, and denial events must have a non-null `accessRequestId`. Historical lifecycle events erased by the previous foreign-key behavior use their creation event ID as a stable reference when the original value was no longer recoverable.

Malformed submissions are rejected before database access and do not create events.

`ApprovedEmail` stores emails approved for registration. A successful registration sets `usedAt` in the same transaction that creates the `User`, preventing one approval from being consumed twice. Until administrator sessions exist, `approvedById` remains null.

`User.passwordHash` stores an Argon2id hash, never the original password. New registrations explicitly receive role `USER` and status `APPROVED`.

No financial tables exist yet.
