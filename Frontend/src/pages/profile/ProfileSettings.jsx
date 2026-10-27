import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import userApi from "../../api/userApi";
import { User, KeyRound, ShieldCheck, AlertCircle } from "lucide-react";

export default function ProfileSettings() {
    const { user, updateCurrentUser } = useAuth();
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (newPassword.length < 8) {
            setError("New password must be at least 8 characters long.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("New password and confirmation do not match.");
            return;
        }

        setLoading(true);
        try {
            await userApi.changePassword({
                old_password: oldPassword,
                new_password: newPassword,
            });
            setSuccess("Password updated successfully!");
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            setError(err.response?.data?.error?.message || err.response?.data?.detail || "Failed to update password.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="profile-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Profile & Security Settings</h1>
                    <p className="page-subtitle">
                        Manage your user credentials, security keys, and access credentials.
                    </p>
                </div>
            </div>

            {success && <div className="alert alert-success">{success}</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                {/* User Details */}
                <div className="card">
                    <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <User size={18} /> Account Profile
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px" }}>
                        <div>
                            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "12px" }}>User ID</span>
                            <strong style={{ fontFamily: "monospace" }}>{user?.id}</strong>
                        </div>
                        <div>
                            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "12px" }}>Full Name</span>
                            <strong>{user?.full_name || "N/A"}</strong>
                        </div>
                        <div>
                            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "12px" }}>Email Address</span>
                            <strong>{user?.email}</strong>
                        </div>
                        <div>
                            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "12px" }}>System Role</span>
                            <span className="badge badge-published" style={{ textTransform: "capitalize" }}>
                                {user?.role || "Member"}
                            </span>
                        </div>
                        <div>
                            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "12px" }}>Account Status</span>
                            <span className="badge badge-confirmed">Active</span>
                        </div>
                    </div>
                </div>

                {/* Change Password */}
                <div className="card">
                    <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <KeyRound size={18} /> Change Password
                    </h3>
                    <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div>
                            <label style={{ fontSize: "13px", fontWeight: 600 }}>Current Password</label>
                            <input
                                type="password"
                                required
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                className="search-input"
                                style={{ width: "100%", marginTop: "4px" }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: "13px", fontWeight: 600 }}>New Password (min 8 chars)</label>
                            <input
                                type="password"
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="search-input"
                                style={{ width: "100%", marginTop: "4px" }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: "13px", fontWeight: 600 }}>Confirm New Password</label>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="search-input"
                                style={{ width: "100%", marginTop: "4px" }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary"
                            style={{ marginTop: "8px" }}
                        >
                            {loading ? "Updating..." : "Update Password"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
