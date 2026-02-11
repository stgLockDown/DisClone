# Railway Deployment Instructions

## ⚠️ IMPORTANT: Use PostgreSQL on Railway

Railway deployments were experiencing issues with SQLite's native module compilation. **PostgreSQL is the recommended database for Railway.**

---

## 🚀 Step-by-Step Deployment

### 1. Deploy from GitHub

1. Go to [railway.app](https://railway.app) and sign in
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Choose **stgLockDown/DisClone**
5. Click **Deploy**

Railway will automatically:
- Detect Node.js
- Run `npm install`
- Start the server with `node server/index.js`

### 2. Add PostgreSQL Database

**This step is REQUIRED for Railway:**

1. In your Railway project, click **+ New**
2. Select **Database** → **Add PostgreSQL**
3. Railway creates a PostgreSQL instance
4. Railway automatically sets the `DATABASE_URL` environment variable

### 3. Configure Environment Variables

Go to your Nexus Chat service → **Variables** tab and add:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_TYPE` | `postgres` | ✅ **REQUIRED** |
| `JWT_SECRET` | *(see below)* | ✅ **REQUIRED** |
| `NODE_ENV` | `production` | ✅ **REQUIRED** |
| `BCRYPT_ROUNDS` | `12` | Recommended |
| `ALLOWED_ORIGINS` | Your domain(s) | Optional |

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and paste it as the `JWT_SECRET` value.

### 4. Verify Deployment

After setting environment variables, Railway will automatically redeploy.

**Check the logs:**
```
=== NEXUS CHAT STARTING ===
[Server] Starting Nexus Chat...
[Server] Environment: production
[Server] Database type: postgres
[Server] PORT: XXXX
[Server] HTTP server listening on 0.0.0.0:XXXX
[Server] Initializing database...
[DB] Connected to PostgreSQL
...
========================================
  NEXUS CHAT v3.2.0
  PRODUCTION
  http://0.0.0.0:XXXX
  DB: postgres
========================================
```

### 5. Test Your Deployment

Railway provides a public URL (e.g., `https://nexus-chat-production.up.railway.app`)

**Test the health endpoint:**
```bash
curl https://your-app.up.railway.app/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "version": "3.2.0",
  "database": "postgres",
  "env": "production"
}
```

---

## 🔧 Troubleshooting

### "Service Unavailable" Error

**Cause:** Environment variables not set correctly.

**Solution:**
1. Verify `DATABASE_TYPE=postgres` is set
2. Verify `JWT_SECRET` is set (64+ character random string)
3. Verify `NODE_ENV=production` is set
4. Check that PostgreSQL service is running
5. Restart the deployment

### No Logs Appearing

**Cause:** Application crashed before logging.

**Solution:**
1. Check Railway logs for error messages
2. Verify all environment variables are set
3. Ensure PostgreSQL service is connected
4. Check that `DATABASE_URL` is automatically set by Railway

### Database Connection Failed

**Cause:** PostgreSQL not added or `DATABASE_TYPE` not set.

**Solution:**
1. Add PostgreSQL service in Railway dashboard
2. Set `DATABASE_TYPE=postgres`
3. Verify `DATABASE_URL` is present in environment variables (Railway sets this automatically)
4. Redeploy

---

## 📊 What You Get

### Default Demo Users
All can login with password: `password123`

- **alexr#1234** - Server Admin
- **mayac#5678** - Moderator
- **jordanl#9012** - Member
- **samt#3456** - Member
- **rileyk#7890** - Member

### Features
- ✅ Real-time messaging with Socket.IO
- ✅ Server & channel management
- ✅ Direct messages & friend system
- ✅ Reactions & typing indicators
- ✅ User profiles & presence
- ✅ JWT authentication
- ✅ Rate limiting & security

---

## 🌐 Custom Domain (Optional)

1. In Railway → Your Service → **Settings**
2. Scroll to **Domains**
3. Click **Generate Domain** or **Custom Domain**
4. If using custom domain, update your DNS records as instructed
5. Update `ALLOWED_ORIGINS` environment variable with your domain

---

## 💰 Railway Pricing

- **Hobby Plan**: $5/month for 500 hours
- **Pro Plan**: $20/month for unlimited hours

Typical usage for Nexus Chat:
- Web service: ~$5/month
- PostgreSQL: ~$5/month
- **Total: ~$10/month**

---

## 📝 Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_TYPE` | Database type (`postgres` or `sqlite`) | `sqlite` | ✅ Yes (use `postgres`) |
| `DATABASE_URL` | PostgreSQL connection string | Auto-set by Railway | Auto |
| `JWT_SECRET` | Secret for JWT token signing | None | ✅ Yes |
| `NODE_ENV` | Environment (`production` or `development`) | `development` | ✅ Yes |
| `PORT` | Server port | `8080` | Auto-set by Railway |
| `BCRYPT_ROUNDS` | Password hashing rounds | `10` | No |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | `*` | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | `60000` | No |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` | No |

---

## ✅ Deployment Checklist

- [ ] Repository deployed to Railway
- [ ] PostgreSQL service added
- [ ] `DATABASE_TYPE=postgres` set
- [ ] `JWT_SECRET` generated and set
- [ ] `NODE_ENV=production` set
- [ ] Deployment successful (check logs)
- [ ] Health endpoint responding
- [ ] Can register new user
- [ ] Can login
- [ ] Can send messages

---

## 🆘 Support

- **GitHub Issues**: https://github.com/stgLockDown/DisClone/issues
- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway

---

**Status**: ✅ Ready for Railway deployment with PostgreSQL  
**Version**: v3.2.0  
**Last Updated**: 2026-02-11