# Timezone System

Papa now has full timezone awareness throughout the application.

## How It Works

### 1. Storage (Database)
- **All dates/times stored as UTC** in PostgreSQL
- This is the universal standard and allows users in different timezones to collaborate

### 2. Detection (Client)
- User's timezone is automatically detected from browser: `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Stored in localStorage for consistency
- Example: `"America/Denver"`, `"Europe/London"`, `"Asia/Tokyo"`

### 3. Conversion

**When Saving (Client → Server → Database):**
```
User enters: "December 15, 2025" (in their timezone)
           ↓
Client converts: "2025-12-15" + timezone "America/Denver"
           ↓
Server converts to UTC: 2025-12-15T07:00:00.000Z (7am UTC = midnight MST)
           ↓
Database stores: UTC timestamp
```

**When Loading (Database → Server → Client):**
```
Database returns: 2025-12-15T07:00:00.000Z
           ↓
Client receives: UTC timestamp
           ↓
Client converts: "December 15, 2025" (displayed in user's timezone)
```

## Utility Functions

Located in: `src/lib/utils/timezone.ts`

### Key Functions:

- `getUserTimezone()` - Get the user's timezone
- `dateStringToUTC(dateStr, tz)` - Convert "YYYY-MM-DD" from user TZ to UTC
- `utcToDateString(utcDate, tz)` - Convert UTC Date to "YYYY-MM-DD" in user TZ
- `formatDateInUserTZ(utcDate, format, tz)` - Format date in user's timezone
- `formatDateTimeInUserTZ(utcDate, format, tz)` - Format datetime in user's timezone
- `getTodayString(tz)` - Get today's date as "YYYY-MM-DD" in user's timezone
- `isToday(utcDate, tz)` - Check if a UTC date is today in user's timezone

## Usage Examples

### In Svelte Components:

```typescript
import { utcToDateString, formatDateInUserTZ } from '$lib/utils/timezone';

// For date inputs (YYYY-MM-DD format)
<input type="date" bind:value={utcToDateString(task.dueAt)} />

// For displaying dates
<div>{formatDateInUserTZ(task.dueAt, 'MMM d, yyyy')}</div>

// For displaying date + time
<div>{formatDateTimeInUserTZ(task.createdAt, 'MMM d, h:mm a')}</div>
```

### In Form Submissions:

Always include timezone as hidden field:
```svelte
<form method="POST">
  <input type="hidden" name="timezone" value={getUserTimezone()} />
  <input type="date" name="dueAt" />
  <button>Save</button>
</form>
```

### In Server-Side Code:

```typescript
import { dateStringToUTC } from '$lib/utils/timezone';

const formData = await request.formData();
const dateStr = formData.get('dueAt') as string;
const timezone = formData.get('timezone') as string;

// Convert to UTC for storage
const utcDate = dateStringToUTC(dateStr, timezone);

await db.task.create({
  data: { dueAt: utcDate }
});
```

## Configuration

### Environment Variables (Optional)

Set a default timezone for server-side operations:

```env
DEFAULT_TIMEZONE="America/Denver"
```

This is used when timezone cannot be detected (e.g., server-side rendering, API calls without timezone context).

### User Preferences (Future)

Currently, timezone is auto-detected from browser. In the future, you could:
1. Add a user settings page to manually select timezone
2. Store timezone preference in User table
3. Allow timezone override for specific views

## Benefits

✅ **No More Off-By-One Date Errors** - December 15 stays December 15
✅ **Multi-Timezone Support** - Ready for team collaboration
✅ **Consistent Experience** - All dates display correctly for each user
✅ **Proper UTC Storage** - Follow database best practices
✅ **Future-Proof** - Easy to add multi-user support later

## Testing

To test timezone handling:

1. Check your browser timezone: Open console and run `Intl.DateTimeFormat().resolvedOptions().timeZone`
2. Create a task with a due date
3. Check the database to verify it's stored as UTC:
   ```sql
   SELECT id, title, due_at FROM task;
   ```
4. The `due_at` column should show UTC time (likely different from your input)
5. Reload the page - the date should display correctly in your timezone

## Troubleshooting

**Issue:** Dates are still off by one day
- **Check:** Is timezone being passed in the form? Look for hidden input field
- **Check:** Are you using the timezone utility functions for display?
- **Check:** Server logs - what timezone is being received?

**Issue:** Server errors about timezone
- **Solution:** Make sure `date-fns-tz` is installed: `npm install date-fns-tz`
- **Solution:** Check that timezone is being passed from client to server

**Issue:** Want to test with different timezone
- **Solution:** In browser console: `localStorage.setItem('user_timezone', 'Europe/London')`
- **Solution:** Refresh the page to use the new timezone

