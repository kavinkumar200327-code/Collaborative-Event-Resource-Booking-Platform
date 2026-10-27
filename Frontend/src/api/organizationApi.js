
import axiosClient from "./axiosClient";

const ORGANIZATION_URL = "/organizations";

export const organizationApi = {

    createOrganization: async (organizationData) => {

        const response = await axiosClient.post(
            `${ORGANIZATION_URL}/`,
            organizationData
        );

        return response.data;
    },

    getOrganizations: async (
        page = 1,
        pageSize = 10
    ) => {

        const response = await axiosClient.get(
            `${ORGANIZATION_URL}/`,
            {
                params: {
                    page: page,
                    page_size: pageSize,
                },
            }
        );

        return response.data;
    },

    getOrganizationById: async (organizationId) => {

        const response = await axiosClient.get(
            `${ORGANIZATION_URL}/${organizationId}`
        );

        return response.data;
    },

    updateOrganization: async (
        organizationId,
        organizationData
    ) => {

        const response = await axiosClient.patch(
            `${ORGANIZATION_URL}/${organizationId}`,
            organizationData
        );

        return response.data;
    },

    deleteOrganization: async (organizationId) => {

        await axiosClient.delete(
            `${ORGANIZATION_URL}/${organizationId}`
        );

        return true;
    },

    getOrganizationMembers: async (
        organizationId,
        page = 1,
        pageSize = 10,
        activeOnly = true
    ) => {

        const response = await axiosClient.get(
            `${ORGANIZATION_URL}/${organizationId}/members/`,
            {
                params: {
                    page: page,
                    page_size: pageSize,
                    active_only: activeOnly,
                },
            }
        );

        return response.data;
    },

    getOrganizationMemberById: async (
        organizationId,
        memberId
    ) => {

        const response = await axiosClient.get(
            `${ORGANIZATION_URL}/${organizationId}/members/${memberId}`
        );

        return response.data;
    },

    addOrganizationMember: async (
        organizationId,
        memberData
    ) => {

        const response = await axiosClient.post(
            `${ORGANIZATION_URL}/${organizationId}/members/`,
            memberData
        );

        return response.data;
    },

    updateOrganizationMember: async (
        organizationId,
        memberId,
        memberData
    ) => {

        const response = await axiosClient.patch(
            `${ORGANIZATION_URL}/${organizationId}/members/${memberId}`,
            memberData
        );

        return response.data;
    },

    activateOrganizationMember: async (
        organizationId,
        memberId
    ) => {

        const response = await axiosClient.patch(
            `${ORGANIZATION_URL}/${organizationId}/members/${memberId}/activate`
        );

        return response.data;
    },

    deactivateOrganizationMember: async (
        organizationId,
        memberId
    ) => {

        const response = await axiosClient.patch(
            `${ORGANIZATION_URL}/${organizationId}/members/${memberId}/deactivate`
        );

        return response.data;
    },

    removeOrganizationMember: async (
        organizationId,
        memberId
    ) => {

        await axiosClient.delete(
            `${ORGANIZATION_URL}/${organizationId}/members/${memberId}`
        );

        return true;
    },

    getMembersByRole: async (
        organizationId,
        role
    ) => {

        const response = await axiosClient.get(
            `${ORGANIZATION_URL}/${organizationId}/members/roles/${role}`
        );

        return response.data;
    },

};

export default organizationApi;
