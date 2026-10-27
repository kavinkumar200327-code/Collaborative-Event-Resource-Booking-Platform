import { useState, useEffect, useCallback } from "react";
import resourceApi from "../../api/resourceApi";
import bookingApi from "../../api/bookingApi";
import organizationApi from "../../api/organizationApi";
import { useAuth } from "../../context/AuthContext";
import {
    Box,
    Plus,
    Calendar,
    MapPin,
    Users,
    CheckCircle2,
    XCircle,
    RotateCw,
} from "lucide-react";

export default function ResourceList() {
    const { isSuperAdmin, isOrgAdmin, isEventManager, isStaff } = useAuth();
    const canManage = isSuperAdmin || isOrgAdmin || isEventManager || isStaff;

    const [resources, setResources] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState("");
    const [loading, setLoading] = useState(true);
    const [togglingId, setTogglingId] = useState(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Create Resource Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: "",
        type: "meeting_room",
        description: "",
        location: "",
        capacity: 10,
        organization_id: "",
    });

    // Book Resource Modal
    const [showBookModal, setShowBookModal] = useState(false);
    const [targetResource, setTargetResource] = useState(null);
    const [bookingForm, setBookingForm] = useState({
        start_time: "",
        end_time: "",
        purpose: "",
    });

    const isResourceActive = (r) => {
        if (r.is_active !== undefined) return Boolean(r.is_active);
        return r.status === "active";
    };

    const formatForInput = (date) => {
        const pad = (n) => String(n).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const orgsRes = await organizationApi.getOrganizations(1, 100);
            const orgList = orgsRes.items || [];
            setOrganizations(orgList);

            const initialOrgId = selectedOrg || (orgList.length > 0 ? orgList[0].id : "");
            if (!selectedOrg && initialOrgId) {
                setSelectedOrg(initialOrgId);
            }

            const params = initialOrgId ? { organization_id: initialOrgId } : {};
            const resData = await resourceApi.getResources(params);
            setResources(resData.items || []);
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to load resources.");
        } finally {
            setLoading(false);
        }
    }, [selectedOrg]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadData();
    }, [loadData]);

    const handleCreateResource = async (e) => {
        e.preventDefault();
        setError("");
        try {
            await resourceApi.createResource({
                ...createForm,
                organization_id: selectedOrg || createForm.organization_id,
            });
            setShowCreateModal(false);
            setSuccess("Resource created successfully.");
            setCreateForm({ name: "", type: "meeting_room", description: "", location: "", capacity: 10, organization_id: "" });
            loadData();
        } catch (err) {
            setError(err.response?.data?.error?.message || err.response?.data?.detail || "Failed to create resource.");
        }
    };

    const handleOpenBookModal = (res) => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0, 0);

        setBookingForm({
            start_time: formatForInput(start),
            end_time: formatForInput(end),
            purpose: "",
        });
        setTargetResource(res);
        setShowBookModal(true);
    };

    const handleBookResource = async (e) => {
        e.preventDefault();
        setError("");
        try {
            await bookingApi.createBooking({
                resource_id: targetResource.id,
                start_time: bookingForm.start_time,
                end_time: bookingForm.end_time,
                purpose: bookingForm.purpose,
            });
            setShowBookModal(false);
            setSuccess("Booking request created successfully! It is now pending approval.");
            setBookingForm({ start_time: "", end_time: "", purpose: "" });
            loadData();
        } catch (err) {
            const errMsg = err.response?.data?.error?.message || err.response?.data?.detail || "Booking failed.";
            setError(errMsg);
        }
    };

    const handleToggleStatus = async (resource) => {
        const currentlyActive = isResourceActive(resource);
        setTogglingId(resource.id);
        setError("");
        setSuccess("");
        try {
            if (currentlyActive) {
                await resourceApi.deactivateResource(resource.id);
                setSuccess(`Resource "${resource.name}" deactivated.`);
            } else {
                await resourceApi.activateResource(resource.id);
                setSuccess(`Resource "${resource.name}" activated successfully.`);
            }
            await loadData();
        } catch (err) {
            setError(
                err.response?.data?.error?.message ||
                err.response?.data?.message ||
                err.response?.data?.detail ||
                "Failed to update resource status."
            );
        } finally {
            setTogglingId(null);
        }
    };

    return (
        <div className="resources-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Bookable Resources</h1>
                    <p className="page-subtitle">
                        Manage rooms, projectors, cameras, vehicles, and equipment with overlap prevention.
                    </p>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button
                        type="button"
                        onClick={loadData}
                        className="btn btn-secondary btn-sm"
                        disabled={loading}
                        title="Reload resources"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                        <RotateCw size={14} className={loading ? "animate-spin" : ""} />
                        <span>Refresh</span>
                    </button>

                    {canManage && (
                        <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="btn btn-primary"
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                            <Plus size={16} /> Add Resource
                        </button>
                    )}
                </div>
            </div>

            {/* Organization filter toolbar */}
            <div className="card" style={{ padding: "12px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)" }}>Organization:</span>
                    <select
                        value={selectedOrg}
                        onChange={(e) => setSelectedOrg(e.target.value)}
                        className="select-input"
                    >
                        {organizations.map((org) => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {success && (
                <div
                    className="alert alert-success"
                    style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                    <CheckCircle2 size={16} />
                    <span>{success}</span>
                </div>
            )}
            {error && (
                <div
                    className="alert alert-danger"
                    style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                    <XCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {loading ? (
                <div style={{ padding: "60px", textAlign: "center" }}>
                    <span className="spinner" />
                    <p style={{ marginTop: "12px", color: "var(--text-muted)" }}>Loading resources...</p>
                </div>
            ) : resources.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "40px" }}>
                    <Box size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
                    <p style={{ color: "var(--text-muted)" }}>No bookable resources configured for this organization.</p>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
                    {resources.map((res) => {
                        const active = isResourceActive(res);
                        const isToggling = togglingId === res.id;

                        return (
                            <div key={res.id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                        <span style={{
                                            textTransform: "uppercase",
                                            fontSize: "11px",
                                            fontWeight: 800,
                                            padding: "2px 8px",
                                            borderRadius: "4px",
                                            background: "#eff6ff",
                                            color: "#2563eb",
                                        }}>
                                            {res.type.replace("_", " ")}
                                        </span>
                                        <span className={`badge ${active ? "badge-confirmed" : "badge-cancelled"}`} style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                            <span style={{
                                                width: "6px",
                                                height: "6px",
                                                borderRadius: "50%",
                                                backgroundColor: active ? "#059669" : "#dc2626",
                                            }} />
                                            {active ? "Active" : "Inactive"}
                                        </span>
                                    </div>
                                    <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "8px 0" }}>{res.name}</h3>
                                    <p style={{ fontSize: "13px", color: "var(--text-muted)", minHeight: "38px" }}>
                                        {res.description || "Standard enterprise resource available for booking."}
                                    </p>
                                    <div style={{ display: "flex", gap: "16px", marginTop: "12px", fontSize: "13px", color: "var(--text-muted)" }}>
                                        {res.location && (
                                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                <MapPin size={14} /> {res.location}
                                            </span>
                                        )}
                                        {res.capacity && (
                                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                <Users size={14} /> Cap: {res.capacity}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: "flex", gap: "8px", marginTop: "20px", borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenBookModal(res)}
                                        disabled={!active}
                                        className="btn btn-primary btn-sm"
                                        style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                                        title={active ? "Book this resource" : "Resource is inactive and cannot be booked"}
                                    >
                                        <Calendar size={14} /> Book Now
                                    </button>

                                    {canManage && (
                                        <button
                                            type="button"
                                            onClick={() => handleToggleStatus(res)}
                                            disabled={isToggling}
                                            className="btn btn-secondary btn-sm"
                                            title={active ? "Deactivate this resource" : "Activate this resource"}
                                            style={!active ? { borderColor: "#059669", color: "#059669" } : {}}
                                        >
                                            {isToggling ? "Updating..." : (active ? "Deactivate" : "Activate")}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal: Create Resource */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>Add Bookable Resource</h3>
                        <form onSubmit={handleCreateResource} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <label style={{ fontSize: "13px", fontWeight: 600 }}>Resource Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Conference Room A, 4K Projector"
                                    value={createForm.name}
                                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                    className="search-input"
                                    style={{ width: "100%", marginTop: "4px" }}
                                />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                <div>
                                    <label style={{ fontSize: "13px", fontWeight: 600 }}>Type</label>
                                    <select
                                        value={createForm.type}
                                        onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                                        className="select-input"
                                        style={{ width: "100%", marginTop: "4px" }}
                                    >
                                        <option value="meeting_room">Meeting Room</option>
                                        <option value="conference_hall">Conference Hall</option>
                                        <option value="projector">Projector</option>
                                        <option value="camera">Camera</option>
                                        <option value="vehicle">Vehicle</option>
                                        <option value="equipment">Equipment</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: "13px", fontWeight: 600 }}>Capacity</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={createForm.capacity}
                                        onChange={(e) => setCreateForm({ ...createForm, capacity: parseInt(e.target.value, 10) || 1 })}
                                        className="search-input"
                                        style={{ width: "100%", marginTop: "4px" }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: "13px", fontWeight: 600 }}>Location</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 2nd Floor, Wing B"
                                    value={createForm.location}
                                    onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                                    className="search-input"
                                    style={{ width: "100%", marginTop: "4px" }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: "13px", fontWeight: 600 }}>Description</label>
                                <textarea
                                    rows={2}
                                    value={createForm.description}
                                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                                    className="search-input"
                                    style={{ width: "100%", marginTop: "4px" }}
                                />
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Create Resource
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Book Resource */}
            {showBookModal && targetResource && (
                <div className="modal-overlay" onClick={() => setShowBookModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>
                            Book: {targetResource.name}
                        </h3>
                        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
                            The system strictly prevents overlapping bookings using DB row-locking concurrency guards.
                        </p>
                        <form onSubmit={handleBookResource} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <label style={{ fontSize: "13px", fontWeight: 600 }}>Start Time</label>
                                <input
                                    type="datetime-local"
                                    required
                                    value={bookingForm.start_time}
                                    onChange={(e) => setBookingForm({ ...bookingForm, start_time: e.target.value })}
                                    className="search-input"
                                    style={{ width: "100%", marginTop: "4px" }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: "13px", fontWeight: 600 }}>End Time</label>
                                <input
                                    type="datetime-local"
                                    required
                                    value={bookingForm.end_time}
                                    onChange={(e) => setBookingForm({ ...bookingForm, end_time: e.target.value })}
                                    className="search-input"
                                    style={{ width: "100%", marginTop: "4px" }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: "13px", fontWeight: 600 }}>Purpose / Reservation Notes</label>
                                <textarea
                                    rows={3}
                                    required
                                    placeholder="Explain the purpose of this reservation..."
                                    value={bookingForm.purpose}
                                    onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })}
                                    className="search-input"
                                    style={{ width: "100%", marginTop: "4px" }}
                                />
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                                <button type="button" onClick={() => setShowBookModal(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Confirm Booking
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
