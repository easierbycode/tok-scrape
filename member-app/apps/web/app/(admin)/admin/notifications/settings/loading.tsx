export default function NotificationSettingsLoading() {
	return (
		<div className="space-y-6">
			<div className="flex items-start justify-between">
				<div className="space-y-2">
					<div className="h-9 w-64 bg-muted animate-pulse rounded" />
					<div className="h-5 w-96 bg-muted animate-pulse rounded" />
				</div>
				<div className="h-10 w-40 bg-muted animate-pulse rounded" />
			</div>

			{[...Array(3)].map((_, i) => (
				<div key={i} className="border rounded-lg p-6">
					<div className="space-y-6">
						<div className="space-y-2">
							<div className="h-6 w-48 bg-muted animate-pulse rounded" />
							<div className="h-4 w-full bg-muted animate-pulse rounded" />
						</div>

						{[...Array(4)].map((_, j) => (
							<div key={j} className="space-y-2 ml-4">
								<div className="h-5 w-32 bg-muted animate-pulse rounded" />
								<div className="flex items-center justify-between py-2">
									<div className="h-4 w-40 bg-muted animate-pulse rounded" />
									<div className="h-6 w-10 bg-muted animate-pulse rounded" />
								</div>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
