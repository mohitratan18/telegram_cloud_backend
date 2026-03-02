# 🔐 Authentication Flow Diagram

## 1️⃣ Login Flow

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │
       │ 1. POST /login
       │    { username, password }
       ▼
┌─────────────────────────────────────────┐
│           Express Server                │
│                                         │
│  2. Rate Limiter Check                  │
│     (Max 5 attempts/15min)              │
│                                         │
│  3. Validate Input                      │
│     (username & password present?)      │
│                                         │
│  4. Check Username                      │
│     (matches ADMIN_USERNAME?)           │
│                                         │
│  5. Verify Password                     │
│     bcrypt.compare(password, hash)      │
│                                         │
│  6. Generate JWT Token                  │
│     jwt.sign({ username }, secret)      │
│     Expires: 7 days                     │
│                                         │
│  7. Store in Database                   │
│     INSERT INTO auth_tokens             │
└──────┬──────────────────────────────────┘
       │
       │ 8. Return Token
       │    { success: true, token, expiresAt }
       ▼
┌─────────────┐
│   Browser   │
│             │
│  9. Store Token                         │
│     localStorage.setItem('auth_token')  │
│                                         │
│  10. Redirect to Home                   │
└─────────────┘
```

---

## 2️⃣ Protected Request Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ 1. GET /images
       │    Headers: { Authorization: "Bearer TOKEN" }
       ▼
┌─────────────────────────────────────────┐
│      Auth Middleware (verifyToken)      │
│                                         │
│  2. Extract Token from Header           │
│     Authorization: "Bearer TOKEN"       │
│                                         │
│  3. Verify JWT Signature                │
│     jwt.verify(token, JWT_SECRET)       │
│     ✓ Valid signature?                  │
│     ✓ Not expired?                      │
│                                         │
│  4. Check Database                      │
│     SELECT * FROM auth_tokens           │
│     WHERE token = ? AND revoked = false │
│                                         │
│  5. Validate Expiration                 │
│     expires_at > NOW()                  │
│                                         │
│  6. Attach User to Request              │
│     req.user = { username, tokenId }    │
│                                         │
│  7. Call next()                         │
└──────┬──────────────────────────────────┘
       │
       │ 8. Continue to Route Handler
       ▼
┌─────────────────────────────────────────┐
│         Route Handler (/images)         │
│                                         │
│  9. Process Request                     │
│     (User is authenticated)             │
│                                         │
│  10. Query Database                     │
│      SELECT * FROM images               │
│                                         │
│  11. Return Response                    │
└──────┬──────────────────────────────────┘
       │
       │ 12. Send Data
       │     { total, page, data: [...] }
       ▼
┌─────────────┐
│   Browser   │
│             │
│  13. Display Images                     │
└─────────────┘
```

---

## 3️⃣ Logout Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ 1. POST /logout
       │    Headers: { Authorization: "Bearer TOKEN" }
       ▼
┌─────────────────────────────────────────┐
│      Auth Middleware (verifyToken)      │
│                                         │
│  2. Verify Token (same as above)        │
└──────┬──────────────────────────────────┘
       │
       │ 3. Continue to Logout Handler
       ▼
┌─────────────────────────────────────────┐
│         Logout Handler                  │
│                                         │
│  4. Extract Token from Header           │
│                                         │
│  5. Revoke Token in Database            │
│     UPDATE auth_tokens                  │
│     SET revoked = true                  │
│     WHERE token = ?                     │
│                                         │
│  6. Return Success                      │
└──────┬──────────────────────────────────┘
       │
       │ 7. { success: true }
       ▼
┌─────────────┐
│   Browser   │
│             │
│  8. Remove Token                        │
│     localStorage.removeItem('auth_token')│
│                                         │
│  9. Redirect to Login                   │
└─────────────┘
```

---

## 4️⃣ Token Expiration Flow

```
┌─────────────┐
│   Browser   │
│             │
│  Token stored in localStorage           │
│  (7 days old)                           │
└──────┬──────┘
       │
       │ 1. GET /images
       │    Headers: { Authorization: "Bearer EXPIRED_TOKEN" }
       ▼
┌─────────────────────────────────────────┐
│      Auth Middleware (verifyToken)      │
│                                         │
│  2. Extract Token                       │
│                                         │
│  3. Verify JWT Signature                │
│     jwt.verify(token, JWT_SECRET)       │
│     ❌ TokenExpiredError                │
│                                         │
│  4. Return 401 Unauthorized             │
│     { error: "Token expired" }          │
└──────┬──────────────────────────────────┘
       │
       │ 5. 401 Response
       ▼
