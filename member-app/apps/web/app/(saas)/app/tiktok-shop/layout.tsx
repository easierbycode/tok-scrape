import type { PropsWithChildren } from "react";

/**
 * TikTok Shop wing — parent segment only.
 * Beta-gated chrome lives in `(main)/layout.tsx`; `coming-soon` stays outside `(main)`.
 */
export default function TiktokShopLayout({ children }: PropsWithChildren) {
	return children;
}
