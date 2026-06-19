const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

let pool;
if (process.env.DATABASE_URL) {
  // Railway (and most cloud providers) require SSL for PostgreSQL connections.
  // rejectUnauthorized: false is needed because Railway uses self-signed certs.
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  // Local development — no SSL needed
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_DATABASE || 'car_wash_db',
    ssl: false
  });
}

// Automatically enforce the America/Toronto timezone for all DB sessions
pool.on('connect', (client) => {
  client.query("SET timezone = 'America/Toronto';")
    .catch(err => console.error('Error setting session timezone:', err));
});

/**
 * Initialize database tables and seed default users/settings.
 */
async function initDb() {
  const client = await pool.connect();
  try {
    console.log('Initializing database...');
    const initSqlPath = path.join(__dirname, 'migrations', 'init.sql');
    const initSql = fs.readFileSync(initSqlPath, 'utf8');
    
    // Execute schema creation & initial seed
    await client.query(initSql);
    console.log('Database schema and seeds executed.');

    // Seed default admin user programmatically if not exists
    const adminCheck = await client.query("SELECT * FROM users WHERE username = 'admin'");
    if (adminCheck.rows.length === 0) {
      console.log('Seeding default admin user...');
      const adminPasswordHash = await bcrypt.hash('admin123', 10);
      await client.query(
        `INSERT INTO users (username, password, role, employee_id) 
         VALUES ($1, $2, $3, $4)`,
        ['admin', adminPasswordHash, 'admin', 1]
      );
      console.log('Admin user seeded (username: admin, password: admin123).');
    }

    // Seed default manager user programmatically if not exists
    const managerCheck = await client.query("SELECT * FROM users WHERE username = 'manager'");
    if (managerCheck.rows.length === 0) {
      console.log('Seeding default manager user...');
      const managerPasswordHash = await bcrypt.hash('manager123', 10);
      
      // We need a manager employee first, or we can check employee with PIN 2222
      let managerEmployeeId = null;
      const empCheck = await client.query("SELECT id FROM employees WHERE pin = '2222'");
      if (empCheck.rows.length === 0) {
        const empInsert = await client.query(
          `INSERT INTO employees (first_name, last_name, pin, hourly_rate, role, status) 
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          ['Manager', 'User', '2222', 20.00, 'manager', 'active']
        );
        managerEmployeeId = empInsert.rows[0].id;
      } else {
        managerEmployeeId = empCheck.rows[0].id;
      }

      await client.query(
        `INSERT INTO users (username, password, role, employee_id) 
         VALUES ($1, $2, $3, $4)`,
        ['manager', managerPasswordHash, 'manager', managerEmployeeId]
      );
      console.log('Manager user seeded (username: manager, password: manager123).');
    }

    // Seed default shared employee user programmatically if not exists
    const employeeUserCheck = await client.query("SELECT * FROM users WHERE username = 'employee'");
    if (employeeUserCheck.rows.length === 0) {
      console.log('Seeding default shared employee user...');
      const employeePasswordHash = await bcrypt.hash('employee', 10);
      await client.query(
        `INSERT INTO users (username, password, role, employee_id) 
         VALUES ($1, $2, $3, $4)`,
        ['employee', employeePasswordHash, 'employee', null]
      );
      console.log('Employee shared user seeded (username: employee, password: employee).');
    }

  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initDb
};
