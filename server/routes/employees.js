const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const logAction = require('../utils/auditLogger');

// All employee endpoints require authentication
router.use(auth);

/**
 * @route   GET /api/employees/status
 * @desc    Get currently checked-in and checked-out employees (names and roles only)
 * @access  Private (All authenticated users)
 */
router.get('/status', async (req, res) => {
  try {
    // 1. Fetch all active employees
    const employeesRes = await db.query(
      "SELECT id, first_name, last_name, role FROM employees WHERE status = 'active' ORDER BY last_name ASC, first_name ASC"
    );

    // 2. Fetch all currently checked-in records
    const checkedInRes = await db.query(
      "SELECT employee_id, check_in FROM check_in_records WHERE status = 'checked_in'"
    );

    // Map checked-in employees
    const checkedInMap = {};
    checkedInRes.rows.forEach(row => {
      checkedInMap[row.employee_id] = row.check_in;
    });

    const checkedIn = [];
    const checkedOut = [];

    employeesRes.rows.forEach(emp => {
      if (checkedInMap[emp.id]) {
        checkedIn.push({
          id: emp.id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          role: emp.role,
          check_in: checkedInMap[emp.id]
        });
      } else {
        checkedOut.push({
          id: emp.id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          role: emp.role
        });
      }
    });

    return res.json({ checkedIn, checkedOut });
  } catch (error) {
    console.error('Error fetching employee check-in status:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Admin and Manager role guard for remaining routes
router.use(roleCheck(['admin', 'manager']));

/**
 * @route   GET /api/employees
 * @desc    Get all employees (optionally filtered by status)
 * @access  Private (Admin, Manager)
 */
router.get('/', async (req, res) => {
  const { status } = req.query;
  try {
    let queryText = 'SELECT * FROM employees';
    const queryParams = [];

    if (status) {
      queryText += ' WHERE status = $1';
      queryParams.push(status);
    }
    
    queryText += ' ORDER BY last_name ASC, first_name ASC';
    const result = await db.query(queryText, queryParams);
    
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   GET /api/employees/:id
 * @desc    Get a single employee's details by ID
 * @access  Private (Admin, Manager)
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const empResult = await db.query('SELECT * FROM employees WHERE id = $1', [id]);
    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // Also get any linked user account
    const userResult = await db.query(
      'SELECT id, username, role FROM users WHERE employee_id = $1', 
      [id]
    );

    const employee = empResult.rows[0];
    employee.user = userResult.rows[0] || null;

    return res.json(employee);
  } catch (error) {
    console.error('Error fetching employee details:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   POST /api/employees
 * @desc    Create a new employee (with optional user account)
 * @access  Private (Admin, Manager)
 */
router.post('/', async (req, res) => {
  const { first_name, last_name, pin, hourly_rate, role, status, create_user, username, password, user_role } = req.body;

  if (!first_name || !last_name || !pin || !role) {
    return res.status(400).json({ error: 'First name, last name, pin, and role are required.' });
  }

  // Validate hourly rate
  const parsedRate = parseFloat(hourly_rate || 15.00);
  if (isNaN(parsedRate) || parsedRate < 0) {
    return res.status(400).json({ error: 'Hourly rate must be a valid positive number.' });
  }

  // Start database transaction
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check PIN uniqueness
    const pinCheck = await client.query('SELECT id FROM employees WHERE pin = $1', [pin]);
    if (pinCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'PIN already exists. Please choose a unique PIN.' });
    }

    // 2. Insert Employee
    const empResult = await client.query(
      `INSERT INTO employees (first_name, last_name, pin, hourly_rate, role, status) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [first_name, last_name, pin, parsedRate, role, status || 'active']
    );
    const newEmployee = empResult.rows[0];

    // 3. Create linked user dashboard account if requested
    let newUser = null;
    if (create_user === true || create_user === 'true') {
      if (!username || !password || !user_role) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Username, password, and user_role are required to create a dashboard account.' });
      }

      // Check username uniqueness
      const userCheck = await client.query('SELECT id FROM users WHERE username = $1', [username]);
      if (userCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Username already exists.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userResult = await client.query(
        `INSERT INTO users (username, password, role, employee_id) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, username, role`,
        [username, hashedPassword, user_role, newEmployee.id]
      );
      newUser = userResult.rows[0];
    }

    await client.query('COMMIT');

    // Audit Log
    await logAction(
      req.user.id,
      req.user.username,
      'CREATE_EMPLOYEE',
      `employee_id: ${newEmployee.id}`,
      { employee: newEmployee, created_user: !!newUser }
    );

    return res.status(201).json({
      message: 'Employee created successfully.',
      employee: {
        ...newEmployee,
        user: newUser
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating employee:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

/**
 * @route   PUT /api/employees/:id
 * @desc    Update employee details (including status, rate, pin)
 * @access  Private (Admin, Manager)
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, pin, hourly_rate, role, status } = req.body;

  if (!first_name || !last_name || !pin || !role) {
    return res.status(400).json({ error: 'First name, last name, pin, and role are required.' });
  }

  const parsedRate = parseFloat(hourly_rate);
  if (isNaN(parsedRate) || parsedRate < 0) {
    return res.status(400).json({ error: 'Hourly rate must be a valid positive number.' });
  }

  try {
    // Check if employee exists
    const empCheck = await db.query('SELECT * FROM employees WHERE id = $1', [id]);
    if (empCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // Check PIN uniqueness (excluding current employee)
    const pinCheck = await db.query('SELECT id FROM employees WHERE pin = $1 AND id != $2', [pin, id]);
    if (pinCheck.rows.length > 0) {
      return res.status(400).json({ error: 'PIN already in use by another employee.' });
    }

    const updatedResult = await db.query(
      `UPDATE employees 
       SET first_name = $1, last_name = $2, pin = $3, hourly_rate = $4, role = $5, status = $6 
       WHERE id = $7 
       RETURNING *`,
      [first_name, last_name, pin, parsedRate, role, status, id]
    );

    const updatedEmployee = updatedResult.rows[0];

    // If employee status is set to inactive, also lock or delete linked user dashboard access?
    // Let's keep it simple: if inactive, the login endpoint checks this anyway.

    await logAction(
      req.user.id,
      req.user.username,
      'UPDATE_EMPLOYEE',
      `employee_id: ${id}`,
      { old_data: empCheck.rows[0], new_data: updatedEmployee }
    );

    return res.json({
      message: 'Employee updated successfully.',
      employee: updatedEmployee
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   DELETE /api/employees/:id
 * @desc    Delete employee (soft delete via status change or hard delete)
 * @access  Private (Admin)
 */
router.delete('/:id', roleCheck(['admin']), async (req, res) => {
  const { id } = req.params;

  try {
    const empCheck = await db.query('SELECT * FROM employees WHERE id = $1', [id]);
    if (empCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // Check if employee is currently checked in
    const checkinCheck = await db.query(
      "SELECT id FROM check_in_records WHERE employee_id = $1 AND status = 'checked_in'",
      [id]
    );
    if (checkinCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete an employee who is currently checked in. Please check them out first.' });
    }

    // Delete employee (cascading will handle checkins, payroll, manual_adjustments, salary_advances)
    await db.query('DELETE FROM employees WHERE id = $1', [id]);

    await logAction(
      req.user.id,
      req.user.username,
      'DELETE_EMPLOYEE',
      `employee_id: ${id}`,
      { employee_details: empCheck.rows[0] }
    );

    return res.json({ message: 'Employee deleted successfully.' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
