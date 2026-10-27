
import axiosClient from "./axiosClient";

const ORGANIZATION_URL = "/organizations";

const getEventUrl = (organizationId) => {

    return `${ORGANIZATION_URL}/${organizationId}/events`;
};

export const eventApi = {

    createEvent: async (
        organizationId,
        eventData
    ) => {

        const response = await axiosClient.post(
            `${getEventUrl(organizationId)}/`,
            {
                ...eventData,
                organization_id: organizationId,
            }
        );

        return response.data;
    },

    getEvents: async (
        organizationId,
        page = 1,
        pageSize = 10,
        statusFilter = null,
        search = null
    ) => {

        const params = {
            page: page,
            page_size: pageSize,
        };

        if (statusFilter) {
            params.status_filter = statusFilter;
            params.status = statusFilter;
        }

        if (search) {
            params.search = search;
        }

        const url = organizationId
            ? `${getEventUrl(organizationId)}/`
            : "/events/";

        const response = await axiosClient.get(
            url,
            {
                params: params,
            }
        );

        return response.data;
    },

    getEventById: async (
        organizationId,
        eventId
    ) => {

        const url = organizationId
            ? `${getEventUrl(organizationId)}/${eventId}`
            : `/events/${eventId}`;

        const response = await axiosClient.get(url);

        return response.data;
    },

    updateEvent: async (
        organizationId,
        eventId,
        eventData
    ) => {

        const response = await axiosClient.patch(
            `${getEventUrl(organizationId)}/${eventId}`,
            eventData
        );

        return response.data;
    },

    updateEventStatus: async (
        organizationId,
        eventId,
        status
    ) => {

        const response = await axiosClient.patch(
            `${getEventUrl(organizationId)}/${eventId}/status`,
            {
                status: status,
            }
        );

        return response.data;
    },

    publishEvent: async (
        organizationId,
        eventId
    ) => {
        const url = organizationId
            ? `${getEventUrl(organizationId)}/${eventId}/publish`
            : `/events/${eventId}/publish`;
        const response = await axiosClient.patch(url);
        return response.data;
    },

    cancelEvent: async (
        organizationId,
        eventId
    ) => {
        const url = organizationId
            ? `${getEventUrl(organizationId)}/${eventId}/cancel`
            : `/events/${eventId}/cancel`;
        const response = await axiosClient.patch(url);
        return response.data;
    },

    completeEvent: async (
        organizationId,
        eventId
    ) => {
        const url = organizationId
            ? `${getEventUrl(organizationId)}/${eventId}/complete`
            : `/events/${eventId}/archive`;
        const response = await axiosClient.patch(url);
        return response.data;
    },

    deleteEvent: async (
        organizationId,
        eventId
    ) => {
        const url = organizationId
            ? `${getEventUrl(organizationId)}/${eventId}`
            : `/events/${eventId}`;
        await axiosClient.delete(url);
        return true;
    },

    getDraftEvents: async (
        organizationId,
        page = 1,
        pageSize = 10
    ) => {

        return eventApi.getEvents(
            organizationId,
            page,
            pageSize,
            "draft"
        );
    },

    getPublishedEvents: async (
        organizationId,
        page = 1,
        pageSize = 10
    ) => {

        return eventApi.getEvents(
            organizationId,
            page,
            pageSize,
            "published"
        );
    },

    getCancelledEvents: async (
        organizationId,
        page = 1,
        pageSize = 10
    ) => {

        return eventApi.getEvents(
            organizationId,
            page,
            pageSize,
            "cancelled"
        );
    },

    getCompletedEvents: async (
        organizationId,
        page = 1,
        pageSize = 10
    ) => {

        return eventApi.getEvents(
            organizationId,
            page,
            pageSize,
            "completed"
        );
    },

};

export default eventApi;
