-- AlterTable: ratings.is_visible (moderación de comentarios)
ALTER TABLE "ratings" ADD COLUMN IF NOT EXISTS "is_visible" BOOLEAN NOT NULL DEFAULT true;
