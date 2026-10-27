import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    Building2,
    Users,
    Calendar,
    Edit3,
    Trash2,
    RotateCw,
    ArrowLeft,
    CheckCircle2,
    XCircle,
    Plus,
    ShieldCheck,
    Clock,
    UserPlus,
    Box,
    AlertTriangle,
    CheckSquare,
    Search,
    Shield,
    Sparkles,
    Check,
    X,
    Lock,
} from "lucide-react";

import organizationApi from "../../api/organizationApi";
import eventApi from "../../api/eventApi";
import bookingApi from "../../api/bookingApi";
import { useConfirm } from "../../context/ConfirmContext";
import "./organizations.css";

export default function OrganizationDetails() {
    const navigate = useNavigate();
    const { organizationId } = useParams();
    const confirm = useConfirm();

    // Data States
    const [organization, setOrganization] = useState(null);
    const [members, setMembers] = useState([]);
    const [events, setEvents] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [memberTotal, setMemberTotal] = useState(0);
    const [eventTotal, setEventTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [deleting, setDeleting] = useState(false);

    // Active Tab in Org Admin Console: "governance" | "members" | "approvals"
    const [activeAdminTab, setActiveAdminTab] = useState("governance");
    const [approvalsSubTab, setApprovalsSubTab] = useState("events"); // "events" | "resources"

    // Member Roster Filters
    const [memberSearch, setMemberSearch] = useState("");
    const [memberRoleFilter, setMemberRoleFilter] = useState("all");

    // Add Member Modal State
    const [showAddMember, setShowAddMember] = useState(false);
    const [newMemberEmail, setNewMemberEmail] = useState("");
    const [newMemberRole, setNewMemberRole] = useState("staff");
    const [addingMember, setAddingMember] = useState(false);

    // Quick Settings State
    const [showEditOrgModal, setShowEditOrgModal] = useState(false);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [savingSettings, setSavingSettings] = useState(false);

    // Rejection Reason Modal for Bookings
    const [rejectingBookingId, setRejectingBookingId] = useState(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [processingApproval, setProcessingApproval] = useState(false);

    // Fetch All Workspace Data
    const fetchOrganizationDetails = useCallback(async () => {
        try {
            const [organizationData, memberData, eventData, bookingData] = await Promise.all([
                organizationApi.getOrganizationById(organizationId),
                organizationApi.getOrganizationMembers(organizationId, 1, 100, false).catch(() => ({ items: [], total: 0 })),
                eventApi.getEvents(organizationId, 1, 100).catch(() => ({ items: [], total: 0 })),
                bookingApi.getBookings({ page: 1, page_size: 100 }).catch(() => ({ items: [], total: 0 })),
            ]);

            setError("");
            setOrganization(organizationData);
            setEditName(organizationData?.name || "");
            setEditDescription(organizationData?.description || "");

            setMembers(memberData.items || []);
            setMemberTotal(memberData.total || 0);

            setEvents(eventData.items || []);
            setEventTotal(eventData.total || 0);

            setBookings(bookingData.items || []);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                err.response?.data?.detail ||
                "Failed to load organization workspace telemetry."
            );
        } finally {
            setLoading(false);
        }
    }, [organizationId]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchOrganizationDetails();
    }, [fetchOrganizationDetails]);

    // Helpers
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

    const getInitials = (name) => {
        if (!name) return "OG";
        const parts = String(name).trim().split(" ");
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return String(name).slice(0, 2).toUpperCase();
    };

    // Count Active Admins for Last Admin Protection
    const activeAdmins = members.filter(
        (m) => m.role === "admin" && m.is_active
    );
    const activeAdminsCount = activeAdmins.length;

    // -------------------------------------------------------------
    // 1. ORGANIZATION MANAGEMENT HANDLERS
    // -------------------------------------------------------------
    const handleUpdateOrganization = async (e) => {
        e.preventDefault();
        if (!editName.trim()) return;

        try {
            setSavingSettings(true);
            setError("");
            await organizationApi.updateOrganization(organizationId, {
                name: editName.trim(),
                description: editDescription.trim(),
            });
            setSuccess("Organization settings and workspace governance profile updated successfully.");
            setShowEditOrgModal(false);
            await fetchOrganizationDetails();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to update organization profile.");
        } finally {
            setSavingSettings(false);
        }
    };

    const handleDelete = async () => {
        if (!organization) return;
        const confirmed = await confirm({
            title: "Delete Organization?",
            message: `Are you sure you want to delete "${organization.name}"? This action permanently purges workspace isolation and associated data.`,
            confirmText: "Delete Workspace",
            cancelText: "Keep Workspace",
            variant: "danger",
            notice: "This operation cannot be reversed.",
        });
        if (!confirmed) return;

        try {
            setDeleting(true);
            setError("");
            setSuccess("");
            await organizationApi.deleteOrganization(organizationId);
            navigate("/organizations", { replace: true });
        } catch (err) {
            setError(
                err.response?.data?.message ||
                err.response?.data?.detail ||
                "Failed to delete organization."
            );
        } finally {
            setDeleting(false);
        }
    };

    // -------------------------------------------------------------
    // 2. MEMBER ROLE ASSIGNMENTS HANDLERS (WITH LAST ADMIN SAFEGUARD)
    // -------------------------------------------------------------
    const handleAddMemberSubmit = async (e) => {
        e.preventDefault();
        if (!newMemberEmail) return;

        try {
            setAddingMember(true);
            setError("");
            await organizationApi.addOrganizationMember(organizationId, {
                email: newMemberEmail.trim(),
                role: newMemberRole,
            });
            setSuccess(`User "${newMemberEmail}" successfully added with role "${newMemberRole.toUpperCase()}".`);
            setNewMemberEmail("");
            setShowAddMember(false);
            await fetchOrganizationDetails();
        } catch (err) {
            setError(
                err.response?.data?.error?.message ||
                err.response?.data?.detail ||
                "Failed to add organization member."
            );
        } finally {
            setAddingMember(false);
        }
    };

    const handleRoleChange = async (memberId, newRole) => {
        const targetMember = members.find((m) => m.id === memberId);
        if (!targetMember) return;

        // Protection: Guard against demoting the last active administrator
        if (targetMember.role === "admin" && newRole !== "admin" && activeAdminsCount <= 1) {
            setError(
                "Protection Policy Enforced: You cannot demote the last active Administrator. Assign another Administrator first to maintain organization governance."
            );
            return;
        }

        try {
            setError("");
            await organizationApi.updateOrganizationMemberRole(organizationId, memberId, newRole);
            setSuccess(`Role updated to "${newRole.toUpperCase()}" for ${targetMember.user?.email || `User #${targetMember.user_id}`}.`);
            await fetchOrganizationDetails();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to update member role.");
        }
    };

    const handleStatusToggle = async (memberId, currentStatus) => {
        const targetMember = members.find((m) => m.id === memberId);
        if (!targetMember) return;

        // Protection: Guard against deactivating the last active administrator
        if (targetMember.role === "admin" && currentStatus === true && activeAdminsCount <= 1) {
            setError(
                "Protection Policy Enforced: You cannot deactivate the last active Administrator of this organization."
            );
            return;
        }

        try {
            setError("");
            await organizationApi.updateOrganizationMemberStatus(organizationId, memberId, !currentStatus);
            setSuccess(`Member status updated to ${!currentStatus ? "ACTIVE" : "INACTIVE"}.`);
            await fetchOrganizationDetails();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to update member status.");
        }
    };

    const handleRemoveMember = async (memberId) => {
        const targetMember = members.find((m) => m.id === memberId);
        if (!targetMember) return;

        if (targetMember.role === "admin" && activeAdminsCount <= 1) {
            setError(
                "Protection Policy Enforced: You cannot remove the last active Administrator of this organization."
            );
            return;
        }

        const confirmed = await confirm({
            title: "Remove Workspace Member?",
            message: `Are you sure you want to remove ${targetMember.user?.email || targetMember.user?.name || "this member"} from the organization? They will immediately lose access to internal events and assigned roles.`,
            confirmText: "Remove Member",
            cancelText: "Keep Member",
            variant: "danger",
        });
        if (!confirmed) return;

        try {
            setError("");
            await organizationApi.removeOrganizationMember(organizationId, memberId);
            setSuccess("Member revoked from organization workspace.");
            await fetchOrganizationDetails();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to remove member.");
        }
    };

    // -------------------------------------------------------------
    // 3. EVENT & RESOURCE APPROVALS HANDLERS
    // -------------------------------------------------------------
    const handleApproveEvent = async (eventId, eventTitle) => {
        try {
            setProcessingApproval(true);
            setError("");
            await eventApi.publishEvent(organizationId, eventId);
            setSuccess(`Event "${eventTitle || "Summit"}" approved and PUBLISHED! Attendees can now register.`);
            await fetchOrganizationDetails();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to publish event.");
        } finally {
            setProcessingApproval(false);
        }
    };

    const handleCancelEvent = async (eventId, eventTitle) => {
        const confirmed = await confirm({
            title: "Cancel Event?",
            message: `Are you sure you want to cancel the event "${eventTitle}"? All active registrations and attendees will be marked as cancelled.`,
            confirmText: "Yes, Cancel Event",
            cancelText: "Keep Event Active",
            variant: "danger",
        });
        if (!confirmed) return;

        try {
            setProcessingApproval(true);
            setError("");
            await eventApi.cancelEvent(organizationId, eventId);
            setSuccess(`Event "${eventTitle}" set to CANCELLED.`);
            await fetchOrganizationDetails();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to cancel event.");
        } finally {
            setProcessingApproval(false);
        }
    };

    const handleApproveBooking = async (bookingId, purpose) => {
        try {
            setProcessingApproval(true);
            setError("");
            await bookingApi.approveBooking(bookingId);
            setSuccess(`Reservation "${purpose || "Booking"}" APPROVED. Space locked with zero concurrency conflicts.`);
            await fetchOrganizationDetails();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to approve resource booking.");
        } finally {
            setProcessingApproval(false);
        }
    };

    const handleConfirmRejectBooking = async () => {
        if (!rejectingBookingId) return;

        try {
            setProcessingApproval(true);
            setError("");
            await bookingApi.rejectBooking(rejectingBookingId, { rejection_reason: rejectionReason || "Resource conflict or administrative rejection" });
            setSuccess("Resource reservation rejected.");
            setRejectingBookingId(null);
            setRejectionReason("");
            await fetchOrganizationDetails();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to reject resource booking.");
        } finally {
            setProcessingApproval(false);
        }
    };

    // Filtered lists
    const pendingEvents = events.filter((e) => e.status === "draft");
    const pendingBookings = bookings.filter((b) => b.status === "requested");
    const totalPendingApprovals = pendingEvents.length + pendingBookings.length;

    const filteredMembers = members.filter((member) => {
        if (memberRoleFilter !== "all" && member.role !== memberRoleFilter) return false;
        if (!memberSearch.trim()) return true;

        const q = memberSearch.toLowerCase();
        const email = (member.user?.email || member.email || "").toLowerCase();
        const name = (member.user?.full_name || "").toLowerCase();
        const uid = String(member.user_id || "");
        return email.includes(q) || name.includes(q) || uid.includes(q);
    });

    if (loading && !organization) {
        return (
            <div style={{ padding: "80px 24px", textAlign: "center" }}>
                <span className="spinner" />
                <p style={{ marginTop: "16px", color: "var(--text-muted)", fontSize: "14px", fontWeight: 500 }}>
                    Retrieving organization workspace telemetry...
                </p>
            </div>
        );
    }

    if (!organization) {
        return (
            <div className="card" style={{ maxWidth: "600px", margin: "60px auto", textAlign: "center", padding: "40px" }}>
                <AlertTriangle size={48} style={{ color: "#ef4444", margin: "0 auto 16px" }} />
                <h2 style={{ fontSize: "20px", fontWeight: 800 }}>Organization Unavailable</h2>
                <p style={{ color: "var(--text-muted)", margin: "8px 0 24px" }}>
                    {error || "The requested organization does not exist or has been archived."}
                </p>
                <Link to="/organizations" className="btn btn-secondary">
                    ← Back to Organizations Directory
                </Link>
            </div>
        );
    }

    return (
        <div className="organization-page-container">
            {/* Breadcrumb Navigation */}
            <div>
                <Link
                    to="/organizations"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        transition: "color 0.15s ease",
                    }}
                >
                    <ArrowLeft size={14} /> Back to Organizations Directory
                </Link>
            </div>

            {/* Notifications */}
            {success && (
                <div className="alert alert-success" style={{ display: "flex", alignItems: "center", gap: "10px" }} role="status">
                    <CheckCircle2 size={18} />
                    <span>{success}</span>
                </div>
            )}
            {error && (
                <div className="alert alert-danger" style={{ display: "flex", alignItems: "center", gap: "10px" }} role="alert">
                    <XCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* Hero Banner: Workspace Governance Header */}
            <div className="org-details-hero-card">
                <div className="org-details-hero-left">
                    <div className="org-details-avatar">
                        {getInitials(organization.name)}
                    </div>
                    <div className="org-details-hero-meta">
                        <div className="org-details-title-row">
                            <h1 className="org-details-title">{organization.name}</h1>
                            <code className="org-slug-badge" style={{ fontSize: "12px", padding: "3px 10px" }}>
                                {organization.slug}
                            </code>
                            <span
                                className={`org-status-badge ${
                                    organization.is_active ? "org-status-active" : "org-status-inactive"
                                }`}
                            >
                                <span className={organization.is_active ? "status-dot-active" : "status-dot-inactive"} />
                                {organization.is_active ? "Active Workspace" : "Inactive Workspace"}
                            </span>
                        </div>
                        <p className="org-details-subtitle">
                            {organization.description || "Multi-tenant enterprise hub for events and resources."}
                        </p>
                        <div className="org-details-meta-tags">
                            <span className="org-details-tag">
                                <Clock size={13} /> Created: {formatDate(organization.created_at)}
                            </span>
                            <span className="org-details-tag">
                                <ShieldCheck size={13} color="#059669" /> PostgreSQL Row Isolation Verified
                            </span>
                            <span className="org-details-tag">
                                <Lock size={13} color="#7c3aed" /> Last Admin Protection Guard: Enforced
                            </span>
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <button
                        type="button"
                        onClick={() => fetchOrganizationDetails(true)}
                        className="btn btn-secondary btn-sm"
                        disabled={loading}
                        title="Reload workspace details"
                    >
                        <RotateCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowEditOrgModal(true)}
                        className="btn btn-secondary btn-sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                        <Edit3 size={14} /> Quick Settings
                    </button>

                    <Link
                        to={`/organizations/${organizationId}/events/create`}
                        className="btn btn-primary btn-sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                        <Plus size={14} /> Create Event
                    </Link>

                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="btn btn-danger btn-sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                        <Trash2 size={14} /> {deleting ? "Deleting..." : "Purge Org"}
                    </button>
                </div>
            </div>

            {/* Executive KPI Ribbon */}
            <div className="org-kpi-grid">
                <div className="org-kpi-card" onClick={() => setActiveAdminTab("members")} style={{ cursor: "pointer" }}>
                    <div className="org-kpi-icon-wrapper" style={{ background: "#eff6ff", color: "#2563eb" }}>
                        <Users size={22} />
                    </div>
                    <div className="org-kpi-info">
                        <span className="org-kpi-label">Active Members</span>
                        <div className="org-kpi-value">{memberTotal}</div>
                        <span className="org-kpi-subtext" style={{ color: "#2563eb" }}>
                            {activeAdminsCount} {activeAdminsCount === 1 ? "Admin" : "Admins"} Assigned
                        </span>
                    </div>
                </div>

                <div className="org-kpi-card" onClick={() => setActiveAdminTab("approvals")} style={{ cursor: "pointer" }}>
                    <div className="org-kpi-icon-wrapper" style={{ background: "#ecfdf5", color: "#059669" }}>
                        <Calendar size={22} />
                    </div>
                    <div className="org-kpi-info">
                        <span className="org-kpi-label">Hosted Events</span>
                        <div className="org-kpi-value">{eventTotal}</div>
                        <span className="org-kpi-subtext" style={{ color: "#059669" }}>
                            {events.filter((e) => e.status === "published").length} Published • {pendingEvents.length} Draft
                        </span>
                    </div>
                </div>

                <div className="org-kpi-card" onClick={() => setActiveAdminTab("approvals")} style={{ cursor: "pointer" }}>
                    <div className="org-kpi-icon-wrapper" style={{ background: totalPendingApprovals > 0 ? "#fef2f2" : "#fffbeb", color: totalPendingApprovals > 0 ? "#dc2626" : "#d97706" }}>
                        <CheckSquare size={22} />
                    </div>
                    <div className="org-kpi-info">
                        <span className="org-kpi-label">Pending Approvals</span>
                        <div className="org-kpi-value">{totalPendingApprovals}</div>
                        <span className="org-kpi-subtext" style={{ color: totalPendingApprovals > 0 ? "#dc2626" : "#d97706" }}>
                            {pendingEvents.length} Events • {pendingBookings.length} Bookings
                        </span>
                    </div>
                </div>

                <div className="org-kpi-card">
                    <div className="org-kpi-icon-wrapper" style={{ background: "#f5f3ff", color: "#7c3aed" }}>
                        <ShieldCheck size={22} />
                    </div>
                    <div className="org-kpi-info">
                        <span className="org-kpi-label">Tenant Isolation</span>
                        <div className="org-kpi-value">Verified</div>
                        <span className="org-kpi-subtext" style={{ color: "#7c3aed" }}>
                            PostgreSQL Row Security
                        </span>
                    </div>
                </div>
            </div>

            {/* Organization Admin Capability Tabs Navigation */}
            <nav className="org-admin-tabs-nav" aria-label="Organization Administration Capabilities">
                <button
                    type="button"
                    onClick={() => setActiveAdminTab("governance")}
                    className={`org-admin-tab-btn ${activeAdminTab === "governance" ? "active" : ""}`}
                >
                    <Building2 size={16} />
                    <span>Organization Management</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveAdminTab("members")}
                    className={`org-admin-tab-btn ${activeAdminTab === "members" ? "active" : ""}`}
                >
                    <Users size={16} />
                    <span>Member Role Assignments</span>
                    <span className="tab-badge">{memberTotal}</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveAdminTab("approvals")}
                    className={`org-admin-tab-btn ${activeAdminTab === "approvals" ? "active" : ""}`}
                >
                    <CheckSquare size={16} />
                    <span>Event & Resource Approvals</span>
                    {totalPendingApprovals > 0 && (
                        <span className="tab-badge tab-badge-alert">{totalPendingApprovals}</span>
                    )}
                </button>
            </nav>

            {/* ========================================================= */}
            {/* TAB 1: ORGANIZATION MANAGEMENT & GOVERNANCE                */}
            {/* ========================================================= */}
            {activeAdminTab === "governance" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div className="org-section-card">
                        <div className="org-section-header">
                            <div>
                                <h2 className="org-section-title">Enterprise Workspace Identity & Governance Profile</h2>
                                <p className="org-section-subtitle">
                                    Configure core identity, multi-tenant workspace routing, and security isolation rules.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowEditOrgModal(true)}
                                className="btn btn-primary btn-sm"
                                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                            >
                                <Edit3 size={14} /> Edit Workspace Details
                            </button>
                        </div>

                        <div style={{ padding: "24px" }}>
                            <div className="org-info-grid">
                                <div className="org-info-field">
                                    <span className="org-info-label">Organization Name</span>
                                    <p className="org-info-value">{organization.name}</p>
                                </div>

                                <div className="org-info-field">
                                    <span className="org-info-label">Workspace Slug</span>
                                    <p className="org-info-value" style={{ fontFamily: "monospace" }}>{organization.slug}</p>
                                </div>

                                <div className="org-info-field">
                                    <span className="org-info-label">Multi-Tenant Status</span>
                                    <p className="org-info-value" style={{ color: organization.is_active ? "#059669" : "#dc2626" }}>
                                        {organization.is_active ? "● Active Operational Workspace" : "● Inactive / Archived"}
                                    </p>
                                </div>

                                <div className="org-info-field">
                                    <span className="org-info-label">Database Row Isolation</span>
                                    <p className="org-info-value" style={{ color: "#059669" }}>
                                        ✓ Enforced via organization_id Foreign Key
                                    </p>
                                </div>

                                <div className="org-info-field" style={{ gridColumn: "1 / -1" }}>
                                    <span className="org-info-label">Workspace Description & Mission</span>
                                    <p className="org-info-value">
                                        {organization.description || "No mission description provided yet. Click Edit Workspace Details to add one."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Multi-Tenancy & Safeguard Policy Card */}
                    <div className="org-section-card">
                        <div className="org-section-header">
                            <div>
                                <h3 className="org-section-title">Access Capabilities & RBAC Safeguards</h3>
                                <p className="org-section-subtitle">
                                    Automated business rules enforced at the database and API layer.
                                </p>
                            </div>
                        </div>

                        <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                            <div style={{ padding: "16px", borderRadius: "10px", background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px" }}>
                                    <ShieldCheck size={18} color="#059669" />
                                    <span>Last Active Admin Protection</span>
                                </div>
                                <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                                    The system mathematically prevents deleting, deactivating, or demoting the last remaining active Administrator to prevent accidental workspace lockout.
                                </p>
                            </div>

                            <div style={{ padding: "16px", borderRadius: "10px", background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px" }}>
                                    <CheckSquare size={18} color="#2563eb" />
                                    <span>Dual Approval Authority</span>
                                </div>
                                <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                                    Organization Admins hold singular executive rights to approve draft summits into public visibility and validate room & equipment reservations with zero double-booking overlap.
                                </p>
                            </div>

                            <div style={{ padding: "16px", borderRadius: "10px", background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px" }}>
                                    <Box size={18} color="#7c3aed" />
                                    <span>Resource Concurrency Locking</span>
                                </div>
                                <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                                    Resource bookings evaluate SQL interval intersection logic (`start_1 &lt; end_2 AND end_1 &gt; start_2`) to guarantee hardware and venue exclusivity.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* TAB 2: MEMBER ROLE ASSIGNMENTS & RBAC DELEGATION          */}
            {/* ========================================================= */}
            {activeAdminTab === "members" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {/* Role Matrix Explainer Banner */}
                    <div className="role-matrix-banner">
                        <div className="role-matrix-card">
                            <span className="role-matrix-title">
                                <Shield size={14} color="#4f46e5" /> Organization Admin
                            </span>
                            <p className="role-matrix-desc">
                                Full workspace governance, add/remove staff, manage member roles, and approve events/bookings.
                            </p>
                        </div>
                        <div className="role-matrix-card">
                            <span className="role-matrix-title">
                                <Calendar size={14} color="#059669" /> Event Manager
                            </span>
                            <p className="role-matrix-desc">
                                Create summit schedules, draft breakout sessions, assign speakers, and review registrations.
                            </p>
                        </div>
                        <div className="role-matrix-card">
                            <span className="role-matrix-title">
                                <Sparkles size={14} color="#d97706" /> Staff Coordinator
                            </span>
                            <p className="role-matrix-desc">
                                On-site participant check-in, QR attendance scanning, and day-of-event resource dispatch.
                            </p>
                        </div>
                        <div className="role-matrix-card">
                            <span className="role-matrix-title">
                                <Users size={14} color="#64748b" /> Participant
                            </span>
                            <p className="role-matrix-desc">
                                Register for events, view personal QR passes, track schedule sessions, and join waitlists.
                            </p>
                        </div>
                    </div>

                    {/* Member Roster Card */}
                    <div className="org-section-card">
                        <div className="org-section-header">
                            <div>
                                <h2 className="org-section-title">Organization Membership & Role Assignments</h2>
                                <p className="org-section-subtitle">
                                    Directly reassign member roles, toggle active status, and delegate operational authority.
                                </p>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-primary)", border: "1px solid var(--border-color)", padding: "6px 12px", borderRadius: "8px" }}>
                                    <Search size={14} style={{ color: "var(--text-muted)" }} />
                                    <input
                                        type="text"
                                        placeholder="Search members..."
                                        value={memberSearch}
                                        onChange={(e) => setMemberSearch(e.target.value)}
                                        style={{ border: "none", background: "transparent", outline: "none", fontSize: "13px", color: "var(--text-main)" }}
                                    />
                                </div>

                                <div className="status-filter-pills">
                                    {["all", "admin", "event_manager", "staff", "participant"].map((role) => (
                                        <button
                                            key={role}
                                            type="button"
                                            onClick={() => setMemberRoleFilter(role)}
                                            className={`status-pill-btn ${memberRoleFilter === role ? "active" : ""}`}
                                        >
                                            {role === "all" ? "All Roles" : role.replace("_", " ").toUpperCase()}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowAddMember(true)}
                                    className="btn btn-primary btn-sm"
                                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                                >
                                    <UserPlus size={14} /> Add Member
                                </button>
                            </div>
                        </div>

                        {filteredMembers.length === 0 ? (
                            <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                                <Users size={36} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                                <p style={{ fontSize: "14px", fontWeight: 600 }}>No matching members found</p>
                                <p style={{ fontSize: "12.5px" }}>Add team members to delegate event management and resource operations.</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Member / User Identity</th>
                                            <th>Role Assignment</th>
                                            <th>Status</th>
                                            <th>Joined Date</th>
                                            <th style={{ textAlign: "right", paddingRight: "20px" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredMembers.map((member) => {
                                            const isLastAdmin = member.role === "admin" && member.is_active && activeAdminsCount <= 1;

                                            return (
                                                <tr key={member.id}>
                                                    <td>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                            <div
                                                                style={{
                                                                    width: "36px",
                                                                    height: "36px",
                                                                    borderRadius: "10px",
                                                                    background: member.role === "admin" ? "#e0e7ff" : "#f1f5f9",
                                                                    color: member.role === "admin" ? "#4f46e5" : "#475569",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    fontWeight: 800,
                                                                    fontSize: "12.5px",
                                                                    flexShrink: 0,
                                                                }}
                                                            >
                                                                {String(member.user?.full_name || member.user?.email || member.email || `U${member.user_id}`).slice(0, 2).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <span style={{ fontWeight: 700, display: "block", color: "var(--text-main)" }}>
                                                                    {member.user?.full_name || member.user?.email || member.email || `User #${member.user_id}`}
                                                                </span>
                                                                <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                                                                    {member.user?.email || `User ID: #${member.user_id}`} • Member ID: {String(member.id).slice(0, 8)}...
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Interactive Role Assignment Dropdown */}
                                                    <td>
                                                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                                            <select
                                                                value={member.role}
                                                                onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                                                className="org-filter-select"
                                                                style={{ padding: "6px 10px", fontSize: "12.5px", fontWeight: 600 }}
                                                            >
                                                                <option value="admin">Organization Admin</option>
                                                                <option value="event_manager">Event Manager</option>
                                                                <option value="staff">Staff Coordinator</option>
                                                                <option value="participant">Participant</option>
                                                            </select>
                                                            {isLastAdmin && (
                                                                <span title="Sole active administrator of this organization" style={{ color: "#d97706", display: "inline-flex" }}>
                                                                    <Shield size={14} />
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Status Toggle */}
                                                    <td>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStatusToggle(member.id, member.is_active)}
                                                            className={`badge ${member.is_active ? "badge-published" : "badge-cancelled"}`}
                                                            style={{ cursor: "pointer", border: "none" }}
                                                            title={isLastAdmin ? "Cannot deactivate sole administrator" : "Click to toggle active status"}
                                                        >
                                                            {member.is_active ? "Active" : "Inactive"}
                                                        </button>
                                                    </td>

                                                    <td style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                                                        {formatDate(member.joined_at || member.created_at)}
                                                    </td>

                                                    <td style={{ textAlign: "right", paddingRight: "20px" }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveMember(member.id)}
                                                            className="btn btn-secondary btn-sm"
                                                            disabled={isLastAdmin}
                                                            style={{
                                                                color: isLastAdmin ? "#94a3b8" : "#dc2626",
                                                                borderColor: isLastAdmin ? "transparent" : "#fecaca",
                                                            }}
                                                            title={isLastAdmin ? "Cannot remove sole administrator" : "Revoke membership"}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* TAB 3: EVENT & RESOURCE APPROVALS CENTER                  */}
            {/* ========================================================= */}
            {activeAdminTab === "approvals" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {/* Approvals Sub-Tabs */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                        <div className="approvals-subtabs-bar">
                            <button
                                type="button"
                                onClick={() => setApprovalsSubTab("events")}
                                className={`approvals-subtab-btn ${approvalsSubTab === "events" ? "active" : ""}`}
                            >
                                <Calendar size={15} />
                                <span>Event Approvals & Lifecycle</span>
                                {pendingEvents.length > 0 && (
                                    <span className="tab-badge tab-badge-alert" style={{ marginLeft: "4px" }}>
                                        {pendingEvents.length} Pending
                                    </span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setApprovalsSubTab("resources")}
                                className={`approvals-subtab-btn ${approvalsSubTab === "resources" ? "active" : ""}`}
                            >
                                <Box size={15} />
                                <span>Resource Booking Approvals</span>
                                {pendingBookings.length > 0 && (
                                    <span className="tab-badge tab-badge-alert" style={{ marginLeft: "4px" }}>
                                        {pendingBookings.length} Pending
                                    </span>
                                )}
                            </button>
                        </div>

                        <span style={{ fontSize: "12.5px", color: "var(--text-muted)", fontWeight: 600 }}>
                            {approvalsSubTab === "events"
                                ? `${events.length} Total Events in Workspace`
                                : `${bookings.length} Total Bookings in Workspace`}
                        </span>
                    </div>

                    {/* SUB-TAB A: EVENT APPROVALS & LIFECYCLE */}
                    {approvalsSubTab === "events" && (
                        <div className="org-section-card">
                            <div className="org-section-header">
                                <div>
                                    <h3 className="org-section-title">Event Publication & Lifecycle Approvals</h3>
                                    <p className="org-section-subtitle">
                                        Review draft summits submitted by Event Managers. Approving publishes them directly to public registration.
                                    </p>
                                </div>

                                <Link
                                    to={`/organizations/${organizationId}/events/create`}
                                    className="btn btn-primary btn-sm"
                                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                                >
                                    <Plus size={14} /> Schedule Event
                                </Link>
                            </div>

                            {events.length === 0 ? (
                                <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                                    <Calendar size={36} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                                    <p style={{ fontSize: "14px", fontWeight: 600 }}>No events scheduled for this organization yet</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Event Name & Summary</th>
                                                <th>Location</th>
                                                <th>Schedule Window</th>
                                                <th>Status</th>
                                                <th style={{ textAlign: "right", paddingRight: "20px" }}>Admin Approval Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {events.map((event) => (
                                                <tr key={event.id}>
                                                    <td>
                                                        <span style={{ fontWeight: 700, display: "block", color: "var(--text-main)" }}>
                                                            {event.title || event.name}
                                                        </span>
                                                        <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                                                            Capacity: {event.capacity || "Unlimited"} • Created By User #{event.created_by}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                                                        {event.location || "Online / TBD"}
                                                    </td>
                                                    <td style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                                                        {formatDate(event.starts_at || event.start_time)}
                                                    </td>
                                                    <td>
                                                        <span className={`badge badge-${event.status}`}>
                                                            {event.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: "right", paddingRight: "20px" }}>
                                                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                                            {event.status === "draft" && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleApproveEvent(event.id, event.title)}
                                                                    disabled={processingApproval}
                                                                    className="btn btn-primary btn-sm"
                                                                    style={{ fontSize: "11.5px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                                                    title="Approve & Publish Event"
                                                                >
                                                                    <Check size={13} /> Approve & Publish
                                                                </button>
                                                            )}

                                                            {event.status === "published" && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCancelEvent(event.id, event.title)}
                                                                    disabled={processingApproval}
                                                                    className="btn btn-secondary btn-sm"
                                                                    style={{ fontSize: "11.5px", color: "#dc2626" }}
                                                                    title="Cancel Event"
                                                                >
                                                                    Cancel Event
                                                                </button>
                                                            )}

                                                            <Link
                                                                to={`/organizations/${organizationId}/events/${event.id}`}
                                                                className="btn btn-secondary btn-sm"
                                                                style={{ fontSize: "11.5px" }}
                                                            >
                                                                Details
                                                            </Link>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SUB-TAB B: RESOURCE BOOKING APPROVALS */}
                    {approvalsSubTab === "resources" && (
                        <div className="org-section-card">
                            <div className="org-section-header">
                                <div>
                                    <h3 className="org-section-title">Bookable Resource Approvals Queue</h3>
                                    <p className="org-section-subtitle">
                                        Review conference rooms, auditoriums, and AV equipment requests. Approvals lock intervals against double-booking.
                                    </p>
                                </div>

                                <Link
                                    to="/resources"
                                    className="btn btn-secondary btn-sm"
                                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                                >
                                    <Box size={14} /> View All Resources
                                </Link>
                            </div>

                            {bookings.length === 0 ? (
                                <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                                    <Box size={36} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                                    <p style={{ fontSize: "14px", fontWeight: 600 }}>No resource reservations requested yet</p>
                                    <p style={{ fontSize: "12.5px" }}>Team members can request meeting rooms and equipment for events.</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Requested Resource / Purpose</th>
                                                <th>Time Window</th>
                                                <th>Requested By</th>
                                                <th>Approval Status</th>
                                                <th style={{ textAlign: "right", paddingRight: "20px" }}>Admin Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bookings.map((booking) => (
                                                <tr key={booking.id}>
                                                    <td>
                                                        <span style={{ fontWeight: 700, display: "block", color: "var(--text-main)" }}>
                                                            {booking.resource?.name || `Resource #${booking.resource_id?.slice(0, 8)}`}
                                                        </span>
                                                        <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                                                            {booking.purpose || "Resource allocation request"}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                                                        {formatDate(booking.start_time)} – {formatDate(booking.end_time)}
                                                    </td>
                                                    <td>
                                                        <span style={{ fontWeight: 600, fontSize: "12.5px", display: "block" }}>
                                                            {booking.requester?.full_name || booking.requester?.email || `User #${booking.requested_by}`}
                                                        </span>
                                                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                                            {booking.requester?.email || ""}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`badge badge-${booking.status}`}>
                                                            {booking.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: "right", paddingRight: "20px" }}>
                                                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                                            {booking.status === "requested" && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleApproveBooking(booking.id, booking.purpose)}
                                                                        disabled={processingApproval}
                                                                        className="btn btn-primary btn-sm"
                                                                        style={{ fontSize: "11.5px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                                                    >
                                                                        <Check size={13} /> Approve
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setRejectingBookingId(booking.id)}
                                                                        disabled={processingApproval}
                                                                        className="btn btn-secondary btn-sm"
                                                                        style={{ fontSize: "11.5px", color: "#dc2626" }}
                                                                    >
                                                                        <X size={13} /> Reject
                                                                    </button>
                                                                </>
                                                            )}

                                                            {booking.status === "approved" && (
                                                                <span style={{ fontSize: "12px", color: "#059669", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                                    <CheckCircle2 size={14} /> Approved & Locked
                                                                </span>
                                                            )}

                                                            {booking.status === "rejected" && (
                                                                <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 600 }}>
                                                                    Rejected
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================= */}
            {/* MODALS: ADD MEMBER, EDIT ORG, REJECT BOOKING              */}
            {/* ========================================================= */}

            {/* Quick Settings Form Modal */}
            {showEditOrgModal && (
                <div className="modal-overlay" onClick={() => setShowEditOrgModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                            <div>
                                <h3 style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>Edit Workspace Governance Details</h3>
                                <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "4px 0 0" }}>
                                    Update organization identity and public metadata.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowEditOrgModal(false)}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateOrganization} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <label style={{ fontSize: "13px", fontWeight: 700 }}>Organization Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="search-input"
                                    style={{ width: "100%", marginTop: "6px" }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: "13px", fontWeight: 700 }}>Description & Purpose</label>
                                <textarea
                                    rows={3}
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className="search-input"
                                    style={{ width: "100%", marginTop: "6px", fontFamily: "inherit" }}
                                />
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                                <button
                                    type="button"
                                    onClick={() => setShowEditOrgModal(false)}
                                    className="btn btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingSettings}
                                    className="btn btn-primary"
                                >
                                    {savingSettings ? "Saving Changes..." : "Save Settings"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Member Modal */}
            {showAddMember && (
                <div className="modal-overlay" onClick={() => setShowAddMember(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                            <div>
                                <h3 style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>Add Member to Workspace</h3>
                                <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "4px 0 0" }}>
                                    Assign staff, event managers, or participants.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAddMember(false)}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddMemberSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <label style={{ fontSize: "13px", fontWeight: 700 }}>User Email Address *</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="user@example.com"
                                    value={newMemberEmail}
                                    onChange={(e) => setNewMemberEmail(e.target.value)}
                                    className="search-input"
                                    style={{ width: "100%", marginTop: "6px" }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: "13px", fontWeight: 700 }}>Assigned Role *</label>
                                <select
                                    value={newMemberRole}
                                    onChange={(e) => setNewMemberRole(e.target.value)}
                                    className="select-input"
                                    style={{ width: "100%", marginTop: "6px" }}
                                >
                                    <option value="admin">Organization Admin (Full Governance & Approvals)</option>
                                    <option value="event_manager">Event Manager (Summits & Breakouts)</option>
                                    <option value="staff">Staff Coordinator (Check-In & Operations)</option>
                                    <option value="participant">Participant (Attendee Access)</option>
                                </select>
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAddMember(false)}
                                    className="btn btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={addingMember}
                                    className="btn btn-primary"
                                >
                                    {addingMember ? "Adding..." : "Add Member"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Rejection Reason Modal */}
            {rejectingBookingId && (
                <div className="modal-overlay" onClick={() => setRejectingBookingId(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                            <h3 style={{ fontSize: "17px", fontWeight: 800, margin: 0, color: "#dc2626" }}>
                                Reject Resource Reservation
                            </h3>
                            <button
                                type="button"
                                onClick={() => setRejectingBookingId(null)}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                            >
                                <XCircle size={18} />
                            </button>
                        </div>

                        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 14px" }}>
                            Provide an administrative reason for denying this room or equipment allocation request:
                        </p>

                        <textarea
                            rows={3}
                            placeholder="e.g. Space reserved for executive board briefing or maintenance."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="search-input"
                            style={{ width: "100%", fontFamily: "inherit" }}
                        />

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                            <button
                                type="button"
                                onClick={() => setRejectingBookingId(null)}
                                className="btn btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmRejectBooking}
                                disabled={processingApproval}
                                className="btn btn-danger"
                            >
                                {processingApproval ? "Rejecting..." : "Confirm Rejection"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
