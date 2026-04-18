/**
 * Discord bot package exports
 *
 * Gateway (websocket) client removed — all operations use Discord REST API,
 * which is serverless-safe on Vercel.
 */

export { addUserToServer } from "./lib/add-to-server";
export {
	createChannelMessage,
	deleteChannelMessage,
	editChannelMessage,
	getBotUserId,
	getChannelMessage,
	getChannelMessageRaw,
	listGuildChannels,
} from "./lib/channel-messages";
export { createTemporaryInvite } from "./lib/create-invite";
export {
	getDiscordBotUserAgent,
	getGuildId,
	resolvePlanRoleId,
} from "./lib/helpers";
export {
	changeToGracePeriodRole,
	grantActiveRole,
	removeGuildMemberRole,
	removeUserFromServer,
	swapPlanRole,
} from "./lib/manage-roles";
export {
	BILLING_UPGRADE_CUSTOM_ID,
	buildDiscordMessageBody,
	type MessageStudioEmbedField,
	type MessageStudioPayload,
	messageToStudioPayload,
	ONBOARDING_COMPLETE_CUSTOM_ID,
	parseDiscordMessageUrl,
} from "./lib/message-studio";
export type { DiscordResult, DiscordUserData } from "./lib/types";
