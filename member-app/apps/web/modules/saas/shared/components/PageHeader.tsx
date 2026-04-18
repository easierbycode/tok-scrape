export function PageHeader({
	title,
	subtitle,
}: {
	title: string;
	subtitle?: string;
}) {
	return (
		<div className="mb-8 hidden lg:block">
			<h2 className="font-serif font-bold tracking-tight text-2xl lg:text-3xl">
				{title}
			</h2>
			{subtitle ? (
				<p className="mt-1 text-muted-foreground">{subtitle}</p>
			) : null}
		</div>
	);
}
