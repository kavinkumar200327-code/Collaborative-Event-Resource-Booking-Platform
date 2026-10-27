import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import eventApi from "../../api/eventApi";
import sessionApi from "../../api/sessionApi";
import speakerApi from "../../api/speakerApi";
import registrationApi from "../../api/registrationApi";
import attendanceApi from "../../api/attendanceApi";
import commentApi from "../../api/commentApi";
import fileApi from "../../api/fileApi";
import resourceApi from "../../api/resourceApi";
import {
    MapPin,
    Users,
    Clock,
    CheckCircle2,
    XCircle,
    UploadCloud,
    Download,
    MessageSquare,
    QrCode,
    Plus,
    FileText,
    Send,
    Sparkles,
    Camera,
    Ticket,
} from "lucide-react";
import "./events.css";

export default function EventDetails() {
    const { organizationId, eventId } = useParams();
    const { user } = useAuth();

    const userRole = (user?.role || "participant").toLowerCase();
    const isSuperAdmin = userRole === "super_admin" || (userRole === "admin" && (user?.email === "admin@collab.com" || user?.id === 1));
    const isOrgAdmin = userRole === "admin" && !isSuperAdmin;
    const isEventManager = userRole === "event_manager";
    const isStaff = userRole === "staff";
    const isParticipant = userRole === "participant" || (!isSuperAdmin && !isOrgAdmin && !isEventManager && !isStaff);
    const isManagerOrAdmin = isSuperAdmin || isOrgAdmin || isEventManager;

    const [event, setEvent] = useState(null);
    const [activeTab, setActiveTab] = useState("overview"); // overview, sessions, speakers, registrations, attendance, discussions, files
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionMsg, setActionMsg] = useState("");

    // Data for sub-tabs
    const [sessions, setSessions] = useState([]);
    const [speakers, setSpeakers] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [attendanceList, setAttendanceList] = useState([]);
    const [comments, setComments] = useState([]);
    const [files, setFiles] = useState([]);
    const [resources, setResources] = useState([]);

    // Forms
    const [newComment, setNewComment] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [checkInInput, setCheckInInput] = useState("");

    // Session Modal
    const [showSessionModal, setShowSessionModal] = useState(false);
    const [sessionForm, setSessionForm] = useState({
        title: "",
        description: "",
        start_time: "",
        end_time: "",
        room_id: "",
        speaker_id: "",
        room: "",
        capacity: 30,
    });

    // Speaker Modal
    const [showSpeakerModal, setShowSpeakerModal] = useState(false);
    const [speakerForm, setSpeakerForm] = useState({
        name: "",
        title: "",
        organization_name: "",
        email: "",
        bio: "",
        photo_url: "",
    });

    const fetchAllData = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const eventData = await eventApi.getEventById(organizationId, eventId);
            setEvent(eventData);

            const effectiveOrgId = organizationId || eventData?.organization_id;

            // Fetch sub-items in parallel
            const [sessRes, spkRes, regRes, attRes, comRes, filesRes, resRes] = await Promise.allSettled([
                sessionApi.getEventSessions(eventId),
                speakerApi.getSpeakers(effectiveOrgId),
                registrationApi.getEventRegistrations(eventId),
                attendanceApi.getEventAttendance(eventId),
                commentApi.getComments(eventId),
                fileApi.getEventFiles(eventId),
                resourceApi.getResources({ organization_id: effectiveOrgId }),
            ]);

            if (sessRes.status === "fulfilled") setSessions(sessRes.value.items || sessRes.value || []);
            if (spkRes.status === "fulfilled") setSpeakers(spkRes.value.items || spkRes.value || []);
            if (regRes.status === "fulfilled") setRegistrations(regRes.value.items || regRes.value || []);
            if (attRes.status === "fulfilled") setAttendanceList(attRes.value.items || attRes.value || []);
            if (comRes.status === "fulfilled") setComments(comRes.value.items || comRes.value || []);
            if (filesRes.status === "fulfilled") setFiles(filesRes.value.items || filesRes.value || []);
            if (resRes.status === "fulfilled") setResources(resRes.value.items || resRes.value || []);
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to load event details.");
        } finally {
            setLoading(false);
        }
    }, [organizationId, eventId]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchAllData();
    }, [fetchAllData]);

    // Status Transitions
    const handleStatusTransition = async (action) => {
        setActionMsg("");
        setError("");
        try {
            if (action === "publish") await eventApi.publishEvent(organizationId, eventId);
            else if (action === "cancel") await eventApi.cancelEvent(organizationId, eventId);
            else if (action === "complete") await eventApi.completeEvent(organizationId, eventId);

            setActionMsg(`Event successfully marked as ${action}ed.`);
            fetchAllData();
        } catch (err) {
            setError(err.response?.data?.error?.message || err.response?.data?.detail || "Status transition failed.");
        }
    };

    // Registration Handler
    const handleRegister = async () => {
        setActionMsg("");
        setError("");
        try {
            const res = await registrationApi.register(eventId);
            setActionMsg(res.status === "waitlisted" ? "Event is full! You have been added to the WAITLIST." : "Registration successful! You are CONFIRMED.");
            fetchAllData();
        } catch (err) {
            setError(err.response?.data?.error?.message || err.response?.data?.detail || "Registration failed.");
        }
    };

    // Session Creation
    const handleCreateSession = async (e) => {
        e.preventDefault();
        setError("");
        try {
            await sessionApi.createSession(eventId, sessionForm);
            setShowSessionModal(false);
            setSessionForm({ title: "", description: "", start_time: "", end_time: "", room: "", capacity: 30 });
            setActionMsg("Session created successfully.");
            fetchAllData();
        } catch (err) {
            setError(err.response?.data?.error?.message || err.response?.data?.detail || "Failed to create session.");
        }
    };

    // Speaker Creation
    const handleCreateSpeaker = async (e) => {
        e.preventDefault();
        if (!speakerForm.name.trim()) return;
        setError("");
        try {
            const orgId = organizationId || event?.organization_id;
            await speakerApi.createSpeaker({
                organization_id: orgId,
                name: speakerForm.name.trim(),
                title: speakerForm.title?.trim() || null,
                organization_name: speakerForm.organization_name?.trim() || null,
                email: speakerForm.email?.trim() || null,
                bio: speakerForm.bio?.trim() || null,
                photo_url: speakerForm.photo_url?.trim() || null,
            });
            setShowSpeakerModal(false);
            setSpeakerForm({
                name: "",
                title: "",
                organization_name: "",
                email: "",
                bio: "",
                photo_url: "",
            });
            setActionMsg("Keynote / Guest Speaker added successfully.");
            const updated = await speakerApi.getSpeakers(orgId);
            setSpeakers(updated.items || updated || []);
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to create speaker.");
        }
    };

    // Comment Submission
    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            await commentApi.createComment(eventId, { content: newComment });
            setNewComment("");
            const updated = await commentApi.getComments(eventId);
            setComments(updated.items || updated || []);
        } catch (err) {
            setError(err.response?.data?.error?.message || "Failed to post comment.");
        }
    };

    // File Upload
    const handleFileUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile) return;
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("event_id", eventId);

        try {
            await fileApi.uploadFile(formData);
            setSelectedFile(null);
            setActionMsg("File uploaded successfully.");
            const updatedFiles = await fileApi.getEventFiles(eventId);
            setFiles(updatedFiles.items || updatedFiles || []);
        } catch (err) {
            setError(err.response?.data?.error?.message || err.response?.data?.detail || "File upload failed.");
        }
    };

    // Attendance Check-in
    const handleCheckIn = async (e) => {
        e.preventDefault();
        if (!checkInInput.trim()) return;
        try {
            await attendanceApi.checkInByCode(eventId, checkInInput.trim());
            setCheckInInput("");
            setActionMsg("Participant successfully checked in!");
            fetchAllData();
        } catch (err) {
            setError(err.response?.data?.error?.message || err.response?.data?.detail || "Invalid check-in code.");
        }
    };

    // CSV Export
    const handleExportCsv = async () => {
        try {
            const blob = await attendanceApi.exportAttendanceCsv(eventId);
            const url = window.URL.createObjectURL(new Blob([blob]));
            const a = document.createElement("a");
            a.href = url;
            a.download = `attendance_event_${eventId}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch {
            setError("Failed to export attendance CSV.");
        }
    };

    const isRegistered = registrations.some(
        (r) => r.user_id === user?.id || (user?.email && r.user?.email === user.email)
    );

    if (loading) {
        return (
            <div style={{ padding: "60px", textAlign: "center" }}>
                <span className="spinner" />
                <p style={{ marginTop: "12px", color: "var(--text-muted)" }}>Loading event details...</p>
            </div>
        );
    }

    if (!event) {
        return <div className="alert alert-danger">Event not found.</div>;
    }

    return (
        <div className="event-details-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                        <span className={`badge badge-${event.status}`}>{event.status}</span>
                        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Event #{event.id}</span>
                    </div>
                    <h1 className="page-title">{event.title || event.name}</h1>
                    <div style={{ display: "flex", gap: "16px", color: "var(--text-muted)", fontSize: "14px", marginTop: "8px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={16} />
                            {new Date(event.starts_at || event.start_time).toLocaleString()} - {new Date(event.ends_at || event.end_time).toLocaleString()}
                        </span>
                        {event.location && (
                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <MapPin size={16} />
                                {event.location}
                            </span>
                        )}
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Users size={16} />
                            Capacity: {registrations.filter(r => r.status === "confirmed").length} / {event.capacity}
                        </span>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                    {/* Event Manager & Admin Controls */}
                    {isManagerOrAdmin && event.status === "draft" && (
                        <button onClick={() => handleStatusTransition("publish")} className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <CheckCircle2 size={16} /> Publish Event
                        </button>
                    )}

                    {isManagerOrAdmin && event.status === "published" && (
                        <button onClick={() => handleStatusTransition("cancel")} className="btn btn-danger" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <XCircle size={16} /> Cancel Event
                        </button>
                    )}

                    {/* Participant / Registration Actions */}
                    {event.status === "published" && (
                        isRegistered ? (
                            <Link to="/my-registrations" className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                <Ticket size={16} /> View My QR Ticket Pass
                            </Link>
                        ) : (
                            <button onClick={handleRegister} className="btn btn-success" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                <CheckCircle2 size={16} />
                                {registrations.filter((r) => r.status === "confirmed").length >= event.capacity
                                    ? "Join Waitlist"
                                    : "Register for Event"}
                            </button>
                        )
                    )}

                    {/* Staff Coordinator Shortcut */}
                    {isStaff && (
                        <Link to={`/attendance-checkin?event_id=${eventId}`} className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <Camera size={16} /> On-Site Check-In Desk
                        </Link>
                    )}

                    <Link to={organizationId ? `/organizations/${organizationId}/events` : "/events"} className="btn btn-secondary">
                        Back to Events
                    </Link>
                </div>
            </div>

            {/* Participant Ticket Status Banner */}
            {isParticipant && isRegistered && (
                <div style={{ marginBottom: "20px", background: "rgba(5, 150, 105, 0.1)", border: "1px solid rgba(5, 150, 105, 0.25)", borderRadius: "10px", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Ticket size={20} style={{ color: "#059669" }} />
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#059669" }}>
                            You are officially registered for this event!
                        </span>
                    </div>
                    <Link to="/my-registrations" className="btn btn-primary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <QrCode size={14} /> View Digital QR Ticket Pass
                    </Link>
                </div>
            )}

            {actionMsg && <div className="alert alert-success">{actionMsg}</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {/* Navigation Tabs */}
            <div className="tabs-container">
                <button
                    className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
                    onClick={() => setActiveTab("overview")}
                >
                    Overview
                </button>
                <button
                    className={`tab-btn ${activeTab === "sessions" ? "active" : ""}`}
                    onClick={() => setActiveTab("sessions")}
                >
                    Sessions ({sessions.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === "speakers" ? "active" : ""}`}
                    onClick={() => setActiveTab("speakers")}
                >
                    <Sparkles size={14} /> Speakers ({speakers.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === "registrations" ? "active" : ""}`}
                    onClick={() => setActiveTab("registrations")}
                >
                    Registrations & Waitlist ({registrations.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === "attendance" ? "active" : ""}`}
                    onClick={() => setActiveTab("attendance")}
                >
                    Attendance & QR ({attendanceList.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === "discussions" ? "active" : ""}`}
                    onClick={() => setActiveTab("discussions")}
                >
                    Discussions ({comments.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === "files" ? "active" : ""}`}
                    onClick={() => setActiveTab("files")}
                >
                    Documents & Files ({files.length})
                </button>
            </div>

            {/* TAB: Overview */}
            {activeTab === "overview" && (
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
                    <div className="card">
                        <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px" }}>About this Event</h3>
                        <p style={{ color: "var(--text-main)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                            {event.description || "No description provided."}
                        </p>
                    </div>

                    <div className="card">
                        <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px" }}>Event Quick Stats</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--text-muted)" }}>Confirmed:</span>
                                <strong>{registrations.filter(r => r.status === "confirmed").length}</strong>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--text-muted)" }}>Waitlisted:</span>
                                <strong>{registrations.filter(r => r.status === "waitlisted").length}</strong>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--text-muted)" }}>Total Capacity:</span>
                                <strong>{event.capacity}</strong>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "var(--text-muted)" }}>Breakout Sessions:</span>
                                <strong>{sessions.length}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: Sessions */}
            {activeTab === "sessions" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <div>
                            <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Event Sessions & Breakouts</h3>
                            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "3px 0 0 0" }}>
                                Keynote presentations, technical breakouts, and workshops.
                            </p>
                        </div>
                        {isManagerOrAdmin && (
                            <button onClick={() => setShowSessionModal(true)} className="btn btn-primary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                <Plus size={14} /> Add Breakout Session
                            </button>
                        )}
                    </div>

                    {sessions.length === 0 ? (
                        <div className="card" style={{ textAlign: "center", padding: "40px" }}>
                            <p style={{ color: "var(--text-muted)" }}>No sessions scheduled for this event yet.</p>
                            {isManagerOrAdmin && (
                                <button onClick={() => setShowSessionModal(true)} className="btn btn-secondary btn-sm" style={{ marginTop: "10px" }}>
                                    <Plus size={14} /> Add First Session
                                </button>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {sessions.map((sess) => {
                                const spk = speakers.find((s) => s.id === sess.speaker_id);
                                const assignedRoom = resources.find((r) => r.id === sess.room_id);

                                return (
                                    <div key={sess.id} className="card" style={{ padding: "18px 22px" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                                            <div style={{ flex: 1, minWidth: "260px" }}>
                                                <h4 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>{sess.title}</h4>
                                                <p style={{ fontSize: "13.5px", color: "var(--text-muted)", marginTop: "4px" }}>
                                                    {sess.description}
                                                </p>
                                                <div style={{ display: "flex", gap: "16px", marginTop: "10px", fontSize: "13px", color: "var(--text-muted)", flexWrap: "wrap" }}>
                                                    <span>⏰ {new Date(sess.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(sess.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    {(sess.room || assignedRoom) && (
                                                        <span>🏢 Room: {assignedRoom?.name || sess.room}</span>
                                                    )}
                                                    <span>👥 Capacity: {sess.capacity}</span>
                                                </div>
                                            </div>

                                            {spk && (
                                                <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--bg-subtle)", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                                                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--primary-gradient)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "12px" }}>
                                                        {spk.name?.[0]?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <span style={{ fontSize: "12.5px", fontWeight: 700, display: "block" }}>{spk.name}</span>
                                                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{spk.title || "Speaker"}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Speakers & Keynotes */}
            {activeTab === "speakers" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <div>
                            <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Featured Speakers & Keynote Lineup</h3>
                            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "3px 0 0 0" }}>
                                Distinguished subject matter experts and breakout facilitators.
                            </p>
                        </div>
                        {isManagerOrAdmin && (
                            <button onClick={() => setShowSpeakerModal(true)} className="btn btn-primary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                <Plus size={14} /> Schedule Speaker
                            </button>
                        )}
                    </div>

                    {speakers.length === 0 ? (
                        <div className="card" style={{ textAlign: "center", padding: "50px 20px" }}>
                            <Users size={36} style={{ color: "var(--text-muted)", margin: "0 auto 12px", opacity: 0.5 }} />
                            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>No keynote speakers scheduled for this organization yet.</p>
                            {isManagerOrAdmin && (
                                <button onClick={() => setShowSpeakerModal(true)} className="btn btn-secondary btn-sm" style={{ marginTop: "12px" }}>
                                    <Plus size={14} /> Add Keynote Speaker
                                </button>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                            {speakers.map((spk) => (
                                <div key={spk.id} className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                                            <div style={{
                                                width: "44px",
                                                height: "44px",
                                                borderRadius: "50%",
                                                background: "var(--primary-gradient)",
                                                color: "#fff",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontWeight: 800,
                                                fontSize: "16px",
                                                flexShrink: 0,
                                            }}>
                                                {spk.name?.[0]?.toUpperCase() || "S"}
                                            </div>
                                            <div>
                                                <h4 style={{ fontSize: "15.5px", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
                                                    {spk.name}
                                                </h4>
                                                <span style={{ fontSize: "12px", color: "var(--primary)", fontWeight: 600 }}>
                                                    {spk.title || spk.organization_name || "Featured Keynote"}
                                                </span>
                                            </div>
                                        </div>

                                        <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "14px" }}>
                                            {spk.bio || "Speaker bio and expertise details."}
                                        </p>
                                    </div>

                                    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "12px", fontSize: "12px", color: "var(--text-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span>{spk.email || "Public Speaker"}</span>
                                        {isManagerOrAdmin && (
                                            <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                                                ID: {spk.id?.slice(0, 8)}...
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Registrations & Waitlist */}
            {activeTab === "registrations" && (
                <div className="card">
                    <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>
                        Registered Participants & Automatic Waitlist
                    </h3>
                    {registrations.length === 0 ? (
                        <p style={{ color: "var(--text-muted)", padding: "16px 0" }}>No registrations recorded yet.</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Registration ID</th>
                                        <th>Participant</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {registrations.map((reg) => (
                                        <tr key={reg.id}>
                                            <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{reg.id}</td>
                                            <td>User #{reg.user_id}</td>
                                            <td>
                                                <span className={`badge badge-${reg.status}`}>{reg.status}</span>
                                            </td>
                                            <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                                {new Date(reg.created_at).toLocaleDateString()}
                                            </td>
                                            <td>
                                                {reg.status === "pending" && (
                                                    <div style={{ display: "flex", gap: "6px" }}>
                                                        <button onClick={async () => { await registrationApi.approveRegistration(reg.id); fetchAllData(); }} className="btn btn-success btn-sm">Approve</button>
                                                        <button onClick={async () => { await registrationApi.rejectRegistration(reg.id); fetchAllData(); }} className="btn btn-danger btn-sm">Reject</button>
                                                    </div>
                                                )}
                                                {(reg.status === "confirmed" || reg.status === "waitlisted") && (
                                                    <button onClick={async () => { await registrationApi.cancelRegistration(reg.id); fetchAllData(); }} className="btn btn-secondary btn-sm">Cancel</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Attendance & QR Code */}
            {activeTab === "attendance" && (
                <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px", marginBottom: "20px" }}>
                        {/* Check-in Scanner Card */}
                        <div className="card">
                            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <QrCode size={18} /> QR / Code Check-In
                            </h3>
                            <form onSubmit={handleCheckIn} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <input
                                    type="text"
                                    placeholder="Enter Participant Code..."
                                    value={checkInInput}
                                    onChange={(e) => setCheckInInput(e.target.value)}
                                    className="search-input"
                                />
                                <button type="submit" className="btn btn-primary">Check In</button>
                            </form>
                            <button onClick={handleExportCsv} className="btn btn-secondary" style={{ width: "100%", marginTop: "12px" }}>
                                <Download size={14} /> Export Attendance CSV
                            </button>
                        </div>

                        {/* Attendance Table */}
                        <div className="card">
                            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px" }}>Attendee Status</h3>
                            <div className="table-responsive">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Participant</th>
                                            <th>Status</th>
                                            <th>Check-In Time</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendanceList.map((att) => (
                                            <tr key={att.id}>
                                                <td>User #{att.user_id}</td>
                                                <td>
                                                    <span className={`badge badge-${att.status}`}>{att.status}</span>
                                                </td>
                                                <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                                    {att.check_in_time ? new Date(att.check_in_time).toLocaleTimeString() : "-"}
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={async () => {
                                                            const nextStatus = att.status === "attended" ? "noshow" : "attended";
                                                            await attendanceApi.updateAttendance(att.id, { status: nextStatus });
                                                            fetchAllData();
                                                        }}
                                                        className="btn btn-secondary btn-sm"
                                                    >
                                                        Toggle Status
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: Discussions */}
            {activeTab === "discussions" && (
                <div className="card">
                    <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <MessageSquare size={18} /> Event Collaboration & Mentions (@username)
                    </h3>
                    <form onSubmit={handleAddComment} style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
                        <input
                            type="text"
                            placeholder="Type a comment or mention @colleague..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="search-input"
                        />
                        <button type="submit" className="btn btn-primary">
                            <Send size={16} /> Post
                        </button>
                    </form>

                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {comments.length === 0 ? (
                            <p style={{ color: "var(--text-muted)" }}>No comments yet. Start the conversation!</p>
                        ) : (
                            comments.map((c) => (
                                <div key={c.id} style={{ padding: "12px 16px", background: "var(--bg-subtle)", borderRadius: "var(--radius)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                        <strong style={{ fontSize: "13px" }}>User #{c.user_id}</strong>
                                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                            {new Date(c.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: "14px", color: "var(--text-main)" }}>{c.content}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* TAB: Files */}
            {activeTab === "files" && (
                <div className="card">
                    <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <FileText size={18} /> Event Attachments & Magic-Byte Validated Files
                    </h3>
                    <form onSubmit={handleFileUpload} style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
                        <input
                            type="file"
                            onChange={(e) => setSelectedFile(e.target.files[0])}
                            style={{ fontSize: "14px" }}
                        />
                        <button type="submit" disabled={!selectedFile} className="btn btn-primary btn-sm">
                            <UploadCloud size={14} /> Upload File
                        </button>
                    </form>

                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>File Name</th>
                                    <th>MIME Type</th>
                                    <th>Size</th>
                                    <th>Uploaded</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {files.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                                            No files uploaded.
                                        </td>
                                    </tr>
                                ) : (
                                    files.map((f) => (
                                        <tr key={f.id}>
                                            <td style={{ fontWeight: 600 }}>{f.file_name}</td>
                                            <td style={{ fontSize: "12px" }}>{f.mime_type}</td>
                                            <td style={{ fontSize: "12px" }}>{(f.file_size / 1024).toFixed(1)} KB</td>
                                            <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                                {new Date(f.created_at).toLocaleDateString()}
                                            </td>
                                            <td>
                                                <a
                                                    href={fileApi.getDownloadUrl(f.id)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="btn btn-secondary btn-sm"
                                                >
                                                    <Download size={12} /> Download
                                                </a>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal: Add Session */}
            {showSessionModal && (
                <div className="modal-overlay" onClick={() => setShowSessionModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>Add Event Session</h3>
                        <form onSubmit={handleCreateSession} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <label style={{ fontSize: "13px", fontWeight: 600 }}>Session Title</label>
                                <input
                                    type="text"
                                    required
                                    value={sessionForm.title}
                                    onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                                    className="search-input"
                                    style={{ width: "100%", marginTop: "4px" }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: "13px", fontWeight: 600 }}>Description</label>
                                <textarea
                                    value={sessionForm.description}
                                    onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
                                    className="search-input"
                                    style={{ width: "100%", marginTop: "4px" }}
                                    rows={2}
                                />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                <div>
                                    <label style={{ fontSize: "13px", fontWeight: 600 }}>Start Time</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={sessionForm.start_time}
                                        onChange={(e) => setSessionForm({ ...sessionForm, start_time: e.target.value })}
                                        className="search-input"
                                        style={{ width: "100%", marginTop: "4px" }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: "13px", fontWeight: 600 }}>End Time</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={sessionForm.end_time}
                                        onChange={(e) => setSessionForm({ ...sessionForm, end_time: e.target.value })}
                                        className="search-input"
                                        style={{ width: "100%", marginTop: "4px" }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                <div>
                                    <label style={{ fontSize: "13px", fontWeight: 600 }}>Speaker / Keynote</label>
                                    <select
                                        value={sessionForm.speaker_id}
                                        onChange={(e) => setSessionForm({ ...sessionForm, speaker_id: e.target.value })}
                                        className="search-input select-input"
                                        style={{ width: "100%", marginTop: "4px" }}
                                    >
                                        <option value="">No Speaker Assigned</option>
                                        {speakers.map((spk) => (
                                            <option key={spk.id} value={spk.id}>
                                                {spk.name} {spk.organization_name ? `(${spk.organization_name})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: "13px", fontWeight: 600 }}>Bookable Venue / Room</label>
                                    <select
                                        value={sessionForm.room_id}
                                        onChange={(e) => {
                                            const sel = resources.find((r) => r.id === e.target.value);
                                            setSessionForm({
                                                ...sessionForm,
                                                room_id: e.target.value,
                                                room: sel?.name || sessionForm.room,
                                            });
                                        }}
                                        className="search-input select-input"
                                        style={{ width: "100%", marginTop: "4px" }}
                                    >
                                        <option value="">Custom Location (below)</option>
                                        {resources.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.name} (Cap: {r.capacity})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                <div>
                                    <label style={{ fontSize: "13px", fontWeight: 600 }}>Room Name / Location</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Grand Ballroom A"
                                        value={sessionForm.room}
                                        onChange={(e) => setSessionForm({ ...sessionForm, room: e.target.value })}
                                        className="search-input"
                                        style={{ width: "100%", marginTop: "4px" }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: "13px", fontWeight: 600 }}>Capacity</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={sessionForm.capacity}
                                        onChange={(e) => setSessionForm({ ...sessionForm, capacity: parseInt(e.target.value) || 1 })}
                                        className="search-input"
                                        style={{ width: "100%", marginTop: "4px" }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                                <button type="button" onClick={() => setShowSessionModal(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Save Session
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Schedule Speaker */}
            {showSpeakerModal && (
                <div className="modal-overlay" onClick={() => setShowSpeakerModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                            <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Schedule Keynote / Guest Speaker</h3>
                            <button onClick={() => setShowSpeakerModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                                <XCircle size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSpeaker} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <label style={{ fontSize: "13px", fontWeight: 600 }}>Speaker Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Dr. Jane Doe"
                                    value={speakerForm.name}
                                    onChange={(e) => setSpeakerForm({ ...speakerForm, name: e.target.value })}
                                    className="search-input"
                                    style={{ width: "100%", marginTop: "4px" }}
                                />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                <div>
                                    <label style={{ fontSize: "13px", fontWeight: 600 }}>Title / Designation</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Principal Cloud Architect"
                                        value={speakerForm.title}
                                        onChange={(e) => setSpeakerForm({ ...speakerForm, title: e.target.value })}
                                        className="search-input"
                                        style={{ width: "100%", marginTop: "4px" }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: "13px", fontWeight: 600 }}>Organization / Affiliation</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Google Cloud"
                                        value={speakerForm.organization_name}
                                        onChange={(e) => setSpeakerForm({ ...speakerForm, organization_name: e.target.value })}
                                        className="search-input"
                                        style={{ width: "100%", marginTop: "4px" }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: "13px", fontWeight: 600 }}>Email Address</label>
                                <input
                                    type="email"
                                    placeholder="speaker@company.com"
                                    value={speakerForm.email}
                                    onChange={(e) => setSpeakerForm({ ...speakerForm, email: e.target.value })}
                                    className="search-input"
                                    style={{ width: "100%", marginTop: "4px" }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: "13px", fontWeight: 600 }}>Bio & Expertise Details</label>
                                <textarea
                                    placeholder="Brief summary of experience, keynote topics, or research..."
                                    value={speakerForm.bio}
                                    onChange={(e) => setSpeakerForm({ ...speakerForm, bio: e.target.value })}
                                    className="search-input"
                                    style={{ width: "100%", marginTop: "4px" }}
                                    rows={3}
                                />
                            </div>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                                <button type="button" onClick={() => setShowSpeakerModal(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Save Speaker
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
