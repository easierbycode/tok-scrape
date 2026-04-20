/**
 * Prisma Zod Generator - Single File (inlined)
 * Auto-generated. Do not edit.
 */

import * as z from 'zod';
// File: TransactionIsolationLevel.schema.ts

export const TransactionIsolationLevelSchema = z.enum(['ReadUncommitted', 'ReadCommitted', 'RepeatableRead', 'Serializable'])

export type TransactionIsolationLevel = z.infer<typeof TransactionIsolationLevelSchema>;

// File: UserScalarFieldEnum.schema.ts

export const UserScalarFieldEnumSchema = z.enum(['id', 'name', 'email', 'emailVerified', 'image', 'createdAt', 'updatedAt', 'username', 'role', 'banned', 'banReason', 'banExpires', 'onboardingComplete', 'paymentsCustomerId', 'locale', 'displayUsername', 'twoFactorEnabled', 'discordId', 'discordUsername', 'discordConnected', 'discordConnectedAt', 'discordBanned', 'discordBannedAt', 'discordBannedBy', 'discordBanReason', 'stripeEmail', 'notificationEmail', 'referredBy', 'referredBySlug', 'referralSource', 'betaFeatures', 'deletedAt', 'deletedBy', 'deletionReason', 'scheduledPurgeAt', 'dataRetentionUntil'])

export type UserScalarFieldEnum = z.infer<typeof UserScalarFieldEnumSchema>;

// File: SessionScalarFieldEnum.schema.ts

export const SessionScalarFieldEnumSchema = z.enum(['id', 'expiresAt', 'ipAddress', 'userAgent', 'userId', 'impersonatedBy', 'activeOrganizationId', 'token', 'createdAt', 'updatedAt'])

export type SessionScalarFieldEnum = z.infer<typeof SessionScalarFieldEnumSchema>;

// File: AccountScalarFieldEnum.schema.ts

export const AccountScalarFieldEnumSchema = z.enum(['id', 'accountId', 'providerId', 'userId', 'accessToken', 'refreshToken', 'idToken', 'expiresAt', 'password', 'accessTokenExpiresAt', 'refreshTokenExpiresAt', 'scope', 'createdAt', 'updatedAt'])

export type AccountScalarFieldEnum = z.infer<typeof AccountScalarFieldEnumSchema>;

// File: VerificationScalarFieldEnum.schema.ts

export const VerificationScalarFieldEnumSchema = z.enum(['id', 'identifier', 'value', 'expiresAt', 'createdAt', 'updatedAt'])

export type VerificationScalarFieldEnum = z.infer<typeof VerificationScalarFieldEnumSchema>;

// File: PasskeyScalarFieldEnum.schema.ts

export const PasskeyScalarFieldEnumSchema = z.enum(['id', 'name', 'publicKey', 'userId', 'credentialID', 'counter', 'deviceType', 'backedUp', 'transports', 'aaguid', 'createdAt'])

export type PasskeyScalarFieldEnum = z.infer<typeof PasskeyScalarFieldEnumSchema>;

// File: TwoFactorScalarFieldEnum.schema.ts

export const TwoFactorScalarFieldEnumSchema = z.enum(['id', 'secret', 'backupCodes', 'userId'])

export type TwoFactorScalarFieldEnum = z.infer<typeof TwoFactorScalarFieldEnumSchema>;

// File: OrganizationScalarFieldEnum.schema.ts

export const OrganizationScalarFieldEnumSchema = z.enum(['id', 'name', 'slug', 'logo', 'createdAt', 'metadata', 'paymentsCustomerId'])

export type OrganizationScalarFieldEnum = z.infer<typeof OrganizationScalarFieldEnumSchema>;

// File: MemberScalarFieldEnum.schema.ts

export const MemberScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'userId', 'role', 'createdAt'])

export type MemberScalarFieldEnum = z.infer<typeof MemberScalarFieldEnumSchema>;

// File: InvitationScalarFieldEnum.schema.ts

