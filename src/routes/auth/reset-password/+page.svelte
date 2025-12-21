<script lang="ts">
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let password = $state('');
  let confirmPassword = $state('');
  let loading = $state(false);
  let error = $state('');
  let success = $state(false);

  onMount(async () => {
    // Check if we have an active session from the reset link
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      error = 'Invalid or expired reset link. Please request a new one.';
    }
  });

  async function handleUpdatePassword() {
    loading = true;
    error = '';
    success = false;

    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      loading = false;
      return;
    }

    if (password.length < 6) {
      error = 'Password must be at least 6 characters';
      loading = false;
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      success = true;
      setTimeout(() => {
        goto('/auth/login');
      }, 2000);
    } catch (err: any) {
      error = err.message || 'An error occurred while updating your password';
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
        Set new password
      </h2>
    </div>

    <form class="mt-8 space-y-6" onsubmit={(e) => { e.preventDefault(); handleUpdatePassword(); }}>
      {#if error}
        <div class="rounded-md bg-red-50 p-4">
          <p class="text-sm text-red-800">{error}</p>
        </div>
      {/if}

      {#if success}
        <div class="rounded-md bg-green-50 p-4">
          <p class="text-sm text-green-800">
            Password updated successfully! Redirecting to sign in...
          </p>
        </div>
      {/if}

      <div class="rounded-md shadow-sm space-y-4">
        <div>
          <label for="password" class="sr-only">New Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="new-password"
            required
            bind:value={password}
            class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
            placeholder="New password (min. 6 characters)"
          />
        </div>
        <div>
          <label for="confirm-password" class="sr-only">Confirm New Password</label>
          <input
            id="confirm-password"
            name="confirm-password"
            type="password"
            autocomplete="new-password"
            required
            bind:value={confirmPassword}
            class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
            placeholder="Confirm new password"
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={loading || success}
          class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Updating password...' : 'Update password'}
        </button>
      </div>
    </form>
  </div>
</div>

