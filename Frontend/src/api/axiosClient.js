import axios from "axios";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

const axiosClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 15000,
});

const refreshClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 15000,
});
export function saveAuthTokens(tokenData) {

    if (tokenData.access_token) {
        localStorage.setItem(
            "access_token",
            tokenData.access_token,
        );
    }

    if (tokenData.refresh_token) {
        localStorage.setItem(
            "refresh_token",
            tokenData.refresh_token,
        );
    }
}

export function clearAuthTokens() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
}

axiosClient.interceptors.request.use(
    (config) => {
        const accessToken = localStorage.getItem("access_token");

        if (accessToken) {

            // FIXED: Use the declared accessToken variable
            config.headers.Authorization = `Bearer ${accessToken}`;
        }

        return config;
    },
    (error) => Promise.reject(error),
);

let refreshPromise = null;

axiosClient.interceptors.response.use(
    (response) => response,

    async (error) => {
        const originalRequest = error.config;

        if (!originalRequest) {
            return Promise.reject(error);
        }

        const isUnauthorized = error.response?.status === 401;

        const isAuthEndpoint =
            originalRequest.url?.includes("/auth/login") ||
            originalRequest.url?.includes("/auth/register") ||
            originalRequest.url?.includes("/auth/refresh") ||
            originalRequest.url?.includes("/auth/logout");

        if (
            isUnauthorized &&
            !originalRequest._retry &&
            !isAuthEndpoint
        ) {
            originalRequest._retry = true;

            const refreshToken = localStorage.getItem("refresh_token");

            if (!refreshToken) {
                clearAuthTokens();
                return Promise.reject(error);
            }

            try {
                if (!refreshPromise) {
                    refreshPromise = refreshClient
                        .post("/auth/refresh", {
                            refresh_token: refreshToken,
                        })
                        .then((response) => {
                            const newAccessToken =
                                response.data.access_token;

                            const newRefreshToken =
                                response.data.refresh_token;

                            if (!newAccessToken) {
                                throw new Error(
                                    "Refresh response is missing access_token",
                                );
                            }

                            saveAuthTokens({
                                access_token: newAccessToken,
                                refresh_token: newRefreshToken,
                            });

                            return newAccessToken;
                        })
                        .catch((refreshError) => {
                            clearAuthTokens();
                            throw refreshError;
                        })
                        .finally(() => {
                            refreshPromise = null;
                        });
                }

                const newAccessToken = await refreshPromise;

                originalRequest.headers =
                    originalRequest.headers || {};

                originalRequest.headers.Authorization =
                    `Bearer ${newAccessToken}`;

                return axiosClient(originalRequest);

            } catch (refreshError) {
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    },
);

export default axiosClient;
