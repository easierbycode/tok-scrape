-- CreateTable
CREATE TABLE "discord_message_template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "message_id" TEXT,
    "payload" JSONB NOT NULL,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_message_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discord_message_template_channel_id_idx" ON "discord_message_template"("channel_id");

-- CreateIndex
CREATE INDEX "discord_message_template_updated_at_idx" ON "discord_message_template"("updated_at");

-- AddForeignKey
ALTER TABLE "discord_message_template" ADD CONSTRAINT "discord_message_template_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
