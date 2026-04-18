import { redirect } from "next/navigation";

export default function DashboardPage() {
	// Redirect to community page
	redirect("/app/community");
}
