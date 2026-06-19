const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const logAction = require('../utils/auditLogger');

router.use(auth);
router.use(roleCheck(['admin'])); // Strictly Admin-only portal

/**
 * @route   GET /api/users
 * @desc    Get all user accounts
 * @access  Private (Admin only)
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.id, u.username, u.role, u.employee_id, u.created_at,
             e.first_name, e.last_name 
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      ORDER BY u.username ASC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   POST /api/users
 * @desc    Create a user account
 * @access  Private (Admin only)
 */
router.post('/', async (req, res) => {
  const { username, password, role, employee_id } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, and role are required.' });
  }

  if (!['admin', 'manager', 'employee'].includes(role)) {
    return res.status(400).json({ error: 'Invalid user role selected.' });
  }

  try {
    // Check username uniqueness
    const userCheck = await db.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    // Verify employee exists if linked
    let linkedEmpId = employee_id ? parseInt(employee_id) : null;
    if (isNaN(linkedEmpId)) linkedEmpId = null;

    if (linkedEmpId) {
      const empCheck = await db.query('SELECT id FROM employees WHERE id = $1', [linkedEmpId]);
      if (empCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Linked employee profile not found.' });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const insertResult = await db.query(
      `INSERT INTO users (username, password, role, employee_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, username, role, employee_id, created_at`,
      [username.trim(), passwordHash, role, linkedEmpId]
    );

    const newUser = insertResult.rows[0];

    await logAction(
      req.user.id,
      req.user.username,
      'CREATE_USER_ACCOUNT',
      `user_id: ${newUser.id}`,
      { username: newUser.username, role: newUser.role }
    );

    return res.status(201).json({
      message: 'User account created successfully.',
      user: newUser
    });
  } catch (error) {
    console.error('Error creating user account:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   PUT /api/users/:id
 * @desc    Update a user account (username, role, linked employee, and optional password)
 * @access  Private (Admin only)
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, role, employee_id } = req.body;

  if (!username || !role) {
    return res.status(400).json({ error: 'Username and role are required.' });
  }

  if (!['admin', 'manager', 'employee'].includes(role)) {
    return res.status(400).json({ error: 'Invalid user role selected.' });
  }

  try {
    // Verify target user exists
    const userCheck = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const existingUser = userCheck.rows[0];

    // Verify username uniqueness if it changed
    if (username.toLowerCase().trim() !== existingUser.username.toLowerCase()) {
      const dupCheck = await db.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2', [username.trim(), id]);
      if (dupCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Username is already taken by another account.' });
      }
    }

    // Verify employee exists if linked
    let linkedEmpId = employee_id ? parseInt(employee_id) : null;
    if (isNaN(linkedEmpId)) linkedEmpId = null;

    if (linkedEmpId) {
      const empCheck = await db.query('SELECT id FROM employees WHERE id = $1', [linkedEmpId]);
      if (empCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Linked employee profile not found.' });
      }
    }

    let passwordHash = existingUser.password;
    if (password && password.trim() !== '') {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const updateResult = await db.query(
      `UPDATE users 
       SET username = $1, password = $2, role = $3, employee_id = $4 
       WHERE id = $5 
       RETURNING id, username, role, employee_id, created_at`,
      [username.trim(), passwordHash, role, linkedEmpId, id]
    );

    const updatedUser = updateResult.rows[0];

    await logAction(
      req.user.id,
      req.user.username,
      'UPDATE_USER_ACCOUNT',
      `user_id: ${id}`,
      { old: { username: existingUser.username, role: existingUser.role }, new: { username: updatedUser.username, role: updatedUser.role } }
    );

    return res.json({
      message: 'User account updated successfully.',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user account:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete a user account
 * @access  Private (Admin only)
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  // Block self-deletion
  if (parseInt(id) === parseInt(req.user.id)) {
    return res.status(400).json({ error: 'Compliance Security: You cannot delete your own active login session account.' });
  }

  try {
    const userCheck = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const userToDelete = userCheck.rows[0];

    await db.query('DELETE FROM users WHERE id = $1', [id]);

    await logAction(
      req.user.id,
      req.user.username,
      'DELETE_USER_ACCOUNT',
      `user_id: ${id}`,
      { username: userToDelete.username, role: userToDelete.role }
    );

    return res.json({ message: 'User account deleted successfully.' });
  } catch (error) {
    console.error('Error deleting user account:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
