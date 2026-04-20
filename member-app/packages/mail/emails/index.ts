import { DiscordInvite } from "../emails/DiscordInvite";
import { EmailVerification } from "../emails/EmailVerification";
import { ForgotPassword } from "../emails/ForgotPassword";
import { GracePeriod } from "../emails/GracePeriod";
import { GracePeriodExpiring } from "../emails/GracePeriodExpiring";
import { MagicLink } from "../emails/MagicLink";
import { NewsletterSignup } from "../emails/NewsletterSignup";
import { SetupAccount } from "../emails/SetupAccount";
import { OrganizationInvitation } from "../emails/OrganizationInvitation";
import { PaymentFailed } from "../emails/PaymentFailed";
import { PurchaseConfirmation } from "../emails/PurchaseConfirmation";
import { SubscriptionCanceled } from "../emails/SubscriptionCanceled";
import { SubscriptionReactivated } from "../emails/SubscriptionReactivated";

export const mailTemplates = {
	magicLink: MagicLink,
	forgotPassword: ForgotPassword,
	setupAccount: SetupAccount,
	newsletterSignup: NewsletterSignup,
	organizationInvitation: OrganizationInvitation,
	emailVerification: EmailVerification,
	gracePeriod: GracePeriod,
	subscriptionCanceled: SubscriptionCanceled,
	purchaseConfirmation: PurchaseConfirmation,
	subscriptionReactivated: SubscriptionReactivated,
	paymentFailed: PaymentFailed,
	discordInvite: DiscordInvite,
	gracePeriodExpiring: GracePeriodExpiring,
} as const;
