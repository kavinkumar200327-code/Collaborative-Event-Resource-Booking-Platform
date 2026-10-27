from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class OrgAdminStats(BaseModel):
    total_events: int = 0
    published_events: int = 0
    upcoming_events: int = 0
    completed_events: int = 0
    total_members: int = 0
    total_registrations: int = 0
    active_resources: int = 0
    current_bookings: int = 0


class EventManagerStats(BaseModel):
    my_events: int = 0
    upcoming_sessions: int = 0
    total_registrations: int = 0
    waitlisted_participants: int = 0
    attendance_rate: float = 0.0
    resource_bookings: int = 0


class StaffStats(BaseModel):
    assigned_events: int = 0
    today_sessions: int = 0
    pending_registrations: int = 0
    upcoming_tasks: int = 0
    attendance_marked: int = 0


class ParticipantStats(BaseModel):
    registered_events: int = 0
    upcoming_events: int = 0
    upcoming_sessions: int = 0
    waitlisted_events: int = 0
    attendance_history: int = 0


class DashboardStatsResponse(BaseModel):
    role: str
    stats: Dict[str, Any]
    recent_events: List[Dict[str, Any]] = []
    recent_bookings: List[Dict[str, Any]] = []
    recent_notifications: List[Dict[str, Any]] = []
