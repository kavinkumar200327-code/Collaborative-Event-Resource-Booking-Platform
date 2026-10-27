import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    Outlet,
    Link,
} from "react-router-dom";

import ProtectedRoute from "./routes/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

// Pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/dashboard/Dashboard";
import OrganizationList from "./pages/organizations/OrganizationList";
import OrganizationDetails from "./pages/organizations/OrganizationDetails";
import OrganizationForm from "./pages/organizations/OrganizationForm";
import EventList from "./pages/events/EventList";
import EventForm from "./pages/events/EventForm";
import EventDetails from "./pages/events/EventDetails";
import CalendarView from "./pages/calendar/CalendarView";
import ResourceList from "./pages/resources/ResourceList";
import BookingList from "./pages/bookings/BookingList";
import MyRegistrations from "./pages/registrations/MyRegistrations";
import AttendanceTracker from "./pages/attendance/AttendanceTracker";
import NotificationCenter from "./pages/notifications/NotificationCenter";
import ProfileSettings from "./pages/profile/ProfileSettings";

function AppLayout() {
    return (
        <div className="app-container">
            <Sidebar />
            <div className="app-main-wrapper">
                <Header />
                <main className="app-content">
                    <Outlet />
                </main>
                <footer className="app-footer">
                    Collaborative Event & Resource Booking Platform &copy; {new Date().getFullYear()} — Enterprise Production System
                </footer>
            </div>
        </div>
    );
}

function NotFound() {
    return (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <h1 style={{ fontSize: "48px", fontWeight: "bold", color: "var(--text-main)" }}>404</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "16px", marginBottom: "20px" }}>
                The page you requested could not be found.
            </p>
            <Link to="/dashboard" className="btn btn-primary">
                Return to Dashboard
            </Link>
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public Auth Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected Dashboard & App Routes */}
                <Route
                    element={
                        <ProtectedRoute>
                            <AppLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />

                    {/* Organizations */}
                    <Route path="/organizations" element={<OrganizationList />} />
                    <Route path="/organizations/create" element={<OrganizationForm />} />
                    <Route path="/organizations/:organizationId" element={<OrganizationDetails />} />
                    <Route path="/organizations/:organizationId/edit" element={<OrganizationForm />} />
                    <Route path="/organizations/:organizationId/events" element={<EventList />} />
                    <Route path="/organizations/:organizationId/events/create" element={<EventForm />} />
                    <Route path="/organizations/:organizationId/events/:eventId" element={<EventDetails />} />
                    <Route path="/organizations/:organizationId/events/:eventId/edit" element={<EventForm />} />

                    {/* Events Top-Level */}
                    <Route path="/events" element={<EventList />} />
                    <Route path="/events/:eventId" element={<EventDetails />} />

                    {/* Features */}
                    <Route path="/calendar" element={<CalendarView />} />
                    <Route path="/resources" element={<ResourceList />} />
                    <Route path="/bookings" element={<BookingList />} />
                    <Route path="/my-registrations" element={<MyRegistrations />} />
                    <Route path="/attendance-checkin" element={<AttendanceTracker />} />
                    <Route path="/notifications" element={<NotificationCenter />} />
                    <Route path="/settings" element={<ProfileSettings />} />
                </Route>

                <Route path="*" element={<NotFound />} />
            </Routes>
        </BrowserRouter>
    );
}
