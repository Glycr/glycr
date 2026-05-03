// ===============================================
// REFUNDS MANAGEMENT
// ===============================================

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