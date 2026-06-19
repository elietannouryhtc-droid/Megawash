const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.use(auth);
router.use(roleCheck(['admin'])); // Strictly restricted to Administrators

/**
 * @route   GET /api/audit
 * @desc    Get all audit logs (with filters)
 * @access  Private (Admin)
 */
router.get('/', async (req, res) => {
  const { user_id, action, start_date, end_date } = req.query;

  try {
    let queryText = `
      SELECT al.*, u.username as current_user_name 
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    if (user_id) {
      queryText += ` AND al.user_id = $${paramIndex++}`;
      queryParams.push(user_id);
    }

    if (action) {
      queryText += ` AND al.action = $${paramIndex++}`;
      queryParams.push(action);
    }

    if (start_date) {
      queryText += ` AND al.created_at >= $${paramIndex++}`;
      queryParams.push(new Date(start_date));
    }

    if (end_date) {
      queryText += ` AND al.created_at <= $${paramIndex++}`;
      queryParams.push(new Date(end_date));
    }

    queryText += ' ORDER BY al.created_at DESC';

    const result = await db.query(queryText, queryParams);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   DELETE /api/audit
 * @desc    Clear all audit logs
 * @access  Private (Admin only)
 */
router.delete('/', roleCheck(['admin']), async (req, res) => {
  try {
    await db.query('DELETE FROM audit_logs');
    
    // Log this action so there is still a record of who cleared the logs
    await db.query(
      `INSERT INTO audit_logs (user_id, username, action, details) 
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, req.user.username, 'CLEAR_AUDIT_LOGS', 'Audit logs cleared by Administrator.']
    );

    return res.json({ message: 'Audit logs cleared successfully.' });
  } catch (error) {
    console.error('Error clearing audit logs:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
