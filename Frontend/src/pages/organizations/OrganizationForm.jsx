import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Building2, ArrowLeft, CheckCircle2, XCircle, Edit3, Plus, ShieldCheck } from "lucide-react";
import organizationApi from "../../api/organizationApi";
import "./organizations.css";

export default function OrganizationForm() {
    const { organizationId } = useParams();
    const navigate = useNavigate();
    const isEdit = Boolean(organizationId);

    const [form, setForm] = useState({
        name: "",
        slug: "",
        description: "",
    });
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isEdit) {
            const fetchOrg = async () => {
                try {
                    const data = await organizationApi.getOrganizationById(organizationId);
                    setForm({
                        name: data.name || "",
                        slug: data.slug || "",
                        description: data.description || "",
                    });
                } catch (err) {
                    setError("Failed to load organization data.");
                } finally {
                    setFetching(false);
                }
            };
            fetchOrg();
        }
    }, [isEdit, organizationId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (isEdit) {
                await organizationApi.updateOrganization(organizationId, form);
            } else {
                await organizationApi.createOrganization(form);
            }
            navigate("/organizations");
        } catch (err) {
            setError(
                err.response?.data?.error?.message ||
                err.response?.data?.detail ||
                "Operation failed. Ensure the slug is unique and only contains lowercase letters, numbers, and hyphens."
            );
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div style={{ padding: "80px 24px", textAlign: "center" }}>
                <span className="spinner" />
                <p style={{ marginTop: "16px", color: "var(--text-muted)", fontSize: "14px", fontWeight: 500 }}>
                    Loading organization workspace configuration...
                </p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: "680px", margin: "0 auto", animation: "fadeIn 0.25s ease" }}>
            <div style={{ marginBottom: "20px" }}>
                <Link
                    to="/organizations"
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
                    <ArrowLeft size={14} /> Back to Organizations
                </Link>
            </div>

            <div className="card" style={{ padding: "32px", borderRadius: "var(--radius-lg)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid var(--border-color)" }}>
                    <div className="organization-hero-icon" style={{ width: "46px", height: "46px", borderRadius: "12px" }}>
                        {isEdit ? <Edit3 size={22} /> : <Building2 size={22} />}
                    </div>
                    <div>
                        <h1 style={{ fontSize: "20px", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
                            {isEdit ? "Edit Organization Workspace" : "Create New Organization Workspace"}
                        </h1>
                        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                            Configure tenant-isolated workspace parameters, name, and URL slug identifier.
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="alert alert-danger" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }} role="alert">
                        <XCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div>
                        <label style={{ fontSize: "13.5px", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                            Organization Name <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Acme Technology Global"
                            value={form.name}
                            onChange={(e) => {
                                const name = e.target.value;
                                setForm((prev) => ({
                                    ...prev,
                                    name,
                                    slug: !isEdit && !prev.slugManuallyEdited
                                        ? name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-")
                                        : prev.slug,
                                }));
                            }}
                            className="search-input"
                            style={{ width: "100%" }}
                        />
                        <span style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                            The official display name of your organization.
                        </span>
                    </div>

                    <div>
                        <label style={{ fontSize: "13.5px", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                            Slug Identifier <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. acme-tech-global"
                            value={form.slug}
                            onChange={(e) => setForm({ ...form, slug: e.target.value, slugManuallyEdited: true })}
                            className="search-input"
                            style={{ width: "100%", fontFamily: "var(--font-mono, monospace)" }}
                        />
                        <span style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                            Unique URL-safe handle (only lowercase letters, numbers, and hyphens).
                        </span>
                    </div>

                    <div>
                        <label style={{ fontSize: "13.5px", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                            Organization Description
                        </label>
                        <textarea
                            rows={4}
                            placeholder="Briefly describe the organization's mission, events scope, and community..."
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="search-input"
                            style={{ width: "100%", resize: "vertical" }}
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "16px", borderTop: "1px solid var(--border-color)", marginTop: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                            <ShieldCheck size={14} color="#059669" /> Automatic PostgreSQL multi-tenant isolation
                        </div>

                        <div style={{ display: "flex", gap: "10px" }}>
                            <Link to="/organizations" className="btn btn-secondary">
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={loading}
                                className="btn btn-primary"
                                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                            >
                                {isEdit ? <Edit3 size={15} /> : <Plus size={15} />}
                                <span>{loading ? "Saving Workspace..." : isEdit ? "Update Workspace" : "Create Workspace"}</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
