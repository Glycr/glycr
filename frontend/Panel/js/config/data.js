// ===============================================
// DATA LOAD, STATISTICS, DASHBOARD
// ===============================================

async function loadData() {
  try {
    const normalize = arr => arr.map(r => ({ ...r, id: r.id || r._id?.toString() || r._id }));
    users           = normalize(await apiRequest('/admin/users'));
    events          = normalize(await apiRequest('/admin/events'));
    tickets         = normalize(await apiRequest('/admin/tickets'));
    payouts         = normalize(await apiRequest('/admin/payouts'));
    refunds         = normalize(await apiRequest('/admin/refunds/all'));
    waitlist        = normalize(await apiRequest('/admin/waitlists'));
    serviceRequests = normalize(await apiRequest('/admin/service-requests'));
    await loadMessages();
    await loadTransactions();
    await loadLogs();
    calculateStats();
    renderDashboard();
    renderUsers();
    renderEvents();
    renderTickets();
    renderPayouts();
    renderRefunds();
    renderWaitlist();
    renderServiceRequests();
    renderReports();
    populateWaitlistEventFilter();
    updateBroadcastAudiencePreview();
  } catch (err) {
    console.error('Failed to load data', err);
    toast.error('Load failed', 'Check that the backend is running and you are logged in.');
  }
}

function calculateStats() {
  stats = {
    totalUsers:       users.length,
    totalOrganizers:  users.filter(u => u.role === 'organizer').length,
    totalEvents:      events.length,
    liveEvents:       events.filter(e => e.isPublished && !e.isCancelled && new Date(e.date) > new Date()).length,
    totalRevenue:     tickets.reduce((s, t) => s + (t.price || 0), 0),
    pendingPayouts:   payouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0),
    pendingRefunds:   refunds.filter(r => r.status === 'pending').reduce((s, r) => s + (r.amount || 0), 0),
    totalRefunded:    refunds.filter(r => r.status === 'approved').reduce((s, r) => s + (r.amount || 0), 0),
    totalTickets:     tickets.length,
    flaggedEvents:    events.filter(e => e.flagged).length,
    waitlistCount:    waitlist.length,
    openServiceRequests: serviceRequests.filter(r => r.status !== 'resolved').length,
    get platformFeeAmount() { return this.totalRevenue * (platformFeePercent / 100); },
    platformFeeRate:  platformFeePercent,
  };
}

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
  setText('quick-log-count',        logs.length);
  setText('quick-waitlist-count',   stats.waitlistCount);
  setText('quick-sr-count',         stats.openServiceRequests);
  setText('open-sr-count',          stats.openServiceRequests);
  const feeEl = document.getElementById('stat-platform-fee');
  if (feeEl) feeEl.textContent = `₵${stats.platformFeeAmount.toFixed(2)} (${stats.platformFeeRate}%)`;

  const txnCount = document.getElementById('quick-transactions-count');
  if (txnCount) txnCount.textContent = transactions.length;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
