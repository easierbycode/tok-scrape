export const videoCategories = [
	{ id: "getting-started", label: "Getting Started" },
	{ id: "products", label: "Product Research" },
	{ id: "content-creation", label: "Content Creation" },
	{ id: "operations", label: "Operations" },
	{ id: "analytics", label: "Analytics" },
	{ id: "scaling", label: "Scaling" },
	{ id: "marketing", label: "Marketing" },
	{ id: "affiliates", label: "Affiliates" },
	{ id: "legal", label: "Legal" },
] as const;

export function getCategoryLabel(categoryId: string): string {
	const category = videoCategories.find((c) => c.id === categoryId);
	return category?.label || categoryId;
}

export function getCategoryId(label: string): string {
	const category = videoCategories.find((c) => c.label === label);
	return category?.id || label.toLowerCase().replace(/\s+/g, "-");
}
