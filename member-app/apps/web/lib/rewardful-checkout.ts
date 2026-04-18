interface RewardfulWindow {
	referral?: string;
	affiliate?: { token?: string };
}

function readRewardfulReferralIdFromWindow(): string | undefined {
	if (typeof window === "undefined") {
		return undefined;
	}
	const ref = (window as unknown as { Rewardful?: RewardfulWindow }).Rewardful
		?.referral;
	if (typeof ref !== "string") {
		return undefined;
	}
	const trimmed = ref.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function readRewardfulReferralIdFromCookie(): string | undefined {
	if (typeof document === "undefined") {
		return undefined;
	}
	const match = document.cookie
		.split("; ")
		.find((c) => c.startsWith("rewardful.referral="));
	if (!match) {
		return undefined;
	}
	try {
		const decoded = decodeURIComponent(match.split("=").slice(1).join("="));
		const data = JSON.parse(decoded) as { id?: string };
		if (typeof data.id === "string" && data.id.trim().length > 0) {
			return data.id.trim();
		}
	} catch {
		/* malformed cookie */
	}
	return undefined;
}

function readAffiliateTokenFromWindow(): string | undefined {
	if (typeof window === "undefined") {
		return undefined;
	}
	const token = (window as unknown as { Rewardful?: RewardfulWindow })
		.Rewardful?.affiliate?.token;
	if (typeof token !== "string") {
		return undefined;
	}
	const trimmed = token.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function readAffiliateTokenFromCookie(): string | undefined {
	if (typeof document === "undefined") {
		return undefined;
	}
	const match = document.cookie
		.split("; ")
		.find((c) => c.startsWith("rewardful.referral="));
	if (!match) {
		return undefined;
	}
	try {
		const decoded = decodeURIComponent(match.split("=").slice(1).join("="));
		const data = JSON.parse(decoded) as {
			affiliate?: { token?: string };
		};
		const token = data.affiliate?.token;
		if (typeof token === "string" && token.trim().length > 0) {
			return token.trim();
		}
	} catch {
		/* malformed cookie */
	}
	return undefined;
}

/**
 * Reads Rewardful referral UUID and affiliate link token (?via=) for marketing checkout.
 */
export async function getRewardfulAttribution(): Promise<{
	referralId?: string;
	affiliateToken?: string;
}> {
	let referralId =
		readRewardfulReferralIdFromWindow() ??
		readRewardfulReferralIdFromCookie();
	let affiliateToken =
		readAffiliateTokenFromWindow() ?? readAffiliateTokenFromCookie();

	if (!referralId) {
		for (let i = 0; i < 20; i++) {
			await new Promise((r) => setTimeout(r, 150));
			referralId =
				readRewardfulReferralIdFromWindow() ??
				readRewardfulReferralIdFromCookie();
			if (referralId) {
				break;
			}
		}
	}

	if (referralId && !affiliateToken) {
		for (let i = 0; i < 20; i++) {
			await new Promise((r) => setTimeout(r, 150));
			affiliateToken =
				readAffiliateTokenFromWindow() ??
				readAffiliateTokenFromCookie();
			if (affiliateToken) {
				break;
			}
		}
	}

	return { referralId, affiliateToken };
}
