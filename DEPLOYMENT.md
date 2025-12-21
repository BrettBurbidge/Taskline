# Taskline Deployment Guide

This guide covers deploying Taskline to Vercel with Supabase for authentication and database.

## Prerequisites

1. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
3. **GitHub Repository**: Your Taskline code pushed to GitHub

## Step 1: Set Up Supabase

### 1.1 Create a New Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Enter project details:
   - **Name**: taskline (or your preferred name)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
4. Wait for project to be created (~2 minutes)

### 1.2 Get Supabase Credentials

Once your project is ready:

1. Go to **Settings** → **API**
2. Copy these values (you'll need them for Vercel):
   - **Project URL**: `https://[your-project-ref].supabase.co`
   - **anon/public key**: The `anon` `public` key
   - **service_role key**: The `service_role` `secret` key (⚠️ Keep this secret!)

3. Go to **Settings** → **Database**
4. Scroll to **Connection String** → **URI** tab
5. Copy the connection string:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
   ```
6. Replace `[YOUR-PASSWORD]` with your database password from step 1.1

### 1.3 Run Database Migrations

You have two options:

**Option A: Using Prisma CLI (Recommended)**

1. Update your local `.env` file with Supabase credentials:
   ```env
   PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
   PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true&connection_limit=1
   ```

2. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```

**Option B: Using Supabase SQL Editor**

1. Go to **SQL Editor** in Supabase dashboard
2. Run each migration file manually:
   - `prisma/migrations/20251217015251_init/migration.sql`
   - `prisma/migrations/20251219231655_add_task_activity_model/migration.sql`
   - `prisma/migrations/20251220202823_add_multi_tenant_user_isolation/migration.sql`

### 1.4 Configure Supabase Auth

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider (enabled by default)
3. Configure email templates (optional):
   - **Authentication** → **Email Templates**
   - Customize confirmation and password reset emails

4. Configure URL settings:
   - **Authentication** → **URL Configuration**
   - Add your Vercel domain to **Site URL** once deployed

## Step 2: Deploy to Vercel

### 2.1 Connect GitHub Repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Taskline repository from GitHub
3. Configure project:
   - **Framework Preset**: SvelteKit
   - **Build Command**: `npm run build`
   - **Output Directory**: `.svelte-kit` (auto-detected)
   - **Install Command**: `npm install`

### 2.2 Configure Environment Variables

In the Vercel project settings, add these environment variables:

```env
# Supabase Configuration (from Step 1.2)
PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-supabase
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-from-supabase

# Database Connection (from Step 1.2)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true&connection_limit=1

# Optional: OpenAI API Key (for AI features)
OPENAI_API_KEY=your-openai-api-key

# Optional: Timezone Settings
DEFAULT_TIMEZONE=America/Denver
TZ=America/Denver
```

### 2.3 Deploy

1. Click **Deploy**
2. Wait for deployment to complete (~2-3 minutes)
3. Your app will be live at `https://your-project.vercel.app`

### 2.4 Update Supabase URL Configuration

After deployment:

1. Go back to Supabase dashboard
2. **Authentication** → **URL Configuration**
3. Update **Site URL** to your Vercel URL: `https://your-project.vercel.app`
4. Add **Redirect URLs**:
   - `https://your-project.vercel.app/auth/callback`
   - `https://your-project.vercel.app/auth/reset-password`

## Step 3: Test Your Deployment

1. Visit your Vercel URL
2. You should be redirected to `/auth/login`
3. Click "create a new account" to register
4. Check your email for confirmation
5. Sign in and test the app

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-side only) |
| `DATABASE_URL` | ✅ | PostgreSQL connection string from Supabase |
| `OPENAI_API_KEY` | ❌ | OpenAI API key for AI features (optional) |
| `DEFAULT_TIMEZONE` | ❌ | Default timezone (defaults to America/Denver) |
| `TZ` | ❌ | Server timezone (defaults to America/Denver) |

## Troubleshooting

### "Authentication failed" error

- Double-check your `DATABASE_URL` has the correct password
- Make sure the connection string includes `?pgbouncer=true&connection_limit=1`
- Verify your IP is not blocked in Supabase dashboard (Settings → Database → Connection Pooling)

### Can't sign in after registration

- Check Supabase email settings (Authentication → Providers → Email)
- Verify email templates are configured correctly
- Check your spam folder for confirmation email

### Deployment fails on Vercel

- Verify all environment variables are set correctly
- Check build logs for specific error messages
- Ensure `package.json` has all required dependencies

### Database migration errors

- Make sure you ran all migrations in order
- Check Supabase SQL Editor for any error messages
- Verify you have the correct database permissions

## Custom Domain

To use a custom domain:

1. Go to your Vercel project
2. **Settings** → **Domains**
3. Add your custom domain
4. Update DNS records as instructed
5. Update Supabase **Site URL** to your custom domain

## Continuous Deployment

Vercel automatically deploys when you push to your main branch:

1. Make changes locally
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```
3. Vercel automatically builds and deploys

## Database Backups

Supabase automatically backs up your database daily. To manual backup:

1. Go to **Database** → **Backups** in Supabase
2. Click **Back up now**
3. Download backup for local storage

## Monitoring

### Vercel Analytics

- Enable in Vercel project settings
- Monitor performance and usage

### Supabase Logs

- **Authentication** → **Logs**: See auth events
- **Database** → **Logs**: See database queries
- **API** → **Logs**: See API requests

## Security Best Practices

1. **Never commit sensitive keys** to Git
2. **Use environment variables** for all secrets
3. **Enable Row Level Security (RLS)** in Supabase for production (see next section)
4. **Rotate keys** periodically
5. **Monitor authentication logs** for suspicious activity

## Row Level Security (RLS) Setup

For production, enable RLS in Supabase:

```sql
-- Enable RLS on all tables
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "person" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stakeholder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "followup_rule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "followup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "context_note" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_activity" ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view their own data" ON "user"
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view their own people" ON "person"
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own projects" ON "project"
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own tasks" ON "task"
  FOR ALL USING (auth.uid() = user_id);

-- Add similar policies for other tables
```

Run these SQL statements in Supabase SQL Editor after deployment.

