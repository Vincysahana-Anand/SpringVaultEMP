/**
 * Date utilities for Indian Standard Time (IST - UTC+5:30)
 * 
 * All date/time operations in the app should use these utilities
 * to ensure consistent IST timezone handling across the application.
 * 
 * IST is 5 hours and 30 minutes ahead of UTC.
 */

/**
 * Get current date/time in IST.
 * 
 * ⚠️ WARNING: This returns a Date object where the wall-clock hours/minutes
 * match IST. However, its internal Unix timestamp is offset.
 * Direct storage of this Date object in timezone-aware systems (like Firestore/Firebase)
 * will result in double-offsetting if the client device is not physically in the +05:30 timezone.
 * Assumes the client application runs on a device set to Indian Standard Time (IST).
 */
export const getISTDate = (): Date => {
  const now = new Date();
  // Convert to IST by adding 5 hours and 30 minutes offset
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcTime + istOffset);
};

/**
 * Get IST date with time set to start of day (00:00:00)
 */
export const getISTStartOfDay = (): Date => {
  const istDate = getISTDate();
  istDate.setHours(0, 0, 0, 0);
  return istDate;
};

/**
 * Get IST date with time set to end of day (23:59:59)
 */
export const getISTEndOfDay = (): Date => {
  const istDate = getISTDate();
  istDate.setHours(23, 59, 59, 999);
  return istDate;
};

/**
 * Convert any Date to IST
 */
export const convertToIST = (date: Date): Date => {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utcTime + istOffset);
};

/**
 * Get IST date N days ago from today
 */
export const getISTDaysAgo = (days: number): Date => {
  const istDate = getISTDate();
  istDate.setDate(istDate.getDate() - days);
  return istDate;
};

/**
 * Get first day of month in IST
 */
export const getISTMonthStart = (year: number, month: number): Date => {
  // month is 0-indexed (0 = January, 11 = December)
  const date = new Date(Date.UTC(year, month, 1));
  return convertToIST(date);
};

/**
 * Get last day of month in IST
 */
export const getISTMonthEnd = (year: number, month: number): Date => {
  // month is 0-indexed, so month+1 gives us the 1st of next month
  const date = new Date(Date.UTC(year, month + 1, 1));
  return convertToIST(date);
};

/**
 * Format Date to YYYY-MM-DD string
 */
export const formatDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Format Date to standard human readable delivered timestamp
 */
export const formatDeliveredAt = (d: Date): string => {
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Parse a deliveredAt string like "14/01/26, 02:30 PM" into a Unix timestamp.
 * Returns 0 if the string cannot be parsed.
 */
export const parseDeliveredAt = (deliveredAt: string): number => {
  if (!deliveredAt) return 0;
  const [datePart, timePartRaw] = deliveredAt.split(',');
  if (!datePart || !timePartRaw) return 0;
  const [dd, mm, yy] = datePart.trim().split('/');
  const [timePart, meridiemRaw] = timePartRaw.trim().split(' ');
  const [hourStr, minuteStr] = timePart.split(':');
  const yearFull = Number(yy) + 2000;
  let hours = Number(hourStr) % 12;
  if ((meridiemRaw || '').toLowerCase() === 'pm') {
    hours += 12;
  }
  const minutes = Number(minuteStr);
  const date = new Date(Date.UTC(yearFull, Number(mm) - 1, Number(dd), hours, minutes));
  return date.getTime();
};

/**
 * Format a Date to a human-readable display string, e.g. "14 Jun 2025"
 */
export const formatDisplayDate = (date: Date): string => {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Get a transaction timestamp object with deliveredDate, deliveredAt, and dateKey.
 * Used by transaction services to avoid repeating the same 3-line pattern.
 *
 * Returns:
 * - deliveredDate: The Date object in IST
 * - deliveredAt: Formatted timestamp string (e.g. "14/01/26, 02:30 PM")
 * - dateKey: YYYY-MM-DD string for Firestore document keys
 */
export const getTransactionTimestamp = () => {
  const deliveredDate = getISTDate();
  return {
    deliveredDate,
    deliveredAt: formatDeliveredAt(deliveredDate),
    dateKey: formatDateKey(deliveredDate),
  };
};
