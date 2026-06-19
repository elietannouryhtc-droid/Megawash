const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const logAction = require('../utils/auditLogger');

router.use(auth);
router.use(roleCheck(['admin', 'manager']));

/**
 * @route   GET /api/advances
 * @desc    Get all salary advances (with status and employee filter)
 * @access  Private (Admin, Manager)
 */
router.get('/', async (req, res) => {
  const { employee_id, status, start_date, end_date } = req.query;

  try {
    let queryText = `
      SELECT sa.*, e.first_name, e.last_name, e.role 
      FROM salary_advances sa
      JOIN employees e ON sa.employee_id = e.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    if (employee_id) {
      queryText += ` AND sa.employee_id = $${paramIndex++}`;
      queryParams.push(employee_id);
    }

    if (status) {
      queryText += ` AND sa.status = $${paramIndex++}`;
      queryParams.push(status);
    }

    if (start_date) {
      queryText += ` AND sa.advance_date >= $${paramIndex++}`;
      queryParams.push(start_date);
    }

    if (end_date) {
      queryText += ` AND sa.advance_date <= $${paramIndex++}`;
      queryParams.push(end_date);
    }

    queryText += ' ORDER BY sa.advance_date DESC, sa.created_at DESC';

    const result = await db.query(queryText, queryParams);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching salary advances:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   POST /api/advances
 * @desc    Create a salary advance request/entry
 * @access  Private (Admin, Manager)
 */
router.post('/', async (req, res) => {
  const { employee_id, amount, advance_date, status, notes } = req.body;

  if (!employee_id || !amount) {
    return res.status(400).json({ error: 'Employee ID and amount are required.' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Advance amount must be a positive number.' });
  }

  try {
    // Verify employee exists
    const empCheck = await db.query('SELECT id, status FROM employees WHERE id = $1', [employee_id]);
    if (empCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    if (empCheck.rows[0].status !== 'active') {
      return res.status(400).json({ error: 'Cannot issue salary advance to an inactive employee.' });
    }

    const insertResult = await db.query(
      `INSERT INTO salary_advances (employee_id, amount, advance_date, status, notes) 
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5) 
       RETURNING *`,
      [employee_id, parsedAmount, advance_date || null, status || 'pending', notes || null]
    );

    const advance = insertResult.rows[0];

    await logAction(
      req.user.id,
      req.user.username,
      'CREATE_SALARY_ADVANCE',
      `advance_id: ${advance.id}`,
      { advance }
    );

    return res.status(201).json({
      message: 'Salary advance recorded successfully.',
      advance
    });
  } catch (error) {
    console.error('Error creating salary advance:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   PUT /api/advances/:id
 * @desc    Update a salary advance (amount, date, status, notes)
 * @access  Private (Admin, Manager)
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { amount, advance_date, status, notes } = req.body;

  try {
    // Check if advance exists
    const advCheck = await db.query('SELECT * FROM salary_advances WHERE id = $1', [id]);
    if (advCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Salary advance record not found.' });
    }

    const oldAdvance = advCheck.rows[0];

    // Deducted advances should not be modified
    if (oldAdvance.status === 'deducted' && status !== 'deducted') {
      return res.status(400).json({ error: 'Cannot modify a salary advance that has already been deducted from payroll.' });
    }

    let parsedAmount = oldAdvance.amount;
    if (amount !== undefined) {
      parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Advance amount must be a positive number.' });
      }
    }

    const updateResult = await db.query(
      `UPDATE salary_advances 
       SET amount = $1, advance_date = $2, status = $3, notes = $4 
       WHERE id = $5 
       RETURNING *`,
      [
        parsedAmount,
        advance_date || oldAdvance.advance_date,
        status || oldAdvance.status,
        notes !== undefined ? notes : oldAdvance.notes,
        id
      ]
    );

    const updatedAdvance = updateResult.rows[0];

    // Log status transitions specifically
    let actionType = 'UPDATE_SALARY_ADVANCE';
    if (oldAdvance.status !== updatedAdvance.status) {
      if (updatedAdvance.status === 'approved') actionType = 'APPROVE_SALARY_ADVANCE';
      else if (updatedAdvance.status === 'rejected') actionType = 'REJECT_SALARY_ADVANCE';
    }

    await logAction(
      req.user.id,
      req.user.username,
      actionType,
      `advance_id: ${id}`,
      { old: oldAdvance, new: updatedAdvance }
    );

    return res.json({
      message: 'Salary advance updated successfully.',
      advance: updatedAdvance
    });
  } catch (error) {
    console.error('Error updating salary advance:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   DELETE /api/advances/:id
 * @desc    Delete a salary advance (only if pending or by Admin)
 * @access  Private (Admin, Manager)
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const advCheck = await db.query('SELECT * FROM salary_advances WHERE id = $1', [id]);
    if (advCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Salary advance record not found.' });
    }

    const advance = advCheck.rows[0];

    // Only allow deletion if pending, unless user is admin
    if (advance.status !== 'pending' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Managers can only delete pending advances. Approved/Deducted records require Administrator level.' });
    }

    if (advance.status === 'deducted') {
      return res.status(400).json({ error: 'Cannot delete a salary advance that has already been deducted from payroll.' });
    }

    await db.query('DELETE FROM salary_advances WHERE id = $1', [id]);

    await logAction(
      req.user.id,
      req.user.username,
      'DELETE_SALARY_ADVANCE',
      `advance_id: ${id}`,
      { advance }
    );

    return res.json({ message: 'Salary advance deleted successfully.' });
  } catch (error) {
    console.error('Error deleting salary advance:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
