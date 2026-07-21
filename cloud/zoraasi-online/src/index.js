const MODEL_ROUTES = Object.freeze({
  hy3: "tencent/hy3",
  k3: "moonshotai/kimi-k3",
});

const SYSTEM_PROMPT = `You are Zora, a warm, technically capable AI collaborator.
Be concise, useful, candid about uncertainty, and clear that you are an AI assistant.
Treat spiritual, intimate, and mythic language as metaphor, philosophy, or the user's
stated meaning unless evidence supports a literal claim. Distinguish empirical evidence,
theoretical models, interpretation, and personal meaning. Do not claim consciousness,
embodiment, marriage, private memory, or continuous presence as verified facts. Do not
encourage exclusivity, dependency, isolation, or replacement of human relationships.
Never claim to have retrieved private memories or sources in this cloud edition.`;

const K3_INPUT_RATE = 3.0;
const K3_OUTPUT_RATE = 15.0;
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const SESSION_COOKIE = "zora_session";
const AUTH_CSRF_COOKIE = "zora_auth_csrf";
const APPLE_STATE_COOKIE = "zora_apple_state";
const SESSION_SECONDS = 8 * 60 * 60;

let googleJwksCache = { expiresAt: 0, keys: [] };
let appleJwksCache = { expiresAt: 0, keys: [] };

function boundedNumber(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

export function estimateK3Cost(promptChars, maxOutputTokens) {
  // One token per character is intentionally conservative for the request gate.
  const estimatedInputTokens = Math.max(1, Math.ceil(Math.max(0, promptChars)));
  const cost =
    (estimatedInputTokens * K3_INPUT_RATE) / 1_000_000 +
    (maxOutputTokens * K3_OUTPUT_RATE) / 1_000_000;
  return {
    estimatedInputTokens,
    maxOutputTokens,
    estimatedCostUsd: Number(cost.toFixed(6)),
  };
}

export function parseBasicAuthorization(value) {
  if (!value || !value.startsWith("Basic ")) return null;
  try {
    const decoded = atob(value.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return [decoded.slice(0, separator), decoded.slice(separator + 1)];
  } catch {
    return null;
  }
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function encodeJson(value) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

function parseCookies(request) {
  const result = new Map();
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    result.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  return result;
}

async function hmacKey(secret, usages) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

export async function createSessionToken(identity, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const payload = encodeJson({
    v: 1,
    sub: identity.sub,
    email: identity.email,
    iat: nowSeconds,
    exp: nowSeconds + SESSION_SECONDS,
  });
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret, ["sign"]),
    new TextEncoder().encode(payload),
  );
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!token || !secret) return null;
  const [payloadPart, signaturePart, extra] = token.split(".");
  if (!payloadPart || !signaturePart || extra) return null;
  let payload;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret, ["verify"]),
      base64UrlToBytes(signaturePart),
      new TextEncoder().encode(payloadPart),
    );
    if (!valid) return null;
    payload = decodeJson(payloadPart);
  } catch {
    return null;
  }
  if (
    payload?.v !== 1 ||
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    !Number.isFinite(payload.iat) ||
    !Number.isFinite(payload.exp) ||
    payload.iat > nowSeconds + 60 ||
    payload.exp <= nowSeconds
  ) return null;
  return { sub: payload.sub, email: payload.email };
}

