import { listVideos } from "./procedures/videos/list";

export const contentRouter = {
	videos: {
		list: listVideos,
	},
};
