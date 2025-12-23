# Auto-Create "Me" Person Entry

## Problem

When users register or log in for the first time, they are created in:
1. ✅ Supabase Auth (authentication)
2. ✅ `user` table (via `hooks.server.ts`)
3. ❌ `person` table (NOT created automatically)

This caused issues:
- `data.currentUser` was null in the inbox
- Error: "Cannot read properties of null (reading 'id')"
- Users couldn't be assigned as executor on tasks
- Dropdown showed empty instead of "Me"

## Solution

Automatically create a "Me" person entry for each user on first login.

### Implementation

**Location**: `src/hooks.server.ts`

When a user logs in, after syncing to the `user` table, we now also:

1. Check if a person with handle "me" exists for this user
2. If not, create one automatically with:
   - `handle`: "me"
   - `displayName`: Derived from email (e.g., "brett@example.com" → "Brett")
   - `email`: User's email from auth
   - `source`: "auto" (to distinguish from manually created people)
   - `userId`: Linked to the authenticated user

### Benefits

✅ Every user automatically gets a person entry  
✅ Can be assigned as executor/accountable on tasks  
✅ Shows up in people lists with handle "@me"  
✅ Works seamlessly with existing multi-tenant isolation  
✅ No manual setup required for new users  

### How It Works

```typescript
// In hooks.server.ts
if (event.locals.user) {
  // 1. Sync to user table
  await db.user.upsert({ ... });
  
  // 2. Create "Me" person if doesn't exist
  const existingPerson = await db.person.findFirst({
    where: { userId: event.locals.user.id, handle: "me" }
  });
  
  if (!existingPerson) {
    await db.person.create({
      data: {
        userId: event.locals.user.id,
        handle: "me",
        displayName: emailName,
        email: event.locals.user.email,
        source: "auto"
      }
    });
  }
}
```

### Updated Inbox Loader

Changed from:
```typescript
// Old: Just took first person (could be null!)
const currentUser = people[0] || null;
```

To:
```typescript
// New: Explicitly fetch the "me" person
const currentUser = await db.person.findFirst({
  where: { userId, handle: 'me' }
});
```

## Data Migration

For existing users who don't have a "me" person entry:

**Option 1: Automatic** - They'll get one on next login (recommended)

**Option 2: Manual Script** - Create for all existing users now:

```typescript
// migration-create-me-persons.ts
const users = await db.user.findMany();

for (const user of users) {
  const hasMePerson = await db.person.findFirst({
    where: { userId: user.id, handle: 'me' }
  });
  
  if (!hasMePerson) {
    const emailName = user.email.split('@')[0];
    const displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
    
    await db.person.create({
      data: {
        userId: user.id,
        handle: 'me',
        displayName,
        email: user.email,
        source: 'auto'
      }
    });
  }
}
```

## Person Sources

The `source` field now tracks how a person was created:
- `"manual"` - Created manually by user in People page
- `"mention"` - Auto-created from @mention in task
- `"import"` - Imported from external source
- `"auto"` - Auto-created "Me" entry on login ✨ NEW

## Testing

1. **New User**: Register a new account → Should auto-create "Me" person
2. **Existing User**: Log in → Should auto-create "Me" person if missing
3. **Task Creation**: Create task → Should default to current user as executor
4. **People List**: Check people list → Should see your "Me" entry

## Notes

- The "me" handle is reserved for the current user
- Each user gets their own "me" person (multi-tenant isolated)
- Display name can be changed later in People settings if desired
- This is idempotent - won't create duplicates



