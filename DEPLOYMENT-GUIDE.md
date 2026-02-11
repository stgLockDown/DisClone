# Railway Deployment Guide — Nexus Chat v3.2.0

## Status: ✅ READY FOR DEPLOYMENT

Your GitHub repository is set up at:
**https://github.com/stgLockDown/DisClone**

---

## 📋 Deployment Checklist

- [x] Code pushed to GitHub
- [x] Railway configuration files added (`railway.toml`, `Procfile`)
- [x] Root `package.json` with correct start script
- [x] `.env.example` with all required variables
- [x] PostgreSQL support enabled
- [x] Health check endpoint at `/api/health`
- [x] Comprehensive README.md

---

## 🚀 Step-by-Step Deployment

### 1. Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Sign up/login with your GitHub account
3. Click **New Project**
4. Select **Deploy from GitHub**
5. Find and select `stgLockDown/DisClone`
6. Click **Deploy Now**

Railway will:
- Detect Node.js automatically
- Run `npm install` to install dependencies
- Execute `node server/index.js` to start the server
- Assign a public URL (like `https://nexus-chat.up.railway.app`)

### 2. Add PostgreSQL Database (Recommended)

1. In your Railway project, click **+ New Service**
2. Select **PostgreSQL** from the template gallery
3. Railway creates a PostgreSQL instance
4. The `DATABASE_URL` environment variable is auto-set

### 3. Configure Environment Variables

Go to: **Project Settings → Variables**

Add these variables:

| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `JWT_SECRET` | *(generate below)* | ✅ Yes | Must be 64+ random chars |
| `NODE_ENV` | `production` | ✅ Yes | Enables production mode |
| `DATABASE_TYPE` | `postgres` | ✅ Yes | Use PostgreSQL (recommended) |
| `BCRYPT_ROUNDS` | `12` | No | Security for passwords |
| `ALLOWED_ORIGINS` | *(see below)* | No | For CORS if needed |

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**For ALLOWED_ORIGINS:**
- Leave blank for all origins (open)
- Or set to: `https://yourdomain.com,https://www.yourdomain.com`
- Comma-separated list if multiple domains

### 4. Restart the Service

After adding environment variables:
1. Go to the Nexus Chat service in Railway
2. Click **Restart** to apply changes
3. Wait for the deployment to complete (usually 1-2 minutes)

### 5. Verify Deployment

Once deployed, your app should be accessible at:
- Check the Railway dashboard for your public URL
- Visit the URL — you should see the Nexus Chat login screen
- Test the health check: `https://your-url.railway.app/api/health`

---

## 🧪 Testing Your Deployment

### Test Health Check
```bash
curl https://your-app.up.railway.app/api/health
```

Should return:
```json
{
  "status": "ok",
  "version": "3.2.0",
  "database": "postgres",
  "env": "production"
}
```

### Test Registration
```bash
curl -X POST https://your-app.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "displayName": "Test User",
    "username": "testuser",
    "password": "securepass123"
  }'
```

### Test Login
```bash
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "securepass123"
  }'
```

---

## 📊 Railway Dashboard Overview

Your Railway project will have:

1. **Nexus Chat Service**
   - Type: Web Service
   - Runtime: Node.js
   - Port: 8080
   - Status: Active

2. **PostgreSQL Service** (if added)
   - Type: Database
   - Type: PostgreSQL
   - Connection: Auto-configured

3. **Environment Variables**
   - `JWT_SECRET` — Required
   - `NODE_ENV` — `production`
   - `DATABASE_TYPE` — `postgres`
   - `DATABASE_URL` — Auto-set

4. **Metrics**
   - CPU usage
   - Memory usage
   - Request count
   - Response time

---

## 🔧 Troubleshooting

### "JWT_SECRET not set"
- Go to Project Settings → Variables
- Add `JWT_SECRET` with a random 64-char string
- Restart the service

### "Database connection failed"
- Ensure `DATABASE_TYPE` is set to `postgres`
- Check that PostgreSQL service is running
- Verify `DATABASE_URL` is set (auto by Railway)

### "Port already in use"
- This shouldn't happen on Railway
- Railway assigns ports automatically
- Check your `railway.toml` has `internal_port = 8080`

### App won't start
- Check deployment logs in Railway
- Look for "Uncaught exception" errors
- Verify `package.json` has correct `start` script
- Ensure all dependencies are in `dependencies` (not `devDependencies`)

---

## 🌐 Custom Domain (Optional)

1. In Railway → Project Settings → Domains
2. Click **+ New Domain**
3. Enter your domain (e.g., `chat.yourdomain.com`)
4. Update DNS records as instructed by Railway
5. Set `ALLOWED_ORIGINS` to your custom domain

---

## 💰 Railway Pricing

- **Free Tier**: $5/month credit (great for testing)
- **Paid**: $5/month per service after free tier
- For production, expect ~$10/month:
  - $5 for Nexus Chat service
  - $5 for PostgreSQL

---

## 📝 What's Included

### Backend Features
- ✅ Express + Socket.IO server
- ✅ SQLite or PostgreSQL database
- ✅ JWT authentication
- ✅ Real-time messaging
- ✅ Server & channel management
- ✅ Direct messages & friends
- ✅ Reactions & typing indicators
- ✅ Presence system
- ✅ Rate limiting & security

### Frontend Features
- ✅ Discord-like UI
- ✅ Dark/light themes
- ✅ Server & channel navigation
- ✅ Real-time message updates
- ✅ User profiles
- ✅ Voice channels (UI ready)
- ✅ Twitch integration
- ✅ Watch parties

---

## 🎯 Next Steps

1. **Deploy to Railway** (follow steps above)
2. **Test the deployment** (register, login, send messages)
3. **Add custom domain** (optional)
4. **Monitor metrics** in Railway dashboard
5. **Set up monitoring/alerts** (optional)
6. **Invite users** and gather feedback!

---

## 📞 Support

- GitHub Issues: https://github.com/stgLockDown/DisClone/issues
- Railway Docs: https://docs.railway.app

---

**Deployment Status**: ✅ Ready to deploy
**Repository**: https://github.com/stgLockDown/DisClone
**Version**: v3.2.0