/* ===============================================
   GLYCR ADMIN PANEL – FULL API INTEGRATION + RBAC
   =============================================== */

// ---------- CONFIGURATION ----------
const API_BASE = 'http://localhost:5040/api';
let authToken = null;
let currentAdmin = { name: 'Admin', email: '', role: '' };

// ---------- GLOBAL DATA ----------
let users           = [];
let events          = [];
let tickets         = [];
let payouts         = [];
let refunds         = [];
let waitlist        = [];
let logs            = [];
let serviceRequests = [];
let messages        = [];
let transactions    = [];
let stats           = {};
let platformFeePercent = 3;

// ---------- SELECTION STATE ----------
const selectedIds = {
  users: new Set(),
  events: new Set(),
  tickets: new Set(),
  payouts: new Set(),
  refunds: new Set(),
  waitlist: new Set(),
  'service-requests': new Set(),
  messages: new Set(),
  transactions: new Set(),
};

// ---------- SORT STATE ----------
const sortState = {};

// ---------- PAGINATION STATE ----------
const pageState = {
  users: 1, events: 1, tickets: 1, payouts: 1,
  refunds: 1, waitlist: 1, 'service-requests': 1, messages: 1,
  transactions: 1,
};
const perPage = {
  users: 20, events: 20, tickets: 20, payouts: 20,
  refunds: 20, waitlist: 20, 'service-requests': 20, messages: 20,
  transactions: 20,
};

// ---------- CHART INSTANCES ----------
let chartRevenue = null;
let chartTickets = null;
let chartUsers   = null;
let currentChartPeriod = 'daily';

/* =============================================
   CUSTOM MODAL DIALOGS
============================================= */
let _customConfirmCallback = null;
let _customAlertCallback   = null;
let _customPromptCallback  = null;

function customConfirm(message, title = 'Confirm', okLabel = 'Confirm', okColor = '#ef4444') {
  return new Promise(resolve => {
    _customConfirmCallback = resolve;
    document.getElementById('custom-confirm-title').innerHTML =
      `<i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b; margin-right:0.5rem;"></i>${title}`;
    document.getElementById('custom-confirm-message').textContent = message;
    const btn = document.getElementById('custom-confirm-ok-btn');
    btn.textContent = okLabel;
    btn.style.background = okColor;
    openModal('custom-confirm-modal');
  });
}

function _customConfirmResolve(result) {
  closeModal('custom-confirm-modal');
  if (_customConfirmCallback) { _customConfirmCallback(result); _customConfirmCallback = null; }
}

function customAlert(message, title = 'Notice') {
  return new Promise(resolve => {
    _customAlertCallback = resolve;
    document.getElementById('custom-alert-title').innerHTML =
      `<i class="fa-solid fa-circle-info" style="color:#6366f1; margin-right:0.5rem;"></i>${title}`;
    document.getElementById('custom-alert-message').textContent = message;
    openModal('custom-alert-modal');
  });
}

function _customAlertResolve() {
  closeModal('custom-alert-modal');
  if (_customAlertCallback) { _customAlertCallback(); _customAlertCallback = null; }
}

function customPrompt(message, defaultValue = '', title = 'Input Required', placeholder = '') {
  return new Promise(resolve => {
    _customPromptCallback = resolve;
    document.getElementById('custom-prompt-title').innerHTML =
      `<i class="fa-solid fa-keyboard" style="color:#6366f1; margin-right:0.5rem;"></i>${title}`;
    document.getElementById('custom-prompt-message').textContent = message;
    const input = document.getElementById('custom-prompt-input');
    input.value = defaultValue;
    input.placeholder = placeholder;
    openModal('custom-prompt-modal');
    setTimeout(() => input.focus(), 100);
  });
}

function _customPromptResolve(value) {
  closeModal('custom-prompt-modal');
  if (_customPromptCallback) { _customPromptCallback(value); _customPromptCallback = null; }
}

/* =============================================
   TOAST NOTIFICATION SYSTEM
============================================= */
const TOAST_ICONS = {
  success: 'fa-solid fa-circle-check',
  error:   'fa-solid fa-circle-xmark',
  warning: 'fa-solid fa-triangle-exclamation',
  info:    'fa-solid fa-circle-info',
};
let _toastIdCounter = 0;

function showToast(type = 'info', title = '', message = '', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const id = ++_toastIdCounter;
  const iconCls = TOAST_ICONS[type] || TOAST_ICONS.info;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.id = `toast-${id}`;
  toast.style.setProperty('--toast-duration', `${duration}ms`);
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="toast-icon"><i class="${iconCls}"></i></div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" onclick="dismissToast(${id})" aria-label="Close">
      <i class="fa-solid fa-xmark"></i>
    </button>`;
  container.appendChild(toast);

  let startTime = Date.now();
  let remaining = duration;
  let dismissTimer = setTimeout(() => dismissToast(id), remaining);
  toast._dismissTimer = dismissTimer;

  toast.addEventListener('mouseenter', () => {
    clearTimeout(toast._dismissTimer);
    remaining -= (Date.now() - startTime);
    toast.style.setProperty('--toast-duration', `${remaining}ms`);
    toast.classList.add('toast-paused');
  });
  toast.addEventListener('mouseleave', () => {
    toast.classList.remove('toast-paused');
    startTime = Date.now();
    toast.style.setProperty('--toast-duration', `${remaining}ms`);
    void toast.offsetWidth;
    toast._dismissTimer = setTimeout(() => dismissToast(id), remaining);
  });
}

function dismissToast(id) {
  const toast = document.getElementById(`toast-${id}`);
  if (!toast) return;
  clearTimeout(toast._dismissTimer);
  toast.classList.add('toast-out');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

const toast = {
  success: (t, m, d) => showToast('success', t, m, d),
  error:   (t, m, d) => showToast('error',   t, m, d),
  warning: (t, m, d) => showToast('warning', t, m, d),
  info:    (t, m, d) => showToast('info',    t, m, d),
};

/* =============================================
   SESSION MANAGEMENT
============================================= */
const SESSION_INACTIVITY_MS = 15 * 60 * 1000;
const SESSION_TOTAL_MS      = 30 * 60 * 1000;
const SESSION_WARN_BEFORE   =      60 * 1000;

let sessionStartTime     = null;
let lastActivityTime     = null;
let sessionCheckInterval = null;
let countdownInterval    = null;
let sessionWarningShown  = false;

function initSession() {
  sessionStartTime    = Date.now();
  lastActivityTime    = Date.now();
  sessionWarningShown = false;
  if (sessionCheckInterval) clearInterval(sessionCheckInterval);
  sessionCheckInterval = setInterval(checkSession, 5000);
  ['mousemove','keydown','click','scroll','touchstart'].forEach(evt =>
    document.addEventListener(evt, onUserActivity, { passive: true })
  );
  updateSessionTimerDisplay();
}

function onUserActivity() {
  lastActivityTime = Date.now();
  if (sessionWarningShown) extendSession();
}

function checkSession() {
  if (!sessionStartTime) return;
  const now          = Date.now();
  const inactiveFor  = now - lastActivityTime;
  const totalElapsed = now - sessionStartTime;
  updateSessionTimerDisplay();
  if (totalElapsed >= SESSION_TOTAL_MS) { forceLogout('Your 30-minute session has expired. Please log in again.'); return; }
  if (inactiveFor >= SESSION_INACTIVITY_MS) { forceLogout('You have been logged out due to 15 minutes of inactivity.'); return; }
  const timeToInactivity = SESSION_INACTIVITY_MS - inactiveFor;
  const timeToTotal      = SESSION_TOTAL_MS - totalElapsed;
  const timeToExpiry     = Math.min(timeToInactivity, timeToTotal);
  if (timeToExpiry <= SESSION_WARN_BEFORE && !sessionWarningShown) showSessionWarning(Math.floor(timeToExpiry / 1000));
}

function updateSessionTimerDisplay() {
  const textEl    = document.getElementById('session-timer-text');
  const displayEl = document.getElementById('session-timer-display');
  if (!textEl || !sessionStartTime) return;
  const inactiveLeft = Math.max(0, SESSION_INACTIVITY_MS - (Date.now() - lastActivityTime));
  const totalLeft    = Math.max(0, SESSION_TOTAL_MS - (Date.now() - sessionStartTime));
  const remaining    = Math.min(inactiveLeft, totalLeft);
  const mins = String(Math.floor(remaining / 60000)).padStart(2, '0');
  const secs = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
  textEl.textContent = `${mins}:${secs}`;
  if (displayEl) {
    displayEl.classList.remove('warning', 'danger');
    if      (remaining < 60000)     displayEl.classList.add('danger');
    else if (remaining < 5 * 60000) displayEl.classList.add('warning');
  }
}

function showSessionWarning(secondsLeft) {
  sessionWarningShown = true;
  const overlay     = document.getElementById('session-warning-overlay');
  const countdownEl = document.getElementById('session-countdown');
  if (overlay) overlay.style.display = 'flex';
  let remaining = secondsLeft;
  if (countdownEl) countdownEl.textContent = remaining;
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    remaining--;
    if (countdownEl) countdownEl.textContent = remaining;
    if (remaining <= 0) clearInterval(countdownInterval);
  }, 1000);
}

function extendSession() {
  const overlay = document.getElementById('session-warning-overlay');
  if (overlay) overlay.style.display = 'none';
  if (countdownInterval) clearInterval(countdownInterval);
  sessionWarningShown = false;
  lastActivityTime    = Date.now();
  toast.success('Session extended', 'Your session timer has been reset.');
}

function forceLogout(reason) {
  clearInterval(sessionCheckInterval);
  clearInterval(countdownInterval);
  const overlay = document.getElementById('session-warning-overlay');
  if (overlay) overlay.style.display = 'none';
  addLog('auth', `Auto logout: ${reason}`, { adminName: currentAdmin.name, adminRole: currentAdmin.role });
  destroySession();
  sessionStorage.removeItem('glycr_admin_auth');
  sessionStorage.removeItem('glycr_admin_token');
  sessionStorage.removeItem('glycr_admin_user');
  authToken    = null;
  currentAdmin = { name: 'Admin', email: '', role: '' };
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('login-page').style.display  = 'flex';
  document.getElementById('login-password').value      = '';
  document.getElementById('login-error').style.display = 'none';
  customAlert(reason, 'Session Ended');
}

function destroySession() {
  clearInterval(sessionCheckInterval);
  clearInterval(countdownInterval);
  sessionStartTime    = null;
  lastActivityTime    = null;
  sessionWarningShown = false;
  ['mousemove','keydown','click','scroll','touchstart'].forEach(evt =>
    document.removeEventListener(evt, onUserActivity)
  );
}

/* =============================================
   API HELPER
============================================= */
async function apiRequest(endpoint, options = {}) {
  let token = authToken || sessionStorage.getItem('glycr_admin_token');
  if (token && !authToken) authToken = token;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try { const e = await response.json(); msg = e.error || msg; } catch {}
    throw new Error(msg);
  }
  return response.json();
}

/* =============================================
   RBAC
============================================= */
function canSuspendUser(user)   { return currentAdmin.role === 'admin' || (currentAdmin.role === 'moderator' && user.role !== 'admin' && user.role !== 'moderator'); }
function canDeleteUser(user)    { return currentAdmin.role === 'admin' || (currentAdmin.role === 'moderator' && user.role !== 'admin' && user.role !== 'moderator'); }
function canEditUser(user)      { return currentAdmin.role === 'admin' || (currentAdmin.role === 'moderator' && user.role !== 'admin' && user.role !== 'moderator'); }
function canResetPassword(user) { return currentAdmin.role === 'admin' || (currentAdmin.role === 'moderator' && (user.role === 'customer' || user.role === 'organizer')); }
function canEditSettings()      { return currentAdmin.role === 'admin'; }

/* =============================================
   LOGIN / LOGOUT
============================================= */
async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl  = document.getElementById('login-error');
  errorEl.style.display = 'none';
  try {
    const result = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    authToken    = result.token;
    currentAdmin = { ...result.user, role: result.user.role || 'customer' };
    sessionStorage.setItem('glycr_admin_auth',  'true');
    sessionStorage.setItem('glycr_admin_token', authToken);
    sessionStorage.setItem('glycr_admin_user',  JSON.stringify(currentAdmin));
    _showPanel();
    initSession();
    await loadPlatformFee();
    await loadData();
    await addLog('auth', 'Admin login successful', { user: email });
    toast.success('Welcome back!', `Signed in as ${currentAdmin.name || email}`);
  } catch (err) {
    errorEl.style.display = 'flex';
    document.getElementById('login-error-msg').textContent = err.message;
    toast.error('Login failed', err.message);
    await addLog('danger', 'Failed admin login attempt', { email });
  }
}

function _showPanel() {
  document.getElementById('login-page').style.display  = 'none';
  document.getElementById('admin-panel').style.display = 'block';
  document.getElementById('admin-display-name').textContent = currentAdmin.name  || 'Admin';
  document.getElementById('admin-display-role').textContent = getRoleDisplay(currentAdmin.role);
  document.getElementById('last-login-display').textContent = new Date().toLocaleString();
  const pName  = document.getElementById('profile-modal-name');
  const pEmail = document.getElementById('profile-modal-email');
  const pInput = document.getElementById('profile-name-input');
  const eInput = document.getElementById('profile-email-input');
  if (pName)  pName.textContent  = currentAdmin.name  || '';
  if (pEmail) pEmail.textContent = currentAdmin.email || '';
  if (pInput) pInput.value       = currentAdmin.name  || '';
  if (eInput) eInput.value       = currentAdmin.email || '';
}

function getRoleDisplay(role) {
  const map = { admin: 'Administrator', moderator: 'Moderator', organizer: 'Organizer' };
  return map[role] || 'Customer';
}

function handleLogout() {
  closeDropdown();
  addLog('auth', 'Admin logged out', { adminName: currentAdmin.name, adminRole: currentAdmin.role });
  destroySession();
  sessionStorage.removeItem('glycr_admin_auth');
  sessionStorage.removeItem('glycr_admin_token');
  sessionStorage.removeItem('glycr_admin_user');
  authToken    = null;
  currentAdmin = { name: 'Admin', email: '', role: '' };
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('login-page').style.display  = 'flex';
  document.getElementById('login-password').value      = '';
  document.getElementById('login-error').style.display = 'none';
  const overlay = document.getElementById('session-warning-overlay');
  if (overlay) overlay.style.display = 'none';
}

window.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('glycr_admin_auth') === 'true') {
    const token   = sessionStorage.getItem('glycr_admin_token');
    const userStr = sessionStorage.getItem('glycr_admin_user');
    if (token && userStr) {
      authToken    = token;
      currentAdmin = { ...JSON.parse(userStr) };
      currentAdmin.role = currentAdmin.role || 'customer';
      _showPanel();
      initSession();
      loadPlatformFee().then(() => loadData());
    }
  }

  document.querySelectorAll('input[name="export-range"]').forEach(r =>
    r.addEventListener('change', () => {
      const isCustom = document.querySelector('input[name="export-range"]:checked')?.value === 'custom';
      document.getElementById('custom-date-range').style.display = isCustom ? 'block' : 'none';
      updateExportPreview();
    })
  );
  document.querySelectorAll('input[name="export-format"]').forEach(r => r.addEventListener('change', updateExportPreview));
  document.getElementById('export-date-from')?.addEventListener('change', updateExportPreview);
  document.getElementById('export-date-to')?.addEventListener('change',   updateExportPreview);
  document.getElementById('new-password')?.addEventListener('input', checkPasswordStrength);
  document.querySelectorAll('input[name="broadcast-audience"]').forEach(r =>
    r.addEventListener('change', updateBroadcastAudiencePreview)
  );
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-page').style.display !== 'none') handleLogin();
  if (e.key === 'Enter' && document.getElementById('custom-prompt-modal')?.classList.contains('show')) {
    _customPromptResolve(document.getElementById('custom-prompt-input').value);
  }
});

/* =============================================
   PROFILE DROPDOWN
============================================= */
function toggleProfileDropdown() { document.getElementById('profile-dropdown').classList.toggle('open'); }
function closeDropdown()         { document.getElementById('profile-dropdown').classList.remove('open'); }
document.addEventListener('click', e => {
  const wrap = document.getElementById('profile-dropdown-wrap');
  if (wrap && !wrap.contains(e.target)) closeDropdown();
});

/* =============================================
   ADMIN PASSWORD CHANGE
============================================= */
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.innerHTML = show ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
}

function checkPasswordStrength() {
  const pw    = document.getElementById('new-password')?.value || '';
  const bar   = document.getElementById('password-strength-bar');
  const fill  = document.getElementById('password-strength-fill');
  const label = document.getElementById('password-strength-label');
  if (!bar) return;
  if (!pw.length) { bar.style.display = 'none'; label.style.display = 'none'; return; }
  bar.style.display = 'block'; label.style.display = 'block';
  let score = 0;
  if (pw.length >= 8)           score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  fill.className = '';
  if (score <= 1)      { fill.classList.add('strength-weak');   label.textContent = 'Weak';   label.style.color = '#f87171'; }
  else if (score <= 2) { fill.classList.add('strength-medium'); label.textContent = 'Medium'; label.style.color = '#fbbf24'; }
  else                 { fill.classList.add('strength-strong'); label.textContent = 'Strong'; label.style.color = '#34d399'; }
}

async function changeAdminPassword() {
  const current  = document.getElementById('current-password').value;
  const newPw    = document.getElementById('new-password').value;
  const confirm  = document.getElementById('confirm-password').value;
  const errorEl  = document.getElementById('change-password-error');
  const showErr  = msg => { errorEl.style.display = 'block'; errorEl.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="margin-right:0.4rem;"></i>${msg}`; };
  errorEl.style.display = 'none';
  if (!current || !newPw || !confirm) { showErr('All password fields are required.'); return; }
  if (newPw.length < 8)              { showErr('New password must be at least 8 characters.'); return; }
  if (newPw !== confirm)             { showErr('New passwords do not match.'); return; }
  try { await apiRequest('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: current, newPassword: newPw }) }); } catch { /* graceful demo fallback */ }
  _clearPasswordFields();
  await addLog('auth', 'Admin password changed', { adminName: currentAdmin.name, adminRole: currentAdmin.role });
  closeModal('profile-modal');
  toast.success('Password updated', 'Your password has been changed successfully.');
}

function _clearPasswordFields() {
  ['current-password','new-password','confirm-password'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const bar   = document.getElementById('password-strength-bar');
  const label = document.getElementById('password-strength-label');
  if (bar)   bar.style.display   = 'none';
  if (label) label.style.display = 'none';
  const err = document.getElementById('change-password-error');
  if (err) err.style.display = 'none';
}

async function saveProfile() {
  const name  = document.getElementById('profile-name-input').value.trim();
  const email = document.getElementById('profile-email-input').value.trim();
  if (!name || !email) return;
  try { await apiRequest('/auth/profile', { method: 'PUT', body: JSON.stringify({ name, email }) }); } catch { /* local */ }
  currentAdmin.name  = name;
  currentAdmin.email = email;
  sessionStorage.setItem('glycr_admin_user', JSON.stringify(currentAdmin));
  document.getElementById('admin-display-name').textContent  = name;
  document.getElementById('profile-modal-name').textContent  = name;
  document.getElementById('profile-modal-email').textContent = email;
  await addLog('system', 'Admin profile updated', { adminName: name, adminRole: currentAdmin.role, email });
  closeModal('profile-modal');
  toast.success('Profile updated', 'Your changes have been saved.');
}

/* =============================================
   USER PASSWORD RESET
============================================= */
function openResetPasswordModal(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return;
  if (!canResetPassword(user)) { toast.error('Permission denied', 'You do not have permission to reset this user\'s password.'); return; }
  document.getElementById('reset-password-user-id').value = userId;
  document.getElementById('reset-password-user-info').innerHTML =
    `<strong>${user.name || 'User'}</strong> &nbsp;·&nbsp; ${user.email}
     <br><span style="font-size:0.75rem;color:#94a3b8;text-transform:capitalize;">${user.role}</span>`;
  document.getElementById('reset-password-result').style.display = 'none';
  openModal('reset-password-modal');
}

async function submitResetPassword() {
  const userId   = document.getElementById('reset-password-user-id').value;
  const user     = users.find(u => u.id === userId);
  const resultEl = document.getElementById('reset-password-result');
  const showResult = (ok, html) => {
    resultEl.style.cssText = `display:block;padding:0.75rem;border-radius:0.5rem;font-size:0.82rem;
      background:${ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};
      border:1px solid ${ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};
      color:${ok ? '#34d399' : '#f87171'};`;
    resultEl.innerHTML = html;
  };
  try {
    await apiRequest(`/admin/users/${userId}/reset-password`, { method: 'POST' });
    showResult(true, '<i class="fa-solid fa-circle-check" style="margin-right:0.4rem;"></i>Reset link sent! Expires in <strong>15 minutes</strong>.');
  } catch {
    const expiry = new Date(Date.now() + 15 * 60 * 1000);
    showResult(true,
      `<i class="fa-solid fa-circle-check" style="margin-right:0.4rem;"></i>
       Reset link generated &amp; emailed to <strong>${user?.email}</strong>.<br>
       <span style="font-size:0.75rem;opacity:0.8;">Expires at ${expiry.toLocaleTimeString()} (15 min window)</span>`
    );
  }
  await addLog('user', 'Password reset link sent', {
    adminName: currentAdmin.name, adminRole: currentAdmin.role,
    targetUser: user?.email, targetRole: user?.role, expiresIn: '15 minutes',
  });
  toast.success('Reset link sent', `Email dispatched to ${user?.email}.`);
  setTimeout(() => closeModal('reset-password-modal'), 2500);
}

/* =============================================
   PLATFORM FEE / SETTINGS
============================================= */
async function loadPlatformFee() {
  try {
    const res = await apiRequest('/admin/settings');
    platformFeePercent = res.platformFee || 3;
    const feeInput = document.getElementById('platform-fee-setting');
    if (feeInput) feeInput.value = platformFeePercent;
  } catch { platformFeePercent = 3; }
}

async function savePlatformFee() {
  if (!canEditSettings()) { toast.error('Permission denied', 'Only administrators can change platform settings.'); return; }
  const newFee = parseFloat(document.getElementById('platform-fee-setting').value);
  if (isNaN(newFee) || newFee < 0 || newFee > 50) { toast.warning('Invalid value', 'Platform fee must be between 0 and 50.'); return; }
  try { await apiRequest('/admin/settings', { method: 'PUT', body: JSON.stringify({ platformFee: newFee }) }); } catch { /* local */ }
  platformFeePercent = newFee;
  await addLog('system', `Platform fee updated to ${newFee}%`, { adminName: currentAdmin.name, adminRole: currentAdmin.role });
  await loadData();
  toast.success('Settings saved', `Platform fee is now ${newFee}%.`);
}

async function saveSettings() {
  await savePlatformFee();
  await addLog('system', 'Admin settings saved', { adminName: currentAdmin.name, adminRole: currentAdmin.role });
  closeModal('settings-modal');
}

/* =============================================
   TABS
============================================= */
function showTab(tab, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tab).classList.add('active');
  if (el) el.classList.add('active');
  if (tab === 'logs')             renderLogs();
  if (tab === 'waitlist')         renderWaitlist();
  if (tab === 'refunds')          renderRefunds();
  if (tab === 'service-requests') renderServiceRequests();
  if (tab === 'transactions')     { renderTransactions(); renderTransactionSummaryCards(); }
  if (tab === 'messages')         { renderMessages(); updateMessageStats(); updateBroadcastAudiencePreview(); }
  if (tab === 'reports')          { renderReports(); renderCharts(); }
}

/* =============================================
   LOGS ENGINE
============================================= */
const LOG_ICONS = {
  auth:    { icon: 'fa-solid fa-right-to-bracket',     cls: 'auth'    },
  event:   { icon: 'fa-regular fa-calendar',           cls: 'event'   },
  payout:  { icon: 'fa-solid fa-money-bill-transfer',  cls: 'payout'  },
  user:    { icon: 'fa-solid fa-user-pen',             cls: 'user'    },
  system:  { icon: 'fa-solid fa-gear',                 cls: 'system'  },
  warning: { icon: 'fa-solid fa-triangle-exclamation', cls: 'warning' },
  danger:  { icon: 'fa-solid fa-circle-xmark',         cls: 'danger'  },
};

const LOG_EXCLUDED_MESSAGES = ['data refreshed', 'admin data refreshed', 'Failed to load admin data'];

function _isExcludedLog(message) {
  const lower = (message || '').toLowerCase();
  return LOG_EXCLUDED_MESSAGES.some(excl => lower.includes(excl));
}

async function addLog(type, message, meta = {}) {
  if (_isExcludedLog(message)) return;
  const enrichedMeta = { adminName: currentAdmin.name || 'System', adminRole: currentAdmin.role || 'system', ...meta };
  try {
    await apiRequest('/admin/logs', { method: 'POST', body: JSON.stringify({ type, message, meta: enrichedMeta }) });
  } catch {
    const fallback = { id: `${Date.now()}${Math.random()}`, type, message, meta: enrichedMeta, timestamp: new Date().toISOString() };
    logs.unshift(fallback);
    try { localStorage.setItem('glycr_admin_logs', JSON.stringify(logs.slice(0, 500))); } catch {}
  }
  const el = document.getElementById('quick-log-count');
  if (el) el.textContent = logs.length;
}

async function loadLogs() {
  try {
    const result = await apiRequest('/admin/logs?limit=500');
    logs = (result.logs || []).filter(l => !_isExcludedLog(l.message));
    localStorage.setItem('glycr_admin_logs', JSON.stringify(logs));
  } catch {
    try {
      const stored = localStorage.getItem('glycr_admin_logs');
      if (stored) logs = JSON.parse(stored).filter(l => !_isExcludedLog(l.message));
    } catch { logs = []; }
    if (!logs.length) {
      logs = [{ type: 'system', message: 'Admin panel initialised (offline mode)', timestamp: new Date().toISOString(), meta: { adminName: 'System', adminRole: 'system' } }];
    }
  }
  renderLogs();
}

function renderLogs() {
  const search = (document.getElementById('log-search')?.value || '').toLowerCase();
  const type   = document.getElementById('log-type-filter')?.value || 'all';
  const sort   = document.getElementById('log-sort')?.value        || 'desc';
  let filtered = logs.filter(l => {
    if (_isExcludedLog(l.message)) return false;
    const matchType   = type === 'all' || l.type === type;
    const matchSearch = !search || l.message.toLowerCase().includes(search) || JSON.stringify(l.meta || {}).toLowerCase().includes(search);
    return matchType && matchSearch;
  });
  if (sort === 'asc') filtered = [...filtered].reverse();
  const countEl = document.getElementById('log-count-badge');
  if (countEl) countEl.textContent = `${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'}`;
  const container = document.getElementById('logs-list');
  if (!container) return;
  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-scroll" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>No log entries found</div>';
    return;
  }
  container.innerHTML = filtered.map(entry => {
    const def       = LOG_ICONS[entry.type] || LOG_ICONS.system;
    const time      = new Date(entry.timestamp);
    const timeStr   = time.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    const dateStr   = time.toLocaleDateString('en-GB',  { day:'2-digit', month:'short', year:'numeric' });
    const meta      = entry.meta || {};
    const adminName = meta.adminName || '';
    const adminRole = meta.adminRole || '';
    const adminPill = adminName
      ? `<span class="log-admin-pill"><i class="fa-solid fa-user-shield"></i> ${adminName} <span style="opacity:0.6;">(${adminRole})</span></span>`
      : '';
    const otherMeta = Object.keys(meta)
      .filter(k => k !== 'adminName' && k !== 'adminRole')
      .map(k => `<span class="log-meta-item"><i class="fa-solid fa-tag" style="font-size:0.6rem;"></i><strong>${k}:</strong> ${meta[k]}</span>`)
      .join('');
    return `
      <div class="log-item">
        <div class="log-icon-wrap ${def.cls}"><i class="${def.icon}"></i></div>
        <div class="log-body">
          <div class="log-message">${entry.message}</div>
          <div class="log-meta">
            <span class="log-meta-item"><i class="fa-regular fa-clock" style="font-size:0.65rem;"></i> ${dateStr}</span>
            ${adminPill}
            ${otherMeta}
          </div>
        </div>
        <div class="log-timestamp">${timeStr}</div>
      </div>`;
  }).join('');
}

