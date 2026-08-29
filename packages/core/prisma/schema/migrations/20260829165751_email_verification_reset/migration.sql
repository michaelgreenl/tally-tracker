-- CreateEnum
CREATE TYPE "EmailOtpPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "users"
    ADD COLUMN "email_verified_at" TIMESTAMP(3),
    ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "email_otps" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "EmailOtpPurpose" NOT NULL,
    "digest" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_otps_user_id_purpose_key" ON "email_otps"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "email_otps_expires_at_idx" ON "email_otps"("expires_at");

-- AddForeignKey
ALTER TABLE "email_otps"
    ADD CONSTRAINT "email_otps_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
