/**
 * Formats a duration in hours into an enterprise-friendly operational representation.
 * - For durations >= 24 hours: displays days first, followed by remaining hours, and total hours in parentheses.
 *   e.g. 107.1 -> "4d 11h (107.1h)"
 *        57.8  -> "2d 10h (57.8h)"
 *        24    -> "1d 0h (24h)"
 * - For durations < 24 hours: displays rounded hours.
 *   e.g. 18.4  -> "18h"
 *        7     -> "7h"
 *        2     -> "2h"
 */
export function formatDuration(hours: number | null | undefined): string {
  if (hours == null || isNaN(hours)) {
    return '-';
  }
  if (hours <= 0) {
    return '0h';
  }

  // Under 24 hours
  if (hours < 23.95) {
    return `${Math.round(hours)}h`;
  }

  let days = Math.floor(hours / 24);
  let remHours = Math.round(hours % 24);

  // If rounding remaining hours pushes it to 24, increment days
  if (remHours === 24) {
    days += 1;
    remHours = 0;
  }

  // Total hours representation: omit trailing .0 if integer
  const formattedTotal = hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;

  return `${days}d ${remHours}h (${formattedTotal})`;
}

