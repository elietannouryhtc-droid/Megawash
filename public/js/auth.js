// Authentication & API helpers for Car Wash Portal

const AUTH_KEY = 'carwash_jwt';
const USER_KEY = 'carwash_user';

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
      throw new Error(errData.message || 'Login failed');
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

  if (requiredRole && user.role !== requiredRole) {
    console.error('Unauthorized access. Redirecting...');
    redirectByRole(user.role);
  }
}

function redirectByRole(role) {
  if (role === 'admin') {
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
      throw new Error(errData.message || 'API request failed');
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
    checkPageProtection('admin');
  } else if (path.includes('/employee/')) {
    checkPageProtection('employee');
  } else if (path.endsWith('index.html') || path === '/') {
    checkPageProtection();
  }
});
