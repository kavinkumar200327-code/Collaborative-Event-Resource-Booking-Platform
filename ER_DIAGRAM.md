# Collaborative Event & Resource Booking Platform - Database ER Diagram & Architecture

This document provides the complete database entity-relationship (ER) model and architectural constraints for the **Collaborative Event & Resource Booking Platform**.

---

## 1. Entity-Relationship Diagram (Mermaid)

```mermaid
erDiagram
    USERS ||--o{ REFRESH_TOKENS : "issues"
    USERS ||--o{ ORGANIZATION_MEMBERS : "belongs to"
    USERS ||--o{ EVENTS : "creates"
    USERS ||--o{ REGISTRATIONS : "submits"
    USERS ||--o{ WAITLIST_ENTRIES : "enqueued"
    USERS ||--o{ RESOURCE_BOOKINGS : "reserves"
    USERS ||--o{ ATTENDANCE : "attends"
    USERS ||--o{ COMMENTS : "authors"
    USERS ||--o{ COMMENT_MENTIONS : "mentioned in"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ AUDIT_LOGS : "triggers"

    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : "has"
    ORGANIZATIONS ||--o{ EVENTS : "hosts"
    ORGANIZATIONS ||--o{ RESOURCES : "owns"
    ORGANIZATIONS ||--o{ SPEAKERS : "manages"
    ORGANIZATIONS ||--o{ AUDIT_LOGS : "logs activity"

    EVENTS ||--o{ EVENT_SESSIONS : "contains"
    EVENTS ||--o{ REGISTRATIONS : "receives"
    EVENTS ||--o{ WAITLIST_ENTRIES : "queues"
    EVENTS ||--o{ RESOURCE_BOOKINGS : "utilizes"
    EVENTS ||--o{ ATTENDANCE : "tracks"
    EVENTS ||--o{ COMMENTS : "has discussion"
    EVENTS ||--o{ ATTACHMENTS : "stores files"

    RESOURCES ||--o{ RESOURCE_BOOKINGS : "booked via"

    SPEAKERS ||--o{ SPEAKER_SESSIONS : "speaks at"
    EVENT_SESSIONS ||--o{ SPEAKER_SESSIONS : "assigned"
    EVENT_SESSIONS ||--o{ COMMENTS : "session threads"

    COMMENTS ||--o{ COMMENT_MENTIONS : "contains @mentions"

    USERS {
        int id PK
        string email UK
        string hashed_password
        string full_name
        string role
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    REFRESH_TOKENS {
        int id PK
        int user_id FK
        string token UK
        boolean revoked
        timestamp expires_at
        timestamp created_at
    }

    ORGANIZATIONS {
        string id PK "UUID"
        string name
        string slug UK
        string description
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    ORGANIZATION_MEMBERS {
        int id PK
        string organization_id FK
        int user_id FK
        string role
        boolean is_active
        timestamp created_at
    }

    EVENTS {
        string id PK "UUID"
        string organization_id FK
        string title
        string description
        string location
        timestamp starts_at
        timestamp ends_at
        int capacity
        string status
        int created_by FK
        timestamp created_at
        timestamp updated_at
    }

    EVENT_SESSIONS {
        int id PK
        string event_id FK
        string title
        string description
        timestamp start_time
        timestamp end_time
        string room
        int capacity
        timestamp created_at
        timestamp updated_at
    }

    SPEAKERS {
        int id PK
        string organization_id FK
        string name
        string email
        string bio
        string avatar_url
        timestamp created_at
    }

    SPEAKER_SESSIONS {
        int id PK
        int speaker_id FK
        int session_id FK
    }

    RESOURCES {
        int id PK
        string organization_id FK
        string name
        string type
        string description
        string location
        int capacity
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    RESOURCE_BOOKINGS {
        int id PK
        int resource_id FK
        string event_id FK "nullable"
        int requested_by FK
        timestamp start_time
        timestamp end_time
        string status
        string purpose
        timestamp created_at
        timestamp updated_at
    }

    REGISTRATIONS {
        int id PK
        string event_id FK
        int user_id FK
        string status
        string notes
        timestamp created_at
        timestamp updated_at
    }

    WAITLIST_ENTRIES {
        int id PK
        string event_id FK
        int user_id FK
        int position
        string status
        timestamp created_at
    }

    ATTENDANCE {
        int id PK
        string event_id FK
        int user_id FK
        string status
        string check_in_code UK
        timestamp check_in_time
        timestamp created_at
        timestamp updated_at
    }

    ATTACHMENTS {
        int id PK
        string event_id FK "nullable"
        int session_id FK "nullable"
        int uploaded_by FK
        string file_name
        string storage_path
        string mime_type
        int file_size
        timestamp created_at
    }

    COMMENTS {
        int id PK
        string event_id FK
        int session_id FK "nullable"
        int user_id FK
        int parent_id FK "nullable"
        string content
        timestamp created_at
        timestamp updated_at
    }

    COMMENT_MENTIONS {
        int id PK
        int comment_id FK
        int mentioned_user_id FK
    }

    NOTIFICATIONS {
        int id PK
        int user_id FK
        string title
        string message
        string notification_type
        boolean is_read
        timestamp created_at
    }

    AUDIT_LOGS {
        int id PK
        int user_id FK "nullable"
        string organization_id FK "nullable"
        string action
        string target_type
        string target_id
        string ip_address
        string details "JSON"
        timestamp created_at
    }
```

