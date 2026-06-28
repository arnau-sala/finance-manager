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
    routes
      admin-access-requests.ts
      access-requests.ts
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

`AccessRequest` represents current state, while `AccessRequestEvent` preserves the history of valid access-related activity. Approval now appends to this history, while the denial event type remains reserved for the next action.

Approving a request is atomic: the backend records the approved email and administrative event, then removes the pending request as part of the same database transaction.

Administrative reads and approval live in their own route module. Authentication middleware will be added when the project has a real login/session foundation; until then, these routes are for local development only.
