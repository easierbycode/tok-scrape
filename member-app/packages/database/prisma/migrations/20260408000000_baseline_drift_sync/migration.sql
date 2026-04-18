-- Baseline drift sync: captures all columns that were added via `db push`
-- and were never recorded in a migration file. Marked as already applied.

-- affiliate
ALTER TABLE "affiliate" ADD COLUMN IF NOT EXISTS "primary_link_url" TEXT;

-- marketing_content
ALTER TABLE "marketing_content" ADD COLUMN IF NOT EXISTS "hero_headline_accent" TEXT;
ALTER TABLE "marketing_content" ADD COLUMN IF NOT EXISTS "testimonials_badge_text" TEXT;
ALTER TABLE "marketing_content" ADD COLUMN IF NOT EXISTS "testimonials_headline" TEXT;
ALTER TABLE "marketing_content" ADD COLUMN IF NOT EXISTS "testimonials_headline_accent" TEXT;
ALTER TABLE "marketing_content" ADD COLUMN IF NOT EXISTS "testimonials_subheadline" TEXT;

-- marketing_pricing_plan
ALTER TABLE "marketing_pricing_plan" ADD COLUMN IF NOT EXISTS "allow_promo_codes" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "marketing_pricing_plan" ADD COLUMN IF NOT EXISTS "discord_role_env_key" TEXT;
ALTER TABLE "marketing_pricing_plan" ADD COLUMN IF NOT EXISTS "icon" TEXT;
ALTER TABLE "marketing_pricing_plan" ADD COLUMN IF NOT EXISTS "inherits_from" TEXT;
ALTER TABLE "marketing_pricing_plan" ADD COLUMN IF NOT EXISTS "compare_at_price" TEXT;
ALTER TABLE "marketing_pricing_plan" ADD COLUMN IF NOT EXISTS "trust_text" TEXT;

-- user
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "discord_role_key" TEXT;