---

## 2. Table-by-Table Architectural Description

| Table Name | Purpose | Critical Constraints & Indexes |
| :--- | :--- | :--- |
| **`users`** | Core user credentials, roles, and status | `UNIQUE(email)`, indexed by `email` and `role`. Prevents inactive user authentication. |
| **`refresh_tokens`** | JWT token rotation & revocation tracking | `UNIQUE(token)`, FK `user_id -> users.id` with `CASCADE`. |
| **`organizations`** | Multi-tenant organization boundaries | `UNIQUE(slug)`, indexed by `is_active`. |
| **`organization_members`** | User membership and RBAC within organizations | `UNIQUE(organization_id, user_id)`. Last active admin protected by business logic. |
| **`events`** | Event metadata, time window, status machine | Status check: `draft`, `published`, `ongoing`, `completed`, `cancelled`, `archived`. Time check: `ends_at > starts_at`. |
| **`event_sessions`** | Breakout sessions within event window | Session start/end validated within parent event window. Room conflict validation. |
| **`speakers`** | Speaker profiles assignable to sessions | Indexed by `organization_id` and `email`. |
| **`speaker_sessions`** | Many-to-many link between speakers and sessions | `UNIQUE(speaker_id, session_id)`. Time conflict validation prevents overlapping assignments. |
| **`resources`** | Bookable rooms, equipment, vehicles | Types: `meeting_room`, `conference_hall`, `projector`, `camera`, `vehicle`, `equipment`. |
| **`resource_bookings`** | Resource reservation records | Double booking prevention via SQL interval overlap check: `[start_1 < end_2 AND end_1 > start_2]` with DB row-locking (`FOR UPDATE`). |
| **`registrations`** | Participant event attendance registrations | `UNIQUE(event_id, user_id)`. Status machine: `pending`, `confirmed`, `waitlisted`, `cancelled`, `rejected`, `attended`, `noshow`. |
| **`waitlist_entries`** | Priority FIFO queue for capacity overflow | Ordered by `position ASC`. Atomic promotion upon cancellation with row locks. |
| **`attendance`** | Participant check-in records | `UNIQUE(event_id, user_id)`. `check_in_code` unique token for QR scanning. |
| **`attachments`** | Uploaded event documents & media | Magic-byte MIME validation (PDF, PNG, JPG). Extension spoofing protection. |
| **`comments`** | Discussion threads on events & sessions | Hierarchical parent-reply structure with threaded back-populates. |
| **`comment_mentions`** | `@username` mention detection | Dispatches real-time WebSocket notifications to mentioned users. |
| **`notifications`** | Persistent system notifications | Indexed by `(user_id, is_read, created_at)`. |
| **`audit_logs`** | Compliance & security activity tracking | Records actor, action, timestamp, IP address, and JSON diff payload. |
