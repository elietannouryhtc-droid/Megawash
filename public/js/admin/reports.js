// Admin Reports Controller

let filteredShifts = [];
let filteredAdvances = [];

function setDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(1); // Default to start of current month

  document.getElementById('repStartDate').value = start.toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });
  document.getElementById('repEndDate').value = end.toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });
}

async function generateReport() {
  const startVal = document.getElementById('repStartDate').value;
  const endVal = document.getElementById('repEndDate').value;

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
    const tbody = document.getElementById('reportTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);" data-i18n="loading">Generating report...</td></tr>`;
    }

    // 1. Fetch checkins (completed only)
    // Send start and end query filters to checkins API
    const startIso = new Date(`${startVal}T00:00:00`).toISOString();
    const endIso = new Date(`${endVal}T23:59:59`).toISOString();
    const checkins = await apiFetch(`/api/checkins?start_date=${startIso}&end_date=${endIso}&status=checked_out`);

    // 2. Fetch advances in range
    const advances = await apiFetch(`/api/advances?start_date=${startVal}&end_date=${endVal}`);

    filteredShifts = checkins;
    filteredAdvances = advances.filter(a => a.status === 'approved' || a.status === 'deducted');

    // 3. Fetch settings to get currency symbol
    let currencySymbol = '$';
    try {
      const settings = await apiFetch('/api/settings');
      const currencySetting = settings.find(s => s.key === 'currency');
      if (currencySetting) currencySymbol = currencySetting.value;
    } catch (e) {
      console.warn('Failed to load settings, using default:', e);
    }

    // Calculations
    const shiftsCount = filteredShifts.length;
    const totalHours = filteredShifts.reduce((acc, s) => acc + parseFloat(s.hours_worked || 0), 0);
    const totalGross = filteredShifts.reduce((acc, s) => acc + parseFloat(s.hours_worked || 0) * parseFloat(s.hourly_rate || 0), 0);
    const totalAdvances = filteredAdvances.reduce((acc, a) => acc + parseFloat(a.amount || 0), 0);

    // Set card contents
    document.getElementById('repShiftsCount').textContent = shiftsCount;
    document.getElementById('repTotalHoursVal').textContent = `${totalHours.toFixed(1)} hrs`;
    document.getElementById('repTotalPayrollVal').textContent = `${currencySymbol}${totalGross.toFixed(2)}`;
    document.getElementById('repTotalAdvancesVal').textContent = `${currencySymbol}${totalAdvances.toFixed(2)}`;

    // Set date title
    document.getElementById('reportRangeTitle').textContent = `Activity Report: ${startVal} to ${endVal}`;

    // Render report details
    if (tbody) {
      if (filteredShifts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No records found in range.</td></tr>`;
      } else {
        // Sort chronologically
        filteredShifts.sort((a, b) => new Date(a.check_in) - new Date(b.check_in));
        tbody.innerHTML = filteredShifts.map(s => {
          const dateStr = new Date(s.check_in).toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });
          const hours = parseFloat(s.hours_worked || 0).toFixed(2);
          const rate = parseFloat(s.hourly_rate || 0);
          const grossStr = `${currencySymbol}${parseFloat(hours * rate).toFixed(2)}`;
          
          return `
            <tr>
              <td>${dateStr}</td>
              <td><strong>${escapeHtml(s.first_name + ' ' + s.last_name)}</strong></td>
              <td>${hours} hrs</td>
              <td>${grossStr}</td>
              <td><span class="badge badge-success">Completed</span></td>
            </tr>
          `;
        }).join('');
      }
    }

    // Toggle Display Panels
    document.getElementById('reportPlaceholder').style.display = 'none';
    document.getElementById('reportContent').style.display = 'block';
  } catch (err) {
    console.error('Error generating report:', err);
    showToast('Failed to compile report data.', 'error');
  }
}

// Download PDF (Timesheet)
function downloadTimesheetPDF() {
  const startVal = document.getElementById('repStartDate').value;
  const endVal = document.getElementById('repEndDate').value;
  if (!startVal || !endVal) return showToast('Please select dates.', 'error');
  window.open(`/api/reports/timesheets?start_date=${startVal}&end_date=${endVal}&format=pdf`);
}

// Download Excel (Timesheet)
function downloadTimesheetExcel() {
  const startVal = document.getElementById('repStartDate').value;
  const endVal = document.getElementById('repEndDate').value;
  if (!startVal || !endVal) return showToast('Please select dates.', 'error');
  window.open(`/api/reports/timesheets?start_date=${startVal}&end_date=${endVal}&format=excel`);
}

// Download Payroll PDF
function downloadPayrollPDF() {
  const startVal = document.getElementById('repStartDate').value;
  const endVal = document.getElementById('repEndDate').value;
  if (!startVal || !endVal) return showToast('Please select dates.', 'error');
  window.open(`/api/reports/payroll?start_date=${startVal}&end_date=${endVal}&format=pdf`);
}

// Download Payroll Excel
function downloadPayrollExcel() {
  const startVal = document.getElementById('repStartDate').value;
  const endVal = document.getElementById('repEndDate').value;
  if (!startVal || !endVal) return showToast('Please select dates.', 'error');
  window.open(`/api/reports/payroll?start_date=${startVal}&end_date=${endVal}&format=excel`);
}

// Print Handler
function triggerPrint() {
  window.print();
}

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

  document.getElementById('btnGenReport').addEventListener('click', generateReport);
  document.getElementById('btnPrintReport').addEventListener('click', triggerPrint);

  // Bind new export buttons
  const btnTsPdf = document.getElementById('btnExportTsPdf');
  if (btnTsPdf) btnTsPdf.addEventListener('click', downloadTimesheetPDF);
  
  const btnTsExcel = document.getElementById('btnExportTsExcel');
  if (btnTsExcel) btnTsExcel.addEventListener('click', downloadTimesheetExcel);

  const btnPrPdf = document.getElementById('btnExportPrPdf');
  if (btnPrPdf) btnPrPdf.addEventListener('click', downloadPayrollPDF);

  const btnPrExcel = document.getElementById('btnExportPrExcel');
  if (btnPrExcel) btnPrExcel.addEventListener('click', downloadPayrollExcel);

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
    if (document.getElementById('reportContent').style.display === 'block') {
      generateReport();
    }
  });
});
