-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_online" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_seen_at" TIMESTAMP(3);
