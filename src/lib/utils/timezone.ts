/**
 * Timezone utilities for consistent date handling across the app
 * 
 * Strategy:
 * - All dates stored in DB as UTC
 * - User's timezone detected and stored in localStorage
 * - Convert from user local -> UTC when saving
 * - Convert from UTC -> user local when displaying
 */

import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Get the user's timezone (browser timezone)
 * On server-side, returns 'America/Denver' as default (can be overridden)
 */
export function getUserTimezone(): string {
  if (typeof window === 'undefined') {
    // Server-side: use environment variable or default
    return process.env.DEFAULT_TIMEZONE || 'America/Denver';
  }
  
  // Try to get from localStorage first (user preference)
  const stored = localStorage.getItem('user_timezone');
  if (stored) {
    return stored;
  }
  
  // Otherwise, detect from browser
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  localStorage.setItem('user_timezone', detected);
  return detected;
}

/**
 * Set the user's timezone preference
 */
export function setUserTimezone(timezone: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user_timezone', timezone);
  }
}

/**
 * Convert a date string (YYYY-MM-DD) from user's timezone to UTC for storage
 * The date represents the start of day in user's timezone
 */
export function dateStringToUTC(dateString: string, timezone?: string): Date {
  if (!dateString) {
    throw new Error('Date string is required');
  }
  
  const tz = timezone || getUserTimezone();
  
  // Parse as start of day in user's timezone
  const [year, month, day] = dateString.split('-').map(Number);
  const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  
  // Convert to UTC
  return fromZonedTime(localDate, tz);
}

/**
 * Convert a UTC Date to a date string (YYYY-MM-DD) in user's timezone
 */
export function utcToDateString(utcDate: Date | string | null, timezone?: string): string {
  if (!utcDate) return '';
  
  const tz = timezone || getUserTimezone();
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  
  // Convert to user's timezone
  const zonedDate = toZonedTime(date, tz);
  
  // Format as YYYY-MM-DD
  const year = zonedDate.getFullYear();
  const month = String(zonedDate.getMonth() + 1).padStart(2, '0');
  const day = String(zonedDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Format a UTC date for display in user's timezone
 */
export function formatDateInUserTZ(
  utcDate: Date | string | null,
  formatString: string = 'MMM d, yyyy',
  timezone?: string
): string {
  if (!utcDate) return '';
  
  const tz = timezone || getUserTimezone();
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  
  return formatInTimeZone(date, tz, formatString);
}

/**
 * Format a datetime for display in user's timezone
 */
export function formatDateTimeInUserTZ(
  utcDate: Date | string | null,
  formatString: string = 'MMM d, yyyy h:mm a',
  timezone?: string
): string {
  if (!utcDate) return '';
  
  const tz = timezone || getUserTimezone();
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  
  return formatInTimeZone(date, tz, formatString);
}

/**
 * Get start of day in user's timezone, as UTC Date
 */
export function getStartOfDayUTC(date: Date = new Date(), timezone?: string): Date {
  const tz = timezone || getUserTimezone();
  const zonedDate = toZonedTime(date, tz);
  const startOfDayLocal = startOfDay(zonedDate);
  return fromZonedTime(startOfDayLocal, tz);
}

/**
 * Get end of day in user's timezone, as UTC Date
 */
export function getEndOfDayUTC(date: Date = new Date(), timezone?: string): Date {
  const tz = timezone || getUserTimezone();
  const zonedDate = toZonedTime(date, tz);
  const endOfDayLocal = endOfDay(zonedDate);
  return fromZonedTime(endOfDayLocal, tz);
}

/**
 * Get today's date in user's timezone as YYYY-MM-DD string
 */
export function getTodayString(timezone?: string): string {
  const tz = timezone || getUserTimezone();
  return formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
}

/**
 * Check if a UTC date is today in user's timezone
 */
export function isToday(utcDate: Date | string, timezone?: string): boolean {
  const todayString = getTodayString(timezone);
  const dateString = utcToDateString(utcDate, timezone);
  return todayString === dateString;
}

/**
 * Parse a datetime input (datetime-local) to UTC
 */
export function datetimeLocalToUTC(datetimeString: string, timezone?: string): Date {
  if (!datetimeString) {
    throw new Error('Datetime string is required');
  }
  
  const tz = timezone || getUserTimezone();
  
  // datetime-local format: "2025-12-15T14:30"
  const localDate = new Date(datetimeString);
  
  // Convert to UTC
  return fromZonedTime(localDate, tz);
}

/**
 * Convert a UTC Date to datetime-local format (YYYY-MM-DDTHH:mm)
 */
export function utcToDatetimeLocal(utcDate: Date | string | null, timezone?: string): string {
  if (!utcDate) return '';
  
  const tz = timezone || getUserTimezone();
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  
  return formatInTimeZone(date, tz, "yyyy-MM-dd'T'HH:mm");
}

