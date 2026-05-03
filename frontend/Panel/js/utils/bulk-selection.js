// ===============================================
// BULK SELECTION ENGINE
// ===============================================

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
