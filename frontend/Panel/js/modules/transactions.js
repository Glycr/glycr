// ===============================================
// TRANSACTIONS
// ===============================================

function _buildTransactionsFromData() {
  const txns = [];

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
      description: `Ticket purchase — ${ev?.title || 'Event'}`,
      eventTitle: ev?.title || '',
      ticketId:   t.id,
      createdAt:  t.purchasedAt || t.createdAt || new Date().toISOString(),
    });
  });

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
      description: `Refund — ${r.eventTitle || 'Event'}`,
      eventTitle: r.eventTitle || '',
      createdAt:  r.resolvedAt || r.requestedAt || new Date().toISOString(),
    });
  });

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
      description: `Organizer payout — ${p.method?.toUpperCase() || 'MOMO'}`,
      eventTitle: '',
      createdAt:  p.completedAt || p.requestedAt || new Date().toISOString(),
    });
  });

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

function renderTransactions() {
  const tb      = document.getElementById('transactions-table');
  if (!tb) return;

  const filtered = getFilteredTransactions();
  const sorted   = applySorting(filtered, 'transactions');
  const { rows, page, totalPages, total, pp } = paginate(sorted, 'transactions');

  renderTransactionSummaryCards();

  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="10" class="empty-state"><i class="fa-solid fa-arrow-right-arrow-left" style="font-size:1.5rem;display:block;margin-bottom:0.5rem;"></i>No transactions found</td></tr>`;
    renderPaginationBar('transactions-pagination', 'transactions', 0, 1, 1, pp);
    return;
  }

  tb.innerHTML = rows.map(txn => {
    const isCredit  = txn.type === 'credit';
    const shortId   = String(txn.id).substring(0, 14);
    const dateStr   = new Date(txn.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    const timeStr   = new Date(txn.createdAt).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
    const typeBadge = isCredit
      ? `<span class="txn-type-badge txn-type-credit"><i class="fa-solid fa-arrow-down-to-line"></i> Credit</span>`
      : `<span class="txn-type-badge txn-type-debit"><i class="fa-solid fa-arrow-up-from-line"></i> Debit</span>`;
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
    const statusMap = {
      success: ['badge-active',    'fa-circle-check',       'Success'],
      pending: ['badge-pending',   'fa-clock',              'Pending'],
      failed:  ['badge-cancelled', 'fa-circle-xmark',       'Failed'],
    };
    const [sBadge, sIcon, sLabel] = statusMap[txn.status] || statusMap.success;
    const amtColor  = isCredit ? '#34d399' : '#f87171';
    const amtPrefix = isCredit ? '+' : '−';
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
        <td><div class="txn-id" title="${txn.id}">${shortId}…</div>${txn.reference ? `<div class="txn-ref"><i class="fa-solid fa-hashtag" style="font-size:0.6rem;margin-right:0.2rem;"></i>${txn.reference}</div>` : ''}</td>
        <td>${typeBadge}</td>
        <td>${catPill}</td>
        <td><div class="txn-user-name">${txn.userName || '—'}</div><div class="txn-user-email">${txn.userEmail || '—'}</div></td>
        <td><div class="txn-amount" style="color:${amtColor};">${amtPrefix}₵${(txn.amount || 0).toFixed(2)}</div></td>
        <td><span class="badge ${sBadge}"><i class="fa-solid ${sIcon}"></i> ${sLabel}</span></td>
        <td><div class="txn-method"><i class="${methodIcon}" style="margin-right:0.3rem;color:#64748b;"></i>${methodLabel}</div></td>
        <td><div style="font-size:0.875rem;">${dateStr}</div><div style="font-size:0.72rem;color:#475569;">${timeStr}</div></td>
        <td><div class="actions"><button class="btn-icon" style="background:#6366f1;" onclick="viewTransaction('${txn.id}')" title="View Details"><i class="fa-solid fa-eye"></i></button></div></td>
      </table>`;
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
      <div style="margin-left:auto;"><span class="badge ${sBadge}"><i class="fa-solid ${sIcon}"></i> ${sLabel}</span></div>
    </div>
    <div class="detail-grid">
      <div class="detail-item" style="grid-column:span 2;"><div class="detail-label"><i class="fa-solid fa-fingerprint"></i> Transaction ID</div><div class="detail-value" style="font-family:monospace;font-size:0.8rem;word-break:break-all;">${txn.id}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-arrow-right-arrow-left"></i> Type</div><div class="detail-value" style="text-transform:capitalize;">${txn.type}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="${catIcon}"></i> Category</div><div class="detail-value">${catLabel}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="${methodIcon}"></i> Payment Method</div><div class="detail-value" style="text-transform:uppercase;">${txn.method || '—'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-solid fa-hashtag"></i> Reference</div><div class="detail-value" style="font-family:monospace;">${txn.reference || '—'}</div></div>
      <div class="detail-item"><div class="detail-label"><i class="fa-regular fa-calendar"></i> Date &amp; Time</div><div class="detail-value">${new Date(txn.createdAt).toLocaleString()}</div></div>
      ${txn.eventTitle ? `<div class="detail-item"><div class="detail-label"><i class="fa-regular fa-calendar-check"></i> Event</div><div class="detail-value">${txn.eventTitle}</div></div>` : '<div></div>'}
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
      <button class="btn btn-primary" style="margin-top:0.75rem;font-size:0.78rem;padding:0.4rem 0.8rem;" onclick="closeModal('transaction-modal');viewTicket('${txn.ticketId}');"><i class="fa-solid fa-eye"></i> View Ticket</button>
    </div>` : ''}`;
  addLog('system', `Viewed transaction details`, { adminName: currentAdmin.name, adminRole: currentAdmin.role, txnId: txn.id, amount: txn.amount, type: txn.type });
  openModal('transaction-modal');
}