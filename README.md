# Collaborative Event & Resource Booking Platform

A production-grade, secure, and scalable multi-tenant platform for managing organizations, events, breakout sessions, bookable resources, registrations with automatic waitlist promotion, real-time notifications via WebSockets, and QR-based attendance tracking.

---

## 🌟 Key Features

- **Multi-Tenancy & RBAC**:
  - Roles: `Super Admin`, `Organization Admin`, `Event Manager`, `Staff`, and `Participant`.
  - Organization isolation, member role management, and protection of the last active organization administrator.
- **Authentication & Security**:
  - JWT Access & Refresh Token rotation.
  - Inactive user enforcement and token revocation.
  - Argon2 password hashing via `pwdlib`.
- **Event Lifecycle Management**:
  - Finite State Machine: `draft` ➔ `published` ➔ `ongoing` ➔ `completed` / `cancelled` / `archived`.
  - Date and capacity validations.
- **Event Registration & Automatic Waitlist**:
  - Capacity enforcement and duplicate registration prevention.
  - Automatic waitlist queue (`FIFO`) with race-condition-safe promotion upon cancellation using database row-level locking (`SELECT ... FOR UPDATE`).
- **Resource Management & Overlap Prevention**:
  - Bookable rooms, halls, projectors, cameras, vehicles, and equipment.
  - Concurrency-safe double-booking prevention using SQL interval overlap logic: `[start_1 < end_2 AND end_1 > start_2]`.
- **Breakout Sessions & Speaker Scheduling**:
  - Sessions validated strictly within event window.
  - Room time-conflict and speaker assignment conflict prevention.
- **Real-Time Communication**:
  - WebSockets (`/api/v1/ws`) for live notification broadcasts (published events, waitlist promotions, booking approvals, comments, @mentions).
  - Built-in REST fallback endpoints.
- **File Management with Magic-Byte Inspection**:
  - Document uploads for events, sessions, and speakers.
  - Validates MIME types, file sizes, and genuine file headers (magic bytes) to prevent extension spoofing attacks.
- **Attendance & Check-In**:
  - Unique QR / pass-code check-in simulator.
  - Real-time status toggling (`Attended` / `No-Show`).
  - Export attendance reports to CSV.
- **Role-Based Executive Dashboards**:
  - Tailored analytics and KPIs for Org Admin, Event Manager, Staff, and Participant.
- **Interactive Calendar UI**:
  - Month, Week, and Day views showing synchronized events, sessions, and resource bookings.

---

## 🛠️ Technology Stack

- **Backend**:
  - Python 3.11+ / 3.14
  - FastAPI (REST & WebSockets)
  - SQLAlchemy 2.0 (ORM & row-locking)
  - PostgreSQL 15+ (Relational Database)
  - Alembic (Database Migrations)
  - Pydantic v2 (Validation & Schemas)
  - PyJWT & Argon2 (Authentication)
- **Frontend**:
  - React 19
  - React Router v6
  - Axios (HTTP client with auto-refresh interceptor)
  - Lucide React (Icons)
  - Vite (Build Tool & Dev Server)
- **DevOps & Testing**:
  - Docker & Docker Compose
  - Pytest (102 Automated Tests, 100% Pass Rate)

---

## 🚀 Quick Start (Docker Compose)

The easiest way to run the entire platform (PostgreSQL, Redis, FastAPI Backend, and React Frontend):

```bash
# Clone and navigate into project directory
cd "Collaborative Event & Resource Booking Platform"

# Build and start all services
docker-compose up --build
```

- **Frontend Application**: `http://localhost:3000`
- **FastAPI Swagger API Docs**: `http://localhost:8000/docs`
- **FastAPI ReDoc**: `http://localhost:8000/redoc`

---

## 💻 Local Development Setup

### 1. Backend Setup

```bash
cd Backend

# Create and activate virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables (.env)
cp .env.example .env

# Run database migrations
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd Frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Visit `http://localhost:5173` to access the application.

---

## 🧪 Running Automated Tests

The backend includes a comprehensive automated test suite covering authentication, authorization, organization isolation, event state machines, waitlist concurrency, resource double booking prevention, speaker conflicts, file magic bytes, comments, notifications, calendar, and dashboards.

To execute all tests:

```bash
cd Backend
.venv\Scripts\python -m pytest -v
```

**Test Results: 102 passed, 0 failures (100% pass rate).**

```text
tests/test_health.py .................................. [PASSED]
tests/test_auth.py .................................... [PASSED]
tests/test_organizations.py .......................... [PASSED]
tests/test_members.py ................................ [PASSED]
tests/test_events.py ................................. [PASSED]
tests/test_registrations_waitlist.py ................. [PASSED]
tests/test_bookings_resources.py ..................... [PASSED]
tests/test_sessions_speakers.py ...................... [PASSED]
tests/test_attendance_files_comments_notifications.py  [PASSED]
==================== 102 passed in 40.60s ====================
```

