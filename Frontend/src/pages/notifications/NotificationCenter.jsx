import { useState, useEffect } from "react";
import notificationApi from "../../api/notificationApi";
import { useWebSocket } from "../../context/WebSocketContext";
import { Bell, CheckCheck } from "lucide-react";

export default function NotificationCenter() {
    const { latestMessage } = useWebSocket();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadNotifications = async () => {
        setLoading(true);
        setError("");
        try {
            const data = await notificationApi.getNotifications({ page: 1, page_size: 50 });
            setNotifications(data.items || []);
            setUnreadCount(data.unread_count || 0);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load notifications.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadNotifications();
    }, [latestMessage]);

    const handleMarkAsRead = async (id) => {
        try {
            await notificationApi.markAsRead(id);
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            );
            setUnreadCount((c) => Math.max(0, c - 1));
            window.dispatchEvent(new Event("notifications-updated"));
        } catch (err) {
            console.error(err);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await notificationApi.markAllAsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setUnreadCount(0);
            window.dispatchEvent(new Event("notifications-updated"));
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="notifications-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Notification Center</h1>
                    <p className="page-subtitle">
                        Real-time alerts for published events, waitlist promotions, bookings, and mentions.
                    </p>
                </div>

                {unreadCount > 0 && (
                    <button onClick={handleMarkAllAsRead} className="btn btn-secondary">
                        <CheckCheck size={16} /> Mark All as Read ({unreadCount})
                    </button>
                )}
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
                <div style={{ padding: "60px", textAlign: "center" }}>
                    <span className="spinner" />
                    <p style={{ marginTop: "12px", color: "var(--text-muted)" }}>Loading notifications...</p>
                </div>
            ) : notifications.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "40px" }}>
                    <Bell size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
                    <p style={{ color: "var(--text-muted)" }}>No notifications yet.</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    {notifications.map((item) => (
                        <div
                            key={item.id}
                            style={{
                                padding: "16px 20px",
                                borderBottom: "1px solid var(--border-color)",
                                backgroundColor: item.is_read ? "var(--bg-surface)" : "var(--primary-light)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: "16px",
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                    <h4 style={{ margin: 0, fontSize: "15px", fontWeight: item.is_read ? 600 : 700 }}>
                                        {item.title}
                                    </h4>
                                    <span style={{
                                        textTransform: "uppercase",
                                        fontSize: "10px",
                                        fontWeight: 800,
                                        padding: "1px 6px",
                                        borderRadius: "4px",
                                        background: "var(--bg-subtle)",
                                        color: "var(--text-muted)",
                                    }}>
                                        {item.notification_type || "general"}
                                    </span>
                                </div>
                                <p style={{ margin: "4px 0", fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                                    {item.message}
                                </p>
                                <span style={{ fontSize: "12px", color: "var(--text-light)" }}>
                                    {new Date(item.created_at).toLocaleString()}
                                </span>
                            </div>

                            {!item.is_read && (
                                <button
                                    onClick={() => handleMarkAsRead(item.id)}
                                    className="btn btn-secondary btn-sm"
                                    style={{ flexShrink: 0 }}
                                >
                                    Mark Read
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
