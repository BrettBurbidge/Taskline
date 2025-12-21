<script lang="ts">
  import { supabase } from '$lib/supabase';

  let email = $state('');
  let loading = $state(false);
  let error = $state('');
  let success = $state(false);

  async function handleResetPassword() {
    loading = true;
    error = '';
    success = false;

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) throw resetError;

      success = true;
    } catch (err: any) {
      error = err.message || 'An error occurred while sending the reset email';
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div>
      <h1 class="text-center text-4xl font-bold text-gray-900">Taskline</h1>
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Reset your password
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Enter your email address and we'll send you a link to reset your password.
      </p>
    </div>

    <form class="mt-8 space-y-6" onsubmit={(e) => { e.preventDefault(); handleResetPassword(); }}>
      {#if error}
        <div class="rounded-md bg-red-50 p-4">
          <p class="text-sm text-red-800">{error}</p>
        </div>
      {/if}

      {#if success}
        <div class="rounded-md bg-green-50 p-4">
          <p class="text-sm text-green-800">
            Password reset email sent! Check your inbox for further instructions.
          </p>
        </div>
      {/if}

      <div class="rounded-md shadow-sm">
        <label for="email-address" class="sr-only">Email address</label>
        <input
          id="email-address"
          name="email"
          type="email"
          autocomplete="email"
          required
          bind:value={email}
          class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
          placeholder="Email address"
        />
      </div>

      <div class="flex flex-col space-y-4">
        <button
          type="submit"
          disabled={loading}
          class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending email...' : 'Send reset email'}
        </button>

        <div class="text-center text-sm">
          <a href="/auth/login" class="font-medium text-blue-600 hover:text-blue-500">
            Back to sign in
          </a>
        </div>
      </div>
    </form>
  </div>
</div>