---

## 📂 Project Structure

```
├── Backend/
│   ├── alembic/              # Database migration versions
│   ├── app/
│   │   ├── api/              # Routers & API dependency injection
│   │   │   ├── deps.py       # Auth guards & DB session dependency
│   │   │   └── v1/endpoints/ # 15 domain route controllers
│   │   ├── core/             # Security, config, exceptions, websockets
│   │   ├── db/               # SQLAlchemy engine & session factory
│   │   ├── models/           # 16 SQLAlchemy declarative entities
│   │   ├── repositories/     # Repository layer with row-level locks
│   │   ├── schemas/          # Pydantic request/response models
│   │   └── services/         # Domain business logic & state machines
│   ├── tests/                # Automated pytest suite (102 tests)
│   ├── Dockerfile
│   └── requirements.txt
├── Frontend/
│   ├── src/
│   │   ├── api/              # Axios API service clients
│   │   ├── components/       # Header, Sidebar, Badges, Modals
│   │   ├── context/          # AuthContext & WebSocketContext
│   │   ├── pages/            # Role Dashboards, Calendar, Events, Resources, Attendance...
│   │   ├── routes/           # Protected route guards
│   │   ├── App.jsx           # Main routing & layout
│   │   └── main.jsx
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml        # Multi-container orchestration
├── postman_collection.json   # Comprehensive Postman test collection
├── ARCHITECTURE.md           # System architecture diagrams & principles
├── ER_DIAGRAM.md             # Complete database entity-relationship documentation
└── README.md
```

---

## 📡 API Endpoints Overview

| Module | Method & Path | Description |
| :--- | :--- | :--- |
| **Auth** | `POST /api/v1/auth/register` | Register new user account |
| | `POST /api/v1/auth/login` | Authenticate & receive JWT token pair |
| | `POST /api/v1/auth/refresh` | Refresh access token via token rotation |
| | `POST /api/v1/auth/logout` | Revoke active refresh token |
| | `GET  /api/v1/auth/me` | Fetch authenticated user profile |
| | `POST /api/v1/auth/change-password` | Update account password |
| **Organizations** | `POST /api/v1/organizations/` | Create organization |
| | `GET  /api/v1/organizations/` | List organizations (paginated) |
| | `GET  /api/v1/organizations/{id}` | Get organization details |
| | `POST /api/v1/organizations/{id}/members/` | Add member to organization |
| **Events** | `POST /api/v1/organizations/{id}/events/` | Create new event (Draft) |
| | `GET  /api/v1/organizations/{id}/events/` | List events with filters |
| | `PATCH /api/v1/events/{id}/publish` | Transition status to Published |
| | `PATCH /api/v1/events/{id}/cancel` | Cancel event & notify attendees |
| **Registration** | `POST /api/v1/events/{id}/register` | Register participant / waitlist if full |
| | `POST /api/v1/registrations/{id}/cancel` | Cancel registration & trigger auto-promotion |
| **Resources** | `POST /api/v1/resources/` | Create bookable resource |
| | `POST /api/v1/bookings/` | Book resource (double booking prevented) |
| **Attendance** | `POST /api/v1/events/{id}/attendance/check-in` | Check in participant via code/QR |
| | `GET  /api/v1/events/{id}/attendance/export` | Export attendance list as CSV |
| **Files** | `POST /api/v1/files/upload` | Upload document with magic byte validation |
| **Real-Time** | `WS   /api/v1/ws?token={jwt}` | Real-time WebSocket connection |
| **Calendar** | `GET  /api/v1/calendar/events` | Cross-entity calendar feed |
| **Dashboard** | `GET  /api/v1/dashboard/stats?role={role}` | Role-tailored metrics & activity |

---

## 🔒 Concurrency & Reliability Guarantees

1. **Double Booking Guard**:
   Every resource booking request executes inside a database transaction that acquires row-level locks on overlapping time spans. Conflicting intervals are rejected immediately with HTTP 409 and code `RESOURCE_ALREADY_BOOKED`.
2. **Automatic Waitlist Promotion**:
   When an event is fully booked, new registrants are queued into `waitlist_entries`. When a confirmed participant cancels, the database transaction locks the waitlist, promotes the earliest waitlisted participant, updates capacity, and dispatches a confirmation notification.
3. **Magic Byte File Security**:
   The file upload handler reads the initial bytes of uploaded files to verify genuine format signatures (`%PDF-`, `\x89PNG`, `\xff\xd8\xff`), safeguarding the server against malicious file uploads and extension spoofing.

---

## 📄 Postman Collection

Import `postman_collection.json` directly into Postman. It contains preconfigured environments, automated token extraction scripts, and organized folders for all API endpoints.