export const InvitationScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'email', 'role', 'status', 'expiresAt', 'inviterId'])

export type InvitationScalarFieldEnum = z.infer<typeof InvitationScalarFieldEnumSchema>;

// File: PurchaseScalarFieldEnum.schema.ts

export const PurchaseScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'userId', 'type', 'customerId', 'subscriptionId', 'productId', 'status', 'createdAt', 'updatedAt', 'currentPeriodEnd', 'cancelAtPeriodEnd', 'cancelledAt', 'trialEnd', 'referralCode', 'rewardfulReferralId', 'cachedAmount', 'cachedInterval', 'cachedCouponId', 'cachedCouponName', 'cachedDiscountPercent', 'stripeSyncedAt', 'deletedAt', 'financialRetentionUntil'])

export type PurchaseScalarFieldEnum = z.infer<typeof PurchaseScalarFieldEnumSchema>;

// File: AiChatScalarFieldEnum.schema.ts

export const AiChatScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'userId', 'title', 'messages', 'createdAt', 'updatedAt'])

export type AiChatScalarFieldEnum = z.infer<typeof AiChatScalarFieldEnumSchema>;

// File: WebhookEventScalarFieldEnum.schema.ts

export const WebhookEventScalarFieldEnumSchema = z.enum(['id', 'type', 'processed', 'createdAt'])

export type WebhookEventScalarFieldEnum = z.infer<typeof WebhookEventScalarFieldEnumSchema>;

// File: AuditLogScalarFieldEnum.schema.ts

export const AuditLogScalarFieldEnumSchema = z.enum(['id', 'adminUserId', 'action', 'targetType', 'targetId', 'metadata', 'createdAt'])

export type AuditLogScalarFieldEnum = z.infer<typeof AuditLogScalarFieldEnumSchema>;

// File: NotificationScalarFieldEnum.schema.ts

export const NotificationScalarFieldEnumSchema = z.enum(['id', 'userId', 'type', 'title', 'message', 'read', 'readAt', 'dismissedAt', 'createdAt'])

export type NotificationScalarFieldEnum = z.infer<typeof NotificationScalarFieldEnumSchema>;

// File: AnnouncementScalarFieldEnum.schema.ts

export const AnnouncementScalarFieldEnumSchema = z.enum(['id', 'title', 'content', 'type', 'priority', 'publishedAt', 'expiresAt', 'createdAt', 'updatedAt'])

export type AnnouncementScalarFieldEnum = z.infer<typeof AnnouncementScalarFieldEnumSchema>;

// File: GlobalAnnouncementScalarFieldEnum.schema.ts

export const GlobalAnnouncementScalarFieldEnumSchema = z.enum(['id', 'type', 'title', 'content', 'enabled', 'priority', 'createdAt', 'updatedAt', 'createdBy', 'lastEditBy'])

export type GlobalAnnouncementScalarFieldEnum = z.infer<typeof GlobalAnnouncementScalarFieldEnumSchema>;

// File: GlobalAnnouncementViewScalarFieldEnum.schema.ts

export const GlobalAnnouncementViewScalarFieldEnumSchema = z.enum(['id', 'announcementId', 'userId', 'viewedAt', 'dismissed', 'dismissedAt'])

export type GlobalAnnouncementViewScalarFieldEnum = z.infer<typeof GlobalAnnouncementViewScalarFieldEnumSchema>;

// File: ContentVideoScalarFieldEnum.schema.ts

export const ContentVideoScalarFieldEnumSchema = z.enum(['id', 'title', 'description', 'category', 'duration', 'videoUrl', 'thumbnailUrl', 'orderIndex', 'published', 'createdAt', 'updatedAt'])

export type ContentVideoScalarFieldEnum = z.infer<typeof ContentVideoScalarFieldEnumSchema>;

// File: VideoProgressScalarFieldEnum.schema.ts

export const VideoProgressScalarFieldEnumSchema = z.enum(['id', 'userId', 'videoId', 'progress', 'completed', 'updatedAt'])

