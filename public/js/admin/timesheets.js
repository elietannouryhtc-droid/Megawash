// Admin Timesheets Controller

let allShifts = [];
let allEmployees = [];
const modal = document.getElementById('shiftModal');
const shiftForm = document.getElementById('shiftForm');

async function initPage() {
  try {
    allEmployees = await apiFetch('/api/employees');
    
    // Populate Employee Filters and Form Selection
    const filterEmpSelect = document.getElementById('filterEmp');
    const shiftEmpSelect = document.getElementById('shiftEmployeeId');
    
    if (filterEmpSelect && shiftEmpSelect) {
      filterEmpSelect.innerHTML = '<option value="all">-- All Employees --</option>';
      shiftEmpSelect.innerHTML = '';

      allEmployees.forEach(emp => {
        const fullName = `${emp.first_name} ${emp.last_name}`;
        const optionHtml = `<option value="${emp.id}">${escapeHtml(fullName)}</option>`;
        filterEmpSelect.insertAdjacentHTML('beforeend', optionHtml);
        shiftEmpSelect.insertAdjacentHTML('beforeend', optionHtml);
      });
    }

    loadTimesheets();
  } catch (err) {
    console.error('Failed to load page data:', err);
    showToast('Failed to load employees list.', 'error');
  }
}

async function loadTimesheets() {
  try {
    tbody = document.getElementById('timesheetsTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);" data-i18n="loading">Loading...</td></tr>`;
    }

    // Call API to fetch check-ins
    // We can filter on client side for simple UI, or send query params
    allShifts = await apiFetch('/api/checkins');
    applyFilters();
  } catch (err) {
    console.error('Failed to load timesheet check-ins:', err);
    showToast('Failed to load check-in records from server.', 'error');
  }
}

function applyFilters() {
  const empVal = document.getElementById('filterEmp').value;
  const dateVal = document.getElementById('filterDateInput').value;

  let filtered = [...allShifts];

  if (empVal !== 'all') {
    filtered = filtered.filter(s => s.employee_id.toString() === empVal.toString());
  }

  if (dateVal) {
    filtered = filtered.filter(s => {
      // Local time split
      const shiftDate = new Date(s.check_in).toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });
      return shiftDate === dateVal;
    });
  }

  renderTimesheetsTable(filtered);
}

