-- CreateTable
CREATE TABLE "subscription_categories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscription_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_categories_user_id_name_key" ON "subscription_categories"("user_id", "name");

-- CreateIndex
CREATE INDEX "subscription_categories_user_id_idx" ON "subscription_categories"("user_id");

-- AddForeignKey
ALTER TABLE "subscription_categories" ADD CONSTRAINT "subscription_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing subscription categories
INSERT INTO "subscription_categories" ("id", "user_id", "name", "created_at", "updated_at")
SELECT
  (
    substr(md5((source."user_id")::text || ':' || source."name"), 1, 8)
    || '-'
    || substr(md5((source."user_id")::text || ':' || source."name"), 9, 4)
    || '-'
    || substr(md5((source."user_id")::text || ':' || source."name"), 13, 4)
    || '-'
    || substr(md5((source."user_id")::text || ':' || source."name"), 17, 4)
    || '-'
    || substr(md5((source."user_id")::text || ':' || source."name"), 21, 12)
  )::uuid,
  source."user_id",
  source."name",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT
    "user_id",
    btrim("category") AS "name"
  FROM "subscriptions"
  WHERE "category" IS NOT NULL
    AND btrim("category") <> ''
) AS source;
