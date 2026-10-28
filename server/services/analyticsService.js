// services/analyticsService.js
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const { AppError } = require('../utils/appError');
const Payout = require('../models/Payout');
const settingsService = require('./settingsService');
const payoutService = require('./payoutService');

const MAX_DAYS = 90;
const TZ = 'Africa/Accra';   // day boundaries for the sales trend (UTC+0, no daylight saving)

// Tickets that no longer count as sales: the event was cancelled, or the money is being / was returned.
const VOIDED_STATUSES = ['cancelled', 'refund_pending', 'refunded'];

// One ticket document = 1 ticket, except group tickets, which hold `totalSlots` tickets.
const QTY = { $cond: [{ $eq: ['$isGroupTicket', true] }, '$totalSlots', 1] };
// Revenue per document. If `price` on a group ticket is already the TOTAL (not per slot),
// change this to just { $ifNull: ['$price', 0] }. If you store the final amount charged
// (after coupons/group discounts) in another field, use that field here.
const REVENUE = { $multiply: [{ $ifNull: ['$price', 0] }, QTY] };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;


class AnalyticsService {
  async getSalesTrend(organizerId, days = 7) {
    // --- Input validation (AppError → maps to 4xx in errorHandler) ---
    if (!organizerId) throw new AppError('organizerId is required', 400);

    const parsed = Number(days);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_DAYS) {
      throw new AppError(`days must be an integer between 1 and ${MAX_DAYS}`, 400);
    }

    // --- Fetch events (only ids) ---
    const events = await Event.find({ organizerId }).select('_id').lean();
    const eventIds = events.map((e) => e._id);

    // --- One aggregation instead of loading every ticket into memory.
    //     Cancelled / refunded tickets are not counted as sales, and group
    //     tickets count as all of their slots (same rules as the summary). ---
    const DAY_MS = 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - (parsed + 1) * DAY_MS);   // a day of margin; days are matched by key below

    const rows = await Ticket.aggregate([
      { $match: {
          eventId: { $in: eventIds },
          purchasedAt: { $ne: null, $gte: since },
          status: { $nin: VOIDED_STATUSES },
        } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$purchasedAt', timezone: TZ } },
          tickets: { $sum: QTY },
          revenue: { $sum: REVENUE },
        } },
    ]);
    const byDay = new Map(rows.map((r) => [r._id, r]));

    // --- Build day-by-day trend (oldest → today) ---
    const labels = [];
    const ticketsData = [];
    const revenueData = [];

    for (let i = parsed - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * DAY_MS);
      const key = d.toLocaleDateString('en-CA', { timeZone: TZ });   // YYYY-MM-DD
      labels.push(d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', timeZone: TZ }));

      const row = byDay.get(key);
      ticketsData.push(row ? row.tickets : 0);
      revenueData.push(row ? r2(row.revenue) : 0);
    }

    return { labels, tickets: ticketsData, revenue: revenueData };
  }

  async getOrganizerSummary(organizerId) {
    if (!organizerId) throw new AppError('organizerId is required', 400);

    const events = await Event.find({ organizerId }).select('_id').lean();
    const eventIds = events.map((e) => e._id);

    const settings = await settingsService.getSettings();
    const feePercent = settings.platformFee;

    const [rows, payoutRows, availableForPayout] = await Promise.all([
      Ticket.aggregate([
        { $match: { eventId: { $in: eventIds }, status: { $nin: VOIDED_STATUSES } } },
        { $group: {
            _id: { eventId: '$eventId', type: '$ticketType' },
            sold: { $sum: QTY },
            revenue: { $sum: REVENUE },
          } },
      ]),
      // approved = reserved but not sent yet, so it is still money owed to the organizer
      Payout.find({ organizerId, status: { $in: ['pending', 'approved', 'completed'] } })
        .select('status amount')
        .lean(),
      // single source of truth: exactly what the payout form allows them to request
      payoutService.getAvailableBalance(organizerId),
    ]);

    const perEvent = {};
    const byType = {};
    let ticketsSold = 0;
    let grossRevenue = 0;

    for (const row of rows) {
      const id = String(row._id.eventId);
      const pe = (perEvent[id] ||= { sold: 0, revenue: 0, net: 0 });
      pe.sold += row.sold;
      pe.revenue += row.revenue;
      byType[row._id.type] = (byType[row._id.type] || 0) + row.sold;
      ticketsSold += row.sold;
      grossRevenue += row.revenue;
    }
    for (const pe of Object.values(perEvent)) {
      pe.revenue = r2(pe.revenue);
      pe.net = r2(pe.revenue * (1 - feePercent / 100));
    }

    const paid = (status) =>
      payoutRows
        .filter((p) => p.status === status)
        .reduce((sum, p) => sum + (p.amount || 0), 0);
    const netRevenue = r2(grossRevenue * (1 - feePercent / 100));

    return {
      feePercent,
      totalEvents: events.length,
      ticketsSold,
      grossRevenue: r2(grossRevenue),
      netRevenue,
      completedPayouts: r2(paid('completed')),
      // requested or approved but not yet sent
      pendingPayouts: r2(paid('pending') + paid('approved')),
      approvedPayouts: r2(paid('approved')),
      availableForPayout,
      perEvent,
      byType,
    };
  }
}

module.exports = new AnalyticsService();
