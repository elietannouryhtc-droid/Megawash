const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { parseLocalDateToUTC, getMondayOfWeekString } = require('../utils/timezone');

router.use(auth);
router.use(roleCheck(['admin', 'manager']));

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard summary statistics
 * @access  Private (Admin, Manager)
 */
router.get('/stats', async (req, res) => {
  try {
    // 1. Active employees count
    const activeEmpRes = await db.query(
      "SELECT COUNT(*) FROM employees WHERE status = 'active'"
    );
    const activeCount = parseInt(activeEmpRes.rows[0].count);

    // 2. Currently checked-in employees count
    const checkedInRes = await db.query(
      "SELECT COUNT(*) FROM check_in_records WHERE status = 'checked_in'"
    );
    const checkedInCount = parseInt(checkedInRes.rows[0].count);

    // 3. Incomplete check-out records count
    // Incomplete means checked_in but the check_in day is in the past (Toronto time)
    const incompleteRes = await db.query(
      `SELECT COUNT(*) FROM check_in_records 
       WHERE status = 'checked_in' 
       AND (check_in AT TIME ZONE 'America/Toronto')::date < (NOW() AT TIME ZONE 'America/Toronto')::date`
    );
    const incompleteCount = parseInt(incompleteRes.rows[0].count);

    // 4. Pending salary advances count
    const pendingAdvancesRes = await db.query(
      "SELECT COUNT(*) FROM salary_advances WHERE status = 'pending'"
    );
    const pendingAdvancesCount = parseInt(pendingAdvancesRes.rows[0].count);

    // 5. Total hours and estimated payroll for the current week (Monday to Sunday)
    // Find the Monday of the current week in Toronto time
    const nowToronto = new Date();
    const day = nowToronto.getDay();
    const diff = nowToronto.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(nowToronto.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    // Get all completed check-in records since Monday of this week
    const weeklyShiftsRes = await db.query(
      `SELECT r.hours_worked, e.hourly_rate 
       FROM check_in_records r
       JOIN employees e ON r.employee_id = e.id
       WHERE r.status = 'checked_out' 
       AND r.check_in >= $1`,
      [monday]
    );

    let weeklyHours = 0;
    let estimatedPayroll = 0;

    weeklyShiftsRes.rows.forEach(row => {
      const hours = parseFloat(row.hours_worked || 0);
      const rate = parseFloat(row.hourly_rate || 0);
      weeklyHours += hours;
      estimatedPayroll += hours * rate;
    });

    // 6. Get currently checked-in employees list
    const checkedInListRes = await db.query(
      `SELECT r.id, r.check_in, e.id as employee_id, e.first_name, e.last_name, e.role 
       FROM check_in_records r
       JOIN employees e ON r.employee_id = e.id
       WHERE r.status = 'checked_in'
       ORDER BY r.check_in ASC`
    );

    return res.json({
      activeCount,
      checkedInCount,
      incompleteCount,
      pendingAdvancesCount,
      weeklyHours: parseFloat(weeklyHours.toFixed(2)),
      estimatedPayroll: parseFloat(estimatedPayroll.toFixed(2)),
      checkedInEmployees: checkedInListRes.rows.map(row => ({
        id: row.id,
        employee_id: row.employee_id,
        first_name: row.first_name,
        last_name: row.last_name,
        role: row.role,
        check_in: row.check_in
      }))
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
