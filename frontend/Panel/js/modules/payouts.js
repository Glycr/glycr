// ===============================================
// PAYOUTS MANAGEMENT
// ===============================================
// Lifecycle:  pending → approved → completed (paid)      or   pending/approved → rejected
//   pending   : the organizer asked, waiting for review
//   approved  : approved, money reserved but NOT sent yet
//   completed : an admin sent the money and recorded the transfer reference
//   PATCH /admin/payouts/:id/complete moves approved → completed (admins only)

// Render a compact one-line destination string for the table cell.
const payoutDestination = (p) => {
  const d = p.details || {};
  switch (p.method) {
    case 'mobile_money':
      return d.phone || '—';
    case 'bank':
      return [d.bankName, d.accountNumber, d.accountName].filter(Boolean).join(' · ') || '—';
    case 'paypal':
      return d.email || '—';
    case 'stripe':
      return d.accountId || d.customerId || d.email || '—';
    default:
      return '—';
  }
};

// Icon + display label for the method pill.
const payoutMethodMeta = (method) => {
  switch (method) {
    case 'mobile_money': return { icon: 'fa-solid fa-mobile-screen-button', label: 'Mobile Money' };
    case 'bank':         return { icon: 'fa-solid fa-building-columns',     label: 'Bank' };
    case 'paypal':       return { icon: 'fa-brands fa-paypal',              label: 'PayPal' };
    case 'stripe':       return { icon: 'fa-brands fa-stripe-s',            label: 'Stripe' };
    default:             return { icon: 'fa-solid fa-money-bill-transfer',  label: method || 'Unknown' };
  }
};

// ── helpers for the payment step ──────────────────────────────────

// Only admins send money; moderators can review but not mark as paid.
function _canPayPayouts() {
  return currentAdmin?.role === 'admin';
}

// uses the error toast if the panel has one, otherwise the warning toast
function _notifyPayoutError(title, message) {
  if (typeof toast.error === 'function') toast.error(title, message);
  else toast.warning(title, message);
}

// one place that decides how a status looks
function _payoutStatusView(p) {
  switch (p.status) {
    case 'completed':
      return {
        badge: 'badge-completed', icon: 'fa-circle-check', label: 'Paid',
        note: p.completedAt ? `<div style="font-size:0.7rem;color:#34d399;margin-top:0.3rem;"><i class="fa-regular fa-calendar-check"></i> ${new Date(p.completedAt).toLocaleDateString()}</div>` : '',
      };
    case 'approved':
      return {
        badge: 'badge-info', icon: 'fa-hourglass-half', label: 'Approved',
        note: '<div style="font-size:0.7rem;color:#94a3b8;margin-top:0.3rem;">Awaiting transfer</div>',
      };
    case 'rejected':
      return {
        badge: 'badge-rejected', icon: 'fa-circle-xmark', label: 'Rejected',
        note: p.rejectionReason ? `<div style="font-size:0.7rem;color:#f87171;margin-top:0.3rem;"><i class="fa-solid fa-triangle-exclamation"></i> ${p.rejectionReason.substring(0, 30)}</div>` : '',
      };
    default:
      return { badge: 'badge-pending', icon: 'fa-clock', label: 'Pending', note: '' };
  }
}

