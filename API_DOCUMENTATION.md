# API Documentation

**Collaborative Event & Resource Booking Platform**  
*Version 1.0.0 | Base Path: `/api/v1`*

---

## 📑 Table of Contents

1. [Overview & Standards](#1-overview--standards)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Error Handling & Status Codes](#3-error-handling--status-codes)
4. [Authentication Endpoints](#4-authentication-endpoints)
5. [Organizations & Membership Endpoints](#5-organizations--membership-endpoints)
6. [Events Lifecycle Endpoints](#6-events-lifecycle-endpoints)
7. [Breakout Sessions & Keynote Speakers Endpoints](#7-breakout-sessions--keynote-speakers-endpoints)
8. [Registrations & Automatic Waitlist Endpoints](#8-registrations--automatic-waitlist-endpoints)
9. [Bookable Resources & Concurrency Reservations](#9-bookable-resources--concurrency-reservations)
10. [Attendance Tracking & QR Check-In Endpoints](#10-attendance-tracking--qr-check-in-endpoints)
11. [Comments & @Mentions Endpoints](#11-comments--mentions-endpoints)
12. [File Attachments with Magic-Byte Inspection](#12-file-attachments-with-magic-byte-inspection)
13. [Notifications & WebSockets](#13-notifications--websockets)
14. [Dashboard Telemetry & Master Calendar Feed](#14-dashboard-telemetry--master-calendar-feed)

---

## 1. Overview & Standards

The platform exposes a standard RESTful JSON API alongside a real-time full-duplex WebSocket connection.

- **Base URL**: `http://localhost:8000/api/v1`
- **Interactive Swagger UI**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`
- **WebSocket Gateway**: `ws://localhost:8000/api/v1/ws?token=<access_token>`

All timestamps are accepted and returned in ISO 8601 UTC format: `YYYY-MM-DDTHH:MM:SSZ`.

---

## 2. Authentication & Authorization

All protected endpoints require a valid JWT Bearer token supplied in the `Authorization` header:

```http
Authorization: Bearer <your_jwt_access_token>
```

### Role-Based Access Control (RBAC) Matrix

| Platform Role | Scope & Permissions |
| :--- | :--- |
| `super_admin` | Full platform control: multi-tenant organizations, global events, memberships, settings, and telemetry. |
| `admin` / `org_admin` | Workspace administration: organization metadata, member role assignments, event publishing, and resource booking approvals. |
| `event_manager` | Event lifecycle: create/edit draft summits, schedule breakout sessions, assign speakers, and track rosters. |
| `staff` | Operational dispatch: on-site QR attendance scanning, equipment check-out, and resource booking operations. |
| `participant` | Public attendees: browse published events, register, join FIFO waitlists, and view digital QR passes. |

---

## 3. Error Handling & Status Codes

All errors return standard JSON payloads with descriptive details:

```json
{
  "detail": "Descriptive reason for failure",
  "error_code": "RESOURCE_ALREADY_BOOKED"
}
```

### Standard Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Input validation or schema constraint failure.
- `401 Unauthorized`: Missing or expired access token.
- `403 Forbidden`: Insufficient role permissions for the targeted operation.
- `404 Not Found`: Target entity does not exist.
- `409 Conflict`: Business rule violation (e.g. duplicate booking window or duplicate registration).
- `422 Unprocessable Entity`: Pydantic payload validation error.

---

## 4. Authentication Endpoints

### `POST /auth/register`
Register a new platform user.
- **Request Body**:
  ```json
  {
    "email": "user@collab.com",
    "password": "SecurePassword123!",
    "full_name": "Jane Doe",
    "role": "participant"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "id": 5,
    "email": "user@collab.com",
    "full_name": "Jane Doe",
    "role": "participant",
    "is_active": true,
    "created_at": "2026-10-27T12:00:00Z"
  }
  ```

### `POST /auth/login`
Authenticate credentials and obtain JWT access and refresh token pair.
- **Request Body**:
  ```json
  {
    "email": "admin@collab.com",
    "password": "AdminPass123!"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "expires_in": 3600,
    "user": {
      "id": 1,
      "email": "admin@collab.com",
      "full_name": "Platform Super Admin",
      "role": "admin"
    }
  }
  ```

### `POST /auth/refresh`
Rotate access token using an unrevoked refresh token.
- **Request Body**: `{"refresh_token": "<refresh_token>"}`
- **Response `200 OK`**: `{"access_token": "<new_token>", "token_type": "bearer"}`

### `GET /auth/me`
Retrieve currently authenticated user identity and active roles.

---

## 5. Organizations & Membership Endpoints

### `GET /organizations`
List accessible organizations with pagination and name search.
- **Query Parameters**: `page` (default: 1), `page_size` (default: 10), `search` (string).

### `POST /organizations`
Create a new tenant organization. *Requires `super_admin` or `admin`.*
- **Request Body**:
  ```json
  {
    "name": "Acme Global Technology",
    "slug": "acme-global",
    "description": "Enterprise collaborative hub."
  }
  ```

### `GET /organizations/{id}/members`
List all members enrolled in the specified organization.

### `POST /organizations/{id}/members`
Assign a team member to an organization with a specific role (`admin`, `event_manager`, `staff`, `member`).

---

## 6. Events Lifecycle Endpoints

### `GET /events`
List events across organizations with filtering by `status`, `organization_id`, and `search`.

### `POST /organizations/{org_id}/events`
Create a new event in `draft` state.
- **Request Body**:
  ```json
  {
    "organization_id": "ec754a1d-8570-432c-aeb8-14542281eea2",
    "title": "Cloud Architecture Summit 2026",
    "description": "Annual cloud architecture symposium.",
    "location": "Convention Hall A",
    "starts_at": "2026-11-15T09:00:00Z",
    "ends_at": "2026-11-15T18:00:00Z",
    "capacity": 200
  }
  ```

### `POST /events/{id}/publish`
Transition event from `draft` to `published` status, exposing it to public attendee discovery. *Requires `admin` or `event_manager`.*

### `POST /events/{id}/cancel`
Cancel an event and notify all registered attendees via WebSockets and email.

---

## 7. Breakout Sessions & Keynote Speakers Endpoints

### `GET /speakers?organization_id={org_id}`
List registered keynote speakers for the organization.

### `POST /speakers`
Register a new keynote speaker with bio and organizational affiliations.

### `GET /events/{id}/sessions`
List agenda breakout sessions scheduled for an event.

### `POST /events/{id}/sessions`
Schedule a breakout session, assigning a keynote speaker and reserving a venue/room.
- **Request Body**:
  ```json
  {
    "title": "Deep Dive: Distributed Concurrency",
    "starts_at": "2026-11-15T10:30:00Z",
    "ends_at": "2026-11-15T11:45:00Z",
    "room_id": "bd5f4797-d719-4de8-b8de-29a2c62851d8",
    "speaker_id": "5a41c2d9-11ef-42f1-9abc-123456789abc"
  }
  ```

---

## 8. Registrations & Automatic Waitlist Endpoints

### `POST /events/{id}/registrations`
Register current user for an event. If capacity is full, the user is enqueued in the FIFO waitlist.
- **Response `201 Created`**:
  ```json
  {
    "id": "reg-uuid",
    "event_id": "event-uuid",
    "status": "confirmed",
    "pass_code": "REG-AI-2026-8941",
    "waitlist_position": null
  }
  ```

### `DELETE /events/{id}/registrations/cancel`
Cancel registration. **Triggers automatic promotion engine**: locks event rows, locates the first attendee in the FIFO waitlist (`position = 1`), updates them to `confirmed`, and broadcasts instant real-time notification.

### `GET /events/{id}/waitlist`
View current waitlist queue status and user's queue position.

---

## 9. Bookable Resources & Concurrency Reservations

### `GET /resources`
List bookable rooms, halls, projectors, cameras, and equipment with status and `is_active` flags.

### `PATCH /resources/{id}/activate` & `PATCH /resources/{id}/deactivate`
Toggle resource operational status.

### `POST /bookings`
Request resource reservation. Employs PostgreSQL row-locking (`FOR UPDATE`) with SQL interval overlap logic:
$$\text{start}_{\text{req}} < \text{end}_{\text{existing}} \quad \text{AND} \quad \text{end}_{\text{req}} > \text{start}_{\text{existing}}$$
If conflicting active bookings exist, returns `HTTP 409 Conflict (RESOURCE_ALREADY_BOOKED)`.
- Automatically notifies Organization Admins via WebSocket.

### `POST /bookings/{id}/approve` & `POST /bookings/{id}/reject`
Organization Admin approval / rejection of requested resource reservations.

---

## 10. Attendance Tracking & QR Check-In Endpoints

### `GET /events/{id}/attendance`
Get full attendance roster with confirmation status, check-in timestamps, and method.

### `POST /events/{id}/attendance/check-in`
Verify attendee pass code scanned from QR ticket or mobile device.
- **Request Body**: `{"pass_code": "REG-AI-2026-8941"}`
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "attendee_name": "Jane Doe",
    "checked_in_at": "2026-10-27T13:20:00Z",
    "message": "Check-in verified successfully"
  }
  ```

### `GET /events/{id}/attendance/export`
Export attendance records to a downloadable CSV spreadsheet.

---

## 11. Comments & @Mentions Endpoints

### `GET /events/{id}/comments`
Retrieve chronological discussion thread for an event.

### `POST /events/{id}/comments`
Post a comment. Automatically parses `@username` or `@email` mentions and generates real-time notifications for tagged users.

---

## 12. File Attachments with Magic-Byte Inspection

### `POST /events/{id}/files`
Upload event documents, slide decks, and agendas (`multipart/form-data`).
- **Security Check**: Reads genuine file magic bytes (headers) to prevent MIME-type spoofing (verifies genuine PDF, PNG, JPEG, ZIP headers).

### `GET /files/{id}/download`
Securely download validated attachments.

---

## 13. Notifications & WebSockets

### `GET /notifications`
List user notifications with `unread_count` badge total.

### `PATCH /notifications/{id}/read`
Mark specific notification as read.

### `PATCH /notifications/read-all`
Mark all user notifications as read in a single call.

### `WS /api/v1/ws?token=<access_token>`
Real-time WebSocket connection for live notification pushes, chat discussions, waitlist promotions, and booking alerts.

---

## 14. Dashboard Telemetry & Master Calendar Feed

### `GET /dashboard/stats?role={admin|event_manager|staff|participant}`
Returns role-tailored KPI analytics, capacity utilization, pending approvals count, and resource allocations.

### `GET /calendar/events?start_date={ISO}&end_date={ISO}`
Unified multi-tenant feed combining scheduled events, breakout sessions, and resource bookings for calendar visualizations.
