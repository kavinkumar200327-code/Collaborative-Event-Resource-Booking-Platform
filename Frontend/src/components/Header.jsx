import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import notificationApi from "../api/notificationApi";
import { Bell, LogOut, Check, Building, CheckCheck } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
    const { user, logout } = useAuth();
    const { isConnected, latestMessage } = useWebSocket();
    const navigate = useNavigate();

    const [unreadCount, setUnreadCount] = useState(0);
    const [recentNotifications, setRecentNotifications] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    const loadNotifications = useCallback(async () => {
        try {
            const data = await notificationApi.getNotifications({ page: 1, page_size: 8 });
            setRecentNotifications(data.items || []);
            setUnreadCount(data.unread_count || 0);
        } catch (e) {
            console.warn("Failed to load notifications:", e);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadNotifications();
    }, [latestMessage, loadNotifications]);

    useEffect(() => {
        const handleNotifsUpdated = () => {
            loadNotifications();
        };
        window.addEventListener("notifications-updated", handleNotifsUpdated);

        // Periodic background poll every 15s for cross-client sync
        const pollInterval = setInterval(() => {
            loadNotifications();
        }, 15000);

        return () => {
            window.removeEventListener("notifications-updated", handleNotifsUpdated);
            clearInterval(pollInterval);
        };
    }, [loadNotifications]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleToggleDropdown = () => {
        const nextState = !showDropdown;
        setShowDropdown(nextState);
        if (nextState) {
            loadNotifications();
        }
    };

    const handleMarkAsRead = async (id, e) => {
        if (e) e.stopPropagation();
        try {
            await notificationApi.markAsRead(id);
            setRecentNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
            window.dispatchEvent(new Event("notifications-updated"));
        } catch (err) {
            console.error(err);
        }
    };

    const handleMarkAllAsRead = async (e) => {
        if (e) e.stopPropagation();
        try {
            await notificationApi.markAllAsRead();
            setRecentNotifications((prev) =>
                prev.map((n) => ({ ...n, is_read: true }))
            );
            setUnreadCount(0);
            window.dispatchEvent(new Event("notifications-updated"));
        } catch (err) {
            console.error(err);
        }
    };

    const handleNotificationClick = async (n) => {
        if (!n.is_read) {
            await handleMarkAsRead(n.id);
        }
        setShowDropdown(false);

        let targetUrl = null;
        try {
            if (n.data) {
                const parsed = typeof n.data === "string" ? JSON.parse(n.data) : n.data;
                targetUrl = parsed.url;
            }
        } catch {
            // ignore JSON parse errors
        }

        if (targetUrl) {
            navigate(targetUrl);
        } else if (n.type === "booking_requested" || n.type?.includes("booking")) {
            navigate("/bookings?status=requested");
        } else if (n.type === "event_approval_requested" || n.type?.includes("event")) {
            navigate(n.organization_id ? `/organizations/${n.organization_id}` : "/events");
        } else {
            navigate("/notifications");
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate("/login");
        } catch (err) {
            console.error("Logout failed:", err);
        }
    };

    return (
        <header className="app-header">
            <div className="header-left">
                <div className="header-org-chip">
                    <Building size={14} style={{ color: "var(--primary)" }} />
                    <span>Acme Technology Global</span>
                    <span style={{ fontSize: "10px", background: "var(--primary-light)", color: "var(--primary)", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                        PRIMARY
                    </span>
                </div>
            </div>

            <div className="header-right">
                {/* WebSocket Real-Time Badge */}
                <div className="ws-indicator" title={isConnected ? "Real-time full-duplex socket synchronized" : "Connecting to real-time socket..."}>
                    <span className={`ws-dot ${isConnected ? "connected" : ""}`} />
                    <span style={{ color: isConnected ? "#059669" : "#64748b" }}>
                        {isConnected ? "Real-Time Sync" : "Reconnecting"}
                    </span>
                </div>

                {/* Automatic Time-Based Theme Switcher */}
                <ThemeToggle />

                {/* Notifications Bell & Dropdown */}
                <div style={{ position: "relative" }} ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={handleToggleDropdown}
                        style={{
                            background: "transparent",
                            border: "1px solid var(--border-color)",
                            borderRadius: "50%",
                            width: "38px",
                            height: "38px",
                            position: "relative",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--text-main)",
                            transition: "all 0.15s ease",
                            backgroundColor: "var(--bg-surface)",
                            boxShadow: "var(--shadow-xs)",
                        }}
                        title={unreadCount > 0 ? `${unreadCount} unread notification(s)` : "Notifications"}
                    >
                        <Bell size={18} />
                        {unreadCount > 0 && (
                            <span style={{
                                position: "absolute",
                                top: "-2px",
                                right: "-2px",
                                background: "var(--danger)",
                                color: "#fff",
                                fontSize: "10px",
                                fontWeight: 800,
                                borderRadius: "10px",
                                padding: "1px 5px",
                                lineHeight: "14px",
                                border: "2px solid var(--bg-surface)",
                                animation: "pulse 2s infinite",
                            }}>
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                        )}
                    </button>

                    {showDropdown && (
                        <div style={{
                            position: "absolute",
                            right: 0,
                            top: "100%",
                            marginTop: "10px",
                            width: "380px",
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "var(--radius-lg)",
                            boxShadow: "var(--shadow-xl)",
                            zIndex: 100,
                            overflow: "hidden",
                            animation: "modalIn 0.2s ease-out",
                        }}>
                            <div style={{
                                padding: "12px 18px",
                                borderBottom: "1px solid var(--border-color)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                background: "var(--bg-subtle)",
                            }}>
                                <strong style={{ fontSize: "14px", fontWeight: 700 }}>Notifications</strong>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    {unreadCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleMarkAllAsRead}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                color: "var(--primary)",
                                                fontSize: "12px",
                                                fontWeight: 600,
                                                cursor: "pointer",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                padding: 0,
                                            }}
                                            title="Mark all notifications as read"
                                        >
                                            <CheckCheck size={14} /> Mark all read
                                        </button>
                                    )}
                                    <Link
                                        to="/notifications"
                                        onClick={() => setShowDropdown(false)}
                                        style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}
                                    >
                                        View all
                                    </Link>
                                </div>
                            </div>

                            <div style={{ maxHeight: "360px", overflowY: "auto" }}>
                                {recentNotifications.length === 0 ? (
                                    <div style={{ padding: "36px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                                        <Bell size={24} style={{ opacity: 0.3, margin: "0 auto 8px" }} />
                                        <p style={{ margin: 0 }}>No notifications yet</p>
                                    </div>
                                ) : (
                                    recentNotifications.map((n) => (
                                        <div
                                            key={n.id}
                                            onClick={() => handleNotificationClick(n)}
                                            role="button"
                                            tabIndex={0}
                                            style={{
                                                padding: "12px 16px",
                                                borderBottom: "1px solid var(--border-subtle)",
                                                backgroundColor: n.is_read ? "transparent" : "rgba(79, 70, 229, 0.05)",
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "flex-start",
                                                gap: "10px",
                                                cursor: "pointer",
                                                transition: "background 0.15s ease",
                                            }}
                                            title="Click to view details and mark as read"
                                        >
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                                                    {!n.is_read && (
                                                        <span style={{
                                                            width: "6px",
                                                            height: "6px",
                                                            borderRadius: "50%",
                                                            backgroundColor: "#ef4444",
                                                            display: "inline-block",
                                                            flexShrink: 0,
                                                        }} />
                                                    )}
                                                    <p style={{ fontSize: "13px", fontWeight: n.is_read ? 600 : 700, margin: 0, color: "var(--text-main)" }}>
                                                        {n.title}
                                                    </p>
                                                </div>
                                                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "3px 0 0 0", lineHeight: 1.4 }}>
                                                    {n.message}
                                                </p>
                                                <span style={{ fontSize: "10.5px", color: "var(--text-light)", marginTop: "4px", display: "inline-block" }}>
                                                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                            {!n.is_read && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleMarkAsRead(n.id, e)}
                                                    className="btn btn-secondary btn-sm"
                                                    title="Mark as read"
                                                    style={{ padding: "4px 8px", flexShrink: 0 }}
                                                >
                                                    <Check size={12} />
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* User Section Pill */}
                <div className="header-user-btn">
                    <div className="user-avatar-circle">
                        {user?.full_name ? user.full_name[0].toUpperCase() : (user?.email ? user.email[0].toUpperCase() : "U")}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2 }}>
                            {user?.full_name || user?.email}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "capitalize", fontWeight: 500 }}>
                            {user?.role || "Member"}
                        </span>
                    </div>
                </div>

                {/* Sign Out Button */}
                <button
                    type="button"
                    onClick={handleLogout}
                    className="btn btn-secondary btn-sm"
                    style={{ borderRadius: "9999px" }}
                    title="Sign Out"
                >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                </button>
            </div>
        </header>
    );
}
