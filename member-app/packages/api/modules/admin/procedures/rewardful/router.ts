import { backfillAttribution } from "./backfill-attribution";
import { fetchUnattributed } from "./fetch-unattributed";
import { getAffiliateDetails } from "./get-details";
import { linkToUser } from "./link-to-user";
import { syncRewardful } from "./sync";
import { syncSingleAffiliate } from "./sync-single";
import { unlinkFromUser } from "./unlink-from-user";
import { verifyAffiliate } from "./verify";

export const rewardfulRouter = {
	sync: syncRewardful,
	getDetails: getAffiliateDetails,
	verify: verifyAffiliate,
	linkToUser: linkToUser,
	unlinkFromUser: unlinkFromUser,
	syncSingle: syncSingleAffiliate,
	fetchUnattributed,
	backfillAttribution,
};
