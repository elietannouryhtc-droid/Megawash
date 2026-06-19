const db = require('../db');
const { parseLocalDateToUTC, getMondayOfWeekString } = require('./timezone');

/**
 * Common helper to aggregate employee worked hours and weekly overtime.
 */
async function calculateTimesheets(startDateStr, endDateStr, employeeId = null) {
  // 1. Fetch settings
  const settingsResult = await db.query(
    "SELECT key, value FROM settings WHERE key IN ('overtime_weekly_threshold', 'overtime_rate_multiplier')"
  );
  const settings = {};
  settingsResult.rows.forEach(row => {
    settings[row.key] = parseFloat(row.value);
  });
  const rawThreshold = settings['overtime_weekly_threshold'];
  const overtimeThreshold = (rawThreshold === undefined || isNaN(rawThreshold)) ? 0 : rawThreshold;

  // 2. Parse dates
  const utcStart = parseLocalDateToUTC(startDateStr, false);
  const utcEnd = parseLocalDateToUTC(endDateStr, true);

  // 3. Fetch checkins
  let checkinQueryText = `
    SELECT r.*, e.first_name, e.last_name, e.hourly_rate, e.role 
    FROM check_in_records r
    JOIN employees e ON r.employee_id = e.id
    WHERE r.status = 'checked_out'
      AND r.check_in >= $1 AND r.check_in <= $2
  `;
  const checkinQueryParams = [utcStart, utcEnd];

  if (employeeId) {
    checkinQueryText += ` AND r.employee_id = $3`;
    checkinQueryParams.push(employeeId);
  }
  
  checkinQueryText += ' ORDER BY r.check_in ASC';
  const checkinsResult = await db.query(checkinQueryText, checkinQueryParams);

  // 4. Fetch employees
  let empQueryText = "SELECT id, first_name, last_name, hourly_rate, role, status FROM employees";
  const empQueryParams = [];
  if (employeeId) {
    empQueryText += " WHERE id = $1";
    empQueryParams.push(employeeId);
  } else {
    empQueryText += " WHERE status = 'active'";
  }
  const employeesResult = await db.query(empQueryText, empQueryParams);

  const timesheets = {};
  employeesResult.rows.forEach(emp => {
    timesheets[emp.id] = {
      employee_id: emp.id,
      first_name: emp.first_name,
      last_name: emp.last_name,
      role: emp.role,
      hourly_rate: parseFloat(emp.hourly_rate),
      total_hours: 0,
      regular_hours: 0,
      overtime_hours: 0,
      records: [],
      weeks: {}
    };
  });

  checkinsResult.rows.forEach(record => {
    const empId = record.employee_id;
    if (!timesheets[empId]) {
      timesheets[empId] = {
        employee_id: empId,
        first_name: record.first_name,
        last_name: record.last_name,
        role: record.role,
        hourly_rate: parseFloat(record.hourly_rate),
        total_hours: 0,
        regular_hours: 0,
        overtime_hours: 0,
        records: [],
        weeks: {}
      };
    }
    const hours = parseFloat(record.hours_worked || 0);
    timesheets[empId].records.push(record);

    const weekMonday = getMondayOfWeekString(record.check_in);
    if (!timesheets[empId].weeks[weekMonday]) {
      timesheets[empId].weeks[weekMonday] = 0;
    }
    timesheets[empId].weeks[weekMonday] += hours;
  });

  return Object.values(timesheets).map(sheet => {
    let totalHours = 0;
    let regularHours = 0;
    let overtimeHours = 0;

    Object.keys(sheet.weeks).forEach(weekKey => {
      const weekHours = sheet.weeks[weekKey];
      totalHours += weekHours;

      if (overtimeThreshold > 0 && weekHours > overtimeThreshold) {
        const ot = weekHours - overtimeThreshold;
        overtimeHours += ot;
        regularHours += overtimeThreshold;
      } else {
        regularHours += weekHours;
      }
    });

    return {
      employee_id: sheet.employee_id,
      first_name: sheet.first_name,
      last_name: sheet.last_name,
      role: sheet.role,
      hourly_rate: sheet.hourly_rate,
      total_hours: parseFloat(totalHours.toFixed(2)),
      regular_hours: parseFloat(regularHours.toFixed(2)),
      overtime_hours: parseFloat(overtimeHours.toFixed(2)),
      records: sheet.records
    };
  });
}

module.exports = { calculateTimesheets };
