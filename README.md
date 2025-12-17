# Papa - Personal AI Project Assistant

Papa is a lightweight, single-user task and follow-up system designed to help manage commitments, delegation, and ongoing communication across many concurrent projects, meetings, and conversations. The product focuses on accountability, follow-up, and daily execution, rather than traditional project management.

## Features

### ✅ Core Task Management
- **Quick Task Capture**: Add tasks quickly via the Inbox with minimal friction
- **Task Organization**: Group tasks by projects, assign executors, and add stakeholders
- **Flexible Scheduling**: Board dates for daily planning + due dates for deadlines
- **Task Status Tracking**: not_started, in_progress, waiting, completed, cancelled

### 📋 Daily Board
- **Today's Focus**: See all tasks scheduled for today
- **Reordering**: Move tasks up/down to prioritize your day
- **Quick Actions**: Complete tasks, move to another date, or rollover to tomorrow
- **Follow-up Visibility**: See all follow-ups due today in the sidebar

### 🔔 Smart Follow-Ups
- **Automatic Generation**: Follow-ups are created based on task due dates and cadence rules
- **Three Types**:
  - **Self Accountability**: Remind yourself to check on your own tasks
  - **Executor Check-ins**: Follow up with delegated tasks
  - **Stakeholder Updates**: Keep stakeholders informed
- **Dynamic Cadence**: More frequent as due dates approach
- **Snooze & Complete**: Manage follow-ups with flexible controls

### 📅 Week View
- **7-Day Calendar**: Visual overview of the week ahead
- **Overdue Visibility**: See overdue tasks at the top
- **Color-Coded Status**: Quick visual status indicators

### 📁 Project Management
- **Project Grouping**: Organize tasks under projects
- **Project Dashboard**: See all tasks and progress for each project
- **Context Notes**: Add notes and context to projects (coming soon)

### 👥 Smart People Management
- **@Mention Parsing**: Automatically detect and assign people using natural syntax:
  - `@gwenith` and `@suzan` → stakeholders
  - `→ @jeff` or `assign to @jeff` → executor
  - `delegate to @bob` → executor
- **Auto-Create People**: New people are created automatically when mentioned
- **Email Management**: Add emails to people for AI-drafted follow-ups
- **People Directory**: View all contacts with usage stats (tasks, roles)

### ✨ AI Assistance (Optional)
- **Task Parsing**: AI can parse free-text input and suggest:
  - Task title and description
  - Due dates
  - Priority
  - Suggested executor and stakeholders
  - Appropriate project
  - Follow-up cadence
- **Message Drafting**: Generate draft messages for stakeholder updates and executor check-ins (coming soon)

## Tech Stack

- **Frontend**: SvelteKit + Svelte 5 + TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (via Docker)
- **ORM**: Prisma v7
- **AI**: OpenAI GPT-4 (optional)
- **Date Handling**: date-fns
- **Validation**: Zod

## Setup

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for PostgreSQL)

### Installation

