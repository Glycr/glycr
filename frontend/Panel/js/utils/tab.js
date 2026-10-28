// ===============================================
// TABS & FILTER HELPER FUNCTIONS
// ===============================================

// A tab that fails to render must never stop the tab itself from opening.
function _renderSafely(fn) {
  try { fn(); } catch (err) { console.error(`${fn.name || 'render'} failed`, err); }
}

function showTab(tab, el) {
  const target = document.getElementById(tab);
  if (!target) return;

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  target.classList.add('active');
  if (el) el.classList.add('active');

  // Tabs that show totals rebuild the stats first, so they are never empty or stale
  if (tab === 'dashboard')        { _renderSafely(calculateStats); _renderSafely(renderDashboard); }
  if (tab === 'payouts')          { _renderSafely(calculateStats); _renderSafely(renderPayouts); }
  if (tab === 'refunds')          { _renderSafely(calculateStats); _renderSafely(renderRefunds); }
  if (tab === 'logs')             _renderSafely(renderLogs);
  if (tab === 'waitlist')         _renderSafely(renderWaitlist);
  if (tab === 'service-requests') _renderSafely(renderServiceRequests);
  if (tab === 'transactions')     { _renderSafely(renderTransactions); _renderSafely(renderTransactionSummaryCards); }
  if (tab === 'messages')         { _renderSafely(renderMessages); _renderSafely(updateMessageStats); _renderSafely(updateBroadcastAudiencePreview); }
  if (tab === 'reports')          { _renderSafely(calculateStats); _renderSafely(renderReports); _renderSafely(renderCharts); }
}

// Filter alias functions (trigger re‑render after filter change)
function filterUsers()           { pageState.users = 1; renderUsers(); }
function filterEvents()          { pageState.events = 1; renderEvents(); }
function filterPayouts()         { pageState.payouts = 1; renderPayouts(); }
function filterTickets()         { pageState.tickets = 1; renderTickets(); }
function filterRefunds()         { pageState.refunds = 1; renderRefunds(); }
function filterWaitlist()        { pageState.waitlist = 1; renderWaitlist(); }
function filterServiceRequests() { pageState['service-requests'] = 1; renderServiceRequests(); }
function filterMessages()        { pageState.messages = 1; renderMessages(); }
function filterTransactions()    { pageState.transactions = 1; renderTransactions(); }