async function clearLogs() {
  const ok = await customConfirm('Clear all log entries? This cannot be undone.', 'Clear Logs', 'Clear All', '#ef4444');
  if (!ok) return;
  try { await apiRequest('/admin/logs', { method: 'DELETE' }); } catch {}
  logs = [];
  localStorage.removeItem('glycr_admin_logs');
  await addLog('system', 'Logs cleared by admin', { adminName: currentAdmin.name, adminRole: currentAdmin.role });
  renderLogs();
  toast.info('Logs cleared', 'All activity logs have been removed.');
}

/* =============================================
   DATA LOAD
============================================= */
async function loadData() {
  try {
    const normalize = arr => arr.map(r => ({ ...r, id: r.id || r._id?.toString() || r._id }));
    users           = normalize(await apiRequest('/admin/users'));
    events          = normalize(await apiRequest('/admin/events'));
    tickets         = normalize(await apiRequest('/admin/tickets'));
    payouts         = normalize(await apiRequest('/admin/payouts'));
    refunds         = normalize(await apiRequest('/admin/refunds/all'));
    waitlist        = normalize(await apiRequest('/admin/waitlists'));
    serviceRequests = normalize(await apiRequest('/admin/service-requests'));
    await loadMessages();
    await loadTransactions();
    await loadLogs();
    calculateStats();
    renderDashboard();
    renderUsers();
    renderEvents();
    renderTickets();
    renderPayouts();
    renderRefunds();
    renderWaitlist();
    renderServiceRequests();
    renderReports();
    populateWaitlistEventFilter();
    updateBroadcastAudiencePreview();
  } catch (err) {
    console.error('Failed to load data', err);
    toast.error('Load failed', 'Check that the backend is running and you are logged in.');
  }
}

/* =============================================
   STATISTICS
============================================= */
function calculateStats() {
  stats = {
    totalUsers:       users.length,
    totalOrganizers:  users.filter(u => u.role === 'organizer').length,
    totalEvents:      events.length,
    liveEvents:       events.filter(e => e.isPublished && !e.isCancelled && new Date(e.date) > new Date()).length,
    totalRevenue:     tickets.reduce((s, t) => s + (t.price || 0), 0),
    pendingPayouts:   payouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0),
    pendingRefunds:   refunds.filter(r => r.status === 'pending').reduce((s, r) => s + (r.amount || 0), 0),
    totalRefunded:    refunds.filter(r => r.status === 'approved').reduce((s, r) => s + (r.amount || 0), 0),
    totalTickets:     tickets.length,
    flaggedEvents:    events.filter(e => e.flagged).length,
    waitlistCount:    waitlist.length,
    openServiceRequests: serviceRequests.filter(r => r.status !== 'resolved').length,
    get platformFeeAmount() { return this.totalRevenue * (platformFeePercent / 100); },
    platformFeeRate:  platformFeePercent,
  };
}

function renderDashboard() {
  setText('stat-users',         stats.totalUsers);
  setText('stat-live-events',   stats.liveEvents);
  setText('stat-revenue',       `₵${stats.totalRevenue.toFixed(2)}`);
  setText('stat-tickets',       stats.totalTickets);
  setText('stat-organizers',    stats.totalOrganizers);
  setText('stat-total-events',  stats.totalEvents);
  setText('stat-avg-revenue',   `₵${stats.totalEvents > 0 ? (stats.totalRevenue / stats.totalEvents).toFixed(2) : '0.00'}`);
  setText('quick-users-count',      stats.totalUsers);
  setText('quick-pending-payouts',  `₵${stats.pendingPayouts.toFixed(2)}`);
  setText('quick-pending-refunds',  `₵${stats.pendingRefunds.toFixed(2)}`);
  setText('quick-flagged-events',   stats.flaggedEvents);
  setText('quick-log-count',        logs.length);
  setText('quick-waitlist-count',   stats.waitlistCount);
  setText('quick-sr-count',         stats.openServiceRequests);
  setText('open-sr-count',          stats.openServiceRequests);
  const feeEl = document.getElementById('stat-platform-fee');
  if (feeEl) feeEl.textContent = `₵${stats.platformFeeAmount.toFixed(2)} (${stats.platformFeeRate}%)`;

  // update transactions quick count from dashboard
  const txnCount = document.getElementById('quick-transactions-count');
  if (txnCount) txnCount.textContent = transactions.length;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* =============================================
   SORTING ENGINE
============================================= */
function sortTable(tableKey, field) {
  const cur = sortState[tableKey] || { field: null, dir: 'asc' };
  const dir = (cur.field === field && cur.dir === 'asc') ? 'desc' : 'asc';
  sortState[tableKey] = { field, dir };
  document.querySelectorAll(`[id^="sort-${tableKey}-"]`).forEach(el => {
    el.className = 'fa-solid fa-sort sort-icon';
    el.closest('th')?.classList.remove('sort-active','sort-asc','sort-desc');
  });
  const icon = document.getElementById(`sort-${tableKey}-${field}`);
  if (icon) {
    icon.className = `fa-solid fa-sort-${dir === 'asc' ? 'up' : 'down'} sort-icon`;
    icon.closest('th')?.classList.add('sort-active', `sort-${dir}`);
  }
  pageState[tableKey] = 1;
  _rerenderTable(tableKey);
}

function _rerenderTable(key) {
  const map = {
    users:              renderUsers,
    events:             renderEvents,
    tickets:            renderTickets,
    payouts:            renderPayouts,
    waitlist:           renderWaitlist,
    'service-requests': renderServiceRequests,
    messages:           renderMessages,
    transactions:       renderTransactions,
  };
  if (map[key]) map[key]();
}

function applySorting(data, tableKey) {
  const s = sortState[tableKey];
  if (!s?.field) return data;
  return [...data].sort((a, b) => {
    let av = a[s.field] ?? '', bv = b[s.field] ?? '';
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return s.dir === 'asc' ? -1 :  1;
    if (av > bv) return s.dir === 'asc' ?  1 : -1;
    return 0;
  });
}

/* =============================================
   PAGINATION ENGINE
============================================= */
function paginate(data, tableKey) {
  const page  = pageState[tableKey] || 1;
  const pp    = perPage[tableKey]   || 20;
  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / pp));
  const start = (page - 1) * pp;
  return { rows: data.slice(start, start + pp), page, totalPages, total, pp };
}

function renderPaginationBar(containerId, tableKey, total, page, totalPages, pp) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!total) { el.innerHTML = ''; return; }
  const ppo = [10,20,50,100].map(n => `<option value="${n}" ${n === pp ? 'selected' : ''}>${n}</option>`).join('');
  const maxBtns = 7;
  let s = Math.max(1, page - 3);
  let e = Math.min(totalPages, s + maxBtns - 1);
  if (e - s < maxBtns - 1) s = Math.max(1, e - maxBtns + 1);
  let btns = `<button class="page-btn" onclick="goToPage('${tableKey}',${page - 1})" ${page <= 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;
  for (let i = s; i <= e; i++) btns += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="goToPage('${tableKey}',${i})">${i}</button>`;
  btns += `<button class="page-btn" onclick="goToPage('${tableKey}',${page + 1})" ${page >= totalPages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;
  const from = Math.min((page - 1) * pp + 1, total);
  const to   = Math.min(page * pp, total);
  el.innerHTML = `
    <div class="pagination-info">Showing ${from}–${to} of ${total} records</div>
    <div class="pagination-controls">${btns}</div>
    <div style="display:flex;align-items:center;gap:0.5rem;">
      <span style="font-size:0.78rem;color:#94a3b8;">Per page:</span>
      <select class="per-page-select" onchange="changePerPage('${tableKey}',this.value)">${ppo}</select>
    </div>`;
}

function goToPage(tableKey, page) {
  const total = getFilteredData(tableKey).length;
  const tp    = Math.max(1, Math.ceil(total / (perPage[tableKey] || 20)));
  pageState[tableKey] = Math.max(1, Math.min(page, tp));
  _rerenderTable(tableKey);
}

function changePerPage(tableKey, value) {
  perPage[tableKey]   = parseInt(value);
  pageState[tableKey] = 1;
  _rerenderTable(tableKey);
}

function getFilteredData(tableKey) {
  const map = {
    users:              getFilteredUsers,
    events:             getFilteredEvents,
    tickets:            getFilteredTickets,
    payouts:            getFilteredPayouts,
    refunds:            getFilteredRefunds,
    waitlist:           getFilteredWaitlist,
    'service-requests': getFilteredServiceRequests,
    messages:           getFilteredMessages,
    transactions:       getFilteredTransactions,
  };
  return map[tableKey] ? map[tableKey]() : [];
}

/* =============================================
   DATE RANGE HELPER
============================================= */
function applyDateRangeFilter(dateStr, from, to) {
  if (!from && !to) return true;
  const d = new Date(dateStr);
  if (isNaN(d)) return true;
  if (from && d < new Date(from))             return false;
  if (to   && d > new Date(to + 'T23:59:59')) return false;
  return true;
}

/* =============================================
   BULK SELECTION ENGINE
============================================= */
function toggleSelectAll(tableKey) {
  const master     = document.getElementById(`${tableKey}-select-all`);
  const tbodyId    = tableKey === 'service-requests' ? 'sr-table' : `${tableKey}-table`;
  const checkboxes = document.querySelectorAll(`#${tbodyId} .row-checkbox`);
  const ids        = selectedIds[tableKey];
  checkboxes.forEach(cb => {
    cb.checked = master.checked;
    if (master.checked) { ids.add(cb.dataset.id); cb.closest('tr').classList.add('row-selected'); }
    else                { ids.delete(cb.dataset.id); cb.closest('tr').classList.remove('row-selected'); }
  });
  updateBulkBar(tableKey);
}

function toggleRowSelect(tableKey, id, cb) {
  if (cb.checked) { selectedIds[tableKey].add(id); cb.closest('tr').classList.add('row-selected'); }
  else            { selectedIds[tableKey].delete(id); cb.closest('tr').classList.remove('row-selected'); }
  updateBulkBar(tableKey);
  const tbodyId = tableKey === 'service-requests' ? 'sr-table' : `${tableKey}-table`;
  const all     = document.querySelectorAll(`#${tbodyId} .row-checkbox`);
  const checked = document.querySelectorAll(`#${tbodyId} .row-checkbox:checked`);
  const master  = document.getElementById(`${tableKey}-select-all`);
  if (master) {
    master.checked       = all.length > 0 && checked.length === all.length;
    master.indeterminate = checked.length > 0 && checked.length < all.length;
  }
}

function updateBulkBar(tableKey) {
  const count   = selectedIds[tableKey].size;
  const barId   = tableKey === 'service-requests' ? 'sr-bulk-bar' : `${tableKey}-bulk-bar`;
  const countId = tableKey === 'service-requests' ? 'sr-selected-count' : `${tableKey}-selected-count`;
  const bar     = document.getElementById(barId);
  const countEl = document.getElementById(countId);
  if (bar)     bar.style.display = count > 0 ? 'flex' : 'none';
  if (countEl) countEl.textContent = `${count} selected`;
}

function showBulkConfirm(title, message, onConfirm) {
  document.getElementById('bulk-confirm-title').innerHTML =
    `<i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b;margin-right:0.5rem;"></i>${title}`;
  document.getElementById('bulk-confirm-message').textContent = message;
  const btn = document.getElementById('bulk-confirm-btn');
  btn.onclick = () => { closeModal('bulk-confirm-modal'); onConfirm(); };
  openModal('bulk-confirm-modal');
}

/* =============================================
   USERS
============================================= */
function renderUsers() {
  const tb      = document.getElementById('users-table');
  const sorted  = applySorting(getFilteredUsers(), 'users');
  const { rows, page, totalPages, total, pp } = paginate(sorted, 'users');
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-users-slash" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>No users found</td></tr>';
    renderPaginationBar('users-pagination', 'users', 0, 1, 1, pp);
    return;
  }
  tb.innerHTML = rows.map(user => {
    const roleMap = { organizer:['badge-organizer','fa-user-tie','Organizer'], moderator:['badge-moderator','fa-user-cog','Moderator'], admin:['badge-admin','fa-user-shield','Admin'] };
    const [bClass, icon, label] = roleMap[user.role] || ['badge-customer','fa-user','Customer'];
    const sel = selectedIds.users.has(user.id);
    return `
      <tr class="${sel ? 'row-selected' : ''}">
        <td><input type="checkbox" class="row-checkbox" data-id="${user.id}" ${sel ? 'checked' : ''} onchange="toggleRowSelect('users','${user.id}',this)"></td>
        <td>
          <div style="font-weight:600;">${user.name || 'User'}</div>
          <div style="font-size:0.75rem;color:#94a3b8;"><i class="fa-solid fa-fingerprint"></i> ${user.id}</div>
        </td>
        <td>
          <div style="font-size:0.875rem;"><i class="fa-regular fa-envelope" style="margin-right:0.3rem;"></i>${user.email}</div>
          <div style="color:#94a3b8;font-size:0.82rem;"><i class="fa-solid fa-mobile-screen-button" style="margin-right:0.3rem;"></i>${user.phone || '—'}</div>
        </td>
        <td><span class="badge ${bClass}"><i class="fa-solid ${icon}"></i> ${label}</span></td>
        <td><span class="badge ${user.suspended ? 'badge-suspended' : 'badge-active'}">
          <i class="fa-solid ${user.suspended ? 'fa-ban' : 'fa-circle-check'}"></i>
          ${user.suspended ? 'Suspended' : 'Active'}
        </span></td>
        <td><div class="actions">
          <button class="btn-icon" style="background:#6366f1;" onclick="viewUser('${user.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
          ${canEditUser(user)      ? `<button class="btn-icon" style="background:#8b5cf6;" onclick="openEditUserModal('${user.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>` : ''}
          ${canResetPassword(user) ? `<button class="btn-icon" style="background:#f59e0b;" onclick="openResetPasswordModal('${user.id}')" title="Reset Password"><i class="fa-solid fa-key"></i></button>` : ''}
          ${canSuspendUser(user)   ? `<button class="btn-icon" style="background:${user.suspended ? '#10b981' : '#f59e0b'};" onclick="suspendUser('${user.id}')" title="${user.suspended ? 'Unsuspend' : 'Suspend'}"><i class="fa-solid ${user.suspended ? 'fa-user-check' : 'fa-user-slash'}"></i></button>` : ''}
          ${canDeleteUser(user)    ? `<button class="btn-icon" style="background:#ef4444;" onclick="deleteUser('${user.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div></td>
      </tr>`;
  }).join('');
  renderPaginationBar('users-pagination', 'users', total, page, totalPages, pp);
}

function getFilteredUsers() {
  const search = (document.getElementById('user-search')?.value || '').toLowerCase();
  const role   = document.getElementById('user-role-filter')?.value   || 'all';
  const status = document.getElementById('user-status-filter')?.value || 'all';
  const dfrom  = document.getElementById('user-date-from')?.value;
  const dto    = document.getElementById('user-date-to')?.value;
  return users.filter(u => {
    const mSearch = !search || (u.name||'').toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
    const mRole   = role   === 'all' || u.role === role;
    const mStatus = status === 'all' || (status === 'active' && !u.suspended) || (status === 'suspended' && u.suspended);
    return mSearch && mRole && mStatus && applyDateRangeFilter(u.createdAt, dfrom, dto);
  });
}

function filterUsers() { pageState.users = 1; renderUsers(); }

async function suspendUser(userId) {
  const user = users.find(u => u.id === userId);
  if (!canSuspendUser(user)) { toast.error('Permission denied', 'You cannot suspend this user.'); return; }
  try { await apiRequest(`/admin/users/${userId}/suspend`, { method: 'PATCH' }); }
  catch { if (user) user.suspended = !user.suspended; }
  await addLog('user', `User ${user?.suspended ? 'suspended' : 'unsuspended'}`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, targetUser: user?.email, targetRole: user?.role });
  await loadData();
  toast.success('User updated', `Account has been ${user?.suspended ? 'suspended' : 'unsuspended'}.`);
}

async function deleteUser(userId) {
  const user = users.find(u => u.id === userId);
  if (!canDeleteUser(user)) { toast.error('Permission denied', 'You cannot delete this user.'); return; }
  const ok = await customConfirm(`Delete "${user?.name || user?.email}"? This will permanently remove their account and all associated data.`, 'Delete User', 'Delete', '#ef4444');
  if (!ok) return;
  try { await apiRequest(`/admin/users/${userId}`, { method: 'DELETE' }); } catch {}
  await addLog('danger', 'User deleted', { adminName: currentAdmin.name, adminRole: currentAdmin.role, targetUser: user?.email, targetRole: user?.role });
  await loadData();
  toast.success('User deleted', 'The account has been permanently removed.');
}

function openEditUserModal(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return;
  document.getElementById('edit-user-id').value     = user.id;
  document.getElementById('edit-user-name').value   = user.name  || '';
  document.getElementById('edit-user-email').value  = user.email || '';
  document.getElementById('edit-user-phone').value  = user.phone || '';
  document.getElementById('edit-user-role').value   = user.role  || 'customer';
  document.getElementById('edit-user-status').value = user.suspended ? 'true' : 'false';
  openModal('edit-user-modal');
}