1. **Clone the repository** (or you're already here!)

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start PostgreSQL:**
   ```bash
   docker compose up -d
   ```

4. **Set up environment variables:**
   
   Create a `.env` file in the root:
   ```env
   DATABASE_URL="postgresql://papa:papa_dev_password@localhost:5432/papa_db?schema=public"
   
   # Optional: For AI features
   OPENAI_API_KEY="your-openai-api-key"
   ```

5. **Run database migrations:**
   ```bash
   npx prisma migrate dev
   ```

6. **Seed the database:**
   ```bash
   npx prisma db seed
   ```
   
   This creates:
   - A default user: Brett (@brett)
   - A sample project: Papa Development

7. **Start the development server:**
   ```bash
   npm run dev
   ```

8. **Open the app:**
   
   Navigate to [http://localhost:5173](http://localhost:5173)

## Usage

### Quick Start

1. **Add Your First Task**
   - Click "Inbox" in the nav
   - Type a task title (e.g., "Call John about Q4 budget")
   - Press Enter or click "Create Task"
   - The task appears on your Daily Board

2. **Manage Your Day**
   - Go to "Daily Board"
   - Reorder tasks with ↑↓ buttons
   - Complete tasks with the ✓ button
   - Move tasks to another date with the → button
   - At end of day, click "Rollover to Tomorrow" to move incomplete tasks

3. **Generate Follow-Ups**
   - On the Daily Board, click "🔔 Generate Follow-ups"
   - Follow-ups appear in the sidebar based on your task due dates
   - Complete or snooze them as you go

4. **View Your Week**
   - Click "Week View" to see the next 7 days
   - Tasks are organized by due date
   - Overdue tasks highlighted at top

5. **Organize with Projects**
   - Go to "Projects"
   - Create a new project
   - When adding tasks, assign them to a project
   - View project details to see all related tasks

6. **Use @Mentions for People**
   - Mention stakeholders: `"Email @gwenith and @suzan about the proposal"`
   - Assign executor: `"Fix bug → @jeff"` or `"assign to @alice"`
   - Auto-creation: People are created automatically from @mentions
   - Add emails: Go to "People" page to add emails for AI-drafted follow-ups
   - Visual preview: See detected mentions before creating the task

### AI Features (Optional)

If you've set an `OPENAI_API_KEY`:

1. **AI Task Parsing**
   - In the Inbox, type a natural description like:
     > "Set up meeting with @steen about website redesign by next Friday, need to keep @john updated"
   - Click "✨ AI Assist"
   - AI will parse and suggest:
     - Clean task title
     - Due date
     - Executor (@steen)
     - Stakeholder (@john)
     - Project match

2. **Message Drafting** (Coming Soon)
   - Draft professional messages for follow-ups
   - Available via task detail view

## Database Schema

### Core Entities

- **Person**: Users and contacts (@mentions)
- **Project**: Loose grouping for tasks
- **Task**: The core work item with status, dates, and relationships
- **Stakeholder**: Many-to-many relation between tasks and people
- **FollowUpRule**: Configuration for automatic follow-up generation
- **FollowUp**: Generated reminder instances
- **ContextNote**: Notes attached to tasks or projects

See `prisma/schema.prisma` for the complete schema.

## Development

### Key Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Type-check
npm run check

# Run Prisma Studio (database GUI)
npx prisma studio

# Create a migration after schema changes
npx prisma migrate dev --name <migration-name>

# Generate Prisma Client after schema changes
npx prisma generate
```

### Project Structure

```
src/
├── lib/
│   ├── components/     # Reusable Svelte components
│   │   └── Nav.svelte
│   ├── services/       # Business logic
│   │   ├── ai.ts       # AI parsing and drafting
│   │   └── followupEngine.ts  # Follow-up generation
│   └── db.ts           # Prisma client singleton
├── routes/
│   ├── api/            # API endpoints
│   │   ├── ai/
│   │   ├── board/
│   │   ├── followups/
│   │   ├── people/
│   │   ├── projects/
│   │   └── tasks/
│   ├── board/          # Daily Board page
│   ├── inbox/          # Task creation page
│   ├── projects/       # Projects list and detail
│   ├── week/           # Week view
│   └── +page.svelte    # Home page
prisma/
├── schema.prisma       # Database schema
├── seed.ts             # Seed script
└── migrations/         # Database migrations
```

## Roadmap / Future Enhancements

### v1 Complete ✅
- [x] Core task CRUD
- [x] Daily Board with reordering and rollover
- [x] Follow-up engine with automatic generation
- [x] Week view and project management
- [x] AI assistance for task parsing (optional)

### v2 Ideas
- [ ] Task detail modal/page
- [ ] Advanced filtering and search
- [ ] Context notes UI (add/edit)
- [ ] AI message drafting UI
- [ ] Recurring tasks
- [ ] Task templates
- [ ] Email integration for follow-ups
- [ ] Mobile responsive improvements
- [ ] Dark mode
- [ ] Multi-user support (future)
- [ ] Calendar sync (Google Cal, Outlook)

## Contributing

This is a personal project, but suggestions and improvements are welcome! Feel free to open issues or submit PRs.

## License

MIT License - feel free to use this for your own projects!

## Credits

Built by Brett Burbidge based on the Papa PRD specification.

Powered by:
- SvelteKit
- Prisma
- PostgreSQL  
- Tailwind CSS
- OpenAI (optional)
