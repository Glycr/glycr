// ===============================================
// REPORTS + CHARTS
// ===============================================

function renderReports() {
  const byCategory = events.reduce((acc, ev) => {
    const rev = tickets.filter(t => (t.eventId?.id||t.eventId?._id?.toString()) === ev.id).reduce((s,t) => s+(t.price||0), 0);
    acc[ev.category] = (acc[ev.category] || 0) + rev;
    return acc;
  }, {});
  const catHTML = Object.entries(byCategory).sort((a,b) => b[1]-a[1]).slice(0,5)
    .map(([cat,rev]) => `<div style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid #334155;"><span style="text-transform:capitalize;">${cat||'Uncategorised'}</span><span style="font-weight:700;color:#6366f1;">₵${rev.toFixed(2)}</span></div>`).join('');
  const catEl = document.getElementById('revenue-by-category');
  if (catEl) catEl.innerHTML = catHTML || '<div class="empty-state"><i class="fa-solid fa-chart-pie" style="display:block;font-size:1.5rem;margin-bottom:0.5rem;"></i>No data</div>';

  const byOrg = events.reduce((acc, ev) => {
    const rev = tickets.filter(t => (t.eventId?.id||t.eventId?._id?.toString()) === ev.id).reduce((s,t) => s+(t.price||0), 0);
    const org = users.find(u => u.id === (ev.organizerId?.id||ev.organizerId?._id?.toString()));
    const key = org?.name || org?.email || 'Unknown';
    acc[key]  = (acc[key] || 0) + rev;
    return acc;
  }, {});
  const trophyColors = ['#f59e0b','#94a3b8','#b45309'];
  const orgHTML = Object.entries(byOrg).sort((a,b) => b[1]-a[1]).slice(0,5)
    .map(([name,rev],i) => `<div style="display:flex;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid #334155;align-items:center;"><span style="overflow:hidden;text-overflow:ellipsis;font-size:0.875rem;"><i class="fa-solid ${i<3?'fa-trophy':'fa-medal'}" style="color:${trophyColors[i]||'#334155'};margin-right:0.4rem;"></i>${name}</span><span style="font-weight:700;color:#8b5cf6;margin-left:1rem;">₵${rev.toFixed(2)}</span></div>`).join('');
  const orgEl = document.getElementById('top-organizers');
  if (orgEl) orgEl.innerHTML = orgHTML || '<div class="empty-state"><i class="fa-solid fa-trophy" style="display:block;font-size:1.5rem;margin-bottom:0.5rem;"></i>No data</div>';

  const totalRevenue = tickets.reduce((s,t) => s+(t.price||0), 0);
  setText('avg-ticket-price',  `₵${tickets.length > 0 ? (totalRevenue/tickets.length).toFixed(2) : '0.00'}`);
  setText('avg-event-revenue', `₵${events.length  > 0 ? (totalRevenue/events.length).toFixed(2)  : '0.00'}`);
  setText('total-cancelled',   events.filter(e => e.isCancelled).length);
  setText('platform-fee',      `₵${(totalRevenue*(platformFeePercent/100)).toFixed(2)} (${platformFeePercent}%)`);
  setText('total-refunded',    `₵${stats.totalRefunded.toFixed(2)}`);
}

function setChartPeriod(period, btn) {
  currentChartPeriod = period;
  document.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCharts();
}

function groupByPeriod(items, dateField, valueField, period, numBuckets) {
  const now   = new Date();
  const buckets = [];
  const labels  = [];

  if (period === 'daily') {
    for (let i = numBuckets - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      buckets.push({ start: new Date(d), end: new Date(d.setHours(23,59,59,999)) });
      labels.push(d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' }));
    }
  } else if (period === 'weekly') {
    for (let i = numBuckets - 1; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - i * 7 - start.getDay());
      start.setHours(0,0,0,0);
      const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23,59,59,999);
      buckets.push({ start, end });
      labels.push(`W/C ${start.toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}`);
    }
  } else if (period === 'monthly') {
    for (let i = numBuckets - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d);
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      buckets.push({ start, end });
      labels.push(d.toLocaleDateString('en-GB', { month:'short', year:'numeric' }));
    }
  } else if (period === 'yearly') {
    for (let i = numBuckets - 1; i >= 0; i--) {
      const year = now.getFullYear() - i;
      const start = new Date(year, 0, 1, 0, 0, 0, 0);
      const end   = new Date(year, 11, 31, 23, 59, 59, 999);
      buckets.push({ start, end });
      labels.push(String(year));
    }
  }

  const values = buckets.map(({ start, end }) => {
    const inRange = items.filter(item => {
      const d = new Date(item[dateField] || item.createdAt || item.timestamp);
      return !isNaN(d) && d >= start && d <= end;
    });
    if (valueField === null) return inRange.length;
    return inRange.reduce((s, item) => s + (Number(item[valueField]) || 0), 0);
  });

  return { labels, values };
}