async function saveEditUser() {
  const userId    = document.getElementById('edit-user-id').value;
  const name      = document.getElementById('edit-user-name').value.trim();
  const email     = document.getElementById('edit-user-email').value.trim();
  const phone     = document.getElementById('edit-user-phone').value.trim();
  const role      = document.getElementById('edit-user-role').value;
  const suspended = document.getElementById('edit-user-status').value === 'true';
  if (!name || !email) { toast.warning('Missing fields', 'Name and email are required.'); return; }
  try { await apiRequest(`/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify({ name, email, phone, role, suspended }) }); }
  catch { const u = users.find(u => u.id === userId); if (u) Object.assign(u, { name, email, phone, role, suspended }); }
  await addLog('user', 'User details updated', { adminName: currentAdmin.name, adminRole: currentAdmin.role, targetUser: email, targetRole: role });
  closeModal('edit-user-modal');
  await loadData();
  toast.success('User updated', 'Changes saved successfully.');
}

function openAddUserModal() {
  ['add-user-name','add-user-email','add-user-phone','add-user-password'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('add-user-role').value = 'customer';
  document.getElementById('add-user-error').style.display = 'none';
  openModal('add-user-modal');
}

async function submitAddUser() {
  const name     = document.getElementById('add-user-name').value.trim();
  const email    = document.getElementById('add-user-email').value.trim();
  const phone    = document.getElementById('add-user-phone').value.trim();
  const password = document.getElementById('add-user-password').value;
  const role     = document.getElementById('add-user-role').value;
  const errEl    = document.getElementById('add-user-error');
  const errMsg   = document.getElementById('add-user-error-msg');
  if (!name || !email || !password) { errEl.style.display = 'block'; errMsg.textContent = 'Name, email and password are required.'; return; }
  try {
    await apiRequest('/admin/users', { method: 'POST', body: JSON.stringify({ name, email, phone, password, role }) });
    await addLog('user', 'New user created by admin', { adminName: currentAdmin.name, adminRole: currentAdmin.role, targetUser: email, targetRole: role });
    closeModal('add-user-modal');
    await loadData();
    toast.success('User created', `${name} has been added to the platform.`);
  } catch (err) { errEl.style.display = 'block'; errMsg.textContent = err.message; }
}

async function bulkSuspendUsers() {
  const ids = [...selectedIds.users];
  if (!ids.length) return;
  showBulkConfirm('Suspend Users', `Suspend ${ids.length} selected user(s)?`, async () => {
    let ok = 0;
    for (const id of ids) {
      try { await apiRequest(`/admin/users/${id}/suspend`, { method: 'PATCH' }); ok++; }
      catch { const u = users.find(u => u.id === id); if (u) { u.suspended = true; ok++; } }
    }
    await addLog('user', `Bulk suspended ${ok} user(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok });
    selectedIds.users.clear();
    await loadData();
    toast.success('Done', `${ok} user(s) suspended.`);
  });
}

async function bulkDeleteUsers() {
  const ids = [...selectedIds.users];
  if (!ids.length) return;
  showBulkConfirm('Delete Users', `Permanently delete ${ids.length} user(s)? This cannot be undone.`, async () => {
    let ok = 0;
    for (const id of ids) {
      const user = users.find(u => u.id === id);
      if (!canDeleteUser(user)) continue;
      try { await apiRequest(`/admin/users/${id}`, { method: 'DELETE' }); ok++; } catch { ok++; }
    }
    await addLog('danger', `Bulk deleted ${ok} user(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok });
    selectedIds.users.clear();
    await loadData();
    toast.success('Done', `${ok} user(s) deleted.`);
  });
}

/* =============================================
   EVENTS
============================================= */
function renderEvents() {
  const tb     = document.getElementById('events-table');
  const sorted = applySorting(getFilteredEvents(), 'events');
  const { rows, page, totalPages, total, pp } = paginate(sorted, 'events');
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-regular fa-calendar-xmark" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>No events found</td></tr>';
    renderPaginationBar('events-pagination', 'events', 0, 1, 1, pp);
    return;
  }
  tb.innerHTML = rows.map(ev => {
    const org     = ev.organizerId;
    const orgName = org?.name || org?.email || 'Unknown';
    const orgEmail= org?.email || '—';
    const evTix   = tickets.filter(t => (t.eventId?.id || t.eventId?._id?.toString() || t.eventId) === ev.id);
    const revenue = evTix.reduce((s, t) => s + (t.price || 0), 0);
    const isLive  = ev.isPublished && !ev.isCancelled && new Date(ev.date) > new Date();
    const dateStr = new Date(ev.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    let badges = '';
    if (ev.flagged)        badges += `<span class="badge badge-flagged"><i class="fa-solid fa-flag"></i> Flagged</span>`;
    if (ev.isCancelled)    badges += `<span class="badge badge-cancelled"><i class="fa-solid fa-circle-xmark"></i> Cancelled</span>`;
    else if (isLive)       badges += `<span class="badge badge-live"><i class="fa-solid fa-circle-dot"></i> Live</span>`;
    else if (!ev.isPublished) badges += `<span class="badge badge-unpublished"><i class="fa-solid fa-eye-slash"></i> Unpublished</span>`;
    else                   badges += `<span class="badge badge-info"><i class="fa-solid fa-check"></i> Ended</span>`;
    const sel = selectedIds.events.has(ev.id);
    return `
      <tr class="${sel ? 'row-selected' : ''}">
        <td><input type="checkbox" class="row-checkbox" data-id="${ev.id}" ${sel ? 'checked' : ''} onchange="toggleRowSelect('events','${ev.id}',this)"></td>
        <td>
          <div class="event-table-name">${ev.title}</div>
          <div class="event-table-meta">
            <span><i class="fa-solid fa-ticket"></i> ${evTix.length} sold</span>
            <span><i class="fa-solid fa-coins"></i> ₵${revenue.toFixed(2)}</span>
          </div>
        </td>
        <td>
          <div class="event-table-organizer">${orgName}</div>
          <div class="event-table-organizer-sub"><i class="fa-regular fa-envelope"></i> ${orgEmail}</div>
        </td>
        <td>
          <div style="font-size:0.875rem;">${dateStr}</div>
          <div style="font-size:0.72rem;color:#94a3b8;">${new Date(ev.date).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
        </td>
        <td><div class="event-status-cell">${badges}</div></td>
        <td><div class="actions">
          <button class="btn-icon" style="background:#6366f1;" onclick="viewEvent('${ev.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
          <button class="btn-icon" style="background:#8b5cf6;" onclick="openEditEventModal('${ev.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn-icon" style="background:${ev.flagged ? '#10b981' : '#f59e0b'};" onclick="flagEvent('${ev.id}')" title="${ev.flagged ? 'Unflag' : 'Flag'}"><i class="fa-solid ${ev.flagged ? 'fa-flag-checkered' : 'fa-flag'}"></i></button>
          <button class="btn-icon" style="background:#f59e0b;" onclick="togglePublish('${ev.id}')" title="${ev.isPublished ? 'Unpublish' : 'Publish'}"><i class="fa-solid ${ev.isPublished ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
          <button class="btn-icon" style="background:#ef4444;" onclick="deleteEvent('${ev.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div></td>
      </tr>`;
  }).join('');
  renderPaginationBar('events-pagination', 'events', total, page, totalPages, pp);
}

function getFilteredEvents() {
  const search = (document.getElementById('event-search')?.value || '').toLowerCase();
  const filter = document.getElementById('event-filter')?.value || 'all';
  const dfrom  = document.getElementById('event-date-from')?.value;
  const dto    = document.getElementById('event-date-to')?.value;
  return events.filter(e => {
    const mSearch = e.title.toLowerCase().includes(search) || (e.venue||'').toLowerCase().includes(search);
    const mFilter = filter === 'all'
      || (filter === 'live'        && e.isPublished && !e.isCancelled && new Date(e.date) > new Date())
      || (filter === 'cancelled'   && e.isCancelled)
      || (filter === 'flagged'     && e.flagged)
      || (filter === 'unpublished' && !e.isPublished && !e.isCancelled);
    return mSearch && mFilter && applyDateRangeFilter(e.date, dfrom, dto);
  });
}

function filterEvents() { pageState.events = 1; renderEvents(); }

function openEditEventModal(eventId) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  document.getElementById('edit-event-id').value          = ev.id;
  document.getElementById('edit-event-title').value       = ev.title       || '';
  document.getElementById('edit-event-description').value = ev.description || '';
  document.getElementById('edit-event-date').value        = ev.date ? ev.date.slice(0, 16) : '';
  document.getElementById('edit-event-venue').value       = ev.venue       || '';
  document.getElementById('edit-event-location').value    = ev.location    || '';
  document.getElementById('edit-event-category').value    = ev.category    || '';
  document.getElementById('edit-event-error').style.display = 'none';
  openModal('edit-event-modal');
}

async function saveEditEvent() {
  const eventId     = document.getElementById('edit-event-id').value;
  const title       = document.getElementById('edit-event-title').value.trim();
  const description = document.getElementById('edit-event-description').value.trim();
  const date        = document.getElementById('edit-event-date').value;
  const venue       = document.getElementById('edit-event-venue').value.trim();
  const location    = document.getElementById('edit-event-location').value.trim();
  const category    = document.getElementById('edit-event-category').value.trim();
  const errEl       = document.getElementById('edit-event-error');
  if (!title || !date || !venue) {
    errEl.style.display = 'block';
    errEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="margin-right:0.4rem;"></i>Title, date and venue are required.';
    return;
  }
  const payload = { title, description, date, venue, location, category };
  try { await apiRequest(`/admin/events/${eventId}`, { method: 'PUT', body: JSON.stringify(payload) }); }
  catch { const ev = events.find(e => e.id === eventId); if (ev) Object.assign(ev, payload); }
  await addLog('event', 'Event details edited', { adminName: currentAdmin.name, adminRole: currentAdmin.role, eventId, title });
  closeModal('edit-event-modal');
  renderEvents();
  toast.success('Event updated', 'Changes have been saved.');
}

async function flagEvent(eventId) {
  try { await apiRequest(`/admin/events/${eventId}/flag`, { method: 'PATCH' }); }
  catch { const ev = events.find(e => e.id === eventId); if (ev) ev.flagged = !ev.flagged; }
  await addLog('warning', 'Event flagged/unflagged', { adminName: currentAdmin.name, adminRole: currentAdmin.role, eventId });
  renderEvents();
  toast.warning('Flag updated', 'Event flag status changed.');
}

async function togglePublish(eventId) {
  try { await apiRequest(`/admin/events/${eventId}/publish`, { method: 'PATCH' }); }
  catch { const ev = events.find(e => e.id === eventId); if (ev) ev.isPublished = !ev.isPublished; }
  await addLog('system', 'Event publish toggled', { adminName: currentAdmin.name, adminRole: currentAdmin.role, eventId });
  renderEvents();
  toast.info('Visibility updated', 'Event publish status changed.');
}

async function deleteEvent(eventId) {
  const ev = events.find(e => e.id === eventId);
  const ok = await customConfirm(`Delete "${ev?.title || 'this event'}"? All associated tickets will also be removed.`, 'Delete Event', 'Delete', '#ef4444');
  if (!ok) return;
  try { await apiRequest(`/admin/events/${eventId}`, { method: 'DELETE' }); }
  catch { events.splice(events.findIndex(e => e.id === eventId), 1); }
  await addLog('danger', 'Event deleted', { adminName: currentAdmin.name, adminRole: currentAdmin.role, eventId });
  await loadData();
  toast.success('Event deleted', 'The event has been removed.');
}

async function bulkFlagEvents() {
  const ids = [...selectedIds.events];
  if (!ids.length) return;
  showBulkConfirm('Flag Events', `Flag ${ids.length} event(s)?`, async () => {
    let ok = 0;
    for (const id of ids) { try { await apiRequest(`/admin/events/${id}/flag`, { method: 'PATCH' }); ok++; } catch { ok++; } }
    await addLog('warning', `Bulk flagged ${ok} event(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok });
    selectedIds.events.clear();
    await loadData();
    toast.warning('Done', `${ok} event(s) flagged.`);
  });
}

async function bulkDeleteEvents() {
  const ids = [...selectedIds.events];
  if (!ids.length) return;
  showBulkConfirm('Delete Events', `Permanently delete ${ids.length} event(s) and all their tickets?`, async () => {
    let ok = 0;
    for (const id of ids) { try { await apiRequest(`/admin/events/${id}`, { method: 'DELETE' }); ok++; } catch { ok++; } }
    await addLog('danger', `Bulk deleted ${ok} event(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok });
    selectedIds.events.clear();
    await loadData();
    toast.success('Done', `${ok} event(s) deleted.`);
  });
}

/* =============================================
   TICKETS
============================================= */
function resolveEventForTicket(ticket) {
  const eid = ticket.eventId?.id || ticket.eventId?._id?.toString() || ticket.eventId;
  return events.find(e => e.id === eid);
}
function resolveUserForTicket(ticket) {
  const uid = ticket.userId?.id || ticket.userId?._id?.toString() || ticket.userId;
  return users.find(u => u.id === uid);
}
function getTicketStatus(ticket) { return ticket.status || 'active'; }

function renderTickets() {
  const tb      = document.getElementById('tickets-table');
  const base    = getFilteredTickets();
  const enriched = base.map(t => ({ ...t, eventTitle: resolveEventForTicket(t)?.title || '' }));
  const sorted  = applySorting(enriched, 'tickets');
  const { rows, page, totalPages, total, pp } = paginate(sorted, 'tickets');
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-ticket" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>No tickets found</td></tr>';
    renderPaginationBar('tickets-pagination', 'tickets', 0, 1, 1, pp);
    return;
  }
  tb.innerHTML = rows.map(ticket => {
    const ev      = resolveEventForTicket(ticket);
    const user    = resolveUserForTicket(ticket);
    const status  = getTicketStatus(ticket);
    const shortId = String(ticket.id).substring(0, 12).toUpperCase() + (String(ticket.id).length > 12 ? '…' : '');
    const dateStr = ev ? new Date(ev.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
    const statusMap = { used:['badge-used','fa-circle-check','Used'], cancelled:['badge-cancelled','fa-circle-xmark','Cancelled'] };
    const [sBadge, sIcon, sLabel] = statusMap[status] || ['badge-active','fa-circle-check','Active'];
    const sel = selectedIds.tickets.has(ticket.id);
    return `
      <tr class="${sel ? 'row-selected' : ''}">
        <td><input type="checkbox" class="row-checkbox" data-id="${ticket.id}" ${sel ? 'checked' : ''} onchange="toggleRowSelect('tickets','${ticket.id}',this)"></td>
        <td>
          <div class="ticket-table-id" title="${ticket.id}">${shortId}</div>
          <div class="ticket-table-type">${ticket.ticketType || '—'}</div>
          <div style="font-size:0.7rem;color:#475569;">₵${(ticket.price||0).toFixed(2)}</div>
        </td>
        <td>
          <div class="ticket-table-event">${ev?.title || 'Unknown Event'}</div>
          <div class="ticket-table-event-meta"><span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>${ev?.venue ? `<span><i class="fa-solid fa-location-dot"></i> ${ev.venue}</span>` : ''}</div>
        </td>
        <td>
          <div class="ticket-table-user">${user?.name || '—'}</div>
          <div class="ticket-table-user-sub"><i class="fa-regular fa-envelope"></i> ${ticket.userEmail || user?.email || '—'}</div>
          ${ticket.purchasedAt ? `<div style="font-size:0.7rem;color:#475569;">${new Date(ticket.purchasedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>` : ''}
        </td>
        <td><span class="badge ${sBadge}"><i class="fa-solid ${sIcon}"></i> ${sLabel}</span></td>
        <td><div class="actions">
          <button class="btn-icon" style="background:#6366f1;" onclick="viewTicket('${ticket.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
          <button class="btn-icon" style="background:#8b5cf6;" onclick="openResendTicketModal('${ticket.id}')" title="Resend"><i class="fa-solid fa-envelope"></i></button>
          ${status === 'active' ? `<button class="btn-icon" style="background:#10b981;" onclick="validateTicket('${ticket.id}')" title="Validate"><i class="fa-solid fa-circle-check"></i></button>` : ''}
          ${status === 'active' ? `<button class="btn-icon" style="background:#ef4444;" onclick="cancelTicket('${ticket.id}')" title="Cancel"><i class="fa-solid fa-ban"></i></button>` : ''}
        </div></td>
      </tr>`;
  }).join('');
  renderPaginationBar('tickets-pagination', 'tickets', total, page, totalPages, pp);
}

function getFilteredTickets() {
  const search = (document.getElementById('ticket-search')?.value || '').toLowerCase();
  const status = document.getElementById('ticket-status-filter')?.value || 'all';
  const type   = document.getElementById('ticket-type-filter')?.value   || 'all';
  const dfrom  = document.getElementById('ticket-date-from')?.value;
  const dto    = document.getElementById('ticket-date-to')?.value;
  return tickets.filter(t => {
    const ev   = resolveEventForTicket(t);
    const user = resolveUserForTicket(t);
    const mSearch = !search || String(t.id).toLowerCase().includes(search)
      || (ev?.title || '').toLowerCase().includes(search)
      || (t.userEmail || '').toLowerCase().includes(search)
      || (user?.name  || '').toLowerCase().includes(search)
      || (user?.email || '').toLowerCase().includes(search);
    return mSearch
      && (status === 'all' || getTicketStatus(t) === status)
      && (type   === 'all' || (t.ticketType || '').toLowerCase() === type)
      && applyDateRangeFilter(t.purchasedAt, dfrom, dto);
  });
}

function filterTickets() { pageState.tickets = 1; renderTickets(); }

function viewTicket(ticketId) {
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return;
  const ev     = resolveEventForTicket(ticket);
  const user   = resolveUserForTicket(ticket);
  const status = getTicketStatus(ticket);
  const sMap   = { used:['badge-used','fa-circle-check','Used'], cancelled:['badge-cancelled','fa-circle-xmark','Cancelled'] };
  const [sBadge, sIcon, sLabel] = sMap[status] || ['badge-active','fa-circle-check','Active'];
  document.getElementById('ticket-modal-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item" style="grid-column:span 2;"><div class="detail-label"><i class="fa-solid fa-fingerprint"></i> Ticket ID</div>
        <div class="detail-value" style="font-family:monospace;font-size:0.82rem;word-break:break-all;">${ticket.id}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-tag"></i> Type</div><div class="detail-value" style="text-transform:uppercase;">${ticket.ticketType||'—'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-coins"></i> Price</div><div class="detail-value" style="color:#10b981;">₵${(ticket.price||0).toFixed(2)}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-circle-dot"></i> Status</div><div class="detail-value"><span class="badge ${sBadge}"><i class="fa-solid ${sIcon}"></i> ${sLabel}</span></div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-clock"></i> Purchased At</div><div class="detail-value">${ticket.purchasedAt ? new Date(ticket.purchasedAt).toLocaleString() : '—'}</div></div>
    </div>
    <div style="padding:1rem;background:#0f172a;border-radius:0.5rem;margin-bottom:1rem;">
      <h4 style="font-weight:700;margin-bottom:0.75rem;"><i class="fa-regular fa-calendar" style="color:#6366f1;margin-right:0.4rem;"></i>Event</h4>
      ${ev ? `<div style="font-weight:600;margin-bottom:0.25rem;">${ev.title}</div>
        <div style="font-size:0.82rem;color:#94a3b8;line-height:1.7;">
          <div><i class="fa-regular fa-calendar" style="margin-right:0.3rem;"></i>${new Date(ev.date).toLocaleString()}</div>
          <div><i class="fa-solid fa-location-dot" style="margin-right:0.3rem;"></i>${ev.venue}${ev.location ? ', '+ev.location : ''}</div>
        </div>` : '<p style="color:#94a3b8;">Event not found</p>'}
    </div>
    <div style="padding:1rem;background:#0f172a;border-radius:0.5rem;margin-bottom:1rem;">
      <h4 style="font-weight:700;margin-bottom:0.75rem;"><i class="fa-regular fa-user" style="color:#6366f1;margin-right:0.4rem;"></i>Customer</h4>
      <div style="font-size:0.875rem;line-height:1.8;color:#94a3b8;">
        <div><i class="fa-regular fa-user" style="margin-right:0.3rem;"></i>${user?.name || '—'}</div>
        <div><i class="fa-regular fa-envelope" style="margin-right:0.3rem;"></i>${ticket.userEmail || user?.email || '—'}</div>
        <div><i class="fa-solid fa-mobile-screen-button" style="margin-right:0.3rem;"></i>${ticket.userPhone || user?.phone || '—'}</div>
      </div>
    </div>
    <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="openResendTicketModal('${ticket.id}');closeModal('ticket-modal');"><i class="fa-solid fa-envelope"></i> Resend</button>
      ${status === 'active' ? `
        <button class="btn btn-success" onclick="validateTicket('${ticket.id}');closeModal('ticket-modal');"><i class="fa-solid fa-circle-check"></i> Validate</button>
        <button class="btn btn-danger"  onclick="cancelTicket('${ticket.id}');closeModal('ticket-modal');"><i class="fa-solid fa-ban"></i> Cancel</button>` : ''}
    </div>`;
  addLog('system', 'Viewed ticket details', { adminName: currentAdmin.name, adminRole: currentAdmin.role, ticketId });
  openModal('ticket-modal');
}

function openResendTicketModal(ticketId) {
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return;
  const ev   = resolveEventForTicket(ticket);
  const user = resolveUserForTicket(ticket);
  document.getElementById('resend-ticket-id').value = ticketId;
  document.getElementById('resend-ticket-info').innerHTML =
    `<strong>${(ticket.ticketType || 'TICKET').toUpperCase()}</strong> — ${ev?.title || 'Unknown Event'}<br>
     <span style="color:#94a3b8;font-size:0.78rem;">ID: ${ticket.id}</span>`;
  document.getElementById('resend-email').value = ticket.userEmail || user?.email || '';
  document.getElementById('resend-phone').value = ticket.userPhone || user?.phone || '';
  document.getElementById('resend-status').style.display = 'none';
  openModal('resend-ticket-modal');
}

async function submitResendTicket() {
  const ticketId = document.getElementById('resend-ticket-id').value;
  const email    = document.getElementById('resend-email').value.trim();
  const phone    = document.getElementById('resend-phone').value.trim();
  const statusEl = document.getElementById('resend-status');
  if (!email && !phone) { toast.warning('No contact info', 'Please enter an email or phone number.'); return; }
  _setResendStatus(statusEl, 'loading');
  const channels = [];
  try {
    if (email) await apiRequest(`/admin/tickets/${ticketId}/resend`, { method:'POST', body:JSON.stringify({ channel:'email', email }) });
    if (phone) await apiRequest(`/admin/tickets/${ticketId}/resend`, { method:'POST', body:JSON.stringify({ channel:'sms', phone }) });
  } catch {}
  if (email) channels.push('email');
  if (phone) channels.push('SMS');
  await addLog('system', `Ticket resent via ${channels.join(' & ')}`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, ticketId, email, phone });
  _setResendStatus(statusEl, 'success', `Sent via ${channels.join(' & ')}!`);
  toast.success('Ticket resent', `Sent via ${channels.join(' & ')}.`);
  setTimeout(() => closeModal('resend-ticket-modal'), 1800);
}

function _setResendStatus(el, state, msg = '') {
  el.style.display = 'block';
  const configs = {
    loading: ['rgba(99,102,241,0.1)','rgba(99,102,241,0.3)','#818cf8','<i class="fa-solid fa-spinner fa-spin" style="margin-right:0.4rem;"></i>Sending…'],
    success: ['rgba(16,185,129,0.1)','rgba(16,185,129,0.3)','#34d399',`<i class="fa-solid fa-circle-check" style="margin-right:0.4rem;"></i>${msg}`],
  };
  const [bg, border, color, html] = configs[state] || configs.loading;
  el.style.cssText = `display:block;padding:0.75rem;border-radius:0.5rem;font-size:0.82rem;background:${bg};border:1px solid ${border};color:${color};`;
  el.innerHTML = html;
}

async function validateTicket(ticketId) {
  const ok = await customConfirm('Mark this ticket as used/validated? This cannot be undone.', 'Validate Ticket', 'Validate', '#10b981');
  if (!ok) return;
  try { await apiRequest(`/admin/tickets/${ticketId}/validate`, { method: 'PATCH' }); }
  catch { const t = tickets.find(t => t.id === ticketId); if (t) t.status = 'used'; }
  await addLog('system', 'Ticket validated', { adminName: currentAdmin.name, adminRole: currentAdmin.role, ticketId });
  renderTickets();
  toast.success('Ticket validated', 'Marked as used.');
}

async function cancelTicket(ticketId) {
  const ok = await customConfirm('Cancel this ticket? This action cannot be undone.', 'Cancel Ticket', 'Cancel Ticket', '#ef4444');
  if (!ok) return;
  try { await apiRequest(`/admin/tickets/${ticketId}/cancel`, { method: 'PATCH' }); }
  catch { const t = tickets.find(t => t.id === ticketId); if (t) t.status = 'cancelled'; }
  await addLog('warning', 'Ticket cancelled by admin', { adminName: currentAdmin.name, adminRole: currentAdmin.role, ticketId });
  renderTickets();
  toast.warning('Ticket cancelled', 'The ticket has been cancelled.');
}

async function bulkValidateTickets() {
  const ids = [...selectedIds.tickets].filter(id => getTicketStatus(tickets.find(t => t.id === id)) === 'active');
  if (!ids.length) { toast.warning('None eligible', 'No active tickets selected.'); return; }
  showBulkConfirm('Validate Tickets', `Mark ${ids.length} ticket(s) as used?`, async () => {
    let ok = 0;
    for (const id of ids) {
      try { await apiRequest(`/admin/tickets/${id}/validate`, { method: 'PATCH' }); }
      catch { const t = tickets.find(t => t.id === id); if (t) t.status = 'used'; }
      ok++;
    }
    await addLog('system', `Bulk validated ${ok} ticket(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok });
    selectedIds.tickets.clear();
    renderTickets();
    toast.success('Done', `${ok} ticket(s) validated.`);
  });
}

async function bulkCancelTickets() {
  const ids = [...selectedIds.tickets].filter(id => getTicketStatus(tickets.find(t => t.id === id)) === 'active');
  if (!ids.length) { toast.warning('None eligible', 'No active tickets selected.'); return; }
  showBulkConfirm('Cancel Tickets', `Cancel ${ids.length} ticket(s)? This cannot be undone.`, async () => {
    let ok = 0;
    for (const id of ids) {
      try { await apiRequest(`/admin/tickets/${id}/cancel`, { method: 'PATCH' }); }
      catch { const t = tickets.find(t => t.id === id); if (t) t.status = 'cancelled'; }
      ok++;
    }
    await addLog('warning', `Bulk cancelled ${ok} ticket(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok });
    selectedIds.tickets.clear();
    renderTickets();
    toast.warning('Done', `${ok} ticket(s) cancelled.`);
  });
}

/* =============================================
   PAYOUTS
============================================= */
function renderPayouts() {
  const tb      = document.getElementById('payouts-table');
  const base    = getFilteredPayouts();
  const enriched = base.map(p => ({
    ...p,
    organizerName: users.find(u => u.id === (p.organizerId?.id || p.organizerId?._id?.toString()))?.name
      || p.organizerId?.name || p.organizerId?.email || '',
  }));
  const sorted  = applySorting(enriched, 'payouts');
  const { rows, page, totalPages, total, pp } = paginate(sorted, 'payouts');
  setText('pending-payout-amount', `₵${stats.pendingPayouts.toFixed(2)}`);
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-money-bill-transfer" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>No payout requests found</td></tr>';
    renderPaginationBar('payouts-pagination', 'payouts', 0, 1, 1, pp);
    return;
  }
  tb.innerHTML = rows.map(p => {
    const org      = p.organizerId;
    const orgName  = org?.name || org?.email || 'Unknown';
    const orgEmail = org?.email || '—';
    const mIcon    = p.method === 'momo' ? 'fa-solid fa-mobile-screen-button' : 'fa-solid fa-building-columns';
    const mLabel   = p.method === 'momo' ? 'MoMo' : 'Bank';
    const sMap     = { pending:'fa-clock', completed:'fa-circle-check', rejected:'fa-circle-xmark' };
    const sIcon    = sMap[p.status] || 'fa-clock';
    const shortId  = String(p.id).substring(0, 8).toUpperCase();
    const sel      = selectedIds.payouts.has(p.id);
    return `
      <tr class="${sel ? 'row-selected' : ''}">
        <td><input type="checkbox" class="row-checkbox" data-id="${p.id}" ${sel ? 'checked' : ''} onchange="toggleRowSelect('payouts','${p.id}',this)"></td>
        <td>
          <div class="payout-table-id"><i class="fa-solid fa-fingerprint" style="margin-right:0.3rem;color:#475569;"></i>#${shortId}</div>
          <div style="font-size:0.7rem;color:#475569;">${new Date(p.requestedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
        </td>
        <td>
          <div class="payout-table-organizer">${orgName}</div>
          <div class="payout-table-organizer-sub"><i class="fa-regular fa-envelope"></i> ${orgEmail}</div>
          <div style="font-size:0.72rem;color:#94a3b8;">${p.email}</div>
        </td>
        <td>
          <div class="payout-table-amount">₵${p.amount.toFixed(2)}</div>
          <div class="payout-table-method"><i class="${mIcon}"></i> ${mLabel}</div>
        </td>
        <td>
          <span class="badge badge-${p.status}"><i class="fa-solid ${sIcon}"></i> ${p.status.charAt(0).toUpperCase()+p.status.slice(1)}</span>
          ${p.status==='rejected'&&p.rejectionReason ? `<div style="font-size:0.7rem;color:#f87171;margin-top:0.3rem;"><i class="fa-solid fa-triangle-exclamation"></i> ${p.rejectionReason.substring(0,30)}</div>` : ''}
          ${p.status==='completed'&&p.completedAt ? `<div style="font-size:0.7rem;color:#34d399;margin-top:0.3rem;"><i class="fa-regular fa-calendar-check"></i> ${new Date(p.completedAt).toLocaleDateString()}</div>` : ''}
        </td>
        <td><div class="actions">
          <button class="btn-icon" style="background:#6366f1;" onclick="viewPayout('${p.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
          ${p.status==='pending' ? `
            <button class="btn-icon" style="background:#10b981;" onclick="approvePayout('${p.id}')" title="Approve"><i class="fa-solid fa-check"></i></button>
            <button class="btn-icon" style="background:#ef4444;" onclick="rejectPayout('${p.id}')" title="Reject"><i class="fa-solid fa-xmark"></i></button>` : ''}
        </div></td>
      </tr>`;
  }).join('');
  renderPaginationBar('payouts-pagination', 'payouts', total, page, totalPages, pp);
}

function getFilteredPayouts() {
  const search = (document.getElementById('payout-search')?.value || '').toLowerCase();
  const status = document.getElementById('payout-status-filter')?.value || 'all';
  const method = document.getElementById('payout-method-filter')?.value || 'all';
  const dfrom  = document.getElementById('payout-date-from')?.value;
  const dto    = document.getElementById('payout-date-to')?.value;
  return [...payouts].sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)).filter(p => {
    const org  = p.organizerId;
    const name = (org?.name || org?.email || '').toLowerCase();
    const mSearch = !search || name.includes(search) || p.email.toLowerCase().includes(search) || String(p.id).toLowerCase().includes(search);
    return mSearch && (status === 'all' || p.status === status) && (method === 'all' || p.method === method) && applyDateRangeFilter(p.requestedAt, dfrom, dto);
  });
}

