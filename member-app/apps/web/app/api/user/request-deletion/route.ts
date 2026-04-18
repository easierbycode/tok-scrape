import { requestUserDeletion } from "@repo/database/lib/gdpr-deletion";
import { getSession } from "@saas/auth/lib/server";
import { NextResponse } from "next/server";

export async function POST() {
	const session = await getSession();

	if (!session?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const result = await requestUserDeletion({
			userId: session.user.id,
			deletedBy: session.user.id, // Self-deletion
			reason: "user_request",
			immediate: false,
		});

		return NextResponse.json(result);
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Deletion failed",
			},
			{ status: 500 },
		);
	}
}
