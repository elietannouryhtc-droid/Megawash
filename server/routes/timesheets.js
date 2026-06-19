const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { parseLocalDateToUTC, getMondayOfWeekString } = require('../utils/timezone');

router.use(auth);
router.use(roleCheck(['admin', 'manager']));

/**
 * @route   GET /api/timesheets
 * @desc    Get aggregated worked hours (regular & overtime) for employees in a date range
 * @access  Private (Admin, Manager)
 */
router.get('/', async (req, res) => {
  const { start_date, end_date, employee_id } = req.query;

  // Default to past 14 days if not provided
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const startDateStr = start_date || defaultStart.toISOString().split('T')[0];
  const endDateStr = end_date || now.toISOString().split('T')[0];

  try {
    // 1. Fetch overtime settings
    const settingsResult = await db.query(
      "SELECT key, value FROM settings WHERE key IN ('overtime_weekly_threshold', 'overtime_rate_multiplier')"
    );
    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = parseFloat(row.value);
    });

    const overtimeThreshold = settings['overtime_weekly_threshold'] || 44.0;

    // 2. Parse date filters to UTC bounds matching Toronto days
    const utcStart = parseLocalDateToUTC(startDateStr, false);
    const utcEnd = parseLocalDateToUTC(endDateStr, true);

    // 3. Fetch check-in records
    let checkinQueryText = `
      SELECT r.*, e.first_name, e.last_name, e.hourly_rate, e.role 
      FROM check_in_records r
      JOIN employees e ON r.employee_id = e.id
      WHERE r.status = 'checked_out'
        AND r.check_in >= $1 AND r.check_in <= $2
    `;
    const checkinQueryParams = [utcStart, utcEnd];

    if (employee_id) {
      checkinQueryText += ` AND r.employee_id = $3`;
      checkinQueryParams.push(employee_id);
    }

    const checkinsResult = await db.query(checkinQueryText, checkinQueryParams);

    // 4. Fetch employees list (to display active ones even if they haven't worked)
    let empQueryText = "SELECT id, first_name, last_name, hourly_rate, role, status FROM employees";
    const empQueryParams = [];
    if (employee_id) {
      empQueryText += " WHERE id = $1";
      empQueryParams.push(employee_id);
    } else {
      empQueryText += " WHERE status = 'active'";
    }
    const employeesResult = await db.query(empQueryText, empQueryParams);

    // 5. Initialize timesheet structures
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
        weeks: {} // temporary holder to compute weekly overtime
      };
    });

    // 6. Populate records and group by week for each employee
    checkinsResult.rows.forEach(record => {
      const empId = record.employee_id;
      
      // If the employee is inactive and not in the default active list, add them dynamically
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

      // Determine Monday of the week for this check-in
      const weekMonday = getMondayOfWeekString(record.check_in);
      
      if (!timesheets[empId].weeks[weekMonday]) {
        timesheets[empId].weeks[weekMonday] = 0;
      }
      timesheets[empId].weeks[weekMonday] += hours;
    });

    // 7. Calculate weekly overtime and compile final numbers
    const resultPayload = Object.values(timesheets).map(sheet => {
      let totalHours = 0;
      let regularHours = 0;
      let overtimeHours = 0;

      // Iterate through each week's total accumulated hours
      Object.keys(sheet.weeks).forEach(weekKey => {
        const weekHours = sheet.weeks[weekKey];
        totalHours += weekHours;

        if (weekHours > overtimeThreshold) {
          const ot = weekHours - overtimeThreshold;
          overtimeHours += ot;
          regularHours += overtimeThreshold;
        } else {
          regularHours += weekHours;
        }
      });

      // Format values to 2 decimal places
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

    return res.json(resultPayload);
  } catch (error) {
    console.error('Error generating timesheet:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
