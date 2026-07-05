# Architecture

## Phase 4 Foundation

The repository starts as a small monorepo with a single implemented app:

```text
apps/api
```

The API owns all backend behavior. The frontend and shared packages can be added later when they are useful.

Current request flow:

```text
HTTP client -> Fastify API -> route handler -> Prisma Client -> PostgreSQL
```

The database layer is now represented by Prisma.

Current backend structure:

```text
apps/api
  prisma
    migrations
    schema.prisma
  src
    db
      client.ts
    auth
      password.ts
      session.ts
    routes
      admin-access-requests.ts
      access-requests.ts
      auth.ts
    app.ts
    server.ts
```

`src/db/client.ts` exports one shared Prisma client for backend code. Future route modules should import that client instead of constructing their own `PrismaClient` instances.

Prisma dependencies and database scripts live in the root package so the generated client and migration commands are managed once for the monorepo.

The first database models are authentication and access-control foundations:

- `User`
- `AccessRequest`
- `AccessRequestEvent`
- `ApprovedEmail`

Financial data models are intentionally not included yet.

Public access requests are handled by a focused Fastify route module. The route validates and normalizes input before querying Prisma, while `app.ts` remains responsible only for assembling the API.

The public flow makes one internal database decision:

```text
valid input -> registered email -> discarded event
            -> existing/approved request -> discarded event
            -> new email -> pending access request + created event
```

Every branch performs its database write on the server and produces the same public `202` response. There is no internal HTTP request for a browser to observe.

`AccessRequest` represents current state, while `AccessRequestEvent` preserves the history of valid access-related activity. Approval and denial both append administrative events to this history.

Administrative decisions are atomic. Approval records the approved email and event before completing the transaction; denial records its mandatory reason and event. Both remove the pending request in the same transaction.

`AccessRequestEvent.accessRequestId` is an immutable historical reference rather than a foreign-key relation. Creation, approval, and denial events require it, allowing administrative decisions to retain the original request ID after the pending row is deleted. Automatic system discards always leave it null.

Administrative reads and approval live in their own route module. Authentication middleware will be added when the project has a real login/session foundation; until then, these routes are for local development only.

Registration lives in `routes/auth.ts`, while password hashing is isolated in `auth/password.ts` so login can reuse the same Argon2id implementation. Creating the user and consuming the approved email happen atomically in one Prisma transaction.

Login reuses the password module to verify Argon2id hashes. Unknown emails are checked against a precomputed dummy hash so the endpoint follows the same expensive verification path without exposing whether a user exists.

`auth/session.ts` configures an encrypted stateless cookie session through `@fastify/secure-session`. Login stores only `userId`; logout requires that value and deletes the session cookie. Sessions last up to seven days.
