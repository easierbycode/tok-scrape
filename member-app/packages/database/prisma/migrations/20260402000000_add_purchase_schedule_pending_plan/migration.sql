-- AlterTable
ALTER TABLE "purchase" ADD COLUMN "schedule_id" TEXT;
ALTER TABLE "purchase" ADD COLUMN "pending_price_id" TEXT;
ALTER TABLE "purchase" ADD COLUMN "pending_plan_name" TEXT;
ALTER TABLE "purchase" ADD COLUMN "pending_plan_change_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "purchase_schedule_id_idx" ON "purchase"("schedule_id");
