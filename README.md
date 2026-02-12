# Nexus Chat v3.2.0

A full-featured real-time chat platform with Discord-like features, built with Express, Socket.IO, and SQLite/PostgreSQL.

## ✨ Latest Updates

### 🔐 Authentication System
- **Sign-up first experience** - New users must create an account before accessing the app
- **Stay signed in** - Optional persistent login across browser sessions
- **Session management** - Secure token-based authentication with JWT
- **Auto-login** - Returning users with "stay signed in" enabled are automatically logged in

### 🎯 Standard Hub System
Every server now includes **5 built-in hub categories**:
- **🎮 Gaming Hub** - Gaming discussions, LFG, game nights, voice channels
- **🎵 Music Vibes** - Music chat, track sharing, listening parties
- **⚡ Dev Hub** - Developer discussions, code help, project showcase
- **🎨 Art Hub** - Art community, artwork showcase, feedback
- **📺 Streamer Hub** - Streaming chat, schedules, watch parties, stream rooms

All hubs are **collapsible** and come with pre-configured text and voice channels.

## Features

- **Real-time messaging** — Instant message delivery, typing indicators, presence system
- **Servers & Channels** — Create servers with categories, text channels, and voice channels
- **Direct Messages** — Private conversations and friend requests
- **Authentication** — JWT tokens with bcrypt password hashing
- **Reactions** — Emoji reactions on messages
- **Profiles** — Custom avatars, status, about me, colors
- **Security** — Helmet headers, rate limiting, CORS protection
- **Database** — SQLite (default) or PostgreSQL (Railway/scaling)

## Tech Stack

- **Backend**: Node.js + Express
- **Real-time**: Socket.IO
- **Database**: SQLite (better-sqlite3) or PostgreSQL (pg)
- **Auth**: JWT + bcryptjs
- **Security**: Helmet, compression, express-rate-limit

## Quick Start (Local)

```bash
# Clone the repo
git clone https://github.com/stgLockDown/DisClone.git
cd DisClone

# Install dependencies
npm install

# Set environment variables (copy .env.example to .env)
cp .env.example .env

# Start the server
npm start

# Open http://localhost:8080
```

## Railway Deployment

### 1. Deploy from GitHub

