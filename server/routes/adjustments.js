const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const logAction = require('../utils/auditLogger');

router.use(auth);
router.use(roleCheck(['admin', 'manager']));

/**
 * @route   GET /api/adjustments
 * @desc    Get manual payroll adjustments (with filters)
 * @access  Private (Admin, Manager)
 */
router.get('/', async (req, res) => {
  const { employee_id, payroll_id, processed, start_date, end_date } = req.query;

  try {
    let queryText = `
      SELECT ma.*, e.first_name, e.last_name, e.role 
      FROM manual_adjustments ma
      JOIN employees e ON ma.employee_id = e.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    if (employee_id) {
      queryText += ` AND ma.employee_id = $${paramIndex++}`;
      queryParams.push(employee_id);
    }

    if (payroll_id) {
      queryText += ` AND ma.payroll_id = $${paramIndex++}`;
      queryParams.push(payroll_id);
    } else if (processed === 'true') {
      queryText += ` AND ma.payroll_id IS NOT NULL`;
    } else if (processed === 'false') {
      queryText += ` AND ma.payroll_id IS NULL`;
    }

    if (start_date) {
      queryText += ` AND ma.adjustment_date >= $${paramIndex++}`;
      queryParams.push(start_date);
    }

    if (end_date) {
      queryText += ` AND ma.adjustment_date <= $${paramIndex++}`;
      queryParams.push(end_date);
    }

    queryText += ' ORDER BY ma.adjustment_date DESC, ma.created_at DESC';

    const result = await db.query(queryText, queryParams);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching manual adjustments:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   POST /api/adjustments
 * @desc    Create a manual adjustment
 * @access  Private (Admin, Manager)
 */
router.post('/', async (req, res) => {
  const { employee_id, amount, type, description, adjustment_date } = req.body;

  if (!employee_id || amount === undefined || !type) {
    return res.status(400).json({ error: 'Employee ID, amount, and type are required.' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount)) {
    return res.status(400).json({ error: 'Adjustment amount must be a number.' });
  }

  try {
    // Check if employee exists
    const empCheck = await db.query('SELECT id FROM employees WHERE id = $1', [employee_id]);
    if (empCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const insertResult = await db.query(
      `INSERT INTO manual_adjustments (employee_id, amount, type, description, adjustment_date) 
       VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE)) 
       RETURNING *`,
      [employee_id, parsedAmount, type, description || null, adjustment_date || null]
    );

    const adjustment = insertResult.rows[0];

    await logAction(
      req.user.id,
      req.user.username,
      'CREATE_MANUAL_ADJUSTMENT',
      `adjustment_id: ${adjustment.id}`,
      { adjustment }
    );

    return res.status(201).json({
      message: 'Adjustment recorded successfully.',
      adjustment
    });
  } catch (error) {
    console.error('Error creating manual adjustment:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   PUT /api/adjustments/:id
 * @desc    Update a manual adjustment (only if not processed in a payroll yet)
 * @access  Private (Admin, Manager)
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { amount, type, description, adjustment_date } = req.body;

  try {
    // Check if adjustment exists
    const adjCheck = await db.query('SELECT * FROM manual_adjustments WHERE id = $1', [id]);
    if (adjCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Adjustment not found.' });
    }

    const oldAdjustment = adjCheck.rows[0];

    // If adjustment is already associated with a payroll, block updates
    if (oldAdjustment.payroll_id) {
      return res.status(400).json({ error: 'Cannot modify an adjustment that has already been processed in a completed payroll.' });
    }

    let parsedAmount = oldAdjustment.amount;
    if (amount !== undefined) {
      parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) {
        return res.status(400).json({ error: 'Adjustment amount must be a valid number.' });
      }
    }

    const updateResult = await db.query(
      `UPDATE manual_adjustments 
       SET amount = $1, type = $2, description = $3, adjustment_date = $4 
       WHERE id = $5 
       RETURNING *`,
      [
        parsedAmount,
        type || oldAdjustment.type,
        description !== undefined ? description : oldAdjustment.description,
        adjustment_date || oldAdjustment.adjustment_date,
        id
      ]
    );

    const updatedAdjustment = updateResult.rows[0];

    await logAction(
      req.user.id,
      req.user.username,
      'UPDATE_MANUAL_ADJUSTMENT',
      `adjustment_id: ${id}`,
      { old: oldAdjustment, new: updatedAdjustment }
    );

    return res.json({
      message: 'Adjustment updated successfully.',
      adjustment: updatedAdjustment
    });
  } catch (error) {
    console.error('Error updating manual adjustment:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   DELETE /api/adjustments/:id
 * @desc    Delete a manual adjustment (only if not processed in a payroll yet)
 * @access  Private (Admin, Manager)
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const adjCheck = await db.query('SELECT * FROM manual_adjustments WHERE id = $1', [id]);
    if (adjCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Adjustment not found.' });
    }

    const adjustment = adjCheck.rows[0];

    // If adjustment is already associated with a payroll, block deletion
    if (adjustment.payroll_id) {
      return res.status(400).json({ error: 'Cannot delete an adjustment that has already been processed in a completed payroll.' });
    }

    await db.query('DELETE FROM manual_adjustments WHERE id = $1', [id]);

    await logAction(
      req.user.id,
      req.user.username,
      'DELETE_MANUAL_ADJUSTMENT',
      `adjustment_id: ${id}`,
      { adjustment }
    );

    return res.json({ message: 'Adjustment deleted successfully.' });
  } catch (error) {
    console.error('Error deleting manual adjustment:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
