# Deploying CodeForge-Judge-Online to AWS

This app has two parts:

| Part | Tech | Recommended AWS service |
|---|---|---|
| API + judge | Node/Express, MySQL, local process sandbox | **Elastic Beanstalk (single instance)** or **ECS Fargate + ALB** |
| Web UI | React + Vite (static build) | **S3 + CloudFront** (or **Amplify Hosting**) |
| Database | MySQL | **Amazon RDS for MySQL** (or keep Aiven) |

> Important: the judge runs user code as local child processes (`JUDGE_MODE=local`). Run the API on a normal EC2/ECS instance with a single task, not on Lambda. The in-memory judge queue also requires a single API instance (or replace it with SQS).

---

## 1. Database (RDS MySQL)

1. RDS → Create database → **MySQL 8.x**, `db.t4g.micro` (free tier eligible).
2. Set master username/password, create database `codeforge`.
3. Security group: allow inbound `3306` **only** from the API security group.
4. Copy the endpoint, e.g. `codeforge.xxxxxx.us-east-1.rds.amazonaws.com`.
5. Set `DB_SSL=true` (RDS supports TLS; the app already uses `rejectUnauthorized:false`).

The server auto-migrates and seeds problems, contests and test cases on startup.

---

## 2. Backend on Elastic Beanstalk (simplest)

### 2.1 Prepare the bundle

From the repository root:

```bash
cd server
npm ci --omit=dev
cd ..
```

Create `server/Procfile`:

```
web: node src/index.js
```

Create `.ebextensions/01_env.config` (optional, for Node version):

```yaml
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeVersion: 20
```

Zip the **server folder only** (include `package.json`, `src/`, `node_modules/`, `Procfile`):

```bash
# from repo root
Compress-Archive -Path server\* -DestinationPath server-deploy.zip -Force
```

### 2.2 Create the environment

Install EB CLI, then:

```bash
pip install awsebcli
eb init codeforge-api --platform "Node.js 20" --region us-east-1
eb create codeforge-api-prod --single --instance-type t3.small
```

`--single` avoids a load balancer and keeps the in-memory queue consistent.

### 2.3 Environment variables

```bash
eb setenv \
  NODE_ENV=production \
  PORT=8080 \
  JWT_SECRET="<long-random-secret>" \
  CLIENT_URL="https://your-frontend-domain" \
  DB_HOST="codeforge.xxxxxx.us-east-1.rds.amazonaws.com" \
  DB_PORT=3306 \
  DB_NAME=codeforge \
  DB_USER=admin \
  DB_PASSWORD="<db-password>" \
  DB_SSL=true \
  JUDGE_MODE=local \
  JUDGE_CONCURRENCY=2
```

Deploy and check:

```bash
eb deploy
eb open            # or curl http://<eb-host>/api/health
```

Health check path: `/health`.

### 2.4 Judge sandbox notes

- `judge.js` writes temp files and spawns `node`/`python3`/`g++`/`java`. On Amazon Linux 2023 install them:
  `.platform/hooks/prebuild/01_deps.sh`:
  ```bash
  #!/bin/bash
  dnf install -y gcc-c++ python3 java-17-amazon-corretto-headless || true
  ```
  make it executable (`chmod +x`).
- Restrict the instance role to only what it needs; do not give the judge process broad IAM permissions.
- For production isolation, switch `JUDGE_MODE=judge0` and point `JUDGE0_BASE_URL` at a dedicated Judge0 instance.

---

## 3. Frontend on S3 + CloudFront

### 3.1 Build with the API URL

`client/.env.production`:

```
VITE_API_BASE_URL=https://api.yourdomain.com/api
```

```bash
cd client
npm ci
npm run build        # outputs client/dist
```

### 3.2 Host it

```bash
aws s3 mb s3://codeforge-frontend-prod
aws s3 sync dist/ s3://codeforge-frontend-prod --delete
```

Create a CloudFront distribution:

- Origin: the S3 bucket (use Origin Access Control)
- Default root object: `index.html`
- Custom error response: **403/404 → /index.html with 200** (needed for React Router)
- Optional: attach ACM certificate + custom domain

If you prefer managed hosting, use **AWS Amplify Hosting**: connect the Git repo, set root `client`, build `npm run build`, output `dist`, and add `VITE_API_BASE_URL`.

### 3.3 CORS

Set the backend `CLIENT_URL` to the CloudFront/Amplify URL so Express allows the browser origin.

---

## 4. Alternative: ECS Fargate (containers)

Add `Dockerfile` at repo root:

```dockerfile
FROM node:20-bookworm
RUN apt-get update && apt-get install -y python3 g++ default-jdk && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
ENV PORT=8080 NODE_ENV=production
EXPOSE 8080
CMD ["node", "src/index.js"]
```

Then:

```bash
aws ecr create-repository --repository-name codeforge-api
docker build -t codeforge-api .
docker tag codeforge-api:latest <account>.dkr.ecr.us-east-1.amazonaws.com/codeforge-api:latest
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/codeforge-api:latest
```

Create an ECS Fargate service behind an ALB, **desired count = 1**, env vars as above, health check `/health`.

---

## 5. Checklist

- [ ] RDS reachable from the API security group only
- [ ] `JWT_SECRET`, DB password stored as EB/ECS secrets (or SSM Parameter Store), not in git
- [ ] `CLIENT_URL` matches the frontend domain exactly
- [ ] `VITE_API_BASE_URL` points to the API and includes `/api`
- [ ] `/api/health` returns `{"status":"ok","database":"connected"}`
- [ ] Login works and `samdavid17333@gmail.com` is an admin
- [ ] Judge instance has node/python/g++/java installed
- [ ] CloudFront routes SPA 403/404 to `index.html`
