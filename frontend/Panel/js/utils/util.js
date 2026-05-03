// ===============================================
// SORTING, PAGINATION, DATE RANGE, BULK SELECTION, TABS
// ===============================================

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

function applyDateRangeFilter(dateStr, from, to) {
  if (!from && !to) return true;
  const d = new Date(dateStr);
  if (isNaN(d)) return true;
  if (from && d < new Date(from))             return false;
  if (to   && d > new Date(to + 'T23:59:59')) return false;
  return true;
}

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

// Alias for filter functions (re-declared in respective modules but kept for consistency)
function filterUsers()           { pageState.users = 1; renderUsers(); }
function filterEvents()          { pageState.events = 1; renderEvents(); }
function filterPayouts()         { pageState.payouts = 1; renderPayouts(); }
function filterTickets()         { pageState.tickets = 1; renderTickets(); }
function filterRefunds()         { pageState.refunds = 1; renderRefunds(); }
function filterWaitlist()        { pageState.waitlist = 1; renderWaitlist(); }
function filterServiceRequests() { pageState['service-requests'] = 1; renderServiceRequests(); }
function filterMessages()        { pageState.messages = 1; renderMessages(); }
function filterTransactions()    { pageState.transactions = 1; renderTransactions(); }
