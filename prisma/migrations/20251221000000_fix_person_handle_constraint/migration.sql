-- Fix person handle unique constraint for multi-tenant
-- This migration ensures handle is unique per user, not globally

-- Drop unique index on handle if it exists
DROP INDEX IF EXISTS "person_handle_key";

-- Drop unique constraint on handle if it exists  
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'person_handle_key' 
        AND conrelid = 'person'::regclass
    ) THEN
        ALTER TABLE "person" DROP CONSTRAINT "person_handle_key";
    END IF;
END $$;

-- Ensure the composite unique constraint exists (handle must be unique per user)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'person_user_id_handle_key'
    ) THEN
        CREATE UNIQUE INDEX "person_user_id_handle_key" ON "person"("user_id", "handle");
    END IF;
END $$;



