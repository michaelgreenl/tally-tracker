ALTER TABLE "refresh_tokens"
    ADD COLUMN "rotated_at" TIMESTAMP(3),
    ADD COLUMN "replacement_id" TEXT;
