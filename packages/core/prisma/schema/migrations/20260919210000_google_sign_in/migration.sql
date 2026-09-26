ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "google_subject" TEXT;
CREATE UNIQUE INDEX "users_google_subject_key" ON "users"("google_subject");
