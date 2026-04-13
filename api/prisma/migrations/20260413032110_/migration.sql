/*
  Warnings:

  - The values [info] on the enum `notification_type` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `related_id` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `extracted_date` on the `receipts` table. All the data in the column will be lost.
  - You are about to drop the column `extracted_merchant` on the `receipts` table. All the data in the column will be lost.
  - You are about to drop the column `extracted_total` on the `receipts` table. All the data in the column will be lost.
  - You are about to drop the column `image_path` on the `receipts` table. All the data in the column will be lost.
  - You are about to drop the column `image_size` on the `receipts` table. All the data in the column will be lost.
  - You are about to drop the column `mime_type` on the `receipts` table. All the data in the column will be lost.
  - You are about to drop the column `ocr_processed_at` on the `receipts` table. All the data in the column will be lost.
  - You are about to drop the column `ocr_raw_text` on the `receipts` table. All the data in the column will be lost.
  - The `ocr_status` column on the `receipts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `category` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `properties` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the `views` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `message` on table `notifications` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('cash', 'credit_card', 'debit_card', 'e_money', 'qr_payment', 'bank_transfer', 'other');

-- CreateEnum
CREATE TYPE "ocr_job_status" AS ENUM ('pending', 'processing', 'success', 'failed', 'confirmed', 'expired');

-- CreateEnum
CREATE TYPE "receipt_record_status" AS ENUM ('confirmed', 'manual');

-- CreateEnum
CREATE TYPE "record_source_type" AS ENUM ('manual', 'ocr');

-- AlterEnum
BEGIN;
CREATE TYPE "notification_type_new" AS ENUM ('subscription_reminder', 'system');
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "notification_type_new" USING ("type"::text::"notification_type_new");
ALTER TYPE "notification_type" RENAME TO "notification_type_old";
ALTER TYPE "notification_type_new" RENAME TO "notification_type";
DROP TYPE "notification_type_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "views" DROP CONSTRAINT "views_user_id_fkey";

-- DropIndex
DROP INDEX "notifications_is_read_idx";

-- DropIndex
DROP INDEX "notifications_user_id_idx";

-- DropIndex
DROP INDEX "receipts_created_at_idx";

-- DropIndex
DROP INDEX "receipts_ocr_status_idx";

-- DropIndex
DROP INDEX "receipts_user_id_idx";

-- DropIndex
DROP INDEX "subscription_categories_user_id_idx";

-- DropIndex
DROP INDEX "subscriptions_next_payment_date_idx";

-- DropIndex
DROP INDEX "subscriptions_status_idx";

-- DropIndex
DROP INDEX "subscriptions_user_id_idx";

-- DropIndex
DROP INDEX "transactions_transaction_date_idx";

-- DropIndex
DROP INDEX "transactions_type_idx";

-- DropIndex
DROP INDEX "transactions_user_id_idx";

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "related_id",
ADD COLUMN     "related_subscription_id" UUID,
ALTER COLUMN "message" SET NOT NULL;

-- AlterTable
ALTER TABLE "receipts" DROP COLUMN "extracted_date",
DROP COLUMN "extracted_merchant",
DROP COLUMN "extracted_total",
DROP COLUMN "image_path",
DROP COLUMN "image_size",
DROP COLUMN "mime_type",
DROP COLUMN "ocr_processed_at",
DROP COLUMN "ocr_raw_text",
ADD COLUMN     "merchant" VARCHAR(255),
ADD COLUMN     "receipt_date" DATE,
ADD COLUMN     "total_amount" DECIMAL(12,2),
DROP COLUMN "ocr_status",
ADD COLUMN     "ocr_status" "receipt_record_status" NOT NULL DEFAULT 'confirmed';

-- AlterTable
ALTER TABLE "subscription_categories" ADD COLUMN     "is_default" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "category",
ADD COLUMN     "category_id" UUID,
ADD COLUMN     "source_type" "record_source_type" NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "properties",
ADD COLUMN     "category_id" UUID,
ADD COLUMN     "memo" TEXT,
ADD COLUMN     "payment_method" "payment_method";

-- DropTable
DROP TABLE "views";

-- DropEnum
DROP TYPE "ocr_status";

-- DropEnum
DROP TYPE "view_type";

-- CreateTable
CREATE TABLE "user_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Tokyo',
    "subscription_notification_enabled" BOOLEAN NOT NULL DEFAULT true,
    "subscription_notification_days_before" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_categories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_ocr_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "ocr_job_status" NOT NULL DEFAULT 'pending',
    "extracted_merchant" VARCHAR(255),
    "extracted_date" DATE,
    "extracted_total" DECIMAL(12,2),
    "raw_text" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "processed_at" TIMESTAMPTZ,
    "confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "receipt_ocr_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_ocr_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "ocr_job_status" NOT NULL DEFAULT 'pending',
    "extracted_service_name" VARCHAR(255),
    "extracted_amount" DECIMAL(12,2),
    "extracted_billing_cycle" "billing_cycle",
    "extracted_next_payment_date" DATE,
    "raw_text" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "processed_at" TIMESTAMPTZ,
    "confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscription_ocr_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE INDEX "transaction_categories_user_id_sort_order_idx" ON "transaction_categories"("user_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_categories_user_id_name_key" ON "transaction_categories"("user_id", "name");

-- CreateIndex
CREATE INDEX "receipt_ocr_jobs_user_id_status_idx" ON "receipt_ocr_jobs"("user_id", "status");

-- CreateIndex
CREATE INDEX "receipt_ocr_jobs_expires_at_idx" ON "receipt_ocr_jobs"("expires_at");

-- CreateIndex
CREATE INDEX "subscription_ocr_jobs_user_id_status_idx" ON "subscription_ocr_jobs"("user_id", "status");

-- CreateIndex
CREATE INDEX "subscription_ocr_jobs_expires_at_idx" ON "subscription_ocr_jobs"("expires_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "receipts_user_id_receipt_date_idx" ON "receipts"("user_id", "receipt_date");

-- CreateIndex
CREATE INDEX "subscription_categories_user_id_sort_order_idx" ON "subscription_categories"("user_id", "sort_order");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_next_payment_date_idx" ON "subscriptions"("user_id", "next_payment_date");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_category_id_idx" ON "subscriptions"("category_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_transaction_date_idx" ON "transactions"("user_id", "transaction_date");

-- CreateIndex
CREATE INDEX "transactions_user_id_type_idx" ON "transactions"("user_id", "type");

-- CreateIndex
CREATE INDEX "transactions_category_id_idx" ON "transactions"("category_id");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_categories" ADD CONSTRAINT "transaction_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_ocr_jobs" ADD CONSTRAINT "receipt_ocr_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_ocr_jobs" ADD CONSTRAINT "subscription_ocr_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "subscription_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_subscription_id_fkey" FOREIGN KEY ("related_subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
