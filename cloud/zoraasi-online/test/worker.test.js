import assert from "node:assert/strict";
import test from "node:test";

import worker, {
  createAppleClientSecret,
  createSessionToken,
  estimateK3Cost,
  parseBasicAuthorization,
  verifyAppleIdentityToken,
  verifyGoogleCredential,
  verifySessionToken,
} from "../src/index.js";

const base64Url = (value) => Buffer.from(value)
  .toString("base64url");

async function googleFixture(overrides = {}) {
  const now = 2_000_000_000;
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const kid = "zora-google-test-key";
  const header = base64Url(JSON.stringify({ alg: "RS256", kid, typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: "https://accounts.google.com",
    aud: "zora-client-id",
    sub: "google-user-123",
    email: "cardiganincorporated@gmail.com",
    email_verified: true,
    iat: now - 10,
    exp: now + 300,
    ...overrides,
  }));
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keyPair.privateKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  return {
    now,
    token: `${header}.${payload}.${base64Url(signature)}`,
    fetcher: async () => new Response(
      JSON.stringify({ keys: [{ ...jwk, kid, alg: "RS256", use: "sig" }] }),
      { headers: { "Cache-Control": "max-age=300", "Content-Type": "application/json" } },
    ),
  };
}

async function appleFixture(overrides = {}) {
  const now = 2_000_000_100;
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const kid = "zora-apple-test-key";
  const header = base64Url(JSON.stringify({ alg: "RS256", kid, typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: "https://appleid.apple.com",
    aud: "com.cardigan.zoraasi.web",
    sub: "apple-user-456",
    email: "private-relay@example.com",
    nonce: "apple-nonce",
    iat: now - 10,
    exp: now + 300,
    ...overrides,
  }));
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keyPair.privateKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  return {
    now,
    token: `${header}.${payload}.${base64Url(signature)}`,
    fetcher: async () => new Response(
      JSON.stringify({ keys: [{ ...jwk, kid, alg: "RS256", use: "sig" }] }),
      { headers: { "Cache-Control": "max-age=300", "Content-Type": "application/json" } },
    ),
  };
}


test("K3 cloud request estimate stays below the configured ceiling", () => {
  assert.ok(estimateK3Cost(16_000, 800).estimatedCostUsd < 0.08);
});

test("Basic authorization parser rejects malformed values", () => {
  assert.deepEqual(parseBasicAuthorization(`Basic ${btoa("zora:password")}`), ["zora", "password"]);
  assert.equal(parseBasicAuthorization("Bearer token"), null);
  assert.equal(parseBasicAuthorization("Basic not-base64"), null);
});

test("signed sessions round-trip and reject tampering or expiry", async () => {
  const identity = { sub: "google-user-123", email: "cardiganincorporated@gmail.com" };
  const token = await createSessionToken(identity, "test-session-secret", 1000);
  assert.deepEqual(await verifySessionToken(token, "test-session-secret", 1001), identity);
  assert.equal(await verifySessionToken(`${token}x`, "test-session-secret", 1001), null);
  assert.equal(await verifySessionToken(token, "test-session-secret", 1000 + (8 * 60 * 60)), null);
});

test("Google credential verification checks the exact approved identity", async () => {
  const fixture = await googleFixture();
  assert.deepEqual(
    await verifyGoogleCredential(
      fixture.token,
      "zora-client-id",
      "cardiganincorporated@gmail.com",
      fixture.fetcher,
      fixture.now,
    ),
    { sub: "google-user-123", email: "cardiganincorporated@gmail.com" },
  );
  await assert.rejects(
    verifyGoogleCredential(
      fixture.token,
      "zora-client-id",
      "someone@example.com",
      fixture.fetcher,
      fixture.now,
    ),
    /google_token_rejected/u,
  );
});

test("Apple identity verification checks signature, audience, expiry, and nonce", async () => {
  const fixture = await appleFixture();
  assert.deepEqual(
    await verifyAppleIdentityToken(
      fixture.token,
      "com.cardigan.zoraasi.web",
      "apple-nonce",
      fixture.fetcher,
      fixture.now,
    ),
    { sub: "apple-user-456", email: "private-relay@example.com" },
  );
  await assert.rejects(
    verifyAppleIdentityToken(
      fixture.token,
      "com.cardigan.zoraasi.web",
      "wrong-nonce",
      fixture.fetcher,
      fixture.now,
    ),
    /apple_token_rejected/u,
  );
});

