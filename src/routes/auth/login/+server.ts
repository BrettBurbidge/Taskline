import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { email, password } = await request.json();

		if (!email || !password) {
			throw error(400, 'Email and password are required');
		}

		const { data, error: signInError } = await locals.supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (signInError) {
			throw error(401, signInError.message);
		}

		return json({ 
			success: true,
			user: data.user
		});
	} catch (err: any) {
		console.error('Login endpoint error:', err);
		return json(
			{ 
				success: false, 
				message: err.message || 'Login failed' 
			},
			{ status: err.status || 500 }
		);
	}
};