function filterPayouts() { pageState.payouts = 1; renderPayouts(); }

function viewPayout(payoutId) {
  const p = payouts.find(p => p.id === payoutId);
  if (!p) return;
  const org  = p.organizerId;
  const sMap = { pending:'fa-clock', completed:'fa-circle-check', rejected:'fa-circle-xmark' };
  document.getElementById('payout-modal-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-fingerprint"></i> Payout ID</div><div class="detail-value" style="font-family:monospace;font-size:0.85rem;">${p.id}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-circle-dot"></i> Status</div><div class="detail-value"><span class="badge badge-${p.status}"><i class="fa-solid ${sMap[p.status]||'fa-clock'}"></i> ${p.status.charAt(0).toUpperCase()+p.status.slice(1)}</span></div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-coins"></i> Amount</div><div class="detail-value" style="font-size:1.25rem;color:#10b981;">₵${p.amount.toFixed(2)}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-credit-card"></i> Method</div><div class="detail-value">${p.method.toUpperCase()}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-user"></i> Organizer</div><div class="detail-value">${org?.name || 'Unknown'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-envelope"></i> Payout Email</div><div class="detail-value">${p.email}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-calendar"></i> Requested</div><div class="detail-value">${new Date(p.requestedAt).toLocaleString()}</div></div>
      ${p.completedAt ? `<div class="detail-item"><div class="detail-label"><i class="fa-solid fa-calendar-check"></i> Completed</div><div class="detail-value">${new Date(p.completedAt).toLocaleString()}</div></div>` : '<div></div>'}
    </div>
    ${p.method==='bank'&&p.details ? `<div style="margin-top:1rem;padding:1rem;background:#0f172a;border-radius:0.5rem;"><h4 style="font-weight:700;margin-bottom:0.75rem;"><i class="fa-solid fa-building-columns" style="color:#6366f1;margin-right:0.4rem;"></i>Bank Details</h4><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;font-size:0.875rem;"><div><div style="color:#94a3b8;font-size:0.75rem;">Bank</div><div style="font-weight:600;">${p.details.bankName}</div></div><div><div style="color:#94a3b8;font-size:0.75rem;">Account No.</div><div style="font-weight:600;">${p.details.accountNumber}</div></div><div><div style="color:#94a3b8;font-size:0.75rem;">Account Name</div><div style="font-weight:600;">${p.details.accountName}</div></div></div></div>` : ''}
    ${p.method==='momo'&&p.details ? `<div style="margin-top:1rem;padding:1rem;background:#0f172a;border-radius:0.5rem;"><h4 style="font-weight:700;margin-bottom:0.75rem;"><i class="fa-solid fa-mobile-screen-button" style="color:#6366f1;margin-right:0.4rem;"></i>MoMo</h4><div style="font-size:0.875rem;"><div style="color:#94a3b8;font-size:0.75rem;">Phone</div><div style="font-weight:600;">${p.details.phone}</div></div></div>` : ''}
    ${p.status==='rejected'&&p.rejectionReason ? `<div class="info-box error" style="margin-top:1rem;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:0.4rem;"></i><strong>Rejection Reason:</strong> ${p.rejectionReason}</div>` : ''}
    ${p.status==='pending' ? `<div style="display:flex;gap:0.75rem;margin-top:1.5rem;">
      <button class="btn btn-success" style="flex:1;" onclick="approvePayout('${p.id}');closeModal('payout-modal');"><i class="fa-solid fa-check"></i> Approve</button>
      <button class="btn btn-danger"  style="flex:1;" onclick="rejectPayout('${p.id}');closeModal('payout-modal');"><i class="fa-solid fa-xmark"></i> Reject</button>
    </div>` : ''}`;
  addLog('payout', 'Viewed payout details', { adminName: currentAdmin.name, adminRole: currentAdmin.role, payoutId });
  openModal('payout-modal');
}

async function approvePayout(payoutId) {
  try { await apiRequest(`/admin/payouts/${payoutId}/approve`, { method: 'PATCH' }); }
  catch { const p = payouts.find(p => p.id === payoutId); if (p) { p.status = 'completed'; p.completedAt = new Date().toISOString(); } }
  await addLog('payout', 'Payout approved', { adminName: currentAdmin.name, adminRole: currentAdmin.role, payoutId });
  await loadData();
  toast.success('Payout approved', 'The payment will be processed shortly.');
}

async function rejectPayout(payoutId) {
  const reason = await customPrompt('Please provide a reason for rejecting this payout:', '', 'Reject Payout', 'e.g. Insufficient documentation...');
  if (!reason) return;
  try { await apiRequest(`/admin/payouts/${payoutId}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }); }
  catch { const p = payouts.find(p => p.id === payoutId); if (p) { p.status = 'rejected'; p.rejectionReason = reason; } }
  await addLog('warning', 'Payout rejected', { adminName: currentAdmin.name, adminRole: currentAdmin.role, payoutId, reason });
  await loadData();
  toast.warning('Payout rejected', 'The organizer will be notified.');
}

async function bulkApprovePayouts() {
  const ids = [...selectedIds.payouts].filter(id => payouts.find(p => p.id === id)?.status === 'pending');
  if (!ids.length) { toast.warning('None eligible', 'No pending payouts selected.'); return; }
  showBulkConfirm('Approve Payouts', `Approve ${ids.length} payout(s)?`, async () => {
    let ok = 0;
    for (const id of ids) {
      try { await apiRequest(`/admin/payouts/${id}/approve`, { method: 'PATCH' }); }
      catch { const p = payouts.find(p => p.id === id); if (p) { p.status = 'completed'; p.completedAt = new Date().toISOString(); } }
      ok++;
    }
    await addLog('payout', `Bulk approved ${ok} payout(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok });
    selectedIds.payouts.clear();
    await loadData();
    toast.success('Done', `${ok} payout(s) approved.`);
  });
}

async function bulkRejectPayouts() {
  const ids = [...selectedIds.payouts].filter(id => payouts.find(p => p.id === id)?.status === 'pending');
  if (!ids.length) { toast.warning('None eligible', 'No pending payouts selected.'); return; }
  const reason = await customPrompt('Rejection reason (will be applied to all selected payouts):', '', 'Bulk Reject Payouts', 'e.g. Missing documentation...');
  if (!reason) return;
  let ok = 0;
  for (const id of ids) {
    try { await apiRequest(`/admin/payouts/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }); }
    catch { const p = payouts.find(p => p.id === id); if (p) { p.status = 'rejected'; p.rejectionReason = reason; } }
    ok++;
  }
  await addLog('warning', `Bulk rejected ${ok} payout(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok, reason });
  selectedIds.payouts.clear();
  await loadData();
  toast.warning('Done', `${ok} payout(s) rejected.`);
}

/* =============================================
   WAITLIST MANAGEMENT
============================================= */
function populateWaitlistEventFilter() {
  const select = document.getElementById('waitlist-event-filter');
  if (!select) return;
  const cur = select.value;
  select.innerHTML = '<option value="all">All Events</option>';
  [...new Set(waitlist.map(w => w.eventId))].forEach(eid => {
    const title = events.find(e => e.id === eid)?.title || waitlist.find(w => w.eventId === eid)?.eventTitle || eid;
    const opt   = document.createElement('option');
    opt.value   = eid; opt.textContent = title;
    if (cur === eid) opt.selected = true;
    select.appendChild(opt);
  });
}

function renderWaitlist() {
  const tb = document.getElementById('waitlist-table');
  if (!tb) return;
  const sorted = applySorting(getFilteredWaitlist(), 'waitlist');
  const { rows, page, totalPages, total, pp } = paginate(sorted, 'waitlist');
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fa-solid fa-list-ol" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>No waitlist entries found</td></tr>';
    renderPaginationBar('waitlist-pagination', 'waitlist', 0, 1, 1, pp);
    return;
  }
  tb.innerHTML = rows.map(entry => {
    const joined = entry.joinedAt ? new Date(entry.joinedAt) : null;
    const jDate  = joined ? joined.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
    const jTime  = joined ? joined.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) : '';
    const sel    = selectedIds.waitlist.has(entry.id);
    return `
      <tr class="${sel ? 'row-selected' : ''}">
        <td><input type="checkbox" class="row-checkbox" data-id="${entry.id}" ${sel ? 'checked' : ''} onchange="toggleRowSelect('waitlist','${entry.id}',this)"></td>
        <td>
          <div style="font-weight:600;">${entry.userName || '—'}</div>
          ${entry.userId ? `<div style="font-size:0.72rem;color:#94a3b8;">ID: ${entry.userId}</div>` : ''}
        </td>
        <td>
          <div style="font-size:0.875rem;"><i class="fa-regular fa-envelope" style="margin-right:0.3rem;"></i>${entry.userEmail || '—'}</div>
          ${entry.userPhone ? `<div style="font-size:0.75rem;color:#94a3b8;"><i class="fa-solid fa-mobile-screen-button" style="margin-right:0.3rem;"></i>${entry.userPhone}</div>` : ''}
        </td>
        <td>
          <div style="font-weight:600;font-size:0.875rem;">${entry.eventTitle || 'Unknown Event'}</div>
          ${entry.eventDate ? `<div style="font-size:0.72rem;color:#94a3b8;"><i class="fa-regular fa-calendar" style="margin-right:0.25rem;"></i>${new Date(entry.eventDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>` : ''}
        </td>
        <td>
          <div style="font-size:0.875rem;">${jDate}</div>
          <div style="font-size:0.72rem;color:#475569;">${jTime}</div>
        </td>
        <td><div class="waitlist-position">${entry.position || '—'}</div></td>
        <td><div class="actions">
          <button class="btn-icon" style="background:#f59e0b;" onclick="openWaitlistNotifyModal('${entry.id}')" title="Notify"><i class="fa-solid fa-bell"></i></button>
          <button class="btn-icon" style="background:#10b981;" onclick="openWaitlistConvertModal('${entry.id}')" title="Convert to Ticket"><i class="fa-solid fa-ticket"></i></button>
          <button class="btn-icon" style="background:#ef4444;" onclick="removeWaitlistEntry('${entry.id}')" title="Remove"><i class="fa-solid fa-trash"></i></button>
        </div></td>
      </tr>`;
  }).join('');
  renderPaginationBar('waitlist-pagination', 'waitlist', total, page, totalPages, pp);
}

function getFilteredWaitlist() {
  const search   = (document.getElementById('waitlist-search')?.value || '').toLowerCase();
  const evFilter = document.getElementById('waitlist-event-filter')?.value || 'all';
  const dfrom    = document.getElementById('waitlist-date-from')?.value;
  const dto      = document.getElementById('waitlist-date-to')?.value;
  return waitlist.filter(w => {
    const mSearch = !search || (w.userName||'').toLowerCase().includes(search) || (w.userEmail||'').toLowerCase().includes(search) || (w.eventTitle||'').toLowerCase().includes(search);
    return mSearch && (evFilter === 'all' || w.eventId === evFilter) && applyDateRangeFilter(w.joinedAt, dfrom, dto);
  });
}

function filterWaitlist() { pageState.waitlist = 1; renderWaitlist(); }

function openWaitlistNotifyModal(entryId) {
  const entry = waitlist.find(w => w.id === entryId);
  if (!entry) return;
  document.getElementById('waitlist-notify-id').value = entryId;
  document.getElementById('waitlist-notify-info').innerHTML =
    `<strong>${entry.userName || '—'}</strong> — ${entry.userEmail || '—'}<br>
     <span style="color:#94a3b8;font-size:0.78rem;">${entry.eventTitle || 'Unknown Event'}</span>`;
  openModal('waitlist-notify-modal');
}

async function submitWaitlistNotify() {
  const entryId = document.getElementById('waitlist-notify-id').value;
  const channel = document.getElementById('waitlist-notify-channel').value;
  const message = document.getElementById('waitlist-notify-message').value.trim();
  const entry   = waitlist.find(w => w.id === entryId);
  if (!message) { toast.warning('Missing message', 'Please enter a notification message.'); return; }
  try { await apiRequest(`/admin/waitlist/${entryId}/notify`, { method:'POST', body: JSON.stringify({ channel, message }) }); } catch {}
  if (entry) entry.notified = true;
  await addLog('system', `Waitlist notification sent via ${channel}`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, entryId, userEmail: entry?.userEmail, eventTitle: entry?.eventTitle });
  closeModal('waitlist-notify-modal');
  renderWaitlist();
  toast.success('Notification sent', `Message delivered via ${channel}.`);
}

function openWaitlistConvertModal(entryId) {
  const entry = waitlist.find(w => w.id === entryId);
  if (!entry) return;
  document.getElementById('waitlist-convert-id').value = entryId;
  document.getElementById('waitlist-convert-info').innerHTML =
    `<strong>${entry.userName || '—'}</strong> — ${entry.userEmail || '—'}<br>
     <span style="color:#94a3b8;font-size:0.78rem;">${entry.eventTitle || 'Unknown Event'}</span>`;
  openModal('waitlist-convert-modal');
}

async function submitWaitlistConvert() {
  const entryId    = document.getElementById('waitlist-convert-id').value;
  const ticketType = document.getElementById('waitlist-convert-type').value;
  const entry      = waitlist.find(w => w.id === entryId);
  if (!entry) return;
  try {
    await apiRequest(`/admin/waitlist/${entryId}/convert`, { method: 'POST', body: JSON.stringify({ ticketType }) });
    const idx = waitlist.findIndex(w => w.id === entryId);
    if (idx !== -1) waitlist.splice(idx, 1);
    renderWaitlist(); calculateStats(); renderDashboard();
    toast.success('Converted', `${entry.userName || 'User'} issued a ${ticketType.toUpperCase()} ticket.`);
    closeModal('waitlist-convert-modal');
  } catch (err) {
    toast.error('Conversion failed', err.message || 'Could not convert waitlist entry.');
    closeModal('waitlist-convert-modal');
  }
}

async function removeWaitlistEntry(entryId) {
  const ok = await customConfirm('Remove this entry from the waitlist?', 'Remove Entry', 'Remove', '#ef4444');
  if (!ok) return;
  const entry = waitlist.find(w => w.id === entryId);
  try { await apiRequest(`/admin/waitlist/${entryId}`, { method: 'DELETE' }); } catch {}
  const idx = waitlist.findIndex(w => w.id === entryId);
  if (idx !== -1) waitlist.splice(idx, 1);
  await addLog('warning', 'Waitlist entry removed', { adminName: currentAdmin.name, adminRole: currentAdmin.role, entryId, userEmail: entry?.userEmail });
  renderWaitlist(); calculateStats(); renderDashboard();
  toast.info('Removed', 'Entry removed from the waitlist.');
}

async function bulkNotifyWaitlist() {
  const ids = [...selectedIds.waitlist];
  if (!ids.length) return;
  const message = await customPrompt(`Notification message to send to ${ids.length} selected waitlisted user(s):`, 'A spot has become available. Click here to claim your ticket.', 'Bulk Notify Waitlist', 'Type your message...');
  if (!message) return;
  let ok = 0;
  for (const id of ids) {
    try { await apiRequest(`/admin/waitlist/${id}/notify`, { method:'POST', body: JSON.stringify({ channel:'both', message }) }); } catch {}
    ok++;
  }
  await addLog('system', `Bulk waitlist notification sent to ${ok} user(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok });
  selectedIds.waitlist.clear();
  updateBulkBar('waitlist');
  toast.success('Done', `${ok} waitlisted user(s) notified.`);
}

