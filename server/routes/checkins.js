const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const logAction = require('../utils/auditLogger');

/**
 * @route   POST /api/checkins/pin-toggle
 * @desc    Check-in or Check-out an employee using their PIN (Kiosk Endpoint)
 * @access  Public (Requires valid Employee PIN)
 */
router.post('/pin-toggle', async (req, res) => {
  const { pin, notes } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'PIN is required.' });
  }

  try {
    // Find employee
    const empResult = await db.query(
      'SELECT id, first_name, last_name, role, status FROM employees WHERE pin = $1',
      [pin]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid PIN.' });
    }

    const employee = empResult.rows[0];

    if (employee.status !== 'active') {
      return res.status(403).json({ error: 'Employee account is inactive.' });
    }

    // Check for an active (checked_in) record
    const activeCheckinResult = await db.query(
      `SELECT * FROM check_in_records 
       WHERE employee_id = $1 AND status = 'checked_in' 
       ORDER BY check_in DESC LIMIT 1`,
      [employee.id]
    );

    const activeRecord = activeCheckinResult.rows[0];

    if (activeRecord) {
      // PERFORM CHECK-OUT
      const checkOutTime = new Date();
      const checkInTime = new Date(activeRecord.check_in);
      
      const diffMs = checkOutTime - checkInTime;
      const hoursWorked = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));

      const updateResult = await db.query(
        `UPDATE check_in_records 
         SET check_out = $1, hours_worked = $2, status = 'checked_out', notes = COALESCE($3, notes) 
         WHERE id = $4 
         RETURNING *`,
        [checkOutTime, hoursWorked, notes || null, activeRecord.id]
      );

      const completedRecord = updateResult.rows[0];

      // Audit Log (Since PIN-toggle has no session user, log as PIN-Pad)
      await logAction(
        null,
        'PIN-Pad',
        'CHECK_OUT',
        `employee_id: ${employee.id}, record_id: ${completedRecord.id}`,
        { employee_name: `${employee.first_name} ${employee.last_name}`, hours_worked: hoursWorked }
      );

      return res.json({
        message: `${employee.first_name} checked out successfully.`,
        status: 'checked_out',
        employee: {
          id: employee.id,
          first_name: employee.first_name,
          last_name: employee.last_name,
          role: employee.role
        },
        record: completedRecord
      });

    } else {
      // PERFORM CHECK-IN
      const checkInTime = new Date();
      
      const insertResult = await db.query(
        `INSERT INTO check_in_records (employee_id, check_in, status, notes) 
         VALUES ($1, $2, 'checked_in', $3) 
         RETURNING *`,
        [employee.id, checkInTime, notes || null]
      );

      const newRecord = insertResult.rows[0];

      // Audit Log
      await logAction(
        null,
        'PIN-Pad',
        'CHECK_IN',
        `employee_id: ${employee.id}, record_id: ${newRecord.id}`,
        { employee_name: `${employee.first_name} ${employee.last_name}` }
      );

      return res.json({
        message: `${employee.first_name} checked in successfully.`,
        status: 'checked_in',
        employee: {
          id: employee.id,
          first_name: employee.first_name,
          last_name: employee.last_name,
          role: employee.role
        },
        record: newRecord
      });
    }

  } catch (error) {
    console.error('Error during pin-toggle:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   GET /api/checkins/recent-actions
 * @desc    Get the 10 most recent check-in/out actions (public/employee access)
 * @access  Private (All authenticated users)
 */
router.get('/recent-actions', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.id, r.check_in, r.check_out, r.status, e.first_name, e.last_name 
       FROM check_in_records r
       JOIN employees e ON r.employee_id = e.id
       ORDER BY r.created_at DESC LIMIT 10`
    );

    const logs = [];
    result.rows.forEach(row => {
      if (row.status === 'checked_out' && row.check_out) {
        logs.push({
          id: row.id + '-out',
          employeeName: `${row.first_name} ${row.last_name}`,
          time: new Date(row.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'OUT',
          timestamp: row.check_out
        });
      }
      
      logs.push({
        id: row.id + '-in',
        employeeName: `${row.first_name} ${row.last_name}`,
        time: new Date(row.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'IN',
        timestamp: row.check_in
      });
    });

    // Sort logs by timestamp DESC and limit to 10
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return res.json(logs.slice(0, 10));
  } catch (error) {
    console.error('Error fetching recent check-in actions:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ==========================================
// ADMIN/MANAGER ENDPOINTS
// All endpoints below require authentication
// ==========================================
router.use(auth);
router.use(roleCheck(['admin', 'manager']));

/**
 * @route   GET /api/checkins
 * @desc    Get all check-in records (with date range, employee, and status filters)
 * @access  Private (Admin, Manager)
 */
router.get('/', async (req, res) => {
  const { employee_id, start_date, end_date, status } = req.query;

  try {
    let queryText = `
      SELECT r.*, e.first_name, e.last_name, e.role 
      FROM check_in_records r
      JOIN employees e ON r.employee_id = e.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    if (employee_id) {
      queryText += ` AND r.employee_id = $${paramIndex++}`;
      queryParams.push(employee_id);
    }

    if (status) {
      queryText += ` AND r.status = $${paramIndex++}`;
      queryParams.push(status);
    }

    if (start_date) {
      queryText += ` AND r.check_in >= $${paramIndex++}`;
      queryParams.push(new Date(start_date));
    }

    if (end_date) {
      queryText += ` AND r.check_in <= $${paramIndex++}`;
      queryParams.push(new Date(end_date));
    }

    queryText += ' ORDER BY r.check_in DESC';

    const result = await db.query(queryText, queryParams);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching check-in records:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   POST /api/checkins
 * @desc    Manually create a check-in/out record
 * @access  Private (Admin, Manager)
 */
router.post('/', async (req, res) => {
  const { employee_id, check_in, check_out, notes } = req.body;

  if (!employee_id || !check_in) {
    return res.status(400).json({ error: 'Employee ID and check-in time are required.' });
  }

  const checkInDate = new Date(check_in);
  let checkOutDate = null;
  let hoursWorked = null;
  let status = 'checked_in';

  if (check_out) {
    checkOutDate = new Date(check_out);
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ error: 'Check-out time must be after check-in time.' });
    }
    const diffMs = checkOutDate - checkInDate;
    hoursWorked = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));
    status = 'checked_out';
  }

  try {
    // Check if employee exists
    const empResult = await db.query('SELECT id FROM employees WHERE id = $1', [employee_id]);
    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const insertResult = await db.query(
      `INSERT INTO check_in_records (employee_id, check_in, check_out, hours_worked, status, notes) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [employee_id, checkInDate, checkOutDate, hoursWorked, status, notes || null]
    );

    const record = insertResult.rows[0];

    await logAction(
      req.user.id,
      req.user.username,
      'MANUAL_CHECKIN_CREATE',
      `record_id: ${record.id}`,
      { record }
    );

    return res.status(201).json({
      message: 'Check-in record created successfully.',
      record
    });
  } catch (error) {
    console.error('Error creating check-in record manually:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   PUT /api/checkins/:id
 * @desc    Manually update a check-in/out record
 * @access  Private (Admin, Manager)
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { check_in, check_out, status, notes } = req.body;

  if (!check_in) {
    return res.status(400).json({ error: 'Check-in time is required.' });
  }

  try {
    // Find existing record
    const recordCheck = await db.query('SELECT * FROM check_in_records WHERE id = $1', [id]);
    if (recordCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    const oldRecord = recordCheck.rows[0];
    const checkInDate = new Date(check_in);
    let checkOutDate = null;
    let hoursWorked = null;
    let updatedStatus = status || 'checked_in';

    if (check_out) {
      checkOutDate = new Date(check_out);
      if (checkOutDate <= checkInDate) {
        return res.status(400).json({ error: 'Check-out time must be after check-in time.' });
      }
      const diffMs = checkOutDate - checkInDate;
      hoursWorked = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));
      updatedStatus = 'checked_out';
    } else {
      updatedStatus = 'checked_in';
    }

    const updateResult = await db.query(
      `UPDATE check_in_records 
       SET check_in = $1, check_out = $2, hours_worked = $3, status = $4, notes = $5 
       WHERE id = $6 
       RETURNING *`,
      [checkInDate, checkOutDate, hoursWorked, updatedStatus, notes || null, id]
    );

    const updatedRecord = updateResult.rows[0];

    await logAction(
      req.user.id,
      req.user.username,
      'MANUAL_CHECKIN_UPDATE',
      `record_id: ${id}`,
      { old: oldRecord, new: updatedRecord }
    );

    return res.json({
      message: 'Check-in record updated successfully.',
      record: updatedRecord
    });
  } catch (error) {
    console.error('Error updating check-in record:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   DELETE /api/checkins/:id
 * @desc    Delete a check-in record
 * @access  Private (Admin)
 */
router.delete('/:id', roleCheck(['admin']), async (req, res) => {
  const { id } = req.params;

  try {
    const recordCheck = await db.query('SELECT * FROM check_in_records WHERE id = $1', [id]);
    if (recordCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    await db.query('DELETE FROM check_in_records WHERE id = $1', [id]);

    await logAction(
      req.user.id,
      req.user.username,
      'MANUAL_CHECKIN_DELETE',
      `record_id: ${id}`,
      { record: recordCheck.rows[0] }
    );

    return res.json({ message: 'Check-in record deleted successfully.' });
  } catch (error) {
    console.error('Error deleting check-in record:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
