/*
  Warnings:

  - Made the column `user_id` on table `person` required. This step will fail if there are existing NULL values in that column.
  - Made the column `user_id` on table `project` required. This step will fail if there are existing NULL values in that column.
  - Made the column `user_id` on table `task` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "person" ALTER COLUMN "user_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "project" ALTER COLUMN "user_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "task" ALTER COLUMN "user_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "api_key" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_key_key_key" ON "api_key"("key");

-- CreateIndex
CREATE INDEX "api_key_user_id_idx" ON "api_key"("user_id");

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
