"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
	capturePostHogProductEvent,
	POSTHOG_PRODUCT_EVENTS,
} from "@/lib/posthog-product-events";
import { CreditCardIcon } from "@/modules/ui/icons";

export function CustomerPortalButton({ purchaseId }: { purchaseId: string }) {
	const t = useTranslations();
	const createCustomerPortalMutation = useMutation(
		orpc.payments.createCustomerPortalLink.mutationOptions(),
	);

	const createCustomerPortal = async () => {
		try {
			const { customerPortalLink } =
				await createCustomerPortalMutation.mutateAsync({
					purchaseId,
					redirectUrl: window.location.href,
				});

			capturePostHogProductEvent(
				POSTHOG_PRODUCT_EVENTS.BILLING_PORTAL_OPENED,
				{
					source: "customer_portal_button",
				},
			);
			window.location.href = customerPortalLink;
		} catch {
			toast.error(
				t(
					"settings.billing.createCustomerPortal.notifications.error.title",
				),
			);
		}
	};

	return (
		<Button
			type="button"
			variant="light"
			size="sm"
			onClick={() => createCustomerPortal()}
			loading={createCustomerPortalMutation.isPending}
		>
			<CreditCardIcon className="mr-2 size-4" />
			{t("settings.billing.createCustomerPortal.label")}
		</Button>
	);
}
