// Authentication & API helpers for Car Wash Portal

const AUTH_KEY = 'carwash_jwt';
const USER_KEY = 'carwash_user';

// Immediately apply saved theme on load to prevent visual flash
(function() {
  const theme = localStorage.getItem('mw_theme') || 'dark';
  if (theme === 'light') {
    document.body.classList.add('light-mode');
    document.documentElement.classList.add('light-mode');
  }
})();

// Helper to decode JWT token payload without external libraries
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Check if user is logged in
function isLoggedIn() {
  return !!localStorage.getItem(AUTH_KEY);
}

// Get the stored token
function getToken() {
  return localStorage.getItem(AUTH_KEY);
}

// Get current user details
function getCurrentUser() {
  const userStr = localStorage.getItem(USER_KEY);
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (e) {
      return null;
    }
  }
  return null;
}

// Perform login request
async function login(username, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem(AUTH_KEY, data.token);
      
      const claims = parseJwt(data.token) || { role: data.role || 'admin', username: data.username || username };
      localStorage.setItem(USER_KEY, JSON.stringify(claims));
      return { success: true, user: claims };
    } else {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || 'Login failed');
    }
  } catch (err) {
    console.warn('Backend connection failed, falling back to mock authentication for demo:', err.message);
    
    // Mock authentication fallback for demonstration/development
    if (username.toLowerCase() === 'admin' && password === 'admin') {
      const mockToken = 'mock_jwt_header.' + btoa(JSON.stringify({ role: 'admin', username: 'admin', name: 'System Administrator' })) + '.mock_signature';
      localStorage.setItem(AUTH_KEY, mockToken);
      localStorage.setItem(USER_KEY, JSON.stringify({ role: 'admin', username: 'admin', name: 'System Administrator' }));
      return { success: true, user: { role: 'admin', username: 'admin' } };
    } else if (username.toLowerCase() === 'employee' && password === 'employee') {
      const mockToken = 'mock_jwt_header.' + btoa(JSON.stringify({ role: 'employee', username: 'employee', name: 'Test Employee' })) + '.mock_signature';
      localStorage.setItem(AUTH_KEY, mockToken);
      localStorage.setItem(USER_KEY, JSON.stringify({ role: 'employee', username: 'employee', name: 'Test Employee' }));
      return { success: true, user: { role: 'employee', username: 'employee' } };
    }
    
    throw new Error('Invalid credentials');
  }
}

// Logout
function logout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = '/index.html';
}

// Secure page routing
function checkPageProtection(requiredRole = null) {
  const currentPath = window.location.pathname;
  
  // Skip check on the login page itself to prevent redirect loops
  if (currentPath === '/' || currentPath.endsWith('index.html')) {
    if (isLoggedIn()) {
      const user = getCurrentUser();
      if (user) {
        redirectByRole(user.role);
      }
    }
    return;
  }

  if (!isLoggedIn()) {
    window.location.href = '/index.html';
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    logout();
    return;
  }

  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowedRoles.includes(user.role)) {
      console.error('Unauthorized access. Redirecting...');
      redirectByRole(user.role);
    }
  }
}

function redirectByRole(role) {
  if (role === 'admin' || role === 'manager') {
    window.location.href = '/admin/dashboard.html';
  } else {
    window.location.href = '/employee/keypad.html';
  }
}

// Base fetch wrapper to automatically include JWT header
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    if (response.status === 401) {
      logout();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || 'API request failed');
    }

    return await response.json();
  } catch (error) {
    console.error(`API Fetch failed for ${endpoint}:`, error);
    throw error;
  }
}

