# Render Deployment (Manual)
Set Root Directory to `server` (if using manual setup), or use render.yaml.

Build Command: `npm install`
Start Command: `node src/index.js`
Health Check Path: `/health`# Online MySQL options:
# 1. Aiven - https://aiven.io/ (free tier)
# 2. PlanetScale - https://planetscale.com/ (free)
# 3. Railway MySQL - https://railway.app/
# 4. TiDB Cloud - https://tidbcloud.com/
# 5. db4free.net - https://www.db4free.net/ (free for testing)

# For Render with external MySQL, set DATABASE_URL:
# mysql://username:password@host:port/database_name
