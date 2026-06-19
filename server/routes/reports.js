const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { stringify } = require('csv-stringify');
const db = require('../db');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { calculateTimesheets } = require('../utils/timesheetHelper');
const { formatDateTimeToronto, formatDateToronto } = require('../utils/timezone');

router.use(auth);
router.use(roleCheck(['admin', 'manager']));

/**
 * @route   GET /api/reports/timesheets
 * @desc    Generate Worked Hours / Timesheet Report (PDF, Excel, CSV)
 * @access  Private (Admin, Manager)
 */
router.get('/timesheets', async (req, res) => {
  const { start_date, end_date, employee_id, format } = req.query;

  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'Start date and end date are required.' });
  }

  const reportFormat = (format || 'pdf').toLowerCase();

  try {
    const timesheetData = await calculateTimesheets(start_date, end_date, employee_id);

    // ----------------------------------------------------
    // CSV FORMAT
    // ----------------------------------------------------
    if (reportFormat === 'csv') {
      const csvRows = [
        ['Employee ID', 'First Name', 'Last Name', 'Role', 'Hourly Rate ($)', 'Regular Hours', 'Overtime Hours', 'Total Hours']
      ];

      timesheetData.forEach(row => {
        csvRows.push([
          row.employee_id,
          row.first_name,
          row.last_name,
          row.role,
          row.hourly_rate.toFixed(2),
          row.regular_hours.toFixed(2),
          row.overtime_hours.toFixed(2),
          row.total_hours.toFixed(2)
        ]);
      });

      // Add detailed records headers
      csvRows.push([]);
      csvRows.push(['DETAILED CHECK-IN/OUT RECORDS']);
      csvRows.push(['Record ID', 'Employee ID', 'Name', 'Check-In (Toronto)', 'Check-Out (Toronto)', 'Hours Worked', 'Notes']);

      timesheetData.forEach(sheet => {
        sheet.records.forEach(rec => {
          csvRows.push([
            rec.id,
            sheet.employee_id,
            `${sheet.first_name} ${sheet.last_name}`,
            formatDateTimeToronto(rec.check_in),
            rec.check_out ? formatDateTimeToronto(rec.check_out) : 'STILL CHECKED IN',
            rec.hours_worked ? parseFloat(rec.hours_worked).toFixed(2) : '0.00',
            rec.notes || ''
          ]);
        });
      });

      return stringify(csvRows, (err, output) => {
        if (err) return res.status(500).json({ error: 'Failed to generate CSV.' });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="timesheet-report-${start_date}-to-${end_date}.csv"`);
        return res.send(output);
      });
    }

    // ----------------------------------------------------
    // EXCEL FORMAT
    // ----------------------------------------------------
    if (reportFormat === 'excel') {
      const workbook = new ExcelJS.Workbook();
      
      // Summary Worksheet
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.columns = [
        { header: 'Employee ID', key: 'id', width: 15 },
        { header: 'First Name', key: 'first_name', width: 20 },
        { header: 'Last Name', key: 'last_name', width: 20 },
        { header: 'Role', key: 'role', width: 15 },
        { header: 'Hourly Rate ($)', key: 'rate', width: 15 },
        { header: 'Regular Hours', key: 'reg_hours', width: 15 },
        { header: 'Overtime Hours', key: 'ot_hours', width: 15 },
        { header: 'Total Hours', key: 'tot_hours', width: 15 }
      ];

      timesheetData.forEach(row => {
        summarySheet.addRow({
          id: row.employee_id,
          first_name: row.first_name,
          last_name: row.last_name,
          role: row.role,
          rate: row.hourly_rate,
          reg_hours: row.regular_hours,
          ot_hours: row.overtime_hours,
          tot_hours: row.total_hours
        });
      });

      // Style Header Row
      summarySheet.getRow(1).font = { bold: true };

      // Details Worksheet
      const detailsSheet = workbook.addWorksheet('Check-in Details');
      detailsSheet.columns = [
        { header: 'Record ID', key: 'rec_id', width: 12 },
        { header: 'Employee ID', key: 'emp_id', width: 12 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Check-In Time', key: 'check_in', width: 25 },
        { header: 'Check-Out Time', key: 'check_out', width: 25 },
        { header: 'Hours Worked', key: 'hours', width: 15 },
        { header: 'Notes', key: 'notes', width: 30 }
      ];

      timesheetData.forEach(sheet => {
        sheet.records.forEach(rec => {
          detailsSheet.addRow({
            rec_id: rec.id,
            emp_id: sheet.employee_id,
            name: `${sheet.first_name} ${sheet.last_name}`,
            check_in: formatDateTimeToronto(rec.check_in),
            check_out: rec.check_out ? formatDateTimeToronto(rec.check_out) : 'Checked In',
            hours: rec.hours_worked ? parseFloat(rec.hours_worked) : 0,
            notes: rec.notes || ''
          });
        });
      });

      detailsSheet.getRow(1).font = { bold: true };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="timesheet-report-${start_date}-to-${end_date}.xlsx"`);
      
      await workbook.xlsx.write(res);
      return res.end();
    }

    // ----------------------------------------------------
    // PDF FORMAT (Default)
    // ----------------------------------------------------
    if (reportFormat === 'pdf') {
      const doc = new PDFDocument({ margin: 40 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="timesheet-report-${start_date}-to-${end_date}.pdf"`);
      doc.pipe(res);

      // Header
      doc.fontSize(20).text('CAR WASH TIMESHEET REPORT', { align: 'center', underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Report Period: ${start_date} to ${end_date}`, { align: 'center' });
      doc.text(`Generated at: ${formatDateTimeToronto(new Date())}`, { align: 'center' });
      doc.moveDown(1.5);

      // Summaries Table
      doc.fontSize(14).text('Worked Hours Summary', { underline: true });
      doc.moveDown(0.5);

      // Draw Summary Table Headers
      const startX = 40;
      let currentY = doc.y;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('ID', startX, currentY, { width: 30 });
      doc.text('Name', startX + 40, currentY, { width: 120 });
      doc.text('Role', startX + 170, currentY, { width: 80 });
      doc.text('Hourly ($)', startX + 260, currentY, { width: 60 });
      doc.text('Regular', startX + 330, currentY, { width: 60 });
      doc.text('Overtime', startX + 400, currentY, { width: 60 });
      doc.text('Total', startX + 470, currentY, { width: 60 });
      
      doc.moveTo(startX, currentY + 15).lineTo(550, currentY + 15).stroke();
      doc.font('Helvetica');
      currentY += 20;

      // Draw rows
      timesheetData.forEach(row => {
        // Page boundary check
        if (currentY > 700) {
          doc.addPage();
          currentY = 40;
        }
        doc.text(row.employee_id.toString(), startX, currentY);
        doc.text(`${row.first_name} ${row.last_name}`, startX + 40, currentY);
        doc.text(row.role, startX + 170, currentY);
        doc.text(row.hourly_rate.toFixed(2), startX + 260, currentY);
        doc.text(row.regular_hours.toFixed(2), startX + 330, currentY);
        doc.text(row.overtime_hours.toFixed(2), startX + 400, currentY);
        doc.text(row.total_hours.toFixed(2), startX + 470, currentY);
        
        currentY += 18;
      });

      // Draw Details
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('Detailed Check-In/Out Log', 40, 40, { underline: true });
      doc.moveDown(0.5);

      let detailY = doc.y;
      doc.fontSize(9);
      doc.text('ID', startX, detailY, { width: 25 });
      doc.text('Employee', startX + 30, detailY, { width: 100 });
      doc.text('Check-In', startX + 140, detailY, { width: 110 });
      doc.text('Check-Out', startX + 260, detailY, { width: 110 });
      doc.text('Hours', startX + 380, detailY, { width: 45 });
      doc.text('Notes', startX + 430, detailY, { width: 110 });

      doc.moveTo(startX, detailY + 12).lineTo(550, detailY + 12).stroke();
      detailY += 18;
      doc.font('Helvetica');

      timesheetData.forEach(sheet => {
        sheet.records.forEach(rec => {
          if (detailY > 700) {
            doc.addPage();
            detailY = 40;
          }
          doc.text(rec.id.toString(), startX, detailY);
          doc.text(`${sheet.first_name} ${sheet.last_name.charAt(0)}.`, startX + 30, detailY);
          doc.text(formatDateTimeToronto(rec.check_in), startX + 140, detailY);
          doc.text(rec.check_out ? formatDateTimeToronto(rec.check_out) : 'Active', startX + 260, detailY);
          doc.text(rec.hours_worked ? parseFloat(rec.hours_worked).toFixed(2) : '0.00', startX + 380, detailY);
          doc.text(rec.notes || '', startX + 430, detailY, { width: 110, height: 15, ellipsis: true });
          
          detailY += 16;
        });
      });

      doc.end();
    }

  } catch (error) {
    console.error('Error generating timesheet report:', error);
    return res.status(500).json({ error: 'Failed to generate timesheet report.' });
  }
});

