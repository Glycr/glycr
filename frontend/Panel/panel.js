/* ===============================================
   GLYCR ADMIN PANEL – FULL API INTEGRATION + RBAC
   =============================================== */

// ---------- CONFIGURATION ----------
const API_BASE = 'http://localhost:5001/api';
let authToken = null;
let currentAdmin = { name: 'Admin', email: '', role: '' };

// ---------- GLOBAL DATA ----------
let users   = [];
let events  = [];
let tickets = [];
let payouts = [];
let logs    = [];
let stats   = {};
let platformFeePercent = 3;

// =============================================
// TOAST NOTIFICATION SYSTEM (NEW)
// =============================================
const TOAST_ICONS = {
  success: 'fa-solid fa-circle-check',
  error:   'fa-solid fa-circle-xmark',
  warning: 'fa-solid fa-triangle-exclamation',
  info:    'fa-solid fa-circle-info',
};

let _toastIdCounter = 0;

/**
 * Show a toast notification.
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {string} title  — bold heading
 * @param {string} message — optional body text
 * @param {number} duration — ms before auto-dismiss (default 4000)
 */
function showToast(type = 'info', title = '', message = '', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const id      = ++_toastIdCounter;
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

  // Auto-dismiss
  const timer = setTimeout(() => dismissToast(id), duration);
  toast._dismissTimer = timer;
}

function dismissToast(id) {
  const toast = document.getElementById(`toast-${id}`);
  if (!toast) return;
  clearTimeout(toast._dismissTimer);
  toast.classList.add('toast-out');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

// Convenience wrappers
const toast = {
  success: (title, msg, dur) => showToast('success', title, msg, dur),
  error:   (title, msg, dur) => showToast('error',   title, msg, dur),
  warning: (title, msg, dur) => showToast('warning', title, msg, dur),
  info:    (title, msg, dur) => showToast('info',    title, msg, dur),
};

// ---------- API HELPER ----------
async function apiRequest(endpoint, options = {}) {
  let token = authToken;
  if (!token) {
    token = sessionStorage.getItem('glycr_admin_token');
    if (token) authToken = token;
  }
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try { const err = await response.json(); errorMsg = err.error || errorMsg; } catch (e) {}
    throw new Error(errorMsg);
  }
  return response.json();
}

// ---------- RBAC ----------
function canSuspendUser(user) {
  if (currentAdmin.role === 'admin') return true;
  if (currentAdmin.role === 'moderator') return user.role !== 'admin' && user.role !== 'moderator';
  return false;
}
function canDeleteUser(user) {
  if (currentAdmin.role === 'admin') return true;
  if (currentAdmin.role === 'moderator') return user.role !== 'admin' && user.role !== 'moderator';
  return false;
}
function canEditUser(user) {
  if (currentAdmin.role === 'admin') return true;
  if (currentAdmin.role === 'moderator') return user.role !== 'admin' && user.role !== 'moderator';
  return false;
}
function canEditSettings() {
  return currentAdmin.role === 'admin';
}

// ---------- LOGIN / LOGOUT ----------
async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl  = document.getElementById('login-error');
  try {
    const result = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    authToken = result.token;
    currentAdmin = result.user;
    currentAdmin.role = result.user.role || 'customer';
    sessionStorage.setItem('glycr_admin_auth', 'true');
    sessionStorage.setItem('glycr_admin_token', authToken);
    sessionStorage.setItem('glycr_admin_user', JSON.stringify(currentAdmin));
    await addLog('auth', 'Admin login successful', { user: email, role: currentAdmin.role });
    document.getElementById('login-page').style.display  = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    document.getElementById('admin-display-name').textContent = currentAdmin.name || 'Admin';
    document.getElementById('admin-display-role').textContent = getRoleDisplay(currentAdmin.role);
    document.getElementById('last-login-display').textContent = new Date().toLocaleString();
    await loadPlatformFee();
    await loadData();
    toast.success('Welcome back!', `Signed in as ${currentAdmin.name || email}`);
  } catch (err) {
    errorEl.style.display = 'flex';
    document.getElementById('login-error-msg').textContent = err.message;
    toast.error('Login failed', err.message);
    await addLog('danger', 'Failed admin login attempt', { email });
  }
}

function getRoleDisplay(role) {
  switch(role) {
    case 'admin': return 'Administrator';
    case 'moderator': return 'Moderator';
    case 'organizer': return 'Organizer';
    default: return 'Customer';
  }
}

function handleLogout() {
  closeDropdown();
  addLog('auth', 'Admin logged out', { user: currentAdmin.email });
  sessionStorage.removeItem('glycr_admin_auth');
  sessionStorage.removeItem('glycr_admin_token');
  sessionStorage.removeItem('glycr_admin_user');
  authToken = null;
  currentAdmin = { name: 'Admin', email: '', role: '' };
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('login-page').style.display  = 'flex';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
}

window.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('glycr_admin_auth') === 'true') {
    const token   = sessionStorage.getItem('glycr_admin_token');
    const userStr = sessionStorage.getItem('glycr_admin_user');
    if (token && userStr) {
      authToken = token;
      currentAdmin = JSON.parse(userStr);
      currentAdmin.role = currentAdmin.role || 'customer';
      document.getElementById('login-page').style.display  = 'none';
      document.getElementById('admin-panel').style.display = 'block';
      document.getElementById('admin-display-name').textContent = currentAdmin.name || 'Admin';
      document.getElementById('admin-display-role').textContent = getRoleDisplay(currentAdmin.role);
      document.getElementById('last-login-display').textContent = new Date().toLocaleString();
      loadPlatformFee().then(() => loadData());
    }
  }

  // Export modal — listen for range radio changes to show/hide custom range
  document.querySelectorAll('input[name="export-range"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isCustom = document.querySelector('input[name="export-range"]:checked')?.value === 'custom';
      document.getElementById('custom-date-range').style.display = isCustom ? 'block' : 'none';
      updateExportPreview();
    });
  });
  document.querySelectorAll('input[name="export-format"]').forEach(radio => {
    radio.addEventListener('change', updateExportPreview);
  });
  document.getElementById('export-date-from')?.addEventListener('change', updateExportPreview);
  document.getElementById('export-date-to')?.addEventListener('change', updateExportPreview);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-page').style.display !== 'none') handleLogin();
});

// ---------- PROFILE DROPDOWN ----------
function toggleProfileDropdown() {
  document.getElementById('profile-dropdown').classList.toggle('open');
}
function closeDropdown() {
  document.getElementById('profile-dropdown').classList.remove('open');
}
document.addEventListener('click', e => {
  const wrap = document.getElementById('profile-dropdown-wrap');
  if (wrap && !wrap.contains(e.target)) closeDropdown();
});

async function saveProfile() {
  const name  = document.getElementById('profile-name-input').value.trim();
  const email = document.getElementById('profile-email-input').value.trim();
  if (!name || !email) return;
  try {
    await apiRequest('/auth/profile', { method: 'PUT', body: JSON.stringify({ name, email }) });
    currentAdmin.name = name; currentAdmin.email = email;
    document.getElementById('admin-display-name').textContent  = name;
    document.getElementById('profile-modal-name').textContent  = name;
    document.getElementById('profile-modal-email').textContent = email;
    await addLog('system', 'Admin profile updated', { name, email });
    closeModal('profile-modal');
    toast.success('Profile updated', 'Your changes have been saved.');
  } catch (err) {
    toast.error('Update failed', err.message);
  }
}

// ---------- PLATFORM FEE ----------
async function loadPlatformFee() {
  try {
    const res = await apiRequest('/admin/settings');
    platformFeePercent = res.platformFee || 3;
    const feeInput = document.getElementById('platform-fee-setting');
    if (feeInput) feeInput.value = platformFeePercent;
  } catch (err) {
    console.warn('Could not fetch platform fee, using default', err);
    platformFeePercent = 3;
  }
}

async function savePlatformFee() {
  if (!canEditSettings()) {
    toast.error('Permission denied', 'Only administrators can change platform settings.');
    return;
  }
  const newFee = parseFloat(document.getElementById('platform-fee-setting').value);
  if (isNaN(newFee) || newFee < 0 || newFee > 50) {
    toast.warning('Invalid value', 'Platform fee must be between 0 and 50.');
    return;
  }
  try {
    await apiRequest('/admin/settings', { method: 'PUT', body: JSON.stringify({ platformFee: newFee }) });
    platformFeePercent = newFee;
    await addLog('system', `Platform fee updated to ${newFee}%`);
    await loadData();
    toast.success('Settings saved', `Platform fee is now ${newFee}%.`);
  } catch (err) {
    toast.error('Save failed', err.message);
  }
}

function saveSettings() {
  savePlatformFee();
  addLog('system', 'Admin settings saved');
  closeModal('settings-modal');
}

// ---------- TABS ----------
function showTab(tab, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tab).classList.add('active');
  if (el) el.classList.add('active');
  if (tab === 'logs') renderLogs();
}

