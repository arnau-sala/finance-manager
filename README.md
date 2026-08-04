# Finance Manager

Backend-first personal finance manager.

## Current Phase

The mobile-first authenticated experience now includes real Home, Moves, Profile,
and Statistics screens. Statistics Overview and Charts use owner-scoped
PostgreSQL aggregations rather than frontend fixtures. A one-time authenticated
setup records the user's timeless starting net worth, or `0` when skipped,
before the app opens. Accounts can be created with a verified email or with a
username and password. Username accounts receive a one-use recovery code and
can later add a verified email or Google without creating a second user. The
mobile frontend currently implements the email flow; username UI is the next
frontend step.

Implemented:

Core:

- `GET /health`
- Initial Vite/React web app scaffold
- Mobile login, password registration, and email verification flow
- API rate limiting for public, authenticated, financial, and administrative routes
- Origin checks for mutating browser requests
- Security headers through Helmet
- Pagination limits for growing list endpoints
- Prisma schema for `User`, `PendingRegistration`, `Category`, and `Transaction`
- Initial SQL migration
- Shared Prisma client module for the API

Authentication:

- `POST /auth/register`
- `POST /auth/register/username`
- `POST /auth/register/resend`
- `POST /auth/register/verify`
- `POST /auth/recovery/password`
- `POST /auth/login`
- `GET /auth/google/start`
- `GET /auth/google/callback`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /account/onboarding/starting-net-worth`
- `PATCH /account`
- `PATCH /account/password`
- `POST /account/recovery-code`
- `POST /account/email/link`
- `POST /account/email/link/resend`
- `POST /account/email/link/verify`
- `POST /account/google/link/start`
- `DELETE /account`
- `POST /account/google/delete/start`

Admin users:

- `GET /admin/users`
- `GET /admin/users/:id`

Categories:

- `GET /categories`

Home:

- `GET /home`

Transactions:

- `GET /transactions`
- `GET /transactions/categories/:category`
- `GET /transactions/:id`
- `POST /transactions`
- `PATCH /transactions/:id`
- `DELETE /transactions/:id`

Statistics:

- `GET /statistics/months`
- `GET /statistics/overview`
- `GET /statistics/charts`
- `GET /statistics/balance`
- `GET /statistics/balance/:month/:year`
- `GET /statistics/balance/:month`
- `GET /statistics/balance/year/:year`
- `GET /statistics/balance/year`
- `GET /statistics/categories`
- `GET /statistics/categories/type/:type`
- `GET /statistics/categories/:month/:year`
- `GET /statistics/categories/:month`
- `GET /statistics/categories/year/:year`
- `GET /statistics/categories/year`
- `GET /statistics/categories/type/:type/:month/:year`
- `GET /statistics/categories/type/:type/:month`
- `GET /statistics/categories/type/:type/year/:year`
- `GET /statistics/categories/type/:type/year`

## Health Endpoint

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
npm run dev:api
```

The API listens on `http://localhost:3001` by default.

Run the frontend:

```bash
npm run dev:web
```

The frontend listens on `http://localhost:5173` by default.

Mutating browser requests must come from an allowed origin. Local development allows common localhost origins by default. In production, configure `ALLOWED_ORIGINS` as a comma-separated list, for example `https://app.example.com,https://www.example.com`.

Frontend product, design, and architecture decisions are tracked in `docs/frontend.md`.
Brevo setup and the complete verification test flow are documented in
[`docs/email-verification.md`](docs/email-verification.md).

## Register

Start password registration:

```http
POST /auth/register
Content-Type: application/json
```

```json
{
  "email": "person@example.com",
  "name": "Alex Morgan",
  "password": "SecurePass1!",
  "passwordConfirmation": "SecurePass1!"
}
```

`name` is required, trimmed, and limited to 100 characters. The two passwords
must match exactly. The password must contain between 9 and 128 characters,
including at least one uppercase letter, one digit, and one special character.

A valid request returns `202 Accepted`:

```json
{
  "message": "If registration can continue, a verification code has been sent."
}
```

This response is deliberately identical when the email already belongs to an
account or a code is still in its resend cooldown. No `User` is created yet.
For a new registration, the API stores the normalized email, name, Argon2id
password hash, and HMAC-protected code in `PendingRegistration`, then asks
Brevo to deliver the code. The six-digit code expires after 10 minutes.

Resend a code after the 60-second cooldown:

```http
POST /auth/register/resend
Content-Type: application/json
```

```json
{
  "email": "person@example.com"
}
```

The resend endpoint returns the same neutral `202` response whether or not a
pending registration exists.

Finish registration:

```http
POST /auth/register/verify
Content-Type: application/json
```

```json
{
  "email": "person@example.com",
  "code": "123456"
}
```

A correct, unexpired code atomically consumes the pending registration,
creates the `PASSWORD` user, marks the email as verified, and starts a secure
session. It returns `201 Created` with `Account created successfully.` and the
new user's public fields. A wrong or expired code returns the same `400`
response; after five failed attempts a new code must be requested.

Configure Brevo and the code-signing secret in `apps/api/.env` using
[`apps/api/.env.example`](apps/api/.env.example) as the template. These values
must exist only on the API server:

```env
BREVO_API_KEY=<brevo-api-key>
BREVO_SENDER_EMAIL=<verified-brevo-sender-email>
BREVO_SENDER_NAME=Finance Manager
EMAIL_VERIFICATION_SECRET=<64-character-hex-secret>
```

If Brevo or its configuration is unavailable, code issuance returns `503` and
the database change is rolled back so an undelivered code cannot block the
next attempt.

### Register With A Username

A user can create an account without an email:

```http
POST /auth/register/username
Content-Type: application/json
```

```json
{
  "username": "alex.morgan",
  "name": "Alex Morgan",
  "password": "SecurePass1!",
  "passwordConfirmation": "SecurePass1!"
}
```

Usernames are normalized to lowercase, contain 3 to 30 characters, and may use
letters, digits, dots, hyphens, and underscores. They must start and end with a
letter or digit, and reserved system names are rejected. The display `name`
remains separate and continues to be used as the person's visible name.

Successful registration immediately creates the account and secure session.
The response also contains a 128-bit recovery code such as
`7C93-2C02-1FE8-885B-669D-E52A-EA0A-C6D1`. It is returned in plaintext only
once; the database stores only its SHA-256 hash. The client must require the
user to store it before continuing.

## Login

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "identifier": "user@example.com",
  "password": "SecurePass1!"
}
```

`identifier` accepts either a normalized email or username. The legacy
`email` field remains temporarily accepted so the existing frontend continues
to work while its login UI is migrated.

Valid credentials for an approved user return:

```json
{
  "message": "Login successful."
}
```

Unknown identifiers, incorrect passwords, and suspended users receive the same
`401 Unauthorized` response. Successful login creates a secure cookie session.

## Recover A Username Account

The recovery code replaces a forgotten password without relying on email:

```http
POST /auth/recovery/password
Content-Type: application/json
```

```json
{
  "username": "alex.morgan",
  "recoveryCode": "7C93-2C02-1FE8-885B-669D-E52A-EA0A-C6D1",
  "newPassword": "DifferentPass2!",
  "newPasswordConfirmation": "DifferentPass2!"
}
```

A valid recovery atomically consumes the submitted code, changes the password,
increments `sessionVersion`, starts a new session, and returns a replacement
recovery code. The old code can never be reused. Invalid usernames and codes
share the same `401` response. An authenticated username account can explicitly
replace its code with `POST /account/recovery-code` and its current password.

## Link An Email

An authenticated account created with a username can add a normal verified
email without losing username login:

```http
POST /account/email/link
Content-Type: application/json

