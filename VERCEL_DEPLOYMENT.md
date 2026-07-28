# Vercel Deployment Guide for Taskline

This guide will walk you through deploying Taskline to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Supabase Project**: Your Supabase project should be set up with:
   - Authentication enabled
   - Database migrations applied
   - Connection pooling enabled

## Step 1: Prepare Your Repository

1. **Commit all changes**:
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push
   ```

2. **Ensure `.env` is in `.gitignore`** (already done)

## Step 2: Configure Supabase for Production

### Enable Connection Pooling

1. Go to your Supabase project: https://app.supabase.com
2. Navigate to **Settings** → **Database**
3. Find **Connection Pooling** section
4. Copy the **Connection string** with **Session mode**
5. This will be your `DATABASE_URL` for Vercel

### Get API Keys

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** → `PUBLIC_SUPABASE_URL`
   - **anon public** key → `PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

## Step 3: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Configure the project:
   - **Framework Preset**: SvelteKit (auto-detected)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.svelte-kit` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

4. **Add Environment Variables**:
   Click "Environment Variables" and add:

   ```
   PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   DATABASE_URL=postgresql://postgres.your-project:password@aws-0-us-west-2.pooler.supabase.com:5432/postgres
   DIRECT_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
   ```

   `DIRECT_URL` must be a **direct, non-pooled** connection — it is what
   `prisma migrate deploy` uses during the build. Migrations hang forever
   through the pgbouncer pooler.

   Optional:
   ```
   OPENAI_API_KEY=sk-...
   DEFAULT_TIMEZONE=America/Denver
   ```

5. Click **Deploy**

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

4. **Add environment variables**:
   ```bash
   vercel env add PUBLIC_SUPABASE_URL
   vercel env add PUBLIC_SUPABASE_ANON_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add DATABASE_URL
   vercel env add DIRECT_URL
   ```

5. **Deploy to production**:
   ```bash
   vercel --prod
   ```

## Step 4: Configure Supabase Auth for Production

1. Go to your Supabase project: **Authentication** → **URL Configuration**

2. Add your Vercel domain to **Site URL**:
   ```
   https://your-app.vercel.app
   ```

3. Add to **Redirect URLs**:
   ```
   https://your-app.vercel.app/auth/callback
   https://your-app.vercel.app/**
   ```

4. Update **Email Templates** (optional):
   - Go to **Authentication** → **Email Templates**
   - Update the redirect URLs in confirmation emails to use your production domain

## Step 5: Database Migrations

Migrations run **automatically on every Vercel deploy**. The `buildCommand` in
`vercel.json` runs `npm run migrate:deploy` (`prisma migrate deploy`) before the
app is built, so any new migration in `prisma/migrations/` is applied as part of
the deploy. If a migration fails, the build fails and the deploy is not promoted.

### Required: `DIRECT_URL`

`prisma migrate deploy` **cannot run through a connection pooler**. If your
`DATABASE_URL` is the Supabase pooler string (port `6543`, `?pgbouncer=true`),
migrations will hang until the build times out.

Add a second environment variable in Vercel pointing at the same database on the
direct port `5432`:

```
DIRECT_URL=postgresql://postgres:PASSWORD@db.xxxx.supabase.co:5432/postgres
```

`prisma.config.ts` uses `DIRECT_URL` for migration commands when it is set, and
falls back to `DATABASE_URL` otherwise. The running app always uses
`DATABASE_URL` (the pooled connection), which is what you want for serverless.

### Running migrations manually

Still useful for applying a migration ahead of a deploy, or to a local database:

```bash
# Against production (pull env first)
vercel env pull .env.production
npx prisma migrate deploy

