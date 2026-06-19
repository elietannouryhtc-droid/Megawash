// Employee Keypad Attendance Script

let pinBuffer = [];
let attendanceMode = 'IN'; // 'IN' or 'OUT'

// Initialize local databases for mock demonstration
function initMockDB() {
  if (!localStorage.getItem('carwash_mock_employees')) {
    localStorage.setItem('carwash_mock_employees', JSON.stringify([
      { id: '1', name: 'John Doe', pin: '1234', role: 'employee', rate: 16.50, active: true },
      { id: '2', name: 'Marie Dupont', pin: '5678', role: 'employee', rate: 18.00, active: true },
      { id: '3', name: 'Alex Johnson', pin: '4321', role: 'employee', rate: 15.75, active: true },
      { id: '4', name: 'Boss Admin', pin: '9999', role: 'admin', rate: 25.00, active: true }
    ]));
  }
  if (!localStorage.getItem('carwash_mock_attendance')) {
    localStorage.setItem('carwash_mock_attendance', JSON.stringify([
      { employeeId: '1', employeeName: 'John Doe', checkInTime: new Date(new Date().setHours(8, 0, 0)).toISOString() }
    ]));
  }
  if (!localStorage.getItem('carwash_mock_shifts')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    localStorage.setItem('carwash_mock_shifts', JSON.stringify([
      { id: '101', employeeId: '2', employeeName: 'Marie Dupont', checkIn: new Date(yesterday.setHours(9,0,0)).toISOString(), checkOut: new Date(yesterday.setHours(17,30,0)).toISOString(), hours: 8.5, status: 'approved', rate: 18.00, gross: 153.00 },
      { id: '102', employeeId: '3', employeeName: 'Alex Johnson', checkIn: new Date(yesterday.setHours(8,30,0)).toISOString(), checkOut: new Date(yesterday.setHours(15,30,0)).toISOString(), hours: 7.0, status: 'pending', rate: 15.75, gross: 110.25 }
    ]));
  }
  if (!localStorage.getItem('carwash_mock_advances')) {
    localStorage.setItem('carwash_mock_advances', JSON.stringify([
      { id: '201', employeeId: '1', employeeName: 'John Doe', date: new Date().toISOString(), amount: 50.00, reason: 'Gas money', status: 'pending' },
      { id: '202', employeeId: '2', employeeName: 'Marie Dupont', date: new Date(new Date().setDate(new Date().getDate() - 3)).toISOString(), amount: 100.00, reason: 'Groceries', status: 'approved' }
    ]));
  }
  if (!localStorage.getItem('carwash_mock_settings')) {
    localStorage.setItem('carwash_mock_settings', JSON.stringify({
      companyName: 'Elite Car Wash',
      currency: '$',
      overtimeRate: 1.5,
      overtimeThreshold: 40,
      taxRate: 15
    }));
  }
  if (!localStorage.getItem('carwash_mock_audit')) {
    localStorage.setItem('carwash_mock_audit', JSON.stringify([
      { id: '301', action: 'System Setup', user: 'System', details: 'Initial system load', ip: '127.0.0.1', timestamp: new Date().toISOString() }
    ]));
  }
  if (!localStorage.getItem('carwash_mock_today_actions')) {
    localStorage.setItem('carwash_mock_today_actions', JSON.stringify([
      { employeeName: 'John Doe', time: '08:00 AM', status: 'IN' }
    ]));
  }
}

// Live Digital Clock
function updateClock() {
  const clockEl = document.getElementById('liveClock');
  const dateEl = document.getElementById('liveDate');
  if (!clockEl || !dateEl) return;

  const now = new Date();
  
  // Format Time
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  clockEl.textContent = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;

  // Format Date
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  dateEl.textContent = now.toLocaleDateString(document.documentElement.lang === 'fr' ? 'fr-FR' : 'en-US', options);
}

