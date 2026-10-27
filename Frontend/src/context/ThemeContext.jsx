import React, { createContext, useContext, useEffect, useState, useMemo } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    // Mode can be: 'auto' (time-based), 'light', 'dark', 'system'
    const [themeMode, setThemeModeState] = useState(() => {
        try {
            return localStorage.getItem("collab_theme_mode") || "auto";
        } catch {
            return "auto";
        }
    });

    const [currentTime, setCurrentTime] = useState(new Date());

    // Update time every 30 seconds to accurately detect day/night transitions
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 30000);
        return () => clearInterval(timer);
    }, []);

    // Calculate resolved theme ('light' or 'dark') based on active mode
    const resolvedTheme = useMemo(() => {
        if (themeMode === "dark") return "dark";
        if (themeMode === "light") return "light";
        if (themeMode === "system") {
            if (typeof window !== "undefined" && window.matchMedia) {
                return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
            }
            return "light";
        }

        // Auto mode (Calculates user's local time: 6:00 AM (06:00) to 6:00 PM (18:00) is Day/Light, else Night/Dark)
        const hours = currentTime.getHours();
        const isDayTime = hours >= 6 && hours < 18;
        return isDayTime ? "light" : "dark";
    }, [themeMode, currentTime]);

    // Apply data-theme attribute on <html> and update meta tag
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", resolvedTheme);
        document.documentElement.style.colorScheme = resolvedTheme;

        let meta = document.querySelector('meta[name="color-scheme"]');
        if (meta) {
            meta.setAttribute("content", resolvedTheme);
        }
    }, [resolvedTheme]);

    // Listen to OS prefers-color-scheme changes when in system mode
    useEffect(() => {
        if (themeMode !== "system") return;
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = () => setCurrentTime(new Date());
        mediaQuery.addEventListener("change", handler);
        return () => mediaQuery.removeEventListener("change", handler);
    }, [themeMode]);

    const setThemeMode = (mode) => {
        setThemeModeState(mode);
        try {
            localStorage.setItem("collab_theme_mode", mode);
        } catch (e) {
            console.warn("Failed to persist theme preference:", e);
        }
    };

    // Calculate human-friendly status description
    const scheduleInfo = useMemo(() => {
        const hours = currentTime.getHours();
        const minutes = currentTime.getMinutes();
        const isDayTime = hours >= 6 && hours < 18;

        let nextChangeTime = new Date(currentTime);
        if (isDayTime) {
            // Next is 18:00 (6:00 PM) today
            nextChangeTime.setHours(18, 0, 0, 0);
        } else {
            // Next is 06:00 (6:00 AM) tomorrow if after 18:00, or today if after midnight
            if (hours >= 18) {
                nextChangeTime.setDate(nextChangeTime.getDate() + 1);
            }
            nextChangeTime.setHours(6, 0, 0, 0);
        }

        const diffMs = nextChangeTime - currentTime;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        const formattedDiff = diffHrs > 0
            ? `${diffHrs}h ${diffMins}m`
            : `${diffMins}m`;

        const targetMode = isDayTime ? "Dark Mode" : "Light Mode";
        const targetTimeLabel = isDayTime ? "6:00 PM" : "6:00 AM";

        return {
            isDayTime,
            targetMode,
            targetTimeLabel,
            remainingTimeText: `Switches to ${targetMode} at ${targetTimeLabel} (in ${formattedDiff})`,
            currentLocalTimeText: currentTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        };
    }, [currentTime]);

    return (
        <ThemeContext.Provider
            value={{
                themeMode,
                resolvedTheme,
                setThemeMode,
                currentTime,
                scheduleInfo,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}

export default ThemeContext;
