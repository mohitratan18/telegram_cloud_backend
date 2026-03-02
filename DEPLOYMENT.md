# 🚀 Deployment Guide

## Build Commands

### For Node.js Backend (This Project)

```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js",
    "build": "echo 'No build step required for Node.js backend'"
  }
}
```

**Node.js doesn't require a build step** - it runs directly from source files.

---

## 📦 Deployment Platforms

### 1. Railway (Recommended - Easiest)

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
npm start
```

**Environment Variables:**
Add these in Railway dashboard:
```env
PORT=5000
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_hashed_password
JWT_SECRET=your_jwt_secret
NODE_ENV=production
```

**Steps:**
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Add environment variables
5. Deploy!

**Railway will auto-detect Node.js and use `npm start`**

---

### 2. Render

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
npm start
```

**Steps:**
1. Go to [render.com](https://render.com)
2. New → Web Service
3. Connect GitHub repository
4. Configure:
   - Name: telegram-cloud-api
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add environment variables
6. Create Web Service

---

### 3. Heroku

**No build command needed** - Heroku auto-detects Node.js

**Procfile** (create this file):
```
web: node index.js
```

**Steps:**
```bash
# Install Heroku CLI
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set TELEGRAM_BOT_TOKEN=your_token
heroku config:set TELEGRAM_CHAT_ID=your_chat_id
heroku config:set SUPABASE_URL=your_url
heroku config:set SUPABASE_KEY=your_key
heroku config:set ADMIN_USERNAME=admin
heroku config:set ADMIN_PASSWORD=your_hashed_password
heroku config:set JWT_SECRET=your_secret

# Deploy
git push heroku main
```

---

### 4. Vercel (Serverless)

**Note:** Vercel is designed for frontend/serverless. For Express apps, use Railway or Render instead.

If you still want to use Vercel, create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "index.js"
    }
  ]
}
```

---

### 5. DigitalOcean App Platform

**Build Command:**
```bash
npm install
```

**Run Command:**
```bash
npm start
```

**Steps:**
1. Go to DigitalOcean → Apps
2. Create App → GitHub
3. Select repository
4. Configure:
   - Type: Web Service
   - Build Command: `npm install`
   - Run Command: `npm start`
   - HTTP Port: 5000
5. Add environment variables
6. Deploy

---

## 🔧 Pre-Deployment Checklist

### 1. Update CORS Settings

In `index.js`, change:
```javascript
// Development
app.use(cors({ 
    origin: "*",
    credentials: true
}));

// Production (replace with your frontend URL)
app.use(cors({ 
    origin: "https://your-frontend-domain.com",
    credentials: true
}));
```

### 2. Create .gitignore

```
node_modules/
.env
uploads/*
!uploads/.gitkeep
*.log
.DS_Store
```

### 3. Secure Environment Variables

Never commit `.env` file! Set environment variables in your deployment platform.

### 4. Update PORT Configuration

Your `index.js` already uses `process.env.PORT`, which is correct:
```javascript
app.listen(process.env.PORT, () =>
    console.log(`Server running on port ${process.env.PORT}`)
);
```

### 5. Database Setup

Ensure `auth_tokens` table exists in Supabase:
```sql
-- Run this in Supabase SQL Editor
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

---

## 🌐 Environment Variables Required

```env
# Server
PORT=5000
NODE_ENV=production

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_bcrypt_hashed_password
JWT_SECRET=your_random_32_char_secret
```

**Generate credentials:**
```bash
node setup.js
```

---

## 📝 Deployment Commands Summary

| Platform | Build Command | Start Command |
|----------|--------------|---------------|
| Railway | `npm install` | `npm start` |
| Render | `npm install` | `npm start` |
| Heroku | Auto-detected | `node index.js` |
| DigitalOcean | `npm install` | `npm start` |
| Vercel | N/A | Serverless |

---

## 🔒 Production Security Updates

### 1. Update CORS in `index.js`

```javascript
const allowedOrigins = [
  'https://your-frontend.com',
  'https://www.your-frontend.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

### 2. Add Production Logging

```javascript
if (process.env.NODE_ENV === 'production') {
  // Add production logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}
```

### 3. Add Health Check Endpoint

```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

---

## 🧪 Test Deployment

After deployment, test with:

```bash
# Replace with your deployed URL
export API_URL="https://your-app.railway.app"

# Test health check
curl $API_URL/health

# Test login
curl -X POST $API_URL/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'

# Test protected route (use token from login)
curl $API_URL/images \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 Monitoring

### Railway
- Built-in logs and metrics
- View at: Project → Deployments → Logs

### Render
- Logs tab in dashboard
- Metrics available in paid plans

### Heroku
```bash
heroku logs --tail
```

---

## 🐛 Common Deployment Issues

### "Application Error" or "Cannot GET /"
**Cause:** Server not starting
**Solution:** Check logs for errors, verify environment variables

### "CORS Error"
**Cause:** Frontend domain not allowed
**Solution:** Update CORS settings in `index.js`

### "Database Connection Error"
**Cause:** Invalid Supabase credentials
**Solution:** Verify `SUPABASE_URL` and `SUPABASE_KEY`

### "Port Already in Use"
**Cause:** Hardcoded port instead of `process.env.PORT`
**Solution:** Already fixed in your code ✓

### "Module Not Found"
**Cause:** Dependencies not installed
**Solution:** Ensure `npm install` runs in build command

---

## 🎯 Quick Deploy (Railway - Fastest)

1. **Push to GitHub:**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/telegram-cloud.git
git push -u origin main
```

2. **Deploy on Railway:**
- Go to [railway.app](https://railway.app)
- New Project → Deploy from GitHub
- Select repository
- Add environment variables (from `.env`)
- Deploy automatically starts!

3. **Get your URL:**
- Railway provides: `https://your-app.railway.app`
- Update frontend API URL to this

4. **Test:**
```bash
curl https://your-app.railway.app/health
```

---

## 📱 Update Frontend

After deployment, update your frontend API URL:

```typescript
// lib/api.ts
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://your-app.railway.app',
});
```

Add to frontend `.env.local`:
```env
NEXT_PUBLIC_API_URL=https://your-app.railway.app
```

---

## ✅ Post-Deployment Checklist

- [ ] Backend deployed and running
- [ ] Health check endpoint working
- [ ] Environment variables set
- [ ] Database table created in Supabase
- [ ] CORS configured for frontend domain
- [ ] Login API tested with CURL
- [ ] Protected routes tested
- [ ] Frontend updated with production API URL
- [ ] SSL/HTTPS working
- [ ] Logs accessible
- [ ] Monitoring set up

---

## 🎉 You're Ready to Deploy!

**Recommended:** Use Railway for the easiest deployment experience.

**Build Command:** `npm install`
**Start Command:** `npm start`

That's it! 🚀
