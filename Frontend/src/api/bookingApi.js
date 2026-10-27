import axiosClient from "./axiosClient";

export const bookingApi = {
    getBookings: async (params = {}) => {
        const response = await axiosClient.get("/bookings", { params });
        return response.data;
    },

    getBookingById: async (id) => {
        const response = await axiosClient.get(`/bookings/${id}`);
        return response.data;
    },

    createBooking: async (data) => {
        const response = await axiosClient.post("/bookings", data);
        return response.data;
    },

    updateBooking: async (id, data) => {
        const response = await axiosClient.patch(`/bookings/${id}`, data);
        return response.data;
    },

    cancelBooking: async (id) => {
        const response = await axiosClient.post(`/bookings/${id}/cancel`);
        return response.data;
    },

    approveBooking: async (id) => {
        const response = await axiosClient.patch(`/bookings/${id}/approve`);
        return response.data;
    },

    rejectBooking: async (id) => {
        const response = await axiosClient.patch(`/bookings/${id}/reject`);
        return response.data;
    },
};

export default bookingApi;
