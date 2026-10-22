// services/analyticsService.js
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const { AppError } = require('../utils/appError');

const MAX_DAYS = 90;

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
}

module.exports = new AnalyticsService();
