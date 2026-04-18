// OrganizationMetadata type removed with organization plugin
// TODO: Define type locally or import from another source if needed
type OrganizationMetadata = Record<string, unknown> | undefined;

import { useMutation, useQuery } from "@tanstack/react-query";

export const organizationListQueryKey = ["user", "organizations"] as const;
export const useOrganizationListQuery = () => {
	return useQuery({
		queryKey: organizationListQueryKey,
		queryFn: async () => {
			// Organization plugin removed - list functionality disabled
			// TODO: Implement via ORPC if needed
			return [] as Array<{
				id: string;
				slug: string;
				name: string;
				logo: string | null;
			}>;
		},
	});
};

export const activeOrganizationQueryKey = (slug: string) =>
	["user", "activeOrganization", slug] as const;
export const useActiveOrganizationQuery = (
	slug: string,
	options?: {
		enabled?: boolean;
	},
) => {
	return useQuery({
		queryKey: activeOrganizationQueryKey(slug),
		queryFn: async () => {
			// Organization plugin removed - getFullOrganization functionality disabled
			// TODO: Implement via ORPC if needed
			return null as {
				id: string;
				name: string;
				slug: string;
				logo: string | null;
				members: Array<{ userId: string; role: string }>;
			} | null;
		},
		enabled: options?.enabled,
	});
};

export const fullOrganizationQueryKey = (id: string) =>
	["fullOrganization", id] as const;
export const useFullOrganizationQuery = (id: string) => {
	return useQuery({
		queryKey: fullOrganizationQueryKey(id),
		queryFn: async () => {
			// Organization plugin removed - getFullOrganization functionality disabled
			// TODO: Implement via ORPC if needed
			return null as {
				id: string;
				name: string;
				slug: string;
				logo: string | null;
				members: Array<{ userId: string; role: string }>;
				invitations?: Array<{
					id: string;
					email: string;
					role: string;
					status: string;
					createdAt: Date;
					expiresAt: Date;
				}>;
			} | null;
		},
	});
};

/*
 * Create organization
 */
export const createOrganizationMutationKey = ["create-organization"] as const;
export const useCreateOrganizationMutation = () => {
	return useMutation({
		mutationKey: createOrganizationMutationKey,
		mutationFn: async ({
			name: _name,
			metadata: _metadata,
		}: {
			name: string;
			metadata?: OrganizationMetadata;
		}) => {
			// Organization plugin removed - create functionality disabled
			// TODO: Implement via ORPC if needed
			throw new Error(
				"Organization creation is not available. Organization plugin has been removed.",
			);
		},
	});
};

/*
 * Update organization
 */
export const updateOrganizationMutationKey = ["update-organization"] as const;
export const useUpdateOrganizationMutation = () => {
	return useMutation({
		mutationKey: updateOrganizationMutationKey,
		mutationFn: async ({
			id: _id,
			name: _name,
			metadata: _metadata,
			updateSlug: _updateSlug,
		}: {
			id: string;
			name: string;
			metadata?: OrganizationMetadata;
			updateSlug?: boolean;
		}) => {
			// Organization plugin removed - update functionality disabled
			// TODO: Implement via ORPC if needed
			throw new Error(
				"Organization update is not available. Organization plugin has been removed.",
			);
		},
	});
};
