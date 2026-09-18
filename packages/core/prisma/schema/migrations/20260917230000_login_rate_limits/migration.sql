CREATE TABLE "login_rate_limits" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "reset_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "login_rate_limits_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "login_rate_limits_reset_at_idx" ON "login_rate_limits"("reset_at");
