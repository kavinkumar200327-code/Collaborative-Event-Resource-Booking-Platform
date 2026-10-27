import axiosClient from "./axiosClient";

export const fileApi = {
    uploadFile: async (formData) => {
        const response = await axiosClient.post("/files/upload", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        return response.data;
    },

    getFileById: async (fileId) => {
        const response = await axiosClient.get(`/files/${fileId}`);
        return response.data;
    },

    getEventFiles: async (eventId) => {
        const response = await axiosClient.get(`/events/${eventId}/files`);
        return response.data;
    },

    deleteFile: async (fileId) => {
        await axiosClient.delete(`/files/${fileId}`);
        return true;
    },

    getDownloadUrl: (fileId) => {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1";
        return `${baseUrl}/files/${fileId}/download`;
    },
};

export default fileApi;
