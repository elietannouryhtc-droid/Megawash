const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const logAction = require('../utils/auditLogger');
const { parseLocalDateToUTC, getMondayOfWeekString } = require('../utils/timezone');

router.use(auth);
router.use(roleCheck(['admin', 'manager']));

/**
 * @route   GET /api/payroll
 * @desc    Get all payroll records (with filters)
 * @access  Private (Admin, Manager)
 */
router.get('/', async (req, res) => {
  const { employee_id, start_date, end_date, status } = req.query;

  try {
    let queryText = `
      SELECT p.*, e.first_name, e.last_name, e.role 
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    if (employee_id) {
      queryText += ` AND p.employee_id = $${paramIndex++}`;
      queryParams.push(employee_id);
    }

    if (status) {
      queryText += ` AND p.payment_status = $${paramIndex++}`;
      queryParams.push(status);
    }

    if (start_date) {
      queryText += ` AND p.pay_period_start >= $${paramIndex++}`;
      queryParams.push(start_date);
    }

    if (end_date) {
      queryText += ` AND p.pay_period_end <= $${paramIndex++}`;
      queryParams.push(end_date);
    }

    queryText += ' ORDER BY p.pay_period_end DESC, p.created_at DESC';

    const result = await db.query(queryText, queryParams);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payroll:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   POST /api/payroll/generate
 * @desc    Generate payroll for a date range
 * @access  Private (Admin, Manager)
 */
router.post('/generate', async (req, res) => {
  const { pay_period_start, pay_period_end, employee_id } = req.body;

  if (!pay_period_start || !pay_period_end) {
    return res.status(400).json({ error: 'Pay period start and end dates are required.' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch system settings
    const settingsResult = await client.query(
      "SELECT key, value FROM settings WHERE key IN ('overtime_weekly_threshold', 'overtime_rate_multiplier')"
    );
    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = parseFloat(row.value);
    });
    const overtimeThreshold = settings['overtime_weekly_threshold'] || 44.0;
    const overtimeMultiplier = settings['overtime_rate_multiplier'] || 1.5;

    // 2. Fetch employees to process
    let empQuery = "SELECT id, first_name, last_name, hourly_rate, status FROM employees";
    const empParams = [];
    if (employee_id) {
      empQuery += " WHERE id = $1";
      empParams.push(employee_id);
    } else {
      empQuery += " WHERE status = 'active'";
    }
    const employeesRes = await client.query(empQuery, empParams);
    const employees = employeesRes.rows;

    const generatedPayrolls = [];

    // Parse bounds for Toronto day starts and ends
    const utcStart = parseLocalDateToUTC(pay_period_start, false);
    const utcEnd = parseLocalDateToUTC(pay_period_end, true);

    for (const employee of employees) {
      // A. Check if unpaid/paid payroll already exists for this employee in this exact range
      const overlapCheck = await client.query(
        `SELECT id, payment_status FROM payroll 
         WHERE employee_id = $1 
           AND pay_period_start = $2 
           AND pay_period_end = $3`,
        [employee.id, pay_period_start, pay_period_end]
      );

      if (overlapCheck.rows.length > 0) {
        // If it's already paid, skip or throw error
        if (overlapCheck.rows[0].payment_status === 'paid') {
          continue; // skip paid payrolls
        }
        // If it's unpaid, we delete the old one first to recalculate (overwrite)
        const oldId = overlapCheck.rows[0].id;
        
        // Reset manual adjustments linked to it
        await client.query(
          "UPDATE manual_adjustments SET payroll_id = NULL WHERE payroll_id = $1",
          [oldId]
        );
        // Reset advances linked to it (mark back to approved)
        await client.query(
          `UPDATE salary_advances 
           SET status = 'approved' 
           WHERE employee_id = $1 
             AND status = 'deducted' 
             AND advance_date <= $2`,
          [employee.id, pay_period_end]
        );
        // Delete old unpaid payroll record
        await client.query("DELETE FROM payroll WHERE id = $1", [oldId]);
      }

      // B. Fetch checked-out timesheet records in the range
      const checkinRes = await client.query(
        `SELECT * FROM check_in_records 
         WHERE employee_id = $1 
           AND status = 'checked_out'
           AND check_in >= $2 AND check_in <= $3`,
        [employee.id, utcStart, utcEnd]
      );

      // Group records by week (Monday) to calculate weekly overtime
      const weeklyHours = {};
      checkinRes.rows.forEach(record => {
        const weekMonday = getMondayOfWeekString(record.check_in);
        if (!weeklyHours[weekMonday]) {
          weeklyHours[weekMonday] = 0;
        }
        weeklyHours[weekMonday] += parseFloat(record.hours_worked || 0);
      });

      let totalRegularHours = 0;
      let totalOvertimeHours = 0;

      Object.keys(weeklyHours).forEach(weekKey => {
        const hrs = weeklyHours[weekKey];
        if (hrs > overtimeThreshold) {
          totalOvertimeHours += (hrs - overtimeThreshold);
          totalRegularHours += overtimeThreshold;
        } else {
          totalRegularHours += hrs;
        }
      });

      // Round hours
      totalRegularHours = parseFloat(totalRegularHours.toFixed(2));
      totalOvertimeHours = parseFloat(totalOvertimeHours.toFixed(2));

      // C. Get approved advances up to the end of this pay period
      const advancesRes = await client.query(
        `SELECT * FROM salary_advances 
         WHERE employee_id = $1 AND status = 'approved' AND advance_date <= $2`,
        [employee.id, pay_period_end]
      );
      const approvedAdvances = advancesRes.rows;
      const totalAdvancesToDeduct = approvedAdvances.reduce((sum, adv) => sum + parseFloat(adv.amount), 0);

      // D. Get unprocessed manual adjustments up to the end of the pay period
      const adjustmentsRes = await client.query(
        `SELECT * FROM manual_adjustments 
         WHERE employee_id = $1 AND payroll_id IS NULL AND adjustment_date <= $2`,
        [employee.id, pay_period_end]
      );
      const unprocessedAdjustments = adjustmentsRes.rows;
      const totalAdjustmentsVal = unprocessedAdjustments.reduce((sum, adj) => sum + parseFloat(adj.amount), 0);

      // E. Skip employee if no hours worked, no advances, and no adjustments
      if (totalRegularHours === 0 && totalOvertimeHours === 0 && totalAdvancesToDeduct === 0 && totalAdjustmentsVal === 0) {
        continue;
      }

      // F. Run calculations
      const hourlyRate = parseFloat(employee.hourly_rate);
      const regularPay = totalRegularHours * hourlyRate;
      const overtimePay = totalOvertimeHours * hourlyRate * overtimeMultiplier;
      const grossPay = parseFloat((regularPay + overtimePay).toFixed(2));
      const adjustments = parseFloat(totalAdjustmentsVal.toFixed(2));

      // Deductions can't exceed (grossPay + positive adjustments)
      const availableFunds = Math.max(0, grossPay + adjustments);
      const advancesDeducted = parseFloat(Math.min(totalAdvancesToDeduct, availableFunds).toFixed(2));

      const netPay = parseFloat(Math.max(0, grossPay + adjustments - advancesDeducted).toFixed(2));

      // G. Insert payroll record
      const payrollInsertRes = await client.query(
        `INSERT INTO payroll (
           employee_id, pay_period_start, pay_period_end, regular_hours, overtime_hours, 
           hourly_rate, gross_pay, advances_deducted, adjustments, net_pay, payment_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'unpaid') 
         RETURNING *`,
        [
          employee.id, pay_period_start, pay_period_end, totalRegularHours, totalOvertimeHours,
          hourlyRate, grossPay, advancesDeducted, adjustments, netPay
        ]
      );
      const newPayroll = payrollInsertRes.rows[0];

      // H. Associate manual adjustments
      if (unprocessedAdjustments.length > 0) {
        const adjIds = unprocessedAdjustments.map(a => a.id);
        await client.query(
          "UPDATE manual_adjustments SET payroll_id = $1 WHERE id = ANY($2)",
          [newPayroll.id, adjIds]
        );
      }

      // I. Mark advances as deducted (only up to the deducted amount)
      // If we did a partial deduction (funds limited), we deduct advances one by one until deducted value is reached
      let remainingDeduction = advancesDeducted;
      for (const adv of approvedAdvances) {
        if (remainingDeduction <= 0) break;

        const advAmount = parseFloat(adv.amount);
        if (advAmount <= remainingDeduction) {
          // Full deduction of this advance
          await client.query(
            "UPDATE salary_advances SET status = 'deducted' WHERE id = $1",
            [adv.id]
          );
          remainingDeduction -= advAmount;
        } else {
          // Partial deduction: We split the advance!
          // This is a rare edge case, but we handle it by creating a new pending advance for the remaining part,
          // and updating the current advance to the deducted portion.
          const partialDeductedAmt = remainingDeduction;
          const splitAmt = advAmount - partialDeductedAmt;

          // Update current to the deducted portion
          await client.query(
            "UPDATE salary_advances SET amount = $1, status = 'deducted', notes = COALESCE(notes, '') || ' (Partially deducted)' WHERE id = $2",
            [partialDeductedAmt, adv.id]
          );

          // Create a new approved advance for the remaining portion
          await client.query(
            `INSERT INTO salary_advances (employee_id, amount, advance_date, status, notes) 
             VALUES ($1, $2, $3, 'approved', $4)`,
            [employee.id, splitAmt, adv.advance_date, `Remainder of advance #${adv.id} after partial payroll deduction.`]
          );

          remainingDeduction = 0;
        }
      }

      generatedPayrolls.push({
        ...newPayroll,
        first_name: employee.first_name,
        last_name: employee.last_name
      });
    }

    await client.query('COMMIT');

    await logAction(
      req.user.id,
      req.user.username,
      'GENERATE_PAYROLL',
      `period: ${pay_period_start} to ${pay_period_end}`,
      { count: generatedPayrolls.length, details: generatedPayrolls }
    );

    return res.status(201).json({
      message: `Generated ${generatedPayrolls.length} payroll records successfully.`,
      payrolls: generatedPayrolls
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error generating payroll:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

/**
 * @route   PUT /api/payroll/:id/pay
 * @desc    Mark a payroll record as paid
 * @access  Private (Admin, Manager)
 */
router.put('/:id/pay', async (req, res) => {
  const { id } = req.params;

  try {
    const payrollCheck = await db.query('SELECT * FROM payroll WHERE id = $1', [id]);
    if (payrollCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Payroll record not found.' });
    }

    if (payrollCheck.rows[0].payment_status === 'paid') {
      return res.status(400).json({ error: 'Payroll is already marked as paid.' });
    }

    const updateResult = await db.query(
      `UPDATE payroll 
       SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    const paidPayroll = updateResult.rows[0];

    await logAction(
      req.user.id,
      req.user.username,
      'MARK_PAYROLL_PAID',
      `payroll_id: ${id}`,
      { payroll: paidPayroll }
    );

    return res.json({
      message: 'Payroll record marked as paid successfully.',
      payroll: paidPayroll
    });
  } catch (error) {
    console.error('Error paying payroll:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   DELETE /api/payroll/:id
 * @desc    Delete unpaid payroll record (reverts salary advances and manual adjustments)
 * @access  Private (Admin)
 */
router.delete('/:id', roleCheck(['admin']), async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const payrollCheck = await client.query('SELECT * FROM payroll WHERE id = $1', [id]);
    if (payrollCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payroll record not found.' });
    }

    const payroll = payrollCheck.rows[0];

    if (payroll.payment_status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot delete a paid payroll record.' });
    }

    // 1. Revert manual adjustments
    await client.query(
      "UPDATE manual_adjustments SET payroll_id = NULL WHERE payroll_id = $1",
      [id]
    );

    // 2. Revert salary advances (since we don't track original advances easily if split,
    // we simply change matching deducted advances for the period back to approved.
    // In our generate script we marked advances up to pay_period_end as deducted,
    // so we set them back to 'approved')
    await client.query(
      `UPDATE salary_advances 
       SET status = 'approved' 
       WHERE employee_id = $1 
         AND status = 'deducted' 
         AND advance_date <= $2`,
      [payroll.employee_id, payroll.pay_period_end]
    );

    // 3. Delete payroll
    await client.query('DELETE FROM payroll WHERE id = $1', [id]);

    await client.query('COMMIT');

    await logAction(
      req.user.id,
      req.user.username,
      'DELETE_PAYROLL',
      `payroll_id: ${id}`,
      { payroll }
    );

    return res.json({ message: 'Payroll record deleted and associated items reverted successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting payroll:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

module.exports = router;
