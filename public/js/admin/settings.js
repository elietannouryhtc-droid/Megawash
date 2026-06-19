// Admin Settings Controller

let currentSettings = {};

async function loadSettings() {
  try {
    const settings = await apiFetch('/api/settings');
    currentSettings = {};
    settings.forEach(s => {
      currentSettings[s.key] = s.value;
    });

    document.getElementById('setCompanyName').value = currentSettings.company_name || '';
    document.getElementById('setCurrencySymbol').value = currentSettings.currency || '';
    document.getElementById('setTaxRateVal').value = currentSettings.tax_rate !== undefined && currentSettings.tax_rate !== null ? currentSettings.tax_rate : '';
    document.getElementById('setOvertimeRateVal').value = currentSettings.overtime_rate_multiplier !== undefined && currentSettings.overtime_rate_multiplier !== null ? currentSettings.overtime_rate_multiplier : '';
    document.getElementById('setOvertimeThresholdVal').value = currentSettings.overtime_weekly_threshold !== undefined && currentSettings.overtime_weekly_threshold !== null ? currentSettings.overtime_weekly_threshold : '';
  } catch (err) {
    console.error('Failed to load settings:', err);
    showToast('Failed to retrieve settings from server.', 'error');
  }
}

// Save Settings Form Submit
document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const companyName = document.getElementById('setCompanyName').value.trim();
  const currency = document.getElementById('setCurrencySymbol').value.trim();
  const taxRate = document.getElementById('setTaxRateVal').value;
  const overtimeRate = document.getElementById('setOvertimeRateVal').value;
  const overtimeThreshold = document.getElementById('setOvertimeThresholdVal').value;

  try {
    // Run PUT requests for each updated setting in parallel
    await Promise.all([
      apiFetch('/api/settings/company_name', {
        method: 'PUT',
        body: JSON.stringify({ value: companyName })
      }),
      apiFetch('/api/settings/currency', {
        method: 'PUT',
        body: JSON.stringify({ value: currency })
      }),
      apiFetch('/api/settings/tax_rate', {
        method: 'PUT',
        body: JSON.stringify({ value: taxRate })
      }),
      apiFetch('/api/settings/overtime_rate_multiplier', {
        method: 'PUT',
        body: JSON.stringify({ value: overtimeRate })
      }),
      apiFetch('/api/settings/overtime_weekly_threshold', {
        method: 'PUT',
        body: JSON.stringify({ value: overtimeThreshold })
      })
    ]);

    showToast('System settings saved successfully.', 'success');
    loadSettings();
  } catch (err) {
    console.error('Error saving settings:', err);
    showToast(err.message || 'Failed to save system settings.', 'error');
  }
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

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  loadSettings();

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
    loadSettings();
  });
});
