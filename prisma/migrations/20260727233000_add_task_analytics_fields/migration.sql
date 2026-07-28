-- AlterTable
-- Additive only. Every NOT NULL column carries a default, so this is safe to
-- apply against existing rows.
--
-- original_due_at is deliberately left NULL for pre-existing tasks: we have no
-- record of what their first due date was, and backfilling it from the current
-- due_at would make every historical task look like it never slipped.
ALTER TABLE "task" ADD COLUMN     "original_due_at" TIMESTAMP(3),
ADD COLUMN     "due_at_change_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "first_board_date" DATE,
ADD COLUMN     "board_day_count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "task_type" TEXT,
ADD COLUMN     "estimated_minutes" INTEGER;

-- Existing rows already sit on a board day, so seed first_board_date from the
-- current board_date where we have one. This is factual (that day did happen),
-- unlike guessing an original due date.
UPDATE "task" SET "first_board_date" = "board_date" WHERE "board_date" IS NOT NULL;