┌─────────────────────────────────────────┐
│      Axios Interceptor (Frontend)       │
│                                         │
│  6. Catch 401 Error                     │
│                                         │
│  7. Clear Token                         │
│     localStorage.removeItem('auth_token')│
│                                         │
│  8. Redirect to Login                   │
│     window.location.href = '/login'     │
└─────────────────────────────────────────┘
```

---

## 5️⃣ Security Layers

```
┌─────────────────────────────────────────────────────┐
│                    Request                          │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Layer 1: Rate Limiting                             │
│  ✓ Max 5 login attempts per 15 minutes              │
│  ✓ Prevents brute force attacks                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Layer 2: Helmet.js Security Headers                │
│  ✓ XSS Protection                                   │
│  ✓ Content Security Policy                          │
│  ✓ HSTS                                             │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Layer 3: Input Validation                          │
│  ✓ Required fields present                          │
│  ✓ Data type validation                             │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Layer 4: Password Hashing (bcrypt)                 │
│  ✓ 12 salt rounds                                   │
│  ✓ One-way encryption                               │
│  ✓ Timing attack resistant                          │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Layer 5: JWT Signature Verification                │
│  ✓ HMAC SHA256 algorithm                            │
│  ✓ Secret key validation                            │
│  ✓ Expiration check                                 │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Layer 6: Database Token Validation                 │
│  ✓ Token exists in database                         │
│  ✓ Token not revoked                                │
│  ✓ Expiration date valid                            │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              Request Processed ✓                    │
└─────────────────────────────────────────────────────┘
```

---

## 6️⃣ Database Schema

```
┌─────────────────────────────────────────────────────┐
│              auth_tokens Table                      │
├─────────────────────────────────────────────────────┤
│  id           UUID PRIMARY KEY                      │
│  token        TEXT UNIQUE NOT NULL                  │
│  username     TEXT NOT NULL                         │
│  expires_at   TIMESTAMPTZ NOT NULL                  │
│  revoked      BOOLEAN DEFAULT FALSE                 │
│  created_at   TIMESTAMPTZ DEFAULT NOW()             │
├─────────────────────────────────────────────────────┤
│  Indexes:                                           │
│  - idx_auth_tokens_token (token)                    │
│  - idx_auth_tokens_username (username)              │
│  - idx_auth_tokens_expires_at (expires_at)          │
└─────────────────────────────────────────────────────┘
```

---

## 7️⃣ Token Structure

```
JWT Token Structure:
┌─────────────────────────────────────────────────────┐
│  Header                                             │
│  {                                                  │
│    "alg": "HS256",                                  │
│    "typ": "JWT"                                     │
│  }                                                  │
├─────────────────────────────────────────────────────┤
│  Payload                                            │
│  {                                                  │
│    "username": "admin",                             │
│    "iat": 1709380800,  // Issued at                │
│    "exp": 1709985600   // Expires (7 days)         │
│  }                                                  │
├─────────────────────────────────────────────────────┤
│  Signature                                          │
│  HMACSHA256(                                        │
│    base64UrlEncode(header) + "." +                  │
│    base64UrlEncode(payload),                        │
│    JWT_SECRET                                       │
│  )                                                  │
└─────────────────────────────────────────────────────┘

Final Token:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNzA5MzgwODAwLCJleHAiOjE3MDk5ODU2MDB9.signature_here
```

---

## 🔒 Attack Prevention

| Attack Type | Prevention Method |
|-------------|-------------------|
| Brute Force | Rate limiting (5 attempts/15min) |
| SQL Injection | Parameterized queries (Supabase) |
| XSS | Helmet.js security headers |
| CSRF | Token-based auth (no cookies) |
| Token Theft | HTTPS only, short expiration |
| Replay Attacks | Token revocation on logout |
| Timing Attacks | bcrypt constant-time comparison |
| Man-in-Middle | HTTPS encryption |

---

## ✅ Security Checklist

- [x] Passwords never stored in plain text
- [x] Tokens expire after 7 days
- [x] Tokens can be revoked
- [x] Rate limiting prevents brute force
- [x] JWT signature prevents tampering
- [x] Database validates every request
- [x] HTTPS ready for production
- [x] Security headers enabled
- [x] Input validation on all endpoints
- [x] Error messages don't leak info