export type VideoProgressScalarFieldEnum = z.infer<typeof VideoProgressScalarFieldEnumSchema>;

// File: AffiliateScalarFieldEnum.schema.ts

export const AffiliateScalarFieldEnumSchema = z.enum(['id', 'userId', 'rewardfulId', 'slug', 'status', 'visitors', 'leads', 'conversions', 'commissionsEarned', 'commissionsPending', 'commissionsPaid', 'lastSyncAt', 'lastSyncError', 'syncStatus', 'createdAt', 'updatedAt'])

export type AffiliateScalarFieldEnum = z.infer<typeof AffiliateScalarFieldEnumSchema>;

// File: BetaFeatureScalarFieldEnum.schema.ts

export const BetaFeatureScalarFieldEnumSchema = z.enum(['id', 'name', 'description', 'category', 'addedDate', 'estimatedReleaseDate', 'status', 'createdAt', 'updatedAt'])

export type BetaFeatureScalarFieldEnum = z.infer<typeof BetaFeatureScalarFieldEnumSchema>;

// File: LoginTokenScalarFieldEnum.schema.ts

export const LoginTokenScalarFieldEnumSchema = z.enum(['id', 'token', 'userId', 'expiresAt', 'used', 'createdAt'])

export type LoginTokenScalarFieldEnum = z.infer<typeof LoginTokenScalarFieldEnumSchema>;

// File: HelpCategoryScalarFieldEnum.schema.ts

export const HelpCategoryScalarFieldEnumSchema = z.enum(['id', 'slug', 'title', 'description', 'icon', 'order', 'published', 'createdAt', 'updatedAt'])

export type HelpCategoryScalarFieldEnum = z.infer<typeof HelpCategoryScalarFieldEnumSchema>;

// File: HelpArticleScalarFieldEnum.schema.ts

export const HelpArticleScalarFieldEnumSchema = z.enum(['id', 'slug', 'title', 'content', 'excerpt', 'categoryId', 'featured', 'order', 'published', 'views', 'helpful', 'notHelpful', 'createdAt', 'updatedAt'])

export type HelpArticleScalarFieldEnum = z.infer<typeof HelpArticleScalarFieldEnumSchema>;

// File: TestimonialScalarFieldEnum.schema.ts

export const TestimonialScalarFieldEnumSchema = z.enum(['id', 'name', 'role', 'avatar', 'rating', 'content', 'stats', 'order', 'published', 'createdAt', 'updatedAt'])

export type TestimonialScalarFieldEnum = z.infer<typeof TestimonialScalarFieldEnumSchema>;

// File: DiscordAuditScalarFieldEnum.schema.ts

export const DiscordAuditScalarFieldEnumSchema = z.enum(['id', 'userId', 'discordId', 'discordUsername', 'action', 'reason', 'performedBy', 'metadata', 'createdAt'])

export type DiscordAuditScalarFieldEnum = z.infer<typeof DiscordAuditScalarFieldEnumSchema>;

// File: PendingDiscordInviteScalarFieldEnum.schema.ts

export const PendingDiscordInviteScalarFieldEnumSchema = z.enum(['id', 'primaryUserId', 'inviteCode', 'recipientEmail', 'relationship', 'status', 'expiresAt', 'joinedAt', 'joinedDiscordId', 'createdAt', 'createdBy'])

export type PendingDiscordInviteScalarFieldEnum = z.infer<typeof PendingDiscordInviteScalarFieldEnumSchema>;

// File: AdditionalDiscordAccountScalarFieldEnum.schema.ts

export const AdditionalDiscordAccountScalarFieldEnumSchema = z.enum(['id', 'primaryUserId', 'discordId', 'discordUsername', 'relationship', 'addedAt', 'addedBy', 'notes', 'active'])

export type AdditionalDiscordAccountScalarFieldEnum = z.infer<typeof AdditionalDiscordAccountScalarFieldEnumSchema>;

// File: MarketingContentScalarFieldEnum.schema.ts

