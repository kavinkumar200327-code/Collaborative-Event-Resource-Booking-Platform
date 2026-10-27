import axiosClient from "./axiosClient";

export const sessionApi = {
    getEventSessions: async (eventId) => {
        const response = await axiosClient.get(`/events/${eventId}/sessions`);
        return response.data;
    },

    createSession: async (eventId, data) => {
        const response = await axiosClient.post(`/events/${eventId}/sessions`, data);
        return response.data;
    },

    getSessionById: async (sessionId) => {
        const response = await axiosClient.get(`/sessions/${sessionId}`);
        return response.data;
    },

    updateSession: async (sessionId, data) => {
        const response = await axiosClient.patch(`/sessions/${sessionId}`, data);
        return response.data;
    },

    deleteSession: async (sessionId) => {
        await axiosClient.delete(`/sessions/${sessionId}`);
        return true;
    },
};

export default sessionApi;
