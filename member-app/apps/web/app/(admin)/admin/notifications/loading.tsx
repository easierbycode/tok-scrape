export default function NotificationsLoading() {
	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<div className="h-9 w-48 bg-muted animate-pulse rounded" />
				<div className="h-5 w-96 bg-muted animate-pulse rounded" />
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{[...Array(3)].map((_, i) => (
					<div key={i} className="border rounded-lg p-6">
						<div className="flex items-center gap-4">
							<div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
							<div className="space-y-2 flex-1">
								<div className="h-4 w-24 bg-muted animate-pulse rounded" />
								<div className="h-8 w-16 bg-muted animate-pulse rounded" />
								<div className="h-3 w-32 bg-muted animate-pulse rounded" />
							</div>
						</div>
					</div>
				))}
			</div>

			<div className="border rounded-lg p-4">
				<div className="flex gap-4">
					<div className="h-10 flex-1 bg-muted animate-pulse rounded" />
					<div className="h-10 w-48 bg-muted animate-pulse rounded" />
				</div>
			</div>

			<div className="border rounded-lg">
				<div className="divide-y">
					{[...Array(5)].map((_, i) => (
						<div key={i} className="p-4">
							<div className="flex items-start gap-4">
								<div className="h-5 w-5 rounded-full bg-muted animate-pulse mt-1" />
								<div className="flex-1 space-y-2">
									<div className="h-4 w-48 bg-muted animate-pulse rounded" />
									<div className="h-4 w-full bg-muted animate-pulse rounded" />
									<div className="h-3 w-32 bg-muted animate-pulse rounded" />
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
