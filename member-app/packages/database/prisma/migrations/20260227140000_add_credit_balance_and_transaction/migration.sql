-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('SUBSCRIPTION_GRANT', 'SHOP_PURCHASE', 'TOP_UP', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADMIN_ADJUSTMENT');

-- CreateTable
CREATE TABLE "credit_balance" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "frozen" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transaction" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" TEXT,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_balance_user_id_key" ON "credit_balance"("user_id");

-- CreateIndex
CREATE INDEX "credit_transaction_user_id_created_at_idx" ON "credit_transaction"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "credit_balance" ADD CONSTRAINT "credit_balance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
