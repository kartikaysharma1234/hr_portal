# HRMS Multi-Tenant Platform (React + TypeScript + Node + Express + MongoDB)

This repository now contains a production-style starter for a **multi-company HRMS** where each company is isolated by **subdomain**.

Example tenant URLs:
- `acme.yourdomain.com`
- `globex.yourdomain.com`

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: MongoDB + Mongoose
- Auth: JWT (access + refresh tokens)
- Multi-tenancy model: **Shared DB, tenant isolation by `organizationId` + subdomain resolution**

## Architecture (Multi-Tenant)

```mermaid
graph TB
    U[User Browser] --> H[tenant.company.com]
    H --> FE[React Client]
    FE --> API[Express API]
    API --> TM[Tenant Middleware]
    TM --> ORG[(organizations)]
    API --> AUTH[Auth Controller]
    AUTH --> USERS[(users)]
    API --> HR[(HR Collections with organizationId)]
```

## How Tenant Resolution Works

1. Frontend resolves company from hostname (`acme.localhost` => `acme`).
2. Frontend sends `x-tenant-subdomain` header on API requests.
3. Backend `resolveTenant` middleware finds `organizations.subdomain`.
4. Backend attaches tenant context to `req.tenant`.
5. Auth/data queries are scoped by `req.tenant.organizationId`.

If there is **no subdomain** (for example `localhost`), the app opens **Super Admin mode**.

## Key Backend Endpoints

- `POST /api/platform/organizations` (platform access protected)
  - Creates organization + initial admin user.
- `GET /api/platform/organizations` (platform access protected)
- `POST /api/platform/auth/login` (super admin login at root domain)
- `POST /api/auth/register` (tenant-aware)
- `POST /api/auth/login` (tenant-aware)
- `POST /api/auth/google-login` (tenant-aware, Google sign-in)
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`
- `POST /api/auth/refresh-token` (tenant-aware, refresh token rotation)
- `POST /api/auth/logout` (tenant-aware, refresh token revoke)
- `GET /api/auth/me` (tenant-aware + JWT)
- `GET /api/employees` (tenant-aware + RBAC)
- `GET /api/employees/:id` (tenant-aware + RBAC)
- `POST /api/employees` (tenant-aware + RBAC)
- `PUT /api/employees/:id` (tenant-aware + RBAC)
- `DELETE /api/employees/:id` (tenant-aware + RBAC)

## Project Structure

```text
hr_portal/
  client/                    # React + TypeScript app
  server/                    # Express + TypeScript API
  package.json               # Workspace scripts
```

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure backend env

Copy `server/.env.example` to `server/.env` and set values.

Required additions for platform onboarding:
- `PLATFORM_ADMIN_KEY=your-secret-key`
- `SUPER_ADMIN_EMAIL=superadmin@hrms.local`
- `SUPER_ADMIN_PASSWORD=ChangeMeStrong`
- `GOOGLE_CLIENT_ID=...` (required for Google login)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (for real email delivery)

If SMTP is not configured, emails are mocked to server logs for local development.

### 3. Configure frontend env

Copy `client/.env.example` to `client/.env`.

Default local values already support subdomains under `localhost`.

### 4. Run app

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

### 5. Create a company tenant (PowerShell)

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:5000/api/platform/organizations" `
  -Headers @{ "x-platform-key" = "your-secret-key" } `
  -ContentType "application/json" `
  -Body '{
    "name": "Acme Corp",
    "subdomain": "acme",
    "adminName": "Acme Admin",
    "adminEmail": "admin@acme.com",
    "adminPassword": "Pass@12345"
  }'
```

### 6. Open tenant portal

- `http://acme.localhost:5173/login`

Login with the tenant admin credentials you created.

### 7. Super admin portal (root domain)

- `http://localhost:5173/super-admin/login`

Use `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from `server/.env`.

## Deployment Notes for Real Subdomains

- Configure wildcard DNS:
  - `*.yourdomain.com` -> Frontend/load balancer
  - `api.yourdomain.com` -> Backend/load balancer
- Keep `ALLOWED_ROOT_DOMAIN=yourdomain.com` in backend env.
- Ensure proxy forwards original host (`x-forwarded-host`).
- Use HTTPS everywhere and secure cookie/token practices in production.

## What is Scaffolded vs Remaining

### Included now
- Tenant detection (frontend + backend)
- Company onboarding endpoint
- Tenant-aware auth flow
- Refresh token persistence + rotation + logout revoke
- Tenant-scoped employee CRUD module
- Forgot password + reset password
- Email verification for new user registration
- Google login for tenant users
- TypeScript workspace setup
- Login UI inspired by your reference design

### Next implementation steps
- Remaining HR modules: attendance, leave, payroll, claims, reports
- RBAC permission matrix expansion and audit logs
- Per-tenant branding and config UI
- CI/CD + test suite + observability