// ── table ─────────────────────────────────────────────────────────

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

  // money still owed to organizers: waiting for review OR approved and not sent yet
  const owed = payouts
    .filter(p => p.status === 'pending' || p.status === 'approved')
    .reduce((s, p) => s + (p.amount || 0), 0);
  setText('pending-payout-amount', `₵${owed.toFixed(2)}`);

  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-money-bill-transfer" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>No payout requests found</td></tr>';
    renderPaginationBar('payouts-pagination', 'payouts', 0, 1, 1, pp);
    return;
  }

  tb.innerHTML = rows.map(p => {
    const org      = p.organizerId;
    const orgName  = org?.name || org?.email || 'Unknown';
    const orgEmail = org?.email || '—';
    const { icon: mIcon, label: mLabel } = payoutMethodMeta(p.method);
    const destination = payoutDestination(p);
    const sv       = _payoutStatusView(p);
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
          <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:#94a3b8;margin-top:0.35rem;word-break:break-all;">
            <i class="fa-solid fa-location-dot" style="margin-right:0.3rem;color:#6366f1;"></i>${destination}
          </div>
        </td>
        <td>
          <span class="badge ${sv.badge}"><i class="fa-solid ${sv.icon}"></i> ${sv.label}</span>
          ${sv.note}
          ${p.status === 'completed' && p.paymentReference ? `<div style="font-family:'JetBrains Mono',monospace;font-size:0.68rem;color:#94a3b8;margin-top:0.25rem;word-break:break-all;"><i class="fa-solid fa-receipt"></i> ${p.paymentReference}</div>` : ''}
        </td>
        <td><div class="actions">
          <button class="btn-icon" style="background:#6366f1;" onclick="viewPayout('${p.id}')" title="View"><i class="fa-solid fa-eye"></i></button>
          ${p.status==='pending' ? `
            <button class="btn-icon" style="background:#10b981;" onclick="approvePayout('${p.id}')" title="Approve"><i class="fa-solid fa-check"></i></button>
            <button class="btn-icon" style="background:#ef4444;" onclick="rejectPayout('${p.id}')" title="Reject"><i class="fa-solid fa-xmark"></i></button>` : ''}
          ${p.status==='approved' ? `
            ${_canPayPayouts() ? `<button class="btn-icon" style="background:#0ea5e9;" onclick="markPayoutPaid('${p.id}')" title="Mark as paid"><i class="fa-solid fa-money-bill-transfer"></i></button>` : ''}
            <button class="btn-icon" style="background:#ef4444;" onclick="rejectPayout('${p.id}')" title="Cancel payout (cannot be sent)"><i class="fa-solid fa-ban"></i></button>` : ''}
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
    const dest = payoutDestination(p).toLowerCase();
    const mSearch = !search
      || name.includes(search)
      || (p.email || '').toLowerCase().includes(search)
      || String(p.id).toLowerCase().includes(search)
      || (p.paymentReference || '').toLowerCase().includes(search)
      || dest.includes(search);
    return mSearch
      && (status === 'all' || p.status === status)
      && (method === 'all' || p.method === method)
      && applyDateRangeFilter(p.requestedAt, dfrom, dto);
  });
}

// ── details modal ─────────────────────────────────────────────────

