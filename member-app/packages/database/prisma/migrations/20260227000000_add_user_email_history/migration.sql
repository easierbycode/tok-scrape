-- CreateTable
CREATE TABLE "user_email_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "old_email" TEXT NOT NULL,
    "new_email" TEXT NOT NULL,
    "changed_by" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_email_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_email_history_user_id_created_at_idx" ON "user_email_history"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_email_history" ADD CONSTRAINT "user_email_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterEnum: Add UPDATE_EMAIL to AuditAction
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_EMAIL';
