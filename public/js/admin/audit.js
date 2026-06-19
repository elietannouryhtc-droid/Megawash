// Admin Audit Logs Controller

let allAudits = [];

async function loadAudits() {
  try {
    tbody = document.getElementById('auditTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);" data-i18n="loading">Loading...</td></tr>`;
    }

    allAudits = await apiFetch('/api/audit');
    renderAuditsTable(allAudits);
  } catch (err) {
    console.error('Failed to load audit logs:', err);
    showToast('Failed to retrieve audit logs.', 'error');
  }
}

function renderAuditsTable(list) {
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted);">
          No audit logs found.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map(log => {
    const formattedTime = formatDateTime(log.created_at);
    const username = log.username || 'System';
    const readableDetails = formatAuditDetails(log.action, log.details);
    
    return `
      <tr>
        <td>${formattedTime}</td>
        <td><span class="badge badge-info" style="font-weight: 500;">${escapeHtml(log.action)}</span></td>
        <td><strong>${escapeHtml(username)}</strong></td>
        <td style="white-space: normal; min-width: 250px;">${escapeHtml(readableDetails || '')}</td>
        <td><code>${escapeHtml(log.target || 'N/A')}</code></td>
      </tr>
    `;
  }).join('');
}

function formatAuditDetails(action, detailsStr) {
  if (!detailsStr) return '';
  if (!detailsStr.trim().startsWith('{') && !detailsStr.trim().startsWith('[')) {
    return detailsStr;
  }
  try {
    const details = JSON.parse(detailsStr);
    const lang = localStorage.getItem('mw_lang') || 'en';
    if (action === 'CHECK_IN') {
      return lang === 'fr' ? `Arrivée : ${details.employee_name || ''}` : `Checked In: ${details.employee_name || ''}`;
    }
    if (action === 'CHECK_OUT') {
      const hrs = details.hours_worked !== undefined ? parseFloat(details.hours_worked).toFixed(2) : '0.00';
      return lang === 'fr' 
        ? `Départ : ${details.employee_name || ''} (Travaillé : ${hrs} h)` 
        : `Checked Out: ${details.employee_name || ''} (Worked: ${hrs} hrs)`;
    }
    if (action === 'LOGIN') return lang === 'fr' ? 'Connexion réussie.' : 'User successfully logged in.';
    if (action === 'LOGOUT') return lang === 'fr' ? 'Déconnexion.' : 'User logged out.';
    if (action === 'UPDATE_SETTING') {
      return lang === 'fr' 
        ? `Modifié de "${details.old_value || ''}" à "${details.new_value || ''}"` 
        : `Changed from "${details.old_value || ''}" to "${details.new_value || ''}"`;
    }
    if (action === 'CREATE_EMPLOYEE') {
      const empName = details.employee ? `${details.employee.first_name} ${details.employee.last_name}` : '';
      return lang === 'fr' ? `Créé l'employé : ${empName}` : `Created employee: ${empName}`;
    }
    if (action === 'GENERATE_PAYROLL') {
      return lang === 'fr' 
        ? `Généré la paie pour ${details.count || 0} employé(s)` 
        : `Generated payroll for ${details.count || 0} employee(s)`;
    }
    return JSON.stringify(details);
  } catch (e) {
    return detailsStr;
  }
}

function formatDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString('en-US', { timeZone: 'America/Toronto' });
}

// Search filtration
document.getElementById('searchAudit').addEventListener('input', (e) => {
  const val = e.target.value.toLowerCase().trim();
  
  const filtered = allAudits.filter(log => {
    const username = (log.username || 'System').toLowerCase();
    return log.action.toLowerCase().includes(val) ||
      username.includes(val) ||
      (log.details && log.details.toLowerCase().includes(val)) ||
      (log.target && log.target.toLowerCase().includes(val));
  });
  
  renderAuditsTable(filtered);
});

// Clear Audit Logs
document.getElementById('btnClearAuditLogs').addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all audit logs? This action cannot be undone.')) {
    try {
      const res = await apiFetch('/api/audit', {
        method: 'DELETE'
      });
      showToast(res.message || 'Audit logs cleared successfully.', 'success');
      loadAudits();
    } catch (err) {
      console.error('Error clearing audit logs:', err);
      showToast(err.message || 'Failed to clear audit logs.', 'error');
    }
  }
});

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
  loadAudits();

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
    loadAudits();
  });
});