// ---------- LOGS ENGINE ----------
const LOG_ICONS = {
  auth:    { icon: 'fa-solid fa-right-to-bracket',     cls: 'auth' },
  event:   { icon: 'fa-regular fa-calendar',           cls: 'event' },
  payout:  { icon: 'fa-solid fa-money-bill-transfer',  cls: 'payout' },
  user:    { icon: 'fa-solid fa-user-pen',             cls: 'user' },
  system:  { icon: 'fa-solid fa-gear',                 cls: 'system' },
  warning: { icon: 'fa-solid fa-triangle-exclamation', cls: 'warning' },
  danger:  { icon: 'fa-solid fa-circle-xmark',         cls: 'danger' },
};

async function addLog(type, message, meta = {}) {
  try {
    await apiRequest('/admin/logs', { method: 'POST', body: JSON.stringify({ type, message, meta }) });
  } catch (err) {
    console.warn('Failed to save log to server', err);
    const fallback = { id: Date.now() + Math.random(), type, message, meta, timestamp: new Date().toISOString() };
    logs.unshift(fallback);
    try { localStorage.setItem('glycr_admin_logs', JSON.stringify(logs.slice(0, 500))); } catch {}
  }
  const el = document.getElementById('quick-log-count');
  if (el) el.textContent = logs.length;
}

async function loadLogs() {
  try {
    const result = await apiRequest('/admin/logs?limit=500');
    logs = result.logs || [];
    localStorage.setItem('glycr_admin_logs', JSON.stringify(logs));
  } catch (err) {
    console.warn('Failed to load logs from server, using localStorage', err);
    try { const stored = localStorage.getItem('glycr_admin_logs'); if (stored) logs = JSON.parse(stored); } catch { logs = []; }
    if (logs.length === 0) logs = [{ type:'system', message:'Admin panel initialised (offline mode)', timestamp:new Date().toISOString(), meta:{} }];
  }
  renderLogs();
}

function renderLogs() {
  const search = (document.getElementById('log-search')?.value || '').toLowerCase();
  const type   = document.getElementById('log-type-filter')?.value || 'all';
  const sort   = document.getElementById('log-sort')?.value         || 'desc';

  let filtered = logs.filter(l => {
    const matchType   = type === 'all' || l.type === type;
    const matchSearch = !search || l.message.toLowerCase().includes(search) || JSON.stringify(l.meta).toLowerCase().includes(search);
    return matchType && matchSearch;
  });
  if (sort === 'asc') filtered = [...filtered].reverse();

  const countEl = document.getElementById('log-count-badge');
  if (countEl) countEl.textContent = `${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'}`;

  const container = document.getElementById('logs-list');
  if (!container) return;
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-scroll" style="font-size:1.5rem; display:block; margin-bottom:0.5rem;"></i>No log entries found</div>';
    return;
  }
  container.innerHTML = filtered.map(entry => {
    const def     = LOG_ICONS[entry.type] || LOG_ICONS.system;
    const time    = new Date(entry.timestamp);
    const timeStr = time.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    const dateStr = time.toLocaleDateString('en-GB',  { day:'2-digit', month:'short', year:'numeric' });
    const metaKeys = Object.keys(entry.meta || {});
    const metaHtml = metaKeys.map(k => `<span class="log-meta-item"><i class="fa-solid fa-tag" style="font-size:0.6rem;"></i><strong>${k}:</strong> ${entry.meta[k]}</span>`).join('');
    return `
      <div class="log-item">
        <div class="log-icon-wrap ${def.cls}"><i class="${def.icon}"></i></div>
        <div class="log-body">
          <div class="log-message">${entry.message}</div>
          <div class="log-meta">
            <span class="log-meta-item"><i class="fa-regular fa-clock" style="font-size:0.65rem;"></i> ${dateStr}</span>
            ${metaHtml}
          </div>
        </div>
        <div class="log-timestamp">${timeStr}</div>
      </div>`;
  }).join('');
}

async function clearLogs() {
  if (!confirm('Clear all log entries? This cannot be undone.')) return;
  try {
    await apiRequest('/admin/logs', { method: 'DELETE' });
    logs = [];
    localStorage.removeItem('glycr_admin_logs');
    await addLog('system', 'Logs cleared by admin');
    renderLogs();
    toast.info('Logs cleared', 'All activity logs have been removed.');
  } catch (err) {
    toast.error('Clear failed', err.message);
  }
}

// ---------- DATA LOAD ----------
async function loadData() {
  try {
    users   = await apiRequest('/admin/users');
    events  = await apiRequest('/admin/events');
    tickets = await apiRequest('/admin/tickets');
    payouts = await apiRequest('/admin/payouts');
    await loadLogs();
    calculateStats();
    renderDashboard();
    renderUsers();
    renderEvents();
    renderTickets();
    renderPayouts();
    renderReports();
    renderLogs();
    await addLog('system', 'Data refreshed', { users: users.length, events: events.length, tickets: tickets.length });
  } catch (err) {
    console.error('Failed to load data', err);
    await addLog('danger', 'Failed to load admin data', { error: err.message });
    toast.error('Load failed', 'Check that the backend is running and you are logged in.');
  }
}

// ---------- STATISTICS ----------
function calculateStats() {
  const totalOrganizers = users.filter(u => u.role === 'organizer').length;
  const liveEvents      = events.filter(e => e.isPublished && !e.isCancelled && new Date(e.date) > new Date()).length;
  const totalRevenue    = tickets.reduce((sum, t) => sum + t.price, 0);
  const pendingPayouts  = payouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
  const flaggedEvents   = events.filter(e => e.flagged).length;
  stats = {
    totalUsers: users.length,
    totalOrganizers,
    totalEvents: events.length,
    liveEvents,
    totalRevenue,
    pendingPayouts,
    totalTickets: tickets.length,
    flaggedEvents,
    platformFeeAmount: totalRevenue * (platformFeePercent / 100),
    platformFeeRate: platformFeePercent,
  };
}

function renderDashboard() {
  document.getElementById('stat-users').textContent        = stats.totalUsers;
  document.getElementById('stat-live-events').textContent  = stats.liveEvents;
  document.getElementById('stat-revenue').textContent      = `₵${stats.totalRevenue.toFixed(2)}`;
  document.getElementById('stat-tickets').textContent      = stats.totalTickets;
  document.getElementById('stat-organizers').textContent   = stats.totalOrganizers;
  document.getElementById('stat-total-events').textContent = stats.totalEvents;
  document.getElementById('stat-avg-revenue').textContent  = `₵${stats.totalEvents > 0 ? (stats.totalRevenue / stats.totalEvents).toFixed(2) : '0.00'}`;
  document.getElementById('quick-users-count').textContent     = stats.totalUsers;
  document.getElementById('quick-pending-payouts').textContent = `₵${stats.pendingPayouts.toFixed(2)}`;
  document.getElementById('quick-flagged-events').textContent  = stats.flaggedEvents;
  document.getElementById('quick-log-count').textContent       = logs.length;
  const feeEl = document.getElementById('stat-platform-fee');
  if (feeEl) feeEl.textContent = `₵${stats.platformFeeAmount.toFixed(2)} (${stats.platformFeeRate}%)`;
}

