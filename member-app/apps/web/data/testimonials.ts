export interface Testimonial {
	name: string;
	role: string;
	avatar: number | string;
	rating: 5;
	content: string;
	stats: string;
}

export const testimonials: Testimonial[] = [
	{
		name: "Sarah Chen",
		role: "Content Creator",
		avatar: 1,
		rating: 5,
		content: "[Beta testimonial content to be provided]",
		stats: "$15K/mo",
	},
	{
		name: "Marcus Johnson",
		role: "TikTok Shop Seller",
		avatar: 2,
		rating: 5,
		content: "[Beta testimonial content to be provided]",
		stats: "$8K/mo",
	},
	{
		name: "Emily Rodriguez",
		role: "E-commerce Entrepreneur",
		avatar: 3,
		rating: 5,
		content: "[Beta testimonial content to be provided]",
		stats: "$12K/mo",
	},
];
