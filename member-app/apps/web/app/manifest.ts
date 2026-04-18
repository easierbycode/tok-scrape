import { config } from "@repo/config";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: config.appName,
		short_name: config.appName,
		description: "Your LifePreneur membership",
		start_url: "/app",
		display: "standalone",
		background_color: "#fafaf8",
		theme_color: "#e8650a",
		icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
	};
}
