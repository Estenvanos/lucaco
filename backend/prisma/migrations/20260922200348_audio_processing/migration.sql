-- CreateEnum
CREATE TYPE "noise_suppression" AS ENUM ('off', 'browser', 'rnnoise');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "eq_high" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "eq_low" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "eq_mid" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "noise_suppression" "noise_suppression" NOT NULL DEFAULT 'browser';
