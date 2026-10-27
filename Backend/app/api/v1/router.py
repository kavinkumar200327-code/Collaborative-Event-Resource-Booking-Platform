from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    organizations,
    members,
    events,
    resources,
    bookings,
    speakers,
    sessions,
    registrations,
    attendance,
    files,
    comments,
    notifications,
    dashboard,
    calendar,
    websocket,
)

api_router = APIRouter()

# Authentication & Users
api_router.include_router(auth.router)

# Organizations & Members
api_router.include_router(organizations.router)
api_router.include_router(members.router)

# Events (both nested and top-level)
api_router.include_router(events.router)
api_router.include_router(events.top_router)

# Resources & Bookings
api_router.include_router(resources.router)
api_router.include_router(bookings.router)

# Speakers & Sessions
api_router.include_router(speakers.router)
api_router.include_router(sessions.router)

# Registrations & Attendance
api_router.include_router(registrations.router)
api_router.include_router(attendance.router)

# Files, Comments, Notifications
api_router.include_router(files.router)
api_router.include_router(comments.router)
api_router.include_router(notifications.router)

# Dashboards & Calendar
api_router.include_router(dashboard.router)
api_router.include_router(calendar.router)

# Real-Time WebSockets
api_router.include_router(websocket.router)
