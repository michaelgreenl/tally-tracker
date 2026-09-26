ALTER TABLE "users"
ADD COLUMN "apple_subject" TEXT,
ADD COLUMN "apple_refresh_token" TEXT,
ADD COLUMN "apple_credential_updated_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_apple_subject_key" ON "users"("apple_subject");
