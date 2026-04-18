-- Enable Row Level Security on all public tables exposed to PostgREST
-- This prevents unauthorized access via the Supabase REST API.
-- The application uses Prisma with a direct PostgreSQL connection (service role),
-- so these policies do not affect application behavior.

-- =============================================================================
-- Marketing tables: allow public read access, block writes via PostgREST
-- =============================================================================

-- marketing_benefit
ALTER TABLE "public"."marketing_benefit" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on marketing_benefit"
  ON "public"."marketing_benefit"
  FOR SELECT
  USING (true);

-- marketing_faq
ALTER TABLE "public"."marketing_faq" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on marketing_faq"
  ON "public"."marketing_faq"
  FOR SELECT
  USING (true);

-- marketing_content
ALTER TABLE "public"."marketing_content" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on marketing_content"
  ON "public"."marketing_content"
  FOR SELECT
  USING (true);

-- marketing_pricing_plan
ALTER TABLE "public"."marketing_pricing_plan" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on marketing_pricing_plan"
  ON "public"."marketing_pricing_plan"
  FOR SELECT
  USING (true);

-- =============================================================================
-- Internal tables: enable RLS with no public policies (blocks all PostgREST access)
-- =============================================================================

-- system_setting (application config, no public access needed)
ALTER TABLE "public"."system_setting" ENABLE ROW LEVEL SECURITY;

-- _prisma_migrations (internal migration tracking, no public access needed)
-- Wrapped in DO block because this table only exists in live databases,
-- not in Prisma's shadow database (which is a fresh empty DB).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
  ) THEN
    ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