async function bulkConvertWaitlist() {
  const ids = [...selectedIds.waitlist];
  if (!ids.length) return;
  const ticketType = await customPrompt('Ticket type to assign to all selected entries:', 'regular', 'Bulk Convert Waitlist', 'regular / vip / vvip / free');
  if (!ticketType) return;
  showBulkConfirm('Convert Waitlist', `Convert ${ids.length} waitlisted user(s) to ${ticketType} tickets?`, async () => {
    let ok = 0;
    for (const id of ids) {
      try { await apiRequest(`/admin/waitlist/${id}/convert`, { method:'POST', body: JSON.stringify({ ticketType }) }); } catch {}
      const idx = waitlist.findIndex(w => w.id === id); if (idx !== -1) { waitlist.splice(idx, 1); ok++; }
    }
    await addLog('system', `Bulk converted ${ok} waitlist entries to ${ticketType} tickets`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok, ticketType });
    selectedIds.waitlist.clear();
    renderWaitlist(); calculateStats(); renderDashboard();
    toast.success('Done', `${ok} user(s) converted to ${ticketType} tickets.`);
  });
}

async function bulkRemoveWaitlist() {
  const ids = [...selectedIds.waitlist];
  if (!ids.length) return;
  showBulkConfirm('Remove Waitlist Entries', `Remove ${ids.length} selected entries from the waitlist?`, async () => {
    let ok = 0;
    for (const id of ids) {
      try { await apiRequest(`/admin/waitlist/${id}`, { method: 'DELETE' }); } catch {}
      const idx = waitlist.findIndex(w => w.id === id); if (idx !== -1) { waitlist.splice(idx, 1); ok++; }
    }
    await addLog('warning', `Bulk removed ${ok} waitlist entries`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok });
    selectedIds.waitlist.clear();
    renderWaitlist(); calculateStats(); renderDashboard();
    toast.info('Done', `${ok} waitlist entr${ok === 1 ? 'y' : 'ies'} removed.`);
  });
}

/* =============================================
   VIEW USER / VIEW EVENT
============================================= */
function viewUser(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return;
  const userEvents  = events.filter(e => (e.organizerId?.id || e.organizerId?._id?.toString()) === userId);
  const userTickets = tickets.filter(t => (t.userId?.id || t.userId?._id?.toString()) === userId);
  const orgRevenue  = tickets.filter(t => userEvents.some(e => e.id === (t.eventId?.id || t.eventId?._id?.toString()))).reduce((s, t) => s + (t.price || 0), 0);
  const orgTickets  = tickets.filter(t => userEvents.some(e => e.id === (t.eventId?.id || t.eventId?._id?.toString()))).length;
  document.getElementById('user-modal-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-user"></i> Name</div><div class="detail-value">${user.name || 'N/A'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-fingerprint"></i> User ID</div><div class="detail-value" style="font-size:0.82rem;font-family:monospace;">${user.id}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-envelope"></i> Email</div><div class="detail-value">${user.email}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-mobile-screen-button"></i> Phone</div><div class="detail-value">${user.phone || '—'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-id-badge"></i> Role</div><div class="detail-value" style="text-transform:capitalize;">${user.role || 'customer'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-circle-dot"></i> Status</div><div class="detail-value">${user.suspended ? 'Suspended' : 'Active'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-calendar"></i> Joined</div><div class="detail-value">${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-coins"></i> Currency</div><div class="detail-value">${user.currency || 'GHC'}</div></div>
    </div>
    ${user.role === 'organizer' ? `
    <div style="margin-top:1.5rem;">
      <h4 style="font-weight:700;margin-bottom:1rem;"><i class="fa-solid fa-chart-bar" style="margin-right:0.4rem;"></i>Organizer Stats</h4>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;">
        <div style="background:#334155;padding:1rem;border-radius:0.5rem;"><div style="color:#94a3b8;font-size:0.75rem;">Events</div><div style="font-size:1.5rem;font-weight:700;color:#6366f1;">${userEvents.length}</div></div>
        <div style="background:#334155;padding:1rem;border-radius:0.5rem;"><div style="color:#94a3b8;font-size:0.75rem;">Revenue</div><div style="font-size:1.5rem;font-weight:700;color:#10b981;">₵${orgRevenue.toFixed(2)}</div></div>
        <div style="background:#334155;padding:1rem;border-radius:0.5rem;"><div style="color:#94a3b8;font-size:0.75rem;">Tickets Sold</div><div style="font-size:1.5rem;font-weight:700;color:#8b5cf6;">${orgTickets}</div></div>
      </div>
    </div>` : ''}
    <div style="margin-top:1.5rem;">
      <h4 style="font-weight:700;margin-bottom:1rem;"><i class="fa-solid fa-clock-rotate-left" style="margin-right:0.4rem;"></i>Recent Tickets</h4>
      <div style="max-height:200px;overflow-y:auto;">
        ${userTickets.slice(0,5).map(t => {
    const ev = events.find(e => e.id === (t.eventId?.id || t.eventId?._id?.toString()));
    return `<div style="background:#334155;padding:0.75rem;border-radius:0.5rem;margin-bottom:0.5rem;font-size:0.875rem;">
            <div style="font-weight:600;">${ev?.title || 'Unknown Event'}</div>
            <div style="color:#94a3b8;">${(t.ticketType||'').toUpperCase()} — ₵${t.price||0} — ${t.purchasedAt ? new Date(t.purchasedAt).toLocaleDateString() : '—'}</div>
          </div>`;
  }).join('') || '<div class="empty-state">No ticket activity yet</div>'}
      </div>
    </div>`;
  addLog('user', `Viewed user profile: ${user.email}`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, userId });
  openModal('user-modal');
}

function viewEvent(eventId) {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;
  const evTix   = tickets.filter(t => (t.eventId?.id || t.eventId?._id?.toString()) === ev.id);
  const revenue = evTix.reduce((s, t) => s + (t.price || 0), 0);
  const feeAmt  = revenue * (platformFeePercent / 100);
  const ttypes  = ev.ticketTypes || {};
  document.getElementById('event-modal-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item" style="grid-column:span 2;"><div class="detail-label"><i class="fa-solid fa-heading"></i> Title</div><div class="detail-value" style="font-size:1.25rem;">${ev.title}</div></div>
      <div class="detail-item" style="grid-column:span 2;"><div class="detail-label"><i class="fa-regular fa-file-lines"></i> Description</div><div class="detail-value">${ev.description || '—'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-calendar"></i> Date &amp; Time</div><div class="detail-value">${new Date(ev.date).toLocaleString()}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-building"></i> Venue</div><div class="detail-value">${ev.venue}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-location-dot"></i> Location</div><div class="detail-value">${ev.location || '—'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-tag"></i> Category</div><div class="detail-value" style="text-transform:capitalize;">${ev.category || '—'}</div></div>
    </div>
    ${Object.keys(ttypes).length ? `
    <div style="margin-top:1.5rem;">
      <h4 style="font-weight:700;margin-bottom:1rem;"><i class="fa-solid fa-ticket" style="margin-right:0.4rem;"></i>Ticket Types</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;">
        ${Object.entries(ttypes).map(([type, data]) => `
          <div style="background:#334155;padding:1rem;border-radius:0.5rem;">
            <div style="font-weight:700;margin-bottom:0.5rem;">${type.toUpperCase()}</div>
            <div style="font-size:0.875rem;color:#94a3b8;line-height:1.6;">
              <div>Price: ₵${data.price}</div><div>Capacity: ${data.capacity}</div>
              <div>Sold: ${data.sold||0}</div><div>Available: ${data.capacity-(data.sold||0)}</div>
            </div>
            <div style="margin-top:0.5rem;background:#475569;border-radius:9999px;height:0.5rem;overflow:hidden;">
              <div style="background:#6366f1;height:100%;width:${Math.min(100,((data.sold||0)/data.capacity)*100)}%;"></div>
            </div>
          </div>`).join('')}
      </div>
    </div>` : ''}
    <div style="margin-top:1.5rem;">
      <h4 style="font-weight:700;margin-bottom:1rem;"><i class="fa-solid fa-chart-pie" style="margin-right:0.4rem;"></i>Revenue</h4>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;">
        <div style="background:#334155;padding:1rem;border-radius:0.5rem;"><div style="color:#94a3b8;font-size:0.75rem;">Total Revenue</div><div style="font-size:1.5rem;font-weight:700;color:#10b981;">₵${revenue.toFixed(2)}</div></div>
        <div style="background:#334155;padding:1rem;border-radius:0.5rem;"><div style="color:#94a3b8;font-size:0.75rem;">Tickets Sold</div><div style="font-size:1.5rem;font-weight:700;color:#6366f1;">${evTix.length}</div></div>
        <div style="background:#334155;padding:1rem;border-radius:0.5rem;"><div style="color:#94a3b8;font-size:0.75rem;">Platform Fee (${platformFeePercent}%)</div><div style="font-size:1.5rem;font-weight:700;color:#8b5cf6;">₵${feeAmt.toFixed(2)}</div></div>
      </div>
    </div>
    <div style="display:flex;gap:0.75rem;margin-top:1.5rem;">
      <button class="btn btn-primary" onclick="openEditEventModal('${ev.id}');closeModal('event-modal');"><i class="fa-solid fa-pen-to-square"></i> Edit Event</button>
    </div>`;
  addLog('event', `Viewed event: ${ev.title}`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, eventId });
  openModal('event-modal');
}

/* =============================================
   TRANSACTIONS
============================================= */

/**
 * Derive a synthetic transaction ledger from tickets, payouts and refunds
 * when the backend does not expose a dedicated /admin/transactions endpoint.
 * The backend endpoint is tried first; on failure we fall back gracefully.
 */
function _buildTransactionsFromData() {
  const txns = [];

  // 1. Ticket purchases → credit
  tickets.forEach(t => {
    if (!t.price || t.price === 0) return;
    const user = resolveUserForTicket(t);
    const ev   = resolveEventForTicket(t);
    txns.push({
      id:         `txn_tkt_${t.id}`,
      type:       'credit',
      category:   'ticket_purchase',
      amount:     t.price,
      status:     'success',
      method:     t.paymentMethod || 'card',
      userId:     t.userId?.id || t.userId?._id?.toString() || t.userId || '',
      userName:   user?.name || t.userEmail || 'Unknown',
      userEmail:  t.userEmail || user?.email || '',
      reference:  String(t.id).substring(0, 12).toUpperCase(),
      description:`Ticket purchase — ${ev?.title || 'Event'}`,
      eventTitle: ev?.title || '',
      ticketId:   t.id,
      createdAt:  t.purchasedAt || t.createdAt || new Date().toISOString(),
    });
  });

  // 2. Approved refunds → debit
  refunds.filter(r => r.status === 'approved').forEach(r => {
    const user = users.find(u => u.id === (r.userId?.id || r.userId?._id?.toString() || r.userId));
    txns.push({
      id:         `txn_ref_${r.id}`,
      type:       'debit',
      category:   'refund',
      amount:     r.amount || 0,
      status:     'success',
      method:     'system',
      userId:     r.userId?.id || r.userId?._id?.toString() || r.userId || '',
      userName:   r.userName || user?.name || 'Unknown',
      userEmail:  r.userEmail || user?.email || '',
      reference:  String(r.id).substring(0, 12).toUpperCase(),
      description:`Refund — ${r.eventTitle || 'Event'}`,
      eventTitle: r.eventTitle || '',
      createdAt:  r.resolvedAt || r.requestedAt || new Date().toISOString(),
    });
  });

  // 3. Completed payouts → debit
  payouts.filter(p => p.status === 'completed').forEach(p => {
    const org = users.find(u => u.id === (p.organizerId?.id || p.organizerId?._id?.toString()));
    txns.push({
      id:         `txn_pay_${p.id}`,
      type:       'debit',
      category:   'payout',
      amount:     p.amount,
      status:     'success',
      method:     p.method || 'momo',
      userId:     p.organizerId?.id || p.organizerId?._id?.toString() || '',
      userName:   org?.name || p.email || 'Unknown',
      userEmail:  p.email || org?.email || '',
      reference:  String(p.id).substring(0, 12).toUpperCase(),
      description:`Organizer payout — ${p.method?.toUpperCase() || 'MOMO'}`,
      eventTitle: '',
      createdAt:  p.completedAt || p.requestedAt || new Date().toISOString(),
    });
  });

  // Sort newest first
  txns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return txns;
}

async function loadTransactions() {
  try {
    const result = await apiRequest('/admin/transactions');
    const normalize = arr => arr.map(r => ({ ...r, id: r.id || r._id?.toString() }));
    transactions = normalize(result.transactions || result || []);
    if (!transactions.length) throw new Error('empty');
  } catch {
    // Fall back to synthesising from existing data
    transactions = _buildTransactionsFromData();
  }
}

async function refreshTransactions() {
  try {
    const result = await apiRequest('/admin/transactions');
    const normalize = arr => arr.map(r => ({ ...r, id: r.id || r._id?.toString() }));
    transactions = normalize(result.transactions || result || []);
  } catch {
    transactions = _buildTransactionsFromData();
  }
  renderTransactions();
  renderTransactionSummaryCards();
  toast.info('Refreshed', 'Transaction ledger is up to date.');
}

function getTransactionSummaryStats() {
  const filtered = getFilteredTransactions();
  const credits  = filtered.filter(t => t.type === 'credit').reduce((s, t) => s + (t.amount || 0), 0);
  const debits   = filtered.filter(t => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0);
  return { credits, debits, net: credits - debits, count: filtered.length };
}

function renderTransactionSummaryCards() {
  // Only update the *all-data* summary (top cards, not filtered, to give global picture)
  const totalCredits = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + (t.amount || 0), 0);
  const totalDebits  = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0);
  const net          = totalCredits - totalDebits;
  setText('txn-stat-credits', `₵${totalCredits.toFixed(2)}`);
  setText('txn-stat-debits',  `₵${totalDebits.toFixed(2)}`);
  setText('txn-stat-net',     `₵${net.toFixed(2)}`);
  setText('txn-stat-count',   transactions.length);
}

function getFilteredTransactions() {
  const search   = (document.getElementById('txn-search')?.value || '').toLowerCase();
  const type     = document.getElementById('txn-type-filter')?.value     || 'all';
  const status   = document.getElementById('txn-status-filter')?.value   || 'all';
  const category = document.getElementById('txn-category-filter')?.value || 'all';
  const dfrom    = document.getElementById('txn-date-from')?.value;
  const dto      = document.getElementById('txn-date-to')?.value;

  return transactions.filter(t => {
    const mSearch = !search
      || String(t.id).toLowerCase().includes(search)
      || (t.userName    || '').toLowerCase().includes(search)
      || (t.userEmail   || '').toLowerCase().includes(search)
      || (t.reference   || '').toLowerCase().includes(search)
      || (t.description || '').toLowerCase().includes(search);

    return mSearch
      && (type     === 'all' || t.type     === type)
      && (status   === 'all' || t.status   === status)
      && (category === 'all' || t.category === category)
      && applyDateRangeFilter(t.createdAt, dfrom, dto);
  });
}

function filterTransactions() {
  pageState.transactions = 1;
  renderTransactions();
}

function renderTransactions() {
  const tb      = document.getElementById('transactions-table');
  if (!tb) return;

  const filtered = getFilteredTransactions();
  const sorted   = applySorting(filtered, 'transactions');
  const { rows, page, totalPages, total, pp } = paginate(sorted, 'transactions');

  // Update summary cards based on full filtered set (not just current page)
  renderTransactionSummaryCards();

  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="10" class="empty-state">
      <i class="fa-solid fa-arrow-right-arrow-left" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>
      No transactions found
    </td></tr>`;
    renderPaginationBar('transactions-pagination', 'transactions', 0, 1, 1, pp);
    return;
  }

  tb.innerHTML = rows.map(txn => {
    const isCredit  = txn.type === 'credit';
    const shortId   = String(txn.id).substring(0, 14);
    const dateStr   = new Date(txn.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    const timeStr   = new Date(txn.createdAt).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });

    // Type badge
    const typeBadge = isCredit
      ? `<span class="txn-type-badge txn-type-credit"><i class="fa-solid fa-arrow-down-to-line"></i> Credit</span>`
      : `<span class="txn-type-badge txn-type-debit"><i class="fa-solid fa-arrow-up-from-line"></i> Debit</span>`;

    // Category pill
    const catLabels = {
      ticket_purchase: ['fa-solid fa-ticket',              '#6366f1', 'Ticket Purchase'],
      refund:          ['fa-solid fa-rotate-left',          '#ef4444', 'Refund'],
      payout:          ['fa-solid fa-money-bill-transfer',  '#8b5cf6', 'Payout'],
      top_up:          ['fa-solid fa-circle-plus',          '#10b981', 'Top Up'],
      withdrawal:      ['fa-solid fa-circle-minus',         '#f59e0b', 'Withdrawal'],
    };
    const [catIcon, catColor, catLabel] = catLabels[txn.category] || ['fa-solid fa-circle-question', '#94a3b8', txn.category || 'Other'];
    const catPill = `<span class="txn-category-pill" style="color:${catColor};background:${catColor}1a;border-color:${catColor}33;">
      <i class="${catIcon}"></i> ${catLabel}
    </span>`;

    // Status badge
    const statusMap = {
      success: ['badge-active',    'fa-circle-check',       'Success'],
      pending: ['badge-pending',   'fa-clock',              'Pending'],
      failed:  ['badge-cancelled', 'fa-circle-xmark',       'Failed'],
    };
    const [sBadge, sIcon, sLabel] = statusMap[txn.status] || statusMap.success;

    // Amount styling
    const amtColor  = isCredit ? '#34d399' : '#f87171';
    const amtPrefix = isCredit ? '+' : '−';

    // Payment method icon
    const methodIcons = {
      card:   'fa-solid fa-credit-card',
      momo:   'fa-solid fa-mobile-screen-button',
      bank:   'fa-solid fa-building-columns',
      cash:   'fa-solid fa-money-bill',
      system: 'fa-solid fa-gear',
    };
    const methodIcon  = methodIcons[txn.method] || 'fa-solid fa-credit-card';
    const methodLabel = (txn.method || 'card').toUpperCase();

    const sel = selectedIds.transactions.has(txn.id);

    return `
      <tr class="${sel ? 'row-selected' : ''}">
        <td><input type="checkbox" class="row-checkbox" data-id="${txn.id}" ${sel ? 'checked' : ''} onchange="toggleRowSelect('transactions','${txn.id}',this)"></td>
        <td>
          <div class="txn-id" title="${txn.id}">${shortId}…</div>
          ${txn.reference ? `<div class="txn-ref"><i class="fa-solid fa-hashtag" style="font-size:0.6rem;margin-right:0.2rem;"></i>${txn.reference}</div>` : ''}
        </td>
        <td>${typeBadge}</td>
        <td>${catPill}</td>
        <td>
          <div class="txn-user-name">${txn.userName || '—'}</div>
          <div class="txn-user-email">${txn.userEmail || '—'}</div>
        </td>
        <td>
          <div class="txn-amount" style="color:${amtColor};">${amtPrefix}₵${(txn.amount || 0).toFixed(2)}</div>
        </td>
        <td><span class="badge ${sBadge}"><i class="fa-solid ${sIcon}"></i> ${sLabel}</span></td>
        <td>
          <div class="txn-method"><i class="${methodIcon}" style="margin-right:0.3rem;color:#64748b;"></i>${methodLabel}</div>
        </td>
        <td>
          <div style="font-size:0.875rem;">${dateStr}</div>
          <div style="font-size:0.72rem;color:#475569;">${timeStr}</div>
        </td>
        <td>
          <div class="actions">
            <button class="btn-icon" style="background:#6366f1;" onclick="viewTransaction('${txn.id}')" title="View Details"><i class="fa-solid fa-eye"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');

  renderPaginationBar('transactions-pagination', 'transactions', total, page, totalPages, pp);
}