{ "email": "person@example.com" }
```

The API sends a six-digit code with the same 10-minute expiry, five-attempt
limit, 60-second resend cooldown, neutral responses, and Brevo delivery
rollback used by registration. Resend with `POST /account/email/link/resend`
and verify with:

```http
POST /account/email/link/verify
Content-Type: application/json

{ "code": "123456" }
```

Verification assigns the email to the existing user and records
`emailVerifiedAt`; it never creates a second account. Email and username can
then both be used as the login identifier. Alternatively,
`POST /account/google/link/start` can link Google; for an account without an
email, Google's verified address becomes its email and both password and
Google authentication remain available.

## Continue With Google

Google sign-in starts from the browser:

```http
GET /auth/google/start
```

The backend redirects the user to Google using OAuth 2.0 / OpenID Connect. Google redirects back to:

```http
GET /auth/google/callback
```

The backend verifies the Google ID token with the configured client ID before
trusting the email. An existing `GOOGLE` or `PASSWORD_AND_GOOGLE` account starts
the normal secure session only when Google's stable subject matches. If no user
has that email, the callback creates a verified `GOOGLE` user immediately and
starts its session; no approval or email-code step is needed because Google has
already verified ownership of the address.

If the email belongs to a password-only account, public Google sign-in does not
silently link it. The frontend receives `googleAuth=password-required`; the
owner must sign in with their password and use the authenticated linking flow.
Other identity conflicts fail without changing the database.

Local Google configuration requires these values in `apps/api/.env`:

```env
WEB_APP_URL=http://localhost:5173
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/google/callback
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
```

The Google Cloud OAuth client must include the exact `GOOGLE_REDIRECT_URI` as an authorized redirect URI.

An authenticated password account can add Google as a second sign-in method:

```http
POST /account/google/link/start
```

The endpoint returns a Google authorization URL and preserves the active
session. For an account with an email, the shared callback requires Google's
verified email to match it exactly. For a username-only account, the selected
verified Google email becomes its first email. In both cases the one-use
link-specific OAuth `state` must be valid and the Google `sub` and email must
not belong to another user. Success keeps the password hash, stores the Google
subject, and changes `authProvider` to `PASSWORD_AND_GOOGLE`.

## Logout

```http
POST /auth/logout
```

The request must include the session cookie created by login. A valid logout returns:

```json
{
  "message": "Logout successful."
}
```

Calling logout without an active session returns `401 Unauthorized`:

```json
{
  "error": "No active session."
}
```

## List Users

An active session for a user with role `ADMIN` is required:

```http
GET /admin/users
```

A successful request returns users ordered by creation date, newest first:

```json
{
  "users": [
    {
      "id": "user-id",
      "email": "user@example.com",
      "name": "Alex Morgan",
      "role": "USER",
      "status": "APPROVED",
      "createdAt": "2026-07-05T18:30:00.000Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "nextOffset": null
  }
}
```

Supports `limit` and `offset`. Default `limit` is `50`; maximum is `100`. Use `nextOffset` as the next `offset` value; `null` means there are no more results.

Requests without a valid session return `401 Unauthorized`. Authenticated users without role `ADMIN` receive `403 Forbidden` with `{"error":"Administrator access required."}`.

## Get User

An active session for a user with role `ADMIN` and a valid user CUID are required:

```http
GET /admin/users/:id
```

A successful request returns the same public fields as the user list:

```json
{
  "user": {
    "id": "cmr81aoib0000kzsowdqjw84x",
    "email": "user@example.com",
    "name": "Alex Morgan",
    "role": "USER",
    "status": "APPROVED",
    "createdAt": "2026-07-05T18:30:00.000Z"
  }
}
```

An invalid ID format returns `400 Bad Request`. A valid CUID without a matching user returns `404 Not Found`.

## Get Current User

An active session is required:

```http
GET /auth/me
```

The endpoint returns the public information for the user represented by the current session:

```json
{
  "user": {
    "id": "cmr81aoib0000kzsowdqjw84x",
    "email": "user@example.com",
    "name": "Alex Morgan",
    "authProvider": "PASSWORD",
    "role": "USER",
    "status": "APPROVED",
    "startingNetWorth": null,
    "createdAt": "2026-07-05T18:30:00.000Z",
    "updatedAt": null
  }
}
```

`updatedAt` is `null` until the user is modified for the first time. A request without a valid session returns `401 Unauthorized` with `{"error":"Authentication required."}`.

## Set Starting Net Worth

After the first authenticated entry, the web app blocks access to the main
interface until this setup step is completed or skipped. The endpoint always
derives the account from the encrypted session and accepts one of two strict
actions.

Save the amount:

```http
POST /account/onboarding/starting-net-worth
Content-Type: application/json
```

```json
{
  "action": "SET",
  "amount": "22450.00"
}
```

The amount may be positive, zero, or negative, is limited to the range
`-10,000,000` through `10,000,000`, and accepts at most two decimal places. The
server records it in integer cents as a timeless profile value. It is not a
transaction or a dated snapshot: current and historical net worth calculations
add it to the relevant accumulated transaction flow.

Skip and start calculations from zero:

```json
{
  "action": "SKIP"
}
```

Before the step is handled, `startingNetWorth` is `null`. Saving stores the
provided amount; skipping stores `0`. The same endpoint can replace the value
later, and sending `SKIP` resets it to zero without changing or deleting any
transaction.

## Update Current User

Only the user represented by the active session can update their profile. The
endpoint does not accept a user ID or email:

```http
PATCH /account
Content-Type: application/json
```

```json
{
  "name": "Alex Morgan",
  "startingNetWorth": "22450.50"
}
```

Either field can be sent independently, or both can be updated together. At
least one is required. The name is trimmed and must contain between 1 and 100
characters, using the same validation as registration. `startingNetWorth`
shares the setup range and decimal validation and replaces only the timeless
profile baseline. Empty bodies, invalid values, unknown fields, and attempts to
include `email` return `400 Bad Request`. A successful update returns `200 OK`
with `Profile updated successfully.` and the updated public user object.

## Change Password

Only an authenticated account with password access (`PASSWORD` or
`PASSWORD_AND_GOOGLE`) can change its password:

```http
PATCH /account/password
Content-Type: application/json
```

```json
{
  "currentPassword": "Current-password1!",
  "newPassword": "New-password2!",
  "newPasswordConfirmation": "New-password2!"
}
```

The new password must contain 9 to 128 characters, at least one uppercase letter, one digit, and one special character. Both new-password fields must match, and the new password must differ from the current password.

An incorrect current password returns `401 Unauthorized` with `{"error":"Incorrect current password."}`. Google accounts receive `400 Bad Request` because their credentials are managed by Google. A successful change returns:

```json
{
  "message": "Password changed successfully."
}
```

Success rotates the current encrypted cookie and invalidates every other session for the account. The endpoint is limited to 5 attempts every 15 minutes per session or IP.

## Delete Account

Only the currently authenticated owner can delete their account. The endpoint does not accept a user ID:

```http
DELETE /account
Content-Type: application/json
```

```json
{
  "password": "SecurePass1!"
}
```

For accounts with password access, including linked accounts, an incorrect password returns `401 Unauthorized` with `{"error":"Incorrect password."}`. Google-only accounts require fresh Google reauthentication, while linked accounts can choose it instead of password confirmation. The browser flow starts with:

```http
POST /account/google/delete/start
```

The backend preserves the active session while Google presents its account chooser. The shared Google callback deletes a `GOOGLE` or `PASSWORD_AND_GOOGLE` account only when Google's verified email and stable `sub` identifier both match the currently authenticated user. Selecting another Google account returns to the profile without deleting data and allows the user to retry with the session email.

A successful deletion returns the password endpoint response below or redirects the Google flow to the public app screen:

```json
{
  "message": "Account deleted successfully."
}
```

Deletion is atomic and permanent. It removes the user, all owned transactions,
and any matching pending registration. The current session is deleted after
the database transaction succeeds.

## List Categories

An active login session is required:

```http
GET /categories
```

Use `GET /categories?type=EXPENSE` or `GET /categories?type=INCOME` to filter the catalog. Each category contains the stable `id` required by transaction creation and editing:

```json
{
  "categories": [
    {
      "id": "expense-groceries",
      "name": "Groceries",
      "type": "EXPENSE"
    }
  ]
}
```

## List My Transactions

An active session is required:

```http
GET /transactions
```

The endpoint returns only transactions owned by the current session user, including when that user has role `ADMIN`. Results are ordered by transaction date, newest first:

```json
{
  "transactions": [
    {
      "id": "transaction-id",
      "type": "EXPENSE",
      "categoryId": "expense-groceries",
      "category": {
        "id": "expense-groceries",
        "name": "Groceries",
        "type": "EXPENSE"
      },
      "amount": "42.50",
      "description": "Weekly groceries",
      "date": "2026-07-05",
      "createdAt": "2026-07-05T16:31:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "nextOffset": null,
    "total": 1
  },
  "metadata": {
    "accountTransactionCount": 1,
    "minimumDate": "2026-07-05"
  }
}
```

Supports `limit` and `offset`; the default page size is `20` and the maximum is
`200`. `nextOffset` is the next page position, `total` is the number of matching
records, and `null` means there are no more results. First-page responses also
include the account's unfiltered transaction count and oldest transaction date;
later pages return `metadata: null`.

The same request can combine `search`, `type`, comma-separated `categories`,
`exactAmountCents` or an amount-cent range, and `exactDate` or a
`startDate`/`endDate` range. Filtering is owner-scoped and performed in
PostgreSQL before pagination. A user without transactions receives an empty
array, and a request without a valid session returns `401 Unauthorized`.

## List My Transactions By Category

An active session is required:

```http
GET /transactions/categories/:category
```

`:category` is the category ID, for example `income-salary` or `expense-housing`. The endpoint returns only transactions owned by the current session user and assigned to that category:

```json
{
  "transactions": [
    {
      "id": "transaction-id",
      "type": "EXPENSE",
      "categoryId": "expense-housing",
      "category": {
        "id": "expense-housing",
        "name": "Housing",
        "type": "EXPENSE"
      },
      "amount": "850.00",
      "description": "Rent",
      "date": "2026-07-01",
      "createdAt": "2026-07-01T08:01:00.000Z"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "nextOffset": null
  }
}
```

Supports `limit` and `offset`. Default `limit` is `100`; maximum is `200`. A category without matching transactions returns an empty `transactions` array. Administrators receive no ownership bypass.

## Get My Transaction

An active session is required:

```http
GET /transactions/:id
```

The endpoint returns the requested transaction and the derived information used
by its detail sheet only when it belongs to the current session user:

```json
{
  "transaction": {
    "id": "transaction-id",
    "type": "EXPENSE",
    "categoryId": "expense-groceries",
    "category": {
      "id": "expense-groceries",
      "name": "Groceries",
      "type": "EXPENSE"
    },
    "amount": "42.50",
    "description": "Weekly groceries",
    "date": "2026-07-05",
    "createdAt": "2026-07-05T16:31:00.000Z"
  },
  "trackedBalance": {
    "before": "1000.00",
    "after": "957.50"
  },
  "contexts": {
    "month": {
      "categoryRank": {
        "position": 2,
        "total": 5
      },
      "typeRank": {
        "position": 8,
        "total": 31
      },
      "periodImpactPercentage": 7
    },
    "year": {
      "categoryRank": {
        "position": 5,
        "total": 42
      },
      "typeRank": {
        "position": 24,
        "total": 214
      },
      "periodImpactPercentage": 0.8
    },
    "all": {
      "categoryRank": {
        "position": 14,
        "total": 126
      },
      "typeRank": {
        "position": 63,
        "total": 642
      },
      "periodImpactPercentage": 0.3
    }
  }
}
```

Month and year contexts are derived from the transaction's own calendar date.
Ranks order higher amounts first; equal amounts use transaction date, creation
timestamp, and ID as deterministic tie-breakers. Period impact is the
transaction amount divided by all income or all expenses, according to its
type, in that context. Positive impacts below `1%` are returned with one decimal
and never collapse to `0%`; impacts of at least `1%` are rounded to whole
percentages.

`trackedBalance` is calculated from registered transactions ordered by
transaction date, creation timestamp, and ID. It intentionally remains a
transaction-ledger value that starts at zero, so it must not be interpreted as
the user's full real-world wealth. Actual net worth is exposed separately and
includes the configured starting value.

All derived values are produced in the same database statement, so switching
between Month, Year, and All in the interface requires no additional request. A
missing transaction and one owned by another user both return `404 Not Found`
with `{"error":"Transaction not found."}`. Administrators receive no ownership
bypass.

The detail sheet can share a compact text summary through the device's native
share sheet. The message contains only the transaction type, description,
signed amount, category, and date. It is built locally from the already loaded
transaction and does not require another API request; browsers without Web
Share support copy the same text to the clipboard.

## Create Transaction

An active login session is required:

```http
POST /transactions
Content-Type: application/json
```

```json
{
  "type": "EXPENSE",
  "categoryId": "expense-groceries",
  "description": "Weekly groceries",
  "amount": "42.50",
  "date": "2026-07-05"
}
```

`type` must be `INCOME` or `EXPENSE`. `categoryId` is required and must reference a category of the same type. `description` is required and limited to 50 characters. `amount` must be positive with at most two decimal places; sending it as a string is recommended for exact decimal input. `date` is an optional calendar date in `YYYY-MM-DD` format and defaults to the server's current calendar date. Times and timezone offsets are rejected.

The backend obtains `userId` exclusively from the session and stores the amount as integer cents. The transaction day is stored as PostgreSQL `DATE`, while `createdAt` independently records the exact creation timestamp. Transaction responses include the selected category's ID, name, and type.

## Delete Transaction

An active login session is required, and the transaction must belong to that user:

```http
DELETE /transactions/:id
```

A successful deletion returns `200 OK`:

```json
{
  "message": "Transaction deleted."
}
```

An unknown transaction ID and a transaction owned by another user both return the same `404 Not Found` response:

```json
{
  "error": "Transaction not found."
}
```

The authenticated interface confirms this irreversible action in a compact
popover anchored below the transaction's Delete control. A successful deletion
closes the detail sheet, clears private financial caches, and refreshes Home,
Moves, and Stats.

## Update Transaction

An active login session is required, and the transaction must belong to that user:

```http
PATCH /transactions/:id
Content-Type: application/json
```

Send only the fields that must change. All fields are optional, and an empty object is accepted:

```json
{
  "categoryId": "expense-dining",
  "description": "Updated description",
  "amount": "35.20"
}
```

The available fields and validation rules are the same as for transaction creation. Required values cannot be cleared, so values such as an empty `description` are rejected. The resulting category must match the resulting transaction type; changing between `INCOME` and `EXPENSE` therefore requires a compatible `categoryId`. A successful edit returns `200 OK` with `{"message":"Transaction updated."}`. Missing and foreign-owned transaction IDs return the same `404` response used by deletion.

The authenticated interface opens the shared transaction composer from the
detail sheet, prefilled with the current values. It sends only changed fields,
then invalidates the owner-scoped Home, transaction, detail, and Statistics
queries. Visible cached data remains in place while the derived aggregates
revalidate.

## Get Home Overview

An active login session is required:

```http
GET /home
```

The endpoint provides the authenticated user's Home data in one response: the all-time balance, up to three newest transactions, and activity for the server's current calendar month. It never accepts a user ID from the client.

```json
{
  "balance": {
    "totalIncome": "1500.00",
    "totalSpent": "420.50",
    "totalBalance": "1079.50",
    "currentNetWorth": "23529.50"
  },
  "latestMoves": [
    {
      "id": "transaction-id",
      "type": "EXPENSE",
      "category": {
        "id": "expense-groceries",
        "name": "Groceries",
        "type": "EXPENSE"
      },
      "amount": "42.80",
      "description": "Weekly groceries",
      "date": "2026-07-17"
    }
  ],
  "activity": {
    "month": 7,
    "year": 2026,
    "transactionCount": 4,
    "topExpenseCategory": {
      "id": "expense-groceries",
      "name": "Groceries"
    },
    "topIncomeCategory": null
  }
}
```

`totalBalance` remains tracked cash flow (`income - expenses`).
`currentNetWorth` is the timeless starting net worth plus all transactions
through today, or `null` while the initial setup is still pending. Users without
transactions receive zero cash-flow values, their configured starting net
worth, an empty `latestMoves` array, a transaction count of `0`, and null top
categories.

## Get My Available Statistics Months

An active login session is required:

```http
GET /statistics/months
```

The endpoint returns the distinct months that contain at least one transaction
owned by the current user. Future transactions are excluded, and neither
transactions nor `userId` values are exposed:

```json
{
  "availableMonths": ["2026-04", "2026-06", "2026-07"],
  "minimumMonth": "2026-04",
  "maximumMonth": "2026-07"
}
```

`minimumMonth` is `null` when the account has no transactions.
`maximumMonth` is always the current calendar month.

## Get My Statistics Overview

An active login session is required. The endpoint accepts one of three periods:

```http
GET /statistics/overview
GET /statistics/overview?period=month&month=2026-07
GET /statistics/overview?period=year&year=2026
GET /statistics/overview?period=all
```

Without query parameters it uses the current month. Future months and years are
rejected. The response is designed for the numeric Stats view and contains:

- income, expenses, balance, and saved percentage;
- category amount, percentage, transaction count, and average;
- largest movements, including the transaction previews used to open their
  authenticated detail sheets, and monthly/yearly insights where applicable;
- median expense, period average, and no-spend streaks. The current streak is
  returned only for the current month, current year, and All. Both the current
  and longest streak are historical, so they remain identical across those
  three current-period views. Streak tracking begins with the first expense;
  when no expense has ever been recorded, the UI omits the Expenses section.

Best/Worst month or year pairs are omitted when fewer than two comparable
periods contain income, avoiding duplicate insights with no comparative value.

All calculations use only transactions owned by the authenticated user. Empty
periods return zero values and empty category collections. Money is calculated
in integer cents and exposed as decimal strings. Representative response
excerpt:

```json
{
  "overview": {
    "period": {
      "mode": "MONTH",
      "key": "2026-07",
      "startDate": "2026-07-01",
      "endDate": "2026-07-27"
    },
    "money": {
      "income": "1380.00",
      "expenses": "2534.50",
      "balance": "-1154.50",
      "savingsPercentage": -84
    }
  }
}
```

## Get My Statistics Charts

Charts use the same period query:

```http
GET /statistics/charts
GET /statistics/charts?period=month&month=2026-07
GET /statistics/charts?period=year&year=2026
GET /statistics/charts?period=all
```

The response returns chart-neutral financial series rather than ECharts
configuration. It includes shared income/expense/balance intervals, category
totals, category-by-interval cells, and seven weekday spending aggregates.
The combined Cash Flow chart renders income, expenses, and balance from that
single financial series, while Category Breakdown and Category Timeline use one
common category aggregation.

Net Worth Evolution returns daily closing points for Month and Year, and
month-end points for All. Every point starts from the stored starting net worth
and applies all transaction flow accumulated through that point. If setup is
still pending, the API returns `status: "OPENING_BALANCE_REQUIRED"` and no
points. Skipping stores a zero baseline, so the chart can still represent the
user's complete recorded transaction history.

Both aggregate endpoints derive ownership from the secure session, never accept
`userId`, exclude dates after today, and send `Cache-Control: private, no-store`.

## Get My Balance

An active login session is required:

```http
GET /statistics/balance
```

The endpoint sums only the transactions owned by the current session user. Administrators receive their own balance, not a global balance:

```json
{
  "balance": {
    "totalIncome": "1500.00",
    "totalSpent": "420.50",
    "totalBalance": "1079.50"
  }
}
```

`totalBalance` is calculated as income minus expenses. A user without transactions receives zero values. A request without a valid session returns `401 Unauthorized`.

## Get My Monthly Balance

An active login session is required:

```http
GET /statistics/balance/:month/:year
```

`month` must be a number from `1` to `12`. `year` must be a number from `2000` to the current year. The year can be omitted, in which case the API uses the current year:

```http
GET /statistics/balance/6
```

Example:

```http
GET /statistics/balance/6/2026
```

Expected response:

```json
{
  "balance": {
    "totalIncome": "1000.00",
    "totalSpent": "250.00",
    "totalBalance": "750.00"
  }
}
```

The endpoint only sums transactions owned by the current session user and returns zero values when there are no transactions in that month.

## Get My Yearly Balance

An active login session is required:

```http
GET /statistics/balance/year/:year
```

`year` must be a number from `2000` to the current year. The year can be omitted, in which case the API uses the current year:

```http
GET /statistics/balance/year
```

Example:

```http
GET /statistics/balance/year/2026
```

Expected response:

```json
{
  "balance": {
    "totalIncome": "12000.00",
    "totalSpent": "3600.00",
    "totalBalance": "8400.00"
  }
}
```

The endpoint only sums transactions owned by the current session user and returns zero values when there are no transactions in that year.

## Get My Category Percentages

An active login session is required:

```http
GET /statistics/categories
```

Use a type path parameter to return only one transaction type:

```http
GET /statistics/categories/type/expense
GET /statistics/categories/type/income
```

Use a numeric month and year to calculate category percentages only for that month:

```http
GET /statistics/categories/:month/:year
```

The year can be omitted, in which case the API uses the current year:

```http
GET /statistics/categories/6
```

Use the yearly endpoints to calculate category percentages for a full calendar year:

```http
GET /statistics/categories/year/:year
GET /statistics/categories/year
```

Use `income` or `expense` after the fixed `type` segment to combine transaction type and period filters:

```http
GET /statistics/categories/type/expense/:month/:year
GET /statistics/categories/type/income/:month/:year
GET /statistics/categories/type/expense/:month
GET /statistics/categories/type/income/:month
GET /statistics/categories/type/expense/year/:year
GET /statistics/categories/type/income/year/:year
GET /statistics/categories/type/expense/year
GET /statistics/categories/type/income/year
```

The endpoint returns only categories that have at least one transaction for the current user. Percentages are calculated within each transaction type, so expense categories add up to `100` and income categories add up to `100` independently:

```json
{
  "categories": [
    {
      "category": "Groceries",
      "type": "EXPENSE",
      "percentage": 34
    },
    {
      "category": "Transport",
      "type": "EXPENSE",
      "percentage": 33
    },
    {
      "category": "Housing",
      "type": "EXPENSE",
      "percentage": 33
    }
  ]
}
```

Percentages are whole numbers and are adjusted so each returned type totals exactly `100`. Empty types or periods return an empty list.

## Database

The API reads development configuration from `apps/api/.env`.

Required values:

```env
NODE_ENV=development
PORT=3001
SESSION_KEY=<64-character-hexadecimal-key>
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/finance_manager?schema=public"
WEB_APP_URL=http://localhost:5173
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/google/callback
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
```

Generate Prisma Client:

```bash
npm run db:generate
```

Apply migrations after PostgreSQL is running:

```bash
npm run db:migrate
```

`CONTEXT.md` and `apps/api/.env` are local-only files and are ignored by Git.
