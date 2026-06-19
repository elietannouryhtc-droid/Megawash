const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const logAction = require('../utils/auditLogger');

router.use(auth);
router.use(roleCheck(['admin'])); // Only admins can view or modify global settings

/**
 * @route   GET /api/settings
 * @desc    Get all system settings
 * @access  Private (Admin)
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM settings ORDER BY key ASC');
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @route   PUT /api/settings/:key
 * @desc    Update a specific setting value
 * @access  Private (Admin)
 */
router.put('/:key', async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (value === undefined || value === null) {
    return res.status(400).json({ error: 'Setting value is required.' });
  }

  // Validate settings inputs if they are overtime configs
  if (key === 'overtime_weekly_threshold') {
    const val = parseFloat(value);
    if (isNaN(val) || val <= 0) {
      return res.status(400).json({ error: 'Overtime weekly threshold must be a positive number.' });
    }
  }

  if (key === 'overtime_rate_multiplier') {
    const val = parseFloat(value);
    if (isNaN(val) || val < 1.0) {
      return res.status(400).json({ error: 'Overtime rate multiplier must be 1.0 or greater.' });
    }
  }

  try {
    // Check if setting exists
    const settingCheck = await db.query('SELECT * FROM settings WHERE key = $1', [key]);
    if (settingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Setting key not found.' });
    }

    const oldSetting = settingCheck.rows[0];

    const result = await db.query(
      `UPDATE settings 
       SET value = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE key = $2 
       RETURNING *`,
      [value.toString(), key]
    );

    const updatedSetting = result.rows[0];

    await logAction(
      req.user.id,
      req.user.username,
      'UPDATE_SETTING',
      `setting_key: ${key}`,
      { old_value: oldSetting.value, new_value: updatedSetting.value }
    );

    return res.json({
      message: `Setting ${key} updated successfully.`,
      setting: updatedSetting
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
