import { onError } from "@orpc/client";
import { experimental_SmartCoercionPlugin as SmartCoercionPlugin } from "@orpc/json-schema";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ORPCError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { auth } from "@repo/auth";
import { config } from "@repo/config";
import { logger } from "@repo/logs";
import { router } from "./router";

function logOrpcHandlerError(error: unknown) {
	if (error instanceof ORPCError && error.code === "NOT_FOUND") {
		logger.info("Resource not found", {
			code: error.code,
			message: error.message,
		});
		return;
	}
	logger.error(error);
}

export const rpcHandler = new RPCHandler(router, {
	clientInterceptors: [onError(logOrpcHandlerError)],
});

const sharedPlugins = [
	new SmartCoercionPlugin({
		schemaConverters: [new ZodToJsonSchemaConverter()],
	}),
];

function buildOpenApiPlugins() {
	if (process.env.NODE_ENV === "production") {
		return sharedPlugins;
	}

	const { OpenAPIReferencePlugin } =
		require("@orpc/openapi/plugins") as typeof import("@orpc/openapi/plugins");

	return [
		...sharedPlugins,
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
			specGenerateOptions: async () => {
				const authSchema = await (
					auth.api as any
				).generateOpenAPISchema();

				authSchema.paths = Object.fromEntries(
					Object.entries(authSchema.paths).map(
						([path, pathItem]: [string, any]) => [
							`/auth${path}`,
							pathItem,
						],
					),
				);

				return {
					...(authSchema as any),
					info: {
						title: `${config.appName} API`,
						version: "1.0.0",
					},
					servers: [
						{
							url: "/api",
						},
					],
				};
			},
			docsPath: "/docs",
		}),
	];
}

export const openApiHandler = new OpenAPIHandler(router, {
	plugins: buildOpenApiPlugins(),
	clientInterceptors: [onError(logOrpcHandlerError)],
});
