-- AlterTable: Add confirmed and confirmed_at columns to user_email_history
ALTER TABLE "user_email_history" ADD COLUMN "confirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_email_history" ADD COLUMN "confirmed_at" TIMESTAMP(3);
