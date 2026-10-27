import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import {
    QrCode,
    Camera,
    UploadCloud,
    Download,
    CheckCircle2,
    XCircle,
    Clock,
    Search,
    UserCheck,
    UserX,
    RotateCw,
    Calendar,
    MapPin,
    Building2,
    Sparkles,
    Copy,
    Check,
    Maximize2,
    ScanLine,
    Users,
} from "lucide-react";

import attendanceApi from "../../api/attendanceApi";
import organizationApi from "../../api/organizationApi";
import eventApi from "../../api/eventApi";
import "./attendance.css";

export default function AttendanceTracker() {
    // Dropdown Data
    const [organizations, setOrganizations] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState("");
    const [events, setEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState("");

    // Attendance Data & Filtering
    const [attendanceList, setAttendanceList] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Check-in Hub & Tabs
    const [activeTab, setActiveTab] = useState("camera"); // "camera" | "manual" | "kiosk"
    const [checkInCode, setCheckInCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [processingCheckIn, setProcessingCheckIn] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Camera Scanner
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const lastScannedRef = useRef("");

    // Modals
    const [selectedPassModal, setSelectedPassModal] = useState(null);
    const [passQrDataUrl, setPassQrDataUrl] = useState("");
    const [copiedToken, setCopiedToken] = useState(false);

    const [showEventKioskModal, setShowEventKioskModal] = useState(false);
    const [eventDoorQrUrl, setEventDoorQrUrl] = useState("");

    // Audio confirmation on scan
    const playSuccessBeep = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const audioCtx = new AudioContext();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = "sine";
            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
        } catch {
            // Audio context restricted or unavailable; safely ignore
        }
    };

    // Load Organizations on Mount
    useEffect(() => {
        const fetchOrgs = async () => {
            try {
                const res = await organizationApi.getOrganizations(1, 100);
                const items = res.items || [];
                setOrganizations(items);
                if (items.length > 0) {
                    setSelectedOrg(items[0].id);
                }
            } catch (err) {
                console.error("Failed to load organizations", err);
            }
        };
        fetchOrgs();
    }, []);

    // Load Events when Organization changes
    useEffect(() => {
        if (!selectedOrg) return;
        const fetchEvents = async () => {
            try {
                const res = await eventApi.getEvents(selectedOrg, 1, 100);
                const items = res.items || [];
                setEvents(items);
                if (items.length > 0) {
                    setSelectedEvent(items[0].id);
                } else {
                    setSelectedEvent("");
                    setAttendanceList([]);
                }
            } catch (err) {
                console.error("Failed to load events", err);
            }
        };
        fetchEvents();
    }, [selectedOrg]);

    // Current selected event object
    const currentEvent = events.find((ev) => ev.id === selectedEvent);

    // Load Attendance Records
    const loadAttendance = useCallback(async () => {
        if (!selectedEvent) {
            setAttendanceList([]);
            return;
        }
        setLoading(true);
        setError("");
        try {
            const data = await attendanceApi.getEventAttendance(selectedEvent);
            setAttendanceList(data.items || data || []);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                err.response?.data?.detail ||
                "Failed to load attendance list."
            );
        } finally {
            setLoading(false);
        }
    }, [selectedEvent]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadAttendance();
    }, [loadAttendance]);

    // Generate Event Door QR whenever current event changes
    useEffect(() => {
        if (!selectedEvent) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setEventDoorQrUrl("");
            return;
        }
        const generateDoorQr = async () => {
            try {
                const doorPayload = `${selectedEvent}:event_checkin`;
                const url = await QRCode.toDataURL(doorPayload, {
                    width: 360,
                    margin: 2,
                    color: { dark: "#0f172a", light: "#ffffff" },
                });
                setEventDoorQrUrl(url);
            } catch (err) {
                console.error("Failed to generate door QR code", err);
            }
        };
        generateDoorQr();
    }, [selectedEvent]);

    // Core Check-In Processor (handles codes, tokens, emails, and QR payloads)
    const processCheckIn = useCallback(async (tokenOrCode) => {
        const trimmed = (tokenOrCode || "").trim();
        if (!trimmed || !selectedEvent || processingCheckIn) return;

        setProcessingCheckIn(true);
        setError("");
        setSuccess("");

        try {
            const res = await attendanceApi.checkInByCode(selectedEvent, trimmed);
            playSuccessBeep();
            const participantName =
                res?.user?.full_name ||
                res?.user?.email ||
                (res?.user_id ? `User #${res.user_id}` : "Participant");

            setSuccess(`Check-in verified! ${participantName} marked as ATTENDED.`);
            setCheckInCode("");
            await loadAttendance();
        } catch (err) {
            setError(
                err.response?.data?.error?.message ||
                err.response?.data?.detail ||
                "Invalid QR code or unregistered check-in token."
            );
        } finally {
            setProcessingCheckIn(false);
        }
    }, [selectedEvent, processingCheckIn, loadAttendance]);

    // Manual Submit
    const handleManualSubmit = (e) => {
        e.preventDefault();
        processCheckIn(checkInCode);
    };

    // Live Camera Scanner loop with jsQR
    useEffect(() => {
        let animationFrameId;
        let stream = null;

        if (isCameraActive && videoRef.current) {
            setCameraError("");
            navigator.mediaDevices
                ?.getUserMedia({ video: { facingMode: "environment" } })
                .then((mediaStream) => {
                    stream = mediaStream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = mediaStream;
                        videoRef.current.play().catch(() => {});
                    }

                    const scanLoop = () => {
                        if (
                            videoRef.current &&
                            videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA
                        ) {
                            const canvas = canvasRef.current || document.createElement("canvas");
                            canvas.width = videoRef.current.videoWidth;
                            canvas.height = videoRef.current.videoHeight;
                            const ctx = canvas.getContext("2d", { willReadFrequently: true });
                            if (ctx) {
                                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                                const code = jsQR(imgData.data, imgData.width, imgData.height);
                                if (code && code.data) {
                                    if (code.data !== lastScannedRef.current) {
                                        lastScannedRef.current = code.data;
                                        setTimeout(() => {
                                            lastScannedRef.current = "";
                                        }, 3000);
                                        processCheckIn(code.data);
                                    }
                                }
                            }
                        }
                        animationFrameId = requestAnimationFrame(scanLoop);
                    };
                    animationFrameId = requestAnimationFrame(scanLoop);
                })
                .catch((err) => {
                    setCameraError(
                        err.message ||
                        "Unable to access camera. Please allow camera permissions or enter code manually."
                    );
                    setIsCameraActive(false);
                });
        }

        const currentVideo = videoRef.current;
        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (stream) {
                stream.getTracks().forEach((t) => t.stop());
            }
            if (currentVideo && currentVideo.srcObject) {
                const tracks = currentVideo.srcObject.getTracks?.() || [];
                tracks.forEach((t) => t.stop());
                currentVideo.srcObject = null;
            }
        };
    }, [isCameraActive, selectedEvent, processCheckIn]);

    // Handle Uploading an Image with a QR Code
    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, img.width, img.height);
                const imgData = ctx.getImageData(0, 0, img.width, img.height);
                const code = jsQR(imgData.data, imgData.width, imgData.height);
                if (code && code.data) {
                    processCheckIn(code.data);
                } else {
                    setError("No scannable QR code detected in the selected image. Please try a clearer picture.");
                }
            };
            img.src = uploadEvent.target.result;
        };
        reader.readAsDataURL(file);
    };

    // Toggle Attendance Status (Attended <-> No-Show)
    const handleToggleStatus = async (att) => {
        try {
            setError("");
            const nextStatus = att.status === "attended" ? "noshow" : "attended";
            await attendanceApi.updateAttendance(att.id, { status: nextStatus });
            const name = att.user?.full_name || att.user?.email || `User #${att.user_id}`;
            setSuccess(`Updated attendance status for ${name} to ${nextStatus.toUpperCase()}.`);
            loadAttendance();
        } catch {
            setError("Failed to update attendance status.");
        }
    };

    // Open Attendee QR Pass Modal
    const handleOpenPassModal = async (att) => {
        setSelectedPassModal(att);
        setCopiedToken(false);
        try {
            const payload = `${selectedEvent}:${att.user_id}`;
            const url = await QRCode.toDataURL(payload, {
                width: 320,
                margin: 2,
                color: { dark: "#0f172a", light: "#ffffff" },
            });
            setPassQrDataUrl(url);
        } catch (err) {
            console.error("Failed to generate attendee pass QR", err);
        }
    };

    // Download QR Code image
    const handleDownloadQr = (dataUrl, filename) => {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    // Export CSV
    const handleExportCsv = async () => {
        if (!selectedEvent) return;
        try {
            const blob = await attendanceApi.exportAttendanceCsv(selectedEvent);
            const url = window.URL.createObjectURL(new Blob([blob]));
            const a = document.createElement("a");
            a.href = url;
            const eventSlug = currentEvent?.title ? currentEvent.title.toLowerCase().replace(/[^a-z0-9]+/g, "_") : selectedEvent.slice(0, 8);
            a.download = `attendance_${eventSlug}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch {
            setError("Failed to export attendance CSV.");
        }
    };

    // Format timestamps
    const formatDateTime = (dateValue) => {
        if (!dateValue) return "-";
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // Filtered attendance list
    const filteredAttendance = attendanceList.filter((att) => {
        if (statusFilter !== "all" && att.status !== statusFilter) return false;
        if (!searchQuery.trim()) return true;

        const q = searchQuery.toLowerCase();
        const name = (att.user?.full_name || "").toLowerCase();
        const email = (att.user?.email || "").toLowerCase();
        const uid = String(att.user_id || "");
        return name.includes(q) || email.includes(q) || uid.includes(q);
    });

    // KPI Metrics
    const totalCount = attendanceList.length;
    const attendedCount = attendanceList.filter((a) => a.status === "attended").length;
    const registeredCount = attendanceList.filter((a) => a.status === "registered").length;
    const noshowCount = attendanceList.filter((a) => a.status === "noshow").length;
    const pendingCount = registeredCount + noshowCount;
    const turnoutRate = totalCount > 0 ? ((attendedCount / totalCount) * 100).toFixed(1) : 0;

    return (
        <div className="attendance-page-container">
            {/* Header */}
            <div className="attendance-header">
                <div className="attendance-header-left">
                    <div className="attendance-header-icon">
                        <QrCode size={28} />
                    </div>
                    <div>
                        <h1 className="attendance-title">Attendance Tracking & QR Check-In</h1>
                        <p className="attendance-subtitle">
                            Fast participant check-in, live QR verification, attendee passes, and CSV export.
                        </p>
                    </div>
                </div>

                <div className="attendance-header-actions">
                    <button
                        type="button"
                        onClick={loadAttendance}
                        className="btn btn-secondary btn-sm"
                        disabled={loading}
                        title="Refresh records"
                    >
                        <RotateCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
                    </button>

                    {selectedEvent && (
                        <>
                            <button
                                type="button"
                                onClick={() => setShowEventKioskModal(true)}
                                className="btn btn-secondary btn-sm"
                                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                            >
                                <QrCode size={14} /> Event Door Signage
                            </button>

                            <button
                                type="button"
                                onClick={handleExportCsv}
                                className="btn btn-primary btn-sm"
                                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                            >
                                <Download size={14} /> Export CSV
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Notifications */}
            {success && (
                <div className="alert alert-success" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <CheckCircle2 size={18} />
                    <span>{success}</span>
                </div>
            )}
            {error && (
                <div className="alert alert-danger" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <XCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* Context Selectors Card */}
            <div className="attendance-context-card">
                <div className="context-selectors-row">
                    <div className="context-group">
                        <span className="context-label">
                            <Building2 size={15} /> Organization:
                        </span>
                        <select
                            value={selectedOrg}
                            onChange={(e) => setSelectedOrg(e.target.value)}
                            className="context-select"
                        >
                            {organizations.map((org) => (
                                <option key={org.id} value={org.id}>
                                    {org.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="context-group">
                        <span className="context-label">
                            <Calendar size={15} /> Event:
                        </span>
                        <select
                            value={selectedEvent}
                            onChange={(e) => setSelectedEvent(e.target.value)}
                            className="context-select"
                            disabled={events.length === 0}
                        >
                            {events.length === 0 ? (
                                <option value="">No events found for this organization</option>
                            ) : (
                                events.map((ev) => (
                                    <option key={ev.id} value={ev.id}>
                                        {ev.title || ev.name} ({ev.status})
                                    </option>
                                ))
                            )}
                        </select>
                    </div>
                </div>

                {/* Event Summary Details */}
                {currentEvent && (
                    <div className="event-meta-banner">
                        <div className="event-meta-item">
                            <Calendar size={14} style={{ color: "var(--primary)" }} />
                            <span>{formatDateTime(currentEvent.starts_at)} – {formatDateTime(currentEvent.ends_at)}</span>
                        </div>
                        <div className="event-meta-item">
                            <MapPin size={14} style={{ color: "#ef4444" }} />
                            <span>{currentEvent.location || "Online / TBD"}</span>
                        </div>
                        <div className="event-meta-item">
                            <Users size={14} style={{ color: "#059669" }} />
                            <span>Capacity: {currentEvent.capacity || "Unlimited"}</span>
                        </div>
                        <span className={`event-status-pill badge-${currentEvent.status}`}>
                            ● {currentEvent.status}
                        </span>
                    </div>
                )}
            </div>

            {/* KPI Overview Ribbon */}
            <div className="attendance-kpi-grid">
                <div className="attendance-kpi-card">
                    <div className="kpi-icon-wrapper" style={{ background: "#eff6ff", color: "#2563eb" }}>
                        <Users size={22} />
                    </div>
                    <div className="kpi-info">
                        <span className="kpi-label">Total Registered</span>
                        <div className="kpi-value">{totalCount}</div>
                        <span className="kpi-subtext" style={{ color: "#2563eb" }}>
                            Confirmed Attendees
                        </span>
                    </div>
                </div>

                <div className="attendance-kpi-card">
                    <div className="kpi-icon-wrapper" style={{ background: "#ecfdf5", color: "#059669" }}>
                        <UserCheck size={22} />
                    </div>
                    <div className="kpi-info">
                        <span className="kpi-label">Checked In</span>
                        <div className="kpi-value">{attendedCount}</div>
                        <span className="kpi-subtext" style={{ color: "#059669" }}>
                            Verified On-Site
                        </span>
                    </div>
                </div>

                <div className="attendance-kpi-card">
                    <div className="kpi-icon-wrapper" style={{ background: "#fffbeb", color: "#d97706" }}>
                        <Clock size={22} />
                    </div>
                    <div className="kpi-info">
                        <span className="kpi-label">Pending / No-Show</span>
                        <div className="kpi-value">{pendingCount}</div>
                        <span className="kpi-subtext" style={{ color: "#d97706" }}>
                            Awaiting Check-In
                        </span>
                    </div>
                </div>

                <div className="attendance-kpi-card">
                    <div className="kpi-icon-wrapper" style={{ background: "#f5f3ff", color: "#7c3aed" }}>
                        <Sparkles size={22} />
                    </div>
                    <div className="kpi-info">
                        <span className="kpi-label">Turnout Rate</span>
                        <div className="kpi-value">{turnoutRate}%</div>
                        <div className="kpi-progress-bar">
                            <div className="kpi-progress-fill" style={{ width: `${turnoutRate}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Workspace Layout */}
            <div className="attendance-main-grid">
                {/* Left Card: QR & Check-In Hub */}
                <div className="checkin-hub-card">
                    <div className="hub-header">
                        <h3 className="hub-title">
                            <ScanLine size={18} style={{ color: "var(--primary)" }} />
                            Check-In & QR Scanner Hub
                        </h3>
                        <p className="hub-subtitle">
                            Scan attendee QR passes, enter tokens, or preview the event door signage.
                        </p>
                    </div>

                    {/* Mode Tabs */}
                    <div className="hub-tabs">
                        <button
                            type="button"
                            onClick={() => { setActiveTab("camera"); setIsCameraActive(true); }}
                            className={`hub-tab-btn ${activeTab === "camera" ? "active" : ""}`}
                        >
                            <Camera size={14} /> Live Camera
                        </button>
                        <button
                            type="button"
                            onClick={() => { setActiveTab("manual"); setIsCameraActive(false); }}
                            className={`hub-tab-btn ${activeTab === "manual" ? "active" : ""}`}
                        >
                            <Search size={14} /> Manual Token
                        </button>
                        <button
                            type="button"
                            onClick={() => { setActiveTab("kiosk"); setIsCameraActive(false); }}
                            className={`hub-tab-btn ${activeTab === "kiosk" ? "active" : ""}`}
                        >
                            <QrCode size={14} /> Door QR Sign
                        </button>
                    </div>

                    <div className="hub-tab-content">
                        {/* Tab 1: Camera Scanner */}
                        {activeTab === "camera" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                <div className="scanner-viewport-wrapper">
                                    {isCameraActive ? (
                                        <>
                                            <video ref={videoRef} className="scanner-video" playsInline />
                                            <div className="scanner-overlay">
                                                <div className="scanner-target-box">
                                                    <span className="scanner-corner tl" />
                                                    <span className="scanner-corner tr" />
                                                    <span className="scanner-corner bl" />
                                                    <span className="scanner-corner br" />
                                                    <div className="scan-laser" />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.7)", padding: "20px" }}>
                                            <Camera size={44} style={{ margin: "0 auto 10px", opacity: 0.5 }} />
                                            <p style={{ fontSize: "13px", margin: 0, fontWeight: 600 }}>Camera is Currently Inactive</p>
                                            <p style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.4)", margin: "4px 0 14px" }}>
                                                Click start to activate your webcam or phone camera.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => setIsCameraActive(true)}
                                                className="btn btn-primary btn-sm"
                                            >
                                                Start Camera Scanner
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {cameraError && (
                                    <div className="alert alert-danger" style={{ fontSize: "12px", padding: "8px 12px" }}>
                                        {cameraError}
                                    </div>
                                )}

                                {isCameraActive && (
                                    <div className="scanner-controls-bar">
                                        <span style={{ fontSize: "12px", color: "#10b981", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}>
                                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                                            Scanning Live...
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setIsCameraActive(false)}
                                            className="btn btn-secondary btn-sm"
                                        >
                                            Pause Camera
                                        </button>
                                    </div>
                                )}

                                {/* Image Upload Scanner Fallback */}
                                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
                                    <label className="qr-upload-dropzone">
                                        <UploadCloud size={24} style={{ color: "var(--primary)" }} />
                                        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-main)" }}>
                                            Upload / Drop QR Code Image
                                        </span>
                                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                            Supports PNG, JPG, or screenshot files
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            style={{ display: "none" }}
                                        />
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Tab 2: Manual Code / Token Entry */}
                        {activeTab === "manual" && (
                            <form onSubmit={handleManualSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                <div>
                                    <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)", display: "block", marginBottom: "6px" }}>
                                        Check-In Token, Email, or User ID
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. participant@collab.com or User #5"
                                        value={checkInCode}
                                        onChange={(e) => setCheckInCode(e.target.value)}
                                        className="search-input"
                                        style={{ width: "100%" }}
                                        autoFocus
                                    />
                                    <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "6px 0 0" }}>
                                        Accepts attendee email, numeric user ID, registration UUID, or QR string.
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={!selectedEvent || !checkInCode.trim() || processingCheckIn}
                                    className="btn btn-primary"
                                    style={{ width: "100%", justifyContent: "center" }}
                                >
                                    {processingCheckIn ? "Verifying Token..." : "Verify & Check In"}
                                </button>

                                {/* Quick Pending Attendee Chips */}
                                {registeredCount > 0 && (
                                    <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>
                                            Quick Fill Pending Attendees:
                                        </span>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                            {attendanceList
                                                .filter((a) => a.status !== "attended")
                                                .slice(0, 4)
                                                .map((att) => (
                                                    <button
                                                        key={att.id}
                                                        type="button"
                                                        onClick={() => setCheckInCode(att.user?.email || String(att.user_id))}
                                                        className="btn btn-secondary btn-sm"
                                                        style={{ fontSize: "11px", padding: "3px 8px" }}
                                                    >
                                                        {att.user?.full_name || att.user?.email || `User #${att.user_id}`}
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </form>
                        )}

                        {/* Tab 3: Event Door QR Signage */}
                        {activeTab === "kiosk" && (
                            <div className="door-qr-preview-box">
                                <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--text-main)" }}>
                                    Self Check-In Event QR Code
                                </span>
                                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                                    Display or project this QR code at the event entrance so participants can check in.
                                </p>

                                {eventDoorQrUrl ? (
                                    <div className="door-qr-image-container">
                                        <img
                                            src={eventDoorQrUrl}
                                            alt="Event Door QR Code"
                                            style={{ width: "180px", height: "180px", display: "block" }}
                                        />
                                    </div>
                                ) : (
                                    <div style={{ padding: "40px", color: "var(--text-muted)" }}>
                                        Generating Door QR...
                                    </div>
                                )}

                                <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowEventKioskModal(true)}
                                        className="btn btn-secondary btn-sm"
                                        style={{ flex: 1, justifyContent: "center" }}
                                    >
                                        <Maximize2 size={13} /> Fullscreen
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDownloadQr(eventDoorQrUrl, `door_qr_${selectedEvent.slice(0, 8)}.png`)}
                                        className="btn btn-primary btn-sm"
                                        style={{ flex: 1, justifyContent: "center" }}
                                    >
                                        <Download size={13} /> Download
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Card: Real-Time Attendance Directory */}
                <div className="records-card">
                    <div className="records-header">
                        <div>
                            <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
                                Participant Attendance Directory ({filteredAttendance.length})
                            </h3>
                            <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "4px 0 0" }}>
                                Live verification status, attendee QR tickets, and check-in history.
                            </p>
                        </div>

                        {/* Search & Status Filters */}
                        <div className="records-filter-toolbar">
                            <div className="records-search-box">
                                <Search size={14} style={{ color: "var(--text-muted)" }} />
                                <input
                                    type="text"
                                    placeholder="Search attendees..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="status-filter-pills">
                                {["all", "attended", "registered", "noshow"].map((status) => (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => setStatusFilter(status)}
                                        className={`status-pill-btn ${statusFilter === status ? "active" : ""}`}
                                    >
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Table View */}
                    {loading ? (
                        <div style={{ padding: "60px", textAlign: "center" }}>
                            <span className="spinner" />
                            <p style={{ marginTop: "12px", color: "var(--text-muted)", fontSize: "13.5px" }}>
                                Synchronizing attendance records...
                            </p>
                        </div>
                    ) : filteredAttendance.length === 0 ? (
                        <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                            <Users size={40} style={{ margin: "0 auto 10px", opacity: 0.3 }} />
                            <p style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>No matching attendance records found</p>
                            <p style={{ fontSize: "12.5px", margin: "4px 0 0" }}>
                                {attendanceList.length === 0
                                    ? "No participants have registered for this event yet."
                                    : "Try adjusting your search query or filter."}
                            </p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Participant</th>
                                        <th>Check-In Status</th>
                                        <th>Check-In Time</th>
                                        <th>QR Ticket Pass</th>
                                        <th style={{ textAlign: "right", paddingRight: "20px" }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAttendance.map((att) => {
                                        const displayName = att.user?.full_name || (att.user_id ? `User #${att.user_id}` : "Attendee");
                                        const email = att.user?.email || "";
                                        const initials = displayName.slice(0, 2).toUpperCase();

                                        return (
                                            <tr key={att.id}>
                                                {/* Participant Details */}
                                                <td>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                        <div
                                                            className="participant-avatar"
                                                            style={{
                                                                background: att.status === "attended" ? "#ecfdf5" : "#eff6ff",
                                                                color: att.status === "attended" ? "#059669" : "#2563eb",
                                                            }}
                                                        >
                                                            {initials}
                                                        </div>
                                                        <div className="participant-info">
                                                            <span className="participant-name">{displayName}</span>
                                                            {email && <span className="participant-email">{email}</span>}
                                                            <span className="participant-id-chip">UID: #{att.user_id}</span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Status Badge */}
                                                <td>
                                                    <span className={`badge badge-${att.status}`} style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                                        {att.status === "attended" && <CheckCircle2 size={12} />}
                                                        {att.status === "registered" && <Clock size={12} />}
                                                        {att.status === "noshow" && <UserX size={12} />}
                                                        {att.status.charAt(0).toUpperCase() + att.status.slice(1)}
                                                    </span>
                                                </td>

                                                {/* Timestamp */}
                                                <td style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                                                    {att.check_in_time ? formatDateTime(att.check_in_time) : "—"}
                                                </td>

                                                {/* Visual QR Code Ticket Pass Button */}
                                                <td>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenPassModal(att)}
                                                        className="btn btn-secondary btn-sm"
                                                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px" }}
                                                    >
                                                        <QrCode size={13} style={{ color: "var(--primary)" }} /> View QR Pass
                                                    </button>
                                                </td>

                                                {/* Actions */}
                                                <td style={{ textAlign: "right", paddingRight: "20px" }}>
                                                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleStatus(att)}
                                                            className={`btn btn-sm ${att.status === "attended" ? "btn-secondary" : "btn-primary"}`}
                                                            style={{ fontSize: "11.5px" }}
                                                            title="Toggle Attendance Status"
                                                        >
                                                            {att.status === "attended" ? "Mark No-Show" : "Check In"}
                                                        </button>

                                                        {/* One-click Scan Simulation */}
                                                        <button
                                                            type="button"
                                                            onClick={() => processCheckIn(`${selectedEvent}:${att.user_id}`)}
                                                            className="btn btn-secondary btn-sm"
                                                            style={{ fontSize: "11px", padding: "4px 8px" }}
                                                            title="Simulate scanning this attendee's QR code"
                                                        >
                                                            ⚡ Scan QR
                                                        </button>
                                                    </div>
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

            {/* Attendee QR Ticket / Badge Modal */}
            {selectedPassModal && (
                <div className="modal-overlay" onClick={() => setSelectedPassModal(null)}>
                    <div className="ticket-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="ticket-header">
                            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.85, display: "block" }}>
                                Official Event Ticket & Check-In Pass
                            </span>
                            <h2 style={{ fontSize: "18px", fontWeight: 800, margin: "6px 0 0", color: "#ffffff" }}>
                                {currentEvent?.title || "Summit Conference"}
                            </h2>
                            <p style={{ fontSize: "12px", opacity: 0.9, margin: "4px 0 0" }}>
                                {currentEvent?.location || "Event Hall"} • {formatDateTime(currentEvent?.starts_at)}
                            </p>
                        </div>

                        <div className="ticket-body">
                            <div>
                                <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
                                    {selectedPassModal.user?.full_name || `Attendee #${selectedPassModal.user_id}`}
                                </h3>
                                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                                    {selectedPassModal.user?.email || "Registered Attendee"}
                                </p>
                            </div>

                            {/* Scannable QR Code */}
                            <div className="ticket-qr-frame">
                                {passQrDataUrl ? (
                                    <img
                                        src={passQrDataUrl}
                                        alt="Attendee QR Pass"
                                        style={{ width: "200px", height: "200px", display: "block" }}
                                    />
                                ) : (
                                    <div style={{ width: "200px", height: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        Generating pass...
                                    </div>
                                )}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-primary)", padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", width: "100%", justifyContent: "space-between" }}>
                                <code style={{ fontSize: "11px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    Token: {selectedEvent}:{selectedPassModal.user_id}
                                </code>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${selectedEvent}:${selectedPassModal.user_id}`);
                                        setCopiedToken(true);
                                        setTimeout(() => setCopiedToken(false), 2000);
                                    }}
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: "2px 8px", fontSize: "11px" }}
                                >
                                    {copiedToken ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                                    {copiedToken ? "Copied" : "Copy"}
                                </button>
                            </div>

                            <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                                <button
                                    type="button"
                                    onClick={() => handleDownloadQr(passQrDataUrl, `pass_${selectedPassModal.user_id}.png`)}
                                    className="btn btn-primary"
                                    style={{ flex: 1, justifyContent: "center" }}
                                >
                                    <Download size={14} /> Download Pass (PNG)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPassModal(null)}
                                    className="btn btn-secondary"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Event Door Kiosk Modal */}
            {showEventKioskModal && (
                <div className="modal-overlay" onClick={() => setShowEventKioskModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px", textAlign: "center", padding: "32px 24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                            <div style={{ textAlign: "left" }}>
                                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--primary)" }}>
                                    Venue Entrance Kiosk
                                </span>
                                <h3 style={{ fontSize: "18px", fontWeight: 800, margin: "2px 0 0" }}>
                                    {currentEvent?.title || "Event Check-In"}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowEventKioskModal(false)}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                            >
                                <XCircle size={22} />
                            </button>
                        </div>

                        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 20px" }}>
                            Scan this QR code with any mobile camera at the venue reception to complete check-in.
                        </p>

                        <div style={{ display: "inline-block", padding: "16px", background: "#ffffff", borderRadius: "16px", border: "1px solid var(--border-color)", boxShadow: "0 6px 20px rgba(0,0,0,0.08)" }}>
                            <img
                                src={eventDoorQrUrl}
                                alt="Event Door QR Poster"
                                style={{ width: "240px", height: "240px", display: "block" }}
                            />
                        </div>

                        <div style={{ marginTop: "24px", display: "flex", gap: "10px", justifyContent: "center" }}>
                            <button
                                type="button"
                                onClick={() => handleDownloadQr(eventDoorQrUrl, `door_sign_${selectedEvent.slice(0, 8)}.png`)}
                                className="btn btn-primary"
                            >
                                <Download size={14} /> Download High-Res Sign (PNG)
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowEventKioskModal(false)}
                                className="btn btn-secondary"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
