import { useState, useEffect, useMemo } from "react";
import calendarApi from "../../api/calendarApi";
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Clock,
    MapPin,
    Box,
    Layers,
    X,
} from "lucide-react";

export default function CalendarView() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState("month"); // 'month', 'week', 'day'
    const [filterType, setFilterType] = useState({
        event: true,
        session: true,
        booking: true,
    });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState(null);

    const fetchFeed = async () => {
        setLoading(true);
        try {
            const data = await calendarApi.getCalendarEvents();
            setItems(data.items || []);
        } catch (err) {
            console.error("Failed to load calendar events", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeed();
    }, []);

    // Filter items based on checkbox selection
    const filteredItems = useMemo(() => {
        return items.filter((item) => filterType[item.type]);
    }, [items, filterType]);

    // Navigation handlers
    const handlePrev = () => {
        const next = new Date(currentDate);
        if (viewMode === "month") next.setMonth(next.getMonth() - 1);
        else if (viewMode === "week") next.setDate(next.getDate() - 7);
        else next.setDate(next.getDate() - 1);
        setCurrentDate(next);
    };

    const handleNext = () => {
        const next = new Date(currentDate);
        if (viewMode === "month") next.setMonth(next.getMonth() + 1);
        else if (viewMode === "week") next.setDate(next.getDate() + 7);
        else next.setDate(next.getDate() + 1);
        setCurrentDate(next);
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    // Month view calculations
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();

    const calendarDays = useMemo(() => {
        const days = [];
        // Empty slots for previous month
        for (let i = 0; i < firstDayIndex; i++) {
            days.push({ dayNumber: null, isCurrentMonth: false });
        }
        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({
                dayNumber: i,
                date: new Date(year, month, i),
                isCurrentMonth: true,
            });
        }
        return days;
    }, [year, month, firstDayIndex, daysInMonth]);

    const getItemsForDate = (date) => {
        if (!date) return [];
        const dateStr = date.toISOString().split("T")[0];
        return filteredItems.filter((it) => {
            const itDateStr = new Date(it.start_time).toISOString().split("T")[0];
            return itDateStr === dateStr;
        });
    };

    const getTypeColor = (type) => {
        switch (type) {
            case "event": return { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" };
            case "session": return { bg: "#dcfce7", text: "#166534", border: "#86efac" };
            case "booking": return { bg: "#f3e8ff", text: "#6b21a8", border: "#d8b4fe" };
            default: return { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };
        }
    };

    return (
        <div className="calendar-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Master Calendar</h1>
                    <p className="page-subtitle">
                        Cross-organization schedule for events, breakout sessions, and resource bookings.
                    </p>
                </div>

                {/* View switcher */}
                <div style={{ display: "flex", gap: "8px", background: "var(--bg-surface)", padding: "4px", borderRadius: "var(--radius)", border: "1px solid var(--border-color)" }}>
                    <button
                        onClick={() => setViewMode("month")}
                        className={`btn btn-sm ${viewMode === "month" ? "btn-primary" : "btn-secondary"}`}
                    >
                        Month
                    </button>
                    <button
                        onClick={() => setViewMode("week")}
                        className={`btn btn-sm ${viewMode === "week" ? "btn-primary" : "btn-secondary"}`}
                    >
                        Week
                    </button>
                    <button
                        onClick={() => setViewMode("day")}
                        className={`btn btn-sm ${viewMode === "day" ? "btn-primary" : "btn-secondary"}`}
                    >
                        Day
                    </button>
                </div>
            </div>

            {/* Filter toolbar */}
            <div className="card" style={{ padding: "14px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                    {/* Controls */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button onClick={handlePrev} className="btn btn-secondary btn-sm" title="Previous">
                            <ChevronLeft size={16} />
                        </button>
                        <button onClick={handleToday} className="btn btn-secondary btn-sm">
                            Today
                        </button>
                        <button onClick={handleNext} className="btn btn-secondary btn-sm" title="Next">
                            <ChevronRight size={16} />
                        </button>

                        <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
                            {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric", ...(viewMode !== "month" ? { day: "numeric" } : {}) })}
                        </h2>
                    </div>

                    {/* Checkboxes */}
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "14px" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={filterType.event}
                                onChange={(e) => setFilterType({ ...filterType, event: e.target.checked })}
                            />
                            <span style={{ color: "#1e40af", fontWeight: 600 }}>● Events</span>
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={filterType.session}
                                onChange={(e) => setFilterType({ ...filterType, session: e.target.checked })}
                            />
                            <span style={{ color: "#166534", fontWeight: 600 }}>● Sessions</span>
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={filterType.booking}
                                onChange={(e) => setFilterType({ ...filterType, booking: e.target.checked })}
                            />
                            <span style={{ color: "#6b21a8", fontWeight: 600 }}>● Bookings</span>
                        </label>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: "60px", textAlign: "center" }}>
                    <span className="spinner" />
                    <p style={{ marginTop: "12px", color: "var(--text-muted)" }}>Loading schedule...</p>
                </div>
            ) : viewMode === "month" ? (
                /* Month Grid */
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-color)", textAlign: "center", fontWeight: 700, padding: "10px 0", fontSize: "13px", color: "var(--text-muted)" }}>
                        <div>SUN</div>
                        <div>MON</div>
                        <div>TUE</div>
                        <div>WED</div>
                        <div>THU</div>
                        <div>FRI</div>
                        <div>SAT</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", minHeight: "650px" }}>
                        {calendarDays.map((slot, index) => {
                            const dayItems = slot.isCurrentMonth ? getItemsForDate(slot.date) : [];
                            const isToday = slot.date && slot.date.toDateString() === new Date().toDateString();

                            return (
                                <div
                                    key={index}
                                    style={{
                                        borderRight: "1px solid var(--border-color)",
                                        borderBottom: "1px solid var(--border-color)",
                                        padding: "8px",
                                        background: slot.isCurrentMonth ? (isToday ? "var(--primary-light)" : "var(--bg-surface)") : "var(--bg-subtle)",
                                        minHeight: "110px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "4px",
                                    }}
                                >
                                    {slot.dayNumber && (
                                        <div style={{
                                            fontWeight: isToday ? 800 : 600,
                                            fontSize: "13px",
                                            color: isToday ? "var(--primary)" : "var(--text-main)",
                                            marginBottom: "4px",
                                        }}>
                                            {slot.dayNumber}
                                        </div>
                                    )}
                                    {dayItems.slice(0, 3).map((item) => {
                                        const c = getTypeColor(item.type);
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => setSelectedItem(item)}
                                                style={{
                                                    background: c.bg,
                                                    color: c.text,
                                                    border: `1px solid ${c.border}`,
                                                    borderRadius: "4px",
                                                    padding: "2px 6px",
                                                    fontSize: "11px",
                                                    fontWeight: 600,
                                                    cursor: "pointer",
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                }}
                                                title={`${item.title} (${item.type})`}
                                            >
                                                {item.title}
                                            </div>
                                        );
                                    })}
                                    {dayItems.length > 3 && (
                                        <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
                                            +{dayItems.length - 3} more
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* Week or Day List View */
                <div className="card">
                    <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>
                        Schedule for {viewMode === "day" ? currentDate.toLocaleDateString() : `Week of ${currentDate.toLocaleDateString()}`}
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {filteredItems.length === 0 ? (
                            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>No items scheduled for this period.</p>
                        ) : (
                            filteredItems.map((item) => {
                                const c = getTypeColor(item.type);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedItem(item)}
                                        style={{
                                            borderLeft: `4px solid ${c.border}`,
                                            background: "var(--bg-subtle)",
                                            borderRadius: "var(--radius)",
                                            padding: "14px 18px",
                                            cursor: "pointer",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{
                                                    textTransform: "uppercase",
                                                    fontSize: "10px",
                                                    fontWeight: 800,
                                                    padding: "2px 6px",
                                                    borderRadius: "4px",
                                                    background: c.bg,
                                                    color: c.text
                                                }}>
                                                    {item.type}
                                                </span>
                                                <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>{item.title}</h4>
                                            </div>
                                            <div style={{ display: "flex", gap: "16px", marginTop: "6px", fontSize: "13px", color: "var(--text-muted)" }}>
                                                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                    <Clock size={14} />
                                                    {new Date(item.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} - {new Date(item.end_time).toLocaleTimeString([], { timeStyle: 'short' })}
                                                </span>
                                                {item.location && (
                                                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                        <MapPin size={14} />
                                                        {item.location}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button className="btn btn-secondary btn-sm">Details</button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Modal for Item Details */}
            {selectedItem && (
                <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{
                                    textTransform: "uppercase",
                                    fontSize: "11px",
                                    fontWeight: 800,
                                    padding: "2px 8px",
                                    borderRadius: "4px",
                                    ...getTypeColor(selectedItem.type)
                                }}>
                                    {selectedItem.type}
                                </span>
                                <h3 style={{ margin: 0, fontSize: "18px" }}>{selectedItem.title}</h3>
                            </div>
                            <button onClick={() => setSelectedItem(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px" }}>
                            <div>
                                <strong style={{ color: "var(--text-muted)" }}>Time Window:</strong>
                                <p>{new Date(selectedItem.start_time).toLocaleString()} to {new Date(selectedItem.end_time).toLocaleString()}</p>
                            </div>
                            {selectedItem.location && (
                                <div>
                                    <strong style={{ color: "var(--text-muted)" }}>Location:</strong>
                                    <p>{selectedItem.location}</p>
                                </div>
                            )}
                            {selectedItem.status && (
                                <div>
                                    <strong style={{ color: "var(--text-muted)" }}>Status:</strong>
                                    <p><span className={`badge badge-${selectedItem.status}`}>{selectedItem.status}</span></p>
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
                            <button onClick={() => setSelectedItem(null)} className="btn btn-secondary">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
