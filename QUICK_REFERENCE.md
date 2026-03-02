# 🚀 Quick Reference - Authentication API

## 📋 CURL Commands

### 1. Login
```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "expiresAt": "2026-03-09T12:00:00.000Z"
}
```

---

### 2. Get Images (Protected)
```bash
curl http://localhost:5000/images?page=1&limit=12 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 3. Upload Image (Protected)
```bash
curl -X POST http://localhost:5000/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@image.jpg"
```

---

### 4. Delete Image (Protected)
```bash
curl -X DELETE http://localhost:5000/image/IMAGE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 5. Verify Token
```bash
curl http://localhost:5000/verify \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 6. Logout
```bash
curl -X POST http://localhost:5000/logout \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎨 Frontend Code Snippets

### Login Function
```typescript
const login = async (username: string, password: string) => {
  const response = await fetch('http://localhost:5000/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  const data = await response.json();
  localStorage.setItem('auth_token', data.token);
  return data;
};
```

### Fetch with Token
```typescript
const fetchImages = async () => {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch('http://localhost:5000/images?page=1&limit=12', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};
```

### Logout Function
```typescript
const logout = async () => {
  const token = localStorage.getItem('auth_token');
  
  await fetch('http://localhost:5000/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  localStorage.removeItem('auth_token');
};
```

### Axios Setup (Recommended)
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000'
});

// Auto-attach token to all requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors globally
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Usage with Axios
```typescript
// Login
const { data } = await api.post('/login', { username, password });
localStorage.setItem('auth_token', data.token);

// Get images (token auto-attached)
const images = await api.get('/images?page=1&limit=12');

// Upload image
const formData = new FormData();
formData.append('image', file);
await api.post('/upload', formData);

// Logout
await api.post('/logout');
localStorage.removeItem('auth_token');
```

---

## 🔐 Security Checklist

- [x] Passwords hashed with bcrypt (12 rounds)
- [x] JWT tokens with 7-day expiration
- [x] Tokens stored in database
- [x] Token revocation on logout
- [x] Rate limiting (5 attempts/15min)
- [x] Helmet.js security headers
- [x] Input validation
- [x] 401 errors for unauthorized access
- [x] Token verification on every request
- [x] No token reuse after logout

---

## 📝 Setup Steps

1. **Generate credentials:**
   ```bash
   node setup.js
   ```

2. **Update .env with generated values**

3. **Create database table in Supabase:**
   - Copy SQL from `create_auth_table.sql`
   - Run in Supabase SQL Editor

4. **Start server:**
   ```bash
   node index.js
   ```

5. **Test authentication:**
   ```bash
   # Windows
   powershell -ExecutionPolicy Bypass -File test-auth.ps1
   
   # Linux/Mac
   bash test-auth.sh
   ```

---

## 🐛 Troubleshooting

### "Invalid credentials" error
- Check username/password in .env
- Ensure password is hashed (run `node setup.js`)

### "Token not found or revoked" error
- Token expired (7 days)
- Token was logged out
- Database table not created

### "Too many login attempts" error
- Wait 15 minutes
- Rate limit: 5 attempts per 15 minutes

### CORS errors
- Check server is running
- Verify API URL in frontend
- Check CORS configuration in index.js

---

## 📞 Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad Request | Check request body format |
| 401 | Unauthorized | Login again or check token |
| 429 | Too Many Requests | Wait 15 minutes |
| 500 | Server Error | Check server logs |

---

## 🎯 Production Checklist

- [ ] Change CORS origin from "*" to specific domain
- [ ] Use HTTPS only
- [ ] Set strong JWT_SECRET (32+ chars)
- [ ] Use environment variables
- [ ] Enable database backups
- [ ] Monitor failed login attempts
- [ ] Set up token cleanup job
- [ ] Add logging/monitoring
- [ ] Test all endpoints
- [ ] Update API URLs in frontend

---

## 📚 Files Reference

| File | Purpose |
|------|---------|
| `index.js` | Main server with auth routes |
| `authMiddleware.js` | Token verification middleware |
| `.env` | Configuration (credentials, secrets) |
| `setup.js` | Generate hashed password & JWT secret |
| `hashPassword.js` | Hash individual passwords |
| `create_auth_table.sql` | Database schema |
| `test-auth.ps1` | Windows test script |
| `test-auth.sh` | Linux/Mac test script |
| `AUTH_SETUP.md` | Detailed setup guide |
| `FRONTEND_INTEGRATION.md` | Frontend implementation guide |
| `QUICK_REFERENCE.md` | This file |
