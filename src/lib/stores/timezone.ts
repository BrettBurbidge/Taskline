import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function createTimezoneStore() {
  // Detect timezone on client-side
  const detected = browser 
    ? Intl.DateTimeFormat().resolvedOptions().timeZone 
    : 'UTC';
  
  // Try to load from localStorage
  const stored = browser ? localStorage.getItem('user_timezone') : null;
  const initial = stored || detected;
  
  const { subscribe, set } = writable(initial);
  
  // Save to localStorage when changed
  return {
    subscribe,
    set: (value: string) => {
      if (browser) {
        localStorage.setItem('user_timezone', value);
      }
      set(value);
    },
    reset: () => {
      if (browser) {
        localStorage.removeItem('user_timezone');
        set(detected);
      }
    }
  };
}

export const userTimezone = createTimezoneStore();

