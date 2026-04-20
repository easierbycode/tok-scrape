"use client";

/**
 * Announces a message to screen readers using the aria-live region.
 * The message will be announced and then cleared after 1 second.
 *
 * @param message - The message to announce to screen readers
 */
export const announceToScreenReader = (message: string) => {
	if (typeof window === "undefined") {
		return;
	}

	const liveRegion = document.getElementById("status-messages");
	if (liveRegion) {
		liveRegion.textContent = message;
		setTimeout(() => {
			liveRegion.textContent = "";
		}, 1000);
	}
};
