"use client";

import { Button } from "@ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@ui/components/dialog";
import { Input } from "@ui/components/input";
import { Progress } from "@ui/components/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";
import { useState } from "react";
import { DashboardHeader } from "@/modules/saas/tiktok-dashboard/components/dashboard-header";
import { Calendar, Plus, Target, Trash2 } from "@/modules/ui/icons";

interface GoalItem {
	id: string;
	name: string;
	type: string;
	typeColor: string;
	current: number;
	target: number;
	startDate: string;
	endDate: string;
}

const initialGoals: GoalItem[] = [
	{
		id: "1",
		name: "Daily Posting Streak",
		type: "Daily",
		typeColor: "bg-success",
		current: 5,
		target: 7,
		startDate: "Apr 1, 2026",
		endDate: "Apr 30, 2026",
	},
	{
		id: "2",
		name: "Weekly Content Goal",
		type: "Weekly",
		typeColor: "bg-blue-500",
		current: 8,
		target: 14,
		startDate: "Apr 1, 2026",
		endDate: "Apr 7, 2026",
	},
	{
		id: "3",
		name: "Monthly Upload Target",
		type: "Monthly",
		typeColor: "bg-amber-500",
		current: 22,
		target: 50,
		startDate: "Apr 1, 2026",
		endDate: "Apr 30, 2026",
	},
];

const typeColors: Record<string, string> = {
	Daily: "bg-success",
	Weekly: "bg-blue-500",
	Monthly: "bg-amber-500",
};

export default function GoalsPage() {
	const [goals, setGoals] = useState<GoalItem[]>(initialGoals);
	const [newGoal, setNewGoal] = useState({
		name: "",
		type: "Daily",
		target: "",
	});
	const [isOpen, setIsOpen] = useState(false);

	function handleAddGoal() {
		if (!newGoal.name || !newGoal.target) {
			return;
		}

		const goal: GoalItem = {
			id: Date.now().toString(),
			name: newGoal.name,
			type: newGoal.type,
			typeColor: typeColors[newGoal.type] ?? "bg-primary",
			current: 0,
			target: Number.parseInt(newGoal.target, 10),
			startDate: "Apr 10, 2026",
			endDate:
				newGoal.type === "Daily"
					? "Apr 10, 2026"
					: newGoal.type === "Weekly"
						? "Apr 17, 2026"
						: "May 10, 2026",
		};

		setGoals([...goals, goal]);
		setNewGoal({ name: "", type: "Daily", target: "" });
		setIsOpen(false);
	}

	function handleDeleteGoal(id: string) {
		setGoals(goals.filter((g) => g.id !== id));
	}

	return (
		<>
			<DashboardHeader title="Goals" showBack />
			<div className="p-4 md:p-6">
				<div className="mb-4 flex items-center justify-between">
					<p className="text-sm text-muted-foreground">
						Track your content creation progress
					</p>
					<Dialog open={isOpen} onOpenChange={setIsOpen}>
						<DialogTrigger asChild>
							<button
								type="button"
								className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-brand-glow md:shadow-brand-glow-desktop"
							>
								<Plus className="h-5 w-5" />
							</button>
						</DialogTrigger>
						<DialogContent className="mx-4 rounded-2xl">
							<DialogHeader>
								<DialogTitle>Create New Goal</DialogTitle>
							</DialogHeader>
							<div className="space-y-4 py-4">
								<div className="space-y-2">
									<label
										htmlFor="goal-name"
										className="text-sm font-medium text-foreground"
									>
										Goal Name
									</label>
									<Input
										id="goal-name"
										placeholder="e.g., Daily Posting Streak"
										value={newGoal.name}
										onChange={(e) =>
											setNewGoal({
												...newGoal,
												name: e.target.value,
											})
										}
									/>
								</div>
								<div className="space-y-2">
									<label
										htmlFor="goal-type"
										className="text-sm font-medium text-foreground"
									>
										Goal Type
									</label>
									<Select
										value={newGoal.type}
										onValueChange={(v) =>
											setNewGoal({
												...newGoal,
												type: v,
											})
										}
									>
										<SelectTrigger id="goal-type">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="Daily">
												Daily
											</SelectItem>
											<SelectItem value="Weekly">
												Weekly
											</SelectItem>
											<SelectItem value="Monthly">
												Monthly
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<label
										htmlFor="goal-target"
										className="text-sm font-medium text-foreground"
									>
										Target Posts
									</label>
									<Input
										id="goal-target"
										type="number"
										placeholder="e.g., 7"
										value={newGoal.target}
										onChange={(e) =>
											setNewGoal({
												...newGoal,
												target: e.target.value,
											})
										}
									/>
								</div>
							</div>
							<DialogFooter className="gap-2">
								<Button
									variant="outline"
									className="flex-1"
									onClick={() => setIsOpen(false)}
								>
									Cancel
								</Button>
								<Button
									variant="primary"
									className="flex-1"
									onClick={handleAddGoal}
								>
									Create Goal
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>

				{goals.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-16 shadow-flat">
						<Target className="h-6 w-6 text-muted-foreground" />
						<h3 className="mt-4 font-serif font-semibold tracking-tight text-foreground">
							No goals yet
						</h3>
						<p className="mt-1 text-sm text-muted-foreground">
							Create your first goal to start tracking your
							content creation progress.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{goals.map((goal) => {
							const progress = Math.round(
								(goal.current / goal.target) * 100,
							);
							return (
								<div
									key={goal.id}
									className="rounded-2xl border border-border bg-card p-4 shadow-flat"
								>
									<div className="flex items-start justify-between">
										<div className="flex items-center gap-3">
											<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
												<Target className="h-5 w-5 text-primary" />
											</div>
											<div>
												<h3 className="font-medium text-foreground">
													{goal.name}
												</h3>
												<span
													className={`${goal.typeColor} mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white`}
												>
													{goal.type}
												</span>
											</div>
										</div>
										<button
											type="button"
											onClick={() =>
												handleDeleteGoal(goal.id)
											}
											className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
										>
											<Trash2 className="h-4 w-4" />
										</button>
									</div>

									<div className="mt-4">
										<div className="mb-2 flex items-end justify-between">
											<span className="text-2xl font-bold text-primary">
												{progress}%
											</span>
											<span className="text-sm text-foreground">
												{goal.current} / {goal.target}{" "}
												posts
											</span>
										</div>
										<Progress
											value={progress}
											className="h-2 bg-border [&>div]:bg-primary"
										/>
									</div>

									<div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
										<Calendar className="h-3.5 w-3.5" />
										{goal.startDate} - {goal.endDate}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</>
	);
}
