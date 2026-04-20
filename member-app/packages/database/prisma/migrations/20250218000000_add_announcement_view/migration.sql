-- CreateTable
CREATE TABLE "announcement_view" (
    "id" TEXT NOT NULL,
    "announcement_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_view_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "announcement_view_announcement_id_user_id_key" ON "announcement_view"("announcement_id", "user_id");

-- CreateIndex
CREATE INDEX "announcement_view_user_id_read_at_idx" ON "announcement_view"("user_id", "read_at");

-- AddForeignKey
ALTER TABLE "announcement_view" ADD CONSTRAINT "announcement_view_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_view" ADD CONSTRAINT "announcement_view_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
