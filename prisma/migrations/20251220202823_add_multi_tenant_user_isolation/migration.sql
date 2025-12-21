-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- AlterTable: Add userId to person table
ALTER TABLE "person" ADD COLUMN "user_id" TEXT;

-- AlterTable: Add userId to project table
ALTER TABLE "project" ADD COLUMN "user_id" TEXT;

-- AlterTable: Add userId to task table
ALTER TABLE "task" ADD COLUMN "user_id" TEXT;

-- DropIndex: Drop old unique constraint on person.handle (if it exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'person_handle_key') THEN
        ALTER TABLE "person" DROP CONSTRAINT "person_handle_key";
    END IF;
END $$;

-- Update existing data: For migration purposes, create a default user or set to NULL
-- In production, you'll need to handle this appropriately
-- Leaving as NULL for now, will be populated during user migration

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "person_user_id_idx" ON "person"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "person_user_id_handle_key" ON "person"("user_id", "handle");

-- CreateIndex
CREATE INDEX "project_user_id_idx" ON "project"("user_id");

-- CreateIndex
CREATE INDEX "task_user_id_idx" ON "task"("user_id");

-- Make userId columns NOT NULL after data migration (commented out for now)
-- ALTER TABLE "person" ALTER COLUMN "user_id" SET NOT NULL;
-- ALTER TABLE "project" ALTER COLUMN "user_id" SET NOT NULL;
-- ALTER TABLE "task" ALTER COLUMN "user_id" SET NOT NULL;

