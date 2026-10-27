
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import "./Auth.css";


export default function Register() {
    const { register, isLoading } = useAuth();

    const navigate = useNavigate();

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");

        if (fullName.trim().length < 2) {
            setError("Full name must contain at least 2 characters.");
            return;
        }

        if (password.length < 8) {
            setError("Password must contain at least 8 characters.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        try {
            await register({
                full_name: fullName.trim(),
                email: email.trim(),
                password,
            });

            navigate("/login", {
                replace: true,
                state: {
                    message: "Registration successful. Please log in.",
                    email: email.trim(),
                },
            });
        } catch (err) {
            const detail = err.response?.data?.detail;

            setError(
                typeof detail === "string"
                    ? detail
                    : Array.isArray(detail)
                        ? detail.map((item) => item.msg).join(", ")
                        : "Unable to create your account. Please try again."
            );
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>Create Account</h1>

                    <p>
                        Join your team to organize events, manage resources,
                        and coordinate bookings.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="full_name">
                            Full Name
                        </label>

                        <input
                            id="full_name"
                            name="full_name"
                            type="text"
                            placeholder="Enter your full name"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            autoComplete="name"
                            minLength={2}
                            maxLength={150}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">
                            Email Address
                        </label>

                        <input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="Enter your email address"
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
                            name="password"
                            type="password"
                            placeholder="Create a password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            autoComplete="new-password"
                            minLength={8}
                            maxLength={128}
                            required
                        />

                        <small>
                            Use at least 8 characters.
                        </small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirm_password">
                            Confirm Password
                        </label>

                        <input
                            id="confirm_password"
                            name="confirm_password"
                            type="password"
                            placeholder="Re-enter your password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            autoComplete="new-password"
                            minLength={8}
                            maxLength={128}
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
                        {isLoading ? "Creating Account..." : "Create Account"}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        Already have an account?{" "}
                        <Link to="/login">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
