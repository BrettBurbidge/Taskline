import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Handle } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

// Create a Supabase client for regular user authentication (uses cookies)
export const createSupabaseServerClient = (event: any) => {
	return createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => {
				return event.cookies.getAll();
			},
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					// Supabase sends empty string to delete cookies
					if (!value || value === '') {
						event.cookies.delete(name, { 
							...options, 
							path: options?.path || '/' 
						});
					} else {
						event.cookies.set(name, value, { 
							...options, 
							path: options?.path || '/' 
						});
					}
				});
			},
		},
	});
};

// Create a Supabase admin client (bypasses RLS - use with caution!)
export const createSupabaseAdminClient = () => {
	return createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});
};

export const getUser = async (event: any) => {
	const supabase = createSupabaseServerClient(event);
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();
	
	if (error) {
		return null;
	}
	
	return user;
};

