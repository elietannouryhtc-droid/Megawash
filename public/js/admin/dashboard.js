// Admin Dashboard Controller

async function loadDashboardData() {
  try {
    // Fetch stats from server
    const stats = await apiFetch('/api/dashboard/stats');
    
    // 1. On-Duty Employees Count
    document.getElementById('statActive').textContent = stats.activeCount;

    // 2. Worked Hours (Week)
    document.getElementById('statHours').textContent = `${stats.weeklyHours.toFixed(1)} hrs`;

    // 3. Pending Advances
    document.getElementById('statAdvances').textContent = stats.pendingAdvancesCount;

    // 4. Estimated Payroll
    // Let's get the currency symbol from settings or default to $
    let currencySymbol = '$';
    try {
      const settings = await apiFetch('/api/settings');
      const currencySetting = settings.find(s => s.key === 'currency');
      if (currencySetting) currencySymbol = currencySetting.value;
    } catch (e) {
      console.warn('Failed to load settings, using default currency:', e);
    }
    
    document.getElementById('statPayroll').textContent = `${currencySymbol}${stats.estimatedPayroll.toFixed(2)}`;

    // Render On-Duty list
    const activeListEl = document.getElementById('dashActiveList');
    if (activeListEl) {
      if (!stats.checkedInEmployees || stats.checkedInEmployees.length === 0) {
        activeListEl.innerHTML = `
          <tr>
            <td colspan="3" style="text-align: center; color: var(--text-muted);">
              No employees on shift right now.
            </td>
          </tr>`;
      } else {
        activeListEl.innerHTML = stats.checkedInEmployees.map(s => {
          const timeIn = new Date(s.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `
            <tr>
              <td><strong>${escapeHtml(s.first_name + ' ' + s.last_name)}</strong></td>
              <td>${timeIn}</td>
              <td><span class="badge badge-success">On Duty</span></td>
            </tr>
          `;
        }).join('');
      }
    }

    // Render recent audit log actions (limit to 5)
    const activityEl = document.getElementById('dashActivityLog');
    if (activityEl) {
      try {
        const auditLogs = await apiFetch('/api/audit');
        const recentAudits = auditLogs.slice(0, 5);
        if (recentAudits.length === 0) {
          activityEl.innerHTML = `<p style="text-align: center; color: var(--text-muted);">No activity logs.</p>`;
        } else {
          activityEl.innerHTML = recentAudits.map(log => {
            const dateStr = new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
              <div class="audit-entry">
                <div>
                  <div style="font-size:0.875rem; font-weight:600;">${escapeHtml(log.action)}</div>
                  <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(log.details)}</div>
                </div>
                <div style="text-align:right; font-size:0.75rem;">
                  <div>${escapeHtml(log.username || 'System')}</div>
                  <div style="color:var(--text-muted);">${dateStr}</div>
                </div>
              </div>
            `;
          }).join('');
        }
      } catch (err) {
        activityEl.innerHTML = `<p style="text-align: center; color: var(--text-muted);">Failed to load activity logs.</p>`;
      }
    }
  } catch (err) {
    console.error('Error loading dashboard stats:', err);
    document.getElementById('statActive').textContent = 'Error';
    document.getElementById('statHours').textContent = 'Error';
    document.getElementById('statAdvances').textContent = 'Error';
    document.getElementById('statPayroll').textContent = 'Error';
  }
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Mobile sidebar panel toggle
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

// Global setup
document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  loadDashboardData();
  
  // Logout handler
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }

  // Reload when language switch happens
  document.addEventListener('languageChanged', () => {
    loadDashboardData();
  });
});