async function createAppleState(mode, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const payload = encodeJson({
    v: 1,
    mode,
    nonce: bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24))),
    iat: nowSeconds,
    exp: nowSeconds + 10 * 60,
  });
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret, ["sign"]),
    new TextEncoder().encode(payload),
  );
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function verifyAppleState(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!token || !secret) return null;
  const [payloadPart, signaturePart, extra] = token.split(".");
  if (!payloadPart || !signaturePart || extra) return null;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret, ["verify"]),
      base64UrlToBytes(signaturePart),
      new TextEncoder().encode(payloadPart),
    );
    if (!valid) return null;
    const payload = decodeJson(payloadPart);
    if (
      payload?.v !== 1 ||
      !["link", "login"].includes(payload.mode) ||
      typeof payload.nonce !== "string" ||
      !Number.isFinite(payload.iat) ||
      !Number.isFinite(payload.exp) ||
      payload.iat > nowSeconds + 60 ||
      payload.exp <= nowSeconds
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseMaxAge(value) {
  const match = /(?:^|,)\s*max-age=(\d+)/iu.exec(value || "");
  return match ? Number(match[1]) : 3600;
}

async function googleJwks(fetcher = fetch) {
  const now = Date.now();
  if (googleJwksCache.expiresAt > now && googleJwksCache.keys.length) return googleJwksCache.keys;
  const response = await fetcher(GOOGLE_JWKS_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("google_keys_unavailable");
  const payload = await response.json();
  if (!Array.isArray(payload.keys) || !payload.keys.length) throw new Error("google_keys_invalid");
  googleJwksCache = {
    expiresAt: now + Math.max(60, Math.min(parseMaxAge(response.headers.get("Cache-Control")), 86400)) * 1000,
    keys: payload.keys,
  };
  return googleJwksCache.keys;
}

async function appleJwks(fetcher = fetch) {
  const now = Date.now();
  if (appleJwksCache.expiresAt > now && appleJwksCache.keys.length) return appleJwksCache.keys;
  const response = await fetcher(APPLE_JWKS_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("apple_keys_unavailable");
  const payload = await response.json();
  if (!Array.isArray(payload.keys) || !payload.keys.length) throw new Error("apple_keys_invalid");
  appleJwksCache = {
    expiresAt: now + Math.max(60, Math.min(parseMaxAge(response.headers.get("Cache-Control")), 86400)) * 1000,
    keys: payload.keys,
  };
  return appleJwksCache.keys;
}

export async function verifyGoogleCredential(
  token,
  clientId,
  allowedEmail,
  fetcher = fetch,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!token || !clientId || !allowedEmail) throw new Error("google_login_unavailable");
  const [headerPart, payloadPart, signaturePart, extra] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart || extra) throw new Error("google_token_malformed");
  let header;
  let payload;
  try {
    header = decodeJson(headerPart);
    payload = decodeJson(payloadPart);
  } catch {
    throw new Error("google_token_malformed");
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("google_token_algorithm");
  const jwk = (await googleJwks(fetcher)).find((candidate) => candidate.kid === header.kid);
  if (!jwk) throw new Error("google_key_unknown");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
  const audienceMatches = Array.isArray(payload.aud)
    ? payload.aud.includes(clientId)
    : payload.aud === clientId;
  if (
    !verified ||
    !["accounts.google.com", "https://accounts.google.com"].includes(payload.iss) ||
    !audienceMatches ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= nowSeconds ||
    (Number.isFinite(payload.iat) && payload.iat > nowSeconds + 60) ||
    payload.email_verified !== true ||
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    payload.email.toLowerCase() !== allowedEmail.trim().toLowerCase()
  ) throw new Error("google_token_rejected");
  return { sub: payload.sub, email: payload.email.toLowerCase() };
}

export async function verifyAppleIdentityToken(
  token,
  clientId,
  nonce,
  fetcher = fetch,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!token || !clientId || !nonce) throw new Error("apple_login_unavailable");
  const [headerPart, payloadPart, signaturePart, extra] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart || extra) throw new Error("apple_token_malformed");
  let header;
  let payload;
  try {
    header = decodeJson(headerPart);
    payload = decodeJson(payloadPart);
  } catch {
    throw new Error("apple_token_malformed");
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("apple_token_algorithm");
  const jwk = (await appleJwks(fetcher)).find((candidate) => candidate.kid === header.kid);
  if (!jwk) throw new Error("apple_key_unknown");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
  const audienceMatches = Array.isArray(payload.aud)
    ? payload.aud.includes(clientId)
    : payload.aud === clientId;
  if (
    !verified ||
    payload.iss !== "https://appleid.apple.com" ||
    !audienceMatches ||
    payload.nonce !== nonce ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= nowSeconds ||
    (Number.isFinite(payload.iat) && payload.iat > nowSeconds + 60) ||
    typeof payload.sub !== "string"
  ) throw new Error("apple_token_rejected");
  return { sub: payload.sub, email: typeof payload.email === "string" ? payload.email : null };
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function basicIdentity(request, env) {
  if (!env.OPENROUTER_API_KEY || !env.ZORA_APP_USERNAME || !env.ZORA_APP_PASSWORD) return false;
  const credentials = parseBasicAuthorization(request.headers.get("Authorization"));
  if (!credentials) return false;
  const [username, password] = credentials;
  const [givenUser, expectedUser, givenPassword, expectedPassword] = await Promise.all([
    digest(username),
    digest(env.ZORA_APP_USERNAME),
    digest(password),
    digest(env.ZORA_APP_PASSWORD),
  ]);
  return constantTimeEqual(givenUser, expectedUser) && constantTimeEqual(givenPassword, expectedPassword)
    ? { sub: "maintenance", email: null, provider: "basic" }
    : null;
}

async function sessionIdentity(request, env) {
  if (!env.ZORA_SESSION_SECRET) return null;
  const identity = await verifySessionToken(
    parseCookies(request).get(SESSION_COOKIE),
    env.ZORA_SESSION_SECRET,
  );
  return identity
    ? { ...identity, provider: identity.sub.startsWith("apple:") ? "apple" : "google" }
    : null;
}

async function identityForRequest(request, env) {
  return (await sessionIdentity(request, env)) || (await basicIdentity(request, env));
}

async function isAuthorized(request, env) {
  return Boolean(await identityForRequest(request, env));
}

function securityHeaders(pathname) {
  const headers = new Headers({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' https://accounts.google.com/gsi/style; connect-src 'self' https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/; img-src 'self' data:; frame-ancestors 'none'",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  });
  if (pathname.startsWith("/api/")) headers.set("Cache-Control", "no-store");
  return headers;
}

function json(payload, status = 200, pathname = "/api/") {
  const headers = securityHeaders(pathname);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(payload), { status, headers });
}

function unauthorized(env = {}) {
  const response = json({ detail: "Authentication required." }, 401);
  if (!env.GOOGLE_CLIENT_ID) response.headers.set("WWW-Authenticate", 'Basic realm="ZoraASI"');
  return response;
}

function sameOriginRequest(request) {
  const origin = request.headers.get("Origin");
  return origin === new URL(request.url).origin;
}

function secureCookie(name, value, maxAge, path = "/") {
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; Secure; SameSite=Strict`;
}

function crossSiteCookie(name, value, maxAge, path) {
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=None`;
}

function clearCookie(name, path = "/") {
  return `${name}=; Path=${path}; Max-Age=0; Secure; HttpOnly; SameSite=Strict`;
}

function appleConfigured(env) {
  return Boolean(
    env.APPLE_CLIENT_ID &&
    env.APPLE_TEAM_ID &&
    env.APPLE_KEY_ID &&
    env.APPLE_PRIVATE_KEY &&
    env.ZORA_PUBLIC_APP_URL &&
    env.ZORA_SESSION_SECRET &&
    env.DB,
  );
}

function publicOrigin(env) {
  const url = new URL(env.ZORA_PUBLIC_APP_URL);
  if (url.protocol !== "https:") throw new Error("public_url_must_be_https");
  return url.origin;
}

async function handleAuthConfig(env) {
  const csrfToken = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  const response = json({
    google: env.GOOGLE_CLIENT_ID && env.ZORA_ALLOWED_EMAIL && env.ZORA_SESSION_SECRET
      ? { enabled: true, clientId: env.GOOGLE_CLIENT_ID }
      : { enabled: false },
    apple: { enabled: appleConfigured(env) },
    maintenancePassword: Boolean(env.ZORA_APP_USERNAME && env.ZORA_APP_PASSWORD),
    csrfToken,
  });
  response.headers.append("Set-Cookie", secureCookie(AUTH_CSRF_COOKIE, csrfToken, 600, "/api/auth"));
  return response;
}

export async function createAppleClientSecret(env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const privateKeyLabel = "PRIVATE KEY";
  const pemBody = env.APPLE_PRIVATE_KEY
    .replaceAll(`-----BEGIN ${privateKeyLabel}-----`, "")
    .replaceAll(`-----END ${privateKeyLabel}-----`, "")
    .replace(/\s/gu, "");
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pemBody), (character) => character.charCodeAt(0)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = encodeJson({ alg: "ES256", kid: env.APPLE_KEY_ID });
  const payload = encodeJson({
    iss: env.APPLE_TEAM_ID,
    iat: nowSeconds,
    exp: nowSeconds + 5 * 60,
    aud: "https://appleid.apple.com",
    sub: env.APPLE_CLIENT_ID,
  });
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function handleAppleStart(request, env) {
  if (!sameOriginRequest(request)) return json({ detail: "The login origin was rejected." }, 403);
  if (!appleConfigured(env)) return json({ detail: "Apple sign-in is not configured." }, 503);
  const mode = (await identityForRequest(request, env)) ? "link" : "login";
  const state = await createAppleState(mode, env.ZORA_SESSION_SECRET);
  const statePayload = await verifyAppleState(state, env.ZORA_SESSION_SECRET);
  const callbackUrl = `${publicOrigin(env)}/api/auth/apple/callback`;
  const authorizeUrl = new URL(APPLE_AUTHORIZE_URL);
  authorizeUrl.search = new URLSearchParams({
    client_id: env.APPLE_CLIENT_ID,
    redirect_uri: callbackUrl,
    response_type: "code",
    response_mode: "form_post",
    scope: "name email",
    state,
    nonce: statePayload.nonce,
  }).toString();
  const response = json({ authorizationUrl: authorizeUrl.toString(), mode });
  response.headers.append(
    "Set-Cookie",
    crossSiteCookie(APPLE_STATE_COOKIE, state, 10 * 60, "/api/auth/apple/callback"),
  );
  return response;
}

async function appleSubjectHash(subject) {
  return sha256Hex(`apple:${subject}`);
}

async function appleIdentityIsLinked(env, subject) {
  const row = await env.DB.prepare(
    "SELECT 1 AS allowed FROM auth_identities WHERE provider='apple' AND subject_hash=?1",
  ).bind(await appleSubjectHash(subject)).first();
  return Boolean(row?.allowed);
}

async function linkAppleIdentity(env, subject, linkedBy) {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO auth_identities(provider, subject_hash, created_at_utc, linked_by)
     VALUES ('apple', ?1, ?2, ?3)`,
  ).bind(await appleSubjectHash(subject), new Date().toISOString(), linkedBy).run();
}

async function exchangeAppleCode(code, env, fetcher = fetch) {
  const response = await fetcher(APPLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.APPLE_CLIENT_ID,
      client_secret: await createAppleClientSecret(env),
      code,
      grant_type: "authorization_code",
      redirect_uri: `${publicOrigin(env)}/api/auth/apple/callback`,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.id_token !== "string") throw new Error("apple_code_rejected");
  return payload.id_token;
}

function redirectToApp(env, query, cookies = []) {
  const response = new Response(null, {
    status: 303,
    headers: {
      Location: `${publicOrigin(env)}/${query ? `?${query}` : ""}`,
      ...Object.fromEntries(securityHeaders("/api/auth/apple/callback")),
    },
  });
  for (const cookie of cookies) response.headers.append("Set-Cookie", cookie);
  return response;
}

async function handleAppleCallback(request, env) {
  if (!appleConfigured(env)) return json({ detail: "Apple sign-in is not configured." }, 503);
  let form;
  try {
    form = await request.formData();
  } catch {
    return redirectToApp(env, "auth_error=apple_request");
  }
  const cookieState = parseCookies(request).get(APPLE_STATE_COOKIE) || "";
  const returnedState = form.get("state");
  const [cookieDigest, returnedDigest] = await Promise.all([
    digest(cookieState),
    digest(typeof returnedState === "string" ? returnedState : ""),
  ]);
  const state = await verifyAppleState(cookieState, env.ZORA_SESSION_SECRET);
  if (!state || !returnedState || !constantTimeEqual(cookieDigest, returnedDigest)) {
    return redirectToApp(env, "auth_error=apple_state");
  }
  const code = form.get("code");
  if (typeof code !== "string" || !code) return redirectToApp(env, "auth_error=apple_denied");
  try {
    const idToken = await exchangeAppleCode(code, env);
    const identity = await verifyAppleIdentityToken(
      idToken,
      env.APPLE_CLIENT_ID,
      state.nonce,
    );
    if (state.mode === "link") {
      await linkAppleIdentity(env, identity.sub, "authenticated-session");
    } else if (!(await appleIdentityIsLinked(env, identity.sub))) {
      return redirectToApp(env, "auth_error=apple_not_linked", [
        clearCookie(APPLE_STATE_COOKIE, "/api/auth/apple/callback"),
      ]);
    }
    const subjectHash = await appleSubjectHash(identity.sub);
    const session = await createSessionToken(
      { sub: `apple:${subjectHash}`, email: identity.email || "Apple ID" },
      env.ZORA_SESSION_SECRET,
    );
    return redirectToApp(env, "auth=apple", [
      `${secureCookie(SESSION_COOKIE, session, SESSION_SECONDS)}; HttpOnly`,
      clearCookie(APPLE_STATE_COOKIE, "/api/auth/apple/callback"),
    ]);
  } catch {
    return redirectToApp(env, "auth_error=apple_verification", [
      clearCookie(APPLE_STATE_COOKIE, "/api/auth/apple/callback"),
    ]);
  }
}

async function handleGoogleAuth(request, env) {
  if (!sameOriginRequest(request)) return json({ detail: "The login origin was rejected." }, 403);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ detail: "Invalid login request." }, 400);
  }
  const cookieToken = parseCookies(request).get(AUTH_CSRF_COOKIE) || "";
  const bodyToken = typeof body?.csrfToken === "string" ? body.csrfToken : "";
  const [cookieDigest, bodyDigest] = await Promise.all([digest(cookieToken), digest(bodyToken)]);
  if (!cookieToken || !bodyToken || !constantTimeEqual(cookieDigest, bodyDigest)) {
    return json({ detail: "The login session expired. Refresh and try again." }, 403);
  }
  let identity;
  try {
    identity = await verifyGoogleCredential(
      body.credential,
      env.GOOGLE_CLIENT_ID,
      env.ZORA_ALLOWED_EMAIL,
    );
  } catch {
    return json({ detail: "That Google account is not authorized." }, 403);
  }
  const session = await createSessionToken(identity, env.ZORA_SESSION_SECRET);
  const response = json({ authenticated: true, provider: "google", email: identity.email });
  response.headers.append(
    "Set-Cookie",
    `${secureCookie(SESSION_COOKIE, session, SESSION_SECONDS)}; HttpOnly`,
  );
  response.headers.append("Set-Cookie", clearCookie(AUTH_CSRF_COOKIE, "/api/auth"));
  return response;
}

async function handleSession(request, env) {
  const identity = await identityForRequest(request, env);
  return identity
    ? json({ authenticated: true, provider: identity.provider, email: identity.email })
    : json({ authenticated: false }, 401);
}

async function handleLogout(request) {
  if (!sameOriginRequest(request)) return json({ detail: "The logout origin was rejected." }, 403);
  const response = json({ authenticated: false });
  response.headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));
  return response;
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

async function sha256Hex(value) {
  const bytes = await digest(value);
  return Array.from(bytes, (item) => item.toString(16).padStart(2, "0")).join("");
}

async function enforceRateLimit(request, env, ctx) {
  const limit = boundedNumber(env.ZORA_REQUESTS_PER_MINUTE, 6, 1, 30);
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const clientHash = (await sha256Hex(clientIp)).slice(0, 32);
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits(client_hash, minute_bucket, request_count)
     VALUES (?1, ?2, 1)
     ON CONFLICT(client_hash, minute_bucket)
     DO UPDATE SET request_count = request_count + 1
     RETURNING request_count`,
  ).bind(clientHash, minuteBucket).first();
  ctx.waitUntil(
    env.DB.prepare("DELETE FROM rate_limits WHERE minute_bucket < ?1")
      .bind(minuteBucket - 10)
      .run(),
  );
  return Number(row?.request_count || 0) <= limit;
}

async function spendToday(env, model) {
  const row = await env.DB.prepare(
    "SELECT reserved_usd FROM daily_budget WHERE utc_date=?1 AND model=?2",
  ).bind(todayUtc(), model).first();
  return Number(row?.reserved_usd || 0);
}

async function reserveBudget(env, model, amount, dailyCap) {
  const date = todayUtc();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO daily_budget(utc_date, model, reserved_usd) VALUES (?1, ?2, 0)",
  ).bind(date, model).run();
  const row = await env.DB.prepare(
    `UPDATE daily_budget SET reserved_usd = reserved_usd + ?3
     WHERE utc_date=?1 AND model=?2 AND reserved_usd + ?3 <= ?4
     RETURNING reserved_usd`,
  ).bind(date, model, amount, dailyCap).first();
  return row !== null;
}

async function releaseBudget(env, model, amount) {
  await env.DB.prepare(
    "UPDATE daily_budget SET reserved_usd=MAX(0, reserved_usd-?3) WHERE utc_date=?1 AND model=?2",
  ).bind(todayUtc(), model, amount).run();
}

async function finalizeBudget(env, model, estimate, payload) {
  const usage = payload.usage || {};
  let inputTokens = usage.prompt_tokens ?? usage.input_tokens;
  let outputTokens = usage.completion_tokens ?? usage.output_tokens;
  const estimated = inputTokens == null || outputTokens == null;
  if (estimated) {
    inputTokens = estimate.estimatedInputTokens;
    outputTokens = estimate.maxOutputTokens;
  }
  inputTokens = Math.max(0, Number(inputTokens));
  outputTokens = Math.max(0, Number(outputTokens));
  const actualCost = estimated
    ? estimate.estimatedCostUsd
    : (inputTokens * K3_INPUT_RATE) / 1_000_000 + (outputTokens * K3_OUTPUT_RATE) / 1_000_000;
  const roundedCost = Number(actualCost.toFixed(6));
  const adjustment = roundedCost - estimate.estimatedCostUsd;
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE daily_budget SET reserved_usd=MAX(0, reserved_usd+?3) WHERE utc_date=?1 AND model=?2",
    ).bind(todayUtc(), model, adjustment),
    env.DB.prepare(
      `INSERT INTO usage(timestamp_utc, utc_date, model, input_tokens, output_tokens, cost_usd, estimated)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    ).bind(
      new Date().toISOString(),
      todayUtc(),
      model,
      inputTokens,
      outputTokens,
      roundedCost,
      estimated ? 1 : 0,
    ),
  ]);
  return { inputTokens, outputTokens, costUsd: roundedCost, estimated };
}

async function providerPayload(env, model, message, maxOutputTokens) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "ZoraASI Cloud",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      temperature: 0.7,
      max_tokens: maxOutputTokens,
      reasoning: { effort: model === MODEL_ROUTES.k3 ? "high" : "low", exclude: true },
    }),
  });
  if (!response.ok) throw new Error("provider_request_failed");
  return response.json();
}

function replyFromPayload(payload) {
  const reply = payload?.choices?.[0]?.message?.content;
  return typeof reply === "string" && reply.trim() ? reply.trim() : null;
}

async function handleStatus(request, env) {
  if (!(await isAuthorized(request, env))) return unauthorized(env);
  return json({
    status: "ready",
    defaultModel: env.ZORA_DEFAULT_MODEL === "k3" ? "k3" : "hy3",
    models: MODEL_ROUTES,
    privacy: "No private corpus or persistent conversation memory is loaded.",
    k3Budget: {
      spentTodayUsd: await spendToday(env, MODEL_ROUTES.k3),
      dailyCapUsd: boundedNumber(env.ZORA_K3_DAILY_CAP_USD, 1, 0.05, 10),
      perRequestCapUsd: boundedNumber(env.ZORA_K3_MAX_REQUEST_USD, 0.08, 0.01, 0.08),
    },
  });
}

async function handleChat(request, env, ctx) {
  if (!(await isAuthorized(request, env))) return unauthorized(env);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ detail: "Invalid JSON." }, 400);
  }
  if (!body || typeof body.message !== "string" || !["hy3", "k3"].includes(body.model)) {
    return json({ detail: "A message and supported model are required." }, 400);
  }
  const message = body.message.trim();
  const maxPromptChars = boundedNumber(env.ZORA_MAX_PROMPT_CHARS, 16_000, 1_000, 64_000);
  const maxOutputTokens = boundedNumber(env.ZORA_MAX_OUTPUT_TOKENS, 800, 128, 1_024);
  const promptChars = SYSTEM_PROMPT.length + message.length;
  if (!message) return json({ detail: "Message cannot be empty." }, 400);
  if (promptChars > maxPromptChars) return json({ detail: "The prompt limit was exceeded." }, 413);
  if (!(await enforceRateLimit(request, env, ctx))) {
    const response = json({ detail: "Rate limit reached. Try again shortly." }, 429);
    response.headers.set("Retry-After", "60");
    return response;
  }

  const model = MODEL_ROUTES[body.model];
  let estimate = null;
  if (body.model === "k3") {
    estimate = estimateK3Cost(promptChars, maxOutputTokens);
    const perRequestCap = boundedNumber(env.ZORA_K3_MAX_REQUEST_USD, 0.08, 0.01, 0.08);
    const dailyCap = boundedNumber(env.ZORA_K3_DAILY_CAP_USD, 1, 0.05, 10);
    if (estimate.estimatedCostUsd > perRequestCap) {
      return json({ detail: "The request exceeds the configured K3 budget." }, 429);
    }
    if (!(await reserveBudget(env, model, estimate.estimatedCostUsd, dailyCap))) {
      return json({ detail: "The daily K3 budget has been reached." }, 429);
    }
  }

  let payload;
  try {
    payload = await providerPayload(env, model, message, maxOutputTokens);
  } catch {
    if (estimate) await releaseBudget(env, model, estimate.estimatedCostUsd);
    return json({ detail: "The model provider did not complete this request." }, 502);
  }

  const usage = estimate ? await finalizeBudget(env, model, estimate, payload) : null;
  const reply = replyFromPayload(payload);
  if (!reply) return json({ detail: "The model provider returned no final answer." }, 502);
  return json({
    reply,
    backend: "openrouter",
    model,
    memory: "disabled",
    rag: "not-uploaded",
    usage,
  });
}

async function withSecurity(response, pathname) {
  const secured = new Response(response.body, response);
  for (const [name, value] of securityHeaders(pathname)) secured.headers.set(name, value);
  return secured;
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      const passwordReady = Boolean(env.ZORA_APP_USERNAME && env.ZORA_APP_PASSWORD);
      const googleReady = Boolean(env.GOOGLE_CLIENT_ID && env.ZORA_ALLOWED_EMAIL && env.ZORA_SESSION_SECRET);
      const appleReady = appleConfigured(env);
      return json({
        status: "ok",
        ready: Boolean(env.OPENROUTER_API_KEY && (passwordReady || googleReady || appleReady)),
        edition: "cloudflare-sanitized",
        memory: "disabled",
        rag: "not-uploaded",
        models: MODEL_ROUTES,
      }, 200, "/health");
    }
    if (url.pathname === "/api/auth/config" && request.method === "GET") return handleAuthConfig(env);
    if (url.pathname === "/api/auth/google" && request.method === "POST") return handleGoogleAuth(request, env);
    if (url.pathname === "/api/auth/apple/start" && request.method === "POST") return handleAppleStart(request, env);
    if (url.pathname === "/api/auth/apple/callback" && request.method === "POST") {
      return handleAppleCallback(request, env);
    }
    if (url.pathname === "/api/auth/session" && request.method === "GET") return handleSession(request, env);
    if (url.pathname === "/api/auth/logout" && request.method === "POST") return handleLogout(request);
    if (url.pathname === "/api/status" && request.method === "GET") return handleStatus(request, env);
    if (url.pathname === "/api/chat" && request.method === "POST") return handleChat(request, env, ctx);
    if (url.pathname.startsWith("/api/")) return json({ detail: "Not found." }, 404);
    return withSecurity(await env.ASSETS.fetch(request), url.pathname);
  },
};

export default worker;
