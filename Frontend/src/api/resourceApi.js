import axiosClient from "./axiosClient";

export const resourceApi = {
    getResources: async (params = {}) => {
        const response = await axiosClient.get("/resources", { params });
        return response.data;
    },

    getResourceById: async (id) => {
        const response = await axiosClient.get(`/resources/${id}`);
        return response.data;
    },

    createResource: async (data) => {
        const response = await axiosClient.post("/resources", data);
        return response.data;
    },

    updateResource: async (id, data) => {
        const response = await axiosClient.patch(`/resources/${id}`, data);
        return response.data;
    },

    deleteResource: async (id) => {
        await axiosClient.delete(`/resources/${id}`);
        return true;
    },

    activateResource: async (id) => {
        const response = await axiosClient.patch(`/resources/${id}/activate`);
        return response.data;
    },

    deactivateResource: async (id) => {
        const response = await axiosClient.patch(`/resources/${id}/deactivate`);
        return response.data;
    },
};

export default resourceApi;
