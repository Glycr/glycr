// ===============================================
// DATA LOAD, STATISTICS, DASHBOARD
// ===============================================

// ── ticket helpers (shared by stats, reports and charts) ──────────
// A ticket only counts as a sale while it is not cancelled or refunded.
const VOIDED_TICKET_STATUSES = ['cancelled', 'refund_pending', 'refunded'];

function isSaleTicket(t) {
  return !VOIDED_TICKET_STATUSES.includes(t.status) && !t.refunded;
}
// one document = 1 ticket, except group tickets that hold several slots
function ticketQty(t) {
  return t.isGroupTicket ? (Number(t.totalSlots) || 1) : 1;
}
function ticketRevenue(t) {
  return (Number(t.price) || 0) * ticketQty(t);
}
function saleTickets() {
  return tickets.filter(isSaleTicket);
}

// ── load ──────────────────────────────────────────────────────────
// Every source loads independently. One failing endpoint (for example a
// route that does not exist yet) no longer stops the others, and stats and
// screens are always rebuilt from whatever did load.

async function loadData() {
  const normalize = arr => (Array.isArray(arr) ? arr : [])
    .map(r => ({ ...r, id: r.id || r._id?.toString() || r._id }));

  const sources = [
    { name: 'users',            path: '/admin/users',            set: v => { users = normalize(v); } },
    { name: 'events',           path: '/admin/events',           set: v => { events = normalize(v); } },
    { name: 'tickets',          path: '/admin/tickets',          set: v => { tickets = normalize(v); } },
    { name: 'payouts',          path: '/admin/payouts',          set: v => { payouts = normalize(v); } },
    { name: 'refunds',          path: '/admin/refunds/all',      set: v => { refunds = normalize(v); } },
    { name: 'waitlist',         path: '/admin/waitlists',        set: v => { waitlist = normalize(v); } },
    { name: 'service requests', path: '/admin/service-requests', set: v => { serviceRequests = normalize(v); } },
  ];
  const failed = [];

  const fetched = await Promise.allSettled(sources.map(s => apiRequest(s.path)));
  fetched.forEach((res, i) => {
    if (res.status === 'fulfilled') {
      sources[i].set(res.value);
    } else {
      failed.push(sources[i].name);
      console.error(`Failed to load ${sources[i].name}`, res.reason);
    }
  });

  const extras = [
    { name: 'messages',     run: loadMessages },
    { name: 'transactions', run: loadTransactions },
    { name: 'logs',         run: loadLogs },
  ];
  const extraResults = await Promise.allSettled(extras.map(x => x.run()));
  extraResults.forEach((res, i) => {
    if (res.status === 'rejected') {
      failed.push(extras[i].name);
      console.error(`Failed to load ${extras[i].name}`, res.reason);
    }
  });

  // statistics first, then every screen; one broken screen does not block the rest
  [
    calculateStats, renderDashboard, renderUsers, renderEvents, renderTickets,
    renderPayouts, renderRefunds, renderWaitlist, renderServiceRequests,
    renderReports, populateWaitlistEventFilter, updateBroadcastAudiencePreview,
  ].forEach(fn => {
    try { fn(); } catch (err) { console.error(`${fn.name} failed`, err); }
  });

  if (failed.length) {
    toast.error('Some data could not be loaded', `${failed.join(', ')}. The rest of the panel still works.`);
  }
}

// ── statistics ────────────────────────────────────────────────────

function calculateStats() {
  const sales = saleTickets();
  const amountOf = (list, ...statuses) => list
    .filter(x => statuses.includes(x.status))
    .reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const feePct = Number(platformFeePercent) || 0;

  stats = {
    totalUsers:       users.length,
    totalOrganizers:  users.filter(u => u.role === 'organizer').length,
    totalEvents:      events.length,
    liveEvents:       events.filter(e => e.isPublished && !e.isCancelled && new Date(e.date) > new Date()).length,

    // sales: cancelled and refunded tickets are not revenue
    totalRevenue:     sales.reduce((s, t) => s + ticketRevenue(t), 0),
    totalTickets:     sales.reduce((s, t) => s + ticketQty(t), 0),

    // payouts: pending + approved is money owed to organizers and not sent yet
    pendingPayouts:   amountOf(payouts, 'pending', 'approved'),
    approvedPayouts:  amountOf(payouts, 'approved'),
    paidPayouts:      amountOf(payouts, 'completed'),

    // refunds: pending = waiting for review, approved = owed, completed = paid out
    pendingRefunds:       amountOf(refunds, 'pending'),
    awaitingRefundPayout: amountOf(refunds, 'approved'),
    paidRefunds:          amountOf(refunds, 'completed'),
    totalRefunded:        amountOf(refunds, 'approved', 'completed'),

    flaggedEvents:    events.filter(e => e.flagged).length,
    waitlistCount:    waitlist.length,
    openServiceRequests: serviceRequests.filter(r => r.status !== 'resolved').length,
    platformFeeRate:  feePct,
    get platformFeeAmount() { return this.totalRevenue * (feePct / 100); },
  };
}

// ── dashboard ─────────────────────────────────────────────────────

function renderDashboard() {
  setText('stat-users',         stats.totalUsers);
  setText('stat-live-events',   stats.liveEvents);
  setText('stat-revenue',       `₵${stats.totalRevenue.toFixed(2)}`);
  setText('stat-tickets',       stats.totalTickets);
  setText('stat-organizers',    stats.totalOrganizers);
  setText('stat-total-events',  stats.totalEvents);
  setText('stat-avg-revenue',   `₵${stats.totalEvents > 0 ? (stats.totalRevenue / stats.totalEvents).toFixed(2) : '0.00'}`);
  setText('quick-users-count',      stats.totalUsers);
  setText('quick-pending-payouts',  `₵${stats.pendingPayouts.toFixed(2)}`);
  setText('quick-pending-refunds',  `₵${stats.pendingRefunds.toFixed(2)}`);
  setText('quick-flagged-events',   stats.flaggedEvents);
  setText('quick-log-count',        typeof logs !== 'undefined' ? logs.length : 0);
  setText('quick-waitlist-count',   stats.waitlistCount);
  setText('quick-sr-count',         stats.openServiceRequests);
  setText('open-sr-count',          stats.openServiceRequests);
  const feeEl = document.getElementById('stat-platform-fee');
  if (feeEl) feeEl.textContent = `₵${stats.platformFeeAmount.toFixed(2)} (${stats.platformFeeRate}%)`;

  const txnCount = document.getElementById('quick-transactions-count');
  if (txnCount) txnCount.textContent = typeof transactions !== 'undefined' ? transactions.length : 0;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}