/**
 * @route   GET /api/reports/payroll
 * @desc    Generate Payroll Summary Report (PDF, Excel, CSV)
 * @access  Private (Admin, Manager)
 */
router.get('/payroll', async (req, res) => {
  const { start_date, end_date, employee_id, format } = req.query;

  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'Start date and end date are required.' });
  }

  const reportFormat = (format || 'pdf').toLowerCase();

  try {
    let queryText = `
      SELECT p.*, e.first_name, e.last_name, e.role 
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.pay_period_start >= $1 AND p.pay_period_end <= $2
    `;
    const queryParams = [start_date, end_date];

    if (employee_id) {
      queryText += ` AND p.employee_id = $3`;
      queryParams.push(employee_id);
    }

    queryText += ' ORDER BY e.last_name ASC, p.pay_period_end DESC';
    const payrollResult = await db.query(queryText, queryParams);
    const payrolls = payrollResult.rows;

    // ----------------------------------------------------
    // CSV FORMAT
    // ----------------------------------------------------
    if (reportFormat === 'csv') {
      const csvRows = [
        ['Payroll ID', 'Employee ID', 'Name', 'Role', 'Period Start', 'Period End', 'Regular Hours', 'Overtime Hours', 'Hourly Rate ($)', 'Gross Pay ($)', 'Advances Deducted ($)', 'Adjustments ($)', 'Net Pay ($)', 'Status', 'Paid At']
      ];

      payrolls.forEach(p => {
        csvRows.push([
          p.id,
          p.employee_id,
          `${p.first_name} ${p.last_name}`,
          p.role,
          formatDateToronto(p.pay_period_start),
          formatDateToronto(p.pay_period_end),
          parseFloat(p.regular_hours).toFixed(2),
          parseFloat(p.overtime_hours).toFixed(2),
          parseFloat(p.hourly_rate).toFixed(2),
          parseFloat(p.gross_pay).toFixed(2),
          parseFloat(p.advances_deducted).toFixed(2),
          parseFloat(p.adjustments).toFixed(2),
          parseFloat(p.net_pay).toFixed(2),
          p.payment_status,
          p.paid_at ? formatDateTimeToronto(p.paid_at) : 'N/A'
        ]);
      });

      return stringify(csvRows, (err, output) => {
        if (err) return res.status(500).json({ error: 'Failed to generate CSV.' });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="payroll-report-${start_date}-to-${end_date}.csv"`);
        return res.send(output);
      });
    }

    // ----------------------------------------------------
    // EXCEL FORMAT
    // ----------------------------------------------------
    if (reportFormat === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Payroll Summary');

      sheet.columns = [
        { header: 'Payroll ID', key: 'id', width: 12 },
        { header: 'Employee ID', key: 'emp_id', width: 12 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Role', key: 'role', width: 15 },
        { header: 'Period Start', key: 'start', width: 15 },
        { header: 'Period End', key: 'end', width: 15 },
        { header: 'Reg Hours', key: 'reg_hours', width: 12 },
        { header: 'OT Hours', key: 'ot_hours', width: 12 },
        { header: 'Hourly Rate ($)', key: 'rate', width: 15 },
        { header: 'Gross Pay ($)', key: 'gross', width: 15 },
        { header: 'Advances Ded. ($)', key: 'adv', width: 15 },
        { header: 'Adjustments ($)', key: 'adj', width: 15 },
        { header: 'Net Pay ($)', key: 'net', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Paid At', key: 'paid_at', width: 25 }
      ];

      payrolls.forEach(p => {
        sheet.addRow({
          id: p.id,
          emp_id: p.employee_id,
          name: `${p.first_name} ${p.last_name}`,
          role: p.role,
          start: formatDateToronto(p.pay_period_start),
          end: formatDateToronto(p.pay_period_end),
          reg_hours: parseFloat(p.regular_hours),
          ot_hours: parseFloat(p.overtime_hours),
          rate: parseFloat(p.hourly_rate),
          gross: parseFloat(p.gross_pay),
          adv: parseFloat(p.advances_deducted),
          adj: parseFloat(p.adjustments),
          net: parseFloat(p.net_pay),
          status: p.payment_status,
          paid_at: p.paid_at ? formatDateTimeToronto(p.paid_at) : 'N/A'
        });
      });

      sheet.getRow(1).font = { bold: true };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="payroll-report-${start_date}-to-${end_date}.xlsx"`);
      
      await workbook.xlsx.write(res);
      return res.end();
    }

    // ----------------------------------------------------
    // PDF FORMAT
    // ----------------------------------------------------
    if (reportFormat === 'pdf') {
      const doc = new PDFDocument({ margin: 30, layout: 'landscape' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="payroll-report-${start_date}-to-${end_date}.pdf"`);
      doc.pipe(res);

      // Header
      doc.fontSize(22).text('CAR WASH PAYROLL SUMMARY REPORT', { align: 'center', underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Pay Period Dates: ${start_date} to ${end_date}`, { align: 'center' });
      doc.text(`Generated at: ${formatDateTimeToronto(new Date())}`, { align: 'center' });
      doc.moveDown(1.5);

      const startX = 30;
      let currentY = doc.y;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('ID', startX, currentY, { width: 35 });
      doc.text('Name', startX + 40, currentY, { width: 110 });
      doc.text('Period', startX + 160, currentY, { width: 120 });
      doc.text('Reg / OT', startX + 290, currentY, { width: 60 });
      doc.text('Hourly', startX + 360, currentY, { width: 50 });
      doc.text('Gross ($)', startX + 420, currentY, { width: 60 });
      doc.text('Deducted ($)', startX + 490, currentY, { width: 70 });
      doc.text('Adjust ($)', startX + 570, currentY, { width: 60 });
      doc.text('Net Pay ($)', startX + 640, currentY, { width: 70 });
      doc.text('Status', startX + 720, currentY, { width: 55 });
      
      doc.moveTo(startX, currentY + 15).lineTo(760, currentY + 15).stroke();
      doc.font('Helvetica');
      currentY += 22;

      payrolls.forEach(p => {
        if (currentY > 520) {
          doc.addPage();
          currentY = 40;
        }

        doc.text(p.id.toString(), startX, currentY);
        doc.text(`${p.first_name} ${p.last_name}`, startX + 40, currentY);
        doc.text(`${formatDateToronto(p.pay_period_start)} to ${formatDateToronto(p.pay_period_end)}`, startX + 160, currentY);
        doc.text(`${parseFloat(p.regular_hours).toFixed(1)} / ${parseFloat(p.overtime_hours).toFixed(1)}`, startX + 290, currentY);
        doc.text(parseFloat(p.hourly_rate).toFixed(2), startX + 360, currentY);
        doc.text(parseFloat(p.gross_pay).toFixed(2), startX + 420, currentY);
        doc.text(parseFloat(p.advances_deducted).toFixed(2), startX + 490, currentY);
        doc.text(parseFloat(p.adjustments).toFixed(2), startX + 570, currentY);
        doc.font('Helvetica-Bold');
        doc.text(parseFloat(p.net_pay).toFixed(2), startX + 640, currentY);
        doc.font('Helvetica');
        doc.text(p.payment_status.toUpperCase(), startX + 720, currentY);

        currentY += 20;
      });

      doc.end();
    }

  } catch (error) {
    console.error('Error generating payroll report:', error);
    return res.status(500).json({ error: 'Failed to generate payroll report.' });
  }
});

module.exports = router;