export const MarketingContentScalarFieldEnumSchema = z.enum(['id', 'heroHeadline', 'heroSubheadline', 'heroCtaText', 'heroBadgeText', 'heroVideoUrl', 'heroThumbnailUrl', 'benefitsHeadline', 'pricingBadgeText', 'pricingHeadline', 'pricingSubheadline', 'ctaBadgeText', 'ctaHeadline', 'ctaDescription', 'ctaButtonText', 'stickyCtaTitle', 'stickyCtaSubtitle', 'stickyCtaButtonText', 'stickyCtaMobileText', 'stickyCtaLink', 'seoTitle', 'seoDescription', 'seoOgImage', 'updatedAt', 'updatedBy'])

export type MarketingContentScalarFieldEnum = z.infer<typeof MarketingContentScalarFieldEnumSchema>;

// File: MarketingBenefitScalarFieldEnum.schema.ts

export const MarketingBenefitScalarFieldEnumSchema = z.enum(['id', 'icon', 'heading', 'bullets', 'order', 'published', 'createdAt', 'updatedAt'])

export type MarketingBenefitScalarFieldEnum = z.infer<typeof MarketingBenefitScalarFieldEnumSchema>;

// File: MarketingPricingPlanScalarFieldEnum.schema.ts

export const MarketingPricingPlanScalarFieldEnumSchema = z.enum(['id', 'name', 'price', 'period', 'description', 'features', 'ctaText', 'checkoutUrl', 'stripePriceId', 'planType', 'popular', 'badge', 'order', 'published', 'createdAt', 'updatedAt'])

export type MarketingPricingPlanScalarFieldEnum = z.infer<typeof MarketingPricingPlanScalarFieldEnumSchema>;

// File: MarketingFaqScalarFieldEnum.schema.ts

export const MarketingFaqScalarFieldEnumSchema = z.enum(['id', 'question', 'answer', 'order', 'published', 'flagged', 'createdAt', 'updatedAt'])

export type MarketingFaqScalarFieldEnum = z.infer<typeof MarketingFaqScalarFieldEnumSchema>;

// File: DiscordWhitelistScalarFieldEnum.schema.ts

export const DiscordWhitelistScalarFieldEnumSchema = z.enum(['id', 'discordId', 'discordUsername', 'reason', 'notes', 'addedBy', 'addedAt', 'active'])

export type DiscordWhitelistScalarFieldEnum = z.infer<typeof DiscordWhitelistScalarFieldEnumSchema>;

// File: SystemSettingScalarFieldEnum.schema.ts

export const SystemSettingScalarFieldEnumSchema = z.enum(['key', 'value', 'updatedAt'])

export type SystemSettingScalarFieldEnum = z.infer<typeof SystemSettingScalarFieldEnumSchema>;

// File: SortOrder.schema.ts

export const SortOrderSchema = z.enum(['asc', 'desc'])

export type SortOrder = z.infer<typeof SortOrderSchema>;

// File: JsonNullValueInput.schema.ts

export const JsonNullValueInputSchema = z.enum(['JsonNull'])

export type JsonNullValueInput = z.infer<typeof JsonNullValueInputSchema>;

// File: NullableJsonNullValueInput.schema.ts

export const NullableJsonNullValueInputSchema = z.enum(['DbNull', 'JsonNull'])

export type NullableJsonNullValueInput = z.infer<typeof NullableJsonNullValueInputSchema>;

// File: QueryMode.schema.ts

export const QueryModeSchema = z.enum(['default', 'insensitive'])

export type QueryMode = z.infer<typeof QueryModeSchema>;

// File: NullsOrder.schema.ts

export const NullsOrderSchema = z.enum(['first', 'last'])

export type NullsOrder = z.infer<typeof NullsOrderSchema>;

// File: JsonNullValueFilter.schema.ts

export const JsonNullValueFilterSchema = z.enum(['DbNull', 'JsonNull', 'AnyNull'])

export type JsonNullValueFilter = z.infer<typeof JsonNullValueFilterSchema>;

