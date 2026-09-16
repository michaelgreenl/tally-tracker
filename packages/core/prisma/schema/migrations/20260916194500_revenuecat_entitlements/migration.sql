ALTER TABLE "users"
ADD COLUMN "premium_expires_at" TIMESTAMP(3),
ADD COLUMN "billing_checked_at" TIMESTAMP(3),
ADD COLUMN "billing_sandbox" BOOLEAN NOT NULL DEFAULT false;
