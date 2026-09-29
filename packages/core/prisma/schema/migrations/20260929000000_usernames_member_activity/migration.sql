ALTER TABLE "users" ADD COLUMN "username" TEXT,
    ADD COLUMN "username_key" CHAR(64);
CREATE UNIQUE INDEX "users_username_key_key" ON "users"("username_key");

CREATE TABLE "counter_activity" (
    "counter_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(15,6) NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "counter_activity_pkey" PRIMARY KEY ("counter_id", "user_id"),
    CONSTRAINT "counter_activity_counter_id_fkey" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "counter_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
