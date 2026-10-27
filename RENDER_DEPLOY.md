# Render Deployment for CodeTest

## Backend (Web Service)
- Root Directory: (leave empty or set to repo root)
- Build Command: `npm install --prefix server`
- Start Command: `node server/src/index.js`
- Health Check Path: `/health`

## Environment Variables (required)
- NODE_ENV=production
- PORT=5000 (Render sets this automatically)
- JWT_SECRET=your_strong_secret
- CLIENT_URL=https://your-frontend-url.onrender.com
- DATABASE_URL=mysql://user:password@host:port/database_name
- JUDGE_CONCURRENCY=2

The server auto-migrates schema on startup.
