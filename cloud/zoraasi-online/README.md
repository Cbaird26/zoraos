# Cloudflare deployment (no card)

This is the preferred no-card deployment target. Cloudflare Worker secrets hold the
OpenRouter credential and identity configuration. D1 stores only hashed rate-limit and
linked Apple identity keys plus numeric token/cost receipts; prompts and responses are
never persisted.

For a new deployment, create a D1 database and replace the existing `database_id` in
`wrangler.jsonc` with the ID returned for that account.

```bash
npm ci
npx wrangler login
npx wrangler d1 create zoraasi-online
# Put the returned database_id into wrangler.jsonc.
npx wrangler d1 migrations apply zoraasi-online --remote
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put ZORA_APP_USERNAME
npx wrangler secret put ZORA_APP_PASSWORD
npx wrangler deploy
```

Do not pass secret values as command-line arguments or commit them. `wrangler secret put`
prompts privately for each value.

## Business identity login

Google login uses a Web OAuth client for the exact origin
`https://zoraasi-online.zoraasi.workers.dev`. Add its public client ID to the `vars`
section of `wrangler.jsonc` as `GOOGLE_CLIENT_ID`, then install these Worker secrets:

```bash
npx wrangler secret put ZORA_ALLOWED_EMAIL
npx wrangler secret put ZORA_SESSION_SECRET
```

`ZORA_ALLOWED_EMAIL` is the one business Google account allowed to enter.
`ZORA_SESSION_SECRET` must be a new, random value of at least 32 bytes. Google passwords
and access tokens never reach ZoraASI; the Worker accepts only a signed Google ID token
and verifies its signature, issuer, audience, expiry, and exact email.

Sign in with Apple requires a paid Apple Developer membership, an App ID with Sign in
with Apple enabled, a Services ID configured for the Worker domain and callback below,
and a Sign in with Apple private key:

```text
Domain: zoraasi-online.zoraasi.workers.dev
Return URL: https://zoraasi-online.zoraasi.workers.dev/api/auth/apple/callback
```

Configure the public `APPLE_CLIENT_ID` and `ZORA_PUBLIC_APP_URL` variables, then install
`APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` as Worker secrets. Apply the
remote D1 migrations before deploying:

```bash
npm run db:migrate:remote
npx wrangler deploy
```

For the first Apple enrollment, sign in with the approved Google identity or maintenance
password and choose **Link Apple**. Later Apple logins are allowed only for that linked
subject; D1 stores its SHA-256 hash rather than the raw Apple identifier.

Once both identity providers have been verified in production, the maintenance username
and password can be deleted from Worker secrets.
