# 🤖 Instructions for AI Bot - Frontend Authentication Implementation

## Context
The backend has a secure JWT authentication system. You need to implement the frontend login flow.

---

## 📋 Implementation Checklist

### Step 1: Install Dependencies
```bash
npm install axios
# or
yarn add axios
```

---

### Step 2: Create Auth Context (`lib/auth.tsx`)

Create a new file `lib/auth.tsx` with this exact code:

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

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
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

---

### Step 3: Create API Instance (`lib/api.ts`)

Create `lib/api.ts`:

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000',
});

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

### Step 4: Update Root Layout (`app/layout.tsx`)

Wrap your app with AuthProvider:

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

---

### Step 5: Create Login Page (`app/login/page.tsx`)

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
      router.push('/');
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

---

### Step 6: Create Protected Route Component (`components/ProtectedRoute.tsx`)

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

---

### Step 7: Update Existing Pages to Use Auth

#### Update `app/page.tsx`:

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
    window.location.href = '/login';
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
                <img src={image.image_url} alt={image.filename} className="w-full" />
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

### Step 8: Update All API Calls

Replace all `axios` calls with the `api` instance:

**Before:**
```typescript
const response = await axios.get('http://localhost:5000/images');
```

**After:**
```typescript
import api from '@/lib/api';
const response = await api.get('/images');
```

The token will be automatically attached to all requests!

---

## 🔒 Security Features Included

✅ Token stored in localStorage
✅ Token auto-attached to all requests
✅ Automatic redirect on 401 errors
✅ Token verification on app load
✅ Secure logout with token revocation
✅ Error handling for all auth flows
✅ Loading states
✅ Protected routes

---

## 🧪 Testing Instructions

1. **Start backend server:**
   ```bash
   node index.js
   ```

2. **Start frontend:**
   ```bash
   npm run dev
   ```

3. **Test flow:**
   - Visit http://localhost:3000
   - Should redirect to /login
   - Login with credentials from .env
   - Should redirect to home page
   - Images should load (with auth token)
   - Click logout
   - Should redirect to /login

---

## 🐛 Common Issues

### "Cannot find module '@/lib/auth'"
- Ensure `lib/auth.tsx` exists
- Check tsconfig.json has `"@/*": ["./"]` in paths

### "localStorage is not defined"
- Add `'use client'` at top of component
- Only use localStorage in client components

### CORS errors
- Ensure backend is running on port 5000
- Check CORS is configured in backend

### 401 errors
- Check token in localStorage (DevTools → Application → Local Storage)
- Verify backend is running
- Check .env has correct credentials

---

## 📝 Summary

This implementation provides:
- Secure JWT authentication
- Automatic token management
- Protected routes
- Global error handling
- Clean separation of concerns
- Production-ready code

All API calls will automatically include the auth token, and users will be redirected to login if their token expires or is invalid.
