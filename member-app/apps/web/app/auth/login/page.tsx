import { ErrorBoundary } from "@marketing/shared/components/ErrorBoundary";
import { LoginForm } from "@saas/auth/components/LoginForm";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("auth.login.title"),
	};
}

export default function LoginPage() {
	return (
		<ErrorBoundary>
			<LoginForm />
		</ErrorBoundary>
	);
}
