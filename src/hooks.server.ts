import { createSupabaseServerClient, getUser } from "$lib/server/auth";
import type { Handle } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { db } from "$lib/db";

export const handle: Handle = async ({ event, resolve }) => {
  // Create Supabase client for this request
  event.locals.supabase = createSupabaseServerClient(event);

  // Get the user session
  event.locals.user = await getUser(event);

  // Ensure user exists in database (create if first login)
  if (event.locals.user) {
    try {
      // Sync user to database
      await db.user.upsert({
        where: { id: event.locals.user.id },
        create: {
          id: event.locals.user.id,
          email: event.locals.user.email || "",
        },
        update: {
          email: event.locals.user.email || "",
        },
      });

      // Ensure user has a "Me" person entry (for task assignments)
      // This allows the user to be assigned as executor/accountable on tasks
      const existingPerson = await db.person.findFirst({
        where: { 
          userId: event.locals.user.id,
          handle: "me"
        },
      });

      if (!existingPerson) {
        // Create a "Me" person entry for this user
        // Extract name from email (everything before @)
        const emailName = event.locals.user.email?.split("@")[0] || "Me";
        const displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);

        await db.person.create({
          data: {
            userId: event.locals.user.id,
            handle: "me",
            displayName: displayName,
            email: event.locals.user.email || null,
            source: "auto",
          },
        });
      }
    } catch (err) {
      console.error("Failed to sync user to database:", err);
      // Don't throw - allow the app to continue even if user sync fails
      // The user will still be authenticated via Supabase
    }
  }

  // Protected routes - require authentication
  const protectedPaths = [
    "/board",
    "/inbox",
    "/week",
    "/day",
    "/tasks",
    "/projects",
    "/people",
    "/completed",
  ];

  // API routes that require auth (exclude auth endpoints)
  const isProtectedApiRoute =
    event.url.pathname.startsWith("/api") &&
    !event.url.pathname.startsWith("/auth");

  const isProtectedPath =
    protectedPaths.some((path) => event.url.pathname.startsWith(path)) ||
    isProtectedApiRoute;

  const isAuthPath = event.url.pathname.startsWith("/auth");

  // Redirect to login if accessing protected route without auth
  if (isProtectedPath && !event.locals.user) {
    throw redirect(303, "/auth/login");
  }

  // Redirect to board if already authenticated and trying to access auth pages
  // BUT allow the logout endpoint to execute
  if (isAuthPath && event.locals.user && event.url.pathname !== "/auth/logout") {
    throw redirect(303, "/board");
  }

  const response = await resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === "content-range" || name === "x-supabase-api-version";
    },
  });
  
  return response;
};
