// ActiveOrganization type removed with organization plugin
// TODO: Define type locally or import from another source if needed
type ActiveOrganization = {
	id: string;
	name: string;
	slug: string;
	logo: string | null;
	members: Array<{
		userId: string;
		role: string;
		user?: {
			id: string;
			name: string | null;
			email: string;
			image: string | null;
		};
	}>;
	invitations?: Array<{
		id: string;
		email: string;
		role: string;
		status: string;
		createdAt: Date;
		expiresAt: Date;
	}>;
};

import React from "react";

export const ActiveOrganizationContext = React.createContext<
	| {
			activeOrganization: ActiveOrganization | null;
			activeOrganizationUserRole:
				| ActiveOrganization["members"][number]["role"]
				| null;
			isOrganizationAdmin: boolean;
			loaded: boolean;
			setActiveOrganization: (
				organizationId: string | null,
			) => Promise<void>;
			refetchActiveOrganization: () => Promise<void>;
	  }
	| undefined
>(undefined);
