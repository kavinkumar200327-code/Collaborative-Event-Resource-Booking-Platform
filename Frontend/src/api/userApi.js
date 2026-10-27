import axiosClient from "./axiosClient";

export const userApi = {
    getMe: async () => {
        const response = await axiosClient.get("/auth/me");
        return response.data;
    },

    changePassword: async (data) => {
        const response = await axiosClient.post("/auth/change-password", data);
        return response.data;
    },
};

export default userApi;
