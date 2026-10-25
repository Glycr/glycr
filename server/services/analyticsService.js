// services/analyticsService.js
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const { AppError } = require('../utils/appError');
const Payout = require('../models/Payout');
const settingsService = require('./settingsService');

const MAX_DAYS = 90;
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

    // --- Fetch tickets (plain objects, no null purchasedAt) ---
    const tickets = await Ticket.find({
      eventId: { $in: eventIds },
      purchasedAt: { $ne: null },
    }).lean();

    // --- Build day-by-day trend ---
    const labels = [];
    const ticketsData = [];
    const revenueData = [];
    const now = new Date();

    for (let i = parsed - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);

      labels.push(d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }));

      const dayTickets = tickets.filter((t) => {
        const pd = new Date(t.purchasedAt);
        return !isNaN(pd) && pd >= d && pd < nextDay;
      });

      ticketsData.push(dayTickets.length);
      revenueData.push(dayTickets.reduce((sum, t) => sum + (t.price || 0), 0));
    }

    return { labels, tickets: ticketsData, revenue: revenueData };
  }

  async getOrganizerSummary(organizerId) {
    if (!organizerId) throw new AppError('organizerId is required', 400);

    const events = await Event.find({ organizerId }).select('_id').lean();
    const eventIds = events.map((e) => e._id);

    const settings = await settingsService.getSettings();
    const feePercent = settings.platformFee;

    const [rows, payoutRows] = await Promise.all([
      Ticket.aggregate([
        { $match: { eventId: { $in: eventIds }, status: { $nin: ['cancelled', 'refund_pending', 'refunded'] } } },
        { $group: {
            _id: { eventId: '$eventId', type: '$ticketType' },
            sold: { $sum: QTY },
            revenue: { $sum: REVENUE },
          } },
      ]),
      Payout.find({ organizerId, status: { $in: ['pending', 'completed'] } })
        .select('status amount')
        .lean(),
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
      completedPayouts: paid('completed'),
      pendingPayouts: paid('pending'),
      availableForPayout: Math.max(0, r2(netRevenue - paid('completed') - paid('pending'))),
      perEvent,
      byType,
    };
  }
}

module.exports = new AnalyticsService();