function renderTimesheetsTable(list) {
  const tbody = document.getElementById('timesheetsTableBody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted);">
          No timesheet entries found.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map(shift => {
    const checkInStr = formatDateTime(shift.check_in);
    const checkOutStr = shift.check_out ? formatDateTime(shift.check_out) : '---';
    const hours = shift.hours_worked ? parseFloat(shift.hours_worked).toFixed(2) + ' hrs' : '---';
    
    const isToday = new Date(shift.check_in).toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' }) === new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });
    
    let statusBadge = '';
    let actionButtons = '';

    if (shift.status === 'checked_out') {
      statusBadge = `<span class="badge badge-success">Completed</span>`;
    } else {
      if (isToday) {
        statusBadge = `<span class="badge badge-primary">On Duty</span>`;
      } else {
        // Checked in on a previous day and never checked out
        statusBadge = `<span class="badge badge-danger">Incomplete</span>`;
      }
    }

    const fullName = `${shift.first_name} ${shift.last_name}`;

    return `
      <tr>
        <td><strong>${escapeHtml(fullName)}</strong></td>
        <td>${checkInStr}</td>
        <td>${checkOutStr}</td>
        <td>${hours}</td>
        <td>${statusBadge}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm edit-btn" data-id="${shift.id}" style="margin-right: 5px;">${t('edit')}</button>
          <button class="btn btn-danger btn-sm delete-btn" data-id="${shift.id}">${t('delete')}</button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach button event listeners
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openEditModal(id);
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      deleteShift(id);
    });
  });
}

// Add Manual Shift Modal Trigger
document.getElementById('btnAddShift').addEventListener('click', () => {
  document.getElementById('shiftModalTitle').textContent = 'Add Missed Shift';
  document.getElementById('shiftId').value = '';
  document.getElementById('empSelectGroup').style.display = 'block';
  shiftForm.reset();
  
  // Set default times to today
  const now = new Date();
  const todayStr = now.toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Toronto' }).substring(0, 5);
  
  document.getElementById('shiftCheckInDate').value = todayStr;
  document.getElementById('shiftCheckInTime').value = '08:00';
  document.getElementById('shiftCheckOutDate').value = todayStr;
  document.getElementById('shiftCheckOutTime').value = '17:00';
  document.getElementById('shiftNotes').value = '';
  
  modal.classList.add('open');
});

document.getElementById('shiftModalClose').addEventListener('click', closeShiftModal);
document.getElementById('btnShiftCancel').addEventListener('click', closeShiftModal);

function closeShiftModal() {
  modal.classList.remove('open');
  shiftForm.reset();
}

function openEditModal(id) {
  const shift = allShifts.find(s => s.id.toString() === id.toString());
  if (!shift) return;

  document.getElementById('shiftModalTitle').textContent = t('editShift');
  document.getElementById('shiftId').value = shift.id;
  
  // Hide employee selector on edit to prevent shifting to someone else by mistake
  document.getElementById('empSelectGroup').style.display = 'none';
  
  // Fill values in Toronto timezone
  const inDate = new Date(shift.check_in);
  const inDateStr = inDate.toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });
  const inTimeStr = inDate.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Toronto' }).substring(0, 5);
  
  document.getElementById('shiftCheckInDate').value = inDateStr;
  document.getElementById('shiftCheckInTime').value = inTimeStr;

  if (shift.check_out) {
    const outDate = new Date(shift.check_out);
    const outDateStr = outDate.toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });
    const outTimeStr = outDate.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Toronto' }).substring(0, 5);
    
    document.getElementById('shiftCheckOutDate').value = outDateStr;
    document.getElementById('shiftCheckOutTime').value = outTimeStr;
  } else {
    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Toronto' }).substring(0, 5);
    document.getElementById('shiftCheckOutDate').value = todayStr;
    document.getElementById('shiftCheckOutTime').value = timeStr;
  }

  document.getElementById('shiftNotes').value = shift.notes || '';
  modal.classList.add('open');
}

// Form Submit (Manual Save/Update)
shiftForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('shiftId').value;
  const inDateVal = document.getElementById('shiftCheckInDate').value;
  const inTimeVal = document.getElementById('shiftCheckInTime').value;
  const outDateVal = document.getElementById('shiftCheckOutDate').value;
  const outTimeVal = document.getElementById('shiftCheckOutTime').value;
  const notes = document.getElementById('shiftNotes').value.trim();

  // Parse check-in and check-out to Date objects in Toronto local timezone
  // Swedish format 'YYYY-MM-DD' is perfect for parsing along with 'HH:MM'
  const checkInDate = new Date(`${inDateVal}T${inTimeVal}:00`);
  const checkOutDate = new Date(`${outDateVal}T${outTimeVal}:00`);

  if (checkOutDate < checkInDate) {
    showToast('Check-out time cannot be before check-in time!', 'error');
    return;
  }

  try {
    if (id) {
      // Edit existing checkin record
      await apiFetch(`/api/checkins/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          check_in: checkInDate.toISOString(),
          check_out: checkOutDate.toISOString(),
          notes
        })
      });
      showToast('Timesheet record updated successfully.', 'success');
    } else {
      // Creating manual shift entry
      const employee_id = document.getElementById('shiftEmployeeId').value;
      if (!employee_id) {
        showToast('Please select a valid employee.', 'error');
        return;
      }

      await apiFetch('/api/checkins', {
        method: 'POST',
        body: JSON.stringify({
          employee_id,
          check_in: checkInDate.toISOString(),
          check_out: checkOutDate.toISOString(),
          notes
        })
      });
      showToast('Timesheet record manually created.', 'success');
    }

    closeShiftModal();
    loadTimesheets();
  } catch (err) {
    console.error('Error saving shift record:', err);
    showToast(err.message || 'Failed to save shift record.', 'error');
  }
});

// Delete Shift Record
async function deleteShift(id) {
  if (confirm('Are you sure you want to delete this check-in record?')) {
    try {
      await apiFetch(`/api/checkins/${id}`, {
        method: 'DELETE'
      });
      showToast('Record deleted successfully.', 'success');
      loadTimesheets();
    } catch (err) {
      console.error('Error deleting shift record:', err);
      showToast(err.message || 'Failed to delete record.', 'error');
    }
  }
}

// Event filters bindings
document.getElementById('filterEmp').addEventListener('change', applyFilters);
document.getElementById('filterDateInput').addEventListener('change', applyFilters);
document.getElementById('btnResetFilters').addEventListener('click', () => {
  document.getElementById('filterEmp').value = 'all';
  document.getElementById('filterDateInput').value = '';
  applyFilters();
});

// Sidebar drawer toggle
function initSidebarToggle() {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('adminSidebar');
  
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuToggle) {
        sidebar.classList.remove('open');
      }
    });
  }
}

function formatDateTime(isoString) {
  if (!isoString) return '---';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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
  initSidebarToggle();
  initPage();

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
    initPage();
  });
});
