import { config } from "@repo/config";
import { db } from "@repo/database";
import { ColorModeToggle } from "@shared/components/ColorModeToggle";
import { Clock, Construction } from "@/modules/ui/icons";
import { CheckAgainButton } from "./CheckAgainButton";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
	const { message, estimatedEndTime: envEndTime } = config.maintenance;

	// Check DB for estimated end time (set via admin dashboard)
	let dbEndTime: string | null = null;
	try {
		const setting = await db.systemSetting.findUnique({
			where: { key: "maintenance_end_time" },
		});
		dbEndTime = setting?.value ?? null;
	} catch {
		// DB may be down during maintenance — ignore
	}

	// DB setting takes priority over env var
	const estimatedEndTime = dbEndTime || envEndTime;

	return (
		<div className="relative flex min-h-screen flex-col items-center justify-center p-8">
			<div className="absolute top-4 right-4">
				<ColorModeToggle />
			</div>

			<Construction className="mb-6 h-16 w-16 text-primary" />

			<h1 className="mb-4 text-center text-3xl font-bold">
				Scheduled Maintenance
			</h1>

			<p className="mb-6 max-w-md text-center text-lg text-muted-foreground">
				{message}
			</p>

			{estimatedEndTime && (
				<div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
					<Clock className="h-4 w-4" />
					<span>
						Expected back by:{" "}
						{new Date(estimatedEndTime).toLocaleString()}
					</span>
				</div>
			)}

			<CheckAgainButton />

			<p className="mt-8 text-xs text-muted-foreground">
				Questions? Contact us at support@lifepreneur.com
			</p>
		</div>
	);
}
