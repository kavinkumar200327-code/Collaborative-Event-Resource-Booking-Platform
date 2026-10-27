
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";


export default function Login() {
    const { login, isLoading } = useAuth();

    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const redirectTo = location.state?.from?.pathname || "/dashboard";


    async function handleSubmit(event) {
        event.preventDefault();
        setError("");

        try {
            await login(email.trim(), password);

            navigate(redirectTo, { replace: true });
        } catch (err) {
            console.error("Login error:", err);
            const serverMsg =
                err.response?.data?.error?.message ||
                err.response?.data?.detail ||
                err.response?.data?.message;

            if (serverMsg) {
                setError(serverMsg);
            } else if (err.code === "ERR_NETWORK" || !err.response) {
                setError(
                    "Cannot connect to the backend server. Please ensure the FastAPI backend is running on http://127.0.0.1:8000."
                );
            } else {
                setError(
                    "Unable to log in. Please check your credentials and try again."
                );
            }
        }
    }


    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>Welcome Back</h1>

                    <p>
                        Sign in to manage your events, resources, and bookings.
                    </p>
                </div>


                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="email">
                            Email Address
                        </label>

                        <input
                            id="email"
                            type="email"
                            name="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            autoComplete="email"
                            required
                        />
                    </div>


                    <div className="form-group">
                        <label htmlFor="password">
                            Password
                        </label>

                        <input
                            id="password"
                            type="password"
                            name="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </div>


                    {error && (
                        <div className="error-message" role="alert">
                            {error}
                        </div>
                    )}


                    <button
                        type="submit"
                        className="auth-button"
                        disabled={isLoading}
                    >
                        {isLoading ? "Signing in..." : "Sign In"}
                    </button>
                </form>


                <div className="auth-footer">
                    <p>
                        Don't have an account?{" "}
                        <Link to="/register">
                            Create an account
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
