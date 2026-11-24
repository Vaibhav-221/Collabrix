# Collabrix

**Student Groups & Assignment Management System**

Collabrix is a full-stack, role-based academic collaboration platform designed to streamline student project groups, coordinate assignment lifecycles, and track verified submissions.

Coursework deliverables (documents, slide decks, archives) are hosted on external institutional drives (specifically **Microsoft OneDrive**). Rather than duplicating cloud storage infrastructure, Collabrix acts as the workflow coordinator, assignment tracker, and verified submission ledger with an immutable audit trail.

---

## Table of Contents

- [Collabrix](#collabrix)
  - [Table of Contents](#table-of-contents)
  - [System Overview \& Architecture](#system-overview--architecture)
  - [Key Features](#key-features)
    - [Student Functionality](#student-functionality)
    - [Professor / Admin Functionality](#professor--admin-functionality)
    - [Two-Step Submission Workflow](#two-step-submission-workflow)
    - [Assignment Targeting](#assignment-targeting)
  - [Technology Stack](#technology-stack)
  - [Database Schema \& Invariants](#database-schema--invariants)
  - [API Endpoints Reference](#api-endpoints-reference)
  - [Environment Configuration](#environment-configuration)
  - [Local Development Setup](#local-development-setup)
    - [Prerequisites](#prerequisites)
    - [Option 1: Quickstart with Docker Compose (Recommended)](#option-1-quickstart-with-docker-compose-recommended)
    - [Option 2: Standalone Local Setup](#option-2-standalone-local-setup)
  - [Deployment Guide (Vercel \& Render)](#deployment-guide-vercel--render)
    - [Where to Deploy Each Tier](#where-to-deploy-each-tier)
    - [Step 1: Deploy PostgreSQL Database on Render](#step-1-deploy-postgresql-database-on-render)
    - [Step 2: Deploy Express Backend API on Render](#step-2-deploy-express-backend-api-on-render)
    - [Step 3: Deploy Frontend SPA on Vercel](#step-3-deploy-frontend-spa-on-vercel)
    - [Step 4: Cross-Origin \& Cookie Security in Production](#step-4-cross-origin--cookie-security-in-production)
  - [Security Architecture](#security-architecture)
  - [License](#license)

---

## System Overview & Architecture

Collabrix is designed as a decoupled multi-tier architecture:

```
[ Client Browser ]
  │
  ├── (Vercel CDN) ──▶ React 18 SPA (Vite + Tailwind CSS + shadcn/ui)
  │                      │
  │                      ▼ (REST API / JSON / HttpOnly JWT Cookie or Bearer Token)
  └── (Render) ──────▶ Express.js REST API (Node.js 20 LTS)
                         │
                         ▼ (TCP / Parameterized SQL via node-postgres pool)
                       PostgreSQL 16 Database (Render Managed PostgreSQL)
```

1. **Frontend**: Lightweight Single Page Application built with React 18, Vite, Tailwind CSS, shadcn/ui components, and Lucide icons.
2. **Backend**: Stateless REST API built with Node.js 20 LTS and Express.js, handling authentication, business logic, role-based authorization, and audit logs.
3. **Database**: PostgreSQL 16 enforcing strict relational integrity, enums, unique single-group membership constraints, and audit timestamps.
4. **Deliverables Storage**: Hosted on external Microsoft OneDrive folders provided by instructors, preventing heavy file transfer and storage overhead on application servers.

---

## Key Features

### Student Functionality
- **Self-Registration & Authentication**: Student registration via University Email, Full Name, Student ID, and Password. Secure session management via JWT.
- **Group Formation & Management**:
  - Create project groups (creator automatically becomes Group Leader).
  - Invite peers by University Email or Student ID.
  - Review incoming invitations and accept/decline.
  - **Single Group Invariant**: A student can strictly belong to **one active group at a time**, enforced at the database level.
- **Assignment Discovery**: View all active coursework targeted either class-wide or specifically to the student's group.
- **External OneDrive Integration**: Safe one-click external navigation to the professor's shared OneDrive submission folder (`target="_blank" rel="noopener noreferrer"`).
- **Two-Step Submission**: Complete verified acknowledgment and final confirmation.

### Professor / Admin Functionality
- **Administrative Access**: Pre-provisioned system account provisioned via secure database seeding (`seed.sql`).
- **Assignment Management (CRUD)**:
  - Create assignments with Title, Guidelines/Description, UTC Due Date, and validated HTTPS OneDrive folder link.
  - Target assignments to **All Groups** or **Specific Project Groups**.
  - Edit active assignments or soft-delete (archive) completed ones to preserve submission history.
- **Real-Time Submission Tracking**: View a live ledger per assignment tracking group confirmation state, submitting student, submission timestamps, and automatic on-time/late indicators.
- **Performance Analytics**: Real-time KPI summaries including overall completion rates, on-time vs. late breakdown, and group-by-group performance metrics.

---

### Two-Step Submission Workflow

The platform enforces a strict, two-step submission confirmation lifecycle:

```
[ NOT_STARTED ] ──▶ (Step 1: Upload Acknowledgment) ──▶ [ STEP_1_ACKNOWLEDGED ]
                                                              │
                                                              ▼ (Step 2: Final Confirmation)
                                                        [ CONFIRMED ]
```

1. **`NOT_STARTED`**: No row exists in the `submissions` table. Viewing or opening an assignment never creates a submission record.
2. **`STEP_1_ACKNOWLEDGED`**: Recorded via `POST /api/assignments/:id/acknowledge`. The student confirms their group has completed uploading deliverables to OneDrive. Timestamped at `step_one_acknowledged_at`.
3. **`CONFIRMED`**: Recorded via `POST /api/assignments/:id/confirm`. Locks the submission from further changes, records `confirmed_by` and `confirmed_at`.
4. **Server-Derived Lateness**: Submission lateness is calculated dynamically on the server:
   ```javascript
   const isLate = submission.status === 'confirmed' && new Date(submission.confirmed_at) > new Date(assignment.due_date);
   ```
   *Lateness is a derived presentation flag, not a lifecycle state.*

---

### Assignment Targeting

Assignments support two distribution types:
- **`all`**: Automatically assigned to every project group.
- **`specific_groups`**: Assigned selectively to specified groups through the `assignment_targets` join table without duplicating assignment records.

---

## Technology Stack

| Layer | Technologies | Key Rationale |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, shadcn/ui, React Router v6, Axios, Lucide React | Modern SPA architecture, rapid bundling, accessible UI, seamless client-side routing. |
| **Backend** | Node.js 20 LTS, Express.js 5 | Lightweight, asynchronous, high-throughput REST API runtime. |
| **Database** | PostgreSQL 16, `pg` (node-postgres) | ACID compliance, ENUM types, relational constraints, parameterized queries. |
| **Authentication** | JWT (`jsonwebtoken`), `bcryptjs`, `cookie-parser` | Stateless, cryptographic session validation with HttpOnly cookies & Bearer fallback. |
| **Security** | `express-rate-limit`, `cors` | Rate-limiting brute-force attempts and strict origin enforcement. |
| **DevOps & Containers** | Docker, Docker Compose | Consistent multi-container local and production deployment. |

---

## Database Schema & Invariants

PostgreSQL enforces relational integrity and system invariants:

- **Single Group Rule**: `UNIQUE (user_id)` constraint on `group_members` ensures no student can belong to more than one group at a time.
- **Single Submission per Assignment**: `UNIQUE (assignment_id, group_id)` constraint on `submissions` guarantees one submission audit record per group.
- **Secure OneDrive Links**: Check constraint `onedrive_url ~* '^https://'` requires secure HTTPS links.
- **Safe Soft Deletion**: Assignments flag `is_archived = true` to preserve historical submissions and analytics data.

---

## API Endpoints Reference

All endpoints are prefixed with `/api`.

### Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register a student account |
| `POST` | `/api/auth/login` | Public | Log in and receive JWT token in HttpOnly cookie |
| `POST` | `/api/auth/logout` | Authenticated | Invalidate session / clear cookie |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current authenticated user profile & group status |

### Groups (`/api/groups`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/groups` | Student | Create a new project group (creator becomes Leader) |
| `GET` | `/api/groups/my-group` | Student | Get current group details, members, and leader status |
| `POST` | `/api/groups/invite` | Student (Leader) | Invite peer via University Email or Student ID |
| `GET` | `/api/groups/invitations` | Student | List incoming pending invitations for the student |
| `POST` | `/api/groups/invitations/:id/respond`| Student | Accept or decline a group invitation |
| `DELETE`| `/api/groups/members/:userId` | Student | Remove member (Leader) or leave group (Member) |
| `GET` | `/api/groups` | Professor | List active groups for assignment targeting |

### Assignments (`/api/assignments`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/assignments` | Authenticated | List assignments (filtered for student's group or all for professor) |
| `GET` | `/api/assignments/:id` | Authenticated | Retrieve assignment metadata and submission status |
| `POST` | `/api/assignments` | Professor | Create an assignment with targets (`all` or specific groups) |
| `PUT` | `/api/assignments/:id` | Professor | Update assignment details and targets |
| `DELETE`| `/api/assignments/:id` | Professor | Archive (soft-delete) an assignment |

### Submissions (`/api/assignments/:id/...`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/assignments/:id/acknowledge` | Student | **Step 1**: Acknowledge file upload to OneDrive |
| `POST` | `/api/assignments/:id/confirm` | Student | **Step 2**: Finalize and lock group submission |
| `GET` | `/api/assignments/:id/status` | Student | Check current group submission status |
| `GET` | `/api/admin/assignments/:id/submissions`| Professor | View detailed submission ledger for an assignment |

### Analytics (`/api/analytics`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/analytics/overview` | Professor | Class-wide submission rates and on-time vs. late KPIs |
| `GET` | `/api/analytics/group-performance` | Professor | Group-by-group submission completion breakdown |

### System Health
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Healthcheck verifying API and PostgreSQL connectivity |

---

## Environment Configuration

Collabrix uses environment variables for database configuration, secrets, and CORS origins.

### Root / Backend `.env` Specification

```env
# --- PostgreSQL Database ---
POSTGRES_USER=collabrix_user
POSTGRES_PASSWORD=your_secure_db_password
POSTGRES_DB=collabrix_db
POSTGRES_HOST=db                     # Use 'localhost' for local, 'db' for Docker, or your cloud DB host
POSTGRES_PORT=5432
POSTGRES_HOST_PORT=5432

# --- Backend Application ---
PORT=5000
NODE_ENV=development                # 'development' or 'production'
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
JWT_EXPIRES_IN=7d

# Origin only; DO NOT include trailing slashes or paths
CLIENT_URL=http://localhost:5173

# --- Seeded Professor Account ---
PROFESSOR_SEED_EMAIL=professor@collabrix.edu
PROFESSOR_SEED_PASSWORD=your_professor_password_8_chars_min
PROFESSOR_SEED_NAME=Dr. Robert Vance
```

> **Security Rule**: Never commit `.env` to source control. In production, configure environment variables directly in your hosting dashboard.

---

## Local Development Setup

### Prerequisites
- [Node.js 20 LTS+](https://nodejs.org/)
- [Docker & Docker Compose](https://www.docker.com/) (for containerized setup)
- [PostgreSQL 16](https://www.postgresql.org/) (if running without Docker)

---

### Option 1: Quickstart with Docker Compose (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/collabrix.git
   cd collabrix
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and replace `change_me` values with actual passwords (at least 32 characters for `JWT_SECRET`).

3. **Start services**:
   ```bash
   docker compose up --build
   ```

4. **Verify running services**:
   - Backend API: `http://localhost:5000/api/health`
   - Database: Listening on port `5432`

---

### Option 2: Standalone Local Setup

1. **Set up local PostgreSQL database**:
   Create a database `collabrix_db` and user `collabrix_user`.

2. **Install backend dependencies**:
   ```bash
   cd backend
   npm install
   ```

3. **Run database migrations and seed**:
   ```bash
   npm run db:migrate
   ```

4. **Start the backend development server**:
   ```bash
   npm run dev
   ```

---

## Deployment Guide (Vercel & Render)

### Where to Deploy Each Tier

| Component | Recommended Platform | Why? |
| :--- | :--- | :--- |
| **Frontend SPA (React + Vite)** | **Vercel** | • Global Edge Network and CDN caching<br>• Instant preview deployments per git branch<br>• Optimized for frontend static routing and fast asset delivery |
| **Backend REST API (Express.js)** | **Render** | • Continuous Node.js server support (long-running processes)<br>• Built-in zero-downtime deploys and healthcheck support (`/api/health`)<br>• Native Docker and native Node runtime support |
| **PostgreSQL Database** | **Render PostgreSQL** (or Neon / Supabase) | • Fully managed PostgreSQL 16<br>• Automated backups and secure VPC connectivity<br>• Colocated with Render Web Service for ultra-low latency |

---

### Step 1: Deploy PostgreSQL Database on Render

1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** ➔ **PostgreSQL**.
3. Fill in the database details:
   - **Name**: `collabrix-db`
   - **Database**: `collabrix_db`
   - **User**: `collabrix_user`
   - **Region**: Choose the region closest to your users (e.g., Oregon, Frankfurt).
   - **PostgreSQL Version**: `16`.
4. Click **Create Database**.
5. Once provisioned, note the connection credentials from the **Connections** tab:
   - **Hostname** (Internal / External Host)
   - **Port** (`5432`)
   - **Database Name**
   - **Username**
   - **Password**

---

### Step 2: Deploy Express Backend API on Render

1. On the Render Dashboard, click **New +** ➔ **Web Service**.
2. Connect your Git repository (`Collabrix`).
3. Configure the service settings:
   - **Name**: `collabrix-api`
   - **Region**: Same region as your database.
   - **Branch**: `main`.
   - **Root Directory**: `backend` (or leave blank if deploying via Docker).
   - **Runtime**: **Node** (or **Docker** if using `backend/Dockerfile`).
   - **Build Command**:
     ```bash
     npm install
     ```
   - **Start Command**:
     ```bash
     npm run start:migrate
     ```
     *(This automatically runs schema creation, migrations, and seeds the initial professor account on startup).*
4. Under **Health Check Path**, enter:
   ```
   /api/health
   ```
5. Add the **Environment Variables** under the **Environment** tab:

   | Variable | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `5000` (or leave default, Render sets `PORT` automatically) |
   | `POSTGRES_HOST` | Hostname from Render PostgreSQL (*use Internal Host for faster internal connection*) |
   | `POSTGRES_PORT` | `5432` |
   | `POSTGRES_DB` | `collabrix_db` |
   | `POSTGRES_USER` | `collabrix_user` |
   | `POSTGRES_PASSWORD` | Database password from Render PostgreSQL |
   | `JWT_SECRET` | Strong random secret (64+ characters) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `CLIENT_URL` | Your Vercel frontend URL, e.g., `https://collabrix.vercel.app` (*no trailing slash*) |
   | `PROFESSOR_SEED_EMAIL`| `professor@youruniversity.edu` |
   | `PROFESSOR_SEED_PASSWORD` | Strong password (at least 8 characters) |
   | `PROFESSOR_SEED_NAME` | `Dr. Robert Vance` |

6. Click **Deploy Web Service**.
7. Once deployed, note your backend public URL (e.g., `https://collabrix-api.onrender.com`). Verify it by visiting `https://collabrix-api.onrender.com/api/health`.

---

### Step 3: Deploy Frontend SPA on Vercel

1. Log in to [Vercel](https://vercel.com/).
2. Click **Add New...** ➔ **Project**.
3. Import your Git repository.
4. Configure Project Settings:
   - **Framework Preset**: **Vite** (or React).
   - **Root Directory**: `frontend`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Configure Environment Variables in Vercel:
   | Variable | Value |
   | :--- | :--- |
   | `VITE_API_URL` | Your Render Backend URL, e.g., `https://collabrix-api.onrender.com` |
6. Ensure Single Page Application routing rewrite is configured (e.g., in `frontend/vercel.json`):
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
7. Click **Deploy**.
8. Once deployed, copy your production Vercel URL (e.g., `https://collabrix.vercel.app`) and ensure it matches the `CLIENT_URL` environment variable on your Render backend.

---

### Step 4: Cross-Origin & Cookie Security in Production

When deploying frontend and backend on separate domains (`*.vercel.app` and `*.onrender.com`):

1. **Origin Verification (`CLIENT_URL`)**:
   The backend strictly verifies CORS origin against `CLIENT_URL`. Ensure `CLIENT_URL` contains the protocol and domain without trailing slashes or subpaths:
   ```env
   CLIENT_URL=https://collabrix.vercel.app
   ```
2. **Cross-Site Cookies**:
   - Modern browsers treat cookies set across different registrar domains as third-party.
   - For cross-site cookie transmission, production cookies require `sameSite: "none"` and `secure: true`.
   - Alternatively, Collabrix's backend middleware (`requireAuth`) supports standard `Authorization: Bearer <token>` headers out of the box, ensuring zero cookie blocking issues in cross-domain environments.
3. **Custom Domain Strategy (Best Practice)**:
   For seamless cookie behavior without third-party cookie restrictions, assign subdomains on the same root domain:
   - Frontend: `https://app.youruniversity.edu` (on Vercel)
   - Backend API: `https://api.youruniversity.edu` (on Render)

---

## Security Architecture

- **Password Encryption**: 12-round bcrypt hashing on all student and professor credentials. Plaintext passwords are never stored.
- **SQL Injection Prevention**: 100% of database interactions utilize strictly parameterized SQL queries via `pg.Pool`.
- **Token Security**: Cryptographically signed JSON Web Tokens (HMAC SHA-256) with role verification on every privileged route.
- **Safe External Navigation**: All student links opening Microsoft OneDrive enforce `target="_blank" rel="noopener noreferrer"`.
- **Brute-Force Rate Limiting**: Sensitive endpoints such as `/api/auth/login` enforce IP rate limiting to mitigate credential stuffing.

---

## License

This project is developed for academic coursework coordination. Distributed under the MIT License.