// File: PurchaseType.schema.ts

export const PurchaseTypeSchema = z.enum(['SUBSCRIPTION', 'ONE_TIME'])

export type PurchaseType = z.infer<typeof PurchaseTypeSchema>;

// File: AuditAction.schema.ts

export const AuditActionSchema = z.enum([
	'GRANT_ACCESS',
	'REVOKE_ACCESS',
	'ASSIGN_ROLE',
	'CREATE_USER',
	'DELETE_USER',
	'IMPERSONATE_USER',
	'STOP_IMPERSONATION',
	'CANCEL_SUBSCRIPTION',
	'APPLY_COUPON',
	'APPLY_CREDIT',
	'CHANGE_PLAN',
	'EXTEND_TRIAL',
	'CREATE_ANNOUNCEMENT',
	'UPDATE_ANNOUNCEMENT',
	'DELETE_ANNOUNCEMENT',
	'CREATE_GLOBAL_ANNOUNCEMENT',
	'UPDATE_GLOBAL_ANNOUNCEMENT',
	'CREATE_NOTIFICATION',
	'GRANT_BETA_ACCESS',
	'UPDATE_BETA_ACCESS',
	'UPDATE_EMAIL',
	'EXPORT_USER_DATA',
	'RESTORE_USER',
	'LINK_AFFILIATE',
	'UNLINK_AFFILIATE',
	'SYNC_STRIPE',
	'GRANT_FREE_MONTHS',
	'CONVERT_TO_PAID',
	'SYSTEM_ACTION',
])

export type AuditAction = z.infer<typeof AuditActionSchema>;

// File: User.schema.ts

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
  username: z.string().nullish(),
  role: z.string().nullish(),
  banned: z.boolean().nullish(),
  banReason: z.string().nullish(),
  banExpires: z.date().nullish(),
  onboardingComplete: z.boolean(),
  paymentsCustomerId: z.string().nullish(),
  locale: z.string().nullish(),
  displayUsername: z.string().nullish(),
  twoFactorEnabled: z.boolean().nullish(),
  discordId: z.string().nullish(),
  discordUsername: z.string().nullish(),
  discordConnected: z.boolean(),
  discordConnectedAt: z.date().nullish(),
  discordBanned: z.boolean(),
  discordBannedAt: z.date().nullish(),
  discordBannedBy: z.string().nullish(),
  discordBanReason: z.string().nullish(),
  stripeEmail: z.string().nullish(),
  notificationEmail: z.string().nullish(),
  referredBy: z.string().nullish(),
  referredBySlug: z.string().nullish(),
  referralSource: z.string().nullish(),
  betaFeatures: z.array(z.string()),
  deletedAt: z.date().nullish(),
  deletedBy: z.string().nullish(),
  deletionReason: z.string().nullish(),
  scheduledPurgeAt: z.date().nullish(),
  dataRetentionUntil: z.date().nullish(),
});

export type UserType = z.infer<typeof UserSchema>;


// File: Session.schema.ts

export const SessionSchema = z.object({
  id: z.string(),
  expiresAt: z.date(),
  ipAddress: z.string().nullish(),
  userAgent: z.string().nullish(),
  userId: z.string(),
  impersonatedBy: z.string().nullish(),
  activeOrganizationId: z.string().nullish(),
  token: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SessionType = z.infer<typeof SessionSchema>;


// File: Account.schema.ts

export const AccountSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  providerId: z.string(),
  userId: z.string(),
  accessToken: z.string().nullish(),
  refreshToken: z.string().nullish(),
  idToken: z.string().nullish(),
  expiresAt: z.date().nullish(),
  password: z.string().nullish(),
  accessTokenExpiresAt: z.date().nullish(),
  refreshTokenExpiresAt: z.date().nullish(),
  scope: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AccountType = z.infer<typeof AccountSchema>;


// File: Verification.schema.ts

export const VerificationSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  value: z.string(),
  expiresAt: z.date(),
  createdAt: z.date().nullish(),
  updatedAt: z.date().nullish(),
});

