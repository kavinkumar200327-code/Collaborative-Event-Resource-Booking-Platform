from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.organization_member import OrganizationMember
from app.models.resource import Resource
from app.models.booking import ResourceBooking
from app.models.registration import Registration, WaitlistEntry
from app.models.session import EventSession
from app.models.attendance import Attendance
from app.models.user import User


class DashboardService:
    def __init__(self, db: Session):
        self.db = db

    def get_dashboard_stats(
        self,
        user: User,
        organization_id: Optional[str] = None,
        role_override: Optional[str] = None,
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)

        # Determine effective role
        role = role_override or user.role
        if organization_id:
            membership = (
                self.db.query(OrganizationMember)
                .filter(
                    OrganizationMember.organization_id == organization_id,
                    OrganizationMember.user_id == user.id,
                )
                .first()
            )
            if membership:
                role = role_override or membership.role

        stats: Dict[str, Any] = {}

        if role in ["admin", "super_admin"]:
            # Org Admin Stats
            q_events = self.db.query(Event)
            if organization_id:
                q_events = q_events.filter(Event.organization_id == organization_id)

            total_events = q_events.count()
            published_events = q_events.filter(Event.status == "published").count()
            upcoming_events = q_events.filter(Event.starts_at > now, Event.status != "cancelled").count()
            completed_events = q_events.filter(Event.status == "completed").count()

            q_members = self.db.query(OrganizationMember)
            if organization_id:
                q_members = q_members.filter(OrganizationMember.organization_id == organization_id)
            total_members = q_members.count()

            q_resources = self.db.query(Resource)
            if organization_id:
                q_resources = q_resources.filter(Resource.organization_id == organization_id)
            active_resources = q_resources.filter(Resource.status == "active").count()

            current_bookings = self.db.query(ResourceBooking).filter(
                ResourceBooking.start_time <= now,
                ResourceBooking.end_time >= now,
                ResourceBooking.status == "approved",
            ).count()

            total_registrations = self.db.query(Registration).count()

            stats = {
                "total_events": total_events,
                "published_events": published_events,
                "upcoming_events": upcoming_events,
                "completed_events": completed_events,
                "total_members": total_members,
                "total_registrations": total_registrations,
                "active_resources": active_resources,
                "current_bookings": current_bookings,
            }

        elif role == "event_manager":
            my_events = self.db.query(Event).filter(Event.created_by == user.id).count()
            upcoming_sessions = self.db.query(EventSession).filter(EventSession.start_time > now).count()

            # Event manager's registrations
            mgr_event_ids = [e.id for e in self.db.query(Event.id).filter(Event.created_by == user.id).all()]
            total_registrations = (
                self.db.query(Registration).filter(Registration.event_id.in_(mgr_event_ids)).count()
                if mgr_event_ids else 0
            )
            waitlisted_participants = (
                self.db.query(WaitlistEntry).filter(WaitlistEntry.event_id.in_(mgr_event_ids), WaitlistEntry.status == "active").count()
                if mgr_event_ids else 0
            )

            # Attendance rate
            total_att = (
                self.db.query(Attendance).filter(Attendance.event_id.in_(mgr_event_ids)).count()
                if mgr_event_ids else 0
            )
            attended = (
                self.db.query(Attendance).filter(Attendance.event_id.in_(mgr_event_ids), Attendance.status == "attended").count()
                if mgr_event_ids else 0
            )
            attendance_rate = round((attended / total_att * 100), 1) if total_att > 0 else 100.0

            resource_bookings = self.db.query(ResourceBooking).filter(ResourceBooking.requested_by == user.id).count()

            stats = {
                "my_events": my_events,
                "upcoming_sessions": upcoming_sessions,
                "total_registrations": total_registrations,
                "waitlisted_participants": waitlisted_participants,
                "attendance_rate": attendance_rate,
                "resource_bookings": resource_bookings,
            }

        elif role == "staff":
            assigned_events = self.db.query(Event).filter(Event.status.in_(["published", "ongoing"])).count()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
            today_sessions = self.db.query(EventSession).filter(
                EventSession.start_time >= today_start,
                EventSession.start_time <= today_end,
            ).count()

            pending_registrations = self.db.query(Registration).filter(Registration.status == "pending").count()
            attendance_marked = self.db.query(Attendance).filter(Attendance.marked_by == user.id).count()

            stats = {
                "assigned_events": assigned_events,
                "today_sessions": today_sessions,
                "pending_registrations": pending_registrations,
                "upcoming_tasks": pending_registrations + today_sessions,
                "attendance": attendance_marked,
            }

        else:
            # Participant Stats
            reg_count = self.db.query(Registration).filter(
                Registration.user_id == user.id,
                Registration.status.in_(["confirmed", "pending"]),
            ).count()

            waitlisted_count = self.db.query(WaitlistEntry).filter(
                WaitlistEntry.user_id == user.id,
                WaitlistEntry.status == "active",
            ).count()

            upcoming_events_count = self.db.query(Event).filter(
                Event.starts_at > now,
                Event.status == "published",
            ).count()

            user_reg_events = [
                r.event_id for r in self.db.query(Registration.event_id).filter(Registration.user_id == user.id).all()
            ]
            upcoming_sessions_count = (
                self.db.query(EventSession).filter(
                    EventSession.event_id.in_(user_reg_events),
                    EventSession.start_time > now,
                ).count()
                if user_reg_events else 0
            )

            attended_history = self.db.query(Attendance).filter(
                Attendance.user_id == user.id,
                Attendance.status == "attended",
            ).count()

            stats = {
                "registered_events": reg_count,
                "upcoming_events": upcoming_events_count,
                "upcoming_sessions": upcoming_sessions_count,
                "waitlisted_events": waitlisted_count,
                "attendance_history": attended_history,
            }

        # Recent activities
        recent_events = [
            {
                "id": e.id,
                "title": e.title,
                "starts_at": e.starts_at.isoformat(),
                "status": e.status,
                "capacity": e.capacity,
            }
            for e in self.db.query(Event).order_by(Event.created_at.desc()).limit(5).all()
        ]

        recent_bookings = [
            {
                "id": b.id,
                "resource_id": b.resource_id,
                "start_time": b.start_time.isoformat(),
                "end_time": b.end_time.isoformat(),
                "status": b.status,
                "purpose": b.purpose,
            }
            for b in self.db.query(ResourceBooking).order_by(ResourceBooking.created_at.desc()).limit(5).all()
        ]

        return {
            "role": role,
            "stats": stats,
            "recent_events": recent_events,
            "recent_bookings": recent_bookings,
        }
