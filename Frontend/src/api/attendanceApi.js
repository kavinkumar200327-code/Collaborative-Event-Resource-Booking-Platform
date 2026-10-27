import axiosClient from "./axiosClient";

export const attendanceApi = {
    getEventAttendance: async (eventId, params = {}) => {
        const response = await axiosClient.get(`/events/${eventId}/attendance`, { params });
        return response.data;
    },

    markAttendance: async (eventId, data) => {
        const response = await axiosClient.post(`/events/${eventId}/attendance`, data);
        return response.data;
    },

    updateAttendance: async (attendanceId, data) => {
        const response = await axiosClient.patch(`/attendance/${attendanceId}`, data);
        return response.data;
    },

    checkInByCode: async (eventId, checkInCode) => {
        const response = await axiosClient.post(`/events/${eventId}/attendance/check-in`, {
            check_in_code: checkInCode,
        });
        return response.data;
    },

    checkInByQr: async (eventId, qrData) => {
        const response = await axiosClient.post(
            `/events/${eventId}/attendance/qr-checkin`,
            null,
            { params: { qr_data: qrData } }
        );
        return response.data;
    },

    exportAttendanceCsv: async (eventId) => {
        const response = await axiosClient.get(`/events/${eventId}/attendance/export`, {
            responseType: "blob",
        });
        return response.data;
    },
};

export default attendanceApi;
