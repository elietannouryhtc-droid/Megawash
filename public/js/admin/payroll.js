// Admin Payroll Controller

let currentPayrollData = [];
let selectedEmployeeSlip = null;

function setDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7); // Default to last 7 days

  document.getElementById('payStartDate').value = start.toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });
  document.getElementById('payEndDate').value = end.toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });
}

async function calculatePayroll() {
  const startVal = document.getElementById('payStartDate').value;
  const endVal = document.getElementById('payEndDate').value;

  if (!startVal || !endVal) {
    showToast('Please select both start and end dates.', 'error');
    return;
  }

  const startDate = new Date(startVal);
  const endDate = new Date(endVal);

  if (endDate < startDate) {
    showToast('End date cannot be before start date.', 'error');
    return;
  }

  try {
    const tbody = document.getElementById('payrollTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);" data-i18n="loading">Generating payroll...</td></tr>`;
    }

    // Call POST API to generate payroll
    const res = await apiFetch('/api/payroll/generate', {
      method: 'POST',
      body: JSON.stringify({
        pay_period_start: startVal,
        pay_period_end: endVal
      })
    });

    showToast(res.message, 'success');
    
    // Load generated payroll records for this period
    loadPayrollRecords(startVal, endVal);
  } catch (err) {
    console.error('Error generating payroll:', err);
    showToast(err.message || 'Failed to generate payroll.', 'error');
    loadPayrollRecords(startVal, endVal);
  }
}

async function loadPayrollRecords(startVal, endVal) {
  try {
    const queryParams = new URLSearchParams();
    if (startVal) queryParams.append('start_date', startVal);
    if (endVal) queryParams.append('end_date', endVal);

    currentPayrollData = await apiFetch(`/api/payroll?${queryParams.toString()}`);
    renderPayrollTable(currentPayrollData);
  } catch (err) {
    console.error('Failed to load payroll list:', err);
    showToast('Failed to retrieve payroll records.', 'error');
  }
}

