import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="loading-container" style={{ padding: "60px", textAlign: "center" }}>
                <span className="spinner" />
                <p style={{ marginTop: "12px", color: "var(--text-muted)" }}>Checking authentication...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                state={{ from: location }}
                replace
            />
        );
    }

    return children ? children : <Outlet />;
}
