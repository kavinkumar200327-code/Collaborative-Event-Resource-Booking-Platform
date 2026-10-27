import axiosClient from "./axiosClient";

export const calendarApi = {
    getCalendarEvents: async (params = {}) => {
        const response = await axiosClient.get("/calendar/events", { params });
        return response.data;
    },
};

export default calendarApi;