test("Apple client secret is an ES256 JWT bound to the configured team, key, and service", async () => {
  const now = 2_000_000_200;
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const privateBytes = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));
  const privateKeyLabel = "PRIVATE KEY";
  const privateKey = [
    `-----BEGIN ${privateKeyLabel}-----`,
    Buffer.from(privateBytes).toString("base64"),
    `-----END ${privateKeyLabel}-----`,
  ].join("\n");
  const token = await createAppleClientSecret({
    APPLE_PRIVATE_KEY: privateKey,
    APPLE_KEY_ID: "APPLEKEY",
    APPLE_TEAM_ID: "APPLETEAM",
    APPLE_CLIENT_ID: "com.cardiganincorporated.zoraasi.web",
  }, now);
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(headerPart, "base64url")), {
    alg: "ES256",
    kid: "APPLEKEY",
  });
  assert.deepEqual(JSON.parse(Buffer.from(payloadPart, "base64url")), {
    iss: "APPLETEAM",
    iat: now,
    exp: now + 300,
    aud: "https://appleid.apple.com",
    sub: "com.cardiganincorporated.zoraasi.web",
  });
  assert.equal(
    await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      keyPair.publicKey,
      Buffer.from(signaturePart, "base64url"),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    ),
    true,
  );
});

test("Apple start uses authorization code flow and a cross-site callback state cookie", async () => {
  const response = await worker.fetch(
    new Request("https://zora.example/api/auth/apple/start", {
      method: "POST",
      headers: { Origin: "https://zora.example" },
    }),
    {
      APPLE_CLIENT_ID: "com.cardigan.zoraasi.web",
      APPLE_TEAM_ID: "TESTTEAM",
      APPLE_KEY_ID: "TESTKEY",
      APPLE_PRIVATE_KEY: "configured-at-exchange-time",
      ZORA_PUBLIC_APP_URL: "https://zora.example",
      ZORA_SESSION_SECRET: "test-session-secret",
      DB: {},
    },
    { waitUntil() {} },
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  const authorizationUrl = new URL(payload.authorizationUrl);
  assert.equal(authorizationUrl.origin, "https://appleid.apple.com");
  assert.equal(authorizationUrl.searchParams.get("response_type"), "code");
  assert.equal(authorizationUrl.searchParams.get("response_mode"), "form_post");
  assert.equal(
    authorizationUrl.searchParams.get("redirect_uri"),
    "https://zora.example/api/auth/apple/callback",
  );
  assert.equal(payload.mode, "login");
  assert.match(response.headers.get("Set-Cookie"), /zora_apple_state=.*SameSite=None/u);
});

test("auth config exposes only public provider configuration and sets CSRF cookie", async () => {
  const response = await worker.fetch(
    new Request("https://zora.example/api/auth/config"),
    {
      GOOGLE_CLIENT_ID: "public-client-id",
      ZORA_ALLOWED_EMAIL: "cardiganincorporated@gmail.com",
      ZORA_SESSION_SECRET: "secret-not-returned",
      ZORA_APP_USERNAME: "maintenance-user",
      ZORA_APP_PASSWORD: "maintenance-password",
    },
    { waitUntil() {} },
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.google, { enabled: true, clientId: "public-client-id" });
  assert.equal(payload.maintenancePassword, true);
  assert.ok(payload.csrfToken.length >= 32);
  assert.match(response.headers.get("Set-Cookie"), /zora_auth_csrf=.*SameSite=Strict/u);
  assert.equal(JSON.stringify(payload).includes("secret-not-returned"), false);
  assert.equal(JSON.stringify(payload).includes("maintenance-password"), false);
});

test("health is public, sanitized, and security-header protected", async () => {
  const response = await worker.fetch(
    new Request("https://zora.example/health"),
    {},
    { waitUntil() {} },
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "ok");
  assert.equal(payload.rag, "not-uploaded");
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
  assert.equal(JSON.stringify(payload).includes("key"), false);
});

test("static assets receive the same security policy as API responses", async () => {
  const response = await worker.fetch(
    new Request("https://zora.example/"),
    {
      ASSETS: {
        async fetch() {
          return new Response("<!doctype html><title>ZoraASI</title>", {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        },
      },
    },
    { waitUntil() {} },
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Security-Policy"), /cdn\.jsdelivr\.net/u);
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
});

test("public status exposes only sanitized model metadata", async () => {
  const db = {
    prepare() {
      return {
        bind() { return this; },
        async first() { return { reserved_usd: 0 }; },
      };
    },
  };
  const response = await worker.fetch(
    new Request("https://zora.example/api/status"),
    { DB: db },
    { waitUntil() {} },
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "ready");
  assert.equal(payload.models.hy3, "google/gemma-4-26b-a4b-it:free");
  assert.equal(JSON.stringify(payload).includes("OPENROUTER_API_KEY"), false);
});
