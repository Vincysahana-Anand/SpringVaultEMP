/**
 * Date utilities for Indian Standard Time (IST - UTC+5:30)
 * 
 * All date/time operations in the app should use these utilities
 * to ensure consistent IST timezone handling across the application.
 * 
 * IST is 5 hours and 30 minutes ahead of UTC.
 */

/**
 * Get current date/time in IST
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
