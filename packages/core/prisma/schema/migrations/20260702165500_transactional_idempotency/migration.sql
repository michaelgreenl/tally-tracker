-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "idempotency_logs"
    ADD COLUMN "request_hash" TEXT,
    ADD COLUMN "status" "IdempotencyStatus" NOT NULL DEFAULT 'COMPLETED',
    ADD COLUMN "response_status" INTEGER,
    ADD COLUMN "response_body" JSONB,
    ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "idempotency_logs_user_id_idx" ON "idempotency_logs"("user_id");
