# Frontend Integration Guide - Secure Authentication

## 🔐 Security Overview

This authentication system implements:
- **JWT tokens** stored securely
- **Token expiration** (7 days)
- **Automatic token validation** on every request
- **Token revocation** on logout
- **Rate limiting** protection
- **HTTPS ready** for production

---

## 📡 API Endpoints

### Base URL
```
Development: http://localhost:5000
Production: https://your-domain.com
```

---

## 1️⃣ LOGIN API

### Endpoint
```
POST /login
```

### Request Body
```json
{
  "username": "admin",
  "password": "your_password"
}
```

### CURL Example
```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }'
```

### Success Response (200)
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNzA5MzgwODAwLCJleHAiOjE3MDk5ODU2MDB9.abc123...",
  "expiresAt": "2026-03-09T12:00:00.000Z"
}
```

### Error Responses

**400 - Missing Fields**
```json
{
  "error": "Bad Request",
  "message": "Username and password are required"
}
```

**401 - Invalid Credentials**
```json
{
  "error": "Unauthorized",
  "message": "Invalid credentials"
}
```

**429 - Too Many Attempts**
```json
{
  "error": "Too many login attempts, please try again later"
}
```

---

## 2️⃣ LOGOUT API

### Endpoint
```
POST /logout
```

### Headers Required
```
Authorization: Bearer YOUR_TOKEN_HERE
```

### CURL Example
```bash
curl -X POST http://localhost:5000/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 3️⃣ VERIFY TOKEN API

### Endpoint
```
GET /verify
```

### Headers Required
```
Authorization: Bearer YOUR_TOKEN_HERE
```

### CURL Example
```bash
curl http://localhost:5000/verify \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Success Response (200)
```json
{
  "success": true,
  "username": "admin"
}
```

---

## 4️⃣ PROTECTED ROUTES

All these routes require the `Authorization` header:

### Get Images
```bash
curl http://localhost:5000/images?page=1&limit=12&sortBy=uploaded_at&order=desc \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Upload Image
```bash
curl -X POST http://localhost:5000/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "image=@/path/to/image.jpg"
```

### Delete Image
```bash
curl -X DELETE http://localhost:5000/image/123 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🎨 Frontend Implementation

### React/Next.js Implementation

#### 1. Create Auth Context (`lib/auth.tsx`)

```typescript
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      // Verify token is still valid
      verifyToken(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      await axios.get('http://localhost:5000/verify', {
        headers: { Authorization: `Bearer ${tokenToVerify}` }
      });
      setToken(tokenToVerify);
    } catch (error) {
      // Token invalid or expired
      localStorage.removeItem('auth_token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await axios.post('http://localhost:5000/login', {
        username,
        password
      });

      const { token: newToken } = response.data;
      
      // Store token securely
      localStorage.setItem('auth_token', newToken);
      setToken(newToken);
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid username or password');
      } else if (error.response?.status === 429) {
        throw new Error('Too many login attempts. Please try again later.');
      } else {
        throw new Error('Login failed. Please try again.');
      }
    }
  };

  const logout = async () => {
    if (!token) return;

    try {
      await axios.post('http://localhost:5000/logout', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local state
      localStorage.removeItem('auth_token');
      setToken(null);
    }
  };

  return (
    <AuthContext.Provider value={{
      token,
      isAuthenticated: !!token,
      login,
      logout,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

#### 2. Create Axios Instance with Interceptor (`lib/api.ts`)

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000',
});

// Add token to every request automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

#### 3. Login Page Component (`app/login/page.tsx`)

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      router.push('/'); // Redirect to home after login
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Login</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              autoComplete="username"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

#### 4. Protected Route Component (`components/ProtectedRoute.tsx`)

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
```

#### 5. Update Root Layout (`app/layout.tsx`)

```typescript
import { AuthProvider } from '@/lib/auth';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

#### 6. Use in Your Pages (`app/page.tsx`)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import ProtectedRoute from '@/components/ProtectedRoute';
import api from '@/lib/api';

export default function Home() {
  const { logout } = useAuth();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      const response = await api.get('/images', {
        params: {
          page: 1,
          limit: 12,
          sortBy: 'uploaded_at',
          order: 'desc'
        }
      });
      setImages(response.data.data);
    } catch (error) {
      console.error('Failed to fetch images:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Image Gallery</h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>

        {loading ? (
          <div>Loading images...</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {images.map((image: any) => (
              <div key={image.id} className="border rounded p-4">
                <img src={image.image_url} alt={image.filename} />
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
```

---

## 🔒 Security Best Practices

### ✅ DO:
1. **Store tokens in localStorage** (or httpOnly cookies for extra security)
2. **Always use HTTPS in production**
3. **Clear token on logout**
4. **Validate token on app load**
5. **Handle 401 errors globally**
6. **Use environment variables for API URLs**
7. **Implement token refresh** (optional enhancement)

### ❌ DON'T:
1. **Never store passwords in state or localStorage**
2. **Never log tokens to console in production**
3. **Never send tokens in URL parameters**
4. **Never expose JWT_SECRET in frontend**
5. **Never skip HTTPS in production**

---

## 🧪 Testing the Integration

### 1. Test Login
```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'
```

### 2. Copy the token from response

### 3. Test Protected Route
```bash
curl http://localhost:5000/images \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Test Logout
```bash
curl -X POST http://localhost:5000/logout \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 5. Verify Token is Revoked
```bash
curl http://localhost:5000/images \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
# Should return 401 Unauthorized
```

---

## 📦 Environment Variables

Create `.env.local` in your frontend:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Update `lib/api.ts`:
```typescript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});
```

---

## 🚀 Production Deployment

1. **Backend**: Deploy to Heroku/Railway/Render
2. **Update CORS**: Set specific origin instead of "*"
3. **Use HTTPS**: Ensure SSL certificate
4. **Update Frontend**: Change API URL to production
5. **Test thoroughly**: All auth flows

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify token in localStorage
3. Test API with CURL first
4. Check server logs
5. Ensure database table exists

---

## 🎯 Quick Start Checklist

- [ ] Run `node setup.js` to generate credentials
- [ ] Update `.env` with generated values
- [ ] Run SQL in Supabase to create `auth_tokens` table
- [ ] Restart backend server
- [ ] Test login with CURL
- [ ] Implement frontend auth context
- [ ] Create login page
- [ ] Protect routes with ProtectedRoute component
- [ ] Test complete flow
