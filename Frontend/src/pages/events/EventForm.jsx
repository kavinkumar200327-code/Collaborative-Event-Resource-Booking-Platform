import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    Calendar,
    ArrowLeft,
    Clock,
    MapPin,
    Users,
    CheckCircle2,
    XCircle,
    Plus,
    Edit3,
    Building2,
    ShieldCheck,
} from "lucide-react";
import eventApi from "../../api/eventApi";
import organizationApi from "../../api/organizationApi";
import "./events.css";

const INITIAL_FORM_DATA = {
    title: "",
    description: "",
    location: "",
    starts_at: "",
    ends_at: "",
    capacity: 100,
};

const formatDateTimeLocal = (dateValue) => {
    if (!dateValue) return "";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
};

const getErrorMessage = (error) => {
    const message = error.response?.data?.message || error.response?.data?.error?.message;
    const detail = error.response?.data?.detail;
    if (typeof message === "string") return message;
    if (typeof detail === "string") return detail;
    if (Array.isArray(error.response?.data?.errors)) {
        return error.response.data.errors.map((item) => item.msg).join(", ");
    }
    return error.message || "Something went wrong.";
};

export default function EventForm() {
    const navigate = useNavigate();
    const { organizationId, eventId } = useParams();
    const isEditMode = Boolean(eventId);

    const [formData, setFormData] = useState(INITIAL_FORM_DATA);
    const [organizations, setOrganizations] = useState([]);
    const [targetOrgId, setTargetOrgId] = useState(organizationId || "");
    const [loading, setLoading] = useState(isEditMode);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});

    // Fetch organizations if not provided in URL
    useEffect(() => {
        if (!organizationId) {
            organizationApi
                .getOrganizations(1, 50)
                .then((data) => {
                    const items = data.items || [];
                    setOrganizations(items);
                    if (items.length > 0 && !targetOrgId) {
                        setTargetOrgId(items[0].id);
                    }
                })
                .catch(console.error);
        } else {
            setTargetOrgId(organizationId);
        }
    }, [organizationId]);

    useEffect(() => {
        let active = true;

        const fetchEvent = async () => {
            if (!isEditMode) {
                setFormData({ ...INITIAL_FORM_DATA });
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError("");
                const event = await eventApi.getEventById(organizationId, eventId);
                if (!active) return;

                setFormData({
                    title: event.title || "",
                    description: event.description || "",
                    location: event.location || "",
                    starts_at: formatDateTimeLocal(event.starts_at),
                    ends_at: formatDateTimeLocal(event.ends_at),
                    capacity: event.capacity ?? 100,
                });
                if (event.organization_id) {
                    setTargetOrgId(event.organization_id);
                }
            } catch (err) {
                if (active) setError(getErrorMessage(err));
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchEvent();

        return () => {
            active = false;
        };
    }, [isEditMode, organizationId, eventId]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
        if (fieldErrors[name]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    const validateForm = () => {
        const errors = {};
        const startDate = new Date(formData.starts_at);
        const endDate = new Date(formData.ends_at);
        const capacity = Number(formData.capacity);

        if (!targetOrgId) {
            errors.organization = "Please select an organization workspace.";
        }

        if (!formData.title.trim()) {
            errors.title = "Event title is required.";
        } else if (formData.title.trim().length < 2) {
            errors.title = "Title must be at least 2 characters.";
        }

        if (!formData.location.trim()) {
            errors.location = "Event location or virtual platform is required.";
        }

        if (!formData.starts_at) {
            errors.starts_at = "Start date and time are required.";
        } else if (Number.isNaN(startDate.getTime())) {
            errors.starts_at = "Enter a valid start date.";
        }

        if (!formData.ends_at) {
            errors.ends_at = "End date and time are required.";
        } else if (Number.isNaN(endDate.getTime())) {
            errors.ends_at = "Enter a valid end date.";
        }

        if (
            formData.starts_at &&
            formData.ends_at &&
            !Number.isNaN(startDate.getTime()) &&
            !Number.isNaN(endDate.getTime()) &&
            endDate <= startDate
        ) {
            errors.ends_at = "End date must be later than start date.";
        }

        if (!Number.isInteger(capacity) || capacity < 1) {
            errors.capacity = "Capacity must be a positive integer (minimum 1 seat).";
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");

        if (!validateForm()) return;

        try {
            setSubmitting(true);

            const payload = {
                title: formData.title.trim(),
                description: formData.description.trim(),
                location: formData.location.trim(),
                starts_at: new Date(formData.starts_at).toISOString(),
                ends_at: new Date(formData.ends_at).toISOString(),
                capacity: Number(formData.capacity),
            };

            let savedEvent;
            if (isEditMode) {
                savedEvent = await eventApi.updateEvent(targetOrgId, eventId, payload);
            } else {
                savedEvent = await eventApi.createEvent(targetOrgId, payload);
            }

            const backRoute = targetOrgId
                ? `/organizations/${targetOrgId}/events/${savedEvent.id}`
                : `/events/${savedEvent.id}`;

            navigate(backRoute, { replace: true });
        } catch (err) {
            setError(getErrorMessage(err));
            const backendErrors = err.response?.data?.errors || err.response?.data?.detail;
            if (Array.isArray(backendErrors)) {
                const mappedErrors = {};
                backendErrors.forEach((item) => {
                    const field = item.loc?.at(-1);
                    if (typeof field === "string") {
                        mappedErrors[field] = item.msg;
                    }
                });
                setFieldErrors(mappedErrors);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const backUrl = organizationId
        ? `/organizations/${organizationId}/events`
        : "/events";

    if (loading) {
        return (
            <div style={{ padding: "80px 24px", textAlign: "center" }}>
                <span className="spinner" />
                <p style={{ marginTop: "16px", color: "var(--text-muted)", fontSize: "14px", fontWeight: 500 }}>
                    Loading event information...
                </p>
            </div>
        );
    }

    return (
        <div className="event-form-container">
            <div style={{ marginBottom: "20px" }}>
                <Link
                    to={backUrl}
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
                    <ArrowLeft size={14} /> Back to Events Directory
                </Link>
            </div>

            <div className="event-form-card">
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        marginBottom: "24px",
                        paddingBottom: "20px",
                        borderBottom: "1px solid var(--border-color)",
                    }}
                >
                    <div className="event-hero-icon" style={{ width: "46px", height: "46px", borderRadius: "12px" }}>
                        {isEditMode ? <Edit3 size={22} /> : <Calendar size={22} />}
                    </div>
                    <div>
                        <h1 style={{ fontSize: "20px", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
                            {isEditMode ? "Edit Organization Event" : "Create New Organization Event"}
                        </h1>
                        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                            Configure event schedule window, seat capacity limits, and venue logistics.
                        </p>
                    </div>
                </div>

                {error && (
                    <div
                        className="alert alert-danger"
                        style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}
                        role="alert"
                    >
                        <XCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }} noValidate>
                    {/* Organization Workspace Picker if not locked */}
                    {!organizationId && organizations.length > 0 && (
                        <div className="event-form-field">
                            <label className="event-form-label">
                                Target Organization Workspace <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <select
                                value={targetOrgId}
                                onChange={(e) => setTargetOrgId(e.target.value)}
                                className="select-input"
                                style={{ width: "100%" }}
                                disabled={isEditMode}
                            >
                                {organizations.map((org) => (
                                    <option key={org.id} value={org.id}>
                                        {org.name} ({org.slug})
                                    </option>
                                ))}
                            </select>
                            {fieldErrors.organization && (
                                <p className="event-field-error">{fieldErrors.organization}</p>
                            )}
                        </div>
                    )}

                    {/* Event Title */}
                    <div className="event-form-field">
                        <label htmlFor="title" className="event-form-label">
                            Event Title <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                            type="text"
                            id="title"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            placeholder="e.g. AI & Cloud Innovation Summit 2026"
                            maxLength={200}
                            required
                            className="search-input"
                            style={{ width: "100%" }}
                        />
                        {fieldErrors.title && <p className="event-field-error">{fieldErrors.title}</p>}
                    </div>

                    {/* Location */}
                    <div className="event-form-field">
                        <label htmlFor="location" className="event-form-label">
                            Location / Venue / Virtual Link <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                            type="text"
                            id="location"
                            name="location"
                            value={formData.location}
                            onChange={handleChange}
                            placeholder="e.g. Main Auditorium, Hall A or Zoom Webinar"
                            maxLength={255}
                            required
                            className="search-input"
                            style={{ width: "100%" }}
                        />
                        {fieldErrors.location && <p className="event-field-error">{fieldErrors.location}</p>}
                    </div>

                    {/* Date/Time Grid */}
                    <div className="event-form-grid-2">
                        <div className="event-form-field">
                            <label htmlFor="starts_at" className="event-form-label">
                                Start Date & Time <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <input
                                type="datetime-local"
                                id="starts_at"
                                name="starts_at"
                                value={formData.starts_at}
                                onChange={handleChange}
                                required
                                className="search-input"
                                style={{ width: "100%" }}
                            />
                            {fieldErrors.starts_at && <p className="event-field-error">{fieldErrors.starts_at}</p>}
                        </div>

                        <div className="event-form-field">
                            <label htmlFor="ends_at" className="event-form-label">
                                End Date & Time <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <input
                                type="datetime-local"
                                id="ends_at"
                                name="ends_at"
                                value={formData.ends_at}
                                onChange={handleChange}
                                required
                                className="search-input"
                                style={{ width: "100%" }}
                            />
                            {fieldErrors.ends_at && <p className="event-field-error">{fieldErrors.ends_at}</p>}
                        </div>
                    </div>

                    {/* Capacity */}
                    <div className="event-form-field">
                        <label htmlFor="capacity" className="event-form-label">
                            Maximum Attendee Capacity <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                            type="number"
                            id="capacity"
                            name="capacity"
                            value={formData.capacity}
                            onChange={handleChange}
                            min="1"
                            step="1"
                            required
                            className="search-input"
                            style={{ width: "100%" }}
                        />
                        <span style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "4px" }}>
                            Registrations exceeding this threshold automatically enter the FIFO waitlist.
                        </span>
                        {fieldErrors.capacity && <p className="event-field-error">{fieldErrors.capacity}</p>}
                    </div>

                    {/* Description */}
                    <div className="event-form-field">
                        <label htmlFor="description" className="event-form-label">
                            Event Description & Agenda Outline
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Describe event themes, keynotes, schedule highlights, and target audience..."
                            rows={5}
                            className="search-input"
                            style={{ width: "100%", resize: "vertical" }}
                        />
                        {fieldErrors.description && <p className="event-field-error">{fieldErrors.description}</p>}
                    </div>

                    {/* Footer Controls */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            paddingTop: "16px",
                            borderTop: "1px solid var(--border-color)",
                            marginTop: "8px",
                            flexWrap: "wrap",
                            gap: "12px",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                            <ShieldCheck size={14} color="#059669" /> Double booking and capacity collision checks enabled
                        </div>

                        <div style={{ display: "flex", gap: "10px" }}>
                            <Link to={backUrl} className="btn btn-secondary">
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="btn btn-primary"
                                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                            >
                                {isEditMode ? <Edit3 size={15} /> : <Plus size={15} />}
                                <span>{submitting ? "Saving Event..." : isEditMode ? "Update Event" : "Create Event"}</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
