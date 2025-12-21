<script lang="ts">
  import { invalidateAll } from "$app/navigation";

  let email = $state("");
  let password = $state("");
  let loading = $state(false);
  let error = $state("");
  let resendingEmail = $state(false);
  let resendSuccess = $state("");

  async function handleLogin() {
    loading = true;
    error = "";
    resendSuccess = "";

    try {
      // Use the native fetch to call our server-side login endpoint
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Login failed");
      }

      // Invalidate all data and redirect
      await invalidateAll();
      window.location.href = "/board";
    } catch (err: any) {
      error = err.message || "An error occurred during login";
      loading = false;
    }
  }

  async function handleResendConfirmation() {
    if (!email) {
      error = "Please enter your email address";
      return;
    }

    resendingEmail = true;
    resendSuccess = "";
    error = "";

    try {
      const response = await fetch("/auth/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Failed to resend confirmation email"
        );
      }

      resendSuccess = "Confirmation email sent! Please check your inbox.";
    } catch (err: any) {
      error = err.message || "Failed to resend confirmation email";
    } finally {
      resendingEmail = false;
    }
  }
</script>

<div
  class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8"
>
  <div class="max-w-md w-full space-y-8">
    <div>
      <h1 class="text-center text-4xl font-bold text-gray-900">Taskline</h1>
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Sign in to your account
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Or
        <a
          href="/auth/register"
          class="font-medium text-blue-600 hover:text-blue-500"
        >
          create a new account
        </a>
      </p>
    </div>

    <form
      class="mt-8 space-y-6"
      onsubmit={(e) => {
        e.preventDefault();
        handleLogin();
      }}
    >
      {#if error}
        <div class="rounded-md bg-red-50 p-4">
          <div
            class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
          >
            <p class="text-sm text-red-800">{error}</p>
            {#if error.toLowerCase().includes("email not confirmed") || error
                .toLowerCase()
                .includes("email confirmation")}
              <button
                type="button"
                onclick={handleResendConfirmation}
                disabled={resendingEmail}
                class="text-sm font-medium text-blue-600 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap underline"
              >
                {resendingEmail ? "Sending..." : "Resend confirmation email"}
              </button>
            {/if}
          </div>
        </div>
      {/if}

      {#if resendSuccess}
        <div class="rounded-md bg-green-50 p-4">
          <p class="text-sm text-green-800">{resendSuccess}</p>
        </div>
      {/if}

      <div class="rounded-md shadow-sm -space-y-px">
        <div>
          <label for="email-address" class="sr-only">Email address</label>
          <input
            id="email-address"
            name="email"
            type="email"
            autocomplete="email"
            required
            bind:value={email}
            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
            placeholder="Email address"
          />
        </div>
        <div>
          <label for="password" class="sr-only">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            bind:value={password}
            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
            placeholder="Password"
          />
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div class="text-sm">
          <a
            href="/auth/forgot-password"
            class="font-medium text-blue-600 hover:text-blue-500"
          >
            Forgot your password?
          </a>
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </form>
  </div>
</div>
