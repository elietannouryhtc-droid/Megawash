// Admin Employees Controller

let allEmployees = [];

async function loadEmployees() {
  try {
    allEmployees = await apiFetch('/api/employees');
    renderEmployeesTable(allEmployees);
  } catch (err) {
    console.error('Failed to load employees from API:', err);
    showToast('Failed to load employees from server.', 'error');
  }
}

function renderEmployeesTable(list) {
  const tbody = document.getElementById('employeesTableBody');
  if (!tbody) return;

  // Set loading state
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);" data-i18n="loading">Loading...</td></tr>`;

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
    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted);">
            No employees found.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = list.map(emp => {
      const roleText = emp.role === 'admin' ? t('empRoleAdmin') : t('empRoleEmployee');
      const statusText = emp.status === 'active' ? t('active') : t('inactive');
      const statusClass = emp.status === 'active' ? 'badge-success' : 'badge-danger';
      const fullName = `${emp.first_name} ${emp.last_name}`;
      
      return `
        <tr>
          <td><strong>${escapeHtml(fullName)}</strong></td>
          <td>${roleText}</td>
          <td>${currencySymbol}${parseFloat(emp.hourly_rate || 0).toFixed(2)}</td>
          <td><code>${escapeHtml(emp.pin)}</code></td>
          <td><span class="badge ${statusClass}">${statusText}</span></td>
          <td style="text-align: right; white-space: nowrap;">
            <button class="btn btn-secondary btn-sm edit-btn" data-id="${emp.id}" style="margin-right: 5px;">${t('edit')}</button>
            <button class="btn btn-danger btn-sm delete-btn" data-id="${emp.id}">${t('delete')}</button>
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
        deleteEmployee(id);
      });
    });
  }
}

// Search filter
document.getElementById('searchEmployee').addEventListener('input', (e) => {
  const val = e.target.value.toLowerCase().trim();
  const filtered = allEmployees.filter(emp => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    return fullName.includes(val) || 
      emp.role.toLowerCase().includes(val) ||
      emp.pin.includes(val);
  });
  renderEmployeesTable(filtered);
});

// Modal Actions
const modal = document.getElementById('employeeModal');
const employeeForm = document.getElementById('employeeForm');

document.getElementById('btnAddEmployee').addEventListener('click', () => {
  document.getElementById('modalTitle').textContent = t('addEmpBtn');
  document.getElementById('employeeId').value = '';
  employeeForm.reset();
  modal.classList.add('open');
});

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);

function closeModal() {
  modal.classList.remove('open');
  employeeForm.reset();
}

function openEditModal(id) {
  const emp = allEmployees.find(e => e.id.toString() === id.toString());
  if (!emp) return;

  document.getElementById('modalTitle').textContent = t('editEmpBtn');
  document.getElementById('employeeId').value = emp.id;
  document.getElementById('empName').value = `${emp.first_name} ${emp.last_name}`;
  document.getElementById('empRole').value = emp.role === 'admin' ? 'admin' : 'employee';
  document.getElementById('empRate').value = emp.hourly_rate;
  document.getElementById('empPin').value = emp.pin;
  document.getElementById('empStatus').value = emp.status === 'active' ? "true" : "false";

  modal.classList.add('open');
}

// Form Submission (Add or Edit)
employeeForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('employeeId').value;
  const nameVal = document.getElementById('empName').value.trim();
  const roleVal = document.getElementById('empRole').value;
  const rate = parseFloat(document.getElementById('empRate').value);
  const pin = document.getElementById('empPin').value.trim();
  const active = document.getElementById('empStatus').value === "true";

  // Split nameVal into first_name and last_name
  const nameParts = nameVal.split(/\s+/);
  const first_name = nameParts[0] || '';
  const last_name = nameParts.slice(1).join(' ') || 'User';

  // Map role and status
  const role = roleVal === 'admin' ? 'admin' : 'washer';
  const status = active ? 'active' : 'inactive';

  try {
    if (id) {
      // Edit existing employee
      await apiFetch(`/api/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          first_name,
          last_name,
          role,
          hourly_rate: rate,
          pin,
          status
        })
      });
      showToast('Employee updated successfully.', 'success');
    } else {
      // Add new employee
      await apiFetch('/api/employees', {
        method: 'POST',
        body: JSON.stringify({
          first_name,
          last_name,
          role,
          hourly_rate: rate,
          pin,
          status
        })
      });
      showToast('Employee created successfully.', 'success');
    }
    
    closeModal();
    loadEmployees();
  } catch (err) {
    console.error('Error submitting employee form:', err);
    showToast(err.message || 'Failed to save employee.', 'error');
  }
});

// Delete Employee
async function deleteEmployee(id) {
  const emp = allEmployees.find(e => e.id.toString() === id.toString());
  if (!emp) return;

  const fullName = `${emp.first_name} ${emp.last_name}`;
  if (confirm(`Are you sure you want to delete ${fullName}?`)) {
    try {
      await apiFetch(`/api/employees/${id}`, {
        method: 'DELETE'
      });
      showToast('Employee deleted successfully.', 'success');
      loadEmployees();
    } catch (err) {
      console.error('Error deleting employee:', err);
      showToast(err.message || 'Failed to delete employee.', 'error');
    }
  }
}

// Sidebar toggle for mobile
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
  loadEmployees();

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
    loadEmployees();
  });
});
