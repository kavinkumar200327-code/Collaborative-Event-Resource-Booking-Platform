import axiosClient from "./axiosClient";

export const commentApi = {
    getComments: async (eventId, params = {}) => {
        const response = await axiosClient.get(`/events/${eventId}/comments`, { params });
        return response.data;
    },

    createComment: async (eventId, data) => {
        const response = await axiosClient.post(`/events/${eventId}/comments`, data);
        return response.data;
    },

    updateComment: async (commentId, data) => {
        const response = await axiosClient.patch(`/comments/${commentId}`, data);
        return response.data;
    },

    deleteComment: async (commentId) => {
        await axiosClient.delete(`/comments/${commentId}`);
        return true;
    },
};

export default commentApi;