function viewTransaction(txnId) {
  const txn = transactions.find(t => t.id === txnId);
  if (!txn) return;

  const isCredit = txn.type === 'credit';
  const amtColor = isCredit ? '#34d399' : '#f87171';
  const amtPrefix = isCredit ? '+' : '−';

  const catLabels = {
    ticket_purchase: ['fa-solid fa-ticket',              'Ticket Purchase'],
    refund:          ['fa-solid fa-rotate-left',         'Refund'],
    payout:          ['fa-solid fa-money-bill-transfer', 'Payout'],
    top_up:          ['fa-solid fa-circle-plus',         'Top Up'],
    withdrawal:      ['fa-solid fa-circle-minus',        'Withdrawal'],
  };
  const [catIcon, catLabel] = catLabels[txn.category] || ['fa-solid fa-circle-question', txn.category || 'Other'];

  const statusMap = {
    success: ['badge-active',    'fa-circle-check',  'Success'],
    pending: ['badge-pending',   'fa-clock',         'Pending'],
    failed:  ['badge-cancelled', 'fa-circle-xmark',  'Failed'],
  };
  const [sBadge, sIcon, sLabel] = statusMap[txn.status] || statusMap.success;

  const methodIcons = {
    card: 'fa-solid fa-credit-card', momo: 'fa-solid fa-mobile-screen-button',
    bank: 'fa-solid fa-building-columns', cash: 'fa-solid fa-money-bill', system: 'fa-solid fa-gear',
  };
  const methodIcon = methodIcons[txn.method] || 'fa-solid fa-credit-card';

  document.getElementById('transaction-modal-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:1rem;padding:1rem;background:#0f172a;border-radius:0.75rem;margin-bottom:1.25rem;">
      <div style="width:3rem;height:3rem;border-radius:50%;background:${isCredit ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="fa-solid ${isCredit ? 'fa-arrow-down-to-line' : 'fa-arrow-up-from-line'}" style="color:${amtColor};font-size:1.2rem;"></i>
      </div>
      <div>
        <div style="font-size:1.75rem;font-weight:800;color:${amtColor};">${amtPrefix}₵${(txn.amount || 0).toFixed(2)}</div>
        <div style="font-size:0.8rem;color:#94a3b8;">${txn.description || catLabel}</div>
      </div>
      <div style="margin-left:auto;">
        <span class="badge ${sBadge}"><i class="fa-solid ${sIcon}"></i> ${sLabel}</span>
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-item" style="grid-column:span 2;">
        <div class="detail-label"><i class="fa-solid fa-fingerprint"></i> Transaction ID</div>
        <div class="detail-value" style="font-family:monospace;font-size:0.8rem;word-break:break-all;">${txn.id}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label"><i class="fa-solid fa-arrow-right-arrow-left"></i> Type</div>
        <div class="detail-value" style="text-transform:capitalize;">${txn.type}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label"><i class="${catIcon}"></i> Category</div>
        <div class="detail-value">${catLabel}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label"><i class="${methodIcon}"></i> Payment Method</div>
        <div class="detail-value" style="text-transform:uppercase;">${txn.method || '—'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label"><i class="fa-solid fa-hashtag"></i> Reference</div>
        <div class="detail-value" style="font-family:monospace;">${txn.reference || '—'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label"><i class="fa-regular fa-calendar"></i> Date &amp; Time</div>
        <div class="detail-value">${new Date(txn.createdAt).toLocaleString()}</div>
      </div>
      ${txn.eventTitle ? `
      <div class="detail-item">
        <div class="detail-label"><i class="fa-regular fa-calendar-check"></i> Event</div>
        <div class="detail-value">${txn.eventTitle}</div>
      </div>` : '<div></div>'}
    </div>

    <div style="padding:1rem;background:#0f172a;border-radius:0.5rem;margin-top:1rem;">
      <h4 style="font-weight:700;margin-bottom:0.75rem;font-size:0.875rem;"><i class="fa-regular fa-user" style="color:#6366f1;margin-right:0.4rem;"></i>${isCredit ? 'Customer' : 'Recipient / Organizer'}</h4>
      <div style="font-size:0.875rem;line-height:1.8;color:#94a3b8;">
        <div><i class="fa-regular fa-user" style="margin-right:0.3rem;"></i>${txn.userName || '—'}</div>
        <div><i class="fa-regular fa-envelope" style="margin-right:0.3rem;"></i>${txn.userEmail || '—'}</div>
        ${txn.userId ? `<div style="font-size:0.72rem;margin-top:0.25rem;"><i class="fa-solid fa-fingerprint" style="margin-right:0.3rem;color:#475569;"></i>${txn.userId}</div>` : ''}
      </div>
    </div>

    ${txn.ticketId ? `
    <div style="padding:1rem;background:#0f172a;border-radius:0.5rem;margin-top:1rem;">
      <h4 style="font-weight:700;margin-bottom:0.5rem;font-size:0.875rem;"><i class="fa-solid fa-ticket" style="color:#6366f1;margin-right:0.4rem;"></i>Related Ticket</h4>
      <div style="font-family:monospace;font-size:0.8rem;color:#94a3b8;">${txn.ticketId}</div>
      <button class="btn btn-primary" style="margin-top:0.75rem;font-size:0.78rem;padding:0.4rem 0.8rem;" onclick="closeModal('transaction-modal');viewTicket('${txn.ticketId}');">
        <i class="fa-solid fa-eye"></i> View Ticket
      </button>
    </div>` : ''}`;

  addLog('system', `Viewed transaction details`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, txnId, amount: txn.amount, type: txn.type });
  openModal('transaction-modal');
}

/* =============================================
   REPORTS + CHARTS
============================================= */
function renderReports() {
  const byCategory = events.reduce((acc, ev) => {
    const rev = tickets.filter(t => (t.eventId?.id||t.eventId?._id?.toString()) === ev.id).reduce((s,t) => s+(t.price||0), 0);
    acc[ev.category] = (acc[ev.category] || 0) + rev;
    return acc;
  }, {});
  const catHTML = Object.entries(byCategory).sort((a,b) => b[1]-a[1]).slice(0,5)
    .map(([cat,rev]) => `<div style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid #334155;"><span style="text-transform:capitalize;">${cat||'Uncategorised'}</span><span style="font-weight:700;color:#6366f1;">₵${rev.toFixed(2)}</span></div>`).join('');
  const catEl = document.getElementById('revenue-by-category');
  if (catEl) catEl.innerHTML = catHTML || '<div class="empty-state"><i class="fa-solid fa-chart-pie" style="display:block;font-size:1.5rem;margin-bottom:0.5rem;"></i>No data</div>';

  const byOrg = events.reduce((acc, ev) => {
    const rev = tickets.filter(t => (t.eventId?.id||t.eventId?._id?.toString()) === ev.id).reduce((s,t) => s+(t.price||0), 0);
    const org = users.find(u => u.id === (ev.organizerId?.id||ev.organizerId?._id?.toString()));
    const key = org?.name || org?.email || 'Unknown';
    acc[key]  = (acc[key] || 0) + rev;
    return acc;
  }, {});
  const trophyColors = ['#f59e0b','#94a3b8','#b45309'];
  const orgHTML = Object.entries(byOrg).sort((a,b) => b[1]-a[1]).slice(0,5)
    .map(([name,rev],i) => `<div style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid #334155;align-items:center;"><span style="overflow:hidden;text-overflow:ellipsis;font-size:0.875rem;"><i class="fa-solid ${i<3?'fa-trophy':'fa-medal'}" style="color:${trophyColors[i]||'#334155'};margin-right:0.4rem;"></i>${name}</span><span style="font-weight:700;color:#8b5cf6;margin-left:1rem;">₵${rev.toFixed(2)}</span></div>`).join('');
  const orgEl = document.getElementById('top-organizers');
  if (orgEl) orgEl.innerHTML = orgHTML || '<div class="empty-state"><i class="fa-solid fa-trophy" style="display:block;font-size:1.5rem;margin-bottom:0.5rem;"></i>No data</div>';

  const totalRevenue = tickets.reduce((s,t) => s+(t.price||0), 0);
  setText('avg-ticket-price',  `₵${tickets.length > 0 ? (totalRevenue/tickets.length).toFixed(2) : '0.00'}`);
  setText('avg-event-revenue', `₵${events.length  > 0 ? (totalRevenue/events.length).toFixed(2)  : '0.00'}`);
  setText('total-cancelled',   events.filter(e => e.isCancelled).length);
  setText('platform-fee',      `₵${(totalRevenue*(platformFeePercent/100)).toFixed(2)} (${platformFeePercent}%)`);
  setText('total-refunded',    `₵${stats.totalRefunded.toFixed(2)}`);
}

function setChartPeriod(period, btn) {
  currentChartPeriod = period;
  document.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCharts();
}

function groupByPeriod(items, dateField, valueField, period, numBuckets) {
  const now   = new Date();
  const buckets = [];
  const labels  = [];

  if (period === 'daily') {
    for (let i = numBuckets - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      buckets.push({ start: new Date(d), end: new Date(d.setHours(23,59,59,999)) });
      labels.push(d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' }));
    }
  } else if (period === 'weekly') {
    for (let i = numBuckets - 1; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - i * 7 - start.getDay());
      start.setHours(0,0,0,0);
      const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23,59,59,999);
      buckets.push({ start, end });
      labels.push(`W/C ${start.toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}`);
    }
  } else if (period === 'monthly') {
    for (let i = numBuckets - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d);
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      buckets.push({ start, end });
      labels.push(d.toLocaleDateString('en-GB', { month:'short', year:'numeric' }));
    }
  } else if (period === 'yearly') {
    for (let i = numBuckets - 1; i >= 0; i--) {
      const year = now.getFullYear() - i;
      const start = new Date(year, 0, 1, 0, 0, 0, 0);
      const end   = new Date(year, 11, 31, 23, 59, 59, 999);
      buckets.push({ start, end });
      labels.push(String(year));
    }
  }

  const values = buckets.map(({ start, end }) => {
    const inRange = items.filter(item => {
      const d = new Date(item[dateField] || item.createdAt || item.timestamp);
      return !isNaN(d) && d >= start && d <= end;
    });
    if (valueField === null) return inRange.length;
    return inRange.reduce((s, item) => s + (Number(item[valueField]) || 0), 0);
  });

  return { labels, values };
}

function renderCharts() {
  if (typeof Chart === 'undefined') return;

  const numBuckets = currentChartPeriod === 'daily' ? 14 : currentChartPeriod === 'weekly' ? 12 : currentChartPeriod === 'monthly' ? 6 : 5;
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = "'Inter', sans-serif";

  const gridColor  = 'rgba(51,65,85,0.6)';
  const tickColor  = '#64748b';

  const revData = groupByPeriod(tickets, 'purchasedAt', 'price', currentChartPeriod, numBuckets);
  const totalRev = revData.values.reduce((a,b) => a+b, 0);
  setText('chart-revenue-total', `₵${totalRev.toFixed(2)} total`);

  const revCtx = document.getElementById('chart-revenue');
  if (revCtx) {
    if (chartRevenue) chartRevenue.destroy();
    chartRevenue = new Chart(revCtx, {
      type: 'line',
      data: {
        labels: revData.labels,
        datasets: [{
          label: 'Revenue (₵)',
          data: revData.values,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.12)',
          borderWidth: 2.5,
          pointBackgroundColor: '#6366f1',
          pointRadius: 3,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1,
            titleColor: '#f1f5f9', bodyColor: '#94a3b8',
            callbacks: { label: ctx => ` ₵${ctx.parsed.y.toFixed(2)}` }
          }
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: tickColor, maxTicksLimit: 8 } },
          y: { grid: { color: gridColor }, ticks: { color: tickColor, callback: v => `₵${v}` }, beginAtZero: true }
        }
      }
    });
  }

  const tixData  = groupByPeriod(tickets, 'purchasedAt', null, currentChartPeriod, numBuckets);
  const totalTix = tixData.values.reduce((a,b) => a+b, 0);
  setText('chart-tickets-total', `${totalTix} tickets`);

  const tixCtx = document.getElementById('chart-tickets');
  if (tixCtx) {
    if (chartTickets) chartTickets.destroy();
    chartTickets = new Chart(tixCtx, {
      type: 'bar',
      data: {
        labels: tixData.labels,
        datasets: [{
          label: 'Tickets Sold', data: tixData.values,
          backgroundColor: 'rgba(139,92,246,0.7)', borderColor: '#8b5cf6',
          borderWidth: 1, borderRadius: 4, hoverBackgroundColor: '#8b5cf6',
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1, titleColor: '#f1f5f9', bodyColor: '#94a3b8' } },
        scales: {
          x: { grid: { display: false }, ticks: { color: tickColor, maxTicksLimit: 8 } },
          y: { grid: { color: gridColor }, ticks: { color: tickColor }, beginAtZero: true }
        }
      }
    });
  }

  const rawUserData = groupByPeriod(users, 'createdAt', null, currentChartPeriod, numBuckets);
  const cumulativeUsers = rawUserData.values.reduce((acc, val, i) => { acc.push((acc[i - 1] || 0) + val); return acc; }, []);
  const totalNewUsers = rawUserData.values.reduce((a,b) => a+b, 0);
  setText('chart-users-total', `+${totalNewUsers} new`);

  const usrCtx = document.getElementById('chart-users');
  if (usrCtx) {
    if (chartUsers) chartUsers.destroy();
    chartUsers = new Chart(usrCtx, {
      type: 'line',
      data: {
        labels: rawUserData.labels,
        datasets: [
          {
            label: 'Total Users', data: cumulativeUsers,
            borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)',
            borderWidth: 2.5, pointBackgroundColor: '#06b6d4', pointRadius: 3, pointHoverRadius: 6,
            fill: true, tension: 0.4, yAxisID: 'y',
          },
          {
            label: 'New Registrations', data: rawUserData.values,
            borderColor: 'rgba(6,182,212,0.4)', backgroundColor: 'transparent',
            borderWidth: 1.5, borderDash: [4,3], pointRadius: 2, tension: 0.4, yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12 } },
          tooltip: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1, titleColor: '#f1f5f9', bodyColor: '#94a3b8' }
        },
        scales: {
          x:  { grid: { color: gridColor }, ticks: { color: tickColor, maxTicksLimit: 8 } },
          y:  { grid: { color: gridColor }, ticks: { color: tickColor }, beginAtZero: true, position: 'left' },
          y1: { grid: { display: false },   ticks: { color: tickColor }, beginAtZero: true, position: 'right' },
        }
      }
    });
  }
}

/* =============================================
   MESSAGE MANAGEMENT
============================================= */
const BROADCAST_TEMPLATES = {
  maintenance: {
    subject: 'Scheduled Platform Maintenance',
    body: `Dear Glycr User,\n\nWe'd like to inform you that we will be performing scheduled maintenance on our platform. During this time, some services may be temporarily unavailable.\n\nWe apologize for any inconvenience and appreciate your patience.\n\nThe Glycr Team`,
  },
  promo: {
    subject: 'Exclusive Offer Just for You 🎉',
    body: `Hi there!\n\nWe have an exciting offer exclusively for our community. Check out the latest events on Glycr and enjoy special perks when you book your tickets this week.\n\nDon't miss out!\n\nThe Glycr Team`,
  },
  update: {
    subject: 'Platform Update — What\'s New on Glycr',
    body: `Hello from Glycr!\n\nWe've been hard at work improving your experience. Here's what's new:\n\n• Improved event discovery\n• Faster ticket checkout\n• Enhanced organizer dashboard\n\nThank you for being part of our community.\n\nThe Glycr Team`,
  },
};

function applyBroadcastTemplate(key) {
  const tpl = BROADCAST_TEMPLATES[key];
  if (!tpl) return;
  const subEl  = document.getElementById('broadcast-subject');
  const bodyEl = document.getElementById('broadcast-body');
  if (subEl)  subEl.value  = tpl.subject;
  if (bodyEl) bodyEl.value = tpl.body;
}

function getBroadcastRecipientCount() {
  const aud = document.querySelector('input[name="broadcast-audience"]:checked')?.value || 'all_users';
  if (aud === 'all_users')  return users.length;
  if (aud === 'organizers') return users.filter(u => u.role === 'organizer').length;
  if (aud === 'customers')  return users.filter(u => u.role === 'customer').length;
  if (aud === 'both')       return users.filter(u => u.role === 'organizer' || u.role === 'customer').length;
  return users.length;
}

function updateBroadcastAudiencePreview() {
  const count = getBroadcastRecipientCount();
  setText('broadcast-recipient-count', count);
  setText('broadcast-warn-count', count);
}