1. Go to [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub**
3. Select the `stgLockDown/DisClone` repository
4. Railway auto-detects Node.js and deploys

### 2. Add a PostgreSQL Database (Recommended)

1. In Railway project, click **+ New Service**
2. Select **PostgreSQL**
3. Railway will create a database and set `DATABASE_URL`

### 3. Set Environment Variables

In Railway → Project Settings → Variables:

| Variable | Value | Required |
|----------|-------|----------|
| `JWT_SECRET` | Generate a random 64-char string | ✅ Yes |
| `NODE_ENV` | `production` | Yes |
| `DATABASE_TYPE` | `postgres` (if using Railway DB) or `sqlite` | Yes |
| `DATABASE_URL` | Auto-set by Railway (if using PostgreSQL) | No |
| `BCRYPT_ROUNDS` | `12` | No |
| `ALLOWED_ORIGINS` | Your domain(s), comma-separated | No |

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Expose the Service

1. Railway automatically exposes HTTP on port 8080
2. Get your public URL from the Railway dashboard
3. Custom domains can be added in Railway settings

### 5. Health Check

The app includes `/api/health` endpoint for Railway health checks:

```json
{
  "status": "ok",
  "version": "3.2.0",
  "uptime": 1234.56,
  "timestamp": "2025-02-11T12:00:00.000Z",
  "database": "postgres",
  "env": "production"
}
```

## API Endpoints

### Authentication
- `POST /api/auth/register` — Create new account
- `POST /api/auth/login` — Login with email/password
- `POST /api/auth/logout` — Invalidate token
- `GET /api/auth/me` — Get current user
- `PATCH /api/auth/me` — Update profile

### Servers
- `GET /api/servers` — List user's servers
- `POST /api/servers` — Create server
- `GET /api/servers/:id` — Get server details
- `PATCH /api/servers/:id` — Update server
- `DELETE /api/servers/:id` — Delete server
- `POST /api/servers/:id/join` — Join server
- `POST /api/servers/:id/leave` — Leave server

### Channels & Messages
- `GET /api/channels/:id/messages` — Get channel messages (paginated)
- `POST /api/channels/:id/messages` — Send message
- `PATCH /api/messages/:id` — Edit message
- `DELETE /api/messages/:id` — Delete message
- `POST /api/messages/:id/reactions` — Add reaction
- `DELETE /api/messages/:id/reactions/:emoji` — Remove reaction

### Friends & DMs
- `GET /api/friends` — List friends (accepted, pending, blocked)
- `POST /api/friends/request` — Send friend request
- `POST /api/friends/accept/:id` — Accept request
- `POST /api/friends/decline/:id` — Decline request
- `DELETE /api/friends/:id` — Remove friend
- `POST /api/friends/block/:id` — Block user
- `GET /api/dms` — List DM channels
- `POST /api/dms` — Create DM channel

## WebSocket Events

### Client → Server
- `join_channel` — Join a channel room
- `leave_channel` — Leave a channel room
- `typing_start` — User starts typing
- `typing_stop` — User stops typing
- `voice_state_update` — Voice channel state
- `presence_update` — User presence status

### Server → Client
- `message:new` — New message received
- `message:edit` — Message edited
- `message:delete` — Message deleted
- `reaction:add` — Reaction added
- `reaction:remove` — Reaction removed
- `typing:start` — User started typing
- `typing:stop` — User stopped typing
- `presence:update` — User presence changed
- `friend:request` — New friend request
- `friend:accept` — Friend request accepted
- `server:member_join` — New member joined server

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_TYPE` | `sqlite` or `postgres` | `sqlite` |
| `DATABASE_URL` | PostgreSQL connection string | (none) |
| `DATABASE_PATH` | SQLite file path | `./server/nexus.db` |
| `JWT_SECRET` | Secret for JWT signing | (required in prod) |
| `JWT_EXPIRES_IN` | Token expiration | `7d` |
| `BCRYPT_ROUNDS` | Password hash rounds | `10` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `*` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

## Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# View logs
tail -f server.log

# Reset database
rm server/nexus.db* && npm start
```

## Project Structure

```
├── server/
│   ├── index.js           # Main Express server
│   ├── database.js        # SQLite/PostgreSQL abstraction
│   ├── websocket.js       # Socket.IO handlers
│   ├── middleware/
│   │   └── auth.js        # JWT auth middleware
│   └── routes/
│       ├── auth.js        # Auth endpoints
│       ├── servers.js     # Server endpoints
│       ├── messages.js    # Message endpoints
│       └── friends.js     # Friend endpoints
├── index.html             # Main app HTML
├── app.js                 # Frontend app logic
├── api-client.js          # API client wrapper
├── backend-bridge.js      # Frontend→backend bridge
├── social.js              # Auth & social features
└── package.json           # Dependencies
```

## Default Users

After first startup, the database seeds with demo users:

| Email | Username | Password |
|-------|----------|----------|
| alex@nexus.chat | alexr#1234 | password123 |
| maya@nexus.chat | mayac#5678 | password123 |
| jordan@nexus.chat | jordanl#9012 | password123 |
| sam@nexus.chat | samt#3456 | password123 |
| riley@nexus.chat | rileyk#7890 | password123 |
| drew@nexus.chat | drewp#6789 | password123 |
| avery@nexus.chat | averyb#0123 | password123 |
| taylor@nexus.chat | taylorf#4567 | password123 |
| casey@nexus.chat | caseym#2345 | password123 |

**Note:** On first launch, you'll see the sign-up screen. You can either:
- Create a new account
- Or use one of the demo accounts above to log in

## 🚀 Live Demo

The app is currently running at: **https://nexuschat-0035i.app.super.myninja.ai**

Try it out with any of the demo accounts above!

## 📝 Deployment Notes

### Database
- The app automatically detects and uses PostgreSQL if `DATABASE_URL` is set
- Falls back to SQLite for local development
- All servers automatically get the 5 standard hubs on creation

### Authentication
- First-time users must sign up before accessing the app
- "Stay signed in" checkbox controls session persistence
- JWT tokens stored in localStorage (persistent) or sessionStorage (session-only)

### Standard Hubs
- Every server includes 5 pre-configured hub categories
- Hubs are added automatically when creating new servers
- Existing servers can be migrated using `node add-hubs-migration.js`

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.