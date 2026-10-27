import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import axiosClient, {
    clearAuthTokens,
    saveAuthTokens,
} from "../api/axiosClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem("auth_user");

        try {
            return savedUser ? JSON.parse(savedUser) : null;
        } catch {
            localStorage.removeItem("auth_user");
            return null;
        }
    });

    const [isLoading, setIsLoading] = useState(false);

    const [isAuthenticated, setIsAuthenticated] = useState(
        () => Boolean(
            localStorage.getItem("access_token") &&
            localStorage.getItem("auth_user"),
        ),
    );

    const updateUser = useCallback((userData) => {
        setUser(userData);

        if (userData) {
            localStorage.setItem(
                "auth_user",
                JSON.stringify(userData),
            );
        } else {
            localStorage.removeItem("auth_user");
        }
    }, []);

    const register = useCallback(async (userData) => {
        setIsLoading(true);

        try {
            const response = await axiosClient.post(
                "/auth/register",
                userData,
            );

            return response.data;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const login = useCallback(async (email, password) => {
        setIsLoading(true);

        try {
            const response = await axiosClient.post(
                "/auth/login",
                {
                    email,
                    password,
                },
            );

            const { user: userData, ...tokenData } = response.data;

            if (!tokenData.access_token || !userData) {
                throw new Error(
                    "Login response must contain access_token and user",
                );
            }

            saveAuthTokens(tokenData);

            updateUser(userData);
            setIsAuthenticated(true);

            return response.data;

        } finally {
            setIsLoading(false);
        }
    }, [updateUser]);

    const logout = useCallback(async () => {
        setIsLoading(true);

        const refreshToken = localStorage.getItem("refresh_token");

        try {
            if (refreshToken) {
                await axiosClient.post(
                    "/auth/logout",
                    {
                        refresh_token: refreshToken,
                    },
                );
            }
        } finally {
            clearAuthTokens();
            updateUser(null);
            setIsAuthenticated(false);
            setIsLoading(false);
        }
    }, [updateUser]);

    const updateCurrentUser = useCallback((userData) => {
        updateUser(userData);
    }, [updateUser]);

    useEffect(() => {
        const handleStorageChange = (event) => {
            if (
                event.key === "access_token" ||
                event.key === "auth_user"
            ) {
                const hasToken = Boolean(
                    localStorage.getItem("access_token"),
                );

                const savedUser = localStorage.getItem("auth_user");

                if (!hasToken || !savedUser) {
                    setUser(null);
                    setIsAuthenticated(false);
                } else {
                    try {
                        setUser(JSON.parse(savedUser));
                        setIsAuthenticated(true);
                    } catch {
                        setUser(null);
                        setIsAuthenticated(false);
                    }
                }
            }
        };

        window.addEventListener("storage", handleStorageChange);

        return () => {
            window.removeEventListener(
                "storage",
                handleStorageChange,
            );
        };
    }, []);

    const value = useMemo(() => ({
        user,
        isLoading,
        isAuthenticated,
        register,
        login,
        logout,
        updateCurrentUser,
    }), [
        user,
        isLoading,
        isAuthenticated,
        register,
        login,
        logout,
        updateCurrentUser,
    ]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error(
            "useAuth must be used within an AuthProvider",
        );
    }

    return context;
}
