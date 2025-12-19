/**
 * Natural language date parser for task descriptions
 * Extracts dates like "Thursday", "next Monday", "tomorrow", "in 3 days", etc.
 */

import { addDays, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday, format, startOfDay } from 'date-fns';
import { getStartOfDayUTC, getUserTimezone } from './timezone';

export interface ParsedDate {
  date: Date | null;
  matchedText: string | null;
  pattern: string | null;
}

/**
 * Parse natural language dates from text
 * @param text - The text to parse
 * @param timezone - Optional timezone (defaults to user's timezone)
 */
export function parseDate(text: string, timezone?: string): ParsedDate {
  if (!text) {
    return { date: null, matchedText: null, pattern: null };
  }

  const lowerText = text.toLowerCase();
  // Use timezone-aware "today" if timezone is provided
  const tz = timezone || (typeof window !== 'undefined' ? getUserTimezone() : undefined);
  const today = tz ? getStartOfDayUTC(new Date(), tz) : startOfDay(new Date());

  // Pattern 1: "tomorrow"
  const tomorrowMatch = lowerText.match(/\btomorrow\b/);
  if (tomorrowMatch) {
    return {
      date: addDays(today, 1),
      matchedText: tomorrowMatch[0],
      pattern: 'tomorrow'
    };
  }

  // Pattern 2: "today"
  const todayMatch = lowerText.match(/\btoday\b/);
  if (todayMatch) {
    return {
      date: today,
      matchedText: todayMatch[0],
      pattern: 'today'
    };
  }

  // Pattern 3: "in X days" or "in X day"
  const inDaysMatch = lowerText.match(/\bin (\d+) days?\b/);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    return {
      date: addDays(today, days),
      matchedText: inDaysMatch[0],
      pattern: `in ${days} days`
    };
  }

  // Pattern 4: Days of the week (current or next)
  const dayPatterns = [
    { pattern: /\b(this|next)?\s*monday\b/, fn: nextMonday, name: 'Monday' },
    { pattern: /\b(this|next)?\s*tuesday\b/, fn: nextTuesday, name: 'Tuesday' },
    { pattern: /\b(this|next)?\s*wednesday\b/, fn: nextWednesday, name: 'Wednesday' },
    { pattern: /\b(this|next)?\s*thursday\b/, fn: nextThursday, name: 'Thursday' },
    { pattern: /\b(this|next)?\s*friday\b/, fn: nextFriday, name: 'Friday' },
    { pattern: /\b(this|next)?\s*saturday\b/, fn: nextSaturday, name: 'Saturday' },
    { pattern: /\b(this|next)?\s*sunday\b/, fn: nextSunday, name: 'Sunday' }
  ];

  for (const { pattern, fn, name } of dayPatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      const isNext = match[1] === 'next';
      let date = fn(today);
      
      // If it says "next" and the day would be this week, add 7 days
      if (isNext && date <= addDays(today, 7)) {
        date = addDays(date, 7);
      }
      
      return {
        date,
        matchedText: match[0],
        pattern: name
      };
    }
  }

  // Pattern 5: "next week"
  const nextWeekMatch = lowerText.match(/\bnext week\b/);
  if (nextWeekMatch) {
    return {
      date: addDays(today, 7),
      matchedText: nextWeekMatch[0],
      pattern: 'next week'
    };
  }

  // Pattern 6: "this week" or "end of week"
  const endOfWeekMatch = lowerText.match(/\b(this week|end of week|eow)\b/);
  if (endOfWeekMatch) {
    return {
      date: nextFriday(today),
      matchedText: endOfWeekMatch[0],
      pattern: 'end of week'
    };
  }

  // Pattern 7: Month names with day number (e.g., "Dec 25", "December 25th")
  const monthPatterns = [
    { short: 'jan', long: 'january', month: 0 },
    { short: 'feb', long: 'february', month: 1 },
    { short: 'mar', long: 'march', month: 2 },
    { short: 'apr', long: 'april', month: 3 },
    { short: 'may', long: 'may', month: 4 },
    { short: 'jun', long: 'june', month: 5 },
    { short: 'jul', long: 'july', month: 6 },
    { short: 'aug', long: 'august', month: 7 },
    { short: 'sep', long: 'september', month: 8 },
    { short: 'oct', long: 'october', month: 9 },
    { short: 'nov', long: 'november', month: 10 },
    { short: 'dec', long: 'december', month: 11 }
  ];

  for (const { short, long, month } of monthPatterns) {
    const monthMatch = lowerText.match(
      new RegExp(`\\b(${short}|${long})[a-z]*\\s+(\\d{1,2})(st|nd|rd|th)?\\b`)
    );
    if (monthMatch) {
      const day = parseInt(monthMatch[2], 10);
      const year = new Date().getFullYear();
      let date = new Date(year, month, day);
      
      // If the date is in the past, assume next year
      if (date < today) {
        date = new Date(year + 1, month, day);
      }
      
      return {
        date,
        matchedText: monthMatch[0],
        pattern: format(date, 'MMM d')
      };
    }
  }

  // No date found
  return { date: null, matchedText: null, pattern: null };
}

/**
 * Format a parsed date for display
 */
export function formatParsedDate(parsedDate: ParsedDate): string {
  if (!parsedDate.date) return '';
  return format(parsedDate.date, 'MMM d, yyyy');
}

/**
 * Format a parsed date for input field (yyyy-MM-dd)
 */
export function formatParsedDateForInput(parsedDate: ParsedDate): string {
  if (!parsedDate.date) return '';
  return format(parsedDate.date, 'yyyy-MM-dd');
}

