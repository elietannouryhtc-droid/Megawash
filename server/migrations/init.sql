-- CREATE TABLES FOR CAR WASH SYSTEM

-- 1. Employees table
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    pin VARCHAR(6) UNIQUE NOT NULL,
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
    role VARCHAR(20) NOT NULL CHECK (role IN ('washer', 'detailer', 'manager', 'admin')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users table (for dashboard access)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Check-In Records table
CREATE TABLE IF NOT EXISTS check_in_records (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    check_in TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out TIMESTAMP WITH TIME ZONE,
    hours_worked NUMERIC(10, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'checked_in' CHECK (status IN ('checked_in', 'checked_out')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Salary Advances table
CREATE TABLE IF NOT EXISTS salary_advances (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'deducted')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Payroll table
CREATE TABLE IF NOT EXISTS payroll (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    regular_hours NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    overtime_hours NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    hourly_rate NUMERIC(10, 2) NOT NULL,
    gross_pay NUMERIC(10, 2) NOT NULL,
    advances_deducted NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    adjustments NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    net_pay NUMERIC(10, 2) NOT NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Manual Adjustments table
CREATE TABLE IF NOT EXISTS manual_adjustments (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL, -- Positive for bonus/reimbursement, Negative for fines/deductions
    type VARCHAR(50) NOT NULL CHECK (type IN ('bonus', 'fine', 'reimbursement', 'deduction', 'other')),
    description TEXT,
    adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payroll_id INTEGER REFERENCES payroll(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(50), -- snapshot of user at the time
    action VARCHAR(100) NOT NULL,
    target VARCHAR(100),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Settings table
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SEED DATA

-- Seed System Settings
INSERT INTO settings (key, value, description) VALUES
('overtime_weekly_threshold', '44', 'Weekly regular hours threshold before overtime rate applies.'),
('overtime_rate_multiplier', '1.5', 'Overtime rate multiplier (e.g. 1.5x hourly rate).'),
('company_name', 'Mega Wash', 'Company Business Name'),
('currency', '$', 'Default Currency Symbol'),
('tax_rate', '15', 'Default Tax/Deduction Rate (%)')
ON CONFLICT (key) DO NOTHING;

-- Seed Default Admin Employee (PIN: 9999)
INSERT INTO employees (id, first_name, last_name, pin, hourly_rate, role, status)
VALUES (1, 'Admin', 'User', '9999', 25.00, 'admin', 'active')
ON CONFLICT (pin) DO NOTHING;

-- Seed Default Washer Employee (PIN: 1111)
INSERT INTO employees (id, first_name, last_name, pin, hourly_rate, role, status)
VALUES (2, 'John', 'Doe', '1111', 16.50, 'washer', 'active')
ON CONFLICT (pin) DO NOTHING;

-- Adjust sequence value to prevent conflicts on next insert
SELECT setval(pg_get_serial_sequence('employees', 'id'), COALESCE((SELECT MAX(id) FROM employees), 1));