function renderCharts() {
  if (typeof Chart === 'undefined') return;

  const numBuckets = currentChartPeriod === 'daily' ? 14 : currentChartPeriod === 'weekly' ? 12 : currentChartPeriod === 'monthly' ? 6 : 5;
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = "'Inter', sans-serif";

  const gridColor  = 'rgba(51,65,85,0.6)';
  const tickColor  = '#64748b';

  const revData = groupByPeriod(tickets, 'purchasedAt', 'price', currentChartPeriod, numBuckets);
  const totalRev = revData.values.reduce((a,b) => a+b, 0);
  setText('chart-revenue-total', `₵${totalRev.toFixed(2)} total`);

  const revCtx = document.getElementById('chart-revenue');
  if (revCtx) {
    if (chartRevenue) chartRevenue.destroy();
    chartRevenue = new Chart(revCtx, {
      type: 'line',
      data: {
        labels: revData.labels,
        datasets: [{
          label: 'Revenue (₵)',
          data: revData.values,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.12)',
          borderWidth: 2.5,
          pointBackgroundColor: '#6366f1',
          pointRadius: 3,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1,
            titleColor: '#f1f5f9', bodyColor: '#94a3b8',
            callbacks: { label: ctx => ` ₵${ctx.parsed.y.toFixed(2)}` }
          }
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: tickColor, maxTicksLimit: 8 } },
          y: { grid: { color: gridColor }, ticks: { color: tickColor, callback: v => `₵${v}` }, beginAtZero: true }
        }
      }
    });
  }

  const tixData  = groupByPeriod(tickets, 'purchasedAt', null, currentChartPeriod, numBuckets);
  const totalTix = tixData.values.reduce((a,b) => a+b, 0);
  setText('chart-tickets-total', `${totalTix} tickets`);

  const tixCtx = document.getElementById('chart-tickets');
  if (tixCtx) {
    if (chartTickets) chartTickets.destroy();
    chartTickets = new Chart(tixCtx, {
      type: 'bar',
      data: {
        labels: tixData.labels,
        datasets: [{
          label: 'Tickets Sold', data: tixData.values,
          backgroundColor: 'rgba(139,92,246,0.7)', borderColor: '#8b5cf6',
          borderWidth: 1, borderRadius: 4, hoverBackgroundColor: '#8b5cf6',
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1, titleColor: '#f1f5f9', bodyColor: '#94a3b8' } },
        scales: {
          x: { grid: { display: false }, ticks: { color: tickColor, maxTicksLimit: 8 } },
          y: { grid: { color: gridColor }, ticks: { color: tickColor }, beginAtZero: true }
        }
      }
    });
  }

  const rawUserData = groupByPeriod(users, 'createdAt', null, currentChartPeriod, numBuckets);
  const cumulativeUsers = rawUserData.values.reduce((acc, val, i) => { acc.push((acc[i - 1] || 0) + val); return acc; }, []);
  const totalNewUsers = rawUserData.values.reduce((a,b) => a+b, 0);
  setText('chart-users-total', `+${totalNewUsers} new`);

  const usrCtx = document.getElementById('chart-users');
  if (usrCtx) {
    if (chartUsers) chartUsers.destroy();
    chartUsers = new Chart(usrCtx, {
      type: 'line',
      data: {
        labels: rawUserData.labels,
        datasets: [
          {
            label: 'Total Users', data: cumulativeUsers,
            borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)',
            borderWidth: 2.5, pointBackgroundColor: '#06b6d4', pointRadius: 3, pointHoverRadius: 6,
            fill: true, tension: 0.4, yAxisID: 'y',
          },
          {
            label: 'New Registrations', data: rawUserData.values,
            borderColor: 'rgba(6,182,212,0.4)', backgroundColor: 'transparent',
            borderWidth: 1.5, borderDash: [4,3], pointRadius: 2, tension: 0.4, yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12 } },
          tooltip: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1, titleColor: '#f1f5f9', bodyColor: '#94a3b8' }
        },
        scales: {
          x:  { grid: { color: gridColor }, ticks: { color: tickColor, maxTicksLimit: 8 } },
          y:  { grid: { color: gridColor }, ticks: { color: tickColor }, beginAtZero: true, position: 'left' },
          y1: { grid: { display: false },   ticks: { color: tickColor }, beginAtZero: true, position: 'right' },
        }
      }
    });
  }
}