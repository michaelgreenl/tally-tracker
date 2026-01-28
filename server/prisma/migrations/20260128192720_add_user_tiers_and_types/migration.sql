-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('PREMIUM', 'BASIC');

-- CreateEnum
CREATE TYPE "CounterType" AS ENUM ('PERSONAL', 'SHARED');

-- AlterTable
ALTER TABLE "counters" ADD COLUMN     "type" "CounterType" NOT NULL DEFAULT 'PERSONAL';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tier" "UserTier" NOT NULL DEFAULT 'BASIC';
