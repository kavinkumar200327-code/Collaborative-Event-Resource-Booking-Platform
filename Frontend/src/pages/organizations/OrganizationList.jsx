import { useCallback, useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useConfirm } from "../../context/ConfirmContext";
import {
    Building2,
    Plus,
    Search,
    RotateCw,
    Eye,
    Edit3,
    Trash2,
    Calendar,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    X,
    ShieldCheck,
    Layers,
    XCircle,
} from "lucide-react";
import organizationApi from "../../api/organizationApi";
import "./organizations.css";

export default function OrganizationList() {
    const { isSuperAdmin, isOrgAdmin } = useAuth();
    const confirm = useConfirm();
    const isAdmin = isSuperAdmin || isOrgAdmin;

    const [organizations, setOrganizations] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortBy, setSortBy] = useState("name_asc");
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [deletingId, setDeletingId] = useState(null);

    const fetchOrganizations = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const data = await organizationApi.getOrganizations(page, pageSize);
            setOrganizations(data.items || []);
            setTotal(data.total || 0);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                err.response?.data?.detail ||
                "Failed to load organizations."
            );
        } finally {
            setLoading(false);
        }
    }, [page, pageSize]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchOrganizations();
    }, [fetchOrganizations]);

    // Client-side filter & sort on top of fetched page items
    const filteredOrganizations = useMemo(() => {
        let result = organizations.filter((org) => {
            const searchValue = search.toLowerCase().trim();
            const name = org.name?.toLowerCase() || "";
            const slug = org.slug?.toLowerCase() || "";
            const description = org.description?.toLowerCase() || "";

            const matchesSearch =
                !searchValue ||
                name.includes(searchValue) ||
                slug.includes(searchValue) ||
                description.includes(searchValue);

            const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "active" && org.is_active) ||
                (statusFilter === "inactive" && !org.is_active);

            return matchesSearch && matchesStatus;
        });

        // Sorting
        return result.sort((a, b) => {
            if (sortBy === "name_asc") return (a.name || "").localeCompare(b.name || "");
            if (sortBy === "name_desc") return (b.name || "").localeCompare(a.name || "");
            if (sortBy === "newest") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            if (sortBy === "oldest") return new Date(a.created_at || 0) - new Date(b.created_at || 0);
            return 0;
        });
    }, [organizations, search, statusFilter, sortBy]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // Stats calculations
    const stats = useMemo(() => {
        const activeCount = organizations.filter((o) => o.is_active).length;
        const inactiveCount = organizations.length - activeCount;
        return {
            totalWorkspaces: total || organizations.length,
            activeCount,
            inactiveCount,
        };
    }, [organizations, total]);

    const handleDelete = async (organization) => {
        const confirmed = await confirm({
            title: "Delete Organization?",
            message: `Are you sure you want to permanently delete "${organization.name}"? This action will remove the organization and its associated resources.`,
            confirmText: "Delete Organization",
            cancelText: "Keep Organization",
            variant: "danger",
            notice: "This operation is irreversible.",
        });

        if (!confirmed) return;

        try {
            setDeletingId(organization.id);
            setError("");
            setSuccess("");

            await organizationApi.deleteOrganization(organization.id);
            setSuccess(`Organization "${organization.name}" deleted successfully.`);

            if (organizations.length === 1 && page > 1) {
                setPage((prev) => prev - 1);
            } else {
                await fetchOrganizations();
            }
        } catch (err) {
            setError(
                err.response?.data?.message ||
                err.response?.data?.detail ||
                "Failed to delete organization."
            );
        } finally {
            setDeletingId(null);
        }
    };

    const handleRefresh = () => {
        setSuccess("");
        fetchOrganizations();
    };

    // Helper for generating initials
    const getInitials = (name) => {
        if (!name) return "OG";
        const parts = name.trim().split(" ");
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    return (
        <div className="organization-page-container">
            {/* Header Hero Section */}
            <div className="organization-hero-header">
                <div className="organization-hero-left">
                    <div className="organization-hero-icon">
                        <Building2 size={26} />
                    </div>
                    <div>
                        <h1 className="organization-hero-title">Organizations</h1>
                        <p className="organization-hero-subtitle">
                            Configure enterprise workspaces, assign staff memberships, track multi-tenant events, and govern resources.
                        </p>
                    </div>
                </div>

                <div className="organization-hero-actions">
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="btn btn-secondary btn-sm"
                        disabled={loading}
                        title="Reload Organizations"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                        <RotateCw size={14} className={loading ? "animate-spin" : ""} />
                        <span>Refresh</span>
                    </button>

                    {isAdmin && (
                        <Link
                            to="/organizations/create"
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
                            <span>Create Organization</span>
                        </Link>
                    )}
                </div>
            </div>

            {/* KPI Metric Cards Ribbon */}
            <div className="org-kpi-grid">
                <div className="org-kpi-card">
                    <div className="org-kpi-icon-wrapper" style={{ background: "#eff6ff", color: "#2563eb" }}>
                        <Building2 size={22} />
                    </div>
                    <div className="org-kpi-info">
                        <span className="org-kpi-label">Total Organizations</span>
                        <div className="org-kpi-value">{stats.totalWorkspaces}</div>
                        <span className="org-kpi-subtext" style={{ color: "#2563eb" }}>
                            Enterprise Directory
                        </span>
                    </div>
                </div>

                <div className="org-kpi-card">
                    <div className="org-kpi-icon-wrapper" style={{ background: "#ecfdf5", color: "#059669" }}>
                        <CheckCircle2 size={22} />
                    </div>
                    <div className="org-kpi-info">
                        <span className="org-kpi-label">Active Workspaces</span>
                        <div className="org-kpi-value">{stats.activeCount}</div>
                        <span className="org-kpi-subtext" style={{ color: "#059669" }}>
                            Operational & Verified
                        </span>
                    </div>
                </div>

                <div className="org-kpi-card">
                    <div className="org-kpi-icon-wrapper" style={{ background: "#f5f3ff", color: "#7c3aed" }}>
                        <ShieldCheck size={22} />
                    </div>
                    <div className="org-kpi-info">
                        <span className="org-kpi-label">RBAC Isolation</span>
                        <div className="org-kpi-value">100%</div>
                        <span className="org-kpi-subtext" style={{ color: "#7c3aed" }}>
                            Tenant-Level Protected
                        </span>
                    </div>
                </div>

                <div className="org-kpi-card">
                    <div className="org-kpi-icon-wrapper" style={{ background: "#fffbeb", color: "#d97706" }}>
                        <Layers size={22} />
                    </div>
                    <div className="org-kpi-info">
                        <span className="org-kpi-label">Multi-Tenant Sync</span>
                        <div className="org-kpi-value">Live</div>
                        <span className="org-kpi-subtext" style={{ color: "#d97706" }}>
                            PostgreSQL Row Isolation
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
            <div className="org-toolbar-card">
                <div className="org-toolbar-left">
                    <div className="org-search-box">
                        <Search size={16} className="org-search-icon" />
                        <input
                            type="text"
                            placeholder="Search by name, slug, or description..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="org-search-input"
                            aria-label="Search organizations"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="org-search-clear"
                                title="Clear search"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="org-filter-select"
                        aria-label="Filter by status"
                    >
                        <option value="all">All Statuses</option>
                        <option value="active">Active Only</option>
                        <option value="inactive">Inactive Only</option>
                    </select>

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="org-filter-select"
                        aria-label="Sort organizations"
                    >
                        <option value="name_asc">Name (A-Z)</option>
                        <option value="name_desc">Name (Z-A)</option>
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                    </select>
                </div>

                <div className="org-toolbar-right">
                    <span className="org-count-pill">
                        {filteredOrganizations.length} {filteredOrganizations.length === 1 ? "Organization" : "Organizations"} Found
                    </span>
                </div>
            </div>

            {/* Data Table Card */}
            <div className="org-table-card">
                {loading && organizations.length === 0 ? (
                    <div style={{ padding: "80px 24px", textAlign: "center" }}>
                        <span className="spinner" />
                        <p style={{ marginTop: "16px", color: "var(--text-muted)", fontSize: "14px", fontWeight: 500 }}>
                            Loading enterprise organizations...
                        </p>
                    </div>
                ) : filteredOrganizations.length === 0 ? (
                    <div className="org-empty-container">
                        <div className="org-empty-icon">
                            <Building2 size={32} />
                        </div>
                        <h3 className="org-empty-title">No Organizations Found</h3>
                        <p className="org-empty-subtitle">
                            {search || statusFilter !== "all"
                                ? "No organizations match your current search and filter criteria. Try adjusting your parameters."
                                : "Get started by creating your first organization to manage events, attendees, and bookable resources."}
                        </p>
                        {!search && statusFilter === "all" ? (
                            <Link
                                to="/organizations/create"
                                className="btn btn-primary btn-sm"
                                style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "8px" }}
                            >
                                <Plus size={15} /> Create Organization
                            </Link>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch("");
                                    setStatusFilter("all");
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{ marginTop: "8px" }}
                            >
                                Reset Filters
                            </button>
                        )}
                    </div>
                ) : (
                    /* Modern Web Guidance: role="region", tabindex="0", and aria-labelledby for responsive accessible table */
                    <div
                        className="org-table-wrapper"
                        role="region"
                        aria-labelledby="org-directory-heading"
                        tabIndex={0}
                    >
                        <table className="org-table">
                            <thead>
                                <tr>
                                    <th id="org-directory-heading">Organization & Slug</th>
                                    <th>Description & Purpose</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: "right", paddingRight: "24px" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrganizations.map((org) => {
                                    const initials = getInitials(org.name);

                                    return (
                                        <tr key={org.id}>
                                            {/* Name, Avatar, and Slug */}
                                            <td>
                                                <div className="org-identity-cell">
                                                    <div className="org-avatar-badge" title={org.name}>
                                                        {initials}
                                                    </div>
                                                    <div className="org-title-group">
                                                        <Link
                                                            to={`/organizations/${org.id}`}
                                                            className="org-name-link"
                                                        >
                                                            {org.name}
                                                        </Link>
                                                        <code className="org-slug-badge">
                                                            {org.slug || "no-slug"}
                                                        </code>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Description */}
                                            <td>
                                                <div
                                                    className="org-desc-text"
                                                    title={org.description || "No description provided."}
                                                >
                                                    {org.description || (
                                                        <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                                                            No description configured.
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Status Badge */}
                                            <td>
                                                <span
                                                    className={`org-status-badge ${
                                                        org.is_active ? "org-status-active" : "org-status-inactive"
                                                    }`}
                                                >
                                                    <span
                                                        className={
                                                            org.is_active
                                                                ? "status-dot-active"
                                                                : "status-dot-inactive"
                                                        }
                                                    />
                                                    {org.is_active ? "Active" : "Inactive"}
                                                </span>
                                            </td>

                                            {/* Action Buttons */}
                                            <td style={{ textAlign: "right", paddingRight: "20px" }}>
                                                <div className="org-actions-cluster">
                                                    <Link
                                                        to={`/organizations/${org.id}`}
                                                        className="org-action-btn org-action-view"
                                                        title="View Organization Dashboard & Members"
                                                    >
                                                        <Eye size={13} />
                                                        <span>View</span>
                                                    </Link>

                                                    <Link
                                                        to={`/organizations/${org.id}/events`}
                                                        className="org-action-btn org-action-events"
                                                        title="View Events for this Organization"
                                                    >
                                                        <Calendar size={13} />
                                                        <span>Events</span>
                                                    </Link>

                                                    {isAdmin && (
                                                        <Link
                                                            to={`/organizations/${org.id}/edit`}
                                                            className="org-action-btn org-action-edit"
                                                            title="Edit Organization Information"
                                                        >
                                                            <Edit3 size={13} />
                                                            <span>Edit</span>
                                                        </Link>
                                                    )}

                                                    {isAdmin && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(org)}
                                                            disabled={deletingId === org.id}
                                                            className="org-action-btn org-action-delete"
                                                            title="Delete Organization"
                                                        >
                                                            <Trash2 size={13} />
                                                            <span>
                                                                {deletingId === org.id ? "Deleting..." : "Delete"}
                                                            </span>
                                                        </button>
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
                {filteredOrganizations.length > 0 && (
                    <div className="org-pagination-footer">
                        <div className="org-pagination-meta">
                            Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> · Total: <strong>{total}</strong> {total === 1 ? "organization" : "organizations"}
                        </div>

                        <div className="org-pagination-nav">
                            <button
                                type="button"
                                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                disabled={page === 1 || loading}
                                className="org-page-btn"
                                aria-label="Previous Page"
                            >
                                <ChevronLeft size={16} />
                                <span>Previous</span>
                            </button>

                            <span className="org-page-indicator">
                                {page} / {totalPages}
                            </span>

                            <button
                                type="button"
                                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={page >= totalPages || loading}
                                className="org-page-btn"
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