// Run auth check automatically if checkPageProtection is script-loaded
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.includes('/admin/')) {
    if (path.includes('settings.html')) {
      checkPageProtection('admin');
    } else {
      checkPageProtection(['admin', 'manager']);
    }
  } else if (path.includes('/employee/')) {
    checkPageProtection('employee');
  } else if (path.endsWith('index.html') || path === '/') {
    checkPageProtection();
  }

  // Inject Mobile Sidebar Toggling & Backdrop dynamically for all admin pages
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('adminSidebar');
  if (menuToggle && sidebar) {
    let backdrop = document.getElementById('adminSidebarBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'adminSidebarBackdrop';
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = sidebar.classList.toggle('open');
      backdrop.classList.toggle('active', isOpen);
    });

    const closeSidebar = () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
    };

    backdrop.addEventListener('click', closeSidebar);
    
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuToggle) {
        closeSidebar();
      }
    });
  }

  // Inject Theme Toggle Button next to language toggle
  const langToggle = document.getElementById('languageToggle');
  if (langToggle) {
    const theme = localStorage.getItem('mw_theme') || 'dark';
    const themeBtn = document.createElement('button');
    themeBtn.className = 'lang-toggle-btn';
    themeBtn.id = 'themeToggle';
    themeBtn.innerHTML = theme === 'light' ? '🌙' : '☀️';
    themeBtn.style.marginRight = '8px';
    themeBtn.title = theme === 'light' ? 'Dark Mode' : 'Light Mode';
    
    themeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isLight = document.body.classList.toggle('light-mode');
      document.documentElement.classList.toggle('light-mode', isLight);
      const newTheme = isLight ? 'light' : 'dark';
      localStorage.setItem('mw_theme', newTheme);
      themeBtn.innerHTML = isLight ? '🌙' : '☀️';
      themeBtn.title = isLight ? 'Dark Mode' : 'Light Mode';
    });
    
    langToggle.parentNode.insertBefore(themeBtn, langToggle);
  }

  // Inject Users tab into desktop sidebar dynamically (Only visible to Admin)
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.role === 'admin') {
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (sidebarNav && !document.getElementById('nav-users')) {
      const li = document.createElement('li');
      li.innerHTML = `
        <a href="users.html" class="sidebar-link" id="nav-users">
          <span data-i18n="navUsers">User Accounts</span>
        </a>
      `;
      const settingsLink = document.getElementById('nav-set');
      if (settingsLink && settingsLink.parentNode) {
        sidebarNav.insertBefore(li, settingsLink.parentNode);
      } else {
        sidebarNav.appendChild(li);
      }
    }
  }

  // Highlight Users in desktop sidebar if viewing users.html
  if (window.location.pathname.includes('users.html')) {
    const link = document.getElementById('nav-users');
    if (link) link.classList.add('active');
  }

  // Register Service Worker for PWA offline support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('Service Worker: Registered successfully.'))
      .catch(err => console.error('Service Worker: Registration failed:', err));
  }

  // Inject PWA mobile web app capability meta tags dynamically
  injectPWAMeta();

  // Inject Mobile Bottom Navigation
  injectMobileNav();
});

