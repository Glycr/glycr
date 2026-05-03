// ===============================================
// SORTING ENGINE
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
