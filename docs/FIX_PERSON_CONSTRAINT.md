# Fix Person Handle Constraint for Multi-Tenant

## Problem

After implementing multi-tenant isolation, the `person` table had a conflicting unique constraint:

**Old Constraint** (from before multi-tenant):
- `person_handle_key` - UNIQUE on `handle` alone
- This prevented multiple users from having people with the same handle (e.g., both users couldn't have "@me")

**New Constraint** (required for multi-tenant):
- `person_user_id_handle_key` - UNIQUE on `(user_id, handle)` composite
- This allows each user to have their own "@me" person, but prevents duplicate handles within a single user's data

## Symptoms

Users would see this error when trying to create a "me" person on login:

```
PrismaClientKnownRequestError: 
Invalid `prisma.person.create()` invocation:
Unique constraint failed on the fields: (`handle`)
```

- First user to register: ✅ Works (creates "@me" person)
- Second user to register: ❌ Fails (can't create "@me" because handle "me" already exists globally)

## Solution

Created migration `20251221000000_fix_person_handle_constraint` to:

1. **Drop the old unique index** on `handle` alone
2. **Drop the old unique constraint** on `handle` alone  
3. **Ensure composite unique constraint** on `(user_id, handle)` exists

### Migration SQL

```sql
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

-- Ensure the composite unique constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'person_user_id_handle_key'
    ) THEN
        CREATE UNIQUE INDEX "person_user_id_handle_key" ON "person"("user_id", "handle");
    END IF;
END $$;
```

## How to Apply

The migration has been applied using:

```bash
npx prisma db execute --file prisma/migrations/20251221000000_fix_person_handle_constraint/migration.sql
```

## Verification

After applying, you should have:

✅ Composite unique constraint: `person_user_id_handle_key` on `(user_id, handle)`  
❌ No unique constraint on `handle` alone  

This allows:
- User A can have "@me", "@john", "@sarah"
- User B can have "@me", "@john", "@sarah" (same handles, different user_id)
- User A cannot have two people with handle "@me" (enforced by composite key)

## Testing

1. Register a new user → Should create "@me" person
2. Register another new user → Should also create "@me" person (no conflict!)
3. Create a person with handle "test" for User A → Works
4. Create a person with handle "test" for User B → Works  
5. Try to create another person with handle "test" for User A → Should fail (duplicate within user)

## Files Modified

- Created: `prisma/migrations/20251221000000_fix_person_handle_constraint/migration.sql`
- Migration marked as applied in Prisma migration history
- Database schema now matches `prisma/schema.prisma` (which defines `@@unique([userId, handle])`)




