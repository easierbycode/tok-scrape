-- CreateEnum
CREATE TYPE "PurchaseType" AS ENUM ('SUBSCRIPTION', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('GRANT_ACCESS', 'REVOKE_ACCESS', 'ASSIGN_ROLE', 'CREATE_USER', 'DELETE_USER', 'IMPERSONATE_USER', 'STOP_IMPERSONATION', 'CANCEL_SUBSCRIPTION', 'APPLY_COUPON', 'APPLY_CREDIT', 'CHANGE_PLAN', 'EXTEND_TRIAL', 'CREATE_ANNOUNCEMENT', 'UPDATE_ANNOUNCEMENT', 'DELETE_ANNOUNCEMENT', 'CREATE_GLOBAL_ANNOUNCEMENT', 'UPDATE_GLOBAL_ANNOUNCEMENT', 'CREATE_NOTIFICATION', 'GRANT_BETA_ACCESS', 'UPDATE_BETA_ACCESS', 'SYSTEM_ACTION');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "username" TEXT,
    "role" TEXT,
    "banned" BOOLEAN,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "paymentsCustomerId" TEXT,
    "locale" TEXT,
    "displayUsername" TEXT,
    "twoFactorEnabled" BOOLEAN,
    "discord_id" TEXT,
    "discord_username" TEXT,
    "discord_connected" BOOLEAN NOT NULL DEFAULT false,
    "discord_connected_at" TIMESTAMP(3),
    "discord_banned" BOOLEAN NOT NULL DEFAULT false,
    "discord_banned_at" TIMESTAMP(3),
    "discord_banned_by" TEXT,
    "discord_ban_reason" TEXT,
    "stripe_email" TEXT,
    "notification_email" TEXT,
    "referred_by" TEXT,
    "referred_by_slug" TEXT,
    "referral_source" TEXT,
    "beta_features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "deletion_reason" TEXT,
    "scheduled_purge_at" TIMESTAMP(3),
    "data_retention_until" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,
    "activeOrganizationId" TEXT,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "password" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passkey" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialID" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "transports" TEXT,
    "aaguid" TEXT,
    "createdAt" TIMESTAMP(3),

    CONSTRAINT "passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "metadata" TEXT,
    "paymentsCustomerId" TEXT,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "inviterId" TEXT NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "type" "PurchaseType" NOT NULL,
    "customerId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "productId" TEXT NOT NULL,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "trial_end" TIMESTAMP(3),
    "referral_code" TEXT,
    "rewardful_referral_id" TEXT,
    "cached_amount" INTEGER,
    "cached_interval" TEXT,
    "cached_coupon_id" TEXT,
    "cached_coupon_name" TEXT,
    "cached_discount_percent" INTEGER,
    "stripe_synced_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "financial_retention_until" TIMESTAMP(3),

    CONSTRAINT "purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "title" TEXT,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "published_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_announcement" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "last_edit_by" TEXT,

    CONSTRAINT "global_announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_announcement_view" (
    "id" TEXT NOT NULL,
    "announcement_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissed_at" TIMESTAMP(3),

    CONSTRAINT "global_announcement_view_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_video" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "video_url" TEXT NOT NULL,
    "thumbnail_url" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rewardful_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "commissions_earned" INTEGER NOT NULL DEFAULT 0,
    "commissions_pending" INTEGER NOT NULL DEFAULT 0,
    "commissions_paid" INTEGER NOT NULL DEFAULT 0,
    "last_sync_at" TIMESTAMP(3),
    "last_sync_error" TEXT,
    "sync_status" TEXT NOT NULL DEFAULT 'never_synced',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beta_feature" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "added_date" TIMESTAMP(3) NOT NULL,
    "estimated_release_date" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beta_feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_token" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_article" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "categoryId" TEXT NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "views" INTEGER NOT NULL DEFAULT 0,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "notHelpful" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "content" TEXT NOT NULL,
    "stats" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discord_audit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "discordUsername" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "performedBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discord_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_discord_invite" (
    "id" TEXT NOT NULL,
    "primary_user_id" TEXT NOT NULL,
    "invite_code" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "joined_at" TIMESTAMP(3),
    "joined_discord_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "pending_discord_invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "additional_discord_account" (
    "id" TEXT NOT NULL,
    "primary_user_id" TEXT NOT NULL,
    "discord_id" TEXT NOT NULL,
    "discord_username" TEXT,
    "relationship" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by" TEXT NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "additional_discord_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_content" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "hero_headline" TEXT,
    "hero_subheadline" TEXT,
    "hero_cta_text" TEXT,
    "hero_badge_text" TEXT,
    "hero_video_url" TEXT,
    "hero_thumbnail_url" TEXT,
    "benefits_headline" TEXT,
    "pricing_badge_text" TEXT,
    "pricing_headline" TEXT,
    "pricing_subheadline" TEXT,
    "cta_badge_text" TEXT,
    "cta_headline" TEXT,
    "cta_description" TEXT,
    "cta_button_text" TEXT,
    "sticky_cta_title" TEXT,
    "sticky_cta_subtitle" TEXT,
    "sticky_cta_button_text" TEXT,
    "sticky_cta_mobile_text" TEXT,
    "sticky_cta_link" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "seo_og_image" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "marketing_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_benefit" (
    "id" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'GraduationCap',
    "heading" TEXT NOT NULL,
    "bullets" TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_benefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_pricing_plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "features" TEXT[],
    "cta_text" TEXT NOT NULL DEFAULT 'Get Started',
    "checkout_url" TEXT NOT NULL,
    "stripe_price_id" TEXT,
    "plan_type" TEXT NOT NULL DEFAULT 'standard',
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "badge" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_pricing_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_faq" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discord_whitelist" (
    "id" TEXT NOT NULL,
    "discord_id" TEXT NOT NULL,
    "discord_username" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "added_by" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "discord_whitelist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_discord_id_key" ON "user"("discord_id");

-- CreateIndex
CREATE INDEX "user_deleted_at_idx" ON "user"("deleted_at");

-- CreateIndex
CREATE INDEX "user_scheduled_purge_at_idx" ON "user"("scheduled_purge_at");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- CreateIndex
CREATE INDEX "user_banned_idx" ON "user"("banned");

-- CreateIndex
CREATE INDEX "user_discord_connected_idx" ON "user"("discord_connected");

-- CreateIndex
CREATE INDEX "user_paymentsCustomerId_idx" ON "user"("paymentsCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "session_expiresAt_idx" ON "session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "account_providerId_accountId_idx" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "verification_expiresAt_idx" ON "verification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "member"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_subscriptionId_key" ON "purchase"("subscriptionId");

-- CreateIndex
CREATE INDEX "purchase_subscriptionId_idx" ON "purchase"("subscriptionId");

-- CreateIndex
CREATE INDEX "purchase_userId_status_idx" ON "purchase"("userId", "status");

-- CreateIndex
CREATE INDEX "purchase_referral_code_idx" ON "purchase"("referral_code");

-- CreateIndex
CREATE INDEX "purchase_rewardful_referral_id_idx" ON "purchase"("rewardful_referral_id");

-- CreateIndex
CREATE INDEX "purchase_financial_retention_until_idx" ON "purchase"("financial_retention_until");

-- CreateIndex
CREATE INDEX "webhook_event_type_created_at_idx" ON "webhook_event"("type", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_admin_user_id_created_at_idx" ON "audit_log"("admin_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_target_type_target_id_idx" ON "audit_log"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_log_action_created_at_idx" ON "audit_log"("action", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "notification_user_id_read_created_at_idx" ON "notification"("user_id", "read", "created_at");

-- CreateIndex
CREATE INDEX "notification_created_at_idx" ON "notification"("created_at");

-- CreateIndex
CREATE INDEX "notification_read_idx" ON "notification"("read");

-- CreateIndex
CREATE INDEX "announcement_published_at_expires_at_idx" ON "announcement"("published_at", "expires_at");

-- CreateIndex
CREATE INDEX "global_announcement_type_enabled_idx" ON "global_announcement"("type", "enabled");

-- CreateIndex
CREATE INDEX "global_announcement_view_user_id_dismissed_idx" ON "global_announcement_view"("user_id", "dismissed");

-- CreateIndex
CREATE UNIQUE INDEX "global_announcement_view_announcement_id_user_id_key" ON "global_announcement_view"("announcement_id", "user_id");

-- CreateIndex
CREATE INDEX "content_video_category_order_index_idx" ON "content_video"("category", "order_index");

-- CreateIndex
CREATE INDEX "content_video_published_idx" ON "content_video"("published");

-- CreateIndex
CREATE INDEX "video_progress_user_id_idx" ON "video_progress"("user_id");

-- CreateIndex
CREATE INDEX "video_progress_video_id_idx" ON "video_progress"("video_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_progress_user_id_video_id_key" ON "video_progress"("user_id", "video_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_user_id_key" ON "affiliate"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_rewardful_id_key" ON "affiliate"("rewardful_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_slug_key" ON "affiliate"("slug");

-- CreateIndex
CREATE INDEX "affiliate_user_id_idx" ON "affiliate"("user_id");

-- CreateIndex
CREATE INDEX "affiliate_rewardful_id_idx" ON "affiliate"("rewardful_id");

-- CreateIndex
CREATE INDEX "affiliate_slug_idx" ON "affiliate"("slug");

-- CreateIndex
CREATE INDEX "affiliate_last_sync_at_idx" ON "affiliate"("last_sync_at");

-- CreateIndex
CREATE INDEX "beta_feature_status_idx" ON "beta_feature"("status");

-- CreateIndex
CREATE UNIQUE INDEX "login_token_token_key" ON "login_token"("token");

-- CreateIndex
CREATE INDEX "login_token_token_idx" ON "login_token"("token");

-- CreateIndex
CREATE INDEX "login_token_userId_idx" ON "login_token"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "help_category_slug_key" ON "help_category"("slug");

-- CreateIndex
CREATE INDEX "help_category_published_order_idx" ON "help_category"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "help_article_slug_key" ON "help_article"("slug");

-- CreateIndex
CREATE INDEX "help_article_categoryId_published_order_idx" ON "help_article"("categoryId", "published", "order");

-- CreateIndex
CREATE INDEX "help_article_featured_published_idx" ON "help_article"("featured", "published");

-- CreateIndex
CREATE INDEX "testimonials_published_order_idx" ON "testimonials"("published", "order");

-- CreateIndex
CREATE INDEX "discord_audit_userId_idx" ON "discord_audit"("userId");

-- CreateIndex
CREATE INDEX "discord_audit_action_idx" ON "discord_audit"("action");

-- CreateIndex
CREATE INDEX "discord_audit_createdAt_idx" ON "discord_audit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "pending_discord_invite_invite_code_key" ON "pending_discord_invite"("invite_code");

-- CreateIndex
CREATE INDEX "pending_discord_invite_primary_user_id_idx" ON "pending_discord_invite"("primary_user_id");

-- CreateIndex
CREATE INDEX "pending_discord_invite_invite_code_idx" ON "pending_discord_invite"("invite_code");

-- CreateIndex
CREATE INDEX "pending_discord_invite_status_expires_at_idx" ON "pending_discord_invite"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "additional_discord_account_discord_id_key" ON "additional_discord_account"("discord_id");

-- CreateIndex
CREATE INDEX "additional_discord_account_primary_user_id_idx" ON "additional_discord_account"("primary_user_id");

-- CreateIndex
CREATE INDEX "additional_discord_account_discord_id_idx" ON "additional_discord_account"("discord_id");

-- CreateIndex
CREATE INDEX "additional_discord_account_active_idx" ON "additional_discord_account"("active");

-- CreateIndex
CREATE INDEX "marketing_benefit_published_order_idx" ON "marketing_benefit"("published", "order");

-- CreateIndex
CREATE INDEX "marketing_pricing_plan_published_order_idx" ON "marketing_pricing_plan"("published", "order");

-- CreateIndex
CREATE INDEX "marketing_pricing_plan_plan_type_published_idx" ON "marketing_pricing_plan"("plan_type", "published");

-- CreateIndex
CREATE INDEX "marketing_faq_published_order_idx" ON "marketing_faq"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "discord_whitelist_discord_id_key" ON "discord_whitelist"("discord_id");

-- CreateIndex
CREATE INDEX "discord_whitelist_discord_id_idx" ON "discord_whitelist"("discord_id");

-- CreateIndex
CREATE INDEX "discord_whitelist_active_idx" ON "discord_whitelist"("active");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat" ADD CONSTRAINT "ai_chat_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat" ADD CONSTRAINT "ai_chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_announcement_view" ADD CONSTRAINT "global_announcement_view_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "global_announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_announcement_view" ADD CONSTRAINT "global_announcement_view_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "content_video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate" ADD CONSTRAINT "affiliate_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_token" ADD CONSTRAINT "login_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_article" ADD CONSTRAINT "help_article_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "help_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discord_audit" ADD CONSTRAINT "discord_audit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_discord_invite" ADD CONSTRAINT "pending_discord_invite_primary_user_id_fkey" FOREIGN KEY ("primary_user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "additional_discord_account" ADD CONSTRAINT "additional_discord_account_primary_user_id_fkey" FOREIGN KEY ("primary_user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