function viewPayout(payoutId) {
  const p = payouts.find(p => p.id === payoutId);
  if (!p) return;

  const org  = p.organizerId;
  const sv   = _payoutStatusView(p);
  const { icon: mIcon, label: mLabel } = payoutMethodMeta(p.method);

  // Per-method destination block
  let destinationBlock = '';
  const d = p.details || {};

  if (p.method === 'bank') {
    destinationBlock = `<div style="margin-top:1rem;padding:1rem;background:#0f172a;border-radius:0.5rem;">
      <h4 style="font-weight:700;margin-bottom:0.75rem;"><i class="fa-solid fa-building-columns" style="color:#6366f1;margin-right:0.4rem;"></i>Bank Details</h4>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;font-size:0.875rem;">
        <div><div style="color:#94a3b8;font-size:0.75rem;">Bank</div><div style="font-weight:600;">${d.bankName || '—'}</div></div>
        <div><div style="color:#94a3b8;font-size:0.75rem;">Account No.</div><div style="font-weight:600;">${d.accountNumber || '—'}</div></div>
        <div><div style="color:#94a3b8;font-size:0.75rem;">Account Name</div><div style="font-weight:600;">${d.accountName || '—'}</div></div>
        ${d.branchName ? `<div><div style="color:#94a3b8;font-size:0.75rem;">Branch</div><div style="font-weight:600;">${d.branchName}</div></div>` : ''}
      </div>
    </div>`;
  } else if (p.method === 'mobile_money') {
    destinationBlock = `<div style="margin-top:1rem;padding:1rem;background:#0f172a;border-radius:0.5rem;">
      <h4 style="font-weight:700;margin-bottom:0.75rem;"><i class="fa-solid fa-mobile-screen-button" style="color:#6366f1;margin-right:0.4rem;"></i>Mobile Money</h4>
      <div style="font-size:0.875rem;">
        <div style="color:#94a3b8;font-size:0.75rem;">Phone Number</div>
        <div style="font-weight:600;font-family:'JetBrains Mono',monospace;font-size:1rem;">${d.phone || '—'}</div>
      </div>
    </div>`;
  } else if (p.method === 'paypal') {
    destinationBlock = `<div style="margin-top:1rem;padding:1rem;background:#0f172a;border-radius:0.5rem;">
      <h4 style="font-weight:700;margin-bottom:0.75rem;"><i class="fa-brands fa-paypal" style="color:#6366f1;margin-right:0.4rem;"></i>PayPal</h4>
      <div style="font-size:0.875rem;">
        <div style="color:#94a3b8;font-size:0.75rem;">Account Email</div>
        <div style="font-weight:600;">${d.email || '—'}</div>
      </div>
    </div>`;
  } else if (p.method === 'stripe') {
    destinationBlock = `<div style="margin-top:1rem;padding:1rem;background:#0f172a;border-radius:0.5rem;">
      <h4 style="font-weight:700;margin-bottom:0.75rem;"><i class="fa-brands fa-stripe-s" style="color:#6366f1;margin-right:0.4rem;"></i>Stripe</h4>
      <div style="font-size:0.875rem;">
        <div style="color:#94a3b8;font-size:0.75rem;">Account / Customer ID</div>
        <div style="font-weight:600;font-family:'JetBrains Mono',monospace;">${d.accountId || d.customerId || d.email || '—'}</div>
      </div>
    </div>`;
  }

  document.getElementById('payout-modal-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-fingerprint"></i> Payout ID</div><div class="detail-value" style="font-family:monospace;font-size:0.85rem;">${p.id}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-circle-dot"></i> Status</div><div class="detail-value"><span class="badge ${sv.badge}"><i class="fa-solid ${sv.icon}"></i> ${sv.label}</span></div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-coins"></i> Amount</div><div class="detail-value" style="font-size:1.25rem;color:#10b981;">₵${p.amount.toFixed(2)}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-credit-card"></i> Method</div><div class="detail-value"><i class="${mIcon}" style="margin-right:0.4rem;"></i>${mLabel}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-user"></i> Organizer</div><div class="detail-value">${org?.name || 'Unknown'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-envelope"></i> Payout Email</div><div class="detail-value">${p.email}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-calendar"></i> Requested</div><div class="detail-value">${new Date(p.requestedAt).toLocaleString()}</div></div>
      ${p.approvedAt ? `<div class="detail-item"><div class="detail-label"><i class="fa-solid fa-circle-check"></i> Approved</div><div class="detail-value">${new Date(p.approvedAt).toLocaleString()}</div></div>` : '<div></div>'}
      ${p.status === 'completed' && p.completedAt ? `<div class="detail-item"><div class="detail-label"><i class="fa-solid fa-money-bill-transfer"></i> Paid At</div><div class="detail-value">${new Date(p.completedAt).toLocaleString()}</div></div>` : ''}
      ${p.status === 'completed' && p.paymentReference ? `<div class="detail-item"><div class="detail-label"><i class="fa-solid fa-receipt"></i> Payment Reference</div><div class="detail-value" style="font-family:monospace;font-size:0.85rem;word-break:break-all;">${p.paymentReference}</div></div>` : ''}
    </div>
    ${destinationBlock}
    ${p.notes ? `<div style="margin-top:1rem;padding:1rem;background:#0f172a;border-radius:0.5rem;"><h4 style="font-weight:700;margin-bottom:0.5rem;"><i class="fa-regular fa-comment" style="color:#6366f1;margin-right:0.4rem;"></i>Organizer Notes</h4><div style="font-size:0.875rem;color:#cbd5e1;white-space:pre-wrap;">${p.notes}</div></div>` : ''}
    ${p.status==='rejected'&&p.rejectionReason ? `<div class="info-box error" style="margin-top:1rem;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:0.4rem;"></i><strong>Rejection Reason:</strong> ${p.rejectionReason}</div>` : ''}
    ${p.status==='pending' ? `<div style="display:flex;gap:0.75rem;margin-top:1.5rem;">
      <button class="btn btn-success" style="flex:1;" onclick="approvePayout('${p.id}');closeModal('payout-modal');"><i class="fa-solid fa-check"></i> Approve</button>
      <button class="btn btn-danger"  style="flex:1;" onclick="rejectPayout('${p.id}');closeModal('payout-modal');"><i class="fa-solid fa-xmark"></i> Reject</button>
    </div>` : ''}
    ${p.status==='approved' ? `<div style="display:flex;gap:0.75rem;margin-top:1.5rem;">
      ${_canPayPayouts()
    ? `<button class="btn btn-primary" style="flex:1;" onclick="closeModal('payout-modal');markPayoutPaid('${p.id}');"><i class="fa-solid fa-money-bill-transfer"></i> Mark as paid</button>`
    : `<div class="info-box" style="flex:1;"><i class="fa-solid fa-circle-info" style="margin-right:0.4rem;"></i>Approved and waiting for an admin to send the money.</div>`}
      <button class="btn btn-danger" onclick="rejectPayout('${p.id}');closeModal('payout-modal');"><i class="fa-solid fa-ban"></i> Cancel payout</button>
    </div>` : ''}`;

  openModal('payout-modal');
}

// ── actions (no local fallback: if the server refuses, nothing changed) ──

async function approvePayout(payoutId) {
  try { await apiRequest(`/admin/payouts/${payoutId}/approve`, { method: 'PATCH' }); }
  catch (err) {
    _notifyPayoutError('Could not approve payout', err.message || 'Please try again.');
    return;
  }
  await loadData();
  toast.success('Payout approved', 'Send the money, then click "Mark as paid" and enter the transfer reference.');
}

async function rejectPayout(payoutId) {
  const p = payouts.find(x => x.id === payoutId);
  const isApproved = p?.status === 'approved';
  const reason = await customPrompt(
    isApproved ? 'Why can this payout not be sent? (the organizer will see this)' : 'Please provide a reason for rejecting this payout:',
    '', isApproved ? 'Cancel Approved Payout' : 'Reject Payout', 'e.g. Insufficient documentation...'
  );
  if (!reason) return;
  try { await apiRequest(`/admin/payouts/${payoutId}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }); }
  catch (err) {
    _notifyPayoutError('Could not reject payout', err.message || 'Please try again.');
    return;
  }
  await loadData();
  toast.warning(isApproved ? 'Payout cancelled' : 'Payout rejected', 'The organizer will be notified.');
}

