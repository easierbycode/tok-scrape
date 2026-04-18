"use client";

import { createContext, type ReactNode, useContext } from "react";

interface AdminContextValue {
	isSuperAdmin: boolean;
}

const AdminContext = createContext<AdminContextValue>({ isSuperAdmin: false });

export function AdminContextProvider({
	isSuperAdmin,
	children,
}: {
	isSuperAdmin: boolean;
	children: ReactNode;
}) {
	return (
		<AdminContext.Provider value={{ isSuperAdmin }}>
			{children}
		</AdminContext.Provider>
	);
}

export function useAdminContext(): AdminContextValue {
	return useContext(AdminContext);
}
