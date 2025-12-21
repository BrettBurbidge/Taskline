import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	try {
		const { email } = await request.json();

		if (!email) {
			throw error(400, 'Email is required');
		}

		const { error: resendError } = await locals.supabase.auth.resend({
			type: 'signup',
			email,
			options: {
				emailRedirectTo: `${url.origin}/auth/callback`,
			},
		});

		if (resendError) {
			throw error(400, resendError.message);
		}

		return json({ 
			success: true,
			message: 'Confirmation email sent'
		});
	} catch (err: any) {
		console.error('Resend endpoint error:', err);
		return json(
			{ 
				success: false, 
				message: err.message || 'Failed to resend confirmation email' 
			},
			{ status: err.status || 500 }
		);
	}
};

