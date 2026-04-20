-- Drift sync: help_article columns added via db push
ALTER TABLE "help_article" ADD COLUMN IF NOT EXISTS "audience" TEXT NOT NULL DEFAULT 'both';
ALTER TABLE "help_article" ADD COLUMN IF NOT EXISTS "subsection" TEXT;
CREATE INDEX IF NOT EXISTS "help_article_audience_featured_published_idx" ON "help_article"("audience", "featured", "published");

-- TikTok Agency Dashboard models (applied via db push)

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "GoalType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "CampaignEnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DROPPED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "tiktok_account" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tiktok_user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "follower_count" INTEGER NOT NULL DEFAULT 0,
    "video_count" INTEGER NOT NULL DEFAULT 0,
    "account_nickname" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "goal" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "goal_name" TEXT NOT NULL,
    "goal_type" "GoalType" NOT NULL,
    "target_count" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand_name" TEXT NOT NULL,
    "product_link" TEXT,
    "post_requirement" INTEGER NOT NULL,
    "gmv_requirement" INTEGER,
    "commission_rate" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "campaign_enrollment" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "posts_completed" INTEGER NOT NULL DEFAULT 0,
    "gmv_generated" INTEGER NOT NULL DEFAULT 0,
    "status" "CampaignEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_enrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "beta_access" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beta_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_account_user_id_tiktok_user_id_key" ON "tiktok_account"("user_id", "tiktok_user_id");
CREATE INDEX IF NOT EXISTS "tiktok_account_user_id_idx" ON "tiktok_account"("user_id");

CREATE INDEX IF NOT EXISTS "goal_user_id_idx" ON "goal"("user_id");

CREATE INDEX IF NOT EXISTS "campaign_is_active_idx" ON "campaign"("is_active");

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_enrollment_campaign_id_user_id_key" ON "campaign_enrollment"("campaign_id", "user_id");
CREATE INDEX IF NOT EXISTS "campaign_enrollment_user_id_idx" ON "campaign_enrollment"("user_id");
CREATE INDEX IF NOT EXISTS "campaign_enrollment_campaign_id_idx" ON "campaign_enrollment"("campaign_id");

CREATE UNIQUE INDEX IF NOT EXISTS "beta_access_user_id_feature_key" ON "beta_access"("user_id", "feature");
CREATE INDEX IF NOT EXISTS "beta_access_user_id_idx" ON "beta_access"("user_id");
CREATE INDEX IF NOT EXISTS "beta_access_feature_idx" ON "beta_access"("feature");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "tiktok_account" ADD CONSTRAINT "tiktok_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "goal" ADD CONSTRAINT "goal_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "campaign_enrollment" ADD CONSTRAINT "campaign_enrollment_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "campaign_enrollment" ADD CONSTRAINT "campaign_enrollment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "beta_access" ADD CONSTRAINT "beta_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