// Render Lists from API
async function loadStatusBoards() {
  try {
    const statusData = await apiFetch('/api/employees/status');
    const recentActions = await apiFetch('/api/checkins/recent-actions');
    
    // Render Active Staff
    const activeListEl = document.getElementById('activeStaffList');
    const activeCountEl = document.getElementById('activeStaffCount');
    
    if (activeListEl) {
      activeCountEl.textContent = statusData.checkedIn.length;
      if (statusData.checkedIn.length === 0) {
        activeListEl.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">No employees currently on shift.</td></tr>`;
      } else {
        activeListEl.innerHTML = statusData.checkedIn.map(s => {
          const checkTime = new Date(s.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `
            <tr>
              <td><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--success); margin-right:8px; box-shadow: 0 0 8px var(--success);"></span>${escapeHtml(s.first_name + ' ' + s.last_name)}</td>
              <td>${checkTime}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // Render Today's Activity Log
    const todayLogsEl = document.getElementById('todayLogsList');
    if (todayLogsEl) {
      if (recentActions.length === 0) {
        todayLogsEl.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No activity recorded today.</td></tr>`;
      } else {
        todayLogsEl.innerHTML = recentActions.map(l => {
          const badgeClass = l.status === 'IN' ? 'badge-success' : 'badge-danger';
          const label = l.status === 'IN' ? t('checkIn') : t('checkOut');
          return `
            <tr>
              <td>${escapeHtml(l.employeeName)}</td>
              <td>${l.time}</td>
              <td><span class="badge ${badgeClass}">${label}</span></td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load status boards from API:', err);
    const activeListEl = document.getElementById('activeStaffList');
    if (activeListEl) {
      activeListEl.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">Failed to load live status from server.</td></tr>`;
    }
  }
}

// Handle Keypad Pin Clicks
function initKeypad() {
  document.querySelectorAll('.digit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (pinBuffer.length < 4) {
        pinBuffer.push(btn.getAttribute('data-digit'));
        updatePinDisplay();
        
        if (pinBuffer.length === 4) {
          setTimeout(submitPin, 250);
        }
      }
    });
  });

  const clearBtn = document.getElementById('btnPinClear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      pinBuffer = [];
      updatePinDisplay();
      clearFeedback();
    });
  }

  const delBtn = document.getElementById('btnPinDel');
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      if (pinBuffer.length > 0) {
        pinBuffer.pop();
        updatePinDisplay();
      }
    });
  }

  // Attendance Mode Toggle Buttons
  const modeIn = document.getElementById('btnModeIn');
  const modeOut = document.getElementById('btnModeOut');

  if (modeIn && modeOut) {
    modeIn.addEventListener('click', () => {
      attendanceMode = 'IN';
      modeIn.classList.add('active-in');
      modeOut.classList.remove('active-out');
      clearFeedback();
    });

    modeOut.addEventListener('click', () => {
      attendanceMode = 'OUT';
      modeOut.classList.add('active-out');
      modeIn.classList.remove('active-in');
      clearFeedback();
    });
  }
}

function updatePinDisplay() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (dot) {
      if (i < pinBuffer.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    }
  }
}

// Process Shift Clocking
async function submitPin() {
  const pin = pinBuffer.join('');
  pinBuffer = [];
  updatePinDisplay();

  try {
    // Send request to actual backend
    const res = await apiFetch('/api/checkins/pin-toggle', {
      method: 'POST',
      body: JSON.stringify({ pin })
    });
    
    const empName = `${res.employee.first_name} ${res.employee.last_name}`;
    const timeStr = new Date(res.status === 'checked_in' ? res.record.check_in : res.record.check_out)
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (res.status === 'checked_in') {
      showFeedback(t('checkInSuccess', { time: timeStr }), 'success', empName);
    } else {
      const hours = res.record.hours_worked || 0;
      showFeedback(t('checkOutSuccess', { time: timeStr, hours: hours }), 'success', empName);
    }

    // Refresh live status boards
    loadStatusBoards();
  } catch (err) {
    console.error('Error submitting PIN:', err);
    showFeedback(err.message || t('pinError'), 'error');
  }
}
}

// Show UI feedback card for 4 seconds
function showFeedback(message, type, employeeName = '') {
  const card = document.getElementById('feedbackCard');
  const icon = document.getElementById('feedbackIcon');
  const title = document.getElementById('feedbackTitle');
  const msg = document.getElementById('feedbackMsg');

  if (!card) return;

  card.className = `status-feedback-card ${type === 'success' ? 'success-card' : 'error-card'}`;
  icon.textContent = type === 'success' ? '✓' : '✗';
  title.textContent = type === 'success' ? (employeeName || t('success')) : t('error');
  msg.textContent = message;

  // Clear feedback after 4s
  setTimeout(clearFeedback, 4000);
}

function clearFeedback() {
  const card = document.getElementById('feedbackCard');
  if (card) card.style.display = 'none';
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Page setup & clock triggers
document.addEventListener('DOMContentLoaded', () => {
  initMockDB();
  
  // Show back to admin button if admin token exists
  const currentUser = getCurrentUser();
  if (currentUser) {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.style.display = 'block';

    if (currentUser.role === 'admin') {
      const backBtn = document.getElementById('adminPortalBack');
      if (backBtn) backBtn.style.display = 'block';
    }
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logout();
    });
  }

  // Set up live clock
  updateClock();
  setInterval(updateClock, 1000);

  // Set up keypad and live panels
  initKeypad();
  loadStatusBoards();

  // Reload boards if user toggles language
  document.addEventListener('languageChanged', () => {
    loadStatusBoards();
    updateClock();
  });
});
