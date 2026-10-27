import { useCallback, useEffect, useState, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useConfirm } from "../../context/ConfirmContext";
import {
    Calendar,
    MapPin,
    Users,
    CheckCircle2,
    XCircle,
    Plus,
    RotateCw,
    Search,
    X,
    Eye,
    Edit3,
    Trash2,
    Send,
    Clock,
    ArrowLeft,
    Building2,
    ChevronLeft,
    ChevronRight,
    ShieldCheck,
    QrCode,
    Camera,
    Ticket,
} from "lucide-react";
import eventApi from "../../api/eventApi";
import organizationApi from "../../api/organizationApi";
import "./events.css";

export default function EventList() {
    const { user } = useAuth();
    const confirm = useConfirm();
    const { organizationId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();

    const userRole = (user?.role || "participant").toLowerCase();
    const isSuperAdmin = userRole === "super_admin" || (userRole === "admin" && (user?.email === "admin@collab.com" || user?.id === 1));
    const isOrgAdmin = userRole === "admin" && !isSuperAdmin;
    const isEventManager = userRole === "event_manager";
    const isStaff = userRole === "staff";
    const isParticipant = userRole === "participant" || (!isSuperAdmin && !isOrgAdmin && !isEventManager && !isStaff);
    const isManagerOrAdmin = isSuperAdmin || isOrgAdmin || isEventManager;

    const [events, setEvents] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [selectedOrgId, setSelectedOrgId] = useState(organizationId || "");

    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") || "all");

    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);

    const [loading, setLoading] = useState(true);
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const getErrorMessage = (err) => {
        return (
            err.response?.data?.error?.message ||
            err.response?.data?.message ||
            err.response?.data?.detail ||
            err.message ||
            "Something went wrong."
        );
    };

    // Synchronize query parameters
    useEffect(() => {
        const queryStatus = searchParams.get("status");
        if (queryStatus !== null && queryStatus !== "") {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStatusFilter(queryStatus);
        }
    }, [searchParams]);

    // Load available organizations if accessed from global route
    useEffect(() => {
        if (!organizationId) {
            organizationApi
                .getOrganizations(1, 50)
                .then((data) => {
                    const items = data.items || [];
                    setOrganizations(items);
                    if (items.length > 0 && !selectedOrgId) {
                        setSelectedOrgId(items[0].id);
                    }
                })
                .catch(console.error);
        } else {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedOrgId(organizationId);
        }
    }, [organizationId, selectedOrgId]);

    const fetchEvents = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const activeOrgId = organizationId || selectedOrgId || null;
            const filterValue = statusFilter === "all" ? null : statusFilter;

            const data = await eventApi.getEvents(
                activeOrgId,
                page,
                pageSize,
                filterValue,
                search || null
            );

            setEvents(data.items || []);
            setTotal(data.total || 0);
        } catch (err) {
            setError(getErrorMessage(err));
            setEvents([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [organizationId, selectedOrgId, page, pageSize, statusFilter, search]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchEvents();
    }, [fetchEvents]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setPage(1);
        setSearch(searchInput.trim());
    };

    const handleClearSearch = () => {
        setSearchInput("");
        setSearch("");
        setPage(1);
    };

    const handleStatusFilterChange = (newStatus) => {
        setStatusFilter(newStatus);
        setPage(1);
        if (newStatus === "all") {
            searchParams.delete("status");
            setSearchParams(searchParams);
        } else {
            setSearchParams({ ...Object.fromEntries(searchParams.entries()), status: newStatus });
        }
    };

    const handleRefresh = () => {
        setSuccess("");
        fetchEvents();
    };

    const formatDate = (dateValue) => {
        if (!dateValue) return "-";
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // Stats ribbon calculation
    const stats = useMemo(() => {
        const publishedCount = events.filter((ev) => ev.status === "published").length;
        const totalCapacity = events.reduce((sum, ev) => sum + (ev.capacity || 0), 0);
        return {
            total: total || events.length,
            published: publishedCount,
            capacity: totalCapacity,
        };
    }, [events, total]);

    // Action Handlers
    const handleStatusAction = async (eventItem, action) => {
        const actionLabels = {
            publish: "publish",
            cancel: "cancel",
            complete: "complete",
        };
        const label = actionLabels[action];
        if (!label) return;

        const confirmed = await confirm({
            title: `${label.charAt(0).toUpperCase() + label.slice(1)} Event?`,
            message: `Are you sure you want to ${label} "${eventItem.title || eventItem.name}"?`,
            confirmText: `Yes, ${label.charAt(0).toUpperCase() + label.slice(1)}`,
            cancelText: "Cancel",
            variant: action === "cancel" ? "danger" : "info",
        });
        if (!confirmed) return;

        try {
            setActionLoadingId(eventItem.id);
            setError("");
            setSuccess("");

            const activeOrg = eventItem.organization_id || organizationId || selectedOrgId;

            if (action === "publish") {
                await eventApi.publishEvent(activeOrg, eventItem.id);
            } else if (action === "cancel") {
                await eventApi.cancelEvent(activeOrg, eventItem.id);
            } else if (action === "complete") {
                await eventApi.completeEvent(activeOrg, eventItem.id);
            }

            setSuccess(`Event successfully transitioned to ${label}ed.`);
            await fetchEvents();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleDelete = async (eventItem) => {
        const confirmed = await confirm({
            title: "Delete Event Permanently?",
            message: `Are you sure you want to permanently delete "${eventItem.title || eventItem.name}"? This will delete all registrations, sessions, and bookings associated with this event.`,
            confirmText: "Delete Event",
            cancelText: "Keep Event",
            variant: "danger",
            notice: "This operation is irreversible.",
        });
        if (!confirmed) return;

        try {
            setActionLoadingId(eventItem.id);
            setError("");
            setSuccess("");

            const activeOrg = eventItem.organization_id || organizationId || selectedOrgId;
            await eventApi.deleteEvent(activeOrg, eventItem.id);

            setSuccess(`Event "${eventItem.title || eventItem.name}" deleted successfully.`);

            if (events.length === 1 && page > 1) {
                setPage((prev) => prev - 1);
            } else {
                await fetchEvents();
            }
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setActionLoadingId(null);
        }
    };

    const currentCreatePath = organizationId || selectedOrgId
        ? `/organizations/${organizationId || selectedOrgId}/events/create`
        : "/organizations";

    return (
        <div className="event-page-container">
            {/* Breadcrumb Navigation */}
            <div>
                {organizationId ? (
                    <Link
                        to={`/organizations/${organizationId}`}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "var(--text-muted)",
                            textDecoration: "none",
                        }}
                    >
                        <ArrowLeft size={14} /> Back to Organization Workspace
                    </Link>
                ) : (
                    <Link
                        to="/dashboard"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "var(--text-muted)",
                            textDecoration: "none",
                        }}
                    >
                        <ArrowLeft size={14} /> Back to Operations Dashboard
                    </Link>
                )}
            </div>

            {/* Header Hero Section */}
            <div className="event-hero-header">
                <div className="event-hero-left">
                    <div className="event-hero-icon">
                        <Calendar size={26} />
                    </div>
                    <div>
                        <h1 className="event-hero-title">
                            {isParticipant
                                ? "Discover Public Events & Summits"
                                : isStaff
                                ? "Event Operations & Schedule"
                                : "Event Management Console"}
                        </h1>
                        <p className="event-hero-subtitle">
                            {isParticipant
                                ? "Browse upcoming conferences, workshops, and symposiums. Register to secure your seat or join waitlists."
                                : isStaff
                                ? "Operational overview of scheduled events, session rooms, and on-site check-in desks."
                                : "Plan conferences, publish summits, organize breakout sessions, and control attendee capacity."}
                        </p>
                    </div>
                </div>

                <div className="event-hero-actions">
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="btn btn-secondary btn-sm"
                        disabled={loading}
                        title="Reload Events"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                        <RotateCw size={14} className={loading ? "animate-spin" : ""} />
                        <span>Refresh</span>
                    </button>

                    {isManagerOrAdmin && (
                        <Link
                            to={currentCreatePath}
                            className="btn btn-primary"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "9px 18px",
                                fontSize: "13.5px",
                            }}
                        >
                            <Plus size={16} />
                            <span>Create Event</span>
                        </Link>
                    )}

                    {isStaff && (
                        <Link
                            to="/attendance-checkin"
                            className="btn btn-primary"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "9px 18px",
                                fontSize: "13.5px",
                            }}
                        >
                            <Camera size={16} />
                            <span>QR Check-In Scanner</span>
                        </Link>
                    )}

                    {isParticipant && (
                        <Link
                            to="/my-registrations"
                            className="btn btn-primary"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "9px 18px",
                                fontSize: "13.5px",
                            }}
                        >
                            <Ticket size={16} />
                            <span>My Event Passes</span>
                        </Link>
                    )}
                </div>
            </div>

            {/* KPI Metric Cards Ribbon */}
            <div className="event-kpi-grid">
                <div className="event-kpi-card">
                    <div className="event-kpi-icon-wrapper" style={{ background: "#eff6ff", color: "#2563eb" }}>
                        <Calendar size={22} />
                    </div>
                    <div className="event-kpi-info">
                        <span className="event-kpi-label">Total Events</span>
                        <div className="event-kpi-value">{stats.total}</div>
                        <span className="event-kpi-subtext" style={{ color: "#2563eb" }}>
                            Organization Portfolio
                        </span>
                    </div>
                </div>

                <div className="event-kpi-card">
                    <div className="event-kpi-icon-wrapper" style={{ background: "#ecfdf5", color: "#059669" }}>
                        <CheckCircle2 size={22} />
                    </div>
                    <div className="event-kpi-info">
                        <span className="event-kpi-label">Active / Published</span>
                        <div className="event-kpi-value">{stats.published}</div>
                        <span className="event-kpi-subtext" style={{ color: "#059669" }}>
                            Registration Enabled
                        </span>
                    </div>
                </div>

                <div className="event-kpi-card">
                    <div className="event-kpi-icon-wrapper" style={{ background: "#f5f3ff", color: "#7c3aed" }}>
                        <Users size={22} />
                    </div>
                    <div className="event-kpi-info">
                        <span className="event-kpi-label">Total Seat Capacity</span>
                        <div className="event-kpi-value">{stats.capacity}</div>
                        <span className="event-kpi-subtext" style={{ color: "#7c3aed" }}>
                            Auto-Waitlist Protected
                        </span>
                    </div>
                </div>

                <div className="event-kpi-card">
                    <div className="event-kpi-icon-wrapper" style={{ background: "#fffbeb", color: "#d97706" }}>
                        <ShieldCheck size={22} />
                    </div>
                    <div className="event-kpi-info">
                        <span className="event-kpi-label">Double Booking Shield</span>
                        <div className="event-kpi-value">Active</div>
                        <span className="event-kpi-subtext" style={{ color: "#d97706" }}>
                            Venue Conflict Lock
                        </span>
                    </div>
                </div>
            </div>

            {/* Notification Alerts */}
            {success && (
                <div
                    className="alert alert-success"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "12px 18px",
                        borderRadius: "var(--radius)",
                    }}
                    role="status"
                >
                    <CheckCircle2 size={18} />
                    <span>{success}</span>
                </div>
            )}

            {error && (
                <div
                    className="alert alert-danger"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "12px 18px",
                        borderRadius: "var(--radius)",
                    }}
                    role="alert"
                >
                    <XCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* Interactive Search & Filter Toolbar */}
            <div className="event-toolbar-card">
                <div className="event-toolbar-left">
                    {/* Organization Filter if accessible across multiple orgs */}
                    {!organizationId && organizations.length > 1 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Building2 size={16} style={{ color: "var(--text-muted)" }} />
                            <select
                                value={selectedOrgId}
                                onChange={(e) => {
                                    setSelectedOrgId(e.target.value);
                                    setPage(1);
                                }}
                                className="event-filter-select"
                                aria-label="Select organization"
                            >
                                {organizations.map((org) => (
                                    <option key={org.id} value={org.id}>
                                        {org.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Search Input Box */}
                    <form onSubmit={handleSearchSubmit} className="event-search-box">
                        <Search size={16} className="event-search-icon" />
                        <input
                            type="text"
                            placeholder="Search by title, location, description..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="event-search-input"
                            aria-label="Search events"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="event-search-clear"
                                title="Clear search"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </form>

                    {/* Status Dropdown */}
                    <select
                        value={statusFilter}
                        onChange={(e) => handleStatusFilterChange(e.target.value)}
                        className="event-filter-select"
                        aria-label="Filter events by status"
                    >
                        <option value="all">All Statuses</option>
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                        <option value="ongoing">Ongoing</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>

                <div className="event-toolbar-right">
                    <span className="event-count-pill">
                        {total} {total === 1 ? "Event" : "Events"} Tracked
                    </span>
                </div>
            </div>

            {/* Event Data Table Card */}
            <div className="event-table-card">
                {loading && events.length === 0 ? (
                    <div style={{ padding: "80px 24px", textAlign: "center" }}>
                        <span className="spinner" />
                        <p style={{ marginTop: "16px", color: "var(--text-muted)", fontSize: "14px", fontWeight: 500 }}>
                            Loading scheduled events...
                        </p>
                    </div>
                ) : events.length === 0 ? (
                    <div className="event-empty-container">
                        <div className="event-empty-icon">
                            <Calendar size={32} />
                        </div>
                        <h3 className="event-empty-title">No Events Found</h3>
                        <p className="event-empty-subtitle">
                            {search || statusFilter !== "all"
                                ? "No events match your current search or status filter. Try clearing your filters."
                                : "No events have been created yet. Launch your first conference or seminar to get started."}
                        </p>
                        {search || statusFilter !== "all" ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch("");
                                    setSearchInput("");
                                    handleStatusFilterChange("all");
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{ marginTop: "8px" }}
                            >
                                Reset Search Filters
                            </button>
                        ) : (
                            <Link
                                to={currentCreatePath}
                                className="btn btn-primary btn-sm"
                                style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "8px" }}
                            >
                                <Plus size={15} /> Create First Event
                            </Link>
                        )}
                    </div>
                ) : (
                    /* Modern Web Guidance: role="region", tabindex="0", and aria-labelledby for responsive accessible table */
                    <div
                        className="event-table-wrapper"
                        role="region"
                        aria-labelledby="events-table-heading"
                        tabIndex={0}
                    >
                        <table className="event-table">
                            <thead>
                                <tr>
                                    <th id="events-table-heading">Event & Identity</th>
                                    <th>Location / Venue</th>
                                    <th>Schedule Window</th>
                                    <th>Capacity</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: "right", paddingRight: "24px" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((eventItem) => {
                                    const isActionLoading = actionLoadingId === eventItem.id;
                                    const canPublish = eventItem.status === "draft";
                                    const canCancel =
                                        eventItem.status === "draft" ||
                                        eventItem.status === "published";
                                    const canEdit =
                                        eventItem.status !== "cancelled" &&
                                        eventItem.status !== "completed";
                                    const canDelete =
                                        eventItem.status !== "published";

                                    const detailLink = eventItem.organization_id
                                        ? `/organizations/${eventItem.organization_id}/events/${eventItem.id}`
                                        : `/events/${eventItem.id}`;

                                    const editLink = eventItem.organization_id
                                        ? `/organizations/${eventItem.organization_id}/events/${eventItem.id}/edit`
                                        : `/events/${eventItem.id}/edit`;

                                    return (
                                        <tr key={eventItem.id}>
                                            {/* Event Name & Identity */}
                                            <td>
                                                <div className="event-identity-cell">
                                                    <div className="event-avatar-badge" title={eventItem.title}>
                                                        EV
                                                    </div>
                                                    <div className="event-title-group">
                                                        <Link
                                                            to={detailLink}
                                                            className="event-title-link"
                                                        >
                                                            {eventItem.title || eventItem.name}
                                                        </Link>
                                                        <div className="event-meta-sub">
                                                            <span>ID: {eventItem.id.slice(0, 8)}...</span>
                                                            {eventItem.organization_name && (
                                                                <>
                                                                    <span>·</span>
                                                                    <span>{eventItem.organization_name}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Location */}
                                            <td>
                                                <div className="event-location-text">
                                                    <MapPin size={13} style={{ color: "#64748b", flexShrink: 0 }} />
                                                    <span title={eventItem.location || "Online Virtual Summit"}>
                                                        {eventItem.location || "Online Virtual Summit"}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Schedule Window */}
                                            <td>
                                                <div className="event-schedule-cell">
                                                    <div className="event-schedule-start">
                                                        <Clock size={12} style={{ color: "var(--primary)" }} />
                                                        <span>{formatDate(eventItem.starts_at || eventItem.start_time)}</span>
                                                    </div>
                                                    <div className="event-schedule-end">
                                                        To: {formatDate(eventItem.ends_at || eventItem.end_time)}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Capacity */}
                                            <td>
                                                <div className="event-capacity-badge">
                                                    <Users size={12} />
                                                    <span>{eventItem.capacity} seats</span>
                                                </div>
                                            </td>

                                            {/* Status Badge */}
                                            <td>
                                                <span
                                                    className={`event-status-pill status-pill-${eventItem.status}`}
                                                >
                                                    <span
                                                        className={
                                                            eventItem.status === "published"
                                                                ? "status-dot-active"
                                                                : "status-dot-inactive"
                                                        }
                                                    />
                                                    {eventItem.status}
                                                </span>
                                            </td>

                                            {/* Action Buttons */}
                                            <td style={{ textAlign: "right", paddingRight: "20px" }}>
                                                <div className="event-actions-cluster">
                                                    {/* 1. Participant View & Register */}
                                                    {isParticipant && (
                                                        <Link
                                                            to={detailLink}
                                                            className="event-action-btn event-action-view"
                                                            title="View Event Details & Register"
                                                        >
                                                            <Eye size={12} />
                                                            <span>View & Register</span>
                                                        </Link>
                                                    )}

                                                    {/* 2. Staff View & Check-In */}
                                                    {isStaff && (
                                                        <>
                                                            <Link
                                                                to={detailLink}
                                                                className="event-action-btn event-action-view"
                                                                title="View Event Details"
                                                            >
                                                                <Eye size={12} />
                                                                <span>View</span>
                                                            </Link>
                                                            <Link
                                                                to={`/attendance-checkin?event_id=${eventItem.id}`}
                                                                className="event-action-btn event-action-publish"
                                                                style={{ background: "rgba(16, 185, 129, 0.12)", color: "#059669", border: "1px solid rgba(16, 185, 129, 0.3)" }}
                                                                title="Open On-Site Check-In Desk"
                                                            >
                                                                <QrCode size={12} />
                                                                <span>Check-In Desk</span>
                                                            </Link>
                                                        </>
                                                    )}

                                                    {/* 3. Event Manager & Admin Full Management */}
                                                    {isManagerOrAdmin && (
                                                        <>
                                                            <Link
                                                                to={detailLink}
                                                                className="event-action-btn event-action-view"
                                                                title="View Event Details & Sessions"
                                                            >
                                                                <Eye size={12} />
                                                                <span>View</span>
                                                            </Link>

                                                            {canEdit && (
                                                                <Link
                                                                    to={editLink}
                                                                    className="event-action-btn event-action-edit"
                                                                    title="Edit Event Parameters"
                                                                >
                                                                    <Edit3 size={12} />
                                                                    <span>Edit</span>
                                                                </Link>
                                                            )}

                                                            {canPublish && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStatusAction(eventItem, "publish")}
                                                                    disabled={isActionLoading}
                                                                    className="event-action-btn event-action-publish"
                                                                    title="Publish event to allow attendee registrations"
                                                                >
                                                                    <Send size={12} />
                                                                    <span>Publish</span>
                                                                </button>
                                                            )}

                                                            {canCancel && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStatusAction(eventItem, "cancel")}
                                                                    disabled={isActionLoading}
                                                                    className="event-action-btn event-action-cancel"
                                                                    title="Cancel event and notify participants"
                                                                >
                                                                    <XCircle size={12} />
                                                                    <span>Cancel</span>
                                                                </button>
                                                            )}

                                                            {canDelete && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDelete(eventItem)}
                                                                    disabled={isActionLoading}
                                                                    className="event-action-btn event-action-delete"
                                                                    title="Delete Event"
                                                                >
                                                                    <Trash2 size={12} />
                                                                    <span>
                                                                        {isActionLoading ? "..." : "Delete"}
                                                                    </span>
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Footer */}
                {events.length > 0 && (
                    <div className="event-pagination-footer">
                        <div className="event-pagination-meta">
                            Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> · Total: <strong>{total}</strong> {total === 1 ? "event" : "events"}
                        </div>

                        <div className="event-pagination-nav">
                            <button
                                type="button"
                                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                disabled={page === 1 || loading}
                                className="event-page-btn"
                                aria-label="Previous Page"
                            >
                                <ChevronLeft size={16} />
                                <span>Previous</span>
                            </button>

                            <span className="event-page-indicator">
                                {page} / {totalPages}
                            </span>

                            <button
                                type="button"
                                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={page >= totalPages || loading}
                                className="event-page-btn"
                                aria-label="Next Page"
                            >
                                <span>Next</span>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
