// Admin Salary Advances Controller

let allAdvances = [];
let allEmployees = [];
const modal = document.getElementById('advanceModal');
const advanceForm = document.getElementById('advanceForm');

async function initPage() {
  try {
    allEmployees = await apiFetch('/api/employees');
    
    const empSelect = document.getElementById('advEmployeeId');
    if (empSelect) {
      empSelect.innerHTML = '';
      allEmployees.forEach(emp => {
        const fullName = `${emp.first_name} ${emp.last_name}`;
        empSelect.insertAdjacentHTML('beforeend', `<option value="${emp.id}">${escapeHtml(fullName)}</option>`);
      });
    }

    loadAdvances();
  } catch (err) {
    console.error('Failed to initialize page:', err);
    showToast('Failed to load employees list.', 'error');
  }
}

async function loadAdvances() {
  try {
    tbody = document.getElementById('advancesTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);" data-i18n="loading">Loading...</td></tr>`;
    }

    allAdvances = await apiFetch('/api/advances');
    renderAdvancesTable();
  } catch (err) {
    console.error('Failed to load advances:', err);
    showToast('Failed to retrieve advances from server.', 'error');
  }
}

function renderAdvancesTable() {
  const tbody = document.getElementById('advancesTableBody');
  if (!tbody) return;

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
    if (allAdvances.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted);">
            No salary advance requests recorded.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = allAdvances.map(adv => {
      const formattedDate = new Date(adv.advance_date).toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });
      const amountVal = parseFloat(adv.amount || 0).toFixed(2);
      
      let statusBadge = '';
      let actionButtons = '';

      if (adv.status === 'pending') {
        statusBadge = `<span class="badge badge-warning">${t('pending')}</span>`;
        actionButtons = `
          <button class="btn btn-success btn-sm approve-btn" data-id="${adv.id}" style="margin-right: 5px;">${t('approve')}</button>
          <button class="btn btn-danger btn-sm reject-btn" data-id="${adv.id}" style="margin-right: 5px;">${t('reject')}</button>
        `;
      } else if (adv.status === 'approved') {
        statusBadge = `<span class="badge badge-success">${t('approved')}</span>`;
      } else if (adv.status === 'rejected') {
        statusBadge = `<span class="badge badge-danger">${t('rejected')}</span>`;
      } else if (adv.status === 'deducted') {
        statusBadge = `<span class="badge badge-info">Deducted</span>`;
      }

      const employeeName = `${adv.first_name} ${adv.last_name}`;

      return `
        <tr>
          <td>${formattedDate}</td>
          <td><strong>${escapeHtml(employeeName)}</strong></td>
          <td>${currencySymbol}${amountVal}</td>
          <td>${escapeHtml(adv.notes || '')}</td>
          <td>${statusBadge}</td>
          <td style="text-align: right; white-space: nowrap;">
            ${actionButtons}
            <button class="btn btn-danger btn-sm delete-btn" data-id="${adv.id}">${t('delete')}</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach button click events
    document.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        updateAdvanceStatus(btn.getAttribute('data-id'), 'approved');
      });
    });

    document.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        updateAdvanceStatus(btn.getAttribute('data-id'), 'rejected');
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteAdvance(btn.getAttribute('data-id'));
      });
    });
  }
}

// Action updates: Approve / Reject
async function updateAdvanceStatus(id, newStatus) {
  try {
    await apiFetch(`/api/advances/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
    showToast(`Salary advance request ${newStatus} successfully.`, 'success');
    loadAdvances();
  } catch (err) {
    console.error('Error updating salary advance status:', err);
    showToast(err.message || 'Failed to update salary advance status.', 'error');
  }
}

// Delete Request
async function deleteAdvance(id) {
  if (confirm('Are you sure you want to delete this salary advance request?')) {
    try {
      await apiFetch(`/api/advances/${id}`, {
        method: 'DELETE'
      });
      showToast('Salary advance request deleted successfully.', 'success');
      loadAdvances();
    } catch (err) {
      console.error('Error deleting salary advance:', err);
      showToast(err.message || 'Failed to delete request.', 'error');
    }
  }
}

// Open modal
document.getElementById('btnRecordAdvance').addEventListener('click', () => {
  document.getElementById('advDateInput').value = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });
  document.getElementById('advAmountInput').value = '';
  document.getElementById('advReasonInput').value = '';
  document.getElementById('advStatusSelect').value = 'pending';
  modal.classList.add('open');
});

document.getElementById('advanceModalClose').addEventListener('click', closeAdvanceModal);
document.getElementById('btnAdvanceCancel').addEventListener('click', closeAdvanceModal);

function closeAdvanceModal() {
  modal.classList.remove('open');
  advanceForm.reset();
}

// Form Submit (Record new advance)
advanceForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const employee_id = document.getElementById('advEmployeeId').value;
  const advance_date = document.getElementById('advDateInput').value;
  const amount = parseFloat(document.getElementById('advAmountInput').value);
  const notes = document.getElementById('advReasonInput').value.trim();
  const status = document.getElementById('advStatusSelect').value;

  try {
    await apiFetch('/api/advances', {
      method: 'POST',
      body: JSON.stringify({
        employee_id,
        amount,
        advance_date,
        notes,
        status
      })
    });

    showToast('Salary advance recorded successfully.', 'success');
    closeAdvanceModal();
    loadAdvances();
  } catch (err) {
    console.error('Error saving salary advance:', err);
    showToast(err.message || 'Failed to record salary advance.', 'error');
  }
});

// Sidebar navigation toggle
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
