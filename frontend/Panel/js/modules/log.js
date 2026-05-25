// ===============================================
// LOGS ENGINE
// ===============================================

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