export type VerificationType = z.infer<typeof VerificationSchema>;


// File: Passkey.schema.ts

export const PasskeySchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  publicKey: z.string(),
  userId: z.string(),
  credentialID: z.string(),
  counter: z.number().int(),
  deviceType: z.string(),
  backedUp: z.boolean(),
  transports: z.string().nullish(),
  aaguid: z.string().nullish(),
  createdAt: z.date().nullish(),
});

export type PasskeyType = z.infer<typeof PasskeySchema>;


// File: TwoFactor.schema.ts

export const TwoFactorSchema = z.object({
  id: z.string(),
  secret: z.string(),
  backupCodes: z.string(),
  userId: z.string(),
});

export type TwoFactorType = z.infer<typeof TwoFactorSchema>;


// File: Organization.schema.ts

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().nullish(),
  logo: z.string().nullish(),
  createdAt: z.date(),
  metadata: z.string().nullish(),
  paymentsCustomerId: z.string().nullish(),
});

export type OrganizationType = z.infer<typeof OrganizationSchema>;


// File: Member.schema.ts

export const MemberSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  role: z.string(),
  createdAt: z.date(),
});

export type MemberType = z.infer<typeof MemberSchema>;


// File: Invitation.schema.ts

export const InvitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string(),
  role: z.string().nullish(),
  status: z.string(),
  expiresAt: z.date(),
  inviterId: z.string(),
});

export type InvitationType = z.infer<typeof InvitationSchema>;


// File: Purchase.schema.ts

export const PurchaseSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullish(),
  userId: z.string().nullish(),
  type: PurchaseTypeSchema,
  customerId: z.string(),
  subscriptionId: z.string().nullish(),
  productId: z.string(),
  status: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
  currentPeriodEnd: z.date().nullish(),
  cancelAtPeriodEnd: z.boolean(),
  cancelledAt: z.date().nullish(),
  trialEnd: z.date().nullish(),
  referralCode: z.string().nullish(),
  rewardfulReferralId: z.string().nullish(),
  cachedAmount: z.number().int().nullish(),
  cachedInterval: z.string().nullish(),
  cachedCouponId: z.string().nullish(),
  cachedCouponName: z.string().nullish(),
  cachedDiscountPercent: z.number().int().nullish(),
  stripeSyncedAt: z.date().nullish(),
  deletedAt: z.date().nullish(),
  financialRetentionUntil: z.date().nullish(),
});

export type PurchaseModel = z.infer<typeof PurchaseSchema>;

// File: AiChat.schema.ts

export const AiChatSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullish(),
  userId: z.string().nullish(),
  title: z.string().nullish(),
  messages: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").default("[]"),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AiChatType = z.infer<typeof AiChatSchema>;


// File: WebhookEvent.schema.ts

export const WebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  processed: z.boolean(),
  createdAt: z.date(),
});

export type WebhookEventType = z.infer<typeof WebhookEventSchema>;


// File: AuditLog.schema.ts

export const AuditLogSchema = z.object({
  id: z.string(),
  adminUserId: z.string(),
  action: AuditActionSchema,
  targetType: z.string(),
  targetId: z.string(),
  metadata: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  createdAt: z.date(),
});

export type AuditLogType = z.infer<typeof AuditLogSchema>;


// File: Notification.schema.ts

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  read: z.boolean(),
  readAt: z.date().nullish(),
  dismissedAt: z.date().nullish(),
  createdAt: z.date(),
});

export type NotificationType = z.infer<typeof NotificationSchema>;


// File: Announcement.schema.ts

export const AnnouncementSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  type: z.string(),
  priority: z.string().default("normal"),
  publishedAt: z.date().nullish(),
  expiresAt: z.date().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AnnouncementType = z.infer<typeof AnnouncementSchema>;


// File: GlobalAnnouncement.schema.ts