function renderPayrollTable(list) {
  const tbody = document.getElementById('payrollTableBody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted);">
          No payroll records found for this period.
        </td>
      </tr>`;
    return;
  }

  // Fetch settings to get currency symbol
  let currencySymbol = '$';
  apiFetch('/api/settings').then(settings => {
    const currencySetting = settings.find(s => s.key === 'currency');
    if (currencySetting) currencySymbol = currencySetting.value;
    renderData();
  }).catch(() => {
    renderData();
  });

  function renderData() {
    tbody.innerHTML = list.map(p => {
      const name = `${p.first_name} ${p.last_name}`;
      const regHrs = parseFloat(p.regular_hours).toFixed(2);
      const otHrs = parseFloat(p.overtime_hours).toFixed(2);
      const gross = parseFloat(p.gross_pay).toFixed(2);
      const adv = parseFloat(p.advances_deductions || p.advances_deducted || 0).toFixed(2);
      const net = parseFloat(p.net_pay).toFixed(2);
      
      const statusBadge = p.payment_status === 'paid' 
        ? `<span class="badge badge-success">Paid</span>` 
        : `<span class="badge badge-warning">Unpaid</span>`;

      const deleteBtn = p.payment_status === 'unpaid'
        ? `<button class="btn btn-danger btn-sm delete-btn" data-id="${p.id}">${t('delete')}</button>`
        : '';

      return `
        <tr>
          <td><strong>${escapeHtml(name)}</strong></td>
          <td>${regHrs} hrs</td>
          <td>${otHrs} hrs</td>
          <td>${currencySymbol}${gross}</td>
          <td>${currencySymbol}${adv}</td>
          <td><strong>${currencySymbol}${net}</strong></td>
          <td>${statusBadge}</td>
          <td style="text-align: right; white-space: nowrap;">
            <button class="btn btn-secondary btn-sm view-btn" data-id="${p.id}" style="margin-right: 5px;">View Slip</button>
            ${deleteBtn}
          </td>
        </tr>
      `;
    }).join('');

    // Attach button event listeners
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openPayslipModal(id);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        deletePayroll(id);
      });
    });
  }
}

function openPayslipModal(id) {
  const p = currentPayrollData.find(item => item.id.toString() === id.toString());
  if (!p) return;

  selectedEmployeeSlip = p;

  let currencySymbol = '$';
  apiFetch('/api/settings').then(settings => {
    const currencySetting = settings.find(s => s.key === 'currency');
    if (currencySetting) currencySymbol = currencySetting.value;
    renderSlip();
  }).catch(() => {
    renderSlip();
  });

  function renderSlip() {
    const name = `${p.first_name} ${p.last_name}`;
    const periodStart = new Date(p.pay_period_start).toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });
    const periodEnd = new Date(p.pay_period_end).toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });

    const regHrs = parseFloat(p.regular_hours).toFixed(2);
    const otHrs = parseFloat(p.overtime_hours).toFixed(2);
    const hourlyRate = parseFloat(p.hourly_rate).toFixed(2);
    const gross = parseFloat(p.gross_pay).toFixed(2);
    const adv = parseFloat(p.advances_deductions || p.advances_deducted || 0).toFixed(2);
    const adj = parseFloat(p.adjustments || 0).toFixed(2);
    const net = parseFloat(p.net_pay).toFixed(2);

    const contentEl = document.getElementById('payslipContent');
    if (contentEl) {
      contentEl.innerHTML = `
        <div class="payslip-row">
          <span>Employee:</span>
          <strong>${escapeHtml(name)}</strong>
        </div>
        <div class="payslip-row">
          <span>Pay Period:</span>
          <span>${periodStart} to ${periodEnd}</span>
        </div>
        <div class="payslip-row">
          <span>Hourly Rate:</span>
          <span>${currencySymbol}${hourlyRate}/hr</span>
        </div>
        <div class="payslip-row">
          <span>Regular Hours:</span>
          <span>${regHrs} hrs</span>
        </div>
        <div class="payslip-row">
          <span>Overtime Hours:</span>
          <span>${otHrs} hrs</span>
        </div>
        <div class="payslip-row">
          <span>Gross Earnings:</span>
          <span>${currencySymbol}${gross}</span>
        </div>
        <div class="payslip-row">
          <span>Manual Adjustments:</span>
          <span style="color: ${adj < 0 ? 'var(--danger)' : (adj > 0 ? 'var(--success)' : 'inherit')}">
            ${adj < 0 ? '' : '+'}${currencySymbol}${parseFloat(adj).toFixed(2)}
          </span>
        </div>
        <div class="payslip-row">
          <span>Advances Deducted:</span>
          <span style="color: var(--danger)">-${currencySymbol}${adv}</span>
        </div>
        <div class="payslip-row total">
          <span>Net Salary:</span>
          <span>${currencySymbol}${net}</span>
        </div>
        <div class="payslip-row">
          <span>Status:</span>
          <strong>${p.payment_status.toUpperCase()}</strong>
        </div>
      `;
    }

    // Toggle Payment Button depending on paid status
    const payBtn = document.getElementById('btnProcessPayment');
    if (payBtn) {
      if (p.payment_status === 'paid') {
        payBtn.style.display = 'none';
      } else {
        payBtn.style.display = 'block';
      }
    }

    document.getElementById('payslipModal').classList.add('open');
  }
}

async function processPayment() {
  if (!selectedEmployeeSlip) return;

  const p = selectedEmployeeSlip;
  const name = `${p.first_name} ${p.last_name}`;
  if (confirm(`Mark payroll for ${name} as PAID?`)) {
    try {
      await apiFetch(`/api/payroll/${p.id}/pay`, {
        method: 'PUT'
      });
      showToast('Payroll processed and marked as paid.', 'success');
      document.getElementById('payslipModal').classList.remove('open');
      
      const startVal = document.getElementById('payStartDate').value;
      const endVal = document.getElementById('payEndDate').value;
      loadPayrollRecords(startVal, endVal);
    } catch (err) {
      console.error('Error processing payment:', err);
      showToast(err.message || 'Failed to mark payroll as paid.', 'error');
    }
  }
}

async function deletePayroll(id) {
  if (confirm('Are you sure you want to delete this unpaid payroll record? This will revert associated salary advances.')) {
    try {
      await apiFetch(`/api/payroll/${id}`, {
        method: 'DELETE'
      });
      showToast('Payroll record deleted successfully.', 'success');
      
      const startVal = document.getElementById('payStartDate').value;
      const endVal = document.getElementById('payEndDate').value;
      loadPayrollRecords(startVal, endVal);
    } catch (err) {
      console.error('Error deleting payroll:', err);
      showToast(err.message || 'Failed to delete payroll record.', 'error');
    }
  }
}

// Modal bindings
document.getElementById('payslipModalClose').addEventListener('click', () => {
  document.getElementById('payslipModal').classList.remove('open');
});
document.getElementById('btnPayslipClose').addEventListener('click', () => {
  document.getElementById('payslipModal').classList.remove('open');
});
document.getElementById('btnProcessPayment').addEventListener('click', processPayment);

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="btn-link" onclick="this.parentElement.remove()" style="color:white; border:none; background:none; cursor:pointer;">&times;</button>
  `;
  container.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
  setDefaultDates();

  // Load records for default date range
  const startVal = document.getElementById('payStartDate').value;
  const endVal = document.getElementById('payEndDate').value;
  loadPayrollRecords(startVal, endVal);

  document.getElementById('btnCalcPayroll').addEventListener('click', calculatePayroll);

  // Logout handler
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }

  // Reload when language switcher is toggled
  document.addEventListener('languageChanged', () => {
    const start = document.getElementById('payStartDate').value;
    const end = document.getElementById('payEndDate').value;
    loadPayrollRecords(start, end);
  });
});
