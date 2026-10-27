import uuid
from datetime import datetime, timedelta, timezone
from app.db.session import SessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.event import Event
from app.models.resource import Resource
from app.models.booking import ResourceBooking
from app.models.session import EventSession
from app.models.registration import Registration
from app.models.attendance import Attendance

def seed_database():
    db = SessionLocal()
    try:
        print("[*] Seeding database with production demo accounts...")

        # 1. Users
        users_to_create = [
            {
                "email": "admin@collab.com",
                "full_name": "Super Administrator",
                "password": "AdminPass123!",
                "role": "admin",
            },
            {
                "email": "orgadmin@collab.com",
                "full_name": "Sarah Jenkins (Org Admin)",
                "password": "OrgAdmin123!",
                "role": "admin",
            },
            {
                "email": "manager@collab.com",
                "full_name": "Michael Chang (Event Manager)",
                "password": "Manager123!",
                "role": "event_manager",
            },
            {
                "email": "staff@collab.com",
                "full_name": "Emma Watson (Staff Coordinator)",
                "password": "Staff123!",
                "role": "staff",
            },
            {
                "email": "participant@collab.com",
                "full_name": "Alex Rivera (Attendee)",
                "password": "Participant123!",
                "role": "participant",
            },
        ]

        created_users = {}
        for u in users_to_create:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if not existing:
                user_obj = User(
                    email=u["email"],
                    hashed_password=hash_password(u["password"]),
                    full_name=u["full_name"],
                    role=u["role"],
                    is_active=True,
                )
                db.add(user_obj)
                db.flush()
                created_users[u["email"]] = user_obj
                print(f"  + Created user: {u['email']} [{u['role']}]")
            else:
                existing.hashed_password = hash_password(u["password"])
                existing.is_active = True
                created_users[u["email"]] = existing
                print(f"  - Existing user updated: {u['email']}")

        db.commit()

        # 2. Demo Organization
        org = db.query(Organization).filter(Organization.slug == "acme-tech").first()
        if not org:
            org = Organization(
                id=str(uuid.uuid4()),
                name="Acme Technology Global",
                slug="acme-tech",
                description="Global enterprise hosting conferences, summits, and internal collaborative workshops.",
                is_active=True,
            )
            db.add(org)
            db.flush()
            print(f"  + Created Organization: {org.name} ({org.id})")

        # 3. Add Members
        for email, role in [
            ("admin@collab.com", "admin"),
            ("orgadmin@collab.com", "admin"),
            ("manager@collab.com", "event_manager"),
            ("staff@collab.com", "staff"),
            ("participant@collab.com", "participant"),
        ]:
            user_inst = created_users[email]
            member = db.query(OrganizationMember).filter(
                OrganizationMember.organization_id == org.id,
                OrganizationMember.user_id == user_inst.id,
            ).first()
            if not member:
                member = OrganizationMember(
                    organization_id=org.id,
                    user_id=user_inst.id,
                    role=role,
                    is_active=True,
                )
                db.add(member)
                print(f"  + Linked {email} as {role} in {org.name}")

        # 4. Resources
        resources_to_seed = [
            {"name": "Grand Ballroom A", "type": "conference_hall", "capacity": 150, "location": "1st Floor Center"},
            {"name": "Meeting Room 101", "type": "meeting_room", "capacity": 20, "location": "West Wing 2nd Floor"},
            {"name": "4K Ultra Laser Projector", "type": "projector", "capacity": 1, "location": "AV Storage Room"},
        ]
        created_resources = {}
        for r_data in resources_to_seed:
            res_obj = db.query(Resource).filter(Resource.organization_id == org.id, Resource.name == r_data["name"]).first()
            if not res_obj:
                res_obj = Resource(
                    id=str(uuid.uuid4()),
                    organization_id=org.id,
                    name=r_data["name"],
                    type=r_data["type"],
                    capacity=r_data["capacity"],
                    location=r_data["location"],
                    description="Standard enterprise resource available for booking.",
                    status="active",
                )
                db.add(res_obj)
                db.flush()
                print(f"  + Created Resource: {r_data['name']}")
            created_resources[r_data["name"]] = res_obj

        # 5. Events
        now = datetime.now(timezone.utc)
        event = db.query(Event).filter(Event.organization_id == org.id, Event.title == "AI & Cloud Innovation Summit 2026").first()
        if not event:
            event = Event(
                id=str(uuid.uuid4()),
                organization_id=org.id,
                title="AI & Cloud Innovation Summit 2026",
                description="Annual technology summit bringing together cloud architects, AI engineers, and collaborative systems researchers.",
                location="Acme Global Convention Center, Hall 1",
                starts_at=now + timedelta(days=5),
                ends_at=now + timedelta(days=5, hours=8),
                capacity=100,
                status="published",
                created_by=created_users["admin@collab.com"].id,
            )
            db.add(event)
            db.flush()
            print(f"  + Created Event: {event.title}")

            # Sessions
            ballroom = created_resources.get("Grand Ballroom A")
            room101 = created_resources.get("Meeting Room 101")

            s1 = EventSession(
                id=str(uuid.uuid4()),
                event_id=event.id,
                title="Keynote: Scalable Distributed Systems",
                description="Deep dive into modern concurrency, PostgreSQL locking, and microservices.",
                start_time=event.starts_at + timedelta(hours=1),
                end_time=event.starts_at + timedelta(hours=2, minutes=30),
                room_id=ballroom.id if ballroom else None,
                capacity=150,
            )
            s2 = EventSession(
                id=str(uuid.uuid4()),
                event_id=event.id,
                title="Breakout: Real-Time WebSockets & Interactive UI",
                description="Live demonstration of full-duplex communication in React.",
                start_time=event.starts_at + timedelta(hours=3),
                end_time=event.starts_at + timedelta(hours=4, minutes=30),
                room_id=room101.id if room101 else None,
                capacity=20,
            )
            db.add_all([s1, s2])

            # Registration for participant
            part_user = created_users["participant@collab.com"]
            reg = Registration(
                id=str(uuid.uuid4()),
                event_id=event.id,
                user_id=part_user.id,
                status="confirmed",
                notes="Attending keynote and cloud workshop.",
            )
            db.add(reg)
            db.flush()

            # Attendance for participant
            att = Attendance(
                id=str(uuid.uuid4()),
                event_id=event.id,
                registration_id=reg.id,
                user_id=part_user.id,
                status="registered",
            )
            db.add(att)
            print("  + Created sample Breakout Sessions, Registration, and Attendance Record")

        # 6. Sample Draft Event (Awaiting Org Admin Approval)
        draft_event = db.query(Event).filter(Event.organization_id == org.id, Event.title == "Q3 Engineering & Product Roadmap Summit").first()
        if not draft_event:
            draft_event = Event(
                id=str(uuid.uuid4()),
                organization_id=org.id,
                title="Q3 Engineering & Product Roadmap Summit",
                description="Cross-functional alignment and roadmap presentation for upcoming platform milestones.",
                location="Main Auditorium & Room 101",
                starts_at=now + timedelta(days=12),
                ends_at=now + timedelta(days=12, hours=6),
                capacity=75,
                status="draft",
                created_by=created_users["manager@collab.com"].id,
            )
            db.add(draft_event)
            db.flush()
            print(f"  + Created Draft Event (Awaiting Approval): {draft_event.title}")

        # 7. Sample Resource Bookings (Awaiting Org Admin Approval)
        room101 = created_resources.get("Meeting Room 101")
        projector = created_resources.get("4K Ultra Laser Projector")

        if room101:
            existing_b1 = db.query(ResourceBooking).filter(
                ResourceBooking.resource_id == room101.id,
                ResourceBooking.purpose == "Sprint Architecture Review & Milestone Sign-off",
            ).first()
            if not existing_b1:
                b1 = ResourceBooking(
                    id=str(uuid.uuid4()),
                    resource_id=room101.id,
                    event_id=None,
                    requested_by=created_users["manager@collab.com"].id,
                    start_time=now + timedelta(days=2, hours=10),
                    end_time=now + timedelta(days=2, hours=13),
                    status="requested",
                    purpose="Sprint Architecture Review & Milestone Sign-off",
                )
                db.add(b1)
                print("  + Created Resource Booking [Requested]: Meeting Room 101")

        if projector:
            existing_b2 = db.query(ResourceBooking).filter(
                ResourceBooking.resource_id == projector.id,
                ResourceBooking.purpose == "High-resolution AV setup for demo day rehearsal",
            ).first()
            if not existing_b2:
                b2 = ResourceBooking(
                    id=str(uuid.uuid4()),
                    resource_id=projector.id,
                    event_id=None,
                    requested_by=created_users["staff@collab.com"].id,
                    start_time=now + timedelta(days=3, hours=14),
                    end_time=now + timedelta(days=3, hours=17),
                    status="requested",
                    purpose="High-resolution AV setup for demo day rehearsal",
                )
                db.add(b2)
                print("  + Created Resource Booking [Requested]: 4K Ultra Laser Projector")

        db.commit()
        print("\n[OK] Database seeding completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error seeding database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
