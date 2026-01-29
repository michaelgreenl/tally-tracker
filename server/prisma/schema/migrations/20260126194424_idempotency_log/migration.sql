-- CreateTable
CREATE TABLE "idempotency_logs" (
    "key" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_logs_pkey" PRIMARY KEY ("key")
);
