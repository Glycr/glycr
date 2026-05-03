// ===============================================
// PAYOUTS MANAGEMENT
// ===============================================

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