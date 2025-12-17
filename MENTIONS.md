# @Mention Feature Guide

Papa includes intelligent @mention parsing that automatically detects people in your task descriptions and assigns them as stakeholders or executors.

## How It Works

When you type a task in the **Inbox**, Papa automatically:

1. ✅ Detects all `@mentions`
2. ✅ Identifies executors from special syntax
3. ✅ Creates new people automatically
4. ✅ Shows you a preview before saving
5. ✅ Assigns the right roles when creating the task

## Syntax

### Stakeholders (People to Keep Informed)

Just mention them with `@`:

```
"Email @gwenith and @suzan about the Q4 proposal"
```

**Result:**

- Stakeholders: @gwenith, @suzan

---

### Executor (Person Responsible)

Use any of these patterns:

**Arrow syntax:**

```
"Fix homepage bug → @jeff"
"Update database schema > @alice"
```

**Delegate syntax:**

```
"Delegate to @bob: Review PR #123"
"Delegated to @charlie the budget analysis"
```

**Assign syntax:**

```
"Assign to @dana: Update documentation"
"Assigned to @evan the integration testing"
```

**Result:**

- Executor: The person mentioned with the special syntax
- Any other @mentions become stakeholders

---

## Auto-Creation

### New People

If you mention someone who doesn't exist yet (e.g., `@gwenith`), Papa will:

1. **Create the person automatically** with:

   - Handle: `gwenith`
   - Display Name: `Gwenith` (capitalized)
   - Source: `mention`

2. **Show a preview** in the Inbox:

   ```
   ✨ Auto-detected from text:
   Stakeholders: @gwenith (will be created)
   ```

3. **Assign them immediately** when you create the task

### Adding Emails Later

1. Go to **People** page (👥 in nav)
2. Click **Edit** next to any person
3. Add their email address
4. This enables AI-drafted follow-up messages later

---

## Visual Preview

As you type in the Inbox, you'll see a **purple preview box** showing:

```
✨ Auto-detected from text:

Executor: @jeff
Stakeholders: @gwenith @suzan (new)

💡 New people will be created automatically.
   You can add their emails later in People.
```

This lets you **verify before creating** the task.

---

## Examples

### Example 1: Meeting Prep

```
"Prepare slides for investor meeting with @maria → @tom"
```

**Result:**

- Executor: @tom
- Stakeholders: @maria
- If @maria or @tom don't exist, they're auto-created

---

### Example 2: Multiple Stakeholders

```
"Send project update to @gwenith, @suzan, and @john by Friday"
```

**Result:**

- Stakeholders: @gwenith, @suzan, @john
- Executor: You (default)
- 3 new people created if they don't exist

---

### Example 3: Delegation

```
"Assign to @alice: Review legal documents before signing"
```

**Result:**

- Executor: @alice
- Stakeholders: None
- @alice auto-created if needed

---

## People Management

### View All People

Go to **People** page to see:

- All contacts
- Their @handles
- Email addresses
- Usage stats:
  - 👤 Tasks where they're accountable
  - ⚡ Tasks where they're executor
  - 👥 Tasks where they're stakeholder

### Edit People

Click **Edit** to:

- Update display name
- Add/change email
- (Emails are used for AI-drafted follow-ups)

### Delete People

Click **Delete** if:

- They're not assigned to any tasks
- Otherwise, you'll get an error (prevents orphaned references)

---

## Pro Tips

1. **Natural Typing**: Just type naturally! Papa will figure it out.

   ```
   "Check with @steen about hosting costs"  ✅
   ```

2. **Multiple Formats**: Use whatever feels natural:

   ```
   → @name
   > @name
   delegate to @name
   assign to @name
   ```

3. **Case Insensitive**: Handles are normalized to lowercase:

   ```
   @Gwenith  →  gwenith
   @JEFF     →  jeff
   ```

4. **Combine Both**: Executor + stakeholders in one task:

   ```
   "Review contract with @gwenith and send to legal → @bob"
   ```

   - Executor: @bob
   - Stakeholders: @gwenith

5. **Auto-Learn**: As you mention people, they build up in your directory automatically!

---

## Future Enhancements

- 🔮 **Autocomplete**: Type `@` and see a dropdown of existing people
- 🔮 **Email Integration**: Send actual emails from follow-ups
- 🔮 **Contact Sync**: Import from Google Contacts, Outlook, etc.
- 🔮 **Team Collaboration**: Share tasks with actual team members

---

## Technical Details

### Database Schema

People are stored with:

```prisma
model Person {
  id          String   @id @default(uuid())
  handle      String   @unique  // e.g., "gwenith"
  displayName String            // e.g., "Gwenith Smith"
  email       String?           // Optional, for follow-ups
  source      String            // "manual" | "mention" | "import"

  // Relations
  accountableTasks Task[] @relation("AccountablePerson")
  executorTasks    Task[] @relation("ExecutorPerson")
  stakeholderOn    Stakeholder[]
}
```

### Mention Parsing

The parsing utility (`src/lib/utils/mentions.ts`) uses regex to:

1. **Find all @mentions**: `/@(\w+)/g`
2. **Find executor patterns**:
   - `[→>]\s*@(\w+)` — Arrow syntax
   - `delegat(?:e|ed)\s+to\s+@(\w+)` — Delegate syntax
   - `assign(?:ed)?\s+to\s+@(\w+)` — Assign syntax
3. **Remove executor from stakeholders** (if overlapping)
4. **Deduplicate** and return structured data

### API Endpoint

Creating people via API:

```typescript
POST /api/people
{
  "handle": "gwenith",
  "displayName": "Gwenith Smith",
  "email": "gwenith@example.com", // optional
  "source": "mention"
}
```

Returns:

```json
{
  "id": "uuid-here",
  "handle": "gwenith",
  "displayName": "Gwenith Smith",
  "email": "gwenith@example.com"
}
```

---

## Questions?

See the main [README.md](./README.md) for more information, or explore the code:

- Mention parsing: `src/lib/utils/mentions.ts`
- Inbox UI: `src/routes/inbox/+page.svelte`
- People page: `src/routes/people/+page.svelte`
- API: `src/routes/api/people/+server.ts`

Happy @mentioning! 🚀
