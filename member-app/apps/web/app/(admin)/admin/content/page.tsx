import { Card } from "@ui/components/card";
import { Folder, Play, Settings, Upload, Video } from "@/modules/ui/icons";

export default function ContentPage() {
	const upcomingFeatures = [
		{
			icon: Upload,
			title: "Video Upload",
			description: "Upload and manage video content for members",
		},
		{
			icon: Folder,
			title: "Content Library",
			description: "Organize content in collections and categories",
		},
		{
			icon: Play,
			title: "Streaming Controls",
			description: "Manage playback settings and streaming quality",
		},
		{
			icon: Settings,
			title: "Access Management",
			description: "Control content visibility and member permissions",
		},
	];

	return (
		<div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
			<Card className="max-w-2xl w-full">
				<div className="p-8 sm:p-12">
					<div className="flex flex-col items-center text-center space-y-6">
						{/* Icon */}
						<div className="h-20 w-20 rounded-2xl bg-[#FF6B35]/10 flex items-center justify-center">
							<Video className="h-10 w-10 text-[#FF6B35]" />
						</div>

						{/* Title */}
						<div className="space-y-2">
							<h1 className="text-3xl font-bold tracking-tight">
								Content Management
							</h1>
							<p className="text-muted-foreground max-w-md">
								A comprehensive content management system for
								organizing and delivering video content to your
								members.
							</p>
						</div>

						{/* Status Badge */}
						<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
							<div className="h-2 w-2 rounded-full bg-[#FF6B35] animate-pulse" />
							<span className="text-sm font-medium">
								Coming Soon
							</span>
						</div>

						{/* Features Grid */}
						<div className="w-full pt-6">
							<p className="text-sm font-semibold text-muted-foreground mb-4">
								Planned Features
							</p>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								{upcomingFeatures.map((feature, index) => (
									<div
										key={index}
										className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
									>
										<div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center shrink-0">
											<feature.icon className="h-4 w-4 text-[#FF6B35]" />
										</div>
										<div className="text-left">
											<p className="text-sm font-medium">
												{feature.title}
											</p>
											<p className="text-xs text-muted-foreground mt-1">
												{feature.description}
											</p>
										</div>
									</div>
								))}
							</div>
						</div>

						{/* Footer Note */}
						<p className="text-xs text-muted-foreground pt-4">
							This section is currently under development and will
							be available in a future update.
						</p>
					</div>
				</div>
			</Card>
		</div>
	);
}
