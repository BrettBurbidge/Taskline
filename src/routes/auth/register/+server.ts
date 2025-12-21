import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	try {
		const { email, password } = await request.json();

		if (!email || !password) {
			throw error(400, 'Email and password are required');
		}

		if (password.length < 6) {
			throw error(400, 'Password must be at least 6 characters');
		}

		const { data, error: signUpError } = await locals.supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: `${url.origin}/auth/callback`,
			},
		});

		if (signUpError) {
			throw error(400, signUpError.message);
		}

		// Check if user already exists
		if (data.user && data.user.identities && data.user.identities.length === 0) {
			throw error(409, 'An account with this email already exists');
		}

		return json({ 
			success: true,
			user: data.user,
			session: data.session ? true : false,
			message: data.session 
				? 'Registration successful! Redirecting...'
				: 'Registration successful! Please check your email to confirm your account.'
		});
	} catch (err: any) {
		console.error('Registration endpoint error:', err);
		return json(
			{ 
				success: false, 
				message: err.message || 'Registration failed' 
			},
			{ status: err.status || 500 }
		);
	}
};

