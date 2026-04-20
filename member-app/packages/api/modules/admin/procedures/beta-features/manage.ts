import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

// List all available beta features (from database)
export const listAvailableFeatures = adminProcedure
	.route({
		method: "GET",
		path: "/admin/beta-features/list-available",
		tags: ["Administration"],
		summary: "List all available beta features",
	})
	.handler(async () => {
		const features = await db.betaFeature.findMany({
			where: { status: "active" },
			orderBy: { addedDate: "desc" },
		});

		return features.map((f) => ({
			id: f.id,
			name: f.name,
			description: f.description,
			category: f.category,
			addedDate: f.addedDate.toISOString(),
			estimatedReleaseDate: f.estimatedReleaseDate?.toISOString(),
			status: f.status,
		}));
	});

// List all users with beta access (optional filter by feature)
export const listBetaTesters = adminProcedure
	.route({
		method: "GET",
		path: "/admin/beta-features/list-testers",
		tags: ["Administration"],
		summary: "List all beta testers",
	})
	.input(
		z.object({
			featureId: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const users = await db.user.findMany({
			where: input.featureId
				? { betaFeatures: { has: input.featureId } }
				: { betaFeatures: { isEmpty: false } },
			select: {
				id: true,
				name: true,
				email: true,
				image: true,
				betaFeatures: true,
				createdAt: true,
			},
			orderBy: { name: "asc" },
		});

		return users;
	});

// Update user's beta features (replaces entire array)
export const updateUserBetaFeatures = adminProcedure
	.route({
		method: "POST",
		path: "/admin/beta-features/update-features",
		tags: ["Administration"],
		summary: "Update user's beta feature access",
	})
	.input(
		z.object({
			userId: z.string(),
			featureIds: z.array(z.string()),
		}),
	)
	.handler(async ({ input, context }) => {
		// Validate all feature IDs exist in database
		const features = await db.betaFeature.findMany({
			where: { id: { in: input.featureIds } },
		});

		if (features.length !== input.featureIds.length) {
			throw new Error("One or more invalid beta features");
		}

		const user = await db.user.findUnique({
			where: { id: input.userId },
			select: { id: true, email: true, name: true, betaFeatures: true },
		});

		if (!user) {
			throw new Error("User not found");
		}

		// Calculate changes for audit log
		const oldFeatures = user.betaFeatures;
		const added = input.featureIds.filter((f) => !oldFeatures.includes(f));
		const removed = oldFeatures.filter(
			(f) => !input.featureIds.includes(f),
		);

		// Update user
		await db.user.update({
			where: { id: input.userId },
			data: { betaFeatures: input.featureIds },
		});

		// Log changes
		if (added.length > 0 || removed.length > 0) {
			const featureMap = new Map(features.map((f) => [f.id, f.name]));
			await logAdminAction({
				adminUserId: context.user.id,
				action: "UPDATE_BETA_ACCESS",
				targetType: "user",
				targetId: user.id,
				summary: `Updated beta flags for ${user.email} (+${added.length} / −${removed.length})`,
				metadata: {
					userEmail: user.email,
					added: added.map((id) => featureMap.get(id)),
					removed: removed.map((id) => featureMap.get(id)),
				},
			});
		}

		return {
			success: true,
			message: `Updated beta access for ${user.name}`,
			added,
			removed,
		};
	});

// Add single user to beta feature (convenience method)
export const addUserToBeta = adminProcedure
	.route({
		method: "POST",
		path: "/admin/beta-features/add-user",
		tags: ["Administration"],
		summary: "Add user to a beta feature",
	})
	.input(
		z.object({
			userId: z.string(),
			featureId: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		const feature = await db.betaFeature.findUnique({
			where: { id: input.featureId },
		});

		if (!feature) {
			throw new Error("Invalid beta feature");
		}

		const user = await db.user.findUnique({
			where: { id: input.userId },
			select: { id: true, email: true, name: true, betaFeatures: true },
		});

		if (!user) {
			throw new Error("User not found");
		}

		if (user.betaFeatures.includes(input.featureId)) {
			return { success: true, message: "User already has this feature" };
		}

		await db.user.update({
			where: { id: input.userId },
			data: {
				betaFeatures: [...user.betaFeatures, input.featureId],
			},
		});

		await logAdminAction({
			adminUserId: context.user.id,
			action: "GRANT_BETA_ACCESS",
			targetType: "user",
			targetId: user.id,
			summary: `Granted beta feature "${feature.name}" to ${user.email}`,
			metadata: {
				featureId: input.featureId,
				featureName: feature.name,
				userEmail: user.email,
			},
		});

		return {
			success: true,
			message: `Granted ${feature.name} to ${user.name}`,
		};
	});

// Update beta feature metadata
export const updateBetaFeature = adminProcedure
	.route({
		method: "POST",
		path: "/admin/beta-features/update-feature",
		tags: ["Administration"],
		summary: "Update beta feature metadata",
	})
	.input(
		z.object({
			id: z.string(),
			name: z.string().min(1),
			description: z.string().min(1),
			category: z.enum(["content", "commerce", "other"]),
			addedDate: z.string(),
			estimatedReleaseDate: z.string().optional(),
			status: z.enum(["active", "graduating", "released"]),
		}),
	)
	.handler(async ({ input, context }) => {
		const feature = await db.betaFeature.findUnique({
			where: { id: input.id },
		});

		if (!feature) {
			throw new Error("Feature not found");
		}

		await db.betaFeature.update({
			where: { id: input.id },
			data: {
				name: input.name,
				description: input.description,
				category: input.category,
				addedDate: new Date(input.addedDate),
				estimatedReleaseDate: input.estimatedReleaseDate
					? new Date(input.estimatedReleaseDate)
					: null,
				status: input.status,
			},
		});

		await logAdminAction({
			adminUserId: context.user.id,
			action: "UPDATE_BETA_ACCESS",
			targetType: "beta_feature",
			targetId: input.id,
			summary: `Updated beta feature definition "${input.name}"`,
			metadata: {
				featureName: input.name,
				changes: {
					name:
						feature.name !== input.name
							? { from: feature.name, to: input.name }
							: undefined,
					category:
						feature.category !== input.category
							? { from: feature.category, to: input.category }
							: undefined,
				},
			},
		});

		return { success: true, message: `Updated ${input.name}` };
	});
