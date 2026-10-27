import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { useAuth } from "../../context/AuthContext";
import { useConfirm } from "../../context/ConfirmContext";
import registrationApi from "../../api/registrationApi";
import bookingApi from "../../api/bookingApi";
import eventApi from "../../api/eventApi";
import {
    Calendar,
    Clock,
    MapPin,
    QrCode,
    Download,
    CheckCircle2,
    X,
    Sparkles,
    Box,
    BookmarkCheck,
    Printer,
    Ticket,
} from "lucide-react";

export default function MyRegistrations() {
    const { user } = useAuth();
    const confirm = useConfirm();

    const [activeTab, setActiveTab] = useState("registrations"); // "registrations" | "bookings"
    const [registrations, setRegistrations] = useState([]);
    const [eventsMap, setEventsMap] = useState({});
    const [myBookings, setMyBookings] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // QR Ticket Pass Modal State
    const [selectedQrPass, setSelectedQrPass] = useState(null);
    const [qrCodeUrl, setQrCodeUrl] = useState("");
    const [generatingQr, setGeneratingQr] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [regRes, eventsRes, bookRes] = await Promise.allSettled([
                registrationApi.getMyRegistrations(),
                eventApi.getEvents(null, 1, 100),
                bookingApi.getBookings({ page: 1, page_size: 100 }),
            ]);

            if (regRes.status === "fulfilled") {
                setRegistrations(regRes.value.items || regRes.value || []);
            }

            if (eventsRes.status === "fulfilled") {
                const map = {};
                const list = eventsRes.value.items || eventsRes.value || [];
                list.forEach((ev) => {
                    map[ev.id] = ev;
                });
                setEventsMap(map);
            }

            if (bookRes.status === "fulfilled") {
                const allBookings = bookRes.value.items || bookRes.value || [];
                // Filter bookings belonging to current user if requested_by matches
                const userBookings = allBookings.filter(
                    (b) => b.requested_by === user?.id || b.requester?.id === user?.id
                );
                setMyBookings(userBookings.length > 0 ? userBookings : allBookings.slice(0, 5));
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to load registrations and bookings.");
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadData();
    }, [loadData]);

    // Open QR Code Ticket Pass Modal
    const handleOpenQrPass = async (reg) => {
        setSelectedQrPass(reg);
        setGeneratingQr(true);

        try {
            // Check-in payload accepted by on-site QR scanner: attendee email or reg token
            const tokenPayload = `${user?.email || "attendee"}:${reg.event_id}:${reg.id}`;
            const url = await QRCode.toDataURL(tokenPayload, {
                width: 320,
                margin: 2,
                color: {
                    dark: "#0f172a",
                    light: "#ffffff",
                },
            });
            setQrCodeUrl(url);
        } catch (err) {
            console.error("Failed to generate QR code", err);
            setError("Could not generate digital QR pass.");
        } finally {
            setGeneratingQr(false);
        }
    };

    // Download QR Code PNG
    const handleDownloadQr = () => {
        if (!qrCodeUrl || !selectedQrPass) return;
        const ev = eventsMap[selectedQrPass.event_id];
        const link = document.createElement("a");
        link.download = `Ticket_Pass_${ev?.title?.replace(/[^a-zA-Z0-9]/g, "_") || "Event"}.png`;
        link.href = qrCodeUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Print Pass
    const handlePrintPass = () => {
        window.print();
    };

    // Cancel Registration
    const handleCancel = async (id) => {
        const confirmed = await confirm({
            title: "Cancel Event Registration?",
            message: "Are you sure you want to cancel this registration? If there is a waitlist, the next attendee in queue will be promoted automatically.",
            confirmText: "Yes, Cancel Registration",
            cancelText: "Keep My Pass",
            variant: "danger",
            notice: "This action will immediately invalidate your digital QR pass and revoke your reserved seat.",
        });
        if (!confirmed) return;

        try {
            await registrationApi.cancelRegistration(id);
            setSuccess("Registration cancelled successfully. Any waitlisted participant has been automatically promoted!");
            loadData();
        } catch (err) {
            setError(err.response?.data?.error?.message || "Failed to cancel registration.");
        }
    };

    // Summary Statistics
    const confirmedCount = useMemo(
        () => registrations.filter((r) => r.status === "confirmed").length,
        [registrations]
    );
    const waitlistedCount = useMemo(
        () => registrations.filter((r) => r.status === "waitlisted").length,
        [registrations]
    );

    return (
        <div className="registrations-page">
            {/* Header Hero */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Attendee Passes & Bookings</h1>
                    <p className="page-subtitle">
                        Manage your confirmed event registrations, instant digital QR passes, and personal resource bookings.
                    </p>
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <Link to="/events" className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <Sparkles size={15} /> Browse More Events
                    </Link>
                    <Link to="/resources" className="btn btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <Box size={15} /> Book a Resource
                    </Link>
                </div>
            </div>

            {/* KPI Cards Ribbon */}
            <div className="stats-grid-premium" style={{ marginBottom: "24px" }}>
                <div className="stat-card-premium">
                    <div className="stat-card-header">
                        <span className="stat-card-title">Confirmed Seats</span>
                        <div className="stat-icon-wrapper stat-icon-emerald">
                            <CheckCircle2 size={20} />
                        </div>
                    </div>
                    <div className="stat-card-value">{confirmedCount}</div>
                    <div className="stat-card-indicator">
                        <span style={{ color: "#059669", fontWeight: 700 }}>● Instant QR Pass Ready</span>
                    </div>
                </div>

                <div className="stat-card-premium">
                    <div className="stat-card-header">
                        <span className="stat-card-title">Waitlisted Events</span>
                        <div className="stat-icon-wrapper stat-icon-amber">
                            <Clock size={20} />
                        </div>
                    </div>
                    <div className="stat-card-value">{waitlistedCount}</div>
                    <div className="stat-card-indicator">
                        <span style={{ color: "#d97706", fontWeight: 700 }}>● FIFO Auto Promotion Active</span>
                    </div>
                </div>

                <div className="stat-card-premium">
                    <div className="stat-card-header">
                        <span className="stat-card-title">My Resource Bookings</span>
                        <div className="stat-icon-wrapper stat-icon-purple">
                            <BookmarkCheck size={20} />
                        </div>
                    </div>
                    <div className="stat-card-value">{myBookings.length}</div>
                    <div className="stat-card-indicator">
                        <span style={{ color: "#7c3aed", fontWeight: 700 }}>● Rooms & Equipment</span>
                    </div>
                </div>
            </div>

            {/* Sub-Tabs Navigation */}
            <div className="tabs-container">
                <button
                    className={`tab-btn ${activeTab === "registrations" ? "active" : ""}`}
                    onClick={() => setActiveTab("registrations")}
                >
                    <Ticket size={16} />
                    <span>My Event Passes ({registrations.length})</span>
                </button>
                <button
                    className={`tab-btn ${activeTab === "bookings" ? "active" : ""}`}
                    onClick={() => setActiveTab("bookings")}
                >
                    <BookmarkCheck size={16} />
                    <span>My Resource Reservations ({myBookings.length})</span>
                </button>
            </div>

            {success && <div className="alert alert-success">{success}</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
                <div style={{ padding: "60px", textAlign: "center" }}>
                    <span className="spinner" />
                    <p style={{ marginTop: "12px", color: "var(--text-muted)" }}>Loading your passes & bookings...</p>
                </div>
            ) : activeTab === "registrations" ? (
                /* TAB 1: EVENT REGISTRATIONS & DIGITAL PASSES */
                registrations.length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
                        <Ticket size={40} style={{ color: "var(--text-muted)", margin: "0 auto 16px", opacity: 0.5 }} />
                        <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px 0" }}>No Event Registrations Yet</h3>
                        <p style={{ color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto 20px" }}>
                            Discover exciting upcoming summits, keynote sessions, and workshops across the platform.
                        </p>
                        <Link to="/events" className="btn btn-primary">
                            Browse Public Events
                        </Link>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {registrations.map((r) => {
                            const ev = eventsMap[r.event_id];
                            const isConfirmed = r.status === "confirmed";
                            const isWaitlisted = r.status === "waitlisted";

                            return (
                                <div
                                    key={r.id}
                                    className="card"
                                    style={{
                                        padding: "20px 24px",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: "20px",
                                        flexWrap: "wrap",
                                        borderLeft: isConfirmed
                                            ? "4px solid #059669"
                                            : isWaitlisted
                                            ? "4px solid #d97706"
                                            : "4px solid var(--border-color)",
                                    }}
                                >
                                    <div style={{ flex: 1, minWidth: "280px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                                            <span className={`badge badge-${r.status}`} style={{ textTransform: "uppercase" }}>
                                                {r.status}
                                            </span>
                                            {isConfirmed && (
                                                <span style={{ fontSize: "11px", color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                                                    <CheckCircle2 size={13} /> Verified Entry Pass
                                                </span>
                                            )}
                                            {isWaitlisted && (
                                                <span style={{ fontSize: "11px", color: "#d97706", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                                                    <Clock size={13} /> Waitlist Priority Queue
                                                </span>
                                            )}
                                        </div>

                                        <h3 style={{ fontSize: "17px", fontWeight: 800, margin: "0 0 6px 0", color: "var(--text-main)" }}>
                                            {ev?.title || `Event #${r.event_id}`}
                                        </h3>

                                        <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", fontSize: "13px", color: "var(--text-muted)" }}>
                                            {ev?.starts_at && (
                                                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                                    <Calendar size={14} style={{ color: "var(--primary)" }} />
                                                    {new Date(ev.starts_at).toLocaleDateString("en-US", {
                                                        weekday: "short",
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </span>
                                            )}
                                            {ev?.location && (
                                                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                                    <MapPin size={14} style={{ color: "#ef4444" }} />
                                                    {ev.location}
                                                </span>
                                            )}
                                            <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--text-light)" }}>
                                                Pass ID: {r.id.slice(0, 12)}...
                                            </span>
                                        </div>

                                        {isWaitlisted && (
                                            <div style={{ marginTop: "10px", padding: "8px 12px", background: "rgba(217, 119, 6, 0.1)", borderRadius: "6px", fontSize: "12.5px", color: "#b45309" }}>
                                                ℹ️ You are in the automatic waitlist queue. If a confirmed attendee cancels, your ticket will be promoted to <strong>CONFIRMED</strong> automatically.
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                                        {isConfirmed && (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenQrPass(r)}
                                                className="btn btn-primary"
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "8px",
                                                    padding: "10px 18px",
                                                    fontWeight: 700,
                                                    boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
                                                }}
                                            >
                                                <QrCode size={16} />
                                                <span>View QR Pass</span>
                                            </button>
                                        )}

                                        <Link
                                            to={ev?.organization_id ? `/organizations/${ev.organization_id}/events/${r.event_id}` : `/events/${r.event_id}`}
                                            className="btn btn-secondary btn-sm"
                                        >
                                            Event Details
                                        </Link>

                                        {(r.status === "confirmed" || r.status === "waitlisted" || r.status === "pending") && (
                                            <button
                                                type="button"
                                                onClick={() => handleCancel(r.id)}
                                                className="btn btn-secondary btn-sm"
                                                style={{ color: "#ef4444" }}
                                                title="Cancel this registration"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            ) : (
                /* TAB 2: MY RESOURCE RESERVATIONS */
                myBookings.length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
                        <BookmarkCheck size={40} style={{ color: "var(--text-muted)", margin: "0 auto 16px", opacity: 0.5 }} />
                        <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px 0" }}>No Resource Reservations</h3>
                        <p style={{ color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto 20px" }}>
                            Need a conference room, meeting space, or 4K laser projector for your event? Reserve available resources now.
                        </p>
                        <Link to="/resources" className="btn btn-primary">
                            Browse Bookable Resources
                        </Link>
                    </div>
                ) : (
                    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Space / Resource</th>
                                        <th>Status</th>
                                        <th>Scheduled Window</th>
                                        <th>Stated Purpose</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {myBookings.map((b) => (
                                        <tr key={b.id}>
                                            <td>
                                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f5f3ff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "12px" }}>
                                                        <Box size={16} />
                                                    </div>
                                                    <div>
                                                        <strong style={{ color: "var(--text-main)", display: "block" }}>
                                                            {b.resource?.name || `Resource #${b.resource_id}`}
                                                        </strong>
                                                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                                            Booking #{b.id?.slice(0, 8)}...
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge badge-${b.status}`}>{b.status}</span>
                                            </td>
                                            <td style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                                                <div>
                                                    <Clock size={12} style={{ display: "inline", marginRight: "4px" }} />
                                                    {new Date(b.start_time).toLocaleDateString()}
                                                </div>
                                                <div style={{ fontSize: "11.5px" }}>
                                                    {new Date(b.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {new Date(b.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </div>
                                            </td>
                                            <td style={{ fontSize: "13px", color: "var(--text-main)" }}>
                                                {b.purpose || "Resource reservation"}
                                            </td>
                                            <td>
                                                <Link to="/bookings" className="btn btn-secondary btn-sm">
                                                    Manage
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}

            {/* DIGITAL QR TICKET PASS MODAL */}
            {selectedQrPass && (
                <div className="modal-overlay" onClick={() => setSelectedQrPass(null)}>
                    <div
                        className="modal-content"
                        style={{ maxWidth: "460px", textAlign: "center", padding: "28px" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            type="button"
                            onClick={() => setSelectedQrPass(null)}
                            style={{
                                position: "absolute",
                                top: "18px",
                                right: "18px",
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--text-muted)",
                            }}
                        >
                            <X size={20} />
                        </button>

                        {/* Ticket Badge */}
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(5, 150, 105, 0.12)", color: "#059669", padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: 700, marginBottom: "14px" }}>
                            <CheckCircle2 size={14} /> OFFICIAL ADMISSION PASS
                        </div>

                        <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 6px 0", color: "var(--text-main)" }}>
                            {eventsMap[selectedQrPass.event_id]?.title || "Conference Admission"}
                        </h2>
                        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 20px 0" }}>
                            Present this QR code to the on-site Staff Coordinator for contactless check-in.
                        </p>

                        {/* QR Code Frame */}
                        <div style={{
                            background: "#ffffff",
                            padding: "20px",
                            borderRadius: "16px",
                            boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
                            display: "inline-block",
                            border: "2px dashed #cbd5e1",
                            marginBottom: "20px",
                        }}>
                            {generatingQr ? (
                                <div style={{ width: "240px", height: "240px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <span className="spinner" />
                                </div>
                            ) : qrCodeUrl ? (
                                <img
                                    src={qrCodeUrl}
                                    alt="Attendee QR Check-in Code"
                                    style={{ width: "240px", height: "240px", display: "block" }}
                                />
                            ) : null}
                            <span style={{ display: "block", marginTop: "10px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: "#64748b", textTransform: "uppercase" }}>
                                Fast Scan &bull; Live Attendance
                            </span>
                        </div>

                        {/* Attendee Metadata */}
                        <div style={{
                            background: "var(--bg-subtle)",
                            borderRadius: "12px",
                            padding: "14px 16px",
                            textAlign: "left",
                            fontSize: "13px",
                            marginBottom: "20px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--text-muted)" }}>Attendee:</span>
                                <strong>{user?.full_name || user?.email}</strong>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--text-muted)" }}>Email:</span>
                                <span>{user?.email}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--text-muted)" }}>Pass Token:</span>
                                <span style={{ fontFamily: "monospace", fontSize: "11.5px" }}>{selectedQrPass.id}</span>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                            <button
                                type="button"
                                onClick={handleDownloadQr}
                                className="btn btn-primary"
                                style={{ display: "inline-flex", alignItems: "center", gap: "6px", flex: 1 }}
                            >
                                <Download size={15} /> Download Pass
                            </button>
                            <button
                                type="button"
                                onClick={handlePrintPass}
                                className="btn btn-secondary"
                                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                            >
                                <Printer size={15} /> Print
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