export const GlobalAnnouncementSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  content: z.string(),
  enabled: z.boolean(),
  priority: z.string().default("normal"),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().nullish(),
  lastEditBy: z.string().nullish(),
});

export type GlobalAnnouncementType = z.infer<typeof GlobalAnnouncementSchema>;


// File: GlobalAnnouncementView.schema.ts

export const GlobalAnnouncementViewSchema = z.object({
  id: z.string(),
  announcementId: z.string(),
  userId: z.string(),
  viewedAt: z.date(),
  dismissed: z.boolean(),
  dismissedAt: z.date().nullish(),
});

export type GlobalAnnouncementViewType = z.infer<typeof GlobalAnnouncementViewSchema>;


// File: ContentVideo.schema.ts

export const ContentVideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  category: z.string(),
  duration: z.number().int(),
  videoUrl: z.string(),
  thumbnailUrl: z.string(),
  orderIndex: z.number().int(),
  published: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ContentVideoType = z.infer<typeof ContentVideoSchema>;


// File: VideoProgress.schema.ts

export const VideoProgressSchema = z.object({
  id: z.string(),
  userId: z.string(),
  videoId: z.string(),
  progress: z.number().int(),
  completed: z.boolean(),
  updatedAt: z.date(),
});

export type VideoProgressType = z.infer<typeof VideoProgressSchema>;


// File: Affiliate.schema.ts

