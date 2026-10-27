# Setup Instructions & Deployment Guide

**Collaborative Event & Resource Booking Platform**

This guide provides end-to-end instructions for running the platform both locally (bare-metal) and with Docker Compose.

---

## 📋 System Prerequisites

Before starting, ensure your system has the following tools installed:

- **Node.js**: `v18.0.0` or higher (includes `npm`)
- **Python**: `v3.11` to `v3.14`
- **PostgreSQL**: `v15` or higher (or Docker)
- **Git**: `v2.30+`

---

## ⚡ Option 1: Quickstart with Docker Compose (Recommended)

Run the full platform stack (PostgreSQL 15, Redis, FastAPI Backend, and React Frontend) with a single command:

```bash
# 1. Clone or navigate to the repository directory
cd "Collaborative Event & Resource Booking Platform"

# 2. Copy the sample environment file
cp .env.example .env

# 3. Build and launch all container services
docker-compose up --build
```

The database migrations and seed data will apply automatically during container startup.

---

## 🛠️ Option 2: Local Manual Setup (Step-by-Step)

### Step 1: Database Setup (PostgreSQL)

1. Ensure your PostgreSQL server is running on `localhost:5432`.
2. Connect to PostgreSQL and create the application database:

```sql
CREATE DATABASE collaborative_booking_db;
```

*(Default credentials configured in `.env.example`: User `postgres`, Password `postgres`).*

---

### Step 2: Backend Setup (FastAPI & SQLAlchemy)

1. Open a terminal and navigate to the `Backend` directory:
   ```bash
   cd Backend
   ```

2. Create and activate a Python virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. Install required Python packages:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. Configure the environment variables:
   ```bash
   # Copy sample environment configuration
   cp .env.example .env
   ```
   *(Ensure `DATABASE_URL` matches your local PostgreSQL credentials).*

5. Run database migrations using Alembic:
   ```bash
   alembic upgrade head
   ```

6. Seed default users, demo organizations, bookable resources, and events:
   ```bash
   python seed_data.py
   ```

7. Start the FastAPI development server:
   ```bash
   python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```
   *The API will be live at `http://127.0.0.1:8000`.*

---

### Step 3: Frontend Setup (React & Vite)

1. Open a second terminal and navigate to the `Frontend` directory:
   ```bash
   cd Frontend
   ```

2. Configure frontend environment variables:
   ```bash
   cp .env.example .env
   ```

3. Install JavaScript dependencies:
   ```bash
   npm install
   ```

4. Launch the Vite development server:
   ```bash
   npm run dev
   ```
   *The application will open at `http://localhost:5173` (or the port indicated in the terminal).*

---

## 🌐 Application URLs & Endpoints

| Component | URL | Description |
| :--- | :--- | :--- |
| **Frontend Portal** | `http://localhost:5173` | React SPA user interface |
| **FastAPI REST API** | `http://127.0.0.1:8000/api/v1` | Backend REST API root |
| **Swagger UI** | `http://127.0.0.1:8000/docs` | Interactive API documentation |
| **ReDoc UI** | `http://127.0.0.1:8000/redoc` | Alternative clean API specification |
| **WebSocket Gateway** | `ws://127.0.0.1:8000/api/v1/ws` | Real-time notification socket |

---

## 👥 Default Login Credentials

The `seed_data.py` script provisions demonstration accounts for each platform role:

| Platform Role | Email Address | Password | Permissions & Access Scope |
| :--- | :--- | :--- | :--- |
| **Super Administrator** | `admin@collab.com` | `AdminPass123!` | System-wide access: all organizations, events, memberships, settings, and telemetry. |
| **Organization Admin** | `orgadmin@collab.com` | `OrgAdmin123!` | Organization management, member role assignments, event & resource approvals. |
| **Event Manager** | `manager@collab.com` | `Manager123!` | Create & edit events, breakout sessions, schedule speakers, attendance tracking. |
| **Staff Coordinator** | `staff@collab.com` | `Staff123!` | On-site attendance & QR check-in, resource dispatch & booking operations. |
| **Participant / Attendee**| `participant@collab.com` | `Participant123!` | Browse public events, register/waitlist, view personal QR passes & bookings. |

---

## 🧪 Running Automated Tests

### Backend Test Suite (Pytest)
The backend includes 100+ comprehensive automated tests covering authentication, multi-tenancy, concurrency row-locking, double-booking prevention, and waitlist promotion:

```bash
cd Backend
# Windows
.\.venv\Scripts\python.exe -m pytest -v

# Linux / macOS
pytest -v
```

### Frontend Verification (ESLint & Vite Build)
```bash
cd Frontend
# Check code style and rules
npm run lint

# Compile production bundle
npm run build
```

---

## ❓ Troubleshooting & FAQs

### 1. Database Connection Refused (`connection to server at "localhost" failed`)
- Ensure your PostgreSQL service is running (`pg_ctl status` or check Windows Services / Docker).
- Verify the credentials in `Backend/.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`).

### 2. Port Conflict (`8000` or `5173` already in use)
- Specify an alternative port:
  - Backend: `uvicorn app.main:app --port 8080`
  - Frontend: `npm run dev -- --port 3000`

### 3. PowerShell Script Execution Policy (`Activate.ps1 cannot be loaded`)
- If Windows blocks script execution, run:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
