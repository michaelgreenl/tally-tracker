/*
  Warnings:

  - A unique constraint covering the columns `[invite_code]` on the table `counters` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ShareStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "counters" ADD COLUMN     "invite_code" TEXT;

-- CreateTable
CREATE TABLE "counter_shares" (
    "id" TEXT NOT NULL,
    "status" "ShareStatus" NOT NULL DEFAULT 'PENDING',
    "counter_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counter_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "counter_shares_counter_id_user_id_key" ON "counter_shares"("counter_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "counters_invite_code_key" ON "counters"("invite_code");

-- AddForeignKey
ALTER TABLE "counter_shares" ADD CONSTRAINT "counter_shares_counter_id_fkey" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_shares" ADD CONSTRAINT "counter_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
