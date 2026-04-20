"use client";

import { logger } from "@repo/logs";
import { Alert, AlertDescription } from "@ui/components/alert";
import { Button } from "@ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@ui/components/card";
import { Checkbox } from "@ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import { EmptyState } from "@ui/components/empty-state";
import { Input } from "@ui/components/input";
import { Label } from "@ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";
import { Textarea } from "@ui/components/textarea";
import { useEffect, useState } from "react";
import {
	AlertCircle,
	CheckCircle,
	Eye,
	EyeOff,
	Wallet,
} from "@/modules/ui/icons";
import { getStatusBadge } from "../lib/utils";

interface PayoutRequest {
	id: string;
	dateRequested: string | Date;
	amount: number;
	method: string;
	payoutDetails?: string;
	status: "pending" | "processing" | "completed" | "rejected";
	processedDate?: string | Date | null;
}

export function PayoutsTab() {
	const [payoutHistory, setPayoutHistory] = useState<PayoutRequest[]>([]);
	const [earnings, setEarnings] = useState<{ due: number } | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [statusFilter, setStatusFilter] = useState<
		"all" | "pending" | "processing" | "completed" | "rejected"
	>("all");

	// Form state
	const [amount, setAmount] = useState("");
	const [notes, setNotes] = useState("");

	// Settings dialog state
	const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
	const [settingsMethod, setSettingsMethod] = useState<
		"paypal" | "wise" | "zelle"
	>("paypal");

	// Simplified form data
	const [formData, setFormData] = useState({
		// Tax information
		fullLegalName: "",
		taxId: "",
		showTaxId: false,
		addressLine1: "",
		addressLine2: "",
		city: "",
		state: "",
		postalCode: "",
		country: "US",

		// Contact
		email: "",
		phone: "",

		// Payment method
		paymentMethod: "paypal" as "paypal" | "wise" | "zelle",
		paypalEmail: "",
		wiseEmail: "",
		wiseCurrency: "USD",
		zelleEmailOrPhone: "",

		// Compliance
		w9Acknowledged: false,
	});

	const [currentSettings, _setCurrentSettings] = useState<any>(null);

	useEffect(() => {
		// TODO: Fetch from Rewardful API when integrated
		// For now, show empty state
		setPayoutHistory([]);
		setEarnings({ due: 0 });
		setIsLoading(false);

		// TODO: Load affiliate settings from database when available
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// Validation
		const amountNum = Number.parseFloat(amount);
		if (Number.isNaN(amountNum) || amountNum < 50) {
			alert("Minimum payout is $50.00");
			return;
		}

		if (amountNum > (earnings?.due || 0)) {
			alert("Amount exceeds available balance");
			return;
		}

		if (!currentSettings) {
			alert(
				"Please set up your payment method before requesting a payout",
			);
			return;
		}

		setIsSubmitting(true);
		try {
			// TODO: Implement payout request via Rewardful API
			alert(
				"Payout requests will be available after Rewardful integration.",
			);
		} catch (error) {
			logger.error("Failed to request payout", { error });
			alert("Failed to submit payout request. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleUpdateSettings = async (e: React.FormEvent) => {
		e.preventDefault();

		try {
			// Frontend validation
			if (!formData.fullLegalName.trim()) {
				alert("Full legal name is required");
				return;
			}

			if (!formData.taxId.trim()) {
				alert("Tax ID is required for IRS reporting");
				return;
			}

			if (!formData.w9Acknowledged) {
				alert("You must acknowledge the W-9 requirements");
				return;
			}

			// TODO: Implement settings update via backend API
			alert(
				"Payout settings will be available after Rewardful integration.",
			);
			setIsSettingsDialogOpen(false);
		} catch (error) {
			alert(
				error instanceof Error
					? error.message
					: "Failed to update settings",
			);
		}
	};

	const handleFormChange = (field: string, value: any) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="h-8 w-48 bg-muted animate-pulse rounded" />
				<div className="grid gap-6 lg:grid-cols-2">
					<div className="h-96 bg-muted animate-pulse rounded" />
					<div className="h-96 bg-muted animate-pulse rounded" />
				</div>
				<div className="h-64 bg-muted animate-pulse rounded" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<h2 className="font-serif font-bold tracking-tight text-2xl">
					Payouts
				</h2>
			</div>

			{/* Request Payout and Settings Cards */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* Request Payout Card */}
				<Card>
					<CardHeader>
						<CardTitle>Request Payout</CardTitle>
						<CardDescription>
							Submit a request to receive your commission earnings
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Check if settings are complete */}
						{!currentSettings ? (
							<Alert>
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>
									Please set up your payment method before
									requesting a payout.
								</AlertDescription>
							</Alert>
						) : null}

						<form onSubmit={handleSubmit} className="space-y-4">
							{/* Available Balance Display */}
							<div className="p-4 bg-muted/50 rounded-md">
								<p className="text-sm text-muted-foreground mb-1">
									Available Balance
								</p>
								<p className="text-2xl font-bold text-green-600">
									$
									{(earnings?.due ?? 0).toLocaleString(
										"en-US",
										{
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										},
									)}
								</p>
							</div>

							{/* Amount Input */}
							<div className="space-y-2">
								<Label htmlFor="payout-amount">
									Request Amount *
								</Label>
								<Input
									id="payout-amount"
									type="number"
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
									min="50"
									step="0.01"
									max={earnings?.due || 0}
									required
									disabled={!currentSettings}
								/>
								<p className="text-xs text-muted-foreground">
									Minimum: $50.00 • Maximum: $
									{(earnings?.due ?? 0).toLocaleString(
										"en-US",
										{
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										},
									)}
								</p>
							</div>

							{/* Display Saved Payment Method */}
							{currentSettings && (
								<div className="space-y-2">
									<Label>Payment will be sent to:</Label>
									<div className="p-3 bg-muted border border-border rounded-md space-y-2">
										<div className="flex items-center justify-between">
											<span className="text-sm font-medium capitalize">
												{currentSettings.paymentMethod}
											</span>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() =>
													setIsSettingsDialogOpen(
														true,
													)
												}
												className="h-auto py-1 px-2 text-xs"
											>
												⚙️ Update
											</Button>
										</div>
										<p className="text-sm">
											{currentSettings.paymentMethod ===
												"paypal" &&
												currentSettings.paypalEmail}
											{currentSettings.paymentMethod ===
												"wise" &&
												currentSettings.wiseEmail}
											{currentSettings.paymentMethod ===
												"zelle" &&
												currentSettings.zelleEmailOrPhone}
										</p>
										<p className="text-xs text-muted-foreground">
											{currentSettings.fullLegalName}
										</p>
									</div>
								</div>
							)}

							{/* Notes for Admin */}
							<div className="space-y-2">
								<Label htmlFor="payout-notes">
									Notes for admin{" "}
									<span className="text-muted-foreground">
										(optional)
									</span>
								</Label>
								<Textarea
									id="payout-notes"
									rows={3}
									placeholder="Any special instructions or timing requirements..."
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
									disabled={!currentSettings}
								/>
							</div>

							<Button
								type="submit"
								disabled={
									isSubmitting ||
									!amount ||
									Number.parseFloat(amount) < 50 ||
									!currentSettings
								}
								className="w-full"
								variant="primary"
							>
								{isSubmitting
									? "Submitting..."
									: "Submit Payout Request"}
							</Button>

							<p className="text-xs text-center text-muted-foreground">
								Requests are typically processed within 2-3
								business days
							</p>
						</form>
					</CardContent>
				</Card>

				{/* Default Payout Settings Card */}
				<Card>
					<CardHeader>
						<CardTitle>Default Payout Method</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{currentSettings ? (
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground">
										Payment Method
									</span>
									<span className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-medium capitalize">
										{currentSettings.paymentMethod}
									</span>
								</div>

								<div className="p-4 bg-muted border border-border rounded-md space-y-3">
									<div>
										<p className="text-xs text-muted-foreground">
											Legal Name
										</p>
										<p className="font-medium text-sm">
											{currentSettings.fullLegalName}
										</p>
									</div>

									<div className="grid grid-cols-2 gap-3">
										<div>
											<p className="text-xs text-muted-foreground">
												Tax ID
											</p>
											<p className="font-medium text-sm font-mono">
												***-**-
												{currentSettings.taxIdLast4}
											</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground">
												Location
											</p>
											<p className="text-sm">
												{currentSettings.city},{" "}
												{currentSettings.state}
											</p>
										</div>
									</div>

									<div>
										<p className="text-xs text-muted-foreground">
											{currentSettings.paymentMethod ===
												"paypal" && "PayPal Email"}
											{currentSettings.paymentMethod ===
												"wise" && "Wise Email"}
											{currentSettings.paymentMethod ===
												"zelle" && "Zelle Contact"}
										</p>
										<p className="font-medium text-sm">
											{currentSettings.paymentMethod ===
												"paypal" &&
												currentSettings.paypalEmail}
											{currentSettings.paymentMethod ===
												"wise" &&
												currentSettings.wiseEmail}
											{currentSettings.paymentMethod ===
												"zelle" &&
												currentSettings.zelleEmailOrPhone}
										</p>
									</div>

									<div className="flex items-center gap-2 pt-2 border-t border-border">
										<CheckCircle className="w-4 h-4 text-green-500" />
										<span className="text-xs text-muted-foreground">
											Verified for payments • Updated{" "}
											{new Date(
												currentSettings.lastUpdated,
											).toLocaleDateString()}
										</span>
									</div>
								</div>
							</div>
						) : (
							<div className="text-center py-6 text-muted-foreground">
								<p className="mb-2">
									Payment settings not configured
								</p>
								<p className="text-xs">
									Set up your tax and payment information to
									receive payouts
								</p>
							</div>
						)}

						<Button
							variant="outline"
							className="w-full"
							onClick={() => setIsSettingsDialogOpen(true)}
						>
							{currentSettings
								? "Update Settings"
								: "Set Up Payout Method"}
						</Button>
					</CardContent>
				</Card>
			</div>

			{/* Update Settings Dialog */}
			<Dialog
				open={isSettingsDialogOpen}
				onOpenChange={setIsSettingsDialogOpen}
			>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Payout Settings</DialogTitle>
						<DialogDescription>
							Set up your tax information and payment preferences
							to receive affiliate commissions
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={handleUpdateSettings}
						className="space-y-6 py-4"
					>
						{/* Section 1: Tax Information */}
						<div className="space-y-4">
							<div className="flex items-start gap-2">
								<AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
								<div className="flex-1">
									<h3 className="font-semibold text-sm mb-1">
										IRS 1099-NEC Requirement
									</h3>
									<p className="text-xs text-muted-foreground">
										Federal law requires us to collect tax
										information from affiliates earning $600
										or more per year. This information is
										used solely for filing Form 1099-NEC
										with the IRS. All data is encrypted and
										stored securely.
									</p>
								</div>
							</div>

							<div className="space-y-3">
								<div className="space-y-2">
									<Label htmlFor="full-legal-name">
										Full Legal Name{" "}
										<span className="text-destructive">
											*
										</span>
									</Label>
									<Input
										id="full-legal-name"
										type="text"
										value={formData.fullLegalName}
										onChange={(e) =>
											handleFormChange(
												"fullLegalName",
												e.target.value,
											)
										}
										placeholder="As it appears on your tax return"
										required
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="tax-id">
										Tax ID/SSN{" "}
										<span className="text-destructive">
											*
										</span>
									</Label>
									<div className="relative">
										<Input
											id="tax-id"
											type={
												formData.showTaxId
													? "text"
													: "password"
											}
											value={formData.taxId}
											onChange={(e) =>
												handleFormChange(
													"taxId",
													e.target.value,
												)
											}
											placeholder="XXX-XX-XXXX or XX-XXXXXXX"
											pattern="\d{3}-\d{2}-\d{4}|\d{2}-\d{7}"
											required
											className="pr-10"
										/>
										<button
											type="button"
											onClick={() =>
												handleFormChange(
													"showTaxId",
													!formData.showTaxId,
												)
											}
											className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
											aria-label={
												formData.showTaxId
													? "Hide Tax ID"
													: "Show Tax ID"
											}
										>
											{formData.showTaxId ? (
												<EyeOff className="w-4 h-4" />
											) : (
												<Eye className="w-4 h-4" />
											)}
										</button>
									</div>
									<p className="text-xs text-muted-foreground">
										Format: XXX-XX-XXXX for SSN or
										XX-XXXXXXX for EIN
									</p>
								</div>

								<div className="space-y-2">
									<Label htmlFor="address-line1">
										Address Line 1{" "}
										<span className="text-destructive">
											*
										</span>
									</Label>
									<Input
										id="address-line1"
										type="text"
										value={formData.addressLine1}
										onChange={(e) =>
											handleFormChange(
												"addressLine1",
												e.target.value,
											)
										}
										placeholder="Street address"
										required
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="address-line2">
										Address Line 2
									</Label>
									<Input
										id="address-line2"
										type="text"
										value={formData.addressLine2}
										onChange={(e) =>
											handleFormChange(
												"addressLine2",
												e.target.value,
											)
										}
										placeholder="Apartment, suite, etc. (optional)"
									/>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="city">
											City{" "}
											<span className="text-destructive">
												*
											</span>
										</Label>
										<Input
											id="city"
											type="text"
											value={formData.city}
											onChange={(e) =>
												handleFormChange(
													"city",
													e.target.value,
												)
											}
											required
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="state">
											State{" "}
											<span className="text-destructive">
												*
											</span>
										</Label>
										<Input
											id="state"
											type="text"
											value={formData.state}
											onChange={(e) =>
												handleFormChange(
													"state",
													e.target.value,
												)
											}
											placeholder="CA"
											maxLength={2}
											required
										/>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor="postal-code">
										ZIP Code{" "}
										<span className="text-destructive">
											*
										</span>
									</Label>
									<Input
										id="postal-code"
										type="text"
										value={formData.postalCode}
										onChange={(e) =>
											handleFormChange(
												"postalCode",
												e.target.value,
											)
										}
										placeholder="94102"
										required
									/>
								</div>
							</div>
						</div>

						{/* Section 2: Contact Information */}
						<div className="space-y-4 border-t pt-4">
							<h3 className="font-semibold text-sm">
								Contact Information
							</h3>
							<div className="space-y-3">
								<div className="space-y-2">
									<Label htmlFor="email">
										Email{" "}
										<span className="text-destructive">
											*
										</span>
									</Label>
									<Input
										id="email"
										type="email"
										value={formData.email}
										onChange={(e) =>
											handleFormChange(
												"email",
												e.target.value,
											)
										}
										placeholder="your@email.com"
										required
									/>
									<p className="text-xs text-muted-foreground">
										For payment notifications
									</p>
								</div>

								<div className="space-y-2">
									<Label htmlFor="phone">Phone</Label>
									<Input
										id="phone"
										type="tel"
										value={formData.phone}
										onChange={(e) =>
											handleFormChange(
												"phone",
												e.target.value,
											)
										}
										placeholder="+1-555-0123"
									/>
									<p className="text-xs text-muted-foreground">
										Optional, recommended for account
										recovery
									</p>
								</div>
							</div>
						</div>

						{/* Section 3: Payment Method */}
						<div className="space-y-4 border-t pt-4">
							<h3 className="font-semibold text-sm">
								Payment Method
							</h3>
							<p className="text-xs text-muted-foreground mb-3">
								How would you like to receive payments?
							</p>

							<div className="space-y-3">
								<div className="flex items-center space-x-2">
									<input
										type="radio"
										id="method-paypal"
										name="payment-method"
										value="paypal"
										checked={settingsMethod === "paypal"}
										onChange={(e) =>
											setSettingsMethod(
												e.target.value as
													| "paypal"
													| "wise"
													| "zelle",
											)
										}
										className="w-4 h-4"
									/>
									<Label
										htmlFor="method-paypal"
										className="font-normal cursor-pointer"
									>
										PayPal
									</Label>
								</div>

								{settingsMethod === "paypal" && (
									<div className="ml-6 space-y-2">
										<Input
											type="email"
											value={formData.paypalEmail}
											onChange={(e) =>
												handleFormChange(
													"paypalEmail",
													e.target.value,
												)
											}
											placeholder="PayPal email address"
											required={
												settingsMethod === "paypal"
											}
										/>
										<p className="text-xs text-muted-foreground">
											Payments sent from our business
											PayPal account
										</p>
									</div>
								)}

								<div className="flex items-center space-x-2">
									<input
										type="radio"
										id="method-wise"
										name="payment-method"
										value="wise"
										checked={settingsMethod === "wise"}
										onChange={(e) =>
											setSettingsMethod(
												e.target.value as
													| "paypal"
													| "wise"
													| "zelle",
											)
										}
										className="w-4 h-4"
									/>
									<Label
										htmlFor="method-wise"
										className="font-normal cursor-pointer"
									>
										Wise (TransferWise)
									</Label>
								</div>

								{settingsMethod === "wise" && (
									<div className="ml-6 space-y-2">
										<Input
											type="email"
											value={formData.wiseEmail}
											onChange={(e) =>
												handleFormChange(
													"wiseEmail",
													e.target.value,
												)
											}
											placeholder="Wise email address"
											required={settingsMethod === "wise"}
										/>
										<Select
											value={formData.wiseCurrency}
											onValueChange={(value) =>
												handleFormChange(
													"wiseCurrency",
													value,
												)
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="USD">
													USD - US Dollar
												</SelectItem>
												<SelectItem value="EUR">
													EUR - Euro
												</SelectItem>
												<SelectItem value="GBP">
													GBP - British Pound
												</SelectItem>
												<SelectItem value="CAD">
													CAD - Canadian Dollar
												</SelectItem>
											</SelectContent>
										</Select>
										<p className="text-xs text-muted-foreground">
											You'll receive an email invitation
											to claim payment
										</p>
									</div>
								)}

								<div className="flex items-center space-x-2">
									<input
										type="radio"
										id="method-zelle"
										name="payment-method"
										value="zelle"
										checked={settingsMethod === "zelle"}
										onChange={(e) =>
											setSettingsMethod(
												e.target.value as
													| "paypal"
													| "wise"
													| "zelle",
											)
										}
										className="w-4 h-4"
									/>
									<Label
										htmlFor="method-zelle"
										className="font-normal cursor-pointer"
									>
										Zelle (US Only)
									</Label>
								</div>

								{settingsMethod === "zelle" && (
									<div className="ml-6 space-y-2">
										<Input
											type="text"
											value={formData.zelleEmailOrPhone}
											onChange={(e) =>
												handleFormChange(
													"zelleEmailOrPhone",
													e.target.value,
												)
											}
											placeholder="Email or phone number"
											required={
												settingsMethod === "zelle"
											}
										/>
										<Alert>
											<AlertCircle className="h-4 w-4" />
											<AlertDescription className="text-xs">
												Must be enrolled in Zelle.
												Payments sent from our Chase
												Business account. Zelle is
												instant and irreversible. Verify
												your details carefully.
											</AlertDescription>
										</Alert>
									</div>
								)}
							</div>
						</div>

						{/* W-9 Acknowledgment */}
						<div className="space-y-3 border-t pt-4">
							<div className="flex items-start space-x-2">
								<Checkbox
									id="w9-acknowledged"
									checked={formData.w9Acknowledged}
									onCheckedChange={(checked) =>
										handleFormChange(
											"w9Acknowledged",
											checked,
										)
									}
									required
								/>
								<Label
									htmlFor="w9-acknowledged"
									className="text-sm font-normal cursor-pointer"
								>
									I acknowledge this information is for IRS
									1099-NEC reporting and certify it is
									accurate{" "}
									<span className="text-destructive">*</span>
								</Label>
							</div>
							<p className="text-xs text-muted-foreground ml-6">
								All data is encrypted and stored securely. This
								information is required by federal law for tax
								reporting purposes.
							</p>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsSettingsDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" variant="primary">
								Save Settings
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Payout History */}
			<Card>
				<CardHeader>
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<div>
							<CardTitle>Payout History</CardTitle>
							<CardDescription>
								Track your payout requests and their status
							</CardDescription>
						</div>
						<Select
							value={statusFilter}
							onValueChange={(value) =>
								setStatusFilter(
									value as
										| "all"
										| "pending"
										| "processing"
										| "completed"
										| "rejected",
								)
							}
						>
							<SelectTrigger className="w-[180px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="pending">Pending</SelectItem>
								<SelectItem value="processing">
									Processing
								</SelectItem>
								<SelectItem value="completed">
									Completed
								</SelectItem>
								<SelectItem value="rejected">
									Rejected
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardHeader>
				<CardContent>
					{(() => {
						const filteredHistory = payoutHistory.filter(
							(p) =>
								statusFilter === "all" ||
								p.status === statusFilter,
						);

						const hasFilterMismatch =
							payoutHistory.length > 0 && statusFilter !== "all";

						return filteredHistory.length > 0 ? (
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="border-b text-sm text-muted-foreground">
											<th className="text-left py-3 px-4">
												Date Requested
											</th>
											<th className="text-left py-3 px-4">
												Amount
											</th>
											<th className="text-left py-3 px-4">
												Method
											</th>
											<th className="text-left py-3 px-4">
												Status
											</th>
											<th className="text-left py-3 px-4">
												Processed Date
											</th>
										</tr>
									</thead>
									<tbody>
										{filteredHistory.map((payout) => (
											<tr
												key={payout.id}
												className="border-b hover:bg-muted/5 transition-colors"
											>
												<td className="py-3 px-4 text-sm">
													{payout.dateRequested instanceof
													Date
														? payout.dateRequested.toLocaleDateString()
														: payout.dateRequested}
												</td>
												<td className="py-3 px-4 text-sm font-medium">
													$
													{payout.amount.toLocaleString(
														"en-US",
														{
															minimumFractionDigits: 2,
															maximumFractionDigits: 2,
														},
													)}
												</td>
												<td className="py-3 px-4 text-sm">
													{payout.method}
												</td>
												<td className="py-3 px-4 text-sm">
													{getStatusBadge(
														payout.status,
													)}
												</td>
												<td className="py-3 px-4 text-sm">
													{payout.processedDate
														? payout.processedDate instanceof
															Date
															? payout.processedDate.toLocaleDateString()
															: payout.processedDate
														: "-"}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<EmptyState
								icon={<Wallet className="size-6" />}
								title={
									hasFilterMismatch
										? "No matching payouts"
										: "No payouts yet"
								}
								description={
									hasFilterMismatch
										? "No payouts found with the selected status. Try switching filters."
										: "Once you request a payout, it will appear here with its status."
								}
							/>
						);
					})()}
				</CardContent>
			</Card>
		</div>
	);
}
