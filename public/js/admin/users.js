// Admin Users Controller

let allUsers = [];
let allEmployees = [];
const modal = document.getElementById('userModal');
const userForm = document.getElementById('userForm');

async function initPage() {
  try {
    // Load users and employees lists in parallel
    const [users, employees] = await Promise.all([
      apiFetch('/api/users'),
      apiFetch('/api/employees')
    ]);

    allUsers = users;
    allEmployees = employees;

    // Populate Linked Employee select options
    const empSelect = document.getElementById('userEmployeeSelect');
    if (empSelect) {
      empSelect.innerHTML = '<option value="">-- None / Shared --</option>';
      allEmployees.forEach(emp => {
        const fullName = `${emp.first_name} ${emp.last_name}`;
        empSelect.insertAdjacentHTML('beforeend', `<option value="${emp.id}">${escapeHtml(fullName)}</option>`);
      });
    }

    renderUsersTable(allUsers);
  } catch (err) {
    console.error('Failed to initialize page:', err);
    showToast('Failed to load page credentials list.', 'error');
  }
}

function renderUsersTable(list) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted);">
          No user accounts found.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map(u => {
    const createdDate = new Date(u.created_at).toLocaleDateString('sv-SE', { timeZone: 'America/Toronto' });
    const employeeName = u.employee_id ? `${u.first_name} ${u.last_name}` : '-- None --';
    
    // Capitalize role badge
    const roleLabel = u.role.charAt(0).toUpperCase() + u.role.slice(1);
    const badgeClass = u.role === 'admin' ? 'badge-info' : (u.role === 'manager' ? 'badge-success' : 'badge-secondary');

    return `
      <tr>
        <td><strong>${escapeHtml(u.username)}</strong></td>
        <td><span class="badge ${badgeClass}">${roleLabel}</span></td>
        <td>${escapeHtml(employeeName)}</td>
        <td>${createdDate}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm edit-btn" data-id="${u.id}" style="margin-right: 5px;">${t('edit')}</button>
          <button class="btn btn-danger btn-sm delete-btn" data-id="${u.id}">${t('delete')}</button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach button triggers
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openEditModal(btn.getAttribute('data-id'));
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteUser(btn.getAttribute('data-id'));
    });
  });
}

function openCreateModal() {
  document.getElementById('userModalTitle').textContent = t('addUserBtn');
  document.getElementById('userId').value = '';
  document.getElementById('userUsername').value = '';
  document.getElementById('userPassword').value = '';
  document.getElementById('userPassword').required = true;
  document.getElementById('userPasswordHelp').style.display = 'none';
  document.getElementById('userRoleSelect').value = 'manager';
  document.getElementById('userEmployeeSelect').value = '';
  
  modal.classList.add('open');
}

function openEditModal(id) {
  const user = allUsers.find(u => parseInt(u.id) === parseInt(id));
  if (!user) return;

  document.getElementById('userModalTitle').textContent = t('editUserBtn');
  document.getElementById('userId').value = user.id;
  document.getElementById('userUsername').value = user.username;
  document.getElementById('userPassword').value = '';
  document.getElementById('userPassword').required = false;
  document.getElementById('userPasswordHelp').style.display = 'block';
  document.getElementById('userRoleSelect').value = user.role;
  document.getElementById('userEmployeeSelect').value = user.employee_id || '';

  modal.classList.add('open');
}

function closeUserModal() {
  modal.classList.remove('open');
  userForm.reset();
}

// Form Submit Handler (Save or Update user)
userForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('userId').value;
  const username = document.getElementById('userUsername').value.trim();
  const password = document.getElementById('userPassword').value;
  const role = document.getElementById('userRoleSelect').value;
  const employee_id = document.getElementById('userEmployeeSelect').value;

  const payload = {
    username,
    role,
    employee_id: employee_id ? parseInt(employee_id) : null
  };

  // Only include password if provided
  if (password && password.trim() !== '') {
    payload.password = password;
  }

  try {
    if (id) {
      // Edit User
      await apiFetch(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast('User account updated successfully.', 'success');
    } else {
      // Create User
      if (!password) {
        showToast('Password is required for new accounts!', 'error');
        return;
      }
      payload.password = password;
      
      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast('User account created successfully.', 'success');
    }

    closeUserModal();
    initPage();
  } catch (err) {
    console.error('Error saving user account:', err);
    showToast(err.message || 'Failed to save user account.', 'error');
  }
});

// Delete User Account
async function deleteUser(id) {
  const currentUser = getCurrentUser();
  if (currentUser && parseInt(id) === parseInt(currentUser.id)) {
    showToast('Compliance Security: You cannot delete your own active login session account.', 'error');
    return;
  }

  if (confirm(t('confirmUserDelete'))) {
    try {
      await apiFetch(`/api/users/${id}`, {
        method: 'DELETE'
      });
      showToast('User account deleted successfully.', 'success');
      initPage();
    } catch (err) {
      console.error('Error deleting user:', err);
      showToast(err.message || 'Failed to delete user account.', 'error');
    }
  }
}

// Search filtration
document.getElementById('searchUser').addEventListener('input', (e) => {
  const val = e.target.value.toLowerCase().trim();

  const filtered = allUsers.filter(u => {
    const empName = u.employee_id ? `${u.first_name} ${u.last_name}`.toLowerCase() : '';
    return u.username.toLowerCase().includes(val) ||
           u.role.toLowerCase().includes(val) ||
           empName.includes(val);
  });

  renderUsersTable(filtered);
});

// Bind Event Listeners
document.getElementById('btnCreateUser').addEventListener('click', openCreateModal);
document.getElementById('userModalClose').addEventListener('click', closeUserModal);
document.getElementById('btnCancelUser').addEventListener('click', closeUserModal);

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
