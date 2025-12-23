# Logout Fix - Supabase SSR Best Practices

## Problem

The logout functionality was not working correctly:
- Page would refresh but not redirect to login
- User appeared to remain logged in (name still showed on /board)
- Session was not being properly cleared

## Root Cause

The previous implementation had two issues:

1. **Server-side**: Returned JSON instead of using a server-side redirect
2. **Client-side**: Used complex JavaScript with `fetch()` and manual redirect handling

This approach didn't properly clear the Supabase session in the SSR flow.

## Solution

Implemented Supabase SSR best practices for logout:

### Server-Side Changes (`/routes/auth/logout/+server.ts`)

**Before:**
```typescript
// Returned JSON and let client handle redirect
await locals.supabase.auth.signOut();
return json({ success: true }, { status: 200 });
```

**After:**
```typescript
// Call Supabase signOut
const { error } = await locals.supabase.auth.signOut();

// Clear any lingering cookies
const allCookies = cookies.getAll();
allCookies.forEach(cookie => {
  if (cookie.name.startsWith('sb-')) {
    cookies.delete(cookie.name, { path: '/' });
  }
});

// Server-side redirect (proper SvelteKit pattern)
throw redirect(303, '/auth/login');
```

### Client-Side Changes (`/lib/components/Nav.svelte`)

**Before:**
```typescript
// Complex async function with fetch and manual redirect
async function handleLogout() {
  const response = await fetch("/auth/logout", { method: "POST" });
  await invalidateAll();
  window.location.href = "/auth/login";
}
```

**After:**
```html
<!-- Simple HTML form submission -->
<form method="POST" action="/auth/logout" class="inline">
  <button type="submit">Logout</button>
</form>
```

## Why This Works

1. **HTML Form Submission**: Native browser form submission naturally follows server redirects
2. **Server-Side Redirect**: Using `throw redirect(303, '/auth/login')` ensures proper HTTP redirect
3. **Supabase SSR**: The SSR client properly clears cookies when `signOut()` is called
4. **Hooks Rerun**: After redirect, `hooks.server.ts` runs again and sets `locals.user = null`

## Supabase SSR Best Practices

This implementation follows Supabase's recommended patterns:

✅ Use the SSR server client for auth operations  
✅ Use server-side redirects (not client-side)  
✅ Let the SSR client manage cookies automatically  
✅ Clear any lingering cookies as a safety measure  
✅ Use standard HTTP redirects (303 See Other)  

## Testing

To verify logout works correctly:

1. Log in to the application
2. Navigate to any protected page (e.g., /board)
3. Click the "Logout" button
4. Verify:
   - ✓ Redirects to /auth/login
   - ✓ User name disappears from nav
   - ✓ Attempting to access /board redirects to login
   - ✓ Session is cleared (no auth cookies remain)

## References

- [Supabase SSR Auth Documentation](https://supabase.com/docs/guides/auth/server-side/sveltekit)
- [SvelteKit Form Actions](https://kit.svelte.dev/docs/form-actions)
- [SvelteKit Redirects](https://kit.svelte.dev/docs/modules#sveltejs-kit-redirect)



