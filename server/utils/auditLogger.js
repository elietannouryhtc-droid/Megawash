const db = require('../db');

/**
 * Log an administrative or employee action for auditing.
 * @param {number|null} userId - The user ID performing the action
 * @param {string|null} username - The username performing the action
 * @param {string} action - The action string (e.g. 'CREATE_EMPLOYEE', 'CHECK_IN')
 * @param {string|null} target - The entity being affected (e.g. 'employee_id: 5')
 * @param {object|string|null} details - Additional contextual details
 */
async function logAction(userId, username, action, target, details) {
  try {
    const detailsStr = details && typeof details === 'object' 
      ? JSON.stringify(details) 
      : details;

    await db.query(
      `INSERT INTO audit_logs (user_id, username, action, target, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [userId || null, username || null, action, target, detailsStr || null]
    );
  } catch (error) {
    console.error('Failed to write to audit_logs:', error);
  }
}

module.exports = logAction;
