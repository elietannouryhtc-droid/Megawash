const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const db = require('./db');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static assets from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Connect API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/checkins', require('./routes/checkins'));
app.use('/api/timesheets', require('./routes/timesheets'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/advances', require('./routes/advances'));
app.use('/api/adjustments', require('./routes/adjustments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/users', require('./routes/users'));

// Serve index.html as the entry point for frontend routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize DB and Start Server
db.initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`Timezone forced to America/Toronto`);
  });
}).catch(err => {
  console.error('Failed to start server due to DB initialization error:', err);
  process.exit(1);
});