// Helper function to inject mobile bottom nav bar & drawer sheet dynamically
function injectMobileNav() {
  const path = window.location.pathname;
  if (!path.includes('/admin/')) return;

  // 1. Create and inject the mobile bottom nav bar
  const nav = document.createElement('nav');
  nav.className = 'mobile-bottom-nav';
  nav.innerHTML = `
    <a href="dashboard.html" class="mobile-nav-item" id="mobile-nav-dash">
      <span class="icon">📊</span>
      <span data-i18n="navDashboard">Dashboard</span>
    </a>
    <a href="employees.html" class="mobile-nav-item" id="mobile-nav-emp">
      <span class="icon">👤</span>
      <span data-i18n="navEmployees">Employees</span>
    </a>
    <a href="timesheets.html" class="mobile-nav-item" id="mobile-nav-time">
      <span class="icon">📅</span>
      <span data-i18n="navTimesheets">Timesheets</span>
    </a>
    <a href="payroll.html" class="mobile-nav-item" id="mobile-nav-pay">
      <span class="icon">💵</span>
      <span data-i18n="navPayroll">Payroll</span>
    </a>
    <a href="#" class="mobile-nav-item" id="mobile-nav-more">
      <span class="icon">•••</span>
      <span data-i18n="navMore">More</span>
    </a>
  `;
  document.body.appendChild(nav);

  // 2. Create and inject the more menu drawer
  let backdrop = document.getElementById('moreMenuBackdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'moreMenuBackdrop';
    backdrop.className = 'drawer-backdrop';
    document.body.appendChild(backdrop);
  }

  let drawer = document.getElementById('moreMenuDrawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'moreMenuDrawer';
    drawer.className = 'more-menu-drawer';
    
    const user = getCurrentUser();
    const isAdmin = user && user.role === 'admin';

    drawer.innerHTML = `
      <div class="drawer-drag-indicator"></div>
      <div class="drawer-grid">
        <a href="advances.html" class="drawer-item" id="drawer-nav-adv">
          <span class="icon">💸</span>
          <span data-i18n="navAdvances">Advances</span>
        </a>
        <a href="reports.html" class="drawer-item" id="drawer-nav-rep">
          <span class="icon">📈</span>
          <span data-i18n="navReports">Reports</span>
        </a>
        <a href="audit.html" class="drawer-item" id="drawer-nav-audit">
          <span class="icon">📋</span>
          <span data-i18n="navAudit">Audit Logs</span>
        </a>
        ${isAdmin ? `
        <a href="users.html" class="drawer-item" id="drawer-nav-users">
          <span class="icon">👥</span>
          <span data-i18n="navUsers">User Accounts</span>
        </a>
        ` : ''}
        <a href="settings.html" class="drawer-item" id="drawer-nav-set">
          <span class="icon">⚙️</span>
          <span data-i18n="navSettings">Settings</span>
        </a>
        <a href="#" class="drawer-item" id="drawer-logout">
          <span class="icon" style="color: var(--danger);">🚪</span>
          <span data-i18n="logout">Logout</span>
        </a>
      </div>
    `;
    document.body.appendChild(drawer);
  }

  // 3. Highlight the active nav item
  if (path.includes('dashboard.html')) {
    document.getElementById('mobile-nav-dash').classList.add('active');
  } else if (path.includes('employees.html')) {
    document.getElementById('mobile-nav-emp').classList.add('active');
  } else if (path.includes('timesheets.html')) {
    document.getElementById('mobile-nav-time').classList.add('active');
  } else if (path.includes('payroll.html')) {
    document.getElementById('mobile-nav-pay').classList.add('active');
  } else {
    document.getElementById('mobile-nav-more').classList.add('active');
  }

  // Highlight active drawer item
  if (path.includes('advances.html')) {
    document.getElementById('drawer-nav-adv').style.borderColor = 'var(--primary)';
  } else if (path.includes('reports.html')) {
    document.getElementById('drawer-nav-rep').style.borderColor = 'var(--primary)';
  } else if (path.includes('audit.html')) {
    document.getElementById('drawer-nav-audit').style.borderColor = 'var(--primary)';
  } else if (path.includes('users.html')) {
    const uLink = document.getElementById('drawer-nav-users');
    if (uLink) uLink.style.borderColor = 'var(--primary)';
  } else if (path.includes('settings.html')) {
    document.getElementById('drawer-nav-set').style.borderColor = 'var(--primary)';
  }

  // 4. Add interaction event listeners
  const moreBtn = document.getElementById('mobile-nav-more');
  moreBtn.addEventListener('click', (e) => {
    e.preventDefault();
    drawer.classList.toggle('open');
    backdrop.classList.toggle('active');
  });

  backdrop.addEventListener('click', () => {
    drawer.classList.remove('open');
    backdrop.classList.remove('active');
  });

  const drawerLogout = document.getElementById('drawer-logout');
  if (drawerLogout) {
    drawerLogout.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }

  // If translation library is loaded, run it on the new elements
  if (typeof applyTranslations === 'function') {
    applyTranslations();
  }
}

// Dynamically inject essential PWA meta tags into page headers on load
function injectPWAMeta() {
  // 1. Link Manifest
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.json';
    document.head.appendChild(link);
  }
  // 2. Apple Touch Icon
  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    const link = document.createElement('link');
    link.rel = 'apple-touch-icon';
    link.href = '/logo.png';
    document.head.appendChild(link);
  }
  // 3. Theme Color
  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#0A0A0A';
    document.head.appendChild(meta);
  }
  // 4. Apple Web App Capable
  if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
    const meta = document.createElement('meta');
    meta.name = 'apple-mobile-web-app-capable';
    meta.content = 'yes';
    document.head.appendChild(meta);
  }
  // 5. Apple Status Bar Style
  if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
    const meta = document.createElement('meta');
    meta.name = 'apple-mobile-web-app-status-bar-style';
    meta.content = 'black-translucent';
    document.head.appendChild(meta);
  }
}