# Or point at a database explicitly — must be a DIRECT (non-pooled) URL
DIRECT_URL="postgresql://...:5432/postgres" npx prisma migrate deploy
```

## Step 6: Verify Deployment

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Test the following:
   - ✅ Registration works
   - ✅ Login works
   - ✅ Logout works
   - ✅ Creating tasks works
   - ✅ Multi-tenant isolation (create second user, verify data separation)

## Troubleshooting

### Build Fails with Prisma Error

**Error**: `Prisma Client could not be generated`

**Solution**: Ensure `postinstall` script runs:
```json
"scripts": {
  "postinstall": "prisma generate"
}
```

### Database Connection Fails

**Error**: `Can't reach database server`

**Solution**: 
1. Use **Connection Pooling** URL from Supabase (not direct connection)
2. Ensure you're using **Session mode** (not Transaction mode)
3. Verify the DATABASE_URL includes the password

### Environment Variables Not Working

**Error**: `PUBLIC_SUPABASE_URL is undefined`

**Solution**:
1. Ensure variables are added in Vercel dashboard
2. Redeploy after adding variables
3. Check variable names match exactly (case-sensitive)

### Auth Redirect Issues

**Error**: `Invalid redirect URL`

**Solution**:
1. Add your Vercel domain to Supabase **Redirect URLs**
2. Include both:
   - `https://your-app.vercel.app/auth/callback`
   - `https://your-app.vercel.app/**`

## Continuous Deployment

Vercel automatically deploys:
- **Production**: Pushes to `main` branch → `your-app.vercel.app`
- **Preview**: Pull requests → `your-app-git-branch.vercel.app`

## Custom Domain (Optional)

1. Go to your Vercel project → **Settings** → **Domains**
2. Add your custom domain (e.g., `taskline.yourdomain.com`)
3. Update DNS records as instructed
4. Update Supabase redirect URLs to include custom domain

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_SUPABASE_URL` | ✅ Yes | Your Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | Supabase service role key (keep secret!) |
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string (use pooling) |
| `DIRECT_URL` | ✅ Yes | Direct, non-pooled connection (port 5432) — used by `prisma migrate deploy` at build time |
| `OPENAI_API_KEY` | ❌ No | OpenAI API key for AI features |
| `DEFAULT_TIMEZONE` | ❌ No | Default timezone (default: America/Denver) |

## Security Checklist

- ✅ `.env` file is in `.gitignore`
- ✅ Service role key is only in Vercel environment variables
- ✅ Database URL uses connection pooling
- ✅ Supabase RLS (Row Level Security) is enabled
- ✅ Auth redirect URLs are restricted to your domains
- ✅ CORS is configured in Supabase if needed

## Performance Optimization

1. **Enable Vercel Analytics** (optional):
   - Go to project → **Analytics** → Enable

2. **Configure Caching** (already optimized in SvelteKit)

3. **Monitor Database Performance**:
   - Check Supabase dashboard for slow queries
   - Add indexes if needed

## Monitoring

- **Vercel Logs**: View in Vercel dashboard → **Logs**
- **Supabase Logs**: View in Supabase dashboard → **Logs**
- **Error Tracking**: Consider adding Sentry (optional)

## Updating the App

1. Make changes locally
2. Test thoroughly
3. Commit and push:
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```
4. Vercel automatically deploys

## Rollback

If something goes wrong:

1. Go to Vercel dashboard → **Deployments**
2. Find the last working deployment
3. Click **...** → **Promote to Production**

## Support

- **Vercel Docs**: https://vercel.com/docs
- **SvelteKit Docs**: https://kit.svelte.dev/docs
- **Supabase Docs**: https://supabase.com/docs
- **Prisma Docs**: https://www.prisma.io/docs

## Next Steps

After successful deployment:

1. ✅ Test all features in production
2. ✅ Set up custom domain (optional)
3. ✅ Configure email templates in Supabase
4. ✅ Enable Vercel Analytics
5. ✅ Set up monitoring/alerts
6. ✅ Document any custom configurations

---

**Your app is now live! 🎉**

Visit your deployment at: `https://your-app.vercel.app`