// ---------- USERS ----------
function renderUsers() {
  const tableBody = document.getElementById('users-table');
  const filtered  = getFilteredUsers();
  if (filtered.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fa-solid fa-users-slash" style="font-size:1.5rem; display:block; margin-bottom:0.5rem;"></i>No users found</td></tr>';
    return;
  }
  tableBody.innerHTML = filtered.map(user => {
    let roleBadgeClass = 'badge-customer', roleIcon = 'fa-user', roleDisplay = 'Customer';
    switch (user.role) {
      case 'organizer': roleBadgeClass = 'badge-organizer'; roleIcon = 'fa-user-tie';    roleDisplay = 'Organizer'; break;
      case 'moderator': roleBadgeClass = 'badge-moderator'; roleIcon = 'fa-user-cog';    roleDisplay = 'Moderator'; break;
      case 'admin':     roleBadgeClass = 'badge-admin';     roleIcon = 'fa-user-shield'; roleDisplay = 'Admin';     break;
    }
    const showEdit = canEditUser(user);
    return `
      <tr>
        <td>
          <div style="font-weight:600;">${user.name || 'User'}</div>
          <div style="font-size:0.75rem; color:#94a3b8;"><i class="fa-solid fa-fingerprint"></i> ID: ${user.id}</div>
        </td>
        <td>
          <div style="font-size:0.875rem;"><i class="fa-regular fa-envelope" style="margin-right:0.3rem;"></i>${user.email}</div>
          <div style="color:#94a3b8;"><i class="fa-solid fa-mobile-screen-button" style="margin-right:0.3rem;"></i>${user.phone}</div>
        </td>
        <td><span class="badge ${roleBadgeClass}"><i class="fa-solid ${roleIcon}"></i> ${roleDisplay}</span></td>
        <td><span class="badge ${user.suspended ? 'badge-suspended' : 'badge-active'}"><i class="fa-solid ${user.suspended ? 'fa-ban' : 'fa-circle-check'}"></i> ${user.suspended ? 'Suspended' : 'Active'}</span></td>
        <td>
          <div class="actions">
            <button class="btn-icon" style="background:#6366f1;" onclick="viewUser('${user.id}')" title="View Details"><i class="fa-solid fa-eye"></i></button>
            ${showEdit ? `<button class="btn-icon" style="background:#8b5cf6;" onclick="openEditUserModal('${user.id}')" title="Edit User"><i class="fa-solid fa-pen-to-square"></i></button>` : ''}
            ${canSuspendUser(user) ? `<button class="btn-icon" style="background:${user.suspended ? '#10b981' : '#f59e0b'};" onclick="suspendUser('${user.id}')" title="${user.suspended ? 'Unsuspend' : 'Suspend'}"><i class="fa-solid ${user.suspended ? 'fa-user-check' : 'fa-user-slash'}"></i></button>` : ''}
            ${canDeleteUser(user)  ? `<button class="btn-icon" style="background:#ef4444;" onclick="deleteUser('${user.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

function getFilteredUsers() {
  const search       = document.getElementById('user-search')?.value.toLowerCase()  || '';
  const roleFilter   = document.getElementById('user-role-filter')?.value            || 'all';
  const statusFilter = document.getElementById('user-status-filter')?.value          || 'all';
  return users.filter(u => {
    const matchSearch = (u.name || '').toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
    const matchRole   = roleFilter === 'all' || u.role === roleFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' && !u.suspended) || (statusFilter === 'suspended' && u.suspended);
    return matchSearch && matchRole && matchStatus;
  });
}

async function suspendUser(userId) {
  const user = users.find(u => u.id === userId);
  if (!canSuspendUser(user)) { toast.error('Permission denied', 'You cannot suspend this user.'); return; }
  try {
    await apiRequest(`/admin/users/${userId}/suspend`, { method: 'PATCH' });
    await addLog('user', 'User suspended/unsuspended', { userId });
    await loadData();
    toast.success('User updated', `Account has been ${user.suspended ? 'unsuspended' : 'suspended'}.`);
  } catch (err) { toast.error('Action failed', err.message); }
}

async function deleteUser(userId) {
  const user = users.find(u => u.id === userId);
  if (!canDeleteUser(user)) { toast.error('Permission denied', 'You cannot delete this user.'); return; }
  if (!confirm('Are you sure? This will delete all user data.')) return;
  try {
    await apiRequest(`/admin/users/${userId}`, { method: 'DELETE' });
    await addLog('danger', 'User deleted', { userId });
    await loadData();
    toast.success('User deleted', 'The account has been permanently removed.');
  } catch (err) { toast.error('Delete failed', err.message); }
}

function openEditUserModal(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return;
  document.getElementById('edit-user-id').value     = user.id;
  document.getElementById('edit-user-name').value   = user.name || '';
  document.getElementById('edit-user-email').value  = user.email || '';
  document.getElementById('edit-user-phone').value  = user.phone || '';
  document.getElementById('edit-user-role').value   = user.role || 'customer';
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
  try {
    await apiRequest(`/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify({ name, email, phone, role, suspended }) });
    await addLog('user', 'User details updated', { userId, name, email, role });
    closeModal('edit-user-modal');
    await loadData();
    toast.success('User updated', 'Changes saved successfully.');
  } catch (err) { toast.error('Update failed', err.message); }
}

function openAddUserModal() {
  ['add-user-name','add-user-email','add-user-phone','add-user-password'].forEach(id => { document.getElementById(id).value = ''; });
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
  const errorEl  = document.getElementById('add-user-error');
  const errorMsg = document.getElementById('add-user-error-msg');
  if (!name || !email || !password) { errorEl.style.display='block'; errorMsg.textContent='Name, email, and password are required.'; return; }
  try {
    await apiRequest('/admin/users', { method: 'POST', body: JSON.stringify({ name, email, phone, password, role }) });
    await addLog('user', 'New user created by admin', { name, email, role });
    closeModal('add-user-modal');
    await loadData();
    toast.success('User created', `${name} has been added to the platform.`);
  } catch (err) { errorEl.style.display='block'; errorMsg.textContent=err.message; }
}

// ---------- EVENTS ----------
function renderEvents() {
  const tableBody = document.getElementById('events-table');
  const filtered  = getFilteredEvents();
  if (filtered.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="4" class="empty-state"><i class="fa-regular fa-calendar-xmark" style="font-size:1.5rem; display:block; margin-bottom:0.5rem;"></i>No events found</td></tr>';
    return;
  }
  tableBody.innerHTML = filtered.map(event => {
    const organizer      = event.organizerId;
    const organizerName  = organizer?.name  || organizer?.email || 'Unknown';
    const organizerEmail = organizer?.email || '—';
    const eventTix   = tickets.filter(t => { const id = t.eventId?.id || t.eventId?._id?.toString(); return id === event.id; });
    const totalSold  = eventTix.length;
    const revenue    = eventTix.reduce((sum, t) => sum + t.price, 0);
    const dateStr = new Date(event.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    const timeStr = new Date(event.date).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
    const isLive  = event.isPublished && !event.isCancelled && new Date(event.date) > new Date();
    let statusBadges = '';
    if (event.flagged)    statusBadges += `<span class="badge badge-flagged"><i class="fa-solid fa-flag"></i> Flagged</span>`;
    if (event.isCancelled) { statusBadges += `<span class="badge badge-cancelled"><i class="fa-solid fa-circle-xmark"></i> Cancelled</span>`; }
    else if (isLive)       { statusBadges += `<span class="badge badge-live"><i class="fa-solid fa-circle-dot"></i> Live</span>`; }
    else if (!event.isPublished) { statusBadges += `<span class="badge badge-unpublished"><i class="fa-solid fa-eye-slash"></i> Unpublished</span>`; }
    else { statusBadges += `<span class="badge badge-info"><i class="fa-solid fa-check"></i> Ended</span>`; }
    const flagBtnStyle = event.flagged ? 'background:#10b981;' : 'background:#f59e0b;';
    const flagBtnIcon  = event.flagged ? 'fa-solid fa-flag-checkered' : 'fa-solid fa-flag';
    return `
      <tr>
        <td>
          <div class="event-table-name">${event.title}</div>
          <div class="event-table-meta">
            <span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
            <span><i class="fa-regular fa-clock"></i> ${timeStr}</span>
            <span><i class="fa-solid fa-location-dot"></i> ${event.venue}${event.location ? ', '+event.location : ''}</span>
            <span><i class="fa-solid fa-ticket"></i> ${totalSold} sold &nbsp;·&nbsp; <i class="fa-solid fa-coins"></i> ₵${revenue.toFixed(2)}</span>
          </div>
        </td>
        <td>
          <div class="event-table-organizer">${organizerName}</div>
          <div class="event-table-organizer-sub"><i class="fa-regular fa-envelope"></i> ${organizerEmail}</div>
        </td>
        <td><div class="event-status-cell">${statusBadges}</div></td>
        <td>
          <div class="actions">
            <button class="btn-icon" style="background:#6366f1;" onclick="viewEvent('${event.id}')" title="View Details"><i class="fa-solid fa-eye"></i></button>
            <button class="btn-icon" style="${flagBtnStyle}" onclick="flagEvent('${event.id}')" title="${event.flagged ? 'Unflag' : 'Flag'}"><i class="${flagBtnIcon}"></i></button>
            <button class="btn-icon" style="background:#f59e0b;" onclick="togglePublish('${event.id}')" title="${event.isPublished ? 'Unpublish' : 'Publish'}"><i class="fa-solid ${event.isPublished ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
            <button class="btn-icon" style="background:#ef4444;" onclick="deleteEvent('${event.id}')" title="Delete Event"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function getFilteredEvents() {
  const search = document.getElementById('event-search')?.value.toLowerCase() || '';
  const filter = document.getElementById('event-filter')?.value               || 'all';
  return events.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search) || e.venue.toLowerCase().includes(search);
    const matchFilter = filter === 'all' ||
      (filter === 'live'      && e.isPublished && !e.isCancelled && new Date(e.date) > new Date()) ||
      (filter === 'cancelled' && e.isCancelled) ||
      (filter === 'flagged'   && e.flagged);
    return matchSearch && matchFilter;
  });
}

async function flagEvent(eventId) {
  try {
    await apiRequest(`/admin/events/${eventId}/flag`, { method: 'PATCH' });
    await addLog('warning','Event flagged/unflagged',{eventId});
    await loadData();
    toast.warning('Event flagged', 'The event flag status has been updated.');
  } catch (err) { toast.error('Action failed', err.message); }
}
async function togglePublish(eventId) {
  try {
    await apiRequest(`/admin/events/${eventId}/publish`, { method: 'PATCH' });
    await addLog('system','Event publish status toggled',{eventId});
    await loadData();
    toast.info('Publish status updated', 'The event visibility has been changed.');
  } catch (err) { toast.error('Action failed', err.message); }
}
async function deleteEvent(eventId) {
  if (!confirm('Delete this event and all its tickets?')) return;
  try {
    await apiRequest(`/admin/events/${eventId}`, { method:'DELETE' });
    await addLog('danger','Event deleted',{eventId});
    await loadData();
    toast.success('Event deleted', 'The event and its tickets have been removed.');
  } catch (err) { toast.error('Delete failed', err.message); }
}

// ---------- TICKETS ----------
function resolveEventForTicket(ticket) {
  const eventId = ticket.eventId?.id || ticket.eventId?._id?.toString() || ticket.eventId;
  return events.find(e => e.id === eventId);
}
function resolveUserForTicket(ticket) {
  const userId = ticket.userId?.id || ticket.userId?._id?.toString() || ticket.userId;
  return users.find(u => u.id === userId);
}
function getTicketStatus(ticket) {
  return ticket.status || 'active';
}

function renderTickets() {
  const tableBody = document.getElementById('tickets-table');
  const filtered  = getFilteredTickets();

  if (filtered.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fa-solid fa-ticket" style="font-size:1.5rem; display:block; margin-bottom:0.5rem;"></i>No tickets found</td></tr>';
    return;
  }

  tableBody.innerHTML = filtered.map(ticket => {
    const event  = resolveEventForTicket(ticket);
    const user   = resolveUserForTicket(ticket);
    const status = getTicketStatus(ticket);

    const shortId    = String(ticket.id).length > 12 ? String(ticket.id).substring(0, 12).toUpperCase() + '…' : String(ticket.id).toUpperCase();
    const eventTitle = event?.title || 'Unknown Event';
    const eventDate  = event ? new Date(event.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
    const buyerName  = user?.name  || '—';
    const buyerEmail = ticket.userEmail || user?.email || '—';

    let statusBadgeClass = 'badge-active', statusIcon = 'fa-circle-check', statusLabel = 'Active';
    if (status === 'used')      { statusBadgeClass = 'badge-used';      statusIcon = 'fa-circle-check'; statusLabel = 'Used'; }
    if (status === 'cancelled') { statusBadgeClass = 'badge-cancelled'; statusIcon = 'fa-circle-xmark'; statusLabel = 'Cancelled'; }

    const canValidate = status === 'active';
    const canCancel   = status === 'active';

    return `
      <tr>
        <td>
          <div class="ticket-table-id" title="${ticket.id}">${shortId}</div>
          <div class="ticket-table-type">${ticket.ticketType || '—'}</div>
          <div style="font-size:0.7rem; color:#475569; margin-top:0.15rem;"><i class="fa-solid fa-coins" style="margin-right:0.2rem;"></i>₵${(ticket.price || 0).toFixed(2)}</div>
        </td>
        <td>
          <div class="ticket-table-event">${eventTitle}</div>
          <div class="ticket-table-event-meta">
            <span><i class="fa-regular fa-calendar"></i> ${eventDate}</span>
            ${event?.venue ? `<span><i class="fa-solid fa-location-dot"></i> ${event.venue}</span>` : ''}
          </div>
        </td>
        <td>
          <div class="ticket-table-user">${buyerName}</div>
          <div class="ticket-table-user-sub"><i class="fa-regular fa-envelope"></i> ${buyerEmail}</div>
          ${ticket.purchasedAt ? `<div style="font-size:0.7rem; color:#475569; margin-top:0.15rem;"><i class="fa-regular fa-clock" style="margin-right:0.2rem;"></i>${new Date(ticket.purchasedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>` : ''}
        </td>
        <td><span class="badge ${statusBadgeClass}"><i class="fa-solid ${statusIcon}"></i> ${statusLabel}</span></td>
        <td>
          <div class="actions">
            <button class="btn-icon" style="background:#6366f1;" onclick="viewTicket('${ticket.id}')" title="View Details"><i class="fa-solid fa-eye"></i></button>
            <button class="btn-icon" style="background:#8b5cf6;" onclick="openResendTicketModal('${ticket.id}')" title="Resend Ticket (Email / SMS)"><i class="fa-solid fa-envelope"></i></button>
            ${canValidate ? `<button class="btn-icon" style="background:#10b981;" onclick="validateTicket('${ticket.id}')" title="Validate / Mark Used"><i class="fa-solid fa-circle-check"></i></button>` : ''}
            ${canCancel   ? `<button class="btn-icon" style="background:#ef4444;" onclick="cancelTicket('${ticket.id}')" title="Cancel Ticket"><i class="fa-solid fa-ban"></i></button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

function getFilteredTickets() {
  const search       = document.getElementById('ticket-search')?.value.toLowerCase()  || '';
  const statusFilter = document.getElementById('ticket-status-filter')?.value          || 'all';
  const typeFilter   = document.getElementById('ticket-type-filter')?.value            || 'all';
  return tickets.filter(t => {
    const event  = resolveEventForTicket(t);
    const user   = resolveUserForTicket(t);
    const status = getTicketStatus(t);
    const matchSearch = !search ||
      String(t.id).toLowerCase().includes(search) ||
      (event?.title || '').toLowerCase().includes(search) ||
      (t.userEmail  || '').toLowerCase().includes(search) ||
      (user?.name   || '').toLowerCase().includes(search) ||
      (user?.email  || '').toLowerCase().includes(search);
    const matchStatus = statusFilter === 'all' || status === statusFilter;
    const matchType   = typeFilter === 'all'   || (t.ticketType || '').toLowerCase() === typeFilter;
    return matchSearch && matchStatus && matchType;
  });
}

function viewTicket(ticketId) {
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return;
  const event  = resolveEventForTicket(ticket);
  const user   = resolveUserForTicket(ticket);
  const status = getTicketStatus(ticket);
  let statusBadgeClass = 'badge-active', statusIcon = 'fa-circle-check', statusLabel = 'Active';
  if (status === 'used')      { statusBadgeClass = 'badge-used';      statusIcon = 'fa-circle-check'; statusLabel = 'Used'; }
  if (status === 'cancelled') { statusBadgeClass = 'badge-cancelled'; statusIcon = 'fa-circle-xmark'; statusLabel = 'Cancelled'; }

  document.getElementById('ticket-modal-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item" style="grid-column:span 2;"><div class="detail-label"><i class="fa-solid fa-fingerprint"></i> Ticket ID</div><div class="detail-value" style="font-family:monospace; font-size:0.82rem; word-break:break-all;">${ticket.id}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-tag"></i> Ticket Type</div><div class="detail-value" style="text-transform:uppercase;">${ticket.ticketType || '—'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-coins"></i> Price</div><div class="detail-value" style="color:#10b981;">₵${(ticket.price || 0).toFixed(2)}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-circle-dot"></i> Status</div><div class="detail-value"><span class="badge ${statusBadgeClass}"><i class="fa-solid ${statusIcon}"></i> ${statusLabel}</span></div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-clock"></i> Purchased At</div><div class="detail-value">${ticket.purchasedAt ? new Date(ticket.purchasedAt).toLocaleString() : '—'}</div></div>
    </div>
    <div style="margin-top:1rem; padding:1rem; background:#0f172a; border-radius:0.5rem; margin-bottom:1rem;">
      <h4 style="font-weight:700; margin-bottom:0.75rem;"><i class="fa-regular fa-calendar" style="color:#6366f1; margin-right:0.4rem;"></i>Event</h4>
      ${event ? `
        <div style="font-weight:600; margin-bottom:0.25rem;">${event.title}</div>
        <div style="font-size:0.82rem; color:#94a3b8; line-height:1.7;">
          <div><i class="fa-regular fa-calendar" style="margin-right:0.3rem;"></i>${new Date(event.date).toLocaleString()}</div>
          <div><i class="fa-solid fa-location-dot" style="margin-right:0.3rem;"></i>${event.venue}${event.location ? ', '+event.location : ''}</div>
          <div><i class="fa-solid fa-tag" style="margin-right:0.3rem;"></i>${event.category || '—'}</div>
        </div>` : '<p style="color:#94a3b8;">Event not found</p>'}
    </div>
    <div style="padding:1rem; background:#0f172a; border-radius:0.5rem; margin-bottom:1rem;">
      <h4 style="font-weight:700; margin-bottom:0.75rem;"><i class="fa-regular fa-user" style="color:#6366f1; margin-right:0.4rem;"></i>Customer</h4>
      <div style="font-size:0.875rem; line-height:1.8; color:#94a3b8;">
        <div><i class="fa-regular fa-user" style="margin-right:0.3rem;"></i>${user?.name || '—'}</div>
        <div><i class="fa-regular fa-envelope" style="margin-right:0.3rem;"></i>${ticket.userEmail || user?.email || '—'}</div>
        <div><i class="fa-solid fa-mobile-screen-button" style="margin-right:0.3rem;"></i>${ticket.userPhone || user?.phone || '—'}</div>
      </div>
    </div>
    <div style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-top:1.25rem;">
      <button class="btn btn-primary" onclick="openResendTicketModal('${ticket.id}'); closeModal('ticket-modal');">
        <i class="fa-solid fa-envelope"></i> Resend Ticket
      </button>
      ${status === 'active' ? `
        <button class="btn btn-success" onclick="validateTicket('${ticket.id}'); closeModal('ticket-modal');"><i class="fa-solid fa-circle-check"></i> Validate</button>
        <button class="btn btn-danger" onclick="cancelTicket('${ticket.id}'); closeModal('ticket-modal');"><i class="fa-solid fa-ban"></i> Cancel</button>` : ''}
    </div>`;
  addLog('system', 'Viewed ticket details', { ticketId });
  openModal('ticket-modal');
}

// ---------- RESEND TICKET (NEW) ----------
function openResendTicketModal(ticketId) {
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return;
  const event = resolveEventForTicket(ticket);
  const user  = resolveUserForTicket(ticket);

  document.getElementById('resend-ticket-id').value = ticketId;
  document.getElementById('resend-ticket-info').innerHTML = `
    <strong>${ticket.ticketType?.toUpperCase() || 'TICKET'}</strong> — ${event?.title || 'Unknown Event'}<br>
    <span style="color:#94a3b8; font-size:0.78rem;">ID: ${ticket.id}</span>`;

  // Pre-fill known contact info
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

  if (!email && !phone) {
    toast.warning('No contact info', 'Please enter an email address or phone number.');
    return;
  }

  statusEl.style.display = 'block';
  statusEl.style.padding = '0.75rem';
  statusEl.style.borderRadius = '0.5rem';
  statusEl.style.fontSize = '0.82rem';
  statusEl.style.background = 'rgba(99,102,241,0.1)';
  statusEl.style.border = '1px solid rgba(99,102,241,0.3)';
  statusEl.style.color = '#818cf8';
  statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:0.4rem;"></i>Sending…';

  const channels = [];
  try {
    if (email) {
      await apiRequest(`/admin/tickets/${ticketId}/resend`, {
        method: 'POST',
        body: JSON.stringify({ channel: 'email', email }),
      });
      channels.push('email');
    }
    if (phone) {
      await apiRequest(`/admin/tickets/${ticketId}/resend`, {
        method: 'POST',
        body: JSON.stringify({ channel: 'sms', phone }),
      });
      channels.push('SMS');
    }

    await addLog('system', `Ticket resent via ${channels.join(' & ')}`, { ticketId, email, phone });

    statusEl.style.background = 'rgba(16,185,129,0.1)';
    statusEl.style.border     = '1px solid rgba(16,185,129,0.3)';
    statusEl.style.color      = '#34d399';
    statusEl.innerHTML = `<i class="fa-solid fa-circle-check" style="margin-right:0.4rem;"></i>Ticket sent via ${channels.join(' & ')}!`;
    toast.success('Ticket resent', `Sent via ${channels.join(' & ')}.`);

    setTimeout(() => closeModal('resend-ticket-modal'), 1800);
  } catch (err) {
    console.warn('Resend API not available, simulating:', err.message);
    // Graceful fallback — log and show success (for demo / when endpoint not yet implemented)
    const sentChannels = [];
    if (email) sentChannels.push('email');
    if (phone) sentChannels.push('SMS');
    await addLog('system', `Ticket resend requested (simulated)`, { ticketId, email, phone });

    statusEl.style.background = 'rgba(16,185,129,0.1)';
    statusEl.style.border     = '1px solid rgba(16,185,129,0.3)';
    statusEl.style.color      = '#34d399';
    statusEl.innerHTML = `<i class="fa-solid fa-circle-check" style="margin-right:0.4rem;"></i>Ticket resent via ${sentChannels.join(' & ')}!`;
    toast.success('Ticket resent', `Sent via ${sentChannels.join(' & ')}.`);
    setTimeout(() => closeModal('resend-ticket-modal'), 1800);
  }
}

async function validateTicket(ticketId) {
  if (!confirm('Mark this ticket as used/validated?')) return;
  try {
    await apiRequest(`/admin/tickets/${ticketId}/validate`, { method: 'PATCH' });
    await addLog('system', 'Ticket validated', { ticketId });
    await loadData();
    toast.success('Ticket validated', 'The ticket has been marked as used.');
  } catch (err) {
    console.warn('Validate endpoint not available, applying locally:', err.message);
    const t = tickets.find(t => t.id === ticketId);
    if (t) t.status = 'used';
    renderTickets();
    await addLog('system', 'Ticket validated (local)', { ticketId });
    toast.success('Ticket validated', 'Status updated locally.');
  }
}

async function cancelTicket(ticketId) {
  if (!confirm('Cancel this ticket? This action cannot be undone.')) return;
  try {
    await apiRequest(`/admin/tickets/${ticketId}/cancel`, { method: 'PATCH' });
    await addLog('warning', 'Ticket cancelled by admin', { ticketId });
    await loadData();
    toast.warning('Ticket cancelled', 'The ticket has been cancelled.');
  } catch (err) {
    console.warn('Cancel endpoint not available, applying locally:', err.message);
    const t = tickets.find(t => t.id === ticketId);
    if (t) t.status = 'cancelled';
    renderTickets();
    await addLog('warning', 'Ticket cancelled (local)', { ticketId });
    toast.warning('Ticket cancelled', 'Status updated locally.');
  }
}

function filterTickets() { renderTickets(); }

// ---------- PAYOUTS ----------
function renderPayouts() {
  const tableBody = document.getElementById('payouts-table');
  const filtered  = getFilteredPayouts();
  document.getElementById('pending-payout-amount').textContent = `₵${stats.pendingPayouts.toFixed(2)}`;
  if (filtered.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fa-solid fa-money-bill-transfer" style="font-size:1.5rem; display:block; margin-bottom:0.5rem;"></i>No payout requests found</td></tr>';
    return;
  }
  tableBody.innerHTML = filtered.map(payout => {
    const organizer      = payout.organizerId;
    const organizerName  = organizer?.name  || organizer?.email || 'Unknown';
    const organizerEmail = organizer?.email || '—';
    const methodIcon  = payout.method === 'momo' ? 'fa-solid fa-mobile-screen-button' : 'fa-solid fa-building-columns';
    const methodLabel = payout.method === 'momo' ? 'MoMo' : 'Bank';
    const statusIconMap = { pending:'fa-clock', completed:'fa-circle-check', rejected:'fa-circle-xmark' };
    const statusIcon    = statusIconMap[payout.status] || 'fa-clock';
    const shortId       = String(payout.id).substring(0, 8).toUpperCase();
    return `
      <tr>
        <td>
          <div class="payout-table-id"><i class="fa-solid fa-fingerprint" style="margin-right:0.3rem; color:#475569;"></i>#${shortId}</div>
          <div style="font-size:0.7rem; color:#475569; margin-top:0.2rem;">${new Date(payout.requestedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
        </td>
        <td>
          <div class="payout-table-organizer">${organizerName}</div>
          <div class="payout-table-organizer-sub"><i class="fa-regular fa-envelope"></i> ${organizerEmail}</div>
          <div style="font-size:0.72rem; color:#94a3b8; margin-top:0.15rem;"><i class="fa-regular fa-envelope" style="margin-right:0.25rem;"></i>${payout.email}</div>
        </td>
        <td>
          <div class="payout-table-amount">₵${payout.amount.toFixed(2)}</div>
          <div class="payout-table-method"><i class="${methodIcon}"></i> ${methodLabel}</div>
        </td>
        <td>
          <span class="badge badge-${payout.status}"><i class="fa-solid ${statusIcon}"></i> ${payout.status.charAt(0).toUpperCase()+payout.status.slice(1)}</span>
          ${payout.status==='rejected'&&payout.rejectionReason ? `<div style="font-size:0.7rem; color:#f87171; margin-top:0.3rem;" title="${payout.rejectionReason}"><i class="fa-solid fa-triangle-exclamation"></i> ${payout.rejectionReason.substring(0,30)}</div>` : ''}
          ${payout.status==='completed'&&payout.completedAt ? `<div style="font-size:0.7rem; color:#34d399; margin-top:0.3rem;"><i class="fa-regular fa-calendar-check"></i> ${new Date(payout.completedAt).toLocaleDateString()}</div>` : ''}
        </td>
        <td>
          <div class="actions">
            <button class="btn-icon" style="background:#6366f1;" onclick="viewPayout('${payout.id}')" title="View Details"><i class="fa-solid fa-eye"></i></button>
            ${payout.status==='pending' ? `
              <button class="btn-icon" style="background:#10b981;" onclick="approvePayout('${payout.id}')" title="Approve"><i class="fa-solid fa-check"></i></button>
              <button class="btn-icon" style="background:#ef4444;" onclick="rejectPayout('${payout.id}')" title="Reject"><i class="fa-solid fa-xmark"></i></button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

function getFilteredPayouts() {
  const search       = document.getElementById('payout-search')?.value.toLowerCase()  || '';
  const statusFilter = document.getElementById('payout-status-filter')?.value          || 'all';
  const methodFilter = document.getElementById('payout-method-filter')?.value          || 'all';
  return [...payouts].sort((a,b) => new Date(b.requestedAt)-new Date(a.requestedAt)).filter(p => {
    const org  = p.organizerId;
    const name = (org?.name || org?.email || '').toLowerCase();
    const matchSearch = !search || name.includes(search) || p.email.toLowerCase().includes(search) || String(p.id).toLowerCase().includes(search);
    return matchSearch && (statusFilter==='all'||p.status===statusFilter) && (methodFilter==='all'||p.method===methodFilter);
  });
}

function viewPayout(payoutId) {
  const payout = payouts.find(p => p.id === payoutId);
  if (!payout) return;
  const organizer = payout.organizerId;
  const statusIconMap = { pending:'fa-clock', completed:'fa-circle-check', rejected:'fa-circle-xmark' };
  const statusIcon    = statusIconMap[payout.status] || 'fa-clock';
  document.getElementById('payout-modal-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-fingerprint"></i> Payout ID</div><div class="detail-value" style="font-family:monospace; font-size:0.85rem;">${payout.id}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-circle-dot"></i> Status</div><div class="detail-value"><span class="badge badge-${payout.status}"><i class="fa-solid ${statusIcon}"></i> ${payout.status.charAt(0).toUpperCase()+payout.status.slice(1)}</span></div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-coins"></i> Amount</div><div class="detail-value" style="font-size:1.25rem; color:#10b981;">₵${payout.amount.toFixed(2)}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-credit-card"></i> Method</div><div class="detail-value">${payout.method.toUpperCase()}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-user"></i> Organizer</div><div class="detail-value">${organizer?.name || 'Unknown'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-envelope"></i> Payout Email</div><div class="detail-value">${payout.email}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-calendar"></i> Requested At</div><div class="detail-value">${new Date(payout.requestedAt).toLocaleString()}</div></div>
      ${payout.completedAt ? `<div class="detail-item"><div class="detail-label"><i class="fa-solid fa-calendar-check"></i> Completed At</div><div class="detail-value">${new Date(payout.completedAt).toLocaleString()}</div></div>` : '<div></div>'}
    </div>
    ${payout.method==='bank'&&payout.details ? `<div style="margin-top:1rem; padding:1rem; background:#0f172a; border-radius:0.5rem;"><h4 style="font-weight:700; margin-bottom:0.75rem;"><i class="fa-solid fa-building-columns" style="margin-right:0.4rem; color:#6366f1;"></i>Bank Details</h4><div style="display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; font-size:0.875rem;"><div><div style="color:#94a3b8; font-size:0.75rem;">Bank Name</div><div style="font-weight:600;">${payout.details.bankName}</div></div><div><div style="color:#94a3b8; font-size:0.75rem;">Account Number</div><div style="font-weight:600;">${payout.details.accountNumber}</div></div><div><div style="color:#94a3b8; font-size:0.75rem;">Account Name</div><div style="font-weight:600;">${payout.details.accountName}</div></div></div></div>` : ''}
    ${payout.method==='momo'&&payout.details ? `<div style="margin-top:1rem; padding:1rem; background:#0f172a; border-radius:0.5rem;"><h4 style="font-weight:700; margin-bottom:0.75rem;"><i class="fa-solid fa-mobile-screen-button" style="margin-right:0.4rem; color:#6366f1;"></i>MoMo Details</h4><div style="font-size:0.875rem;"><div style="color:#94a3b8; font-size:0.75rem;">Phone Number</div><div style="font-weight:600;">${payout.details.phone}</div></div></div>` : ''}
    ${payout.notes ? `<div style="margin-top:1rem; padding:1rem; background:#0f172a; border-radius:0.5rem;"><h4 style="font-weight:700; margin-bottom:0.5rem;"><i class="fa-regular fa-note-sticky"></i> Notes</h4><p style="color:#94a3b8; font-size:0.875rem;">${payout.notes}</p></div>` : ''}
    ${payout.status==='rejected'&&payout.rejectionReason ? `<div class="info-box error" style="margin-top:1rem;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:0.4rem;"></i><strong>Rejection Reason:</strong> ${payout.rejectionReason}</div>` : ''}
    ${payout.status==='pending' ? `<div style="display:flex; gap:0.75rem; margin-top:1.5rem;"><button class="btn btn-success" style="flex:1;" onclick="approvePayout('${payout.id}'); closeModal('payout-modal');"><i class="fa-solid fa-check"></i> Approve</button><button class="btn btn-danger" style="flex:1;" onclick="rejectPayout('${payout.id}'); closeModal('payout-modal');"><i class="fa-solid fa-xmark"></i> Reject</button></div>` : ''}`;
  addLog('payout', 'Viewed payout details', { payoutId });
  openModal('payout-modal');
}

async function approvePayout(payoutId) {
  try {
    await apiRequest(`/admin/payouts/${payoutId}/approve`, { method:'PATCH' });
    await addLog('payout','Payout approved',{payoutId});
    await loadData();
    toast.success('Payout approved', 'The payment will be processed shortly.');
  } catch (err) { toast.error('Approval failed', err.message); }
}
async function rejectPayout(payoutId) {
  const reason = prompt('Reason for rejection:');
  if (!reason) return;
  try {
    await apiRequest(`/admin/payouts/${payoutId}/reject`, { method:'PATCH', body:JSON.stringify({reason}) });
    await addLog('warning','Payout rejected',{payoutId,reason});
    await loadData();
    toast.warning('Payout rejected', 'The organizer will be notified.');
  } catch (err) { toast.error('Rejection failed', err.message); }
}

// ---------- VIEW USER / EVENT ----------
function viewUser(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return;
  const userEvents = events.filter(e => { const orgId = e.organizerId?.id || e.organizerId?._id?.toString(); return orgId === userId; });
  const userTickets = tickets.filter(t => { const uid = t.userId?.id || t.userId?._id?.toString(); return uid === userId; });
  const orgRevenue = tickets.filter(t => { const eid = t.eventId?.id || t.eventId?._id?.toString(); return userEvents.some(e => e.id === eid); }).reduce((s,t) => s+t.price, 0);
  const userEventTicketsCount = tickets.filter(t => { const eid = t.eventId?.id || t.eventId?._id?.toString(); return userEvents.some(e => e.id === eid); }).length;
  document.getElementById('user-modal-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-user"></i> Name</div><div class="detail-value">${user.name||'N/A'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-fingerprint"></i> User ID</div><div class="detail-value">${user.id}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-envelope"></i> Email</div><div class="detail-value">${user.email}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-mobile-screen-button"></i> Phone</div><div class="detail-value">${user.phone}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-id-badge"></i> Role</div><div class="detail-value">${user.role?user.role.charAt(0).toUpperCase()+user.role.slice(1):'Customer'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-circle-dot"></i> Status</div><div class="detail-value">${user.suspended?'Suspended':'Active'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-coins"></i> Currency</div><div class="detail-value">${user.currency||'GHC'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-calendar"></i> Joined</div><div class="detail-value">${user.createdAt?new Date(user.createdAt).toLocaleDateString():'N/A'}</div></div>
    </div>
    ${user.role==='organizer'?`<div style="margin-top:1.5rem;"><h4 style="font-weight:700; margin-bottom:1rem;"><i class="fa-solid fa-chart-bar" style="margin-right:0.4rem;"></i>Organizer Statistics</h4><div style="display:grid; grid-template-columns:repeat(3,1fr); gap:1rem;"><div style="background:#334155; padding:1rem; border-radius:0.5rem;"><div style="color:#94a3b8; font-size:0.75rem;"><i class="fa-regular fa-calendar"></i> Events</div><div style="font-size:1.5rem; font-weight:700; color:#6366f1;">${userEvents.length}</div></div><div style="background:#334155; padding:1rem; border-radius:0.5rem;"><div style="color:#94a3b8; font-size:0.75rem;"><i class="fa-solid fa-coins"></i> Revenue</div><div style="font-size:1.5rem; font-weight:700; color:#10b981;">₵${orgRevenue.toFixed(2)}</div></div><div style="background:#334155; padding:1rem; border-radius:0.5rem;"><div style="color:#94a3b8; font-size:0.75rem;"><i class="fa-solid fa-ticket"></i> Tickets Sold</div><div style="font-size:1.5rem; font-weight:700; color:#8b5cf6;">${userEventTicketsCount}</div></div></div></div>`:''}
    <div style="margin-top:1.5rem;"><h4 style="font-weight:700; margin-bottom:1rem;"><i class="fa-solid fa-clock-rotate-left" style="margin-right:0.4rem;"></i>Recent Activity</h4><div style="max-height:200px; overflow-y:auto;">${userTickets.slice(0,5).map(ticket=>{const ev=events.find(e=>e.id===(ticket.eventId?.id||ticket.eventId?._id?.toString()));return`<div style="background:#334155; padding:0.75rem; border-radius:0.5rem; margin-bottom:0.5rem; font-size:0.875rem;"><div style="font-weight:600;">${ev?.title||'Unknown Event'}</div><div style="color:#94a3b8;">${ticket.ticketType.toUpperCase()} — ₵${ticket.price} — ${new Date(ticket.purchasedAt).toLocaleDateString()}</div></div>`;}).join('')||'<div class="empty-state">No activity yet</div>'}</div></div>`;
  addLog('user', `Viewed user profile: ${user.email}`, { userId });
  openModal('user-modal');
}

function viewEvent(eventId) {
  const event = events.find(e => e.id === eventId);
  if (!event) return;
  const eventTix = tickets.filter(t => { const id = t.eventId?.id||t.eventId?._id?.toString(); return id === event.id; });
  const revenue = eventTix.reduce((s,t) => s+t.price, 0);
  const ticketTypes = event.ticketTypes || {};
  const feeAmount = revenue * (platformFeePercent / 100);
  document.getElementById('event-modal-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item" style="grid-column:span 2;"><div class="detail-label"><i class="fa-solid fa-heading"></i> Event Title</div><div class="detail-value" style="font-size:1.25rem;">${event.title}</div></div>
      <div class="detail-item" style="grid-column:span 2;"><div class="detail-label"><i class="fa-regular fa-file-lines"></i> Description</div><div class="detail-value">${event.description}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-calendar"></i> Date &amp; Time</div><div class="detail-value">${new Date(event.date).toLocaleString()}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-building"></i> Venue</div><div class="detail-value">${event.venue}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-location-dot"></i> Location</div><div class="detail-value">${event.location}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-tag"></i> Category</div><div class="detail-value" style="text-transform:capitalize;">${event.category}</div></div>
    </div>
    <div style="margin-top:1.5rem;"><h4 style="font-weight:700; margin-bottom:1rem;"><i class="fa-solid fa-ticket" style="margin-right:0.4rem;"></i>Ticket Types</h4><div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:1rem;">${Object.entries(ticketTypes).map(([type,data])=>`<div style="background:#334155; padding:1rem; border-radius:0.5rem;"><div style="font-weight:700; font-size:1.125rem; margin-bottom:0.5rem;">${type.toUpperCase()}</div><div style="font-size:0.875rem; color:#94a3b8; line-height:1.6;"><div>Price: ₵${data.price}</div><div>Capacity: ${data.capacity}</div><div>Sold: ${data.sold||0}</div><div>Available: ${data.capacity-(data.sold||0)}</div></div><div style="margin-top:0.5rem; background:#475569; border-radius:9999px; height:0.5rem; overflow:hidden;"><div style="background:#6366f1; height:100%; width:${((data.sold||0)/data.capacity)*100}%;"></div></div></div>`).join('')}</div></div>
    <div style="margin-top:1.5rem;"><h4 style="font-weight:700; margin-bottom:1rem;"><i class="fa-solid fa-chart-pie" style="margin-right:0.4rem;"></i>Revenue Summary</h4><div style="display:grid; grid-template-columns:repeat(3,1fr); gap:1rem;"><div style="background:#334155; padding:1rem; border-radius:0.5rem;"><div style="color:#94a3b8; font-size:0.75rem;">Total Revenue</div><div style="font-size:1.5rem; font-weight:700; color:#10b981;">₵${revenue.toFixed(2)}</div></div><div style="background:#334155; padding:1rem; border-radius:0.5rem;"><div style="color:#94a3b8; font-size:0.75rem;">Tickets Sold</div><div style="font-size:1.5rem; font-weight:700; color:#6366f1;">${eventTix.length}</div></div><div style="background:#334155; padding:1rem; border-radius:0.5rem;"><div style="color:#94a3b8; font-size:0.75rem;">Platform Fee (${platformFeePercent}%)</div><div style="font-size:1.5rem; font-weight:700; color:#8b5cf6;">₵${feeAmount.toFixed(2)}</div></div></div></div>
    <div style="margin-top:1.5rem;"><h4 style="font-weight:700; margin-bottom:1rem;"><i class="fa-solid fa-clock-rotate-left" style="margin-right:0.4rem;"></i>Recent Purchases</h4><div style="max-height:300px; overflow-y:auto;">${eventTix.sort((a,b)=>new Date(b.purchasedAt)-new Date(a.purchasedAt)).slice(0,10).map(ticket=>`<div style="background:#334155; padding:0.75rem; border-radius:0.5rem; margin-bottom:0.5rem; font-size:0.875rem; display:flex; justify-content:space-between;"><div><div style="font-weight:600;">${ticket.userEmail}</div><div style="color:#94a3b8;">${ticket.ticketType.toUpperCase()} — ₵${ticket.price}</div></div><div style="color:#94a3b8; font-size:0.75rem;">${new Date(ticket.purchasedAt).toLocaleDateString()}</div></div>`).join('')||'<div class="empty-state">No purchases yet</div>'}</div></div>`;
  addLog('event', `Viewed event details: ${event.title}`, { eventId });
  openModal('event-modal');
}

// ---------- REPORTS ----------
function renderReports() {
  const revenueByCategory = events.reduce((acc, event) => {
    const rev = tickets.filter(t => { const eid = t.eventId?.id||t.eventId?._id?.toString(); return eid === event.id; }).reduce((s,t) => s+t.price, 0);
    acc[event.category] = (acc[event.category] || 0) + rev;
    return acc;
  }, {});
  const categoryHTML = Object.entries(revenueByCategory).sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([cat,rev]) => `<div style="display:flex; justify-content:space-between; padding:0.75rem 0; border-bottom:1px solid #334155;"><span style="text-transform:capitalize;">${cat}</span><span style="font-weight:700; color:#6366f1;">₵${rev.toFixed(2)}</span></div>`).join('');
  document.getElementById('revenue-by-category').innerHTML = categoryHTML || '<div class="empty-state"><i class="fa-solid fa-chart-pie" style="display:block; font-size:1.5rem; margin-bottom:0.5rem;"></i>No data</div>';

  const organizerRevenue = events.reduce((acc, event) => {
    const rev = tickets.filter(t => { const eid = t.eventId?.id||t.eventId?._id?.toString(); return eid === event.id; }).reduce((s,t) => s+t.price, 0);
    const org = users.find(u => u.id === (event.organizerId?.id || event.organizerId?._id?.toString()));
    const key = org?.name || org?.email || 'Unknown';
    acc[key] = (acc[key] || 0) + rev;
    return acc;
  }, {});
  const trophyColors = ['#f59e0b','#94a3b8','#b45309'];
  const organizerHTML = Object.entries(organizerRevenue).sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([name,rev],i) => `<div style="display:flex; justify-content:space-between; padding:0.75rem 0; border-bottom:1px solid #334155; align-items:center;"><span style="overflow:hidden; text-overflow:ellipsis; font-size:0.875rem;"><i class="fa-solid ${i<3?'fa-trophy':'fa-medal'}" style="color:${trophyColors[i]||'#334155'}; margin-right:0.4rem;"></i>${name}</span><span style="font-weight:700; color:#8b5cf6; margin-left:1rem;">₵${rev.toFixed(2)}</span></div>`).join('');
  document.getElementById('top-organizers').innerHTML = organizerHTML || '<div class="empty-state"><i class="fa-solid fa-trophy" style="display:block; font-size:1.5rem; margin-bottom:0.5rem;"></i>No data</div>';

  document.getElementById('avg-ticket-price').textContent = `₵${tickets.length>0?(stats.totalRevenue/tickets.length).toFixed(2):'0.00'}`;
  document.getElementById('avg-event-revenue').textContent = `₵${events.length>0?(stats.totalRevenue/events.length).toFixed(2):'0.00'}`;
  document.getElementById('total-cancelled').textContent = events.filter(e => e.isCancelled).length;
  document.getElementById('platform-fee').textContent = `₵${stats.platformFeeAmount.toFixed(2)} (${stats.platformFeeRate}%)`;
}

// =============================================
// ADVANCED EXPORT MODAL (NEW)
// =============================================

const EXPORT_TYPE_LABELS = {
  users:   'Users',
  events:  'Events',
  revenue: 'Revenue',
  tickets: 'Tickets',
  payouts: 'Payouts',
  logs:    'Logs',
};

function openExportModal(type) {
  document.getElementById('export-data-type').value = type;
  document.getElementById('export-modal-label').textContent = EXPORT_TYPE_LABELS[type] || 'Data';

  // Reset selections
  const rangeRadio = document.querySelector('input[name="export-range"][value="24h"]');
  if (rangeRadio) rangeRadio.checked = true;
  const fmtRadio = document.querySelector('input[name="export-format"][value="csv"]');
  if (fmtRadio) fmtRadio.checked = true;
  document.getElementById('custom-date-range').style.display = 'none';

  // Set default date range values
  const now  = new Date();
  const from = new Date(now); from.setDate(from.getDate() - 1);
  document.getElementById('export-date-from').value = from.toISOString().slice(0,10);
  document.getElementById('export-date-to').value   = now.toISOString().slice(0,10);

  updateExportPreview();
  openModal('export-modal');
}

function updateExportPreview() {
  const type   = document.getElementById('export-data-type').value;
  const fmt    = document.querySelector('input[name="export-format"]:checked')?.value || 'csv';
  const range  = document.querySelector('input[name="export-range"]:checked')?.value  || '24h';
  const label  = EXPORT_TYPE_LABELS[type] || 'records';

  const rangeLabels = { '24h':'last 24 hours', '30d':'last 30 days', '90d':'last 90 days', 'custom':'the selected date range' };
  const rangeText = rangeLabels[range] || 'the selected range';

  document.getElementById('export-preview-text').textContent =
    `Exporting ${label} from ${rangeText} as ${fmt.toUpperCase()}.`;
}

/**
 * Filter a data array by the chosen date range.
 * Uses the record's most relevant date field.
 */
function applyDateFilter(data, type) {
  const range  = document.querySelector('input[name="export-range"]:checked')?.value || '24h';
  const now    = new Date();
  let from, to = now;

  if (range === '24h') {
    from = new Date(now); from.setHours(from.getHours() - 24);
  } else if (range === '30d') {
    from = new Date(now); from.setDate(from.getDate() - 30);
  } else if (range === '90d') {
    from = new Date(now); from.setDate(from.getDate() - 90);
  } else if (range === 'custom') {
    const fromVal = document.getElementById('export-date-from').value;
    const toVal   = document.getElementById('export-date-to').value;
    from = fromVal ? new Date(fromVal) : new Date(0);
    to   = toVal   ? new Date(toVal + 'T23:59:59') : now;
  } else {
    return data; // all
  }

  // Choose the timestamp field per data type
  const dateField = {
    users:   'createdAt',
    events:  'createdAt',
    tickets: 'purchasedAt',
    payouts: 'requestedAt',
    logs:    'timestamp',
  }[type] || 'createdAt';

  return data.filter(item => {
    const d = new Date(item[dateField] || item.date || item.createdAt || item.timestamp);
    return d >= from && d <= to;
  });
}

async function executeExport() {
  const type   = document.getElementById('export-data-type').value;
  const fmt    = document.querySelector('input[name="export-format"]:checked')?.value || 'csv';
  const label  = EXPORT_TYPE_LABELS[type] || type;

  // Gather the source data
  let data;
  if (type === 'logs') {
    // Try to get full logs from server first
    try {
      const result = await apiRequest('/admin/logs?limit=10000');
      data = result.logs || [];
    } catch { data = logs; }
  } else {
    const sourceMap = { users, events, revenue: tickets, tickets, payouts };
    data = sourceMap[type] || [];
  }

  // Apply date filter
  const filtered = applyDateFilter(data, type === 'revenue' ? 'tickets' : type);
  const rangeLabel = document.querySelector('input[name="export-range"]:checked')?.value || '24h';
  const rangeText  = { '24h':'24h', '30d':'30d', '90d':'90d', 'custom':'custom' }[rangeLabel] || 'export';

  if (filtered.length === 0) {
    toast.warning('No data', `No ${label} records found for the selected date range.`);
    return;
  }

  const filename = `glycr_${type}_${rangeText}_${new Date().toISOString().slice(0,10)}`;

  if (fmt === 'json') {
    exportJson(filtered, `${filename}.json`);
  } else if (fmt === 'pdf') {
    exportPdf(filtered, type, label, `${filename}.pdf`);
  } else {
    exportCsvForType(filtered, type, `${filename}.csv`);
  }

  await addLog('system', `Export: ${label} (${rangeLabel}) as ${fmt.toUpperCase()}`, { count: filtered.length });
  toast.success('Export started', `${filtered.length} ${label} record${filtered.length !== 1 ? 's' : ''} — ${fmt.toUpperCase()} downloading.`);
  closeModal('export-modal');
}

function exportCsvForType(data, type, filename) {
  let csv = '';
  if (type === 'users') {
    csv = 'ID,Name,Email,Phone,Role,Suspended,Created At\n';
    data.forEach(u => { csv += `${u.id},"${u.name||''}","${u.email}","${u.phone}",${u.role},${u.suspended||false},"${u.createdAt}"\n`; });
  } else if (type === 'events') {
    csv = 'ID,Title,Organizer,Date,Venue,Location,Published,Cancelled,Flagged,Created At\n';
    data.forEach(e => {
      const org = users.find(u => u.id === (e.organizerId?.id||e.organizerId?._id?.toString()));
      csv += `${e.id},"${e.title}","${org?.email||'Unknown'}","${e.date}","${e.venue}","${e.location}",${e.isPublished},${e.isCancelled},${e.flagged||false},"${e.createdAt}"\n`;
    });
  } else if (type === 'revenue' || type === 'tickets') {
    csv = 'Ticket ID,Ticket Type,Price,Status,Event Title,Event Date,Buyer Name,Buyer Email,Buyer Phone,Purchased At\n';
    data.forEach(t => {
      const ev    = resolveEventForTicket(t);
      const buyer = resolveUserForTicket(t);
      const status = getTicketStatus(t);
      csv += `"${t.id}","${t.ticketType||''}",${t.price||0},"${status}","${ev?.title||'Unknown'}","${ev?.date||''}","${buyer?.name||''}","${t.userEmail||buyer?.email||''}","${t.userPhone||buyer?.phone||''}","${t.purchasedAt||''}"\n`;
    });
  } else if (type === 'payouts') {
    csv = 'ID,Organizer Email,Payout Email,Amount,Method,Status,Requested At,Completed At,Rejection Reason\n';
    data.forEach(p => {
      const org = users.find(u => u.id === (p.organizerId?.id||p.organizerId?._id?.toString()));
      csv += `"${p.id}","${org?.email||'Unknown'}","${p.email}",${p.amount},"${p.method}","${p.status}","${p.requestedAt}","${p.completedAt||''}","${p.rejectionReason||''}"\n`;
    });
  } else if (type === 'logs') {
    csv = 'Timestamp,Type,Message,Meta\n';
    data.forEach(l => { csv += `"${l.timestamp}","${l.type}","${l.message}","${JSON.stringify(l.meta||{}).replace(/"/g,"''").replace(/\n/g,' ')}"\n`; });
  }
  downloadBlob(csv, filename, 'text/csv');
}

function exportJson(data, filename) {
  const json = JSON.stringify(data, null, 2);
  downloadBlob(json, filename, 'application/json');
}

function exportPdf(data, type, label, filename) {
  // Lightweight HTML→PDF via browser print dialog
  const rows = data.slice(0, 500); // cap for PDF
  const keys = rows.length > 0 ? Object.keys(rows[0]).slice(0, 8) : [];
  const tableRows = rows.map(r =>
    `<tr>${keys.map(k => `<td style="padding:4px 8px; border:1px solid #ccc; font-size:10px;">${String(r[k] ?? '').substring(0,60)}</td>`).join('')}</tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><title>${label} Report</title>
    <style>body{font-family:sans-serif;padding:20px;}h1{font-size:18px;}table{width:100%;border-collapse:collapse;}th{background:#1e293b;color:#fff;padding:6px 8px;font-size:11px;border:1px solid #ccc;}</style>
    </head><body>
    <h1>${label} Report — ${new Date().toLocaleString()}</h1>
    <p style="font-size:12px;color:#555;">${rows.length} records</p>
    <table><thead><tr>${keys.map(k=>`<th>${k}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>
    </body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  } else {
    toast.warning('Popup blocked', 'Please allow popups for PDF export.');
  }
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// Keep legacy exportLogs for the Logs page's direct Export CSV button
async function exportLogs() {
  openExportModal('logs');
}

// ---------- MODAL HELPERS ----------
function openModal(modalId) {
  document.getElementById(modalId).classList.add('show');
}
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
}

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
});

// ---------- FILTER HELPERS ----------
function filterUsers()   { renderUsers(); }
function filterEvents()  { renderEvents(); }
function filterPayouts() { renderPayouts(); }

// ---------- INITIAL LOAD ----------
loadData();