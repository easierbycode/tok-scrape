import { db } from "../client";

/**
 * Help Center Redesign Seed
 *
 * Creates the new buyer/member IA with all categories and articles.
 * Deletes all existing help center content first.
 *
 * Run: npx tsx packages/database/prisma/seeds/help-center-redesign-seed.ts
 */
async function seed() {
	console.log("Deleting existing help center content...");
	await db.helpArticle.deleteMany();
	await db.helpCategory.deleteMany();
	console.log("Existing content deleted.\n");

	// ─── Categories ───────────────────────────────────────────────

	const categories = [
		{
			slug: "before-you-join",
			title: "Before You Join",
			description:
				"Learn what LifePreneur is, what membership includes, and how to get started",
			icon: "Sparkles",
			order: 0,
			published: true,
		},
		{
			slug: "trust-and-policies",
			title: "Trust & Policies",
			description:
				"Cancellation, refunds, and what happens if something goes wrong with billing",
			icon: "ShieldCheck",
			order: 1,
			published: true,
		},
		{
			slug: "start-here",
			title: "Start Here",
			description:
				"First steps after joining — set up your profile, find your way around, and get connected",
			icon: "Rocket",
			order: 2,
			published: true,
		},
		{
			slug: "community",
			title: "Community",
			description:
				"Connect with other members, join Discord, attend live sessions, and participate",
			icon: "Users",
			order: 3,
			published: true,
		},
		{
			slug: "tiktok-shop-and-the-program",
			title: "TikTok Shop & The Program",
			description:
				"Fundamentals of TikTok Shop and how to get the most out of the LifePreneur program",
			icon: "GraduationCap",
			order: 4,
			published: true,
		},
		{
			slug: "billing-and-subscription",
			title: "Billing & Subscription",
			description:
				"Upgrade, manage, or update your membership and payment details",
			icon: "CreditCard",
			order: 5,
			published: true,
		},
		{
			slug: "account-and-security",
			title: "Account & Security",
			description:
				"Password, email, two-factor authentication, passkeys, and session management",
			icon: "Shield",
			order: 6,
			published: true,
		},
		{
			slug: "affiliate",
			title: "Affiliate",
			description:
				"Your affiliate link, referral tracking, and commission information",
			icon: "HandCoins",
			order: 7,
			published: true,
		},
	];

	const categoryMap: Record<string, string> = {};
	for (const cat of categories) {
		const created = await db.helpCategory.create({ data: cat });
		categoryMap[cat.slug] = created.id;
		console.log(`Created category: ${cat.title}`);
	}

	// ─── Articles ─────────────────────────────────────────────────

	const articles = [
		// ══════════════════════════════════════════════════════════
		// BUYER PATH — "Before You Join"
		// ══════════════════════════════════════════════════════════
		{
			slug: "what-is-lifepreneur",
			title: "!! What is LifePreneur?",
			excerpt:
				"An overview of what LifePreneur is and who it's for",
			categorySlug: "before-you-join",
			audience: "buyer",
			subsection: null,
			featured: true,
			order: 0,
			content: `# What is LifePreneur?

> **This article needs your input.** The structure is ready — fill in the sections below with your positioning and voice.

## What We Do

Describe LifePreneur in 2–3 sentences. What problem does it solve? Who is it for?

## Who It's For

- What kind of creator or entrepreneur benefits most?
- What stage are they at (beginner, intermediate, experienced)?
- What mindset or commitment level should they have?

## What Makes It Different

- How is this different from free TikTok Shop content or other courses?
- What's the community angle?

## Ready to Join?

Visit our [pricing page](/pricing) to see membership options.

---

**Related articles:**
- [What's included with membership](/helpcenter/before-you-join/whats-included-with-membership)
- [Community and live sessions](/helpcenter/before-you-join/community-and-live-sessions)`,
		},
		{
			slug: "whats-included-with-membership",
			title: "!! What's Included with Membership",
			excerpt:
				"Everything you get when you join LifePreneur",
			categorySlug: "before-you-join",
			audience: "buyer",
			subsection: null,
			featured: true,
			order: 1,
			content: `# What's Included with Membership

> **This article needs your input.** Verify these sections match what all paying members receive today.

## Community Access

- Private Discord server with dedicated channels
- Connect with other creators at every stage
- Daily interaction and support from fellow members

## Live Sessions

- Live training sessions held inside Discord
- Opportunity to ask questions in real time
- Session replays available in the community

## Affiliate Program

- Earn commissions by referring others
- Personal referral link and analytics dashboard
- Details on the [affiliate page](/app/affiliate) once you're a member

## What's Not Included

List anything people commonly expect that isn't part of membership (to set clear expectations).

---

**Related articles:**
- [What is LifePreneur?](/helpcenter/before-you-join/what-is-lifepreneur)
- [How membership and billing work](/helpcenter/before-you-join/how-membership-and-billing-work)`,
		},
		{
			slug: "how-membership-and-billing-work",
			title: "How Membership and Billing Work",
			excerpt:
				"Plans, renewal, and where to manage billing after you join",
			categorySlug: "before-you-join",
			audience: "buyer",
			subsection: null,
			featured: false,
			order: 2,
			content: `# How Membership and Billing Work

## Choosing a Plan

Visit our [pricing page](/pricing) to see the current membership options. Plans are billed through Stripe, a trusted payment processor used by millions of businesses.

## What Happens After Purchase

1. Your payment is processed securely through Stripe
2. Your LifePreneur account is created automatically using the email you provide
3. You receive a confirmation email
4. You can log in immediately and start the onboarding process

## Billing and Renewal

- Your membership renews automatically at the end of each billing period
- You'll receive an email before each renewal
- You can view your plan and billing details anytime under **Settings → Billing** in your account

## Managing Your Subscription Later

Once you're a member, you can manage everything from your account:
- View your current plan
- Update your payment method
- Cancel if needed

For current plan pricing, see the [pricing page](/pricing).

---

**Related articles:**
- [What's included with membership](/helpcenter/before-you-join/whats-included-with-membership)
- [How to create your account and sign in](/helpcenter/before-you-join/how-to-create-your-account)`,
		},
		{
			slug: "how-to-create-your-account",
			title: "How to Create Your Account and Sign In",
			excerpt:
				"What happens after checkout and how to log in for the first time",
			categorySlug: "before-you-join",
			audience: "buyer",
			subsection: null,
			featured: false,
			order: 3,
			content: `# How to Create Your Account and Sign In

## Account Creation

Your account is created automatically when you complete your purchase. There's no separate signup step — checkout and account creation happen together.

**What you'll need:**
- The email address you used during checkout

## First Login

1. Go to the [login page](/auth/login)
2. Enter the email address you used at checkout
3. Choose your sign-in method (email/password or Google if you linked it)

## Onboarding

After your first login, you'll be guided through a short onboarding process:
- Set up your name and profile basics
- Connect your Discord account to join the community

The entire process takes just a few minutes.

## Trouble Signing In?

- **Forgot password?** Use the [forgot password page](/auth/forgot-password) to reset it
- **Used Google to sign up?** Make sure you're clicking "Sign in with Google" on the login page
- **Not receiving emails?** Check your spam/junk folder

---

**Related articles:**
- [How membership and billing work](/helpcenter/before-you-join/how-membership-and-billing-work)
- [What to do first as a new member](/helpcenter/start-here/what-to-do-first)`,
		},
		{
			slug: "community-and-live-sessions",
			title: "!! Community and Live Sessions",
			excerpt:
				"Overview of the LifePreneur community and how live sessions work",
			categorySlug: "before-you-join",
			audience: "buyer",
			subsection: null,
			featured: false,
			order: 4,
			content: `# Community and Live Sessions

> **This article needs your input.** Fill in the details about how your community and sessions actually run.

## The Community

LifePreneur members connect through a private Discord server. This isn't a passive group — it's an active community where members:
- Share progress and wins
- Ask questions and get feedback
- Support each other's growth

## Live Sessions

Live training sessions happen inside Discord. Describe:
- How often do they happen? (daily, weekly, etc.)
- What format are they? (voice stage, video, screen share?)
- Who runs them?
- Are replays available? Where?
- What topics do they typically cover?

## Before You Join

The community is private — you get access after purchasing a membership and connecting your Discord account. The connection process takes less than 5 minutes.

---

**Related articles:**
- [What's included with membership](/helpcenter/before-you-join/whats-included-with-membership)
- [What is LifePreneur?](/helpcenter/before-you-join/what-is-lifepreneur)`,
		},

		// ══════════════════════════════════════════════════════════
		// BUYER PATH — "Trust & Policies"
		// ══════════════════════════════════════════════════════════
		{
			slug: "cancelling-your-membership",
			title: "Cancelling Your Membership",
			excerpt:
				"How cancellation works and what to expect",
			categorySlug: "trust-and-policies",
			audience: "buyer",
			subsection: null,
			featured: true,
			order: 0,
			content: `# Cancelling Your Membership

## Can I Cancel?

Yes. You can cancel your membership at any time — no contracts, no cancellation fees.

## How to Cancel

1. Log in to your account
2. Go to **Settings → Billing**
3. Click **Manage Subscription**
4. Follow the steps in the Stripe billing portal to cancel

## What Happens After Cancellation

- You keep full access until the end of your current billing period
- You will not be charged again after cancellation
- At the end of your paid period, access to the community, Discord, and member features is removed

## Full Policy

For the complete cancellation and refund terms, see our [Terms and Conditions](/legal/terms) (Section 9) and [Refund Policy](/legal/refunds).

---

**Related articles:**
- [Refunds and billing questions](/helpcenter/trust-and-policies/refunds-and-billing-questions)
- [How membership and billing work](/helpcenter/before-you-join/how-membership-and-billing-work)`,
		},
		{
			slug: "refunds-and-billing-questions",
			title: "Refunds and Billing Questions",
			excerpt:
				"Where to find our refund policy and how to get billing help",
			categorySlug: "trust-and-policies",
			audience: "buyer",
			subsection: null,
			featured: false,
			order: 1,
			content: `# Refunds and Billing Questions

## Refund Policy

Our full refund policy is available on the [Refund Policy page](/legal/refunds). It covers eligibility, timelines, and the request process.

## Quick Summary

- We offer a money-back guarantee for initial purchases — see the [Refund Policy](/legal/refunds) for the current terms and timeframe
- Subscription renewals are generally not eligible for refunds
- All refund requests should be directed to support

## Billing Questions

If you have a question about a charge or your billing:
1. Check **Settings → Billing** in your account for your current plan and payment history
2. If something looks wrong, [contact support](/contact)

## Need Help?

For any billing concern, reach out to our support team through the [contact page](/contact).

---

**Related articles:**
- [Cancelling your membership](/helpcenter/trust-and-policies/cancelling-your-membership)
- [If a payment fails](/helpcenter/trust-and-policies/if-a-payment-fails)`,
		},
		{
			slug: "if-a-payment-fails",
			title: "If a Payment Fails",
			excerpt:
				"What happens when a payment doesn't go through and how to fix it",
			categorySlug: "trust-and-policies",
			audience: "buyer",
			subsection: null,
			featured: false,
			order: 2,
			content: `# If a Payment Fails

## What Happens

If your payment fails during a renewal:
- You'll receive an email notification from us
- You enter a **grace period** where you keep full access while you fix the issue
- Stripe will automatically retry the payment

## How to Fix It

1. Log in to your account
2. Go to **Settings → Billing**
3. Click **Manage Subscription**
4. Update your payment method in the Stripe billing portal
5. Once updated, the payment will be retried automatically

## Common Reasons for Failure

- Expired card
- Insufficient funds
- Bank security block
- Card was replaced or canceled

## What If I Don't Fix It?

If the payment isn't resolved during the grace period, your access will be suspended. You won't lose your account — you can reactivate anytime by updating your payment method.

For the full policy details, see our [Terms and Conditions](/legal/terms).

---

**Related articles:**
- [Refunds and billing questions](/helpcenter/trust-and-policies/refunds-and-billing-questions)
- [How membership and billing work](/helpcenter/before-you-join/how-membership-and-billing-work)`,
		},

		// ══════════════════════════════════════════════════════════
		// MEMBER PATH — "Start Here"
		// ══════════════════════════════════════════════════════════
		{
			slug: "what-to-do-first",
			title: "What to Do First as a New Member",
			excerpt:
				"Your first steps after joining LifePreneur",
			categorySlug: "start-here",
			audience: "member",
			subsection: null,
			featured: true,
			order: 0,
			content: `# What to Do First as a New Member

Welcome to LifePreneur! Here's how to get set up and make the most of your membership.

## Step 1: Complete Onboarding

After your first login you'll be guided through a short setup:
- Enter your name
- Set up your profile basics

## Step 2: Connect Discord

This is the most important step. The community lives on Discord, and live sessions happen there too.

1. Go to the **Community** page in your account
2. Click **Connect Discord**
3. Authorize the connection
4. You'll automatically be added to the private server with the right roles

For detailed steps, see [Connect your Discord account](/helpcenter/community/connect-your-discord-account).

## Step 3: Explore Your Account

Your main navigation includes:
- **Community** — your home base, announcements, and Discord connection
- **Affiliate** — your referral link and stats (once you've signed up for the program)
- **Settings** — profile, billing, security, and account management

## Step 4: Jump Into the Community

Once you're in Discord:
- Introduce yourself
- Check the schedule for upcoming live sessions
- Browse the channels and start engaging

---

**Related articles:**
- [Where everything lives in the app](/helpcenter/start-here/where-everything-lives)
- [Connect your Discord account](/helpcenter/community/connect-your-discord-account)
- [Your profile](/helpcenter/start-here/your-profile)`,
		},
		{
			slug: "where-everything-lives",
			title: "Where Everything Lives in the App",
			excerpt:
				"A quick tour of the main sections and navigation",
			categorySlug: "start-here",
			audience: "member",
			subsection: null,
			featured: false,
			order: 1,
			content: `# Where Everything Lives in the App

## Main Navigation

When you log in, you'll see these sections in the sidebar:

### Community
Your home base. This is where you'll find:
- Discord connection status
- Announcements from the team
- Quick links to community resources

### Affiliate
Your affiliate dashboard — copy your referral link, see your visitors, conversions, and commission stats. If you haven't joined the affiliate program yet, you'll see a signup prompt.

### Settings
Account management, broken into sections:
- **General** — name, avatar, email, notification preferences
- **Security** — password, connected accounts (Google), passkeys, two-factor authentication, active sessions
- **Billing** — current plan, payment method, manage subscription through Stripe
- **Danger Zone** — delete your account (permanent)

## User Menu

Click your profile icon in the bottom-left to access:
- Account Settings
- Help Center
- Home (marketing site)
- Sign out

## Need Help?

If you can't find something, use the search in the [Help Center](/helpcenter) or [contact support](/contact).

---

**Related articles:**
- [What to do first as a new member](/helpcenter/start-here/what-to-do-first)
- [Your profile](/helpcenter/start-here/your-profile)`,
		},
		{
			slug: "your-profile",
			title: "Your Profile",
			excerpt:
				"How to set up and update your profile details",
			categorySlug: "start-here",
			audience: "member",
			subsection: null,
			featured: false,
			order: 2,
			content: `# Your Profile

## Setting Up Your Profile

Your profile is configured in **Settings → General**. Here's what you can set:

### Avatar
Upload a profile picture that will be visible across the platform.

### Name
Your display name — this is how other members and the system refer to you.

### Email
The email address associated with your account. This is used for login and all communications.

### Notification Email
Optionally set a different email for notifications if you don't want them going to your primary address.

## Updating Your Profile Later

You can change any of these details at any time:

1. Click your profile icon (bottom-left)
2. Select **Account Settings**
3. You'll land on the **General** tab
4. Update any field and save

## Tips

- Use a real photo for your avatar — it helps build trust in the community
- Keep your email up to date so you don't miss important notifications or billing alerts

---

**Related articles:**
- [Where everything lives in the app](/helpcenter/start-here/where-everything-lives)
- [Password, email, and linked sign-in](/helpcenter/account-and-security/password-email-and-linked-sign-in)`,
		},

		// ══════════════════════════════════════════════════════════
		// MEMBER PATH — "Community" (subsection: discord)
		// ══════════════════════════════════════════════════════════
		{
			slug: "connect-your-discord-account",
			title: "Connect Your Discord Account",
			excerpt:
				"Link your Discord account to get access to the private server",
			categorySlug: "community",
			audience: "member",
			subsection: "discord",
			featured: true,
			order: 0,
			content: `# Connect Your Discord Account

Connecting Discord is how you get into the private LifePreneur community and access live sessions.

## How to Connect

1. Go to the **Community** page in your account
2. Click **Connect Discord**
3. You'll be redirected to Discord to authorize the connection
4. Once authorized, you're brought back to LifePreneur
5. Your Discord account is now linked and your roles are automatically assigned

## What Happens After Connecting

- You're added to the private LifePreneur Discord server
- Your member role is granted automatically based on your subscription
- You can now see all member channels and join live sessions

## Already Have a Discord Account?

Great — just make sure you're logged into the Discord account you want to use before clicking Connect. If you're logged into the wrong account, log out of Discord first.

## Don't Have Discord Yet?

1. Go to [discord.com](https://discord.com) and create a free account
2. Come back to LifePreneur and follow the steps above

## Troubleshooting

- **Connection didn't work?** Try again — sometimes the OAuth redirect times out
- **Not seeing the server?** Make sure you completed the authorization step in Discord
- **Wrong Discord account linked?** Contact support to unlink and reconnect

---

**Related articles:**
- [Join the LifePreneur Discord server](/helpcenter/community/join-the-discord-server)
- [What to do first as a new member](/helpcenter/start-here/what-to-do-first)`,
		},
		{
			slug: "join-the-discord-server",
			title: "Join the LifePreneur Discord Server",
			excerpt:
				"How to get into the server and what to expect",
			categorySlug: "community",
			audience: "member",
			subsection: "discord",
			featured: false,
			order: 1,
			content: `# Join the LifePreneur Discord Server

## Getting Access

After you [connect your Discord account](/helpcenter/community/connect-your-discord-account), you're automatically added to the private server with the appropriate member role. There's no separate invite link needed.

## What You'll Find

The server is organized into channels by topic. You'll typically see:
- Welcome and rules channels
- General discussion
- Channels for specific topics and strategies
- Voice/stage channels for live sessions
- Announcements from the team

## First Thing to Do

Introduce yourself! Most communities have an introductions channel — say hello, share what you're working on, and start connecting.

## Can't See the Server?

If you've connected Discord but can't find the server:
- Check your Discord server list (left sidebar in Discord)
- Make sure you completed the OAuth authorization
- Try disconnecting and reconnecting from the Community page in your account
- If the issue persists, [contact support](/contact)

---

**Related articles:**
- [Connect your Discord account](/helpcenter/community/connect-your-discord-account)
- [Live sessions in Discord](/helpcenter/community/live-sessions-in-discord)`,
		},
		{
			slug: "live-sessions-in-discord",
			title: "!! Live Sessions in Discord",
			excerpt:
				"Where live sessions happen, how to join, and what to expect",
			categorySlug: "community",
			audience: "member",
			subsection: "discord",
			featured: true,
			order: 2,
			content: `# Live Sessions in Discord

> **This article needs your input.** Fill in the specifics about how your live sessions run.

## Where Sessions Happen

Live sessions take place inside the LifePreneur Discord server. Describe:
- Which channel or voice stage?
- Do members need to be in a specific role to join?

## Schedule

- How often do sessions happen? (daily, weekly, specific days?)
- What time zone?
- Where is the schedule posted? (Discord channel, announcement, calendar?)

## How to Join

1. Open Discord
2. Navigate to [channel name]
3. Join the voice/stage channel when the session starts

## What to Expect

Describe the format:
- Who hosts?
- Is it Q&A, presentation, workshop, or mixed?
- How long do sessions typically last?
- Can members ask questions during the session?

## Recordings / Replays

- Are sessions recorded?
- Where are replays available? (Discord channel, app, etc.)
- How long are they available?

---

**Related articles:**
- [Join the LifePreneur Discord server](/helpcenter/community/join-the-discord-server)
- [Community guidelines](/helpcenter/community/community-guidelines)`,
		},
		// Community — subsection: norms
		{
			slug: "community-guidelines",
			title: "!! Community Guidelines",
			excerpt:
				"How to participate in the LifePreneur community",
			categorySlug: "community",
			audience: "member",
			subsection: "norms",
			featured: false,
			order: 3,
			content: `# Community Guidelines

> **This article needs your input.** Define the norms you want for your community.

## Our Values

What principles guide the community? (e.g. respect, generosity, action-oriented, etc.)

## What's Encouraged

- Examples of good participation
- How to ask for help effectively
- Sharing wins and progress

## What's Not OK

- Spam or self-promotion rules
- How to handle disagreements
- What gets someone warned or removed

## Where to Ask for Help

- Which Discord channels are for questions?
- When should someone contact support instead of posting in the community?
- How do members escalate an issue?

## Reporting Issues

How should members report problems? (tag a moderator, DM, support email, etc.)

---

**Related articles:**
- [Live sessions in Discord](/helpcenter/community/live-sessions-in-discord)
- [Join the LifePreneur Discord server](/helpcenter/community/join-the-discord-server)`,
		},

		// ══════════════════════════════════════════════════════════
		// MEMBER PATH — "TikTok Shop & The Program"
		// ══════════════════════════════════════════════════════════
		{
			slug: "tiktok-shop-fundamentals",
			title: "!! TikTok Shop Fundamentals",
			excerpt:
				"Core concepts and basics of TikTok Shop for members",
			categorySlug: "tiktok-shop-and-the-program",
			audience: "member",
			subsection: null,
			featured: false,
			order: 0,
			content: `# TikTok Shop Fundamentals

> **This article needs your input.** This is your curriculum overview — write it in your voice.

## What Is TikTok Shop?

Brief, member-friendly explanation. Assume they joined because of this — keep it practical, not introductory-marketing.

## Key Concepts

List the foundational things every member should understand:
- Concept 1
- Concept 2
- Concept 3

## Where to Learn More

- Which live sessions cover fundamentals?
- Any specific Discord channels for beginners?
- External resources you recommend?

---

**Related articles:**
- [Using the program well](/helpcenter/tiktok-shop-and-the-program/using-the-program-well)
- [Live sessions in Discord](/helpcenter/community/live-sessions-in-discord)`,
		},
		{
			slug: "using-the-program-well",
			title: "!! Using the Program Well",
			excerpt:
				"How to combine live sessions, community, and your own work for the best results",
			categorySlug: "tiktok-shop-and-the-program",
			audience: "member",
			subsection: null,
			featured: false,
			order: 1,
			content: `# Using the Program Well

> **This article needs your input.** Describe how members should approach the program.

## The LifePreneur Approach

How does your program differ from a course? What's the recommended way to engage?

## Getting the Most Out of It

### Live Sessions
- How should members prepare?
- Should they take notes, participate, or just listen?

### Community
- How active should members be?
- What's the best way to use channels?

### On Their Own
- What should members be doing between sessions?
- Any recommended daily/weekly habits?

## Common Mistakes

What do members who struggle tend to do wrong? (so others can avoid it)

---

**Related articles:**
- [TikTok Shop fundamentals](/helpcenter/tiktok-shop-and-the-program/tiktok-shop-fundamentals)
- [What to do first as a new member](/helpcenter/start-here/what-to-do-first)`,
		},

		// ══════════════════════════════════════════════════════════
		// MEMBER PATH — "Billing & Subscription"
		// ══════════════════════════════════════════════════════════
		{
			slug: "upgrade-from-starter",
			title: "Upgrade from Starter",
			excerpt:
				"How to move from the Starter plan to a full membership",
			categorySlug: "billing-and-subscription",
			audience: "member",
			subsection: null,
			featured: true,
			order: 0,
			content: `# Upgrade from Starter

## Why Upgrade?

The Starter plan gives you limited access. Upgrading unlocks the full LifePreneur experience — everything described on the [pricing page](/pricing).

## How to Upgrade

1. Log in to your account
2. Go to **Settings → Billing**
3. Click **Manage Subscription**
4. In the Stripe billing portal, select the plan you'd like to upgrade to
5. Confirm the change

Your upgrade takes effect immediately. Any remaining balance from your current plan is prorated.

## What Changes

After upgrading you'll have access to everything included with full membership. See [What's included with membership](/helpcenter/before-you-join/whats-included-with-membership) for details.

## Questions?

If you're unsure which plan is right for you, visit the [pricing page](/pricing) or [contact support](/contact).

---

**Related articles:**
- [Manage your subscription](/helpcenter/billing-and-subscription/manage-your-subscription)
- [What's included with membership](/helpcenter/before-you-join/whats-included-with-membership)`,
		},
		{
			slug: "manage-your-subscription",
			title: "Manage Your Subscription",
			excerpt:
				"View your plan, renewal dates, and subscription details",
			categorySlug: "billing-and-subscription",
			audience: "member",
			subsection: null,
			featured: false,
			order: 1,
			content: `# Manage Your Subscription

## Viewing Your Plan

1. Go to **Settings → Billing**
2. You'll see your current plan, status, and next billing date

## Stripe Billing Portal

For detailed management, click **Manage Subscription** to open the Stripe billing portal. From there you can:
- View payment history
- See upcoming invoices
- Update your plan
- Download receipts

## Plan Changes

- **Upgrade:** Changes take effect immediately with prorated billing
- **Downgrade or cancel:** Takes effect at the end of your current billing period

---

**Related articles:**
- [Update payment method](/helpcenter/billing-and-subscription/update-payment-method)
- [Cancel your membership](/helpcenter/billing-and-subscription/cancel-your-membership)
- [Upgrade from Starter](/helpcenter/billing-and-subscription/upgrade-from-starter)`,
		},
		{
			slug: "update-payment-method",
			title: "Update Payment Method",
			excerpt:
				"How to change your card or payment details",
			categorySlug: "billing-and-subscription",
			audience: "member",
			subsection: null,
			featured: false,
			order: 2,
			content: `# Update Payment Method

## How to Update

1. Go to **Settings → Billing**
2. Click **Manage Subscription**
3. In the Stripe billing portal, navigate to **Payment Methods**
4. Add a new card or update your existing one
5. Save your changes

## When to Update

Update your payment method if:
- Your card is expiring soon
- You received a new card number
- A payment failed and you need to provide a valid card
- You want to switch to a different card

## After Updating

Once updated, your next billing cycle will use the new payment method. If a previous payment failed, Stripe will automatically retry with the updated card.

---

**Related articles:**
- [Manage your subscription](/helpcenter/billing-and-subscription/manage-your-subscription)
- [Failed payments and grace period](/helpcenter/billing-and-subscription/failed-payments-and-grace-period)`,
		},
		{
			slug: "cancel-your-membership",
			title: "Cancel Your Membership",
			excerpt:
				"Step-by-step instructions for cancelling from your account",
			categorySlug: "billing-and-subscription",
			audience: "member",
			subsection: null,
			featured: false,
			order: 3,
			content: `# Cancel Your Membership

## How to Cancel

1. Go to **Settings → Billing**
2. Click **Manage Subscription**
3. In the Stripe billing portal, click **Cancel plan**
4. Confirm the cancellation

## What Happens Next

- Your access continues until the end of your current billing period
- You won't be charged again
- At the end of the period, access to Discord, live sessions, and member features is removed

## Can I Come Back?

Yes. You can resubscribe at any time by visiting the [pricing page](/pricing) and purchasing a new plan.

## Refund Questions?

See our [Refund Policy](/legal/refunds) for details on eligibility.

---

**Related articles:**
- [Manage your subscription](/helpcenter/billing-and-subscription/manage-your-subscription)
- [Refunds and billing questions](/helpcenter/trust-and-policies/refunds-and-billing-questions)`,
		},
		{
			slug: "failed-payments-and-grace-period",
			title: "Failed Payments and Grace Period",
			excerpt:
				"What happens when a payment fails and how to resolve it",
			categorySlug: "billing-and-subscription",
			audience: "member",
			subsection: null,
			featured: false,
			order: 4,
			content: `# Failed Payments and Grace Period

## What Happens When Payment Fails

If your subscription renewal payment fails:
1. You'll receive an email notification
2. A **grace period** begins — you keep full access while the issue is resolved
3. Stripe automatically retries the payment

## How to Fix It

1. Go to **Settings → Billing**
2. Click **Manage Subscription**
3. Update your payment method in the Stripe portal
4. The payment will be retried automatically

## During the Grace Period

You keep full access to:
- Community and Discord
- Live sessions
- All member features

## If Not Resolved

If the payment remains unresolved after the grace period ends, your access will be suspended. Your account is not deleted — you can reactivate by updating your payment method.

For full policy details, see our [Terms and Conditions](/legal/terms).

---

**Related articles:**
- [Update payment method](/helpcenter/billing-and-subscription/update-payment-method)
- [If a payment fails](/helpcenter/trust-and-policies/if-a-payment-fails)`,
		},

		// ══════════════════════════════════════════════════════════
		// MEMBER PATH — "Account & Security"
		// ══════════════════════════════════════════════════════════
		{
			slug: "reset-password-or-fix-sign-in",
			title: "Reset Password or Fix Sign-In",
			excerpt:
				"How to recover access if you can't log in",
			categorySlug: "account-and-security",
			audience: "member",
			subsection: null,
			featured: true,
			order: 0,
			content: `# Reset Password or Fix Sign-In

## Forgot Your Password?

1. Go to the [forgot password page](/auth/forgot-password)
2. Enter the email address you used to sign up
3. Check your email for a reset link
4. Click the link and set a new password

## Can't Log In with Google?

If you originally signed up with Google:
- Make sure you're clicking **Sign in with Google** on the login page (not the email/password form)
- Verify you're using the same Google account you signed up with
- If you've since set a password, you can use either method

## Not Receiving the Reset Email?

- Check your spam/junk folder
- Make sure you're entering the correct email
- Wait a few minutes — sometimes delivery is delayed
- If it still doesn't arrive, [contact support](/contact)

## Account Locked?

If you've been locked out for any reason, [contact support](/contact) for help recovering your account.

---

**Related articles:**
- [Password, email, and linked sign-in](/helpcenter/account-and-security/password-email-and-linked-sign-in)
- [Sessions and devices](/helpcenter/account-and-security/sessions-and-devices)`,
		},
		{
			slug: "password-email-and-linked-sign-in",
			title: "Password, Email, and Linked Sign-In",
			excerpt:
				"Change your password, update your email, or manage connected accounts",
			categorySlug: "account-and-security",
			audience: "member",
			subsection: null,
			featured: false,
			order: 1,
			content: `# Password, Email, and Linked Sign-In

## Change Your Password

1. Go to **Settings → Security**
2. Find the **Change Password** section
3. Enter your current password and your new password
4. Save

If you signed up with Google and haven't set a password yet, you'll see a **Set Password** option instead.

## Change Your Email

1. Go to **Settings → General**
2. Find the **Email** field
3. Enter your new email address
4. You may need to verify the new email

**Important:** This changes the email used for login and all communications.

## Connected Accounts (Google)

You can link or unlink your Google account for faster sign-in:
1. Go to **Settings → Security**
2. Under **Connected Accounts**, manage your Google link

## Using Multiple Sign-In Methods

If you have both a password and Google connected, you can use either to sign in. They both access the same account.

---

**Related articles:**
- [Reset password or fix sign-in](/helpcenter/account-and-security/reset-password-or-fix-sign-in)
- [Your profile](/helpcenter/start-here/your-profile)`,
		},
		{
			slug: "two-factor-authentication",
			title: "Two-Factor Authentication (2FA)",
			excerpt:
				"Add an extra layer of security to your account",
			categorySlug: "account-and-security",
			audience: "member",
			subsection: null,
			featured: false,
			order: 2,
			content: `# Two-Factor Authentication (2FA)

## What Is 2FA?

Two-factor authentication adds an extra security step when you sign in. After entering your password, you'll also need a code from an authenticator app on your phone.

## How to Enable

1. Go to **Settings → Security**
2. Find the **Two-Factor Authentication** section
3. Follow the setup steps to link your authenticator app (Google Authenticator, Authy, etc.)
4. Scan the QR code with your app
5. Enter the verification code to confirm

## Signing In with 2FA

After enabling, every login will require:
1. Your email and password (or Google sign-in)
2. A code from your authenticator app

## If You Lose Access to Your Authenticator

If you can't access your authenticator app:
- Use a backup code if you saved one during setup
- [Contact support](/contact) to verify your identity and disable 2FA

## Disabling 2FA

1. Go to **Settings → Security**
2. Find the **Two-Factor Authentication** section
3. Follow the steps to disable

---

**Related articles:**
- [Passkeys](/helpcenter/account-and-security/passkeys)
- [Password, email, and linked sign-in](/helpcenter/account-and-security/password-email-and-linked-sign-in)`,
		},
		{
			slug: "passkeys",
			title: "Passkeys",
			excerpt:
				"Use passkeys for passwordless, secure sign-in",
			categorySlug: "account-and-security",
			audience: "member",
			subsection: null,
			featured: false,
			order: 3,
			content: `# Passkeys

## What Are Passkeys?

Passkeys are a modern, passwordless way to sign in. Instead of typing a password, you authenticate using your device's built-in security — fingerprint, face recognition, or device PIN.

## How to Add a Passkey

1. Go to **Settings → Security**
2. Find the **Passkeys** section
3. Click **Add Passkey**
4. Your browser will prompt you to create one using your device
5. Confirm with your fingerprint, face, or PIN

## Signing In with a Passkey

On the login page, choose the passkey option. Your browser will prompt you to authenticate with your device — no password needed.

## Can I Still Use a Password?

Yes. Passkeys are an additional sign-in method, not a replacement. You can use whichever method you prefer.

## Managing Passkeys

- View and remove passkeys in **Settings → Security**
- You can add passkeys on multiple devices
- Removing a passkey doesn't affect your password or other sign-in methods

---

**Related articles:**
- [Two-factor authentication (2FA)](/helpcenter/account-and-security/two-factor-authentication)
- [Reset password or fix sign-in](/helpcenter/account-and-security/reset-password-or-fix-sign-in)`,
		},
		{
			slug: "sessions-and-devices",
			title: "Sessions and Devices",
			excerpt:
				"How sessions work, signing in on multiple devices, and signing out everywhere",
			categorySlug: "account-and-security",
			audience: "member",
			subsection: null,
			featured: false,
			order: 4,
			content: `# Sessions and Devices

## How Sessions Work

When you sign in, a session is created for that browser or device. Sessions keep you logged in so you don't have to enter your password every time.

## Multiple Devices

Yes, you can be signed in on multiple devices at the same time — for example, your laptop and your phone. Each device has its own session.

## Viewing Active Sessions

1. Go to **Settings → Security**
2. Scroll to the **Active Sessions** section
3. You'll see a list of all devices/browsers where you're currently signed in

## Signing Out of Other Devices

From the Active Sessions section, you can revoke any session you don't recognize or no longer need. This immediately signs out that device.

## When to Review Sessions

Check your active sessions if:
- You signed in on a shared or public computer
- You see a device you don't recognize
- You changed your password and want to sign out everywhere else

---

**Related articles:**
- [Two-factor authentication (2FA)](/helpcenter/account-and-security/two-factor-authentication)
- [Reset password or fix sign-in](/helpcenter/account-and-security/reset-password-or-fix-sign-in)`,
		},

		// ══════════════════════════════════════════════════════════
		// MEMBER PATH — "Affiliate"
		// ══════════════════════════════════════════════════════════
		{
			slug: "how-the-affiliate-program-works",
			title: "How the Affiliate Program Works",
			excerpt:
				"Overview of the LifePreneur affiliate program",
			categorySlug: "affiliate",
			audience: "member",
			subsection: null,
			featured: true,
			order: 0,
			content: `# How the Affiliate Program Works

## Overview

The LifePreneur affiliate program lets you earn commissions by referring new members. When someone signs up through your referral link, you earn a commission on their subscription.

## Who Can Join

The affiliate program is available to active, paying members. You must maintain an active subscription to participate.

## How to Sign Up

1. Go to the **Affiliate** page in your account
2. Follow the signup steps
3. Once approved, your referral link and dashboard become available

## Full Terms

The affiliate program is governed by our [Affiliate Program Terms](/legal/affiliate-terms). Please read them before signing up — they cover eligibility, commission structure, prohibited activities, and more.

---

**Related articles:**
- [Your affiliate link and stats](/helpcenter/affiliate/your-affiliate-link-and-stats)
- [Referrals, commissions, and payouts](/helpcenter/affiliate/referrals-commissions-and-payouts)`,
		},
		{
			slug: "your-affiliate-link-and-stats",
			title: "Your Affiliate Link and Stats",
			excerpt:
				"Where to find your link and what your dashboard shows",
			categorySlug: "affiliate",
			audience: "member",
			subsection: null,
			featured: false,
			order: 1,
			content: `# Your Affiliate Link and Stats

## Finding Your Link

1. Go to the **Affiliate** page in your account
2. Your unique referral link is displayed at the top
3. Click to copy it

Share this link with anyone you'd like to refer to LifePreneur. When they sign up through your link, the referral is tracked automatically.

## Your Dashboard

The affiliate dashboard shows:
- **Visitors** — how many people clicked your link
- **Conversions** — how many visitors became paying members
- **Commissions earned** — total commissions generated
- **Commissions pending** — commissions awaiting approval or payout
- **Commissions paid** — what's been paid out to you

## Tips

- Share your link naturally — in conversations, social media, or content
- The link works across all devices
- Stats update periodically; there may be a short delay

For commission rules and payout details, see [Referrals, commissions, and payouts](/helpcenter/affiliate/referrals-commissions-and-payouts).

---

**Related articles:**
- [How the affiliate program works](/helpcenter/affiliate/how-the-affiliate-program-works)
- [Referrals, commissions, and payouts](/helpcenter/affiliate/referrals-commissions-and-payouts)`,
		},
		{
			slug: "referrals-commissions-and-payouts",
			title: "Referrals, Commissions, and Payouts",
			excerpt:
				"How referrals are tracked and when you get paid",
			categorySlug: "affiliate",
			audience: "member",
			subsection: null,
			featured: false,
			order: 2,
			content: `# Referrals, Commissions, and Payouts

## How Referrals Are Tracked

When someone clicks your affiliate link and signs up, the referral is attributed to you automatically. The tracking is handled by our affiliate platform.

## Commission Details

For specifics on commission rates, recurring vs. one-time, and any conditions, see our [Affiliate Program Terms](/legal/affiliate-terms).

## Payout Schedule

Payout timing and method are covered in the [Affiliate Program Terms](/legal/affiliate-terms). Generally:
- Commissions go through an approval period before payout
- Payouts are processed on a regular schedule
- You'll need a valid payout method set up

## Questions?

If you have a question about a specific referral or commission, [contact support](/contact).

---

**Related articles:**
- [Your affiliate link and stats](/helpcenter/affiliate/your-affiliate-link-and-stats)
- [How the affiliate program works](/helpcenter/affiliate/how-the-affiliate-program-works)`,
		},
	];

	// ─── Insert articles ──────────────────────────────────────────

	let created = 0;
	for (const article of articles) {
		const { categorySlug, ...data } = article;
		const categoryId = categoryMap[categorySlug];
		if (!categoryId) {
			console.error(`Category not found for slug: ${categorySlug}`);
			continue;
		}
		await db.helpArticle.create({
			data: {
				...data,
				categoryId,
				published: true,
			},
		});
		created++;
	}

	console.log(
		`\nDone! Created ${categories.length} categories and ${created} articles.`,
	);
}

seed()
	.catch((error) => {
		console.error("Seed failed:", error);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
