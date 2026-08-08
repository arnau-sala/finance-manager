# Email Verification

## Provider

Password registrations use the Brevo transactional email API. The API sends a
six-digit code from backend code only; the Brevo key is never sent to the web
application.

Brevo's Free plan currently includes 300 email sends per day. This is enough
for local development and a small MVP, but unused sends do not roll over.

Official references:

- [Create a Brevo API key](https://developers.brevo.com/docs/api-key-authentication)
- [Create and verify a sender](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email)
- [Send a transactional email](https://developers.brevo.com/docs/send-a-transactional-email)
- [Brevo Free plan](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans)

## Brevo Setup

1. Create or sign in to a Brevo account.
2. Confirm that the transactional email platform is activated for the account.
3. Open `Settings -> Senders, Domains & Dedicated IPs -> Senders` and add a
   sender named `Finance Manager`.
4. Use an email address that you control and complete Brevo's sender
   verification. For production, authenticate a custom sending domain with
   DKIM and DMARC instead of relying on a free-mail domain.
5. Open `SMTP & API -> API Keys`, generate a v3 API key with a descriptive
   name, and copy it immediately. Brevo displays it only once.

Brevo does not create an inbox for the application. For initial testing, an
existing address that you can verify is sufficient. A production address such
as `no-reply@your-domain.com` requires owning that domain and configuring the
mailbox or forwarding separately.

## API Environment

Copy the missing values from `apps/api/.env.example` into the ignored
`apps/api/.env` file:

```env
BREVO_API_KEY=<generated-v3-api-key>
BREVO_SENDER_EMAIL=<exact-verified-sender-address>
BREVO_SENDER_NAME=Finance Manager
EMAIL_VERIFICATION_SECRET=<64-character-hex-secret>
```

Generate the independent verification secret locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Do not reuse `SESSION_KEY`, expose either secret through Vite variables, or
commit `apps/api/.env`. Restart the API after changing environment variables.

## Registration Contract

Start registration:

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

The expected response is `202 Accepted`. Retrieve the code from the recipient
inbox, then verify it:

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

The expected response is `201 Created`. It also creates the secure session
cookie, so Postman's cookie jar can immediately call `GET /auth/me`. The web
frontend must use credentials-enabled requests for the same reason.

Request another code only after the 60-second cooldown:

```http
POST /auth/register/resend
Content-Type: application/json
```

```json
{
  "email": "person@example.com"
}
```

Codes expire after 10 minutes. Five failed verification attempts invalidate
the current code. Starting or resending registration always uses a neutral
`202` response when the input is valid, so it does not reveal whether an email
already has an account.

## Link Email Sign-In To An Account

The same Brevo configuration supports authenticated accounts that do not yet
have email/password sign-in. Username-only accounts start with an `email` body.
Google-only accounts submit matching new-password fields and verify Google's
existing address. Username-and-Google accounts submit an empty body because
both the address and password already exist. Resend with
`POST /account/email/link/resend`, submit the six-digit code to
`POST /account/email/link/verify`, and cancel an unfinished flow with
`DELETE /account/email/link`.

This flow has its own pending table and HMAC scope, so a registration code
cannot be reused as an account-link code. Google-only password creation is
stored only as a pending Argon2id hash. Verification updates the current
`User`, preserves every existing credential, and enables email login. It does
not create a second account.

An address already assigned to another account receives an informational
security notice instead of a verification code. The message never identifies
the requester, and a persistent 24-hour per-owner cooldown prevents repeated
delivery. Both outcomes return the same timing-normalized neutral `202`
response, so callers cannot use this endpoint to enumerate accounts.

## Failure Behavior

Missing Brevo configuration returns `503 Email verification is not
configured.` A rejected or timed-out delivery returns `503 Verification email
could not be sent. Please try again.` In both cases, registration does not
create a user; failed delivery also rolls back the pending code.

Brevo delivery activity and rejection details remain available in the Brevo
transactional logs. Never return provider payloads or credentials to the
client.