export const AffiliateSchema = z.object({
  id: z.string(),
  userId: z.string(),
  rewardfulId: z.string(),
  slug: z.string(),
  status: z.string(),
  visitors: z.number().int(),
  leads: z.number().int(),
  conversions: z.number().int(),
  commissionsEarned: z.number().int(),
  commissionsPending: z.number().int(),
  commissionsPaid: z.number().int(),
  lastSyncAt: z.date().nullish(),
  lastSyncError: z.string().nullish(),
  syncStatus: z.string().default("never_synced"),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AffiliateType = z.infer<typeof AffiliateSchema>;


// File: BetaFeature.schema.ts

export const BetaFeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  addedDate: z.date(),
  estimatedReleaseDate: z.date().nullish(),
  status: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type BetaFeatureType = z.infer<typeof BetaFeatureSchema>;


// File: LoginToken.schema.ts

export const LoginTokenSchema = z.object({
  id: z.string(),
  token: z.string(),
  userId: z.string(),
  expiresAt: z.date(),
  used: z.boolean(),
  createdAt: z.date(),
});

export type LoginTokenType = z.infer<typeof LoginTokenSchema>;


// File: HelpCategory.schema.ts

export const HelpCategorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  order: z.number().int(),
  published: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type HelpCategoryType = z.infer<typeof HelpCategorySchema>;


// File: HelpArticle.schema.ts

export const HelpArticleSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  content: z.string(),
  excerpt: z.string().nullish(),
  categoryId: z.string(),
  featured: z.boolean(),
  order: z.number().int(),
  published: z.boolean().default(true),
  views: z.number().int(),
  helpful: z.number().int(),
  notHelpful: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type HelpArticleType = z.infer<typeof HelpArticleSchema>;


// File: Testimonial.schema.ts

export const TestimonialSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  avatar: z.string(),
  rating: z.number().int().default(5),
  content: z.string(),
  stats: z.string(),
  order: z.number().int(),
  published: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TestimonialType = z.infer<typeof TestimonialSchema>;


// File: DiscordAudit.schema.ts

export const DiscordAuditSchema = z.object({
  id: z.string(),
  userId: z.string(),
  discordId: z.string(),
  discordUsername: z.string().nullish(),
  action: z.string(),
  reason: z.string().nullish(),
  performedBy: z.string().nullish(),
  metadata: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  createdAt: z.date(),
});

export type DiscordAuditType = z.infer<typeof DiscordAuditSchema>;


// File: PendingDiscordInvite.schema.ts

export const PendingDiscordInviteSchema = z.object({
  id: z.string(),
  primaryUserId: z.string(),
  inviteCode: z.string(),
  recipientEmail: z.string(),
  relationship: z.string(),
  status: z.string().default("pending"),
  expiresAt: z.date(),
  joinedAt: z.date().nullish(),
  joinedDiscordId: z.string().nullish(),
  createdAt: z.date(),
  createdBy: z.string(),
});

export type PendingDiscordInviteType = z.infer<typeof PendingDiscordInviteSchema>;


// File: AdditionalDiscordAccount.schema.ts

export const AdditionalDiscordAccountSchema = z.object({
  id: z.string(),
  primaryUserId: z.string(),
  discordId: z.string(),
  discordUsername: z.string().nullish(),
  relationship: z.string(),
  addedAt: z.date(),
  addedBy: z.string(),
  notes: z.string().nullish(),
  active: z.boolean().default(true),
});

export type AdditionalDiscordAccountType = z.infer<typeof AdditionalDiscordAccountSchema>;


// File: MarketingContent.schema.ts

export const MarketingContentSchema = z.object({
  id: z.string(),
  heroHeadline: z.string().nullish(),
  heroSubheadline: z.string().nullish(),
  heroCtaText: z.string().nullish(),
  heroBadgeText: z.string().nullish(),
  heroVideoUrl: z.string().nullish(),
  heroThumbnailUrl: z.string().nullish(),
  benefitsHeadline: z.string().nullish(),
  pricingBadgeText: z.string().nullish(),
  pricingHeadline: z.string().nullish(),
  pricingSubheadline: z.string().nullish(),
  ctaBadgeText: z.string().nullish(),
  ctaHeadline: z.string().nullish(),
  ctaDescription: z.string().nullish(),
  ctaButtonText: z.string().nullish(),
  stickyCtaTitle: z.string().nullish(),
  stickyCtaSubtitle: z.string().nullish(),
  stickyCtaButtonText: z.string().nullish(),
  stickyCtaMobileText: z.string().nullish(),
  stickyCtaLink: z.string().nullish(),
  seoTitle: z.string().nullish(),
  seoDescription: z.string().nullish(),
  seoOgImage: z.string().nullish(),
  updatedAt: z.date(),
  updatedBy: z.string().nullish(),
});

export type MarketingContentType = z.infer<typeof MarketingContentSchema>;


// File: MarketingBenefit.schema.ts

export const MarketingBenefitSchema = z.object({
  id: z.string(),
  icon: z.string().default("GraduationCap"),
  heading: z.string(),
  bullets: z.array(z.string()),
  order: z.number().int(),
  published: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MarketingBenefitType = z.infer<typeof MarketingBenefitSchema>;


// File: MarketingPricingPlan.schema.ts

export const MarketingPricingPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.string(),
  period: z.string(),
  description: z.string(),
  features: z.array(z.string()),
  ctaText: z.string().default("Get Started"),
  checkoutUrl: z.string(),
  stripePriceId: z.string().nullish(),
  planType: z.string().default("standard"),
  popular: z.boolean(),
  badge: z.string().nullish(),
  order: z.number().int(),
  published: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MarketingPricingPlanType = z.infer<typeof MarketingPricingPlanSchema>;


// File: MarketingFaq.schema.ts

export const MarketingFaqSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  order: z.number().int(),
  published: z.boolean().default(true),
  flagged: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MarketingFaqType = z.infer<typeof MarketingFaqSchema>;


// File: DiscordWhitelist.schema.ts

export const DiscordWhitelistSchema = z.object({
  id: z.string(),
  discordId: z.string(),
  discordUsername: z.string().nullish(),
  reason: z.string(),
  notes: z.string().nullish(),
  addedBy: z.string(),
  addedAt: z.date(),
  active: z.boolean().default(true),
});

export type DiscordWhitelistType = z.infer<typeof DiscordWhitelistSchema>;


// File: SystemSetting.schema.ts

export const SystemSettingSchema = z.object({
  key: z.string(),
  value: z.string(),
  updatedAt: z.date(),
});

export type SystemSettingType = z.infer<typeof SystemSettingSchema>;

