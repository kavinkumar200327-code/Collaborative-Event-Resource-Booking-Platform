import axiosClient from "./axiosClient";

export const registrationApi = {
    register: async (eventId, notes = "") => {
        const response = await axiosClient.post(`/events/${eventId}/register`, { notes });
        return response.data;
    },

    getEventRegistrations: async (eventId, params = {}) => {
        const response = await axiosClient.get(`/events/${eventId}/registrations`, { params });
        return response.data;
    },

    getMyRegistrations: async (params = {}) => {
        const response = await axiosClient.get("/registrations", { params });
        return response.data;
    },

    getRegistrationById: async (id) => {
        const response = await axiosClient.get(`/registrations/${id}`);
        return response.data;
    },

    cancelRegistration: async (id) => {
        const response = await axiosClient.post(`/registrations/${id}/cancel`);
        return response.data;
    },

    approveRegistration: async (id) => {
        const response = await axiosClient.patch(`/registrations/${id}/approve`);
        return response.data;
    },

    rejectRegistration: async (id) => {
        const response = await axiosClient.patch(`/registrations/${id}/reject`);
        return response.data;
    },
};

export default registrationApi;
