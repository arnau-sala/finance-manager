# Finance Manager

Backend-first personal finance manager.

## Phase 1

The current goal is to initialize the API project and expose a working health endpoint.

```http
GET /health
```

Expected response:

```json
{
  "status": "ok"
}
```

## Run the API

Node.js and npm are required.

```bash
npm install
npm run dev --workspace apps/api
```

The API listens on `http://localhost:3001` by default.

