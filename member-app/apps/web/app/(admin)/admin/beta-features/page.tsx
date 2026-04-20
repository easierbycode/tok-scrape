"use client";

import { UserAvatar } from "@shared/components/UserAvatar";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@ui/components/badge";
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
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@ui/components/dialog";
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
import { useState } from "react";
import { toast } from "sonner";
import { Edit, Settings, UserPlus } from "@/modules/ui/icons";

export default function BetaFeaturesPage() {
	const queryClient = useQueryClient();
	const [selectedFeature, setSelectedFeature] = useState<string>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [managingUser, setManagingUser] = useState<any>(null);
	const [addTesterOpen, setAddTesterOpen] = useState(false);
	const [editingFeature, setEditingFeature] = useState<any>(null);

	// Fetch available features
	const { data: features = [] } = useQuery(
		orpc.admin.betaFeatures.listAvailable.queryOptions({
			input: undefined,
		}),
	);

	// Fetch beta testers
	const { data: testers = [] } = useQuery(
		orpc.admin.betaFeatures.listTesters.queryOptions({
			input: {
				featureId:
					selectedFeature === "all" ? undefined : selectedFeature,
			},
		}),
	);

	// Fetch all users for "Add Tester" dialog
	const { data: allUsersData } = useQuery(
		orpc.admin.users.list.queryOptions({
			input: {
				searchTerm: "",
			},
		}),
	);
	const allUsers = allUsersData?.users || [];

	// Update mutation
	const updateMutation = useMutation(
		orpc.admin.betaFeatures.updateFeatures.mutationOptions(),
	);

	// Add tester mutation
	const addMutation = useMutation(
		orpc.admin.betaFeatures.updateFeatures.mutationOptions(),
	);

	// Update feature mutation
	const updateFeatureMutation = useMutation(
		orpc.admin.betaFeatures.updateFeature.mutationOptions(),
	);

	const filteredTesters = testers.filter(
		(user: any) =>
			user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			user.email.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const handleUpdateFeatures = (userId: string, featureIds: string[]) => {
		updateMutation.mutate(
			{
				userId,
				featureIds,
			},
			{
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: orpc.admin.betaFeatures.listTesters.key(),
					});
					toast.success("Beta access updated!");
					setManagingUser(null);
				},
				onError: (error: any) => {
					toast.error(error.message || "Failed to update");
				},
			},
		);
	};

	const handleAddTester = (userId: string, featureIds: string[]) => {
		addMutation.mutate(
			{
				userId,
				featureIds,
			},
			{
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: orpc.admin.betaFeatures.listTesters.key(),
					});
					toast.success("Beta tester added!");
					setAddTesterOpen(false);
				},
				onError: (error: any) => {
					toast.error(error.message || "Failed to add tester");
				},
			},
		);
	};

	return (
		<div className="container mx-auto py-8 space-y-8">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold">Beta Features Management</h1>
				<p className="text-muted-foreground mt-2">
					Private beta testing for new features
				</p>
			</div>

			{/* Features Overview Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{features.map((feature: any) => {
					const testerCount = testers.filter((t: any) =>
						t.betaFeatures.includes(feature.id),
					).length;

					return (
						<Card key={feature.id}>
							<CardHeader>
								<CardTitle className="flex items-center justify-between text-lg">
									{feature.name}
									<div className="flex items-center gap-2">
										<Badge status="info">
											{testerCount} tester
											{testerCount !== 1 ? "s" : ""}
										</Badge>
										<Button
											variant="ghost"
											size="sm"
											onClick={() =>
												setEditingFeature(feature)
											}
										>
											<Edit className="h-4 w-4" />
										</Button>
									</div>
								</CardTitle>
								<CardDescription>
									{feature.description}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="text-sm text-muted-foreground space-y-1">
									<p>
										Category:{" "}
										<span className="capitalize">
											{feature.category}
										</span>
									</p>
									<p>
										Added:{" "}
										{new Date(
											feature.addedDate,
										).toLocaleDateString()}
									</p>
									{feature.estimatedReleaseDate && (
										<p>
											Est. Release:{" "}
											{new Date(
												feature.estimatedReleaseDate,
											).toLocaleDateString()}
										</p>
									)}
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>

			{/* Tester Management */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Beta Testers</CardTitle>
							<CardDescription>
								{filteredTesters.length} tester
								{filteredTesters.length !== 1 ? "s" : ""}
							</CardDescription>
						</div>
						<AddTesterDialog
							open={addTesterOpen}
							onOpenChange={setAddTesterOpen}
							features={features}
							users={allUsers}
							existingTesters={testers}
							onAdd={handleAddTester}
						/>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Filters */}
					<div className="flex gap-4">
						<Input
							placeholder="Search by name or email..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="flex-1"
						/>
						<Select
							value={selectedFeature}
							onValueChange={setSelectedFeature}
						>
							<SelectTrigger className="w-[200px]">
								<SelectValue placeholder="All Features" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">
									All Features
								</SelectItem>
								{features.map((feature: any) => (
									<SelectItem
										key={feature.id}
										value={feature.id}
									>
										{feature.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Tester List */}
					<div className="space-y-2">
						{filteredTesters.length === 0 ? (
							<p className="text-center text-muted-foreground py-8">
								No beta testers yet. Click "Add Tester" to get
								started.
							</p>
						) : (
							filteredTesters.map((user: any) => (
								<div
									key={user.id}
									className="flex items-center justify-between p-4 border rounded-lg"
								>
									<div className="flex items-center gap-4">
										<UserAvatar
											name={user.name ?? user.email}
											avatarUrl={user.image || undefined}
										/>
										<div>
											<p className="font-medium">
												{user.name || "No name"}
											</p>
											<p className="text-sm text-muted-foreground">
												{user.email}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-2">
										<div className="flex flex-wrap gap-1">
											{user.betaFeatures.map(
												(featureId: string) => (
													<Badge
														key={featureId}
														status="info"
													>
														{features.find(
															(f: any) =>
																f.id ===
																featureId,
														)?.name || featureId}
													</Badge>
												),
											)}
										</div>
										<Button
											variant="ghost"
											size="sm"
											onClick={() =>
												setManagingUser(user)
											}
										>
											<Settings className="h-4 w-4 mr-2" />
											Manage
										</Button>
									</div>
								</div>
							))
						)}
					</div>
				</CardContent>
			</Card>

			{/* Manage User Dialog */}
			{managingUser && (
				<ManageUserDialog
					user={managingUser}
					features={features}
					onClose={() => setManagingUser(null)}
					onSave={(featureIds) => {
						handleUpdateFeatures(managingUser.id, featureIds);
					}}
				/>
			)}

			{/* Edit Feature Dialog */}
			{editingFeature && (
				<EditFeatureDialog
					feature={editingFeature}
					onClose={() => setEditingFeature(null)}
					onSave={(data) => {
						updateFeatureMutation.mutate(data, {
							onSuccess: () => {
								queryClient.invalidateQueries({
									queryKey:
										orpc.admin.betaFeatures.listAvailable.key(),
								});
								toast.success("Feature updated!");
								setEditingFeature(null);
							},
							onError: (error: any) => {
								toast.error(
									error.message || "Failed to update feature",
								);
							},
						});
					}}
				/>
			)}
		</div>
	);
}

// Add Tester Dialog Component
function AddTesterDialog({
	open,
	onOpenChange,
	features,
	users,
	existingTesters,
	onAdd,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	features: any[];
	users: any[];
	existingTesters: any[];
	onAdd: (userId: string, featureIds: string[]) => void;
}) {
	const [selectedUser, setSelectedUser] = useState("");
	const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

	const availableUsers = users.filter(
		(u) => !existingTesters.some((t) => t.id === u.id),
	);

	const handleAdd = () => {
		if (selectedUser && selectedFeatures.length > 0) {
			onAdd(selectedUser, selectedFeatures);
			setSelectedUser("");
			setSelectedFeatures([]);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button>
					<UserPlus className="h-4 w-4 mr-2" />
					Add Tester
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add Beta Tester</DialogTitle>
					<DialogDescription>
						Select a user and the features they should have access
						to
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div>
						<div className="text-sm font-medium mb-2 block">
							Select User
						</div>
						<Select
							value={selectedUser}
							onValueChange={setSelectedUser}
						>
							<SelectTrigger>
								<SelectValue placeholder="Choose a user..." />
							</SelectTrigger>
							<SelectContent>
								{availableUsers.map((user) => (
									<SelectItem key={user.id} value={user.id}>
										{user.name || user.email} ({user.email})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div>
						<div className="text-sm font-medium mb-2 block">
							Select Features
						</div>
						<div className="space-y-2">
							{features.map((feature) => (
								<div
									key={feature.id}
									className="flex items-start space-x-2"
								>
									<Checkbox
										id={feature.id}
										checked={selectedFeatures.includes(
											feature.id,
										)}
										onCheckedChange={(checked) => {
											setSelectedFeatures((prev) =>
												checked
													? [...prev, feature.id]
													: prev.filter(
															(id) =>
																id !==
																feature.id,
														),
											);
										}}
									/>
									<label
										htmlFor={feature.id}
										className="text-sm cursor-pointer"
									>
										<div className="font-medium">
											{feature.name}
										</div>
										<div className="text-xs text-muted-foreground">
											{feature.description}
										</div>
									</label>
								</div>
							))}
						</div>
					</div>

					<div className="flex justify-end gap-2">
						<Button
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleAdd}
							disabled={
								!selectedUser || selectedFeatures.length === 0
							}
						>
							Add Tester
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// Manage User Dialog Component
function ManageUserDialog({
	user,
	features,
	onClose,
	onSave,
}: {
	user: any;
	features: any[];
	onClose: () => void;
	onSave: (featureIds: string[]) => void;
}) {
	const [selectedFeatures, setSelectedFeatures] = useState<string[]>(
		user.betaFeatures || [],
	);

	return (
		<Dialog open={true} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						Manage Beta Access - {user.name || user.email}
					</DialogTitle>
					<DialogDescription>{user.email}</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div>
						<div className="text-sm font-medium mb-2 block">
							Beta Features
						</div>
						<div className="space-y-2">
							{features.map((feature) => (
								<div
									key={feature.id}
									className="flex items-start space-x-2 p-3 border rounded"
								>
									<Checkbox
										id={`manage-${feature.id}`}
										checked={selectedFeatures.includes(
											feature.id,
										)}
										onCheckedChange={(checked) => {
											setSelectedFeatures((prev) =>
												checked
													? [...prev, feature.id]
													: prev.filter(
															(id) =>
																id !==
																feature.id,
														),
											);
										}}
									/>
									<label
										htmlFor={`manage-${feature.id}`}
										className="text-sm cursor-pointer flex-1"
									>
										<div className="font-medium">
											{feature.name}
										</div>
										<div className="text-xs text-muted-foreground">
											{feature.description}
										</div>
										{feature.estimatedReleaseDate && (
											<div className="text-xs text-muted-foreground mt-1">
												Est. Release:{" "}
												{new Date(
													feature.estimatedReleaseDate,
												).toLocaleDateString()}
											</div>
										)}
									</label>
								</div>
							))}
						</div>
					</div>

					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button onClick={() => onSave(selectedFeatures)}>
							Save Changes
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// Edit Feature Dialog Component
function EditFeatureDialog({
	feature,
	onClose,
	onSave,
}: {
	feature: any;
	onClose: () => void;
	onSave: (data: any) => void;
}) {
	const [formData, setFormData] = useState({
		id: feature.id,
		name: feature.name,
		description: feature.description,
		category: feature.category,
		addedDate: feature.addedDate.split("T")[0], // Convert to YYYY-MM-DD
		estimatedReleaseDate: feature.estimatedReleaseDate
			? feature.estimatedReleaseDate.split("T")[0]
			: "",
		status: feature.status,
	});

	return (
		<Dialog open={true} onOpenChange={onClose}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Edit Beta Feature</DialogTitle>
					<DialogDescription>
						Update feature metadata and release information
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div>
						<Label htmlFor="name">Feature Name</Label>
						<Input
							id="name"
							value={formData.name}
							onChange={(e) =>
								setFormData({
									...formData,
									name: e.target.value,
								})
							}
						/>
					</div>

					<div>
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={formData.description}
							onChange={(e) =>
								setFormData({
									...formData,
									description: e.target.value,
								})
							}
							rows={3}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<Label htmlFor="category">Category</Label>
							<Select
								value={formData.category}
								onValueChange={(value) =>
									setFormData({
										...formData,
										category: value,
									})
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="content">
										Content
									</SelectItem>
									<SelectItem value="commerce">
										Commerce
									</SelectItem>
									<SelectItem value="other">Other</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label htmlFor="status">Status</Label>
							<Select
								value={formData.status}
								onValueChange={(value) =>
									setFormData({ ...formData, status: value })
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="active">
										Active
									</SelectItem>
									<SelectItem value="graduating">
										Graduating
									</SelectItem>
									<SelectItem value="released">
										Released
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<Label htmlFor="addedDate">Added Date</Label>
							<Input
								id="addedDate"
								type="date"
								value={formData.addedDate}
								onChange={(e) =>
									setFormData({
										...formData,
										addedDate: e.target.value,
									})
								}
							/>
						</div>

						<div>
							<Label htmlFor="estimatedReleaseDate">
								Est. Release Date (Optional)
							</Label>
							<Input
								id="estimatedReleaseDate"
								type="date"
								value={formData.estimatedReleaseDate}
								onChange={(e) =>
									setFormData({
										...formData,
										estimatedReleaseDate: e.target.value,
									})
								}
							/>
						</div>
					</div>

					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button onClick={() => onSave(formData)}>
							Save Changes
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
