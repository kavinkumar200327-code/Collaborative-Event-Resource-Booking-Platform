import axiosClient from "./axiosClient";

export const dashboardApi = {
    getStats: async (params = {}) => {
        const response = await axiosClient.get("/dashboard/stats", { params });
        return response.data;
    },
};

export default dashboardApi;
