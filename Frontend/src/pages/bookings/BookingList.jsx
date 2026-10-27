import { useState, useEffect } from "react";
import bookingApi from "../../api/bookingApi";
import {
    BookmarkCheck,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    Filter,
} from "lucide-react";

export default function BookingList() {
    const [bookings, setBookings] = useState([]);
    const [statusFilter, setStatusFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const loadBookings = async () => {
        setLoading(true);
        setError("");
        try {
            const params = {};
            if (statusFilter) params.status = statusFilter;
            const data = await bookingApi.getBookings(params);
            setBookings(data.items || []);
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Failed to load bookings.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBookings();
    }, [statusFilter]);

    const handleApprove = async (id) => {
        try {
            await bookingApi.approveBooking(id);
            setSuccess("Booking approved successfully.");
            loadBookings();
        } catch (err) {
            setError(err.response?.data?.error?.message || "Failed to approve booking.");
        }
    };

    const handleReject = async (id) => {
        try {
            await bookingApi.rejectBooking(id);
            setSuccess("Booking rejected.");
            loadBookings();
        } catch (err) {
            setError(err.response?.data?.error?.message || "Failed to reject booking.");
        }
    };

    const handleCancel = async (id) => {
        try {
            await bookingApi.cancelBooking(id);
            setSuccess("Booking cancelled.");
            loadBookings();
        } catch (err) {
            setError(err.response?.data?.error?.message || "Failed to cancel booking.");
        }
    };

    return (
        <div className="bookings-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Resource Bookings</h1>
                    <p className="page-subtitle">
                        Review, approve, or cancel resource reservations with concurrency guarantees.
                    </p>
                </div>
            </div>

            {/* Filter toolbar */}
            <div className="card" style={{ padding: "12px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Filter size={16} style={{ color: "var(--text-muted)" }} />
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)" }}>Status Filter:</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="select-input"
                    >
                        <option value="">All Statuses</option>
                        <option value="requested">Requested</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
            </div>

            {success && <div className="alert alert-success">{success}</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
                <div style={{ padding: "60px", textAlign: "center" }}>
                    <span className="spinner" />
                    <p style={{ marginTop: "12px", color: "var(--text-muted)" }}>Loading bookings...</p>
                </div>
            ) : bookings.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "40px" }}>
                    <BookmarkCheck size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
                    <p style={{ color: "var(--text-muted)" }}>No bookings found for the selected filter.</p>
                </div>
            ) : (
                <div className="card">
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Booking ID</th>
                                    <th>Resource ID</th>
                                    <th>Purpose</th>
                                    <th>Schedule Window</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bookings.map((b) => (
                                    <tr key={b.id}>
                                        <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{b.id}</td>
                                        <td style={{ fontWeight: 600 }}>Resource #{b.resource_id}</td>
                                        <td>{b.purpose || "Resource Reservation"}</td>
                                        <td style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                                            {new Date(b.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} - {new Date(b.end_time).toLocaleTimeString([], { timeStyle: 'short' })}
                                        </td>
                                        <td>
                                            <span className={`badge badge-${b.status}`}>{b.status}</span>
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", gap: "6px" }}>
                                                {b.status === "requested" && (
                                                    <>
                                                        <button onClick={() => handleApprove(b.id)} className="btn btn-success btn-sm">
                                                            Approve
                                                        </button>
                                                        <button onClick={() => handleReject(b.id)} className="btn btn-danger btn-sm">
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                                {(b.status === "requested" || b.status === "approved") && (
                                                    <button onClick={() => handleCancel(b.id)} className="btn btn-secondary btn-sm">
                                                        Cancel
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