// Admin only: record that the money for an approved payout has been sent.
async function markPayoutPaid(payoutId) {
  const p = payouts.find(x => x.id === payoutId);
  if (!p) return;
  if (!_canPayPayouts()) { toast.warning('Admins only', 'Only admins can mark payouts as paid.'); return; }
  if (p.status !== 'approved') { toast.warning('Not payable', 'Only approved payouts can be marked as paid.'); return; }

  const { label } = payoutMethodMeta(p.method);
  const reference = await customPrompt(
    `Paid ₵${(p.amount||0).toFixed(2)} via ${label} to ${payoutDestination(p)}? Enter the transfer reference / transaction ID:`,
    '', 'Mark Payout as Paid', 'e.g. MoMo transaction ID'
  );
  if (!reference || !reference.trim()) return;   // a reference is required for the audit trail

  try {
    await apiRequest(`/admin/payouts/${payoutId}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentReference: reference.trim() }),
    });
  } catch (err) {
    _notifyPayoutError('Could not mark as paid', err.message || 'Please try again.');
    return;
  }
  await loadData();
  toast.success('Marked as paid', `₵${(p.amount||0).toFixed(2)} recorded as sent. The organizer has been emailed.`);
}

// ── bulk actions ──────────────────────────────────────────────────

async function bulkApprovePayouts() {
  const ids = [...selectedIds.payouts].filter(id => payouts.find(p => p.id === id)?.status === 'pending');
  if (!ids.length) { toast.warning('None eligible', 'No pending payouts selected.'); return; }
  showBulkConfirm('Approve Payouts', `Approve ${ids.length} payout(s)?`, async () => {
    let ok = 0, failed = 0, lastError = '';
    for (const id of ids) {
      try { await apiRequest(`/admin/payouts/${id}/approve`, { method: 'PATCH' }); ok++; }
      catch (err) { failed++; lastError = err.message || ''; }
    }
    selectedIds.payouts.clear();
    await loadData();
    if (failed) _notifyPayoutError('Some payouts were not approved', `${ok} approved, ${failed} failed. ${lastError}`);
    else        toast.success('Done', `${ok} payout(s) approved. Send the money, then mark them as paid.`);
  });
}

async function bulkRejectPayouts() {
  const ids = [...selectedIds.payouts].filter(id => ['pending', 'approved'].includes(payouts.find(p => p.id === id)?.status));
  if (!ids.length) { toast.warning('None eligible', 'No pending or approved payouts selected.'); return; }
  const reason = await customPrompt('Rejection reason (will be applied to all selected payouts):', '', 'Bulk Reject Payouts', 'e.g. Missing documentation...');
  if (!reason) return;
  let ok = 0, failed = 0, lastError = '';
  for (const id of ids) {
    try { await apiRequest(`/admin/payouts/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }); ok++; }
    catch (err) { failed++; lastError = err.message || ''; }
  }
  selectedIds.payouts.clear();
  await loadData();
  if (failed) _notifyPayoutError('Some payouts were not rejected', `${ok} rejected, ${failed} failed. ${lastError}`);
  else        toast.warning('Done', `${ok} payout(s) rejected.`);
}

