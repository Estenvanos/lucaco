-- AlterTable
ALTER TABLE "user_keys" ADD COLUMN     "backup_iv" VARCHAR(64),
ADD COLUMN     "backup_salt" VARCHAR(64),
ADD COLUMN     "encrypted_private_key" TEXT;
