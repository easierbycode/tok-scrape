export interface Video {
	id: string;
	title: string;
	description?: string;
	videoUrl: string;
	thumbnailUrl: string;
	category: string;
	isMock: boolean;
	duration: number; // in seconds from API
	viewCount: number;
	published: boolean;
	orderIndex?: number;
}

export interface NormalizedVideo {
	id: string;
	title: string;
	thumbnail: string; // normalized from thumbnailUrl
	duration: string; // formatted as "MM:SS"
	views: number; // normalized from viewCount
	category: string;
	description?: string;
	isMock?: boolean;
}
