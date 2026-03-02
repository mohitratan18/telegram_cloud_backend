# Authentication Setup Guide

## Security Features Implemented

✅ **JWT Token Authentication** - Industry standard token-based auth
✅ **Bcrypt Password Hashing** - Passwords hashed with 12 salt rounds
✅ **Token Storage in Database** - All tokens tracked and can be revoked
✅ **Token Expiration** - 7-day expiration with validation
✅ **Rate Limiting** - 5 login attempts per 15 minutes
✅ **Helmet.js** - Security headers protection
✅ **Token Revocation** - Logout invalidates tokens
✅ **Input Validation** - All inputs validated
✅ **HTTPS Ready** - Secure token transmission
✅ **No Token Reuse** - Each login generates unique token

## Setup Instructions

### 1. Create Database Table

Go to your Supabase Dashboard → SQL Editor and run:

```sql
CREATE TABLE IF NOT EXISTS auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auth_tokens_token ON auth_tokens(token);
CREATE INDEX idx_auth_tokens_username ON auth_tokens(username);
CREATE INDEX idx_auth_tokens_expires_at ON auth_tokens(expires_at);
```

### 2. Hash Your Password

Run this command to generate a hashed password:

```bash
node hashPassword.js your_secure_password
```

Copy the output hash.

### 3. Update .env File

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<paste_hashed_password_here>
JWT_SECRET=<generate_random_32+_character_string>
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Restart Server

```bash
node index.js
```

## API Endpoints

### POST /login
Login and get JWT token

**Request:**
```json
{
  "username": "admin",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-03-09T12:00:00.000Z"
}
```

### POST /logout
Revoke current token

**Headers:**
```
Authorization: Bearer <your_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### GET /verify
Check if token is valid

**Headers:**
```
Authorization: Bearer <your_token>
```

**Response:**
```json
{
  "success": true,
  "username": "admin"
}
```

## Protected Endpoints

All these endpoints now require authentication:

- `POST /upload` - Upload image
- `GET /images` - Get images list
- `DELETE /image/:id` - Delete image

**Usage:**
```javascript
// Add token to all requests
axios.get('http://localhost:5000/images', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Security Best Practices

1. **Never commit .env file** - Add to .gitignore
2. **Use strong passwords** - Minimum 12 characters
3. **Rotate JWT_SECRET** - Change periodically
4. **Use HTTPS in production** - Never send tokens over HTTP
5. **Store tokens securely** - Use httpOnly cookies or secure storage
6. **Monitor failed login attempts** - Check logs regularly
7. **Implement token refresh** - For better UX (optional enhancement)

## Error Responses

All auth errors return 401 status:

```json
{
  "error": "Unauthorized",
  "message": "Token expired"
}
```

Possible messages:
- "No token provided"
- "Invalid token"
- "Token expired"
- "Token not found or revoked"
- "Invalid credentials"

## Testing

### 1. Login
```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'
```

### 2. Access Protected Route
```bash
curl http://localhost:5000/images \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. Logout
```bash
curl -X POST http://localhost:5000/logout \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```
