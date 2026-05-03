// ===============================================
// TABS & FILTER HELPER FUNCTIONS
// ===============================================

function showTab(tab, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tab).classList.add('active');
  if (el) el.classList.add('active');
  if (tab === 'logs')             renderLogs();
  if (tab === 'waitlist')         renderWaitlist();
  if (tab === 'refunds')          renderRefunds();
  if (tab === 'service-requests') renderServiceRequests();
  if (tab === 'transactions')     { renderTransactions(); renderTransactionSummaryCards(); }
  if (tab === 'messages')         { renderMessages(); updateMessageStats(); updateBroadcastAudiencePreview(); }
  if (tab === 'reports')          { renderReports(); renderCharts(); }
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