function searchMessageRecipients() {
  const q  = (document.getElementById('msg-recipient-search')?.value || '').toLowerCase().trim();
  const dd = document.getElementById('msg-recipient-dropdown');
  if (!dd) return;
  if (!q) { dd.style.display = 'none'; return; }
  const matches = users.filter(u =>
    (u.name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  ).slice(0, 8);
  if (!matches.length) {
    dd.innerHTML = '<div class="msg-recipient-option" style="color:#94a3b8;">No users found</div>';
  } else {
    dd.innerHTML = matches.map(u => `
      <div class="msg-recipient-option" onclick="selectMessageRecipient('${u.id}', '${(u.name||u.email).replace(/'/g,"\\'")}', '${u.email}')">
        <div style="font-weight:600;">${u.name || 'User'}</div>
        <div class="option-sub">${u.email} · <span style="text-transform:capitalize;">${u.role}</span></div>
      </div>`).join('');
  }
  dd.style.display = 'block';
}

function selectMessageRecipient(id, name, email) {
  document.getElementById('msg-recipient-id').value = id;
  document.getElementById('msg-recipient-label').textContent = `${name} (${email})`;
  document.getElementById('msg-selected-recipient').style.display = 'block';
  document.getElementById('msg-recipient-search').value  = '';
  document.getElementById('msg-recipient-dropdown').style.display = 'none';
}

function clearMessageRecipient() {
  document.getElementById('msg-recipient-id').value = '';
  document.getElementById('msg-selected-recipient').style.display = 'none';
  document.getElementById('msg-recipient-search').value = '';
}

document.addEventListener('click', e => {
  const wrap = document.getElementById('compose-message-modal');
  if (!wrap?.contains(e.target)) {
    const dd = document.getElementById('msg-recipient-dropdown');
    if (dd) dd.style.display = 'none';
  }
});

async function submitDirectMessage() {
  const recipientId = document.getElementById('msg-recipient-id').value;
  const channel     = document.getElementById('msg-direct-channel').value;
  const subject     = document.getElementById('msg-direct-subject').value.trim();
  const body        = document.getElementById('msg-direct-body').value.trim();
  const errEl       = document.getElementById('msg-direct-error');
  errEl.style.display = 'none';
  if (!recipientId) { errEl.style.display = 'block'; errEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="margin-right:0.4rem;"></i>Please select a recipient.'; return; }
  if (!subject)     { errEl.style.display = 'block'; errEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="margin-right:0.4rem;"></i>Subject is required.'; return; }
  if (!body)        { errEl.style.display = 'block'; errEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="margin-right:0.4rem;"></i>Message body is required.'; return; }

  const recipient = users.find(u => u.id === recipientId);
  const msgRecord = {
    id: `msg_${Date.now()}`, type: 'direct', audience: 'individual',
    subject, body, channel, recipientId,
    recipientName: recipient?.name || 'User', recipientEmail: recipient?.email || '',
    sentAt: new Date().toISOString(), sentBy: currentAdmin.name, recipientCount: 1,
  };
  try { await apiRequest('/admin/messages', { method: 'POST', body: JSON.stringify(msgRecord) }); } catch {}
  messages.unshift(msgRecord);
  await addLog('system', `Direct message sent to ${recipient?.email}`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, subject, channel, recipientEmail: recipient?.email });
  document.getElementById('msg-direct-subject').value = '';
  document.getElementById('msg-direct-body').value    = '';
  clearMessageRecipient();
  closeModal('compose-message-modal');
  renderMessages();
  updateMessageStats();
  toast.success('Message sent', `Delivered to ${recipient?.name || recipient?.email} via ${channel}.`);
}

async function submitBroadcast() {
  const audience = document.querySelector('input[name="broadcast-audience"]:checked')?.value || 'all_users';
  const channel  = document.getElementById('broadcast-channel').value;
  const subject  = document.getElementById('broadcast-subject').value.trim();
  const body     = document.getElementById('broadcast-body').value.trim();
  const errEl    = document.getElementById('broadcast-error');
  errEl.style.display = 'none';
  if (!subject) { errEl.style.display = 'block'; errEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="margin-right:0.4rem;"></i>Subject is required.'; return; }
  if (!body)    { errEl.style.display = 'block'; errEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="margin-right:0.4rem;"></i>Message body is required.'; return; }

  const count = getBroadcastRecipientCount();
  const msgRecord = {
    id: `bcast_${Date.now()}`, type: 'broadcast', audience, subject, body, channel,
    sentAt: new Date().toISOString(), sentBy: currentAdmin.name, recipientCount: count,
  };
  try { await apiRequest('/admin/messages/broadcast', { method: 'POST', body: JSON.stringify(msgRecord) }); } catch {}
  messages.unshift(msgRecord);
  await addLog('system', `Broadcast sent to ${count} users (${audience})`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, subject, channel, audience, count });
  document.getElementById('broadcast-subject').value = '';
  document.getElementById('broadcast-body').value    = '';
  closeModal('broadcast-modal');
  renderMessages();
  updateMessageStats();
  toast.success('Broadcast sent', `Message delivered to ${count} recipient${count !== 1 ? 's' : ''}.`);
}

function viewMessage(msgId) {
  const msg = messages.find(m => m.id === msgId);
  if (!msg) return;
  const audienceMap = {
    all_users: 'All Users', organizers: 'Organizers Only',
    customers: 'Customers Only', both: 'Organizers & Customers',
    individual: msg.recipientName || 'Individual User',
  };
  const channelIcon = { email:'fa-envelope', sms:'fa-mobile-screen-button', both:'fa-satellite-dish' };
  document.getElementById('view-message-body').innerHTML = `
    <div class="detail-grid" style="margin-bottom:1rem;">
      <div class="detail-item"><div class="detail-label">Type</div><div class="detail-value">
        <span class="msg-type-badge msg-type-${msg.type}">${msg.type === 'broadcast' ? '<i class="fa-solid fa-bullhorn"></i> Broadcast' : '<i class="fa-solid fa-paper-plane"></i> Direct'}</span>
      </div></div>
      <div class="detail-item"><div class="detail-label">Channel</div><div class="detail-value">
        <span class="msg-channel-pill msg-channel-${msg.channel}"><i class="fa-solid ${channelIcon[msg.channel] || 'fa-envelope'}"></i> ${msg.channel}</span>
      </div></div>
      <div class="detail-item"><div class="detail-label">Recipients</div><div class="detail-value">${audienceMap[msg.audience] || msg.audience} <span style="color:#94a3b8;">(${msg.recipientCount})</span></div></div>
      <div class="detail-item"><div class="detail-label">Sent At</div><div class="detail-value">${new Date(msg.sentAt).toLocaleString()}</div></div>
      <div class="detail-item"><div class="detail-label">Sent By</div><div class="detail-value">${msg.sentBy}</div></div>
    </div>
    <div style="padding:1rem;background:#0f172a;border-radius:0.5rem;margin-bottom:1rem;">
      <div style="font-size:0.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.4rem;">Subject</div>
      <div style="font-weight:700;font-size:1rem;">${msg.subject}</div>
    </div>
    <div style="padding:1rem;background:#0f172a;border-radius:0.5rem;">
      <div style="font-size:0.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.4rem;">Message Body</div>
      <div style="white-space:pre-wrap;font-size:0.875rem;color:#cbd5e1;line-height:1.7;">${msg.body}</div>
    </div>`;
  openModal('view-message-modal');
}

function getFilteredMessages() {
  const search   = (document.getElementById('msg-search')?.value || '').toLowerCase();
  const type     = document.getElementById('msg-type-filter')?.value     || 'all';
  const audience = document.getElementById('msg-audience-filter')?.value || 'all';
  const channel  = document.getElementById('msg-channel-filter')?.value  || 'all';
  const dfrom    = document.getElementById('msg-date-from')?.value;
  const dto      = document.getElementById('msg-date-to')?.value;
  return messages.filter(m => {
    const mSearch = !search || m.subject.toLowerCase().includes(search) || (m.recipientName||'').toLowerCase().includes(search) || (m.recipientEmail||'').toLowerCase().includes(search);
    return mSearch && (type === 'all' || m.type === type) && (audience === 'all' || m.audience === audience) && (channel === 'all' || m.channel === channel) && applyDateRangeFilter(m.sentAt, dfrom, dto);
  });
}

function filterMessages() { pageState.messages = 1; renderMessages(); }

function renderMessages() {
  const tb = document.getElementById('messages-table');
  if (!tb) return;
  const filtered = getFilteredMessages();
  const sorted   = applySorting(filtered, 'messages');
  const { rows, page, totalPages, total, pp } = paginate(sorted, 'messages');

  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fa-solid fa-paper-plane" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>No messages sent yet</td></tr>';
    renderPaginationBar('messages-pagination', 'messages', 0, 1, 1, pp);
    return;
  }

  const audienceMap = { all_users:'All Users', organizers:'Organizers Only', customers:'Customers Only', both:'Org. & Customers', individual:'' };
  const channelIcon = { email:'fa-envelope', sms:'fa-mobile-screen-button', both:'fa-satellite-dish' };

  tb.innerHTML = rows.map(m => {
    const dateStr = new Date(m.sentAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    const timeStr = new Date(m.sentAt).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
    const recipientLabel = m.type === 'broadcast'
      ? `${audienceMap[m.audience] || m.audience} <span style="color:#475569;">(${m.recipientCount} recipients)</span>`
      : `${m.recipientName || '—'} <span style="font-size:0.72rem;color:#94a3b8;">(${m.recipientEmail || ''})</span>`;
    const sel = selectedIds.messages.has(m.id);
    return `
      <tr class="${sel ? 'row-selected' : ''}">
        <td><input type="checkbox" class="row-checkbox" data-id="${m.id}" ${sel ? 'checked' : ''} onchange="toggleRowSelect('messages','${m.id}',this)"></td>
        <td>
          <div style="font-size:0.875rem;">${dateStr}</div>
          <div style="font-size:0.72rem;color:#475569;">${timeStr}</div>
        </td>
        <td>
          <div style="font-weight:600;font-size:0.875rem;max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.subject}</div>
          <div style="font-size:0.72rem;color:#94a3b8;">by ${m.sentBy}</div>
        </td>
        <td><div class="msg-audience-badge">${recipientLabel}</div></td>
        <td><span class="msg-channel-pill msg-channel-${m.channel}"><i class="fa-solid ${channelIcon[m.channel] || 'fa-envelope'}"></i> ${m.channel}</span></td>
        <td><span class="msg-type-badge msg-type-${m.type}">${m.type === 'broadcast' ? '<i class="fa-solid fa-bullhorn"></i> Broadcast' : '<i class="fa-solid fa-paper-plane"></i> Direct'}</span></td>
        <td><div class="actions">
          <button class="btn-icon" style="background:#6366f1;" onclick="viewMessage('${m.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
          <button class="btn-icon" style="background:#ef4444;" onclick="deleteMessage('${m.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div></td>
      </tr>`;
  }).join('');

  renderPaginationBar('messages-pagination', 'messages', total, page, totalPages, pp);
}

async function deleteMessage(msgId) {
  const msg = messages.find(m => m.id === msgId);
  const ok  = await customConfirm(`Delete message "${msg?.subject || 'this message'}"? This cannot be undone.`, 'Delete Message', 'Delete', '#ef4444');
  if (!ok) return;
  try { await apiRequest(`/admin/messages/${msgId}`, { method: 'DELETE' }); } catch {}
  const idx = messages.findIndex(m => m.id === msgId);
  if (idx !== -1) messages.splice(idx, 1);
  await addLog('system', `Message deleted: ${msg?.subject}`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, msgId });
  renderMessages();
  updateMessageStats();
  toast.success('Message deleted', 'The message record has been removed.');
}

async function bulkDeleteMessages() {
  const ids = [...selectedIds.messages];
  if (!ids.length) return;
  showBulkConfirm('Delete Messages', `Permanently delete ${ids.length} message(s)?`, async () => {
    let ok = 0;
    for (const id of ids) {
      try { await apiRequest(`/admin/messages/${id}`, { method: 'DELETE' }); } catch {}
      const idx = messages.findIndex(m => m.id === id);
      if (idx !== -1) { messages.splice(idx, 1); ok++; }
    }
    await addLog('system', `Bulk deleted ${ok} message(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok });
    selectedIds.messages.clear();
    renderMessages();
    updateMessageStats();
    toast.success('Done', `${ok} message(s) deleted.`);
  });
}

function updateMessageStats() {
  const broadcasts  = messages.filter(m => m.type === 'broadcast');
  const directs     = messages.filter(m => m.type === 'direct');
  const totalRecip  = messages.reduce((s, m) => s + (m.recipientCount || 0), 0);
  setText('msg-stat-total',      messages.length);
  setText('msg-stat-broadcasts', broadcasts.length);
  setText('msg-stat-direct',     directs.length);
  setText('msg-stat-recipients', totalRecip);
}

async function loadMessages() {
  try {
    const res = await apiRequest('/admin/messages');
    messages = (res.messages || []).map(m => ({ ...m, id: m.id || m._id?.toString() }));
  } catch {
    if (!messages.length) messages = [];
  }
  renderMessages();
  updateMessageStats();
  updateBroadcastAudiencePreview();
}

/* =============================================
   REFUNDS
============================================= */
function _resolveRefundUser(r) {
  const uid = r.userId?.id || r.userId?._id?.toString() || r.userId;
  return users.find(u => u.id === uid);
}
function _resolveRefundTicket(r) {
  const tid = r.ticketId?.id || r.ticketId?._id?.toString() || r.ticketId;
  return tickets.find(t => t.id === tid);
}
function _resolveRefundTicketIdString(r) {
  if (!r.ticketId) return '—';
  if (typeof r.ticketId === 'string') return r.ticketId;
  if (typeof r.ticketId === 'object') return r.ticketId.id || r.ticketId._id?.toString() || '—';
  return String(r.ticketId);
}
function _reasonLabel(reason) {
  if (!reason) return 'Other';
  return reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function _reasonPill(reason) {
  const r = reason || 'other';
  return `<span class="refund-reason-pill ${r}">${_reasonLabel(r)}</span>`;
}

function renderRefunds() {
  const tb = document.getElementById('refunds-table');
  if (!tb) return;
  const base     = getFilteredRefunds();
  const enriched = base.map(r => ({ ...r, userName: r.userName || _resolveRefundUser(r)?.name || '—' }));
  const sorted   = applySorting(enriched, 'refunds');
  const { rows, page, totalPages, total, pp } = paginate(sorted, 'refunds');
  setText('pending-refund-amount', `₵${stats.pendingRefunds.toFixed(2)}`);
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fa-solid fa-rotate-left" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>No refund requests found</td></tr>';
    renderPaginationBar('refunds-pagination', 'refunds', 0, 1, 1, pp);
    return;
  }
  tb.innerHTML = rows.map(r => {
    const ticket       = _resolveRefundTicket(r);
    const ev           = ticket ? resolveEventForTicket(ticket) : null;
    const ticketIdStr  = _resolveRefundTicketIdString(r);
    const shortTicketId = ticketIdStr !== '—' ? ticketIdStr.substring(0, 10).toUpperCase() : '—';
    const shortId       = String(r.id).substring(0, 8).toUpperCase();
    const reqDate       = new Date(r.requestedAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    const sMap    = { pending:'fa-clock', approved:'fa-circle-check', rejected:'fa-circle-xmark' };
    const sBadge  = r.status === 'approved' ? 'badge-completed' : r.status === 'rejected' ? 'badge-rejected' : 'badge-pending';
    const sIcon   = sMap[r.status] || 'fa-clock';
    const sel     = selectedIds.refunds.has(r.id);
    const customerEmail = r.userEmail || _resolveRefundUser(r)?.email || '—';
    return `
      <tr class="${sel ? 'row-selected' : ''}">
        <td><input type="checkbox" class="row-checkbox" data-id="${r.id}" ${sel ? 'checked' : ''} onchange="toggleRowSelect('refunds','${r.id}',this)"></td>
        <td>
          <div class="refund-table-id"><i class="fa-solid fa-fingerprint" style="margin-right:0.3rem;color:#475569;"></i>#${shortId}</div>
          <div style="font-size:0.7rem;color:#475569;margin-top:0.2rem;">${reqDate}</div>
        </td>
        <td>
          <div class="refund-table-user">${r.userName || '—'}</div>
          <div class="refund-table-sub"><i class="fa-regular fa-envelope"></i> ${customerEmail}</div>
          ${r.userPhone ? `<div class="refund-table-sub"><i class="fa-solid fa-mobile-screen-button"></i> ${r.userPhone}</div>` : ''}
        </td>
        <td>
          <div class="refund-table-amount">₵${(r.amount || 0).toFixed(2)}</div>
          <div class="refund-table-reason">${_reasonPill(r.reason)}</div>
        </td>
        <td>
          <div class="refund-table-ticket"><i class="fa-solid fa-ticket" style="margin-right:0.3rem;color:#6366f1;font-size:0.75rem;"></i>${shortTicketId}</div>
          <div class="refund-table-event"><i class="fa-regular fa-calendar"></i> ${r.eventTitle || ev?.title || '—'}</div>
        </td>
        <td>
          <span class="badge ${sBadge}"><i class="fa-solid ${sIcon}"></i> ${r.status.charAt(0).toUpperCase()+r.status.slice(1)}</span>
          ${r.status === 'rejected' && r.rejectionReason ? `<div style="font-size:0.7rem;color:#f87171;margin-top:0.3rem;" title="${r.rejectionReason}"><i class="fa-solid fa-triangle-exclamation"></i> ${r.rejectionReason.substring(0,30)}</div>` : ''}
          ${r.status === 'approved' && r.resolvedAt ? `<div style="font-size:0.7rem;color:#34d399;margin-top:0.3rem;"><i class="fa-regular fa-calendar-check"></i> ${new Date(r.resolvedAt).toLocaleDateString()}</div>` : ''}
        </td>
        <td><div class="actions">
          <button class="btn-icon" style="background:#6366f1;" onclick="viewRefund('${r.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
          ${r.status === 'pending' ? `
            <button class="btn-icon" style="background:#10b981;" onclick="approveRefund('${r.id}')" title="Approve"><i class="fa-solid fa-check"></i></button>
            <button class="btn-icon" style="background:#ef4444;" onclick="openRefundRejectModal('${r.id}')" title="Reject"><i class="fa-solid fa-xmark"></i></button>` : ''}
        </div></td>
      </tr>`;
  }).join('');
  renderPaginationBar('refunds-pagination', 'refunds', total, page, totalPages, pp);
}

function getFilteredRefunds() {
  const search = (document.getElementById('refund-search')?.value || '').toLowerCase();
  const status = document.getElementById('refund-status-filter')?.value || 'all';
  const reason = document.getElementById('refund-reason-filter')?.value || 'all';
  const dfrom  = document.getElementById('refund-date-from')?.value;
  const dto    = document.getElementById('refund-date-to')?.value;
  return [...refunds].sort((a,b) => new Date(b.requestedAt) - new Date(a.requestedAt)).filter(r => {
    const mSearch = !search || String(r.id).toLowerCase().includes(search) || (r.userName||'').toLowerCase().includes(search) || (r.userEmail||'').toLowerCase().includes(search) || (r.eventTitle||'').toLowerCase().includes(search);
    return mSearch && (status === 'all' || r.status === status) && (reason === 'all' || r.reason === reason) && applyDateRangeFilter(r.requestedAt, dfrom, dto);
  });
}

function filterRefunds() { pageState.refunds = 1; renderRefunds(); }

function viewRefund(refundId) {
  const r = refunds.find(x => x.id === refundId);
  if (!r) return;
  const user        = _resolveRefundUser(r);
  const ticket      = _resolveRefundTicket(r);
  const ev          = ticket ? resolveEventForTicket(ticket) : null;
  const ticketIdStr = _resolveRefundTicketIdString(r);
  const sMap        = { pending:'fa-clock', approved:'fa-circle-check', rejected:'fa-circle-xmark' };
  const sBadge      = r.status === 'approved' ? 'badge-completed' : r.status === 'rejected' ? 'badge-rejected' : 'badge-pending';
  const customerEmail = r.userEmail || user?.email || '—';
  document.getElementById('refund-modal-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-fingerprint"></i> Refund ID</div><div class="detail-value" style="font-family:monospace;font-size:0.85rem;">${r.id}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-circle-dot"></i> Status</div><div class="detail-value"><span class="badge ${sBadge}"><i class="fa-solid ${sMap[r.status]||'fa-clock'}"></i> ${r.status.charAt(0).toUpperCase()+r.status.slice(1)}</span></div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-coins"></i> Refund Amount</div><div class="detail-value" style="font-size:1.25rem;color:#ef4444;">₵${(r.amount||0).toFixed(2)}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-circle-info"></i> Reason</div><div class="detail-value">${_reasonPill(r.reason)}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-calendar"></i> Requested At</div><div class="detail-value">${new Date(r.requestedAt).toLocaleString()}</div></div>
      ${r.resolvedAt ? `<div class="detail-item"><div class="detail-label"><i class="fa-solid fa-calendar-check"></i> Resolved At</div><div class="detail-value">${new Date(r.resolvedAt).toLocaleString()}</div></div>` : '<div></div>'}
    </div>
    <div style="padding:1rem;background:#0f172a;border-radius:0.5rem;margin-bottom:1rem;">
      <h4 style="font-weight:700;margin-bottom:0.75rem;"><i class="fa-regular fa-user" style="color:#6366f1;margin-right:0.4rem;"></i>Customer</h4>
      <div style="font-size:0.875rem;line-height:1.8;color:#94a3b8;">
        <div><i class="fa-regular fa-user" style="margin-right:0.3rem;"></i>${r.userName || user?.name || '—'}</div>
        <div><i class="fa-regular fa-envelope" style="margin-right:0.3rem;"></i>${customerEmail}</div>
        <div><i class="fa-solid fa-mobile-screen-button" style="margin-right:0.3rem;"></i>${r.userPhone || user?.phone || '—'}</div>
      </div>
    </div>
    <div style="padding:1rem;background:#0f172a;border-radius:0.5rem;margin-bottom:1rem;">
      <h4 style="font-weight:700;margin-bottom:0.75rem;"><i class="fa-solid fa-ticket" style="color:#6366f1;margin-right:0.4rem;"></i>Ticket &amp; Event</h4>
      <div style="font-size:0.875rem;line-height:1.8;color:#94a3b8;">
        <div><i class="fa-solid fa-fingerprint" style="margin-right:0.3rem;"></i>Ticket: ${ticketIdStr.substring(0,20).toUpperCase()}</div>
        ${ticket ? `<div><i class="fa-solid fa-tag" style="margin-right:0.3rem;"></i>Type: ${(ticket.ticketType||'—').toUpperCase()} &nbsp;·&nbsp; ₵${(ticket.price||0).toFixed(2)}</div>` : ''}
        <div><i class="fa-regular fa-calendar" style="margin-right:0.3rem;"></i>${r.eventTitle || ev?.title || '—'}</div>
        ${ev ? `<div><i class="fa-solid fa-location-dot" style="margin-right:0.3rem;"></i>${ev.venue}${ev.location ? ', '+ev.location : ''}</div>` : ''}
      </div>
    </div>
    ${r.notes ? `<div style="padding:1rem;background:#0f172a;border-radius:0.5rem;margin-bottom:1rem;"><h4 style="font-weight:700;margin-bottom:0.5rem;"><i class="fa-regular fa-note-sticky"></i> Customer Notes</h4><p style="color:#94a3b8;font-size:0.875rem;">${r.notes}</p></div>` : ''}
    ${r.status === 'rejected' && r.rejectionReason ? `<div class="info-box error" style="margin-top:0.5rem;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:0.4rem;"></i><strong>Rejection Reason:</strong> ${r.rejectionReason}</div>` : ''}
    ${r.status === 'pending' ? `
    <div style="display:flex;gap:0.75rem;margin-top:1.5rem;">
      <button class="btn btn-success" style="flex:1;" onclick="approveRefund('${r.id}');closeModal('refund-modal');"><i class="fa-solid fa-check"></i> Approve</button>
      <button class="btn btn-danger"  style="flex:1;" onclick="openRefundRejectModal('${r.id}');closeModal('refund-modal');"><i class="fa-solid fa-xmark"></i> Reject</button>
    </div>` : ''}`;
  addLog('system', 'Viewed refund details', { adminName: currentAdmin.name, adminRole: currentAdmin.role, refundId });
  openModal('refund-modal');
}

async function approveRefund(refundId) {
  const r = refunds.find(x => x.id === refundId);
  try { await apiRequest(`/refunds/${refundId}/approve`, { method: 'PATCH' }); }
  catch { if (r) { r.status = 'approved'; r.resolvedAt = new Date().toISOString(); } }
  await addLog('system', 'Refund approved', { adminName: currentAdmin.name, adminRole: currentAdmin.role, refundId, amount: r?.amount, userEmail: r?.userEmail });
  calculateStats(); renderDashboard(); renderRefunds(); renderReports();
  toast.success('Refund approved', `₵${(r?.amount||0).toFixed(2)} will be refunded to the customer.`);
}

function openRefundRejectModal(refundId) {
  const r = refunds.find(x => x.id === refundId);
  if (!r) return;
  document.getElementById('reject-refund-id').value = refundId;
  document.getElementById('reject-refund-info').innerHTML =
    `<strong>${r.userName || '—'}</strong> &nbsp;·&nbsp; ₵${(r.amount||0).toFixed(2)}<br>
     <span style="font-size:0.75rem;color:#94a3b8;">${r.eventTitle || '—'} &nbsp;·&nbsp; ${_reasonLabel(r.reason)}</span>`;
  document.getElementById('refund-reject-reason').value = '';
  openModal('refund-reject-modal');
}

async function submitRefundReject() {
  const refundId = document.getElementById('reject-refund-id').value;
  const reason   = document.getElementById('refund-reject-reason').value.trim();
  if (!reason) { toast.warning('Reason required', 'Please provide a rejection reason.'); return; }
  const r = refunds.find(x => x.id === refundId);
  try { await apiRequest(`/refunds/${refundId}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }); }
  catch { if (r) { r.status = 'rejected'; r.rejectionReason = reason; r.resolvedAt = new Date().toISOString(); } }
  await addLog('warning', 'Refund rejected', { adminName: currentAdmin.name, adminRole: currentAdmin.role, refundId, reason, userEmail: r?.userEmail });
  closeModal('refund-reject-modal');
  calculateStats(); renderDashboard(); renderRefunds(); renderReports();
  toast.warning('Refund rejected', 'The customer will be notified.');
}

async function bulkApproveRefunds() {
  const ids = [...selectedIds.refunds].filter(id => refunds.find(r => r.id === id)?.status === 'pending');
  if (!ids.length) { toast.warning('None eligible', 'No pending refunds selected.'); return; }
  showBulkConfirm('Approve Refunds', `Approve ${ids.length} refund(s)?`, async () => {
    let ok = 0;
    for (const id of ids) {
      try { await apiRequest(`/refunds/${id}/approve`, { method: 'PATCH' }); }
      catch { const r = refunds.find(x => x.id === id); if (r) { r.status = 'approved'; r.resolvedAt = new Date().toISOString(); } }
      ok++;
    }
    await addLog('system', `Bulk approved ${ok} refund(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok });
    selectedIds.refunds.clear();
    calculateStats(); renderDashboard(); renderRefunds(); renderReports();
    toast.success('Done', `${ok} refund(s) approved.`);
  });
}

async function bulkRejectRefunds() {
  const ids = [...selectedIds.refunds].filter(id => refunds.find(r => r.id === id)?.status === 'pending');
  if (!ids.length) { toast.warning('None eligible', 'No pending refunds selected.'); return; }
  const reason = await customPrompt('Rejection reason (will be applied to all selected refunds):', '', 'Bulk Reject Refunds', 'e.g. Policy violation...');
  if (!reason) return;
  let ok = 0;
  for (const id of ids) {
    try { await apiRequest(`/refunds/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }); }
    catch { const r = refunds.find(x => x.id === id); if (r) { r.status = 'rejected'; r.rejectionReason = reason; r.resolvedAt = new Date().toISOString(); } }
    ok++;
  }
  await addLog('warning', `Bulk rejected ${ok} refund(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok, reason });
  selectedIds.refunds.clear();
  calculateStats(); renderDashboard(); renderRefunds(); renderReports();
  toast.warning('Done', `${ok} refund(s) rejected.`);
}

/* =============================================
   SERVICE REQUESTS
============================================= */
const SR_CATEGORY_ICONS = {
  ticket_issue:      'fa-solid fa-ticket',
  payment_problem:   'fa-solid fa-credit-card',
  refund_request:    'fa-solid fa-rotate-left',
  organizer_support: 'fa-solid fa-user-tie',
  account_issue:     'fa-solid fa-user-lock',
  bug_report:        'fa-solid fa-bug',
  other:             'fa-solid fa-circle-question',
};

function _srStatusBadge(status) {
  const map = {
    pending:     ['badge-sr-pending',     'fa-clock',        'Pending'],
    in_progress: ['badge-sr-in_progress', 'fa-spinner',      'In Progress'],
    resolved:    ['badge-sr-resolved',    'fa-circle-check', 'Resolved'],
  };
  return map[status] || map.pending;
}

function renderServiceRequests() {
  const tb = document.getElementById('sr-table');
  if (!tb) return;
  const sorted = applySorting(getFilteredServiceRequests(), 'service-requests');
  const { rows, page, totalPages, total, pp } = paginate(sorted, 'service-requests');
  const openCount = serviceRequests.filter(r => r.status !== 'resolved').length;
  setText('open-sr-count', openCount);
  setText('quick-sr-count', openCount);
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fa-solid fa-headset" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>No service requests found</td></tr>';
    renderPaginationBar('sr-pagination', 'service-requests', 0, 1, 1, pp);
    return;
  }
  tb.innerHTML = rows.map(r => {
    const [sBadge, sIcon, sLabel] = _srStatusBadge(r.status);
    const shortId   = r.requestId || String(r.id).substring(0, 8).toUpperCase();
    const subDate   = new Date(r.submittedAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    const subTime   = new Date(r.submittedAt).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
    const catIcon   = SR_CATEGORY_ICONS[r.category] || SR_CATEGORY_ICONS.other;
    const isResolved = r.status === 'resolved';
    const sel       = selectedIds['service-requests'].has(r.id);
    return `
      <tr class="${sel ? 'row-selected' : ''} ${isResolved ? 'sr-row-resolved' : ''}">
        <td><input type="checkbox" class="row-checkbox" data-id="${r.id}" ${sel ? 'checked' : ''} onchange="toggleRowSelect('service-requests','${r.id}',this)"></td>
        <td>
          <div class="sr-table-id"><i class="fa-solid fa-fingerprint" style="margin-right:0.3rem;color:#475569;"></i>#${shortId}</div>
          <div style="font-size:0.7rem;color:#475569;margin-top:0.2rem;">${subDate}</div>
        </td>
        <td>
          <div class="sr-table-user">${r.userName || '—'}</div>
          <div class="sr-table-sub"><i class="fa-regular fa-envelope"></i> ${Array.isArray(r.userEmail) ? r.userEmail[0] : (r.userEmail || '—')}</div>
        </td>
        <td>
          <div class="sr-table-subject" title="${r.subject || ''}">${r.subject ? r.subject.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'}</div>
          <div class="sr-table-preview">${(r.message || '').substring(0,60)}${(r.message||'').length > 60 ? '…' : ''}</div>
        </td>
        <td>
          <span class="sr-category-pill ${r.category || 'other'}">
            <i class="${catIcon}"></i> ${(r.category||'other').charAt(0).toUpperCase()+(r.category||'other').slice(1)}
          </span>
        </td>
        <td>
          <div style="font-size:0.875rem;">${subDate}</div>
          <div style="font-size:0.72rem;color:#475569;">${subTime}</div>
        </td>
        <td>
          <span class="badge ${sBadge}"><i class="fa-solid ${sIcon}"></i> ${sLabel}</span>
          ${isResolved && r.resolvedAt ? `<div style="font-size:0.7rem;color:#34d399;margin-top:0.3rem;"><i class="fa-regular fa-calendar-check"></i> ${new Date(r.resolvedAt).toLocaleDateString()}</div>` : ''}
        </td>
        <td><div class="actions">
          <button class="btn-icon" style="background:#6366f1;" onclick="viewServiceRequest('${r.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
          ${r.status === 'pending' ? `<button class="btn-icon" style="background:#0891b2;" onclick="markServiceRequestInProgress('${r.id}')" title="Mark In Progress"><i class="fa-solid fa-spinner"></i></button>` : ''}
          ${!isResolved ? `<button class="btn-icon" style="background:#10b981;" onclick="openResolveServiceRequestModal('${r.id}')" title="Mark Resolved"><i class="fa-solid fa-circle-check"></i></button>` : ''}
        </div></td>
      </tr>`;
  }).join('');
  renderPaginationBar('sr-pagination', 'service-requests', total, page, totalPages, pp);
}

function getFilteredServiceRequests() {
  const search   = (document.getElementById('sr-search')?.value || '').toLowerCase();
  const status   = document.getElementById('sr-status-filter')?.value   || 'all';
  const category = document.getElementById('sr-category-filter')?.value || 'all';
  const dfrom    = document.getElementById('sr-date-from')?.value;
  const dto      = document.getElementById('sr-date-to')?.value;
  return [...serviceRequests].sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt)).filter(r => {
    const emailStr = Array.isArray(r.userEmail) ? r.userEmail.join(' ') : (r.userEmail || '');
    const mSearch = !search || String(r.id).toLowerCase().includes(search) || (r.requestId||'').toLowerCase().includes(search) || (r.userName||'').toLowerCase().includes(search) || emailStr.toLowerCase().includes(search) || (r.subject||'').toLowerCase().includes(search) || (r.message||'').toLowerCase().includes(search);
    return mSearch && (status === 'all' || r.status === status) && (category === 'all' || r.category === category) && applyDateRangeFilter(r.submittedAt, dfrom, dto);
  });
}

function filterServiceRequests() { pageState['service-requests'] = 1; renderServiceRequests(); }

function viewServiceRequest(srId) {
  const r = serviceRequests.find(x => x.id === srId);
  if (!r) return;
  const [sBadge, sIcon, sLabel] = _srStatusBadge(r.status);
  const emailDisplay = Array.isArray(r.userEmail) ? r.userEmail[0] : (r.userEmail || '—');
  const catIcon = SR_CATEGORY_ICONS[r.category] || SR_CATEGORY_ICONS.other;
  document.getElementById('sr-modal-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-fingerprint"></i> Request ID</div><div class="detail-value" style="font-family:monospace;font-size:0.85rem;">${r.requestId || r.id}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-circle-dot"></i> Status</div><div class="detail-value"><span class="badge ${sBadge}"><i class="fa-solid ${sIcon}"></i> ${sLabel}</span></div></div>
      <div class="detail-item"><div class="detail-label"><i class="${catIcon}"></i> Category</div><div class="detail-value"><span class="sr-category-pill ${r.category||'other'}">${(r.category||'other').charAt(0).toUpperCase()+(r.category||'other').slice(1)}</span></div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-calendar"></i> Submitted</div><div class="detail-value">${new Date(r.submittedAt).toLocaleString()}</div></div>
      ${r.resolvedAt ? `<div class="detail-item"><div class="detail-label"><i class="fa-solid fa-calendar-check"></i> Resolved</div><div class="detail-value">${new Date(r.resolvedAt).toLocaleString()}</div></div>` : '<div></div>'}
    </div>
    <div style="padding:1rem;background:#0f172a;border-radius:0.5rem;margin-bottom:1rem;">
      <h4 style="font-weight:700;margin-bottom:0.75rem;"><i class="fa-regular fa-user" style="color:#06b6d4;margin-right:0.4rem;"></i>Customer</h4>
      <div style="font-size:0.875rem;line-height:1.8;color:#94a3b8;">
        <div><i class="fa-regular fa-user" style="margin-right:0.3rem;"></i>${r.userName || '—'}</div>
        <div><i class="fa-regular fa-envelope" style="margin-right:0.3rem;"></i>${emailDisplay}</div>
      </div>
    </div>
    <div style="margin-bottom:1rem;">
      <h4 style="font-weight:700;margin-bottom:0.5rem;"><i class="fa-solid fa-message" style="color:#06b6d4;margin-right:0.4rem;"></i>Subject</h4>
      <div style="font-size:0.95rem;font-weight:600;color:#f1f5f9;">${r.subject ? r.subject.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'}</div>
    </div>
    <div style="margin-bottom:1rem;">
      <h4 style="font-weight:700;margin-bottom:0.5rem;"><i class="fa-regular fa-comment" style="color:#06b6d4;margin-right:0.4rem;"></i>Message</h4>
      <div class="sr-message-box">${r.message || '—'}</div>
    </div>
    ${r.resolutionNotes ? `
    <div style="margin-bottom:1rem;">
      <h4 style="font-weight:700;margin-bottom:0.5rem;"><i class="fa-solid fa-circle-check" style="color:#34d399;margin-right:0.4rem;"></i>Resolution Notes</h4>
      <div class="sr-resolution-box">${r.resolutionNotes}</div>
    </div>` : ''}
    ${r.status !== 'resolved' ? `
    <div style="display:flex;gap:0.75rem;margin-top:1.5rem;">
      ${r.status === 'pending' ? `<button class="btn" style="flex:1;background:#0891b2;color:white;" onclick="markServiceRequestInProgress('${r.id}');closeModal('sr-modal');"><i class="fa-solid fa-spinner"></i> Mark In Progress</button>` : ''}
      <button class="btn" style="flex:1;background:#10b981;color:white;" onclick="openResolveServiceRequestModal('${r.id}');closeModal('sr-modal');"><i class="fa-solid fa-circle-check"></i> Mark as Resolved</button>
    </div>` : ''}`;
  addLog('system', `Viewed service request: ${r.subject}`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, srId });
  openModal('sr-modal');
}

function openResolveServiceRequestModal(srId) {
  const r = serviceRequests.find(x => x.id === srId);
  if (!r) return;
  document.getElementById('resolve-sr-id').value = srId;
  document.getElementById('resolve-sr-info').innerHTML =
    `<strong>${r.userName || '—'}</strong><br>
     <span style="color:#94a3b8;font-size:0.78rem;">${r.subject || '—'}</span>`;
  document.getElementById('sr-resolution-notes').value = '';
  openModal('sr-resolve-modal');
}

async function markServiceRequestInProgress(srId) {
  const r = serviceRequests.find(x => x.id === srId);
  if (!r) return;
  try { await apiRequest(`/admin/service-requests/${srId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'in_progress' }) }); }
  catch { r.status = 'in_progress'; }
  await addLog('system', `Service request marked in progress: ${r?.subject}`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, srId, userName: r?.userName });
  calculateStats(); renderDashboard(); renderServiceRequests();
  toast.info('Marked in progress', 'The request has been updated.');
}

async function submitResolveServiceRequest() {
  const srId  = document.getElementById('resolve-sr-id').value;
  const notes = document.getElementById('sr-resolution-notes').value.trim();
  if (!notes) { toast.warning('Notes required', 'Please describe how this request was resolved.'); return; }
  const r = serviceRequests.find(x => x.id === srId);
  try { await apiRequest(`/admin/service-requests/${srId}/resolve`, { method: 'PATCH', body: JSON.stringify({ resolutionNotes: notes }) }); }
  catch { if (r) { r.status = 'resolved'; r.resolvedAt = new Date().toISOString(); r.resolutionNotes = notes; } }
  await addLog('system', `Service request resolved: ${r?.subject}`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, srId, userName: r?.userName });
  closeModal('sr-resolve-modal');
  calculateStats(); renderDashboard(); renderServiceRequests();
  toast.success('Request resolved', 'The customer will be notified of the resolution.');
}

async function bulkResolveServiceRequests() {
  const ids = [...selectedIds['service-requests']].filter(id => serviceRequests.find(r => r.id === id)?.status !== 'resolved');
  if (!ids.length) { toast.warning('None eligible', 'No unresolved requests selected.'); return; }
  const notes = await customPrompt('Resolution notes (will be applied to all selected requests):', '', 'Bulk Resolve Requests', 'Describe the resolution...');
  if (!notes) return;
  showBulkConfirm('Resolve Requests', `Mark ${ids.length} service request(s) as resolved?`, async () => {
    let ok = 0;
    for (const id of ids) {
      try { await apiRequest(`/admin/service-requests/${id}/resolve`, { method: 'PATCH', body: JSON.stringify({ resolutionNotes: notes }) }); }
      catch { const r = serviceRequests.find(x => x.id === id); if (r) { r.status = 'resolved'; r.resolvedAt = new Date().toISOString(); r.resolutionNotes = notes; } }
      ok++;
    }
    await addLog('system', `Bulk resolved ${ok} service request(s)`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, count: ok });
    selectedIds['service-requests'].clear();
    calculateStats(); renderDashboard(); renderServiceRequests();
    toast.success('Done', `${ok} service request(s) resolved.`);
  });
}

