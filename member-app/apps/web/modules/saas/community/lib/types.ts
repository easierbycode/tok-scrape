export interface Platform {
	id: string;
	name: string;
	description: string;
	connected: boolean;
	username?: string | null;
	url?: string;
	/** Used to build a discord:// deep link that opens the native app. */
	guildId?: string;
	channelId?: string;
}

export interface Announcement {
	id: string;
	title: string;
	content: string;
	fullContent: string;
	date: string;
	type:
		| "welcome"
		| "event"
		| "update"
		| "feature"
		| "maintenance"
		| "community";
	priority: "urgent" | "important" | "normal";
	author: string;
	read?: boolean;
}
