import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import dashboardApi from "../../api/dashboardApi";
import notificationApi from "../../api/notificationApi";
import {
    Calendar,
    Users,
    Box,
    BookmarkCheck,
    CheckCircle2,
    CheckCheck,
    Clock,
    UserCheck,
    AlertCircle,
    Plus,
    QrCode,
    TrendingUp,
    Layers,
    ArrowUpRight,
    Building2,
    LogOut,
    ShieldCheck,
    Camera,
    Ticket,
    Sparkles,
    Bell,
    X,
} from "lucide-react";

export default function Dashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const userRole = (user?.role || "participant").toLowerCase();
    const [selectedRole, setSelectedRole] = useState(() => {
        if (userRole === "super_admin" || (userRole === "admin" && (user?.email === "admin@collab.com" || user?.id === 1))) {
            return "super_admin";
        }
        return userRole || "admin";
    });

    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [approvalNotifications, setApprovalNotifications] = useState([]);
    const [isNotificationBarDismissed, setIsNotificationBarDismissed] = useState(false);

    const fetchApprovalNotifications = useCallback(async () => {
        try {
            const res = await notificationApi.getNotifications({ page: 1, page_size: 20 });
            const items = res.items || [];
            const pendingNotifs = items.filter(
                (n) =>
                    !n.is_read &&
                    (n.type === "booking_requested" ||
                        n.type === "event_approval_requested" ||
                        n.title?.toLowerCase().includes("booking") ||
                        n.title?.toLowerCase().includes("approval"))
            );
            setApprovalNotifications(pendingNotifs);
        } catch {
            // non-fatal
        }
    }, []);

    const fetchStats = async (role) => {
        setLoading(true);
        setError("");
        try {
            const apiRole = role === "super_admin" ? "admin" : role;
            const data = await dashboardApi.getStats({ role: apiRole });
            setStatsData(data);
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to load dashboard statistics.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchStats(selectedRole);
    }, [selectedRole]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchApprovalNotifications();

        const handleNotifsUpdated = () => {
            fetchApprovalNotifications();
        };
        window.addEventListener("notifications-updated", handleNotifsUpdated);

        const pollInterval = setInterval(() => {
            fetchApprovalNotifications();
        }, 15000);

        return () => {
            window.removeEventListener("notifications-updated", handleNotifsUpdated);
            clearInterval(pollInterval);
        };
    }, [fetchApprovalNotifications]);

    const handleReviewApprovals = async (notif) => {
        if (notif && !notif.is_read) {
            try {
                await notificationApi.markAsRead(notif.id);
                window.dispatchEvent(new Event("notifications-updated"));
            } catch {
                // ignore
            }
        }
        let targetUrl = "/bookings?status=requested";
        if (notif?.data) {
            try {
                const parsed = typeof notif.data === "string" ? JSON.parse(notif.data) : notif.data;
                if (parsed.url) targetUrl = parsed.url;
            } catch {
                // ignore
            }
        }
        navigate(targetUrl);
    };

    const handleMarkAllApprovalsRead = async () => {
        try {
            await notificationApi.markAllAsRead();
            setApprovalNotifications([]);
            window.dispatchEvent(new Event("notifications-updated"));
        } catch (err) {
            console.error("Failed to mark all as read:", err);
        }
    };

    const getRoleTitle = (r) => {
        if (r === "super_admin") return "Super Administrator";
        if (r === "admin") return "Organization Admin";
        if (r === "event_manager") return "Event Manager";
        if (r === "staff") return "Staff Coordinator";
        return "Participant / Attendee";
    };

    const getRoleBadgeStyle = (r) => {
        if (r === "super_admin") return { color: "#ef4444", bg: "#fef2f2", border: "#fecaca" };
        if (r === "admin") return { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" };
        if (r === "event_manager") return { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" };
        if (r === "staff") return { color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" };
        return { color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd" };
    };

    const getRoleCapabilitiesText = (r) => {
        if (r === "super_admin") {
            return "Full system access, all organizations, events, memberships, settings, and global telemetry.";
        }
        if (r === "admin") {
            return "Organization management, member role assignments, event & resource approvals, and workspace telemetry.";
        }
        if (r === "event_manager") {
            return "Create & edit events, breakout sessions, schedule speakers, attendance tracking & analytics.";
        }
        if (r === "staff") {
            return "On-site attendance & QR check-in, resource dispatch & booking operations, today's schedule.";
        }
        return "Browse public events, register/waitlist, view personal QR passes & bookings.";
    };

    const renderRoleCards = () => {
        if (!statsData || !statsData.stats) return null;
        const s = statsData.stats;

        // 1. SUPER ADMINISTRATOR CARDS
        if (selectedRole === "super_admin") {
            return (
                <div className="stats-grid-premium">
                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/organizations')}
                        role="button"
                        tabIndex={0}
                        title="Click to view all multi-tenant organizations"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Organizations</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-blue">
                                    <Building2 size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.total_organizations || 1}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#2563eb", fontWeight: 700 }}>● Full System Access</span>
                            <span>• Global Directory</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/events')}
                        role="button"
                        tabIndex={0}
                        title="Click to view all events across system"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">System-Wide Events</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-emerald">
                                    <Calendar size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.total_events ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#059669", fontWeight: 700 }}>● Global Events</span>
                            <span>• Lifetime total</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/organizations')}
                        role="button"
                        tabIndex={0}
                        title="Click to manage all system memberships"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Platform Members</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-purple">
                                    <Users size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.total_members ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#7c3aed", fontWeight: 700 }}>● All Tenants</span>
                            <span>• Role Assignments</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/resources')}
                        role="button"
                        tabIndex={0}
                        title="Click to view all bookable resources"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Active Resources</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-cyan">
                                    <Box size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.active_resources ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#0891b2", fontWeight: 700 }}>● Spaces & Equipment</span>
                            <span>• Full Catalog</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/bookings')}
                        role="button"
                        tabIndex={0}
                        title="Click to inspect all reservations"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">System Bookings</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-rose">
                                    <BookmarkCheck size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.current_bookings ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#e11d48", fontWeight: 700 }}>● Zero Conflicts</span>
                            <span>• Global Reservations</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/attendance-checkin')}
                        role="button"
                        tabIndex={0}
                        title="Click to view QR attendance records"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Attendance Verified</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-amber">
                                    <QrCode size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.total_registrations ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#d97706", fontWeight: 700 }}>● Live Telemetry</span>
                            <span>• On-Site Records</span>
                        </div>
                    </div>
                </div>
            );
        }

        // 2. ORGANIZATION ADMIN CARDS
        if (selectedRole === "admin") {
            return (
                <div className="stats-grid-premium">
                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/events')}
                        role="button"
                        tabIndex={0}
                        title="Click to view all events"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Total Events</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-blue">
                                    <Calendar size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.total_events ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#2563eb", fontWeight: 700 }}>● Across Org</span>
                            <span>• Lifetime total (Click to view)</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/events?status=published')}
                        role="button"
                        tabIndex={0}
                        title="Click to view published events"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Published Events</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-emerald">
                                    <CheckCircle2 size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.published_events ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#059669", fontWeight: 700 }}>● Active Public</span>
                            <span>• Click to filter</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/calendar')}
                        role="button"
                        tabIndex={0}
                        title="Click to open Master Calendar"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Upcoming Events</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-amber">
                                    <Clock size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.upcoming_events ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#d97706", fontWeight: 700 }}>● Scheduled</span>
                            <span>• Click to view Calendar</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/events?status=completed')}
                        role="button"
                        tabIndex={0}
                        title="Click to view completed events"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Completed Events</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-slate">
                                    <CheckCheck size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.completed_events ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#64748b", fontWeight: 700 }}>● Archived</span>
                            <span>• Click to filter</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/organizations')}
                        role="button"
                        tabIndex={0}
                        title="Click to view Organization & Members"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Total Members</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-purple">
                                    <Users size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.total_members ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#7c3aed", fontWeight: 700 }}>● Active Roster</span>
                            <span>• Click to manage members</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/my-registrations')}
                        role="button"
                        tabIndex={0}
                        title="Click to view registrations"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Total Registrations</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-cyan">
                                    <UserCheck size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.total_registrations ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#0891b2", fontWeight: 700 }}>● Participants</span>
                            <span>• Click to view entries</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/resources')}
                        role="button"
                        tabIndex={0}
                        title="Click to view Bookable Resources"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Active Resources</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-emerald">
                                    <Box size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.active_resources ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#059669", fontWeight: 700 }}>● Bookable</span>
                            <span>• Rooms & AV gear</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/bookings')}
                        role="button"
                        tabIndex={0}
                        title="Click to view Resource Bookings"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Current Bookings</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-rose">
                                    <BookmarkCheck size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.current_bookings ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#e11d48", fontWeight: 700 }}>● Zero Conflicts</span>
                            <span>• Click to view bookings</span>
                        </div>
                    </div>
                </div>
            );
        }

        if (selectedRole === "event_manager") {
            return (
                <div className="stats-grid-premium">
                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/events')}
                        role="button"
                        tabIndex={0}
                        title="Click to view your events"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">My Managed Events</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-blue">
                                    <Calendar size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.my_events ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#2563eb", fontWeight: 700 }}>● In Progress</span>
                            <span>• Click to manage</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/calendar')}
                        role="button"
                        tabIndex={0}
                        title="Click to view sessions on Calendar"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Upcoming Sessions</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-amber">
                                    <Layers size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.upcoming_sessions ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#d97706", fontWeight: 700 }}>● Breakouts</span>
                            <span>• Click for calendar</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/my-registrations')}
                        role="button"
                        tabIndex={0}
                        title="Click to view registrations"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Total Registrations</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-emerald">
                                    <Users size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.total_registrations ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#059669", fontWeight: 700 }}>● Confirmed Attendees</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/my-registrations')}
                        role="button"
                        tabIndex={0}
                        title="Click to view waitlisted queue"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Waitlisted Queue</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-rose">
                                    <Clock size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.waitlisted_participants ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#e11d48", fontWeight: 700 }}>● Auto Promotion Active</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/attendance-checkin')}
                        role="button"
                        tabIndex={0}
                        title="Click to view attendance records"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Attendance Rate</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-cyan">
                                    <TrendingUp size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.attendance_rate ? `${s.attendance_rate}%` : "0%"}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#0891b2", fontWeight: 700 }}>● Verified Check-ins</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/bookings')}
                        role="button"
                        tabIndex={0}
                        title="Click to view resource bookings"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Resource Bookings</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-purple">
                                    <BookmarkCheck size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.resource_bookings ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#7c3aed", fontWeight: 700 }}>● Approved Venues</span>
                        </div>
                    </div>
                </div>
            );
        }

        if (selectedRole === "staff") {
            return (
                <div className="stats-grid-premium">
                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/events')}
                        role="button"
                        tabIndex={0}
                        title="Click to view assigned events"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Assigned Events</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-blue">
                                    <Calendar size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.assigned_events ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#2563eb", fontWeight: 700 }}>● Operational Duty</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/calendar')}
                        role="button"
                        tabIndex={0}
                        title="Click to view today's sessions"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Today's Sessions</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-amber">
                                    <Clock size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.today_sessions ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#d97706", fontWeight: 700 }}>● Live On Deck</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/bookings?status=requested')}
                        role="button"
                        tabIndex={0}
                        title="Click to review pending bookings"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Pending Approvals</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-rose">
                                    <AlertCircle size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.pending_registrations ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#e11d48", fontWeight: 700 }}>● Needs Review</span>
                        </div>
                    </div>

                    <div
                        className="stat-card-premium"
                        onClick={() => navigate('/attendance-checkin')}
                        role="button"
                        tabIndex={0}
                        title="Click to check in attendees"
                    >
                        <div className="stat-card-header">
                            <span className="stat-card-title">Attendance Marked</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <ArrowUpRight size={14} className="stat-card-arrow" />
                                <div className="stat-icon-wrapper stat-icon-emerald">
                                    <CheckCircle2 size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card-value">{s.attendance_marked ?? 0}</div>
                        <div className="stat-card-indicator">
                            <span style={{ color: "#059669", fontWeight: 700 }}>● QR Verified</span>
                        </div>
                    </div>
                </div>
            );
        }

        // Participant
        return (
            <div className="stats-grid-premium">
                <div
                    className="stat-card-premium"
                    onClick={() => navigate('/my-registrations')}
                    role="button"
                    tabIndex={0}
                    title="Click to view your registered events"
                >
                    <div className="stat-card-header">
                        <span className="stat-card-title">Registered Events</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <ArrowUpRight size={14} className="stat-card-arrow" />
                            <div className="stat-icon-wrapper stat-icon-blue">
                                <Calendar size={20} />
                            </div>
                        </div>
                    </div>
                    <div className="stat-card-value">{s.registered_events ?? 0}</div>
                    <div className="stat-card-indicator">
                        <span style={{ color: "#2563eb", fontWeight: 700 }}>● Confirmed Seats</span>
                    </div>
                </div>

                <div
                    className="stat-card-premium"
                    onClick={() => navigate('/events')}
                    role="button"
                    tabIndex={0}
                    title="Click to discover upcoming events"
                >
                    <div className="stat-card-header">
                        <span className="stat-card-title">Upcoming Events</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <ArrowUpRight size={14} className="stat-card-arrow" />
                            <div className="stat-icon-wrapper stat-icon-emerald">
                                <Clock size={20} />
                            </div>
                        </div>
                    </div>
                    <div className="stat-card-value">{s.upcoming_events ?? 0}</div>
                    <div className="stat-card-indicator">
                        <span style={{ color: "#059669", fontWeight: 700 }}>● On Your Calendar</span>
                    </div>
                </div>

                <div
                    className="stat-card-premium"
                    onClick={() => navigate('/calendar')}
                    role="button"
                    tabIndex={0}
                    title="Click to view sessions calendar"
                >
                    <div className="stat-card-header">
                        <span className="stat-card-title">Upcoming Sessions</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <ArrowUpRight size={14} className="stat-card-arrow" />
                            <div className="stat-icon-wrapper stat-icon-cyan">
                                <Layers size={20} />
                            </div>
                        </div>
                    </div>
                    <div className="stat-card-value">{s.upcoming_sessions ?? 0}</div>
                    <div className="stat-card-indicator">
                        <span style={{ color: "#0891b2", fontWeight: 700 }}>● Breakouts</span>
                    </div>
                </div>

                <div
                    className="stat-card-premium"
                    onClick={() => navigate('/my-registrations')}
                    role="button"
                    tabIndex={0}
                    title="Click to view your waitlist status"
                >
                    <div className="stat-card-header">
                        <span className="stat-card-title">Waitlisted Events</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <ArrowUpRight size={14} className="stat-card-arrow" />
                            <div className="stat-icon-wrapper stat-icon-amber">
                                <AlertCircle size={20} />
                            </div>
                        </div>
                    </div>
                    <div className="stat-card-value">{s.waitlisted_events ?? 0}</div>
                    <div className="stat-card-indicator">
                        <span style={{ color: "#d97706", fontWeight: 700 }}>● In FIFO Queue</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-page">
            {/* Header with Title and Modern Role Switcher */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Executive Operations Dashboard</h1>
                    <p className="page-subtitle">
                        Real-time collaborative analytics, capacity tracking, and multi-tenant resource dispatch.
                    </p>
                </div>

                {/* Role Switcher Pill & Logout Action */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <div className="role-switcher-card">
                        <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                            View as:
                        </span>
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="role-select"
                        >
                            <option value="super_admin">Super Administrator</option>
                            <option value="admin">Organization Admin</option>
                            <option value="event_manager">Event Manager</option>
                            <option value="staff">Staff Coordinator</option>
                            <option value="participant">Participant / Attendee</option>
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={async () => {
                            try {
                                await logout();
                                navigate("/login");
                            } catch (e) {
                                console.error(e);
                            }
                        }}
                        className="dashboard-logout-btn"
                        title="Sign Out of Account"
                    >
                        <LogOut size={14} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>

            {/* Role Access Capabilities Banner */}
            <div className="role-capability-banner">
                <div className="role-capability-left">
                    <span
                        className="role-capability-pill"
                        style={{
                            color: getRoleBadgeStyle(selectedRole).color,
                            backgroundColor: getRoleBadgeStyle(selectedRole).bg,
                            border: `1px solid ${getRoleBadgeStyle(selectedRole).border}`,
                        }}
                    >
                        <ShieldCheck size={16} />
                        <span>Role: {getRoleTitle(selectedRole)}</span>
                    </span>
                    <p className="role-capability-desc">
                        <strong>Access Capabilities:</strong> {getRoleCapabilitiesText(selectedRole)}
                    </p>
                </div>
            </div>

            {/* Real-time Notification Bar for Org Admins & Super Admins */}
            {(selectedRole === "admin" || selectedRole === "super_admin") &&
                !isNotificationBarDismissed &&
                approvalNotifications.length > 0 && (
                    <div className="admin-notification-bar" role="alert">
                        <div className="admin-notification-bar-content">
                            <div className="admin-notification-bell-icon">
                                <Bell size={18} className="animate-pulse" />
                            </div>
                            <div className="admin-notification-bar-text">
                                <strong>Approvals Pending: </strong>
                                <span>
                                    You have {approvalNotifications.length} new {approvalNotifications.length === 1 ? "request" : "requests"} awaiting approval.
                                </span>
                                <span style={{ display: "block", fontSize: "12.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Latest: <strong>{approvalNotifications[0].title}</strong> — {approvalNotifications[0].message}
                                </span>
                            </div>
                        </div>

                        <div className="admin-notification-bar-actions">
                            <button
                                type="button"
                                onClick={() => handleReviewApprovals(approvalNotifications[0])}
                                className="btn btn-primary btn-sm"
                                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                            >
                                Review Approvals
                            </button>
                            <button
                                type="button"
                                onClick={handleMarkAllApprovalsRead}
                                className="btn btn-secondary btn-sm"
                                title="Mark all approval alerts as read"
                                style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                                <CheckCheck size={14} />
                                <span>Mark Read</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsNotificationBarDismissed(true)}
                                className="btn btn-icon btn-sm"
                                title="Dismiss notification bar"
                                style={{ color: "var(--text-muted)", padding: "4px", background: "none", border: "none", cursor: "pointer" }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )}

            {/* Quick Actions Bar - Tailored by Access Capabilities */}
            <div className="quick-actions-bar">
                <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginRight: "8px" }}>
                    Quick Dispatch:
                </span>

                {selectedRole === "super_admin" && (
                    <>
                        <Link to="/organizations" className="action-pill">
                            <Plus size={15} style={{ color: "var(--primary)" }} /> New Organization
                        </Link>
                        <Link to="/events" className="action-pill">
                            <Calendar size={15} style={{ color: "#059669" }} /> Global Events
                        </Link>
                        <Link to="/calendar" className="action-pill">
                            <Clock size={15} style={{ color: "#7c3aed" }} /> Master Calendar
                        </Link>
                        <Link to="/resources" className="action-pill">
                            <Box size={15} style={{ color: "#0891b2" }} /> Resource Catalog
                        </Link>
                        <Link to="/bookings" className="action-pill">
                            <BookmarkCheck size={15} style={{ color: "#e11d48" }} /> Reservations & Approvals
                        </Link>
                        <Link to="/attendance-checkin" className="action-pill">
                            <QrCode size={15} style={{ color: "#d97706" }} /> QR Attendance Desk
                        </Link>
                    </>
                )}

                {selectedRole === "admin" && (
                    <>
                        <Link to="/organizations" className="action-pill">
                            <Building2 size={15} style={{ color: "var(--primary)" }} /> Workspace Identity
                        </Link>
                        <Link to="/organizations" className="action-pill">
                            <Users size={15} style={{ color: "#7c3aed" }} /> Member Roles
                        </Link>
                        <Link to="/organizations" className="action-pill">
                            <CheckCircle2 size={15} style={{ color: "#059669" }} /> Approvals Queue
                        </Link>
                        <Link to="/resources" className="action-pill">
                            <Box size={15} style={{ color: "#0891b2" }} /> Book Resource
                        </Link>
                        <Link to="/calendar" className="action-pill">
                            <Calendar size={15} style={{ color: "#d97706" }} /> Master Calendar
                        </Link>
                    </>
                )}

                {selectedRole === "event_manager" && (
                    <>
                        <Link to="/events" className="action-pill">
                            <Plus size={15} style={{ color: "var(--primary)" }} /> Create New Event
                        </Link>
                        <Link to="/events" className="action-pill">
                            <Layers size={15} style={{ color: "#7c3aed" }} /> Sessions & Speakers
                        </Link>
                        <Link to="/bookings" className="action-pill">
                            <BookmarkCheck size={15} style={{ color: "#059669" }} /> Reserve Venue
                        </Link>
                        <Link to="/calendar" className="action-pill">
                            <Calendar size={15} style={{ color: "#d97706" }} /> Master Calendar
                        </Link>
                        <Link to="/attendance-checkin" className="action-pill">
                            <TrendingUp size={15} style={{ color: "#0891b2" }} /> Attendance Analytics
                        </Link>
                    </>
                )}

                {selectedRole === "staff" && (
                    <>
                        <Link to="/attendance-checkin" className="action-pill" style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#059669", fontWeight: 700 }}>
                            <Camera size={15} /> Launch Camera QR Scanner
                        </Link>
                        <Link to="/attendance-checkin" className="action-pill">
                            <QrCode size={15} style={{ color: "#0891b2" }} /> Manual Check-In Desk
                        </Link>
                        <Link to="/resources" className="action-pill">
                            <Box size={15} style={{ color: "#7c3aed" }} /> Dispatch Resources
                        </Link>
                        <Link to="/calendar" className="action-pill">
                            <Clock size={15} style={{ color: "#d97706" }} /> Today's Live Schedule
                        </Link>
                    </>
                )}

                {selectedRole === "participant" && (
                    <>
                        <Link to="/events" className="action-pill" style={{ background: "rgba(37, 99, 235, 0.12)", border: "1px solid rgba(37, 99, 235, 0.3)", color: "#2563eb", fontWeight: 700 }}>
                            <Sparkles size={15} /> Discover Public Events
                        </Link>
                        <Link to="/my-registrations" className="action-pill">
                            <Ticket size={15} style={{ color: "#059669" }} /> My Digital QR Passes
                        </Link>
                        <Link to="/calendar" className="action-pill">
                            <Calendar size={15} style={{ color: "#7c3aed" }} /> My Calendar Schedule
                        </Link>
                        <Link to="/bookings" className="action-pill">
                            <BookmarkCheck size={15} style={{ color: "#0891b2" }} /> My Reservations
                        </Link>
                    </>
                )}
            </div>

            {/* Role-Specific Focus Desk Banners */}
            {selectedRole === "staff" && (
                <div className="focus-desk-card">
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div style={{ width: "46px", height: "46px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.15)", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Camera size={24} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>On-Site QR Check-In Launchpad</h3>
                            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "3px 0 0 0" }}>
                                Fast camera scanning, audio beep feedback, and manual participant verification.
                            </p>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <Link to="/attendance-checkin" className="btn btn-primary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <Camera size={14} /> Open Live Scanner
                        </Link>
                        <Link to="/calendar" className="btn btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <Clock size={14} /> View Today's Schedule
                        </Link>
                    </div>
                </div>
            )}

            {selectedRole === "participant" && (
                <div className="focus-desk-card">
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div style={{ width: "46px", height: "46px", borderRadius: "12px", background: "rgba(37, 99, 235, 0.15)", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Ticket size={24} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>Your Confirmed Digital Passes</h3>
                            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "3px 0 0 0" }}>
                                Present your QR pass at the entrance desk for rapid instant contactless check-in.
                            </p>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <Link to="/my-registrations" className="btn btn-primary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <QrCode size={14} /> View My QR Passes
                        </Link>
                        <Link to="/events" className="btn btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <Calendar size={14} /> Browse More Events
                        </Link>
                    </div>
                </div>
            )}

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
                <div style={{ padding: "80px 20px", textAlign: "center" }}>
                    <span className="spinner" />
                    <p style={{ marginTop: "16px", color: "var(--text-muted)", fontSize: "14px", fontWeight: 500 }}>
                        Synthesizing live operational telemetry...
                    </p>
                </div>
            ) : (
                <>
                    {renderRoleCards()}

                    {/* Tables Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: "24px" }}>
                        {/* Recent Events Card */}
                        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-surface)" }}>
                                <div>
                                    <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>Upcoming & Active Events</h3>
                                    <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>Published summits and conferences</p>
                                </div>
                                <Link to="/events" className="action-pill" style={{ fontSize: "12px", padding: "6px 12px" }}>
                                    View all <ArrowUpRight size={13} />
                                </Link>
                            </div>

                            {statsData?.recent_events?.length === 0 ? (
                                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                                    <Calendar size={32} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                                    <p style={{ fontSize: "13.5px" }}>No active events scheduled yet.</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Event Name</th>
                                                <th>Status</th>
                                                <th>Event Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {statsData?.recent_events?.map((ev) => (
                                                <tr
                                                    key={ev.id}
                                                    onClick={() => navigate(`/events/${ev.id}`)}
                                                    style={{ cursor: "pointer" }}
                                                    title="Click to view event details"
                                                >
                                                    <td>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "12px" }}>
                                                                EV
                                                            </div>
                                                            <div>
                                                                <span style={{ fontWeight: 700, color: "var(--text-main)", display: "block" }}>{ev.title || ev.name}</span>
                                                                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>ID: {ev.id.slice(0, 8)}...</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`badge badge-${ev.status}`}>{ev.status}</span>
                                                    </td>
                                                    <td style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-muted)" }}>
                                                        {new Date(ev.starts_at || ev.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Recent Bookings Card */}
                        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-surface)" }}>
                                <div>
                                    <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>Resource Bookings</h3>
                                    <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>Double-booking prevention active</p>
                                </div>
                                <Link to="/bookings" className="action-pill" style={{ fontSize: "12px", padding: "6px 12px" }}>
                                    View all <ArrowUpRight size={13} />
                                </Link>
                            </div>

                            {statsData?.recent_bookings?.length === 0 ? (
                                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                                    <Box size={32} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                                    <p style={{ fontSize: "13.5px" }}>No recent resource reservations.</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Purpose / Space</th>
                                                <th>Status</th>
                                                <th>Schedule Window</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {statsData?.recent_bookings?.map((b) => (
                                                <tr
                                                    key={b.id}
                                                    onClick={() => navigate('/bookings')}
                                                    style={{ cursor: "pointer" }}
                                                    title="Click to view bookings management"
                                                >
                                                    <td>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f5f3ff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "12px" }}>
                                                                BK
                                                            </div>
                                                            <div>
                                                                <span style={{ fontWeight: 700, color: "var(--text-main)", display: "block" }}>{b.purpose || "Resource Reservation"}</span>
                                                                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Resource #{b.resource_id}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`badge badge-${b.status}`}>{b.status}</span>
                                                    </td>
                                                    <td style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                                                        {new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
