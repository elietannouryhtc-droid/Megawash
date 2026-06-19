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
    
    return `
      <tr>
        <td>${formattedTime}</td>
        <td><span class="badge badge-info" style="font-weight: 500;">${escapeHtml(log.action)}</span></td>
        <td><strong>${escapeHtml(username)}</strong></td>
        <td style="white-space: normal; min-width: 250px;">${escapeHtml(log.details || '')}</td>
        <td><code>${escapeHtml(log.target || 'N/A')}</code></td>
      </tr>
    `;
  }).join('');
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

// Clear Audit Logs (Disabled for DB security compliance)
document.getElementById('btnClearAuditLogs').addEventListener('click', () => {
  showToast('Compliance Notice: Database audit logs cannot be deleted or cleared.', 'error');
});

// Sidebar Mobile Toggle
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
