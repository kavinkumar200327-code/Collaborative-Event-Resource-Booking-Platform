import React, { useState, useRef, useEffect } from "react";
import { Sun, Moon, SunMoon, Monitor, Clock, Check, ChevronDown } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
    const { themeMode, resolvedTheme, setThemeMode, scheduleInfo } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Close on Escape key
    useEffect(() => {
        function handleKeyDown(event) {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    const getModeIcon = () => {
        if (themeMode === "auto") {
            return <SunMoon size={15} className="theme-toggle-icon" />;
        }
        if (themeMode === "light") {
            return <Sun size={15} className="theme-toggle-icon" style={{ color: "#f59e0b" }} />;
        }
        if (themeMode === "dark") {
            return <Moon size={15} className="theme-toggle-icon" style={{ color: "#818cf8" }} />;
        }
        return <Monitor size={15} className="theme-toggle-icon" />;
    };

    const getPillLabel = () => {
        if (themeMode === "auto") {
            return `Auto (${resolvedTheme === "light" ? "Day" : "Night"})`;
        }
        if (themeMode === "light") return "Light";
        if (themeMode === "dark") return "Dark";
        return "System";
    };

    return (
        <div style={{ position: "relative" }} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="theme-toggle-pill"
                title={`${scheduleInfo.remainingTimeText} · Click to customize theme`}
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {getModeIcon()}
                    <span className="theme-toggle-label">{getPillLabel()}</span>
                </div>
                <ChevronDown size={12} style={{ opacity: 0.6 }} />
            </button>

            {isOpen && (
                <div className="theme-dropdown-menu" role="menu">
                    {/* Header info with real-time clock */}
                    <div className="theme-dropdown-header">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                                Appearance & Schedule
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11.5px", fontWeight: 600, color: "var(--primary)" }}>
                                <Clock size={12} />
                                <span>{scheduleInfo.currentLocalTimeText}</span>
                            </div>
                        </div>

                        {/* Automatic Time Schedule Status */}
                        <div className="theme-schedule-banner">
                            <span style={{ fontWeight: 700, display: "block", color: "var(--text-main)" }}>
                                Automatic Time Calculator
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginTop: "2px" }}>
                                {scheduleInfo.remainingTimeText}
                            </span>
                        </div>
                    </div>

                    {/* Mode Select Options */}
                    <div style={{ padding: "6px" }}>
                        {/* Auto Mode */}
                        <button
                            type="button"
                            onClick={() => {
                                setThemeMode("auto");
                                setIsOpen(false);
                            }}
                            className={`theme-option-item ${themeMode === "auto" ? "active" : ""}`}
                            role="menuitem"
                        >
                            <div className="theme-option-left">
                                <div className="theme-option-icon-box" style={{ background: "rgba(99, 102, 241, 0.12)", color: "#6366f1" }}>
                                    <SunMoon size={16} />
                                </div>
                                <div>
                                    <div className="theme-option-title">
                                        Auto (Time-based)
                                        <span className="theme-recommended-tag">Recommended</span>
                                    </div>
                                    <div className="theme-option-desc">
                                        6 AM – 6 PM Light · 6 PM – 6 AM Dark
                                    </div>
                                </div>
                            </div>
                            {themeMode === "auto" && <Check size={16} className="theme-check-icon" />}
                        </button>

                        {/* Light Mode */}
                        <button
                            type="button"
                            onClick={() => {
                                setThemeMode("light");
                                setIsOpen(false);
                            }}
                            className={`theme-option-item ${themeMode === "light" ? "active" : ""}`}
                            role="menuitem"
                        >
                            <div className="theme-option-left">
                                <div className="theme-option-icon-box" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" }}>
                                    <Sun size={16} />
                                </div>
                                <div>
                                    <div className="theme-option-title">Light Mode</div>
                                    <div className="theme-option-desc">
                                        Crisp daylight surface and high contrast
                                    </div>
                                </div>
                            </div>
                            {themeMode === "light" && <Check size={16} className="theme-check-icon" />}
                        </button>

                        {/* Dark Mode */}
                        <button
                            type="button"
                            onClick={() => {
                                setThemeMode("dark");
                                setIsOpen(false);
                            }}
                            className={`theme-option-item ${themeMode === "dark" ? "active" : ""}`}
                            role="menuitem"
                        >
                            <div className="theme-option-left">
                                <div className="theme-option-icon-box" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8" }}>
                                    <Moon size={16} />
                                </div>
                                <div>
                                    <div className="theme-option-title">Dark Mode</div>
                                    <div className="theme-option-desc">
                                        Deep obsidian theme for night & low light
                                    </div>
                                </div>
                            </div>
                            {themeMode === "dark" && <Check size={16} className="theme-check-icon" />}
                        </button>

                        {/* System Preference */}
                        <button
                            type="button"
                            onClick={() => {
                                setThemeMode("system");
                                setIsOpen(false);
                            }}
                            className={`theme-option-item ${themeMode === "system" ? "active" : ""}`}
                            role="menuitem"
                        >
                            <div className="theme-option-left">
                                <div className="theme-option-icon-box" style={{ background: "rgba(100, 116, 139, 0.12)", color: "#64748b" }}>
                                    <Monitor size={16} />
                                </div>
                                <div>
                                    <div className="theme-option-title">System Sync</div>
                                    <div className="theme-option-desc">
                                        Matches your operating system preference
                                    </div>
                                </div>
                            </div>
                            {themeMode === "system" && <Check size={16} className="theme-check-icon" />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
