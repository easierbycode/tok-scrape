import { db } from "../prisma";

/**
 * Notify all admin users about a system event
 * Creates a notification for each user with role="admin"
 */
export async function notifyAllAdmins({
	type,
	title,
	message,
}: {
	type: string;
	title: string;
	message: string;
}) {
	// Get all admin users
	const adminUsers = await db.user.findMany({
		where: { role: "admin" },
		select: { id: true },
	});

	if (adminUsers.length === 0) {
		return;
	}

	// Create notification for each admin
	await Promise.all(
		adminUsers.map((admin) =>
			db.notification.create({
				data: {
					userId: admin.id,
					type,
					title,
					message,
				},
			}),
		),
	);
}

