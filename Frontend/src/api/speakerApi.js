import axiosClient from "./axiosClient";

export const speakerApi = {
    getSpeakers: async (paramsOrOrgId) => {
        const params =
            typeof paramsOrOrgId === "string"
                ? { organization_id: paramsOrOrgId, page_size: 100 }
                : paramsOrOrgId;
        const response = await axiosClient.get("/speakers", { params });
        return response.data;
    },

    createSpeaker: async (dataOrOrgId, maybeData) => {
        const payload = maybeData
            ? { ...maybeData, organization_id: dataOrOrgId }
            : dataOrOrgId;
        const response = await axiosClient.post("/speakers", payload);
        return response.data;
    },

    getSpeakerById: async (speakerId) => {
        const response = await axiosClient.get(`/speakers/${speakerId}`);
        return response.data;
    },

    updateSpeaker: async (speakerId, data) => {
        const response = await axiosClient.patch(`/speakers/${speakerId}`, data);
        return response.data;
    },

    deleteSpeaker: async (speakerId) => {
        await axiosClient.delete(`/speakers/${speakerId}`);
        return true;
    },
};

export default speakerApi;