// Admin only: mark several approved payouts as paid with one shared reference
// (for example the batch ID of a MoMo bulk disbursement).
async function bulkCompletePayouts() {
  if (!_canPayPayouts()) { toast.warning('Admins only', 'Only admins can mark payouts as paid.'); return; }
  const ids = [...selectedIds.payouts].filter(id => payouts.find(p => p.id === id)?.status === 'approved');
  if (!ids.length) { toast.warning('None eligible', 'No approved payouts selected.'); return; }

  const total = ids.reduce((s, id) => s + (payouts.find(p => p.id === id)?.amount || 0), 0);
  const reference = await customPrompt(
    `Mark ${ids.length} payout(s) totalling ₵${total.toFixed(2)} as paid. Enter the batch or transaction reference:`,
    '', 'Mark Payouts as Paid', 'e.g. MoMo bulk batch ID'
  );
  if (!reference || !reference.trim()) return;

  let ok = 0, failed = 0, lastError = '';
  for (const id of ids) {
    try {
      await apiRequest(`/admin/payouts/${id}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({ paymentReference: reference.trim() }),
      });
      ok++;
    } catch (err) { failed++; lastError = err.message || ''; }
  }
  selectedIds.payouts.clear();
  await loadData();
  if (failed) _notifyPayoutError('Some payouts were not marked as paid', `${ok} done, ${failed} failed. ${lastError}`);
  else        toast.success('Done', `${ok} payout(s) marked as paid.`);
}
