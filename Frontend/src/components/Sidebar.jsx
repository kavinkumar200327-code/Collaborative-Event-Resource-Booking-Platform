import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
    LayoutDashboard,
    Building2,
    Calendar,
    CalendarDays,
    Box,
    BookmarkCheck,
    Users,
    QrCode,
    Bell,
    Settings,
    Sparkles,
    LogOut,
} from "lucide-react";

export default function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const userRole = (user?.role || "participant").toLowerCase();
    const isSuperAdmin = userRole === "super_admin" || (userRole === "admin" && (user?.email === "admin@collab.com" || user?.id === 1));
    const isOrgAdmin = userRole === "admin" && !isSuperAdmin;
    const isEventManager = userRole === "event_manager";
    const isStaff = userRole === "staff";
    const isParticipant = userRole === "participant" || (!isSuperAdmin && !isOrgAdmin && !isEventManager && !isStaff);

    const getRoleBadge = () => {
        if (isSuperAdmin) return { label: "Super Admin", color: "#f87171", bg: "rgba(239, 68, 68, 0.18)", border: "rgba(239, 68, 68, 0.35)" };
        if (isOrgAdmin) return { label: "Org Admin", color: "#60a5fa", bg: "rgba(59, 130, 246, 0.18)", border: "rgba(59, 130, 246, 0.35)" };
        if (isEventManager) return { label: "Event Manager", color: "#c084fc", bg: "rgba(168, 85, 247, 0.18)", border: "rgba(168, 85, 247, 0.35)" };
        if (isStaff) return { label: "Staff Coordinator", color: "#34d399", bg: "rgba(16, 185, 129, 0.18)", border: "rgba(16, 185, 129, 0.35)" };
        return { label: "Attendee", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.18)", border: "rgba(56, 189, 248, 0.35)" };
    };

    const roleBadge = getRoleBadge();

    const handleLogout = async () => {
        try {
            await logout();
            navigate("/login");
        } catch (err) {
            console.error("Logout failed", err);
        }
    };

    return (
        <aside className="app-sidebar">
            {/* Brand Header */}
            <div className="sidebar-header">
                <div className="sidebar-brand-icon">
                    <Sparkles size={18} />
                </div>
                <div style={{ display: "flex", alignItems: "center" }}>
                    <span className="sidebar-brand-name">CollabEvent</span>
                    <span className="sidebar-brand-badge">PRO</span>
                </div>
            </div>

            {/* Nav Links - Tailored by Access Capabilities */}
            <nav className="sidebar-nav">
                {/* 1. PARTICIPANT / ATTENDEE NAVIGATION */}
                {isParticipant && (
                    <>
                        <span className="sidebar-section-title">Attendee Portal</span>
                        <NavLink
                            to="/dashboard"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <LayoutDashboard size={18} />
                            <span>My Event Hub</span>
                        </NavLink>

                        <NavLink
                            to="/events"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <Calendar size={18} />
                            <span>Browse Events</span>
                        </NavLink>

                        <NavLink
                            to="/calendar"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <CalendarDays size={18} />
                            <span>Master Calendar</span>
                        </NavLink>

                        <span className="sidebar-section-title">Passes & Bookings</span>
                        <NavLink
                            to="/my-registrations"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <Users size={18} />
                            <span>My Registrations</span>
                            <span style={{
                                marginLeft: "auto",
                                fontSize: "10px",
                                fontWeight: 700,
                                background: "rgba(6, 182, 212, 0.2)",
                                color: "#22d3ee",
                                padding: "2px 6px",
                                borderRadius: "4px",
                            }}>
                                QR Passes
                            </span>
                        </NavLink>

                        <NavLink
                            to="/bookings"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <BookmarkCheck size={18} />
                            <span>My Reservations</span>
                        </NavLink>
                    </>
                )}

                {/* 2. STAFF COORDINATOR NAVIGATION */}
                {isStaff && (
                    <>
                        <span className="sidebar-section-title">On-Site Operations</span>
                        <NavLink
                            to="/dashboard"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <LayoutDashboard size={18} />
                            <span>Operations Center</span>
                        </NavLink>

                        <NavLink
                            to="/attendance-checkin"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <QrCode size={18} />
                            <span>QR Attendance</span>
                            <span style={{
                                marginLeft: "auto",
                                fontSize: "10px",
                                fontWeight: 700,
                                background: "rgba(16, 185, 129, 0.2)",
                                color: "#34d399",
                                padding: "2px 6px",
                                borderRadius: "4px",
                            }}>
                                Active
                            </span>
                        </NavLink>

                        <NavLink
                            to="/calendar"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <CalendarDays size={18} />
                            <span>Today's Schedule</span>
                        </NavLink>

                        <NavLink
                            to="/events"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <Calendar size={18} />
                            <span>Operational Events</span>
                        </NavLink>

                        <span className="sidebar-section-title">Resource Logistics</span>
                        <NavLink
                            to="/resources"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <Box size={18} />
                            <span>Bookable Resources</span>
                        </NavLink>

                        <NavLink
                            to="/bookings"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <BookmarkCheck size={18} />
                            <span>Dispatch & Bookings</span>
                        </NavLink>
                    </>
                )}

                {/* 3. EVENT MANAGER NAVIGATION */}
                {isEventManager && (
                    <>
                        <span className="sidebar-section-title">Event Lifecycle</span>
                        <NavLink
                            to="/dashboard"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <LayoutDashboard size={18} />
                            <span>Event Analytics</span>
                        </NavLink>

                        <NavLink
                            to="/events"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <Calendar size={18} />
                            <span>Events & Sessions</span>
                        </NavLink>

                        <NavLink
                            to="/calendar"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <CalendarDays size={18} />
                            <span>Master Calendar</span>
                        </NavLink>

                        <span className="sidebar-section-title">Spaces & Venues</span>
                        <NavLink
                            to="/resources"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <Box size={18} />
                            <span>Bookable Resources</span>
                        </NavLink>

                        <NavLink
                            to="/bookings"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <BookmarkCheck size={18} />
                            <span>Room Reservations</span>
                        </NavLink>

                        <span className="sidebar-section-title">Audience & On-Site</span>
                        <NavLink
                            to="/attendance-checkin"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <QrCode size={18} />
                            <span>Attendance & QR</span>
                        </NavLink>
                    </>
                )}

                {/* 4. SUPER ADMIN & ORG ADMIN NAVIGATION */}
                {(isSuperAdmin || isOrgAdmin) && (
                    <>
                        <span className="sidebar-section-title">
                            {isSuperAdmin ? "Global System" : "Workspace Operations"}
                        </span>
                        <NavLink
                            to="/dashboard"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <LayoutDashboard size={18} />
                            <span>{isSuperAdmin ? "System Telemetry" : "Admin Dashboard"}</span>
                        </NavLink>

                        <NavLink
                            to="/organizations"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <Building2 size={18} />
                            <span>Organizations</span>
                            <span style={{
                                marginLeft: "auto",
                                fontSize: "10px",
                                fontWeight: 700,
                                background: isSuperAdmin ? "rgba(239, 68, 68, 0.2)" : "rgba(59, 130, 246, 0.2)",
                                color: isSuperAdmin ? "#f87171" : "#60a5fa",
                                padding: "2px 6px",
                                borderRadius: "4px",
                            }}>
                                {isSuperAdmin ? "System" : "Tenant"}
                            </span>
                        </NavLink>

                        <NavLink
                            to="/events"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <Calendar size={18} />
                            <span>All Events</span>
                        </NavLink>

                        <NavLink
                            to="/calendar"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <CalendarDays size={18} />
                            <span>Master Calendar</span>
                        </NavLink>

                        <span className="sidebar-section-title">Resources & Spaces</span>
                        <NavLink
                            to="/resources"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <Box size={18} />
                            <span>Bookable Resources</span>
                        </NavLink>

                        <NavLink
                            to="/bookings"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <BookmarkCheck size={18} />
                            <span>Reservations & Approvals</span>
                        </NavLink>

                        <span className="sidebar-section-title">Field Operations</span>
                        <NavLink
                            to="/attendance-checkin"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <QrCode size={18} />
                            <span>QR Attendance</span>
                        </NavLink>

                        <NavLink
                            to="/my-registrations"
                            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                        >
                            <Users size={18} />
                            <span>Registrations</span>
                        </NavLink>
                    </>
                )}

                <span className="sidebar-section-title">Preferences</span>
                <NavLink
                    to="/notifications"
                    className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                >
                    <Bell size={18} />
                    <span>Notifications</span>
                </NavLink>

                <NavLink
                    to="/settings"
                    className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                >
                    <Settings size={18} />
                    <span>Profile & Security</span>
                </NavLink>
            </nav>

            {/* User Footer with Direct Logout */}
            <div style={{
                padding: "16px 14px",
                borderTop: "1px solid var(--sidebar-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "rgba(0, 0, 0, 0.2)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    <div style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "var(--primary-gradient)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "12px",
                        flexShrink: 0,
                    }}>
                        {user?.full_name ? user.full_name[0].toUpperCase() : (user?.email ? user.email[0].toUpperCase() : "U")}
                    </div>
                    <div style={{ minWidth: 0, overflow: "hidden" }}>
                        <span style={{
                            display: "block",
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#fff",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}>
                            {user?.full_name || user?.email}
                        </span>
                        <span style={{
                            display: "inline-block",
                            marginTop: "2px",
                            fontSize: "10.5px",
                            fontWeight: 700,
                            color: roleBadge.color,
                            background: roleBadge.bg,
                            border: `1px solid ${roleBadge.border}`,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            letterSpacing: "0.02em",
                        }}>
                            {roleBadge.label}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: "8px",
                        padding: "7px 10px",
                        color: "#fca5a5",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        transition: "all 0.15s ease",
                        flexShrink: 0,
                    }}
                    title="Sign Out"
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(239, 68, 68, 0.3)";
                        e.currentTarget.style.color = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
                        e.currentTarget.style.color = "#fca5a5";
                    }}
                >
                    <LogOut size={14} />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}
