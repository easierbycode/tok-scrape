import { localeRedirect } from "@i18n/routing";
import { getLocale } from "next-intl/server";

export default async function BlogListPage() {
	const locale = await getLocale();
	localeRedirect({ href: "/", locale });
}
