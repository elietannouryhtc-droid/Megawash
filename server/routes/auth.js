const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');
const logAction = require('../utils/auditLogger');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * @route   POST /api/auth/login
 * @desc    Login user (admin/manager/employee) & return JWT + cookie
 * @access  Public
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    // Find user in database, join with employee info if applicable
    const result = await db.query(
      `SELECT u.id, u.username, u.password, u.role, u.employee_id, e.first_name, e.last_name 
       FROM users u
       LEFT JOIN employees e ON u.employee_id = e.id
       WHERE u.username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = result.rows[0];

    // Verify bcrypt password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Verify employee status is active if linked
    if (user.employee_id) {
      const empStatusResult = await db.query(
        `SELECT status FROM employees WHERE id = $1`,
        [user.employee_id]
      );
      if (empStatusResult.rows.length > 0 && empStatusResult.rows[0].status === 'inactive') {
        return res.status(403).json({ error: 'Your account is linked to an inactive employee profile.' });
      }
    }

    // Create JWT token payload
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      employee_id: user.employee_id
    };

    // Sign token
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Set token as HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Log the successful login
    await logAction(user.id, user.username, 'LOGIN', `users_id: ${user.id}`, 'User successfully logged in.');

    return res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        employee_id: user.employee_id,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user & clear cookie
 * @access  Private
 */
router.post('/logout', auth, async (req, res) => {
  try {
    await logAction(req.user.id, req.user.username, 'LOGOUT', `users_id: ${req.user.id}`, 'User logged out.');
    
    res.clearCookie('token');
    return res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Error during logout:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user details based on JWT
 * @access  Private
 */
router.get('/me', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.role, u.employee_id, e.first_name, e.last_name 
       FROM users u
       LEFT JOIN employees e ON u.employee_id = e.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User session invalid or user not found.' });
    }

    return res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error in /me:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   GET /api/auth/health
 * @desc    Health check endpoint for Railway deployment monitoring
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
