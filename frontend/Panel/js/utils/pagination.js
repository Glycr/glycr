// ===============================================
// PAGINATION ENGINE
// ===============================================

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
