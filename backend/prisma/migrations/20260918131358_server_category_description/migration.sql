-- AlterTable
ALTER TABLE "servers" ADD COLUMN     "category" VARCHAR(32) NOT NULL DEFAULT 'other',
ADD COLUMN     "description" VARCHAR(300);
