import React from "react";

const EMAIL_LOGO_URL = process.env.NEXT_PUBLIC_APP_URL
	? `${process.env.NEXT_PUBLIC_APP_URL}/images/email-logo.png`
	: null;

export function Logo() {
	if (EMAIL_LOGO_URL) {
		return (
			<img
				src={EMAIL_LOGO_URL}
				alt="LifePreneur"
				width={48}
				height={48}
				style={{ display: "block", marginBottom: "16px" }}
			/>
		);
	}

	return (
		<p
			style={{
				fontSize: "24px",
				fontWeight: 700,
				color: "#e8650a",
				margin: "0 0 16px 0",
			}}
		>
			LifePreneur
		</p>
	);
}
