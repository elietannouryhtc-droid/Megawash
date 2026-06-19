/**
 * Utility functions for America/Toronto timezone operations.
 */

/**
 * Format a Date object or ISO string to a human-readable datetime string in America/Toronto timezone.
 * @param {Date|string} date 
 * @returns {string} e.g. "2026-06-19, 10:45:00 AM"
 */
function formatDateTimeToronto(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

/**
 * Format a Date object or ISO string to a date string in America/Toronto timezone (YYYY-MM-DD).
 * @param {Date|string} date 
 * @returns {string} e.g. "2026-06-19"
 */
function formatDateToronto(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  return formatter.format(d);
}

/**
 * Parse a local date string (YYYY-MM-DD) from America/Toronto to a UTC Date object.
 * @param {string} dateStr - e.g. "2026-06-19"
 * @param {boolean} endOfDay - true if we want 23:59:59.999
 * @returns {Date}
 */
function parseLocalDateToUTC(dateStr, endOfDay = false) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  
  const tempDate = new Date(Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0));
  
  const tzString = tempDate.toLocaleString('en-US', { timeZone: 'America/Toronto', timeZoneName: 'longOffset' });
  const match = tzString.match(/[GMT|UTC]([+-]\d+):?(\d+)?/);
  const offsetHours = match ? parseInt(match[1]) : -4;
  
  tempDate.setUTCHours(tempDate.getUTCHours() - offsetHours);
  return tempDate;
}

/**
 * Find the Monday date string (YYYY-MM-DD) of the week for a given date in America/Toronto timezone.
 * @param {Date|string} date 
 * @returns {string}
 */
function getMondayOfWeekString(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const torontoDateStr = formatDateToronto(d);
  const [year, month, day] = torontoDateStr.split('-').map(Number);
  
  const localDate = new Date(year, month - 1, day);
  const dayOfWeek = localDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Sunday is the last day of our Monday-Sunday week, so subtract 6 days.
  // Otherwise subtract (dayOfWeek - 1) days.
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const monday = new Date(localDate);
  monday.setDate(localDate.getDate() - daysToSubtract);
  
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const r = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${r}`;
}

module.exports = {
  formatDateTimeToronto,
  formatDateToronto,
  parseLocalDateToUTC,
  getMondayOfWeekString
};