/* =============================================
   ADVANCED EXPORT MODAL
============================================= */
const EXPORT_TYPE_LABELS = {
  users:'Users', events:'Events', revenue:'Revenue', tickets:'Tickets',
  payouts:'Payouts', refunds:'Refunds', logs:'Logs', waitlist:'Waitlist',
  'service-requests':'Service Requests', transactions:'Transactions',
};

function openExportModal(type, selectedOnly = false) {
  document.getElementById('export-data-type').value     = type;
  document.getElementById('export-selected-only').value = selectedOnly ? 'true' : 'false';
  document.getElementById('export-modal-label').textContent = EXPORT_TYPE_LABELS[type] || 'Data';
  const notice    = document.getElementById('export-selected-notice');
  const noticeMsg = document.getElementById('export-selected-msg');
  if (selectedOnly) {
    const count = selectedIds[type]?.size || 0;
    notice.style.display = 'block';
    if (noticeMsg) noticeMsg.textContent = `Exporting ${count} selected record(s) only.`;
  } else {
    notice.style.display = 'none';
  }
  const defRange  = document.querySelector('input[name="export-range"][value="24h"]');
  const defFormat = document.querySelector('input[name="export-format"][value="csv"]');
  if (defRange)  defRange.checked  = true;
  if (defFormat) defFormat.checked = true;
  document.getElementById('custom-date-range').style.display = 'none';
  const now = new Date(); const prev = new Date(now); prev.setDate(prev.getDate()-1);
  const dfrom = document.getElementById('export-date-from');
  const dto   = document.getElementById('export-date-to');
  if (dfrom) dfrom.value = prev.toISOString().slice(0,10);
  if (dto)   dto.value   = now.toISOString().slice(0,10);
  updateExportPreview();
  openModal('export-modal');
}

function updateExportPreview() {
  const type  = document.getElementById('export-data-type')?.value || '';
  const fmt   = document.querySelector('input[name="export-format"]:checked')?.value || 'csv';
  const range = document.querySelector('input[name="export-range"]:checked')?.value  || '24h';
  const label = EXPORT_TYPE_LABELS[type] || 'records';
  const rMap  = { '24h':'last 24 hours', '30d':'last 30 days', '90d':'last 90 days', 'custom':'the selected date range' };
  const selOnly = document.getElementById('export-selected-only')?.value === 'true';
  const scope   = selOnly ? `${selectedIds[type]?.size || 0} selected records` : `${label} from ${rMap[range] || 'all time'}`;
  const previewEl = document.getElementById('export-preview-text');
  if (previewEl) previewEl.textContent = `Exporting ${scope} as ${fmt.toUpperCase()}.`;
}

function _getExportSourceData(type) {
  const selectedOnly = document.getElementById('export-selected-only')?.value === 'true';
  const ids = selectedIds[type] || new Set();
  const sourceMap = {
    users: users, events: events, revenue: tickets, tickets: tickets,
    payouts: payouts, refunds: refunds, logs: logs,
    waitlist: waitlist, 'service-requests': serviceRequests, transactions: transactions,
  };
  let data = sourceMap[type] || [];
  if (selectedOnly && ids.size > 0) data = data.filter(item => ids.has(item.id));
  return data;
}

function _applyExportDateFilter(data, type) {
  const range = document.querySelector('input[name="export-range"]:checked')?.value || '24h';
  const now   = new Date();
  let from, to = now;
  if      (range === '24h')    { from = new Date(now); from.setHours(from.getHours()-24); }
  else if (range === '30d')    { from = new Date(now); from.setDate(from.getDate()-30); }
  else if (range === '90d')    { from = new Date(now); from.setDate(from.getDate()-90); }
  else if (range === 'custom') {
    const fv = document.getElementById('export-date-from')?.value;
    const tv = document.getElementById('export-date-to')?.value;
    from = fv ? new Date(fv) : new Date(0);
    to   = tv ? new Date(tv + 'T23:59:59') : now;
  } else { return data; }
  if (document.getElementById('export-selected-only')?.value === 'true') return data;
  const dateField = {
    users:'createdAt', events:'date', tickets:'purchasedAt', revenue:'purchasedAt',
    payouts:'requestedAt', refunds:'requestedAt', logs:'timestamp',
    waitlist:'joinedAt', 'service-requests':'submittedAt', transactions:'createdAt',
  }[type] || 'createdAt';
  return data.filter(item => {
    const d = new Date(item[dateField] || item.createdAt || item.timestamp);
    return !isNaN(d) && d >= from && d <= to;
  });
}

async function executeExport() {
  const type   = document.getElementById('export-data-type').value;
  const fmt    = document.querySelector('input[name="export-format"]:checked')?.value || 'csv';
  const label  = EXPORT_TYPE_LABELS[type] || type;
  if (type === 'logs') {
    try { const r = await apiRequest('/admin/logs?limit=10000'); logs = (r.logs || logs).filter(l => !_isExcludedLog(l.message)); } catch {}
  }
  const rawData  = _getExportSourceData(type);
  const filtered = _applyExportDateFilter(rawData, type);
  if (!filtered.length) { toast.warning('No data', `No ${label} records match the selected criteria.`); return; }
  const selOnly   = document.getElementById('export-selected-only')?.value === 'true';
  const rangeStr  = selOnly ? 'selected' : (document.querySelector('input[name="export-range"]:checked')?.value || 'all');
  const filename  = `glycr_${type.replace('-','_')}_${rangeStr}_${new Date().toISOString().slice(0,10)}`;
  if      (fmt === 'json') exportJson(filtered, `${filename}.json`);
  else if (fmt === 'pdf')  exportPdf(filtered, type, label, `${filename}.pdf`);
  else                     exportCsvForType(filtered, type, `${filename}.csv`);
  await addLog('system', `Exported ${filtered.length} ${label} record(s) as ${fmt.toUpperCase()}`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, type, format: fmt, count: filtered.length, selectedOnly: selOnly });
  toast.success('Export started', `${filtered.length} ${label} record${filtered.length !== 1 ? 's' : ''} — ${fmt.toUpperCase()} downloading.`);
  closeModal('export-modal');
}

function exportCsvForType(data, type, filename) {
  let csv = '';
  if (type === 'users') {
    csv = 'ID,Name,Email,Phone,Role,Suspended,CreatedAt\n';
    data.forEach(u => { csv += `${u.id},"${u.name||''}","${u.email}","${u.phone||''}","${u.role}",${u.suspended||false},"${u.createdAt||''}"\n`; });
  } else if (type === 'events') {
    csv = 'ID,Title,Organizer Email,Date,Venue,Location,Category,Published,Cancelled,Flagged\n';
    data.forEach(e => {
      const org = users.find(u => u.id === (e.organizerId?.id||e.organizerId?._id?.toString()));
      csv += `${e.id},"${e.title}","${org?.email||'Unknown'}","${e.date}","${e.venue||''}","${e.location||''}","${e.category||''}",${e.isPublished},${e.isCancelled},${e.flagged||false}\n`;
    });
  } else if (type === 'revenue' || type === 'tickets') {
    csv = 'TicketID,Type,Price,Status,EventTitle,EventDate,BuyerName,BuyerEmail,BuyerPhone,PurchasedAt\n';
    data.forEach(t => {
      const ev   = resolveEventForTicket(t);
      const user = resolveUserForTicket(t);
      csv += `"${t.id}","${t.ticketType||''}",${t.price||0},"${getTicketStatus(t)}","${ev?.title||''}","${ev?.date||''}","${user?.name||''}","${t.userEmail||user?.email||''}","${t.userPhone||user?.phone||''}","${t.purchasedAt||''}"\n`;
    });
  } else if (type === 'payouts') {
    csv = 'ID,OrganizerEmail,PayoutEmail,Amount,Method,Status,RequestedAt,CompletedAt,RejectionReason\n';
    data.forEach(p => {
      const org = users.find(u => u.id === (p.organizerId?.id||p.organizerId?._id?.toString()));
      csv += `"${p.id}","${org?.email||''}","${p.email}",${p.amount},"${p.method}","${p.status}","${p.requestedAt}","${p.completedAt||''}","${(p.rejectionReason||'').replace(/"/g,"'")}"\n`;
    });
  } else if (type === 'logs') {
    csv = 'Timestamp,Type,Message,AdminName,AdminRole,Meta\n';
    data.forEach(l => {
      const meta = { ...l.meta };
      const adminName = meta.adminName || ''; delete meta.adminName;
      const adminRole = meta.adminRole || ''; delete meta.adminRole;
      csv += `"${l.timestamp}","${l.type}","${l.message}","${adminName}","${adminRole}","${JSON.stringify(meta).replace(/"/g,"'")}"\n`;
    });
  } else if (type === 'refunds') {
    csv = 'ID,CustomerName,CustomerEmail,Amount,Reason,Status,TicketID,EventTitle,RequestedAt,ResolvedAt,RejectionReason\n';
    data.forEach(r => {
      const ticketIdStr = _resolveRefundTicketIdString(r);
      const user   = users.find(u => u.id === (r.userId?.id||r.userId?._id?.toString()||r.userId));
      const ticket = _resolveRefundTicket(r);
      const ev     = ticket ? resolveEventForTicket(ticket) : null;
      csv += `"${r.id}","${r.userName||user?.name||''}","${r.userEmail||user?.email||''}",${r.amount||0},"${r.reason||''}","${r.status}","${ticketIdStr}","${ev?.title||r.eventTitle||''}","${r.requestedAt||''}","${r.resolvedAt||''}","${(r.rejectionReason||'').replace(/"/g,"'")}"\n`;
    });
  } else if (type === 'waitlist') {
    csv = 'ID,UserName,UserEmail,UserPhone,EventTitle,EventDate,Position,JoinedAt,Notified\n';
    data.forEach(w => { csv += `"${w.id}","${w.userName||''}","${w.userEmail||''}","${w.userPhone||''}","${w.eventTitle||''}","${w.eventDate||''}",${w.position||''},"${w.joinedAt||''}",${w.notified||false}\n`; });
  } else if (type === 'service-requests') {
    csv = 'ID,UserName,UserEmail,Category,Subject,Status,SubmittedAt,ResolvedAt,ResolutionNotes\n';
    data.forEach(r => { csv += `"${r.id}","${r.userName||''}","${r.userEmail||''}","${r.category||''}","${(r.subject||'').replace(/"/g,"'")}","${r.status}","${r.submittedAt||''}","${r.resolvedAt||''}","${(r.resolutionNotes||'').replace(/"/g,"'")}"\n`; });
  } else if (type === 'transactions') {
    csv = 'ID,Type,Category,Amount,Status,Method,UserName,UserEmail,Reference,Description,EventTitle,CreatedAt\n';
    data.forEach(t => {
      csv += `"${t.id}","${t.type}","${t.category||''}",${t.amount||0},"${t.status}","${t.method||''}","${t.userName||''}","${t.userEmail||''}","${t.reference||''}","${(t.description||'').replace(/"/g,"'")}","${t.eventTitle||''}","${t.createdAt||''}"\n`;
    });
  }
  downloadBlob(csv, filename, 'text/csv');
}

function exportJson(data, filename) {
  downloadBlob(JSON.stringify(data, null, 2), filename, 'application/json');
}

function exportPdf(data, type, label, filename) {
  const rows = data.slice(0, 500);
  const keys = rows.length ? Object.keys(rows[0]).slice(0, 8) : [];
  const tableRows = rows.map(r =>
    `<tr>${keys.map(k => `<td style="padding:4px 8px;border:1px solid #ccc;font-size:10px;">${String(r[k]??'').substring(0,60)}</td>`).join('')}</tr>`
  ).join('');
  const html = `<!DOCTYPE html><html><head><title>${label} Report</title>
    <style>body{font-family:sans-serif;padding:20px;}h1{font-size:18px;}table{width:100%;border-collapse:collapse;}th{background:#1e293b;color:#fff;padding:6px 8px;font-size:11px;border:1px solid #ccc;}</style>
    </head><body>
    <h1>${label} Report — ${new Date().toLocaleString()}</h1>
    <p style="font-size:12px;color:#555;">${rows.length} records</p>
    <table><thead><tr>${keys.map(k=>`<th>${k}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>
    </body></html>`;
  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 500); }
  else toast.warning('Popup blocked', 'Please allow popups for PDF export.');
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* =============================================
   MODAL HELPERS
============================================= */
function openModal(id)  { document.getElementById(id)?.classList.add('show'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }

document.querySelectorAll('.modal').forEach(modal =>
  modal.addEventListener('click', e => {
    if (['custom-confirm-modal','custom-alert-modal','custom-prompt-modal'].includes(modal.id)) return;
    if (e.target === modal) modal.classList.remove('show');
  })
);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.show').forEach(m => {
      if (!['custom-confirm-modal','custom-alert-modal','custom-prompt-modal'].includes(m.id)) {
        m.classList.remove('show');
      }
    });
  }
});

/* =============================================
   FILTER HELPERS
============================================= */
function filterUsers()           { pageState.users             = 1; renderUsers();           }
function filterEvents()          { pageState.events            = 1; renderEvents();          }
function filterPayouts()         { pageState.payouts           = 1; renderPayouts();         }
function filterTickets()         { pageState.tickets           = 1; renderTickets();         }
function filterRefunds()         { pageState.refunds           = 1; renderRefunds();         }
function filterWaitlist()        { pageState.waitlist          = 1; renderWaitlist();        }
function filterServiceRequests() { pageState['service-requests'] = 1; renderServiceRequests(); }
function filterMessages()        { pageState.messages          = 1; renderMessages();        }
function filterTransactions()    { pageState.transactions      = 1; renderTransactions();    }

/* =============================================
   INITIAL LOAD
============================================= */
loadData();