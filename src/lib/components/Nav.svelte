<script lang="ts">
  import { page } from "$app/stores";
  import { dev } from "$app/environment";

  interface User {
    id: string;
    email: string | undefined;
  }

  interface Props {
    user?: User | null;
  }

  let { user }: Props = $props();

  const navItems = [
    { href: "/inbox", label: "Inbox", icon: "📥" },
    { href: "/board", label: "Daily Board", icon: "📋" },
    { href: "/week", label: "Week View", icon: "📅" },
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
  ];
</script>

<nav class="bg-white border-b border-gray-200">
  <div class="max-w-7xl mx-auto px-4">
    <div class="flex items-center justify-between h-16">
      <div class="flex items-center space-x-8">
        <a href="/" class="text-xl font-bold text-gray-900 flex items-center gap-2">
          Taskline
          {#if dev}
            <span
              class="px-1.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-300"
              title="Running in local development mode"
            >
              Dev
            </span>
          {/if}
        </a>

        <div class="flex space-x-1">
          {#each navItems as item}
            <a
              href={item.href}
              class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page
                .url.pathname === item.href
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
            >
              <span class="mr-2">{item.icon}</span>
              {item.label}
            </a>
          {/each}
        </div>
      </div>

      <div class="flex items-center space-x-4">
        {#if user}
          <span class="text-sm text-gray-600">{user.email}</span>
          <a
            href="/settings"
            class="text-sm px-2 py-1 rounded transition-colors {$page.url.pathname === '/settings'
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
            title="Settings"
          >Settings</a>
          <form method="POST" action="/auth/logout" class="inline">
            <button
              type="submit"
              class="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Logout
            </button>
          </form>
        {/if}
      </div>
    </div>
  </div>
</nav>
