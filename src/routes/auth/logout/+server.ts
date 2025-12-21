import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	// Sign out from Supabase
	// The SSR client will handle cookie deletion through the setAll callback
	const { error } = await locals.supabase.auth.signOut();
	
	if (error) {
		console.error('Supabase logout error:', error);
	}
	
	// Server-side redirect to login page
	throw redirect(303, '/auth/login');